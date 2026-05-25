import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type GenerationMode = 'natural' | 'compact';

type DraftCard = {
  japanese: string;
};

type PreparePracticeDraftOutput = {
  polishedText: string;
  bulletPoints: string[];
  cards: DraftCard[];
};

type DiaryEntryRow = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
  polished_text: string;
  bullet_points: unknown;
  content_hash: string;
  created_at: string;
  updated_at: string;
};

type PracticeGenerationRow = {
  id: string;
  user_id: string;
  diary_entry_id: string;
  generation_mode: GenerationMode;
  practice_generation_status: 'draft' | 'translating' | 'completed' | 'failed';
  practice_generation_error: string | null;
  created_at: string;
  updated_at: string;
};

const draftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['polishedText', 'bulletPoints', 'cards'],
  properties: {
    polishedText: { type: 'string' },
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
        required: ['japanese'],
        properties: {
          japanese: { type: 'string' },
        },
      },
    },
  },
};

const diaryEntrySelect =
  'id, user_id, source, original_text, plain_text, polished_text, bullet_points, content_hash, created_at, updated_at';
const practiceGenerationSelect =
  'id, user_id, diary_entry_id, generation_mode, practice_generation_status, practice_generation_error, created_at, updated_at';
const translationCardSelect = 'id, practice_generation_id, sort_order, japanese, english, created_at';

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

    const body = await req.json().catch(() => null);
    const plainText =
      typeof body?.cleanedText === 'string' && body.cleanedText.trim()
        ? body.cleanedText.trim()
        : typeof body?.diaryText === 'string'
          ? body.diaryText.trim()
          : '';
    const originalText =
      typeof body?.rawTranscriptText === 'string' && body.rawTranscriptText.trim()
        ? body.rawTranscriptText.trim()
        : typeof body?.transcriptText === 'string' && body.transcriptText.trim()
          ? body.transcriptText.trim()
          : plainText;

    if (!plainText) {
      return errorResponse('日記本文が必要です。');
    }

    const source = body?.source === 'text' ? 'text' : 'voice';
    const generationMode = parseGenerationMode(body?.generationMode);

    let output: PreparePracticeDraftOutput;

    try {
      output = await createOpenAIJsonResponse<PreparePracticeDraftOutput>({
        schemaName: 'daily_to_english_practice_draft',
        schema: draftSchema,
        instructions: createDraftInstructions(generationMode),
        input: plainText,
        maxOutputTokens: 4200,
      });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '分割下書きの作成に失敗しました。',
        502
      );
    }

    const polishedText = normalizeDiaryText(output.polishedText, plainText);
    const bulletPoints = normalizeBulletPoints(output.bulletPoints, polishedText);
    const cardDrafts = output.cards
      .map((card, index) => ({
        sort_order: index + 1,
        japanese: card.japanese.trim(),
      }))
      .filter((card) => card.japanese);

    if (cardDrafts.length === 0) {
      return errorResponse('分割カードを作成できませんでした。', 502);
    }

    const supabase = context.supabase as any;
    const discardResult = await discardExistingDrafts({ supabase }, userId);

    if (discardResult.type === 'error') {
      return errorResponse(discardResult.message, 500);
    }

    const contentHash = await createContentHash(plainText);
    const { data: diaryEntry, error: diaryError } = await supabase
      .from('diary_entries')
      .insert({
        user_id: userId,
        source,
        original_text: originalText,
        plain_text: plainText,
        polished_text: polishedText,
        bullet_points: bulletPoints,
        content_hash: contentHash,
      })
      .select(diaryEntrySelect)
      .single();

    if (diaryError || !diaryEntry) {
      return errorResponse(diaryError?.message ?? '日記下書きを保存できませんでした。', 500);
    }

    const { data: practiceGeneration, error: generationError } = await supabase
      .from('practice_generations')
      .insert({
        user_id: userId,
        diary_entry_id: diaryEntry.id,
        generation_mode: generationMode,
        practice_generation_status: 'draft',
        practice_generation_error: null,
      })
      .select(practiceGenerationSelect)
      .single();

    if (generationError || !practiceGeneration) {
      await deleteDiaryEntry({ supabase }, diaryEntry.id);
      return errorResponse(generationError?.message ?? '分割下書きを保存できませんでした。', 500);
    }

    const cardRows = cardDrafts.map((card) => ({
      user_id: userId,
      practice_generation_id: practiceGeneration.id,
      sort_order: card.sort_order,
      japanese: card.japanese,
      english: null,
    }));
    const { data: cards, error: cardsError } = await supabase
      .from('translation_cards')
      .insert(cardRows)
      .select(translationCardSelect)
      .order('sort_order', { ascending: true });

    if (cardsError || !cards?.length) {
      await deleteDiaryEntry({ supabase }, diaryEntry.id);
      return errorResponse(cardsError?.message ?? '分割カードを保存できませんでした。', 500);
    }

    return jsonResponse({
      diaryEntry: toPublicDiaryEntry(diaryEntry as DiaryEntryRow),
      practiceGeneration: toPublicPracticeGeneration(practiceGeneration as PracticeGenerationRow),
      cards,
    });
  },
};

