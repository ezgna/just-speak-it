import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type TranslationCard = {
  japanese: string;
  english: string;
};

type GenerationMode = 'natural' | 'compact';
type PracticeGenerationStatus = 'processing' | 'completed' | 'failed';

type GeneratePracticeOutput = {
  diaryText: string;
  cards: TranslationCard[];
};

type DiaryEntryRow = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  raw_transcript_text: string;
  body_text: string;
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
  required: ['diaryText', 'cards'],
  properties: {
    diaryText: {
      type: 'string',
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
  'id, user_id, source, raw_transcript_text, body_text, content_hash, created_at, updated_at';
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
    const cleanedText =
      typeof body?.cleanedText === 'string' && body.cleanedText.trim()
        ? body.cleanedText.trim()
        : typeof body?.diaryText === 'string'
          ? body.diaryText.trim()
          : '';
    const rawTranscriptText =
      typeof body?.rawTranscriptText === 'string' && body.rawTranscriptText.trim()
        ? body.rawTranscriptText.trim()
        : typeof body?.transcriptText === 'string' && body.transcriptText.trim()
          ? body.transcriptText.trim()
          : cleanedText;

    if (!cleanedText) {
      return errorResponse('日記本文が必要です。');
    }

    const source = body?.source === 'text' ? 'text' : 'voice';
    const generationMode = parseGenerationMode(body?.generationMode);
    const contentHash = await createContentHash(cleanedText);
    const generationClaim = await claimGeneration(generationContext, {
      userId,
      source,
      generationMode,
      rawTranscriptText,
      cleanedText,
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

    const output = await createOpenAIJsonResponse<GeneratePracticeOutput>({
      schemaName: 'daily_to_english_translation_cards',
      schema: translationCardSchema,
      instructions: createPracticeInstructions(generationMode),
      input: cleanedText,
      maxOutputTokens: 2400,
    }).catch(async (error) => {
      await markGenerationFailed(
        generationContext,
        claimedPracticeGeneration.id,
        error instanceof Error ? error.message : '英語カードの生成に失敗しました。'
      );
      throw error;
    });
    const bodyText = normalizeDiaryText(output.diaryText, cleanedText);

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
        raw_transcript_text: rawTranscriptText,
        body_text: bodyText,
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
    rawTranscriptText,
    cleanedText,
    contentHash,
  }: {
    userId: string;
    source: 'text' | 'voice';
    generationMode: GenerationMode;
    rawTranscriptText: string;
    cleanedText: string;
    contentHash: string;
  }
): Promise<GenerationClaim> {
  const diaryEntryClaim = await getOrCreateDiaryEntry(context, {
    userId,
    source,
    rawTranscriptText,
    cleanedText,
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
    rawTranscriptText,
    cleanedText,
    contentHash,
  }: {
    userId: string;
    source: 'text' | 'voice';
    rawTranscriptText: string;
    cleanedText: string;
    contentHash: string;
  }
) {
  const { data: diaryEntry, error } = await context.supabase
    .from('diary_entries')
    .insert({
      user_id: userId,
      source,
      raw_transcript_text: rawTranscriptText,
      body_text: cleanedText,
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
      practice_generation_status: 'processing',
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
      existingPracticeGeneration.practiceGeneration.practice_generation_status === 'processing' &&
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
      practice_generation_status: 'processing',
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
  return value === 'compact' ? 'compact' : 'natural';
}

function createPracticeInstructions(generationMode: GenerationMode) {
  const commonInstructions = [
    'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
    '入力は日本語の文字起こし、またはそれを軽く整えた文章です。',
    'diaryText は日記タブにそのまま全文表示する日本語本文です。',
    'diaryText にタイトル、見出し、箇条書き、要約、説明文を入れないでください。',
    'diaryText は話者の事実と温度感を保ったまま、読める日記文として句読点と文の流れだけを整えてください。',
    '意味を足さないでください。削りすぎないでください。短い入力は短い日記文のままで構いません。',
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
    raw_transcript_text: diaryEntry.raw_transcript_text,
    body_text: diaryEntry.body_text,
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
