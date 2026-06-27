import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse, getOpenAITextModel } from '../_shared/openai.ts';
import {
  TranslationPromptVersion,
  TranslationSchemaVersion,
  parseCompletePracticeRequest,
  type CardSplitPolicy,
  type PracticeGenerationStatus,
  type TranslationStyle,
} from '../_shared/practice-contract.ts';

type TranslationOutputCard = {
  id: string;
  english: string;
};

type CompletePracticeOutput = {
  cards: TranslationOutputCard[];
};

type DiaryEntryRow = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
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

const translationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'english'],
        properties: {
          id: { type: 'string' },
          english: { type: 'string' },
        },
      },
    },
  },
};

const diaryEntrySelect =
  'id, user_id, source, original_text, plain_text, bullet_points, transcript_words, waveform_peaks, content_hash, created_at, updated_at';
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

    const parsedRequest = parseCompletePracticeRequest(await req.json().catch(() => null));

    if (parsedRequest.type === 'error') {
      return errorResponse(parsedRequest.message);
    }

    const request = parsedRequest.value;
    const supabase = context.supabase as any;
    const generationResult = await fetchPracticeGeneration({ supabase }, userId, request.practiceGenerationId);

    if (generationResult.type === 'error') {
      return errorResponse(generationResult.message, 500);
    }

    if (generationResult.type !== 'generation') {
      return errorResponse('分割下書きを確認できませんでした。', 404);
    }

    if (generationResult.generation.status === 'completed') {
      return await returnCompletedPractice({ supabase }, generationResult.generation);
    }

    if (generationResult.generation.status === 'discarded') {
      return errorResponse('この下書きは破棄されています。', 409);
    }

    const { data: claimed, error: claimError } = await supabase.rpc('claim_practice_generation', {
      p_generation_id: request.practiceGenerationId,
      p_translation_model: getOpenAITextModel(),
      p_translation_prompt_version: TranslationPromptVersion,
      p_translation_schema_version: TranslationSchemaVersion,
      p_translation_style: request.translationStyle,
    });

    if (claimError) {
      return errorResponse(claimError.message, 500);
    }

    if (!claimed) {
      const currentGeneration = await fetchPracticeGeneration(
        { supabase },
        userId,
        request.practiceGenerationId
      );

      if (currentGeneration.type === 'generation' && currentGeneration.generation.status === 'completed') {
        return await returnCompletedPractice({ supabase }, currentGeneration.generation);
      }

      return errorResponse('この下書きは英訳できる状態ではありません。', 409);
    }

    const cardsResult = await fetchPracticeGenerationCards({ supabase }, request.practiceGenerationId);

    if (cardsResult.type === 'error') {
      await markGenerationFailed({ supabase }, request.practiceGenerationId, cardsResult.message);
      return errorResponse(cardsResult.message, 500);
    }

    const cards = cardsResult.cards;

    if (cards.length === 0) {
      await markGenerationFailed({ supabase }, request.practiceGenerationId, '英訳するカードが必要です。');
      return errorResponse('英訳するカードが必要です。', 400);
    }

    let output: CompletePracticeOutput;

    try {
      output = await createOpenAIJsonResponse<CompletePracticeOutput>({
        schemaName: TranslationSchemaVersion,
        schema: translationSchema,
        instructions: createTranslationInstructions(request.translationStyle),
        input: JSON.stringify({
          cards: cards.map((card) => ({
            id: card.id,
            japanese: card.japanese,
          })),
        }),
        maxOutputTokens: 12000,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '英語カードの生成に失敗しました。';
      await markGenerationFailed({ supabase }, request.practiceGenerationId, message);
      return errorResponse(message, 502);
    }

    const translations = validateTranslations(cards, output.cards);

    if (translations.type === 'error') {
      await markGenerationFailed({ supabase }, request.practiceGenerationId, translations.message);
      return errorResponse(translations.message, 502);
    }

    const { error: completeError } = await supabase.rpc('complete_practice_generation', {
      p_generation_id: request.practiceGenerationId,
      p_translations: translations.cards,
    });

    if (completeError) {
      await markGenerationFailed({ supabase }, request.practiceGenerationId, completeError.message);
      return errorResponse(completeError.message, 500);
    }

    const completedGeneration = await fetchPracticeGeneration({ supabase }, userId, request.practiceGenerationId);

    if (completedGeneration.type === 'error') {
      return errorResponse(completedGeneration.message, 500);
    }

    if (completedGeneration.type !== 'generation') {
      return errorResponse('英語カードを完了状態にできませんでした。', 500);
    }

    return await returnCompletedPractice({ supabase }, completedGeneration.generation);
  },
};