async function discardExistingDrafts(context: { supabase: any }, userId: string) {
  const { data, error } = await context.supabase
    .from('practice_generations')
    .select('diary_entry_id')
    .eq('user_id', userId)
    .eq('practice_generation_status', 'draft');

  if (error) {
    return { type: 'error' as const, message: error.message };
  }

  const diaryEntryIds = Array.from(
    new Set(
      (data ?? [])
        .map((row: { diary_entry_id?: unknown }) => row.diary_entry_id)
        .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
    )
  );

  if (diaryEntryIds.length === 0) {
    return { type: 'ok' as const };
  }

  const { error: deleteError } = await context.supabase
    .from('diary_entries')
    .delete()
    .in('id', diaryEntryIds);

  if (deleteError) {
    return { type: 'error' as const, message: deleteError.message };
  }

  return { type: 'ok' as const };
}

async function deleteDiaryEntry(context: { supabase: any }, diaryEntryId: string) {
  await context.supabase.from('diary_entries').delete().eq('id', diaryEntryId);
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

function parseGenerationMode(value: unknown): GenerationMode {
  return value === 'natural' ? 'natural' : 'compact';
}

function createDraftInstructions(generationMode: GenerationMode) {
  const commonInstructions = [
    'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
    '入力は日本語の文字起こし、またはユーザーが書いた日本語の日記本文です。',
    'あなたの仕事は、日記として読み返せる polishedText と、後で英語カード化するための日本語カード案を作ることです。',
    'polishedText は日記タブの「読みやすく」表示にそのまま出す日本語本文です。',
    'polishedText にタイトル、見出し、箇条書き、要約、説明文を入れないでください。',
    'polishedText は入力をそのまま長く整えるのではなく、適度に簡潔な日記文にしてください。',
    'bulletPoints は日記タブの「箇条書き」表示にそのまま出す短い日本語メモ配列です。',
    'bulletPoints は最低1個、上限なしです。内容に応じて必要な数だけ返してください。',
    'bulletPoints は空文字、見出し、番号、先頭の記号を含めないでください。',
    'bulletPoints は出来事、感情、気づき、次に覚えておきたいことを、本人があとで見返す短い日記メモとして書いてください。',
    'bulletPoints でも新しい解釈、アドバイス、事実、理由、感情を足さないでください。',
    '同じ気持ちや状況を繰り返している部分、意味の薄い補足、口癖、言い直しは削ってください。',
    '元の出来事、感情、温度感、主観の芯は保ってください。',
    '事実、理由、感情を新しく足さないでください。必要な意味まで削りすぎないでください。',
    '長い入力は、主な出来事と感情が伝わる程度に自然に圧縮してください。目安は入力の半分から7割程度です。',
    '短い入力は無理に短くしなくて構いません。',
    'カード案は日本語だけを返してください。英語はまだ返さないでください。',
    'ただし分割判断は、日本語としての句点や話し言葉の切れ目ではなく、英語にした後の自然な一文を逆算して決めてください。',
    '各 cards[].japanese は、後で1つの自然な英語文に対応する意味の塊だけを入れてください。',
    '文の途中で不自然に切らず、英語カード化したときに主語、述語、意味が自然に成立する単位にしてください。',
    'カード数に上限はありません。無理に増やさず、自然に分けられる分だけ返してください。',
  ];

  const modeInstructions =
    generationMode === 'compact'
      ? [
          '現在の生成モードは「短さ優先」です。',
          'フラッシュカードとして覚えやすい短さを優先し、1カード1アイデアを基本にしてください。',
          'and, but, so などの接続詞で自然に分けられる英語文は、一文に詰め込まずカードを分けてください。',
          'because, while, although, if などで長い複文になる場合も、意味が自然に独立するなら分割してください。',
          '分割後の各カードは、文の断片ではなく、それぞれ単独で自然な英語文にできる日本語にしてください。',
          '英語化後の目安は1カード12〜16語程度です。ただし自然さや意味の欠落防止が必要なら少し超えて構いません。',
        ]
      : [
          '現在の生成モードは「自然さ優先」です。',
          '自然な話し言葉としての英語を優先してください。',
          '1枚が少し長くなっても、意味の流れとネイティブらしさを崩さないでください。',
          'and, but, so などでつながる一文が自然なら、無理に分割しないでください。',
        ];

  return [...commonInstructions, ...modeInstructions].join('\n');
}

function normalizeDiaryText(value: string, fallbackText: string) {
  const normalizedText = value.replace(/\n{3,}/g, '\n\n').trim();

  if (normalizedText) {
    return normalizedText;
  }

  return fallbackText.replace(/\n{3,}/g, '\n\n').trim();
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
    polished_text: diaryEntry.polished_text,
    bullet_points: diaryEntry.bullet_points,
    created_at: diaryEntry.created_at,
  };
}

function toPublicPracticeGeneration(practiceGeneration: PracticeGenerationRow) {
  return {
    id: practiceGeneration.id,
    diary_entry_id: practiceGeneration.diary_entry_id,
    generation_mode: practiceGeneration.generation_mode,
    practice_generation_status: practiceGeneration.practice_generation_status,
    created_at: practiceGeneration.created_at,
  };
}
