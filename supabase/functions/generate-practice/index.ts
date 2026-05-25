import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type TranslationCard = {
  japanese: string;
  english: string;
};

type GenerationMode = 'natural' | 'compact';
type PracticeGenerationStatus = 'draft' | 'translating' | 'completed' | 'failed';

type GeneratePracticeOutput = {
  polishedText: string;
  bulletPoints: string[];
  cards: TranslationCard[];
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
  practice_generation_status: PracticeGenerationStatus;
  practice_generation_error: string | null;
  created_at: string;
  updated_at: string;
};

type GenerationClaim =
  | {
      type: 'claimed';
      diaryEntry: DiaryEntryRow;
      practiceGeneration: PracticeGenerationRow;
    }
  | {
      type: 'completed';
      diaryEntry: DiaryEntryRow;
      practiceGeneration: PracticeGenerationRow;
      cards: unknown[];
    }
  | { type: 'busy' }
  | { type: 'error'; status: number; message: string };

const translationCardSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['polishedText', 'bulletPoints', 'cards'],
  properties: {
    polishedText: {
      type: 'string',
    },
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
        required: ['japanese', 'english'],
        properties: {
          japanese: { type: 'string' },
          english: { type: 'string' },
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
const existingGenerationWaitAttempts = 20;
const existingGenerationWaitMs = 600;
const processingRetryTimeoutMs = 5 * 60 * 1000;

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

    const generationContext = { supabase: context.supabase as any };
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
    const contentHash = await createContentHash(plainText);
    const generationClaim = await claimGeneration(generationContext, {
      userId,
      source,
      generationMode,
      originalText,
      plainText,
      contentHash,
    });

    if (generationClaim.type === 'completed') {
      return jsonResponse({
        diaryEntry: toPublicDiaryEntry(generationClaim.diaryEntry),
        practiceGeneration: toPublicPracticeGeneration(generationClaim.practiceGeneration),
        cards: generationClaim.cards,
        reused: true,
      });
    }

    if (generationClaim.type === 'busy') {
      return errorResponse(
        'この内容の英語カードは作成中です。少し待ってからもう一度確認してください。',
        409
      );
    }

    if (generationClaim.type === 'error') {
      return errorResponse(generationClaim.message, generationClaim.status);
    }

    const claimedDiaryEntry = generationClaim.diaryEntry;
    const claimedPracticeGeneration = generationClaim.practiceGeneration;

    let output: GeneratePracticeOutput;

    try {
      output = await createOpenAIJsonResponse<GeneratePracticeOutput>({
        schemaName: 'daily_to_english_translation_cards',
        schema: translationCardSchema,
        instructions: createPracticeInstructions(generationMode),
        input: plainText,
        maxOutputTokens: 6000,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '英語カードの生成に失敗しました。';
      await markGenerationFailed(
        generationContext,
        claimedPracticeGeneration.id,
        message
      );
      return errorResponse(message, 502);
    }

    const polishedText = normalizeDiaryText(output.polishedText, plainText);
    const bulletPoints = normalizeBulletPoints(output.bulletPoints, polishedText);

    const cardDrafts = output.cards
      .map((card, index) => ({
        sort_order: index + 1,
        japanese: card.japanese.trim(),
        english: card.english.trim(),
      }))
      .filter((card) => card.japanese && card.english);

    if (cardDrafts.length === 0) {
      await markGenerationFailed(
        generationContext,
        claimedPracticeGeneration.id,
        '英語カードを作成できませんでした。'
      );
      return errorResponse('英語カードを作成できませんでした。', 502);
    }

    const { data: diaryEntry, error: diaryError } = await generationContext.supabase
      .from('diary_entries')
      .update({
        source,
        original_text: originalText,
        plain_text: plainText,
        polished_text: polishedText,
        bullet_points: bulletPoints,
      })
      .eq('id', claimedDiaryEntry.id)
      .select(diaryEntrySelect)
      .single();

    if (diaryError) {
      await markGenerationFailed(generationContext, claimedPracticeGeneration.id, diaryError.message);
      return errorResponse(diaryError.message, 500);
    }

    const cardRows = cardDrafts.map((card) => ({
      user_id: userId,
      practice_generation_id: claimedPracticeGeneration.id,
      sort_order: card.sort_order,
      japanese: card.japanese,
      english: card.english,
    }));

    const { data: cards, error: cardsError } = await generationContext.supabase
      .from('translation_cards')
      .insert(cardRows)
      .select(translationCardSelect)
      .order('sort_order', { ascending: true });

    if (cardsError) {
      await markGenerationFailed(generationContext, claimedPracticeGeneration.id, cardsError.message);
      return errorResponse(cardsError.message, 500);
    }

    if (!cards?.length) {
      await markGenerationFailed(
        generationContext,
        claimedPracticeGeneration.id,
        '英語カードを保存できませんでした。'
      );
      return errorResponse('英語カードを保存できませんでした。', 500);
    }

    const { data: completedPracticeGeneration, error: completeError } =
      await generationContext.supabase
        .from('practice_generations')
        .update({
          practice_generation_status: 'completed',
          practice_generation_error: null,
        })
        .eq('id', claimedPracticeGeneration.id)
        .select(practiceGenerationSelect)
        .single();

    if (completeError) {
      await markGenerationFailed(generationContext, claimedPracticeGeneration.id, completeError.message);
      return errorResponse(completeError.message, 500);
    }

    return jsonResponse({
      diaryEntry: toPublicDiaryEntry(diaryEntry),
      practiceGeneration: toPublicPracticeGeneration(completedPracticeGeneration),
      cards,
      reused: false,
    });
  },
};

async function claimGeneration(
  context: { supabase: any },
  {
    userId,
    source,
    generationMode,
    originalText,
    plainText,
    contentHash,
  }: {
    userId: string;
    source: 'text' | 'voice';
    generationMode: GenerationMode;
    originalText: string;
    plainText: string;
    contentHash: string;
  }
): Promise<GenerationClaim> {
  const diaryEntryClaim = await getOrCreateDiaryEntry(context, {
    userId,
    source,
    originalText,
    plainText,
    contentHash,
  });

  if (diaryEntryClaim.type === 'error') {
    return diaryEntryClaim;
  }

  const diaryEntry = diaryEntryClaim.diaryEntry;
  const practiceGenerationClaim = await claimPracticeGeneration(context, {
    userId,
    diaryEntry,
    generationMode,
  });

  if (practiceGenerationClaim.type === 'claimed') {
    return {
      type: 'claimed',
      diaryEntry,
      practiceGeneration: practiceGenerationClaim.practiceGeneration,
    };
  }

  if (practiceGenerationClaim.type === 'completed') {
    return {
      type: 'completed',
      diaryEntry,
      practiceGeneration: practiceGenerationClaim.practiceGeneration,
      cards: practiceGenerationClaim.cards,
    };
  }

  return practiceGenerationClaim;
}

async function getOrCreateDiaryEntry(
  context: { supabase: any },
  {
    userId,
    source,
    originalText,
    plainText,
    contentHash,
  }: {
    userId: string;
    source: 'text' | 'voice';
    originalText: string;
    plainText: string;
    contentHash: string;
  }
) {
  const { data: diaryEntry, error } = await context.supabase
    .from('diary_entries')
    .insert({
      user_id: userId,
      source,
      original_text: originalText,
      plain_text: plainText,
      polished_text: plainText,
      bullet_points: [createFallbackBulletPoint(plainText)],
      content_hash: contentHash,
    })
    .select(diaryEntrySelect)
    .single();

  if (!error && diaryEntry) {
    return { type: 'created' as const, diaryEntry: diaryEntry as DiaryEntryRow };
  }

  if (!isUniqueConstraintError(error)) {
    return {
      type: 'error' as const,
      status: 500,
      message: error?.message ?? '日記の作成を開始できませんでした。',
    };
  }

  const existingDiaryEntry = await fetchDiaryEntryByHash(context, userId, contentHash);

  if (existingDiaryEntry.type === 'found') {
    return { type: 'existing' as const, diaryEntry: existingDiaryEntry.diaryEntry };
  }

  if (existingDiaryEntry.type === 'error') {
    return existingDiaryEntry;
  }

  return {
    type: 'error' as const,
    status: 409,
    message: 'この日記は作成中です。少し待ってからもう一度確認してください。',
  };
}

async function claimPracticeGeneration(
  context: { supabase: any },
  {
    userId,
    diaryEntry,
    generationMode,
  }: {
    userId: string;
    diaryEntry: DiaryEntryRow;
    generationMode: GenerationMode;
  }
) {
  const { data: practiceGeneration, error } = await context.supabase
    .from('practice_generations')
      .insert({
        user_id: userId,
        diary_entry_id: diaryEntry.id,
        generation_mode: generationMode,
        practice_generation_status: 'translating',
        practice_generation_error: null,
      })
    .select(practiceGenerationSelect)
    .single();

  if (!error && practiceGeneration) {
    return {
      type: 'claimed' as const,
      practiceGeneration: practiceGeneration as PracticeGenerationRow,
    };
  }

  if (!isUniqueConstraintError(error)) {
    return {
      type: 'error' as const,
      status: 500,
      message: error?.message ?? '英語カードの作成を開始できませんでした。',
    };
  }

  const existingPractice = await waitForExistingPractice(context, diaryEntry.id, generationMode);

  if (
    existingPractice.type === 'completed' ||
    existingPractice.type === 'busy' ||
    existingPractice.type === 'error'
  ) {
    return existingPractice;
  }

  if (existingPractice.type === 'failed' || existingPractice.type === 'stale') {
    const retryClaim = await claimExistingPracticeGenerationForRetry(
      context,
      existingPractice.practiceGeneration
    );

    if (retryClaim.type === 'claimed') {
      return retryClaim;
    }

    if (retryClaim.type === 'error') {
      return retryClaim;
    }
  }

  return { type: 'busy' as const };
}

async function waitForExistingPractice(
  context: { supabase: any },
  diaryEntryId: string,
  generationMode: GenerationMode
) {
  for (let attempt = 0; attempt < existingGenerationWaitAttempts; attempt += 1) {
    const existingPracticeGeneration = await fetchPracticeGeneration(
      context,
      diaryEntryId,
      generationMode
    );

    if (existingPracticeGeneration.type === 'error') {
      return existingPracticeGeneration;
    }

    if (existingPracticeGeneration.type === 'notFound') {
      return { type: 'busy' as const };
    }

    if (existingPracticeGeneration.practiceGeneration.practice_generation_status === 'completed') {
      const cards = await fetchPracticeGenerationCards(
        context,
        existingPracticeGeneration.practiceGeneration.id
      );

      if (cards.type === 'error') {
        return cards;
      }

      if (cards.cards.length > 0) {
        return {
          type: 'completed' as const,
          practiceGeneration: existingPracticeGeneration.practiceGeneration,
          cards: cards.cards,
        };
      }
    }

    if (existingPracticeGeneration.practiceGeneration.practice_generation_status === 'failed') {
      return {
        type: 'failed' as const,
        practiceGeneration: existingPracticeGeneration.practiceGeneration,
      };
    }

    if (
      existingPracticeGeneration.practiceGeneration.practice_generation_status === 'translating' &&
      isProcessingStale(existingPracticeGeneration.practiceGeneration)
    ) {
      return {
        type: 'stale' as const,
        practiceGeneration: existingPracticeGeneration.practiceGeneration,
      };
    }

    await delay(existingGenerationWaitMs);
  }

  return { type: 'busy' as const };
}

async function fetchDiaryEntryByHash(context: { supabase: any }, userId: string, contentHash: string) {
  const { data, error } = await context.supabase
    .from('diary_entries')
    .select(diaryEntrySelect)
    .eq('user_id', userId)
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (error) {
    return { type: 'error' as const, status: 500, message: error.message };
  }

  if (!data) {
    return { type: 'notFound' as const };
  }

  return { type: 'found' as const, diaryEntry: data as DiaryEntryRow };
}

async function fetchPracticeGeneration(
  context: { supabase: any },
  diaryEntryId: string,
  generationMode: GenerationMode
) {
  const { data, error } = await context.supabase
    .from('practice_generations')
    .select(practiceGenerationSelect)
    .eq('diary_entry_id', diaryEntryId)
    .eq('generation_mode', generationMode)
    .maybeSingle();

  if (error) {
    return { type: 'error' as const, status: 500, message: error.message };
  }

  if (!data) {
    return { type: 'notFound' as const };
  }

  return { type: 'found' as const, practiceGeneration: data as PracticeGenerationRow };
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
    return { type: 'error' as const, status: 500, message: error.message };
  }

  return { type: 'cards' as const, cards: data ?? [] };
}

async function claimExistingPracticeGenerationForRetry(
  context: { supabase: any },
  practiceGeneration: PracticeGenerationRow
) {
  const { data, error } = await context.supabase
    .from('practice_generations')
    .update({
      practice_generation_status: 'translating',
      practice_generation_error: null,
    })
    .eq('id', practiceGeneration.id)
    .eq('practice_generation_status', practiceGeneration.practice_generation_status)
    .select(practiceGenerationSelect)
    .maybeSingle();

  if (error) {
    return { type: 'error' as const, status: 500, message: error.message };
  }

  if (!data) {
    return { type: 'busy' as const };
  }

  const { error: deleteError } = await context.supabase
    .from('translation_cards')
    .delete()
    .eq('practice_generation_id', practiceGeneration.id);

  if (deleteError) {
    await markGenerationFailed(context, practiceGeneration.id, deleteError.message);
    return { type: 'error' as const, status: 500, message: deleteError.message };
  }

  return { type: 'claimed' as const, practiceGeneration: data as PracticeGenerationRow };
}

async function markGenerationFailed(
  context: { supabase: any },
  practiceGenerationId: string,
  message: string
) {
  await context.supabase
    .from('practice_generations')
    .update({
      practice_generation_status: 'failed',
      practice_generation_error: message,
    })
    .eq('id', practiceGenerationId);
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

function isUniqueConstraintError(error: { code?: string } | null) {
  return error?.code === '23505';
}

function isProcessingStale(practiceGeneration: PracticeGenerationRow) {
  const updatedAtMs = Date.parse(practiceGeneration.updated_at);
  return Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > processingRetryTimeoutMs;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGenerationMode(value: unknown): GenerationMode {
  return value === 'natural' ? 'natural' : 'compact';
}

function createPracticeInstructions(generationMode: GenerationMode) {
  const commonInstructions = [
    'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
    '入力は日本語の文字起こし、またはそれを軽く整えた文章です。',
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
    '句読点と文の区切りを補い、読み返しやすい日記文にしてください。',
    'ただし、要約文、作文、エッセイ、説明文のようにしないでください。',
    'その人が自分で書いた日記に見える自然さを優先してください。',
    'そのうえで、英語ならどこまでを一文にするのが自然かを逆算してください。',
    '日本語の句点や話し言葉の切れ目に引きずられず、英語ネイティブが自然に言う一文ごとのカードに分けてください。',
    '各カードは japanese と english の一対一にしてください。',
    'japanese は、その english に対応する日本語の意味の塊だけを入れてください。文の途中で不自然に切らないでください。',
    'english は直訳や教材っぽい説明文にせず、ネイティブが日常会話で自然に言う一文にしてください。',
    'カード数に上限はありません。無理に増やさず、自然に分けられる分だけ返してください。',
  ];

  const modeInstructions =
    generationMode === 'compact'
      ? [
          '現在の生成モードは「短さ優先」です。',
          'フラッシュカードとして覚えやすい短さを優先し、1カード1アイデアを基本にしてください。',
          'and, but, so などの接続詞で自然に分けられる英語文は、一文に詰め込まずカードを分けてください。',
          'because, while, although, if などで長い複文になる場合も、意味が自然に独立するなら分割してください。',
          '分割後の各 english は、文の断片ではなく、それぞれ単独で自然に言える一文にしてください。',
          '目安は1カード12〜16語程度です。ただし自然さや意味の欠落防止が必要なら少し超えて構いません。',
        ]
      : [
          '現在の生成モードは「自然さ優先」です。',
          '自然な話し言葉としての英語を優先してください。',
          '1枚が少し長くなっても、意味の流れとネイティブらしさを崩さないでください。',
          'and, but, so などでつながる一文が自然なら、無理に分割しないでください。',
        ];

  return [...commonInstructions, ...modeInstructions].join('\n');
}

function toPublicDiaryEntry(diaryEntry: DiaryEntryRow) {
  return {
    id: diaryEntry.id,
    user_id: diaryEntry.user_id,
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

  return [createFallbackBulletPoint(fallbackText)];
}

function createFallbackBulletPoint(value: string) {
  return value.replace(/\s+/g, ' ').trim() || '本文はありません。';
}