async function fetchPracticeGeneration(
  context: { supabase: any },
  userId: string,
  practiceGenerationId: string
) {
  const { data, error } = await context.supabase
    .from('practice_generations')
    .select(practiceGenerationSelect)
    .eq('id', practiceGenerationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { type: 'error' as const, message: error.message };
  }

  return data
    ? { type: 'generation' as const, generation: data as PracticeGenerationRow }
    : { type: 'missing' as const };
}

async function fetchPracticeGenerationCards(
  context: { supabase: any },
  practiceGenerationId: string
) {
  const { data, error } = await context.supabase
    .from('translation_cards')
    .select(translationCardSelect)
    .eq('practice_generation_id', practiceGenerationId)
    .order('sort_order', { ascending: true });

  if (error) {
    return { type: 'error' as const, message: error.message };
  }

  return { type: 'cards' as const, cards: (data ?? []) as TranslationCardRow[] };
}

function validateTranslations(
  sourceCards: { id: string }[],
  outputCards: TranslationOutputCard[]
) {
  const sourceIds = new Set(sourceCards.map((card) => card.id));
  const byId = new Map<string, string>();

  for (const card of outputCards) {
    const id = card.id.trim();
    const english = card.english.trim();

    if (!sourceIds.has(id) || !english) {
      return { type: 'error' as const, message: '英語カードの生成結果が壊れていました。' };
    }

    byId.set(id, english);
  }

  if (byId.size !== sourceCards.length) {
    return { type: 'error' as const, message: '英語カードの生成結果が不足しています。' };
  }

  return {
    type: 'translations' as const,
    cards: sourceCards.map((card) => ({
      id: card.id,
      english: byId.get(card.id) ?? '',
    })),
  };
}

async function returnCompletedPractice(
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

  const cards = await fetchPracticeGenerationCards(context, practiceGeneration.id);

  if (cards.type === 'error') {
    return errorResponse(cards.message, 500);
  }

  const completedCards = cards.cards.filter(
    (card) => typeof card.english === 'string' && card.english.trim().length > 0
  );

  if (completedCards.length === 0 || completedCards.length !== cards.cards.length) {
    return errorResponse('英語カードを確認できませんでした。', 500);
  }

  return jsonResponse({
    diaryEntry: toPublicDiaryEntry(diaryEntry as DiaryEntryRow),
    practiceGeneration: toPublicPracticeGeneration(practiceGeneration),
    cards: completedCards,
  });
}

async function markGenerationFailed(
  context: { supabase: any },
  practiceGenerationId: string,
  message: string
) {
  await context.supabase.rpc('fail_practice_generation', {
    p_error_message: message,
    p_generation_id: practiceGenerationId,
  });
}

function createTranslationInstructions(translationStyle: TranslationStyle) {
  const commonInstructions = [
    'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
    '入力は、すでに英語カード用に分割済みの日本語カード配列です。',
    'カードを結合、分割、削除、並べ替えしないでください。',
    '必ず入力と同じidを、同じカード境界のまま返してください。',
    'english は直訳や教材っぽい説明文にせず、日常会話で自然に言える一文にしてください。',
    'japanese の意味、出来事、感情、温度感を保ってください。事実や理由を新しく足さないでください。',
    '差別的、攻撃的、露骨、乱暴、断定的、価値判断を含む表現でも、それが japanese の意味なら検閲、省略、伏せ字、婉曲化、道徳的な修正をしないでください。',
    '文の断片ではなく、それぞれ単独で自然に言える英語文にしてください。',
  ];

  const styleInstructions =
    translationStyle === 'simple'
      ? [
          '現在の英訳スタイルは「簡単さ優先」です。',
          '自然さは保ちつつ、基本語彙、短い文、単純な文構造を優先してください。',
          '難しいイディオム、句動詞、熟語、凝った言い換えは避け、学習者がそのまま覚えやすい表現にしてください。',
          '目安は1文12〜16語程度です。ただし意味の欠落防止が必要なら少し超えて構いません。',
        ]
      : [
          '現在の英訳スタイルは「自然さ優先」です。',
          'ネイティブが日常会話で自然によく使う語彙、句動詞、熟語、イディオム、自然な言い回しを適切に使ってください。',
          '直訳っぽさや教材っぽさを避け、少し長くなっても意味の流れとネイティブらしさを優先してください。',
        ];

  return [...commonInstructions, ...styleInstructions].join('\n');
}

function toPublicDiaryEntry(diaryEntry: DiaryEntryRow) {
  return {
    id: diaryEntry.id,
    source: diaryEntry.source,
    original_text: diaryEntry.original_text,
    plain_text: diaryEntry.plain_text,
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
