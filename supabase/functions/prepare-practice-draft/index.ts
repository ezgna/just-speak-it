import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse, getOpenAITextModel } from '../_shared/openai.ts';
import {
  DraftPromptVersion,
  DraftSchemaVersion,
  parsePreparePracticeDraftRequest,
  type CardSplitPolicy,
  type PracticeGenerationStatus,
  type TranscriptWord,
  type TranslationStyle,
} from '../_shared/practice-contract.ts';

type DraftCard = {
  japanese: string;
  sourceWordStartIndex: number | null;
  sourceWordEndIndex: number | null;
};

type PreparePracticeDraftOutput = {
  bulletPoints: string[];
  cards: DraftCard[];
};

type DiaryEntryRow = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
  is_transcript_edited: boolean;
  bullet_points: unknown;
  transcript_words: unknown;
  waveform_peaks: unknown;
  content_hash: string;
  created_at: string;
  updated_at: string;
};

type PracticeGenerationRow = {
  card_split_policy: CardSplitPolicy;
  client_request_id: string;
  diary_entry_id: string;
  error_message: string | null;
  id: string;
  status: PracticeGenerationStatus;
  translation_style: TranslationStyle;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type TranslationCardRow = {
  audio_end_sec: number | null;
  audio_start_sec: number | null;
  created_at?: string;
  english: string | null;
  id: string;
  japanese: string;
  last_reviewed_at: string | null;
  learning_status: 'new' | 'learning' | 'known';
  next_review_at: string | null;
  practice_generation_id: string;
  review_count: number;
  sort_order: number;
  source_word_end_index: number | null;
  source_word_start_index: number | null;
  success_count: number;
};

const draftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['bulletPoints', 'cards'],
  properties: {
    bulletPoints: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    },
    cards: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['japanese', 'sourceWordStartIndex', 'sourceWordEndIndex'],
        properties: {
          japanese: { type: 'string' },
          sourceWordStartIndex: { type: ['integer', 'null'] },
          sourceWordEndIndex: { type: ['integer', 'null'] },
        },
      },
    },
  },
};

const diaryEntrySelect =
  'id, user_id, source, original_text, plain_text, is_transcript_edited, bullet_points, transcript_words, waveform_peaks, content_hash, created_at, updated_at';
const practiceGenerationSelect =
  'id, user_id, diary_entry_id, client_request_id, card_split_policy, translation_style, status, error_message, created_at, updated_at';
const translationCardSelect =
  'id, practice_generation_id, sort_order, japanese, english, source_word_start_index, source_word_end_index, audio_start_sec, audio_end_sec, learning_status, last_reviewed_at, next_review_at, review_count, success_count, created_at';

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return optionsResponse();
    }

    if (req.method !== 'POST') {
      return errorResponse('POSTだけ対応しています。', 405);
    }

    const { context, userId, response } = await getAuthenticatedContext(req);

    if (response) {
      return response;
    }

    const parsedRequest = parsePreparePracticeDraftRequest(await req.json().catch(() => null));

    if (parsedRequest.type === 'error') {
      return errorResponse(parsedRequest.message);
    }

    const request = parsedRequest.value;
    const supabase = context.supabase as any;
    const existingGeneration = await fetchPracticeGenerationByClientRequestId(
      { supabase },
      userId,
      request.clientRequestId
    );

    if (existingGeneration.type === 'error') {
      return errorResponse(existingGeneration.message, 500);
    }

    if (existingGeneration.type === 'generation') {
      return await returnPracticeGenerationBundle({ supabase }, existingGeneration.generation);
    }

    let output: PreparePracticeDraftOutput;

    try {
      output = await createOpenAIJsonResponse<PreparePracticeDraftOutput>({
        schemaName: DraftSchemaVersion,
        schema: draftSchema,
        instructions: createDraftInstructions(request.cardSplitPolicy, request.transcriptWords.length > 0),
        input: createDraftInput(request.cleanedText, request.transcriptWords),
        maxOutputTokens: 12000,
      });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '分割下書きの作成に失敗しました。',
        502
      );
    }

    const bulletPoints = normalizeBulletPoints(output.bulletPoints, request.cleanedText);
    const cardDrafts = output.cards
      .map((card, index) => ({
        sort_order: index + 1,
        japanese: card.japanese.trim(),
        ...createCardTimestampFields(card, request.transcriptWords),
      }))
      .filter((card) => card.japanese);

    if (cardDrafts.length === 0) {
      return errorResponse('英語カードにできる内容が見つかりませんでした。', 502);
    }

    const contentHash = await createContentHash(request.cleanedText);
    const { data: generationId, error: saveError } = await supabase.rpc('save_practice_draft', {
      p_bullet_points: bulletPoints,
      p_card_split_policy: request.cardSplitPolicy,
      p_cards: cardDrafts,
      p_client_request_id: request.clientRequestId,
      p_content_hash: contentHash,
      p_draft_model: getOpenAITextModel(),
      p_draft_prompt_version: DraftPromptVersion,
      p_draft_schema_version: DraftSchemaVersion,
      p_is_transcript_edited: request.isTranscriptEdited,
      p_original_text: request.rawTranscriptText,
      p_plain_text: request.cleanedText,
      p_source: request.source,
      p_transcript_words: request.transcriptWords,
      p_waveform_peaks: request.waveformPeaks,
    });

    if (saveError || typeof generationId !== 'string') {
      return errorResponse(saveError?.message ?? '分割下書きを保存できませんでした。', 500);
    }

    const savedGeneration = await fetchPracticeGenerationById({ supabase }, userId, generationId);

    if (savedGeneration.type === 'error') {
      return errorResponse(savedGeneration.message, 500);
    }

    if (savedGeneration.type !== 'generation') {
      return errorResponse('分割下書きを確認できませんでした。', 500);
    }

    return await returnPracticeGenerationBundle({ supabase }, savedGeneration.generation);
  },
};

async function fetchPracticeGenerationByClientRequestId(
  context: { supabase: any },
  userId: string,
  clientRequestId: string
) {
  const { data, error } = await context.supabase
    .from('practice_generations')
    .select(practiceGenerationSelect)
    .eq('user_id', userId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle();

  if (error) {
    return { type: 'error' as const, message: error.message };
  }

  return data
    ? { type: 'generation' as const, generation: data as PracticeGenerationRow }
    : { type: 'missing' as const };
}

async function fetchPracticeGenerationById(
  context: { supabase: any },
  userId: string,
  generationId: string
) {
  const { data, error } = await context.supabase
    .from('practice_generations')
    .select(practiceGenerationSelect)
    .eq('user_id', userId)
    .eq('id', generationId)
    .maybeSingle();

  if (error) {
    return { type: 'error' as const, message: error.message };
  }

  return data
    ? { type: 'generation' as const, generation: data as PracticeGenerationRow }
    : { type: 'missing' as const };
}

async function returnPracticeGenerationBundle(
  context: { supabase: any },
  practiceGeneration: PracticeGenerationRow
) {
  const { data: diaryEntry, error: diaryError } = await context.supabase
    .from('diary_entries')
    .select(diaryEntrySelect)
    .eq('id', practiceGeneration.diary_entry_id)
    .single();

  if (diaryError || !diaryEntry) {
    return errorResponse(diaryError?.message ?? '日記を確認できませんでした。', 500);
  }

  const { data: cards, error: cardsError } = await context.supabase
    .from('translation_cards')
    .select(translationCardSelect)
    .eq('practice_generation_id', practiceGeneration.id)
    .order('sort_order', { ascending: true });

  if (cardsError || !cards?.length) {
    return errorResponse(cardsError?.message ?? '分割カードを確認できませんでした。', 500);
  }

  return jsonResponse({
    diaryEntry: toPublicDiaryEntry(diaryEntry as DiaryEntryRow),
    practiceGeneration: toPublicPracticeGeneration(practiceGeneration),
    cards: cards as TranslationCardRow[],
  });
}

async function createContentHash(value: string) {
  const bytes = new TextEncoder().encode(normalizeContentForHash(value));
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeContentForHash(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function createDraftInput(plainText: string, transcriptWords: TranscriptWord[]) {
  if (transcriptWords.length === 0) {
    return JSON.stringify({
      plainText,
      transcriptWords: [],
    });
  }

  return JSON.stringify({
    plainText,
    transcriptWords: transcriptWords.map((word) => ({
      index: word.index,
      word: word.word,
      start: word.start,
      end: word.end,
    })),
  });
}

function createCardTimestampFields(card: DraftCard, transcriptWords: TranscriptWord[]) {
  const startIndex = card.sourceWordStartIndex;
  const endIndex = card.sourceWordEndIndex;

  if (
    typeof startIndex !== 'number' ||
    typeof endIndex !== 'number' ||
    startIndex < 0 ||
    endIndex < startIndex ||
    endIndex >= transcriptWords.length
  ) {
    return {
      source_word_start_index: null,
      source_word_end_index: null,
      audio_start_sec: null,
      audio_end_sec: null,
    };
  }

  const startWord = transcriptWords[startIndex];
  const endWord = transcriptWords[endIndex];

  if (
    typeof startWord?.start !== 'number' ||
    typeof endWord?.end !== 'number' ||
    endWord.end < startWord.start
  ) {
    return {
      source_word_start_index: null,
      source_word_end_index: null,
      audio_start_sec: null,
      audio_end_sec: null,
    };
  }

  return {
    source_word_start_index: startIndex,
    source_word_end_index: endIndex,
    audio_start_sec: startWord.start,
    audio_end_sec: endWord.end,
  };
}

function createDraftInstructions(cardSplitPolicy: CardSplitPolicy, hasTranscriptWords: boolean) {
  const commonInstructions = [
    'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
    '入力は JSON です。plainText は日本語の文字起こし、またはユーザーが書いた日本語の日記本文です。',
    'transcriptWords は音声文字起こしの word timestamp 配列です。各要素は index, word, start, end を持ちます。',
    'あなたの仕事は、後で読み返せる日本語の要旨メモと、英語カード化するための日本語カード案を作ることです。',
    'bulletPoints は要約メモ、cards は英訳前のカード下書きです。両者の方針を混同しないでください。',
    'どちらでも、事実、理由、感情を新しく足さないでください。',
  ];

  const bulletPointInstructions = [
    'bulletPoints は日記タブの「箇条書き」表示にそのまま出す、日本語の要旨メモ配列です。',
    'bulletPoints はカード分割ではありません。原文の文ごとに1項目へ分けないでください。',
    'bulletPoints の個数は、独立した要点の数だけにしてください。近い内容、言い直し、同じ話題の補足は1つに統合してください。',
    'bulletPoints は空文字、見出し、番号、先頭の記号を含めないでください。',
    'bulletPoints は原文をそのまま抜き出さず、出来事、迷い、判断、結果、感情の芯だけを本人があとで見返す短い日記メモに圧縮してください。',
    'bulletPoints は長く説明せず、メモとして自然な短い言い切りにしてください。',
    'bulletPoints でも新しい解釈、アドバイス、事実、理由、感情を足さないでください。',
    'bulletPoints では、同じ気持ちや状況を繰り返している部分、意味の薄い補足、口癖、言い直しは削ってください。',
    'bulletPoints では、元の出来事、感情、温度感、主観の芯は保ってください。',
    'bulletPoints では、必要な意味まで削りすぎないでください。',
    '長い入力でも、bulletPoints だけは主な出来事と感情が伝わる程度に自然に圧縮してください。目安は入力の半分から7割程度です。',
    '短い入力でも、bulletPoints は必要最小限にしてください。原文の各文をそのまま並べないでください。',
  ];

  const cardInstructions = [
    'カード案は日本語だけを返してください。英語はまだ返さないでください。',
    'cards は要約メモではありません。英訳練習に使う下書きなので、plainText の意味内容をできるだけ網羅してください。',
    'cards[].japanese では、原文の主張、対象、評価、強い言葉、否定、怒り、嫌悪感、乱暴さ、文化や価値観に関する言い方を省略しないでください。',
    '差別的、攻撃的、露骨、乱暴、断定的、価値判断を含む表現でも、それがユーザーの発言内容ならカード化してください。',
    '安全化、検閲、伏せ字、婉曲化、道徳的な修正、一般化、「省略」などの置き換えをしないでください。',
    '削ってよいのは、意味を持たないフィラー、完全な重複、明らかな言い直し、英訳練習に不要な間つなぎだけです。',
    '長い入力でも、cards では入力全体を半分から7割に圧縮しようとしないでください。必要ならカード数を増やして意味を残してください。',
    'ただし分割判断は、日本語としての句点や話し言葉の切れ目ではなく、英語にした後の自然な一文を逆算して決めてください。',
    '各 cards[].japanese は、後で1つの自然な英語文に対応する意味の塊だけを入れてください。',
    '各カードには sourceWordStartIndex と sourceWordEndIndex も必ず返してください。',
    hasTranscriptWords
      ? 'sourceWordStartIndex/sourceWordEndIndex は、その cards[].japanese の意味に対応する transcriptWords の inclusive な index 範囲です。対応が不確実な場合だけ null にしてください。'
      : 'transcriptWords が空の場合、sourceWordStartIndex/sourceWordEndIndex は必ず null にしてください。',
    '文の途中で不自然に切らず、英語カード化したときに主語、述語、意味が自然に成立する単位にしてください。',
    'カード数に上限はありません。無理に増やさず、自然に分けられる分だけ返してください。',
  ];

  const policyInstructions =
    cardSplitPolicy === 'small_steps'
      ? [
          '現在のカード分割方針は「細かく分ける」です。',
          'フラッシュカードとして覚えやすい短さを優先し、1カード1アイデアを基本にしてください。',
          'and, but, so などの接続詞で自然に分けられる英語文は、一文に詰め込まずカードを分けてください。',
          'because, while, although, if などで長い複文になる場合も、意味が自然に独立するなら分割してください。',
          '分割後の各カードは、文の断片ではなく、それぞれ単独で自然な英語文にできる日本語にしてください。',
          '英語化後の目安は1カード12〜16語程度です。ただし自然さや意味の欠落防止が必要なら少し超えて構いません。',
        ]
      : [
          '現在のカード分割方針は「自然なまとまり」です。',
          '英語にしたときの意味の流れを優先し、自然なまとまりを保ってください。',
          '1枚が少し長くなっても、話の流れや感情のつながりが崩れるなら無理に分割しないでください。',
          'and, but, so などでつながる一文が自然なら、無理に分割しないでください。',
        ];

  return [
    ...commonInstructions,
    ...bulletPointInstructions,
    ...cardInstructions,
    ...policyInstructions,
  ].join('\n');
}

function normalizeBulletPoints(value: string[], fallbackText: string) {
  const bulletPoints = value
    .map((point) => point.replace(/^[\s・\-*、。]+/g, '').trim())
    .filter((point) => point.length > 0);

  if (bulletPoints.length > 0) {
    return bulletPoints;
  }

  return [fallbackText.replace(/\s+/g, ' ').trim() || '本文はありません。'];
}

function toPublicDiaryEntry(diaryEntry: DiaryEntryRow) {
  return {
    id: diaryEntry.id,
    source: diaryEntry.source,
    original_text: diaryEntry.original_text,
    plain_text: diaryEntry.plain_text,
    is_transcript_edited: diaryEntry.is_transcript_edited,
    bullet_points: diaryEntry.bullet_points,
    transcript_words: diaryEntry.transcript_words,
    waveform_peaks: diaryEntry.waveform_peaks,
    created_at: diaryEntry.created_at,
  };
}

function toPublicPracticeGeneration(practiceGeneration: PracticeGenerationRow) {
  return {
    card_split_policy: practiceGeneration.card_split_policy,
    id: practiceGeneration.id,
    diary_entry_id: practiceGeneration.diary_entry_id,
    status: practiceGeneration.status,
    translation_style: practiceGeneration.translation_style,
    created_at: practiceGeneration.created_at,
  };
}
