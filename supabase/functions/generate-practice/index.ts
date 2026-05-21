import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type TranslationCard = {
  japanese: string;
  english: string;
};

type GeneratePracticeOutput = {
  title: string;
  summaryPoints: string[];
  cards: TranslationCard[];
};

type DiaryEntryRow = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  title: string;
  summary_points: unknown;
  raw_transcript_text: string;
  cleaned_text: string;
  content_hash: string;
  generation_status: 'processing' | 'completed' | 'failed';
  generation_error: string | null;
  created_at: string;
  updated_at: string;
};

const translationCardSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summaryPoints', 'cards'],
  properties: {
    title: {
      type: 'string',
    },
    summaryPoints: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
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
  'id, user_id, source, title, summary_points, raw_transcript_text, cleaned_text, content_hash, generation_status, generation_error, created_at, updated_at';
const translationCardSelect = 'id, diary_entry_id, sort_order, japanese, english, created_at';
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
      return errorResponse('cleanedTextが必要です。');
    }

    const source = body?.source === 'text' ? 'text' : 'voice';
    const contentHash = await createContentHash(cleanedText);
    const diaryEntryClaim = await claimDiaryEntryForGeneration(generationContext, {
      userId,
      source,
      rawTranscriptText,
      cleanedText,
      contentHash,
    });

    if (diaryEntryClaim.type === 'completed') {
      return jsonResponse({
        diaryEntry: toPublicDiaryEntry(diaryEntryClaim.diaryEntry),
        cards: diaryEntryClaim.cards,
        reused: true,
      });
    }

    if (diaryEntryClaim.type === 'busy') {
      return errorResponse(
        'この内容の英語カードは作成中です。少し待ってからもう一度確認してください。',
        409
      );
    }

    if (diaryEntryClaim.type === 'error') {
      return errorResponse(diaryEntryClaim.message, diaryEntryClaim.status);
    }

    const claimedDiaryEntry = diaryEntryClaim.diaryEntry;

    const output = await createOpenAIJsonResponse<GeneratePracticeOutput>({
      schemaName: 'daily_to_english_translation_cards',
      schema: translationCardSchema,
      instructions: [
        'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
        '入力は日本語の文字起こしです。まず全体の意味を理解し、英語ならどこまでを一文にするのが自然かを逆算してください。',
        'title は日記一覧で最初に表示する日本語の一行タイトルです。本文の主題がすぐ思い出せる10〜22文字程度にしてください。',
        'title は名詞句または短い見出しにしてください。「今日の記録」のような汎用タイトルや文末の句点は避けてください。',
        'summaryPoints は日記一覧で箇条書き表示する日本語の要点です。内容量に応じて1〜3個にしてください。',
        '短い入力や要点が少ない入力なら1個で十分です。無理に増やさないでください。',
        'summaryPoints はそれぞれ12〜32文字程度で、感情・出来事・気づきが思い出せる短い文にしてください。',
        'summaryPoints は本文の違う側面を拾ってください。文末の句点は付けないでください。',
        '日本語の句点や話し言葉の切れ目に引きずられず、英語ネイティブが自然に言う一文ごとのカードに分けてください。',
        '各カードは japanese と english の一対一にしてください。',
        'japanese は、その english に対応する日本語の意味の塊だけを入れてください。文の途中で不自然に切らないでください。',
        'english は説明調ではなく、実際にネイティブが会話や打ち合わせで言う自然な一文にしてください。',
        'カード数に上限はありません。無理に増やさず、自然に分けられる分だけ返してください。',
      ].join('\n'),
      input: cleanedText,
      maxOutputTokens: 2400,
    }).catch(async (error) => {
      await markGenerationFailed(
        generationContext,
        claimedDiaryEntry.id,
        error instanceof Error ? error.message : '英語カードの生成に失敗しました。'
      );
      throw error;
    });
    const title = normalizeTitle(output.title, cleanedText);
    const summaryPoints = normalizeSummaryPoints(output.summaryPoints);

    const cardDrafts = output.cards
      .map((card, index) => ({
        sort_order: index + 1,
        japanese: card.japanese.trim(),
        english: card.english.trim(),
      }))
      .filter((card) => card.japanese && card.english);

    if (summaryPoints.length < 1) {
      await markGenerationFailed(
        generationContext,
        claimedDiaryEntry.id,
        '日記の要点を作成できませんでした。'
      );
      return errorResponse('日記の要点を作成できませんでした。', 502);
    }

    if (cardDrafts.length === 0) {
      await markGenerationFailed(
        generationContext,
        claimedDiaryEntry.id,
        '英語カードを作成できませんでした。'
      );
      return errorResponse('英語カードを作成できませんでした。', 502);
    }

    const { data: diaryEntry, error: diaryError } = await generationContext.supabase
      .from('diary_entries')
      .update({
        source,
        title,
        summary_points: summaryPoints,
        raw_transcript_text: rawTranscriptText,
        cleaned_text: cleanedText,
        generation_error: null,
      })
      .eq('id', claimedDiaryEntry.id)
      .select(diaryEntrySelect)
      .single();

    if (diaryError) {
      await markGenerationFailed(generationContext, claimedDiaryEntry.id, diaryError.message);
      return errorResponse(diaryError.message, 500);
    }

    const cardRows = cardDrafts.map((card) => ({
      user_id: userId,
      diary_entry_id: diaryEntry.id,
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
      await markGenerationFailed(generationContext, claimedDiaryEntry.id, cardsError.message);
      return errorResponse(cardsError.message, 500);
    }

    if (!cards?.length) {
      await markGenerationFailed(
        generationContext,
        claimedDiaryEntry.id,
        '英語カードを保存できませんでした。'
      );
      return errorResponse('英語カードを保存できませんでした。', 500);
    }

    const { data: completedDiaryEntry, error: completeError } = await generationContext.supabase
      .from('diary_entries')
      .update({
        generation_status: 'completed',
        generation_error: null,
      })
      .eq('id', claimedDiaryEntry.id)
      .select(diaryEntrySelect)
      .single();

    if (completeError) {
      await markGenerationFailed(generationContext, claimedDiaryEntry.id, completeError.message);
      return errorResponse(completeError.message, 500);
    }

    return jsonResponse({
      diaryEntry: toPublicDiaryEntry(completedDiaryEntry),
      cards,
      reused: false,
    });
  },
};

async function claimDiaryEntryForGeneration(
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
      title: '日記の記録',
      summary_points: [],
      raw_transcript_text: rawTranscriptText,
      cleaned_text: cleanedText,
      content_hash: contentHash,
      generation_status: 'processing',
      generation_error: null,
    })
    .select(diaryEntrySelect)
    .single();

  if (!error && diaryEntry) {
    return { type: 'claimed' as const, diaryEntry: diaryEntry as DiaryEntryRow };
  }

  if (!isUniqueConstraintError(error)) {
    return {
      type: 'error' as const,
      status: 500,
      message: error?.message ?? '英語カードの作成を開始できませんでした。',
    };
  }

  const existingPractice = await waitForExistingPractice(context, userId, contentHash);

  if (existingPractice.type === 'completed' || existingPractice.type === 'busy') {
    return existingPractice;
  }

  if (existingPractice.type === 'error') {
    return existingPractice;
  }

  if (existingPractice.type === 'failed' || existingPractice.type === 'stale') {
    const retryClaim = await claimExistingDiaryEntryForRetry(context, existingPractice.diaryEntry, {
      source,
      rawTranscriptText,
      cleanedText,
    });

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
  userId: string,
  contentHash: string
) {
  for (let attempt = 0; attempt < existingGenerationWaitAttempts; attempt += 1) {
    const existingDiaryEntry = await fetchDiaryEntryByHash(context, userId, contentHash);

    if (existingDiaryEntry.type === 'error') {
      return existingDiaryEntry;
    }

    if (existingDiaryEntry.type === 'notFound') {
      return { type: 'busy' as const };
    }

    if (existingDiaryEntry.diaryEntry.generation_status === 'completed') {
      const cards = await fetchDiaryEntryCards(context, existingDiaryEntry.diaryEntry.id);

      if (cards.type === 'error') {
        return cards;
      }

      if (cards.cards.length > 0) {
        return {
          type: 'completed' as const,
          diaryEntry: existingDiaryEntry.diaryEntry,
          cards: cards.cards,
        };
      }
    }

    if (existingDiaryEntry.diaryEntry.generation_status === 'failed') {
      return {
        type: 'failed' as const,
        diaryEntry: existingDiaryEntry.diaryEntry,
      };
    }

    if (
      existingDiaryEntry.diaryEntry.generation_status === 'processing' &&
      isProcessingStale(existingDiaryEntry.diaryEntry)
    ) {
      return {
        type: 'stale' as const,
        diaryEntry: existingDiaryEntry.diaryEntry,
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

async function fetchDiaryEntryCards(context: { supabase: any }, diaryEntryId: string) {
  const { data, error } = await context.supabase
    .from('translation_cards')
    .select(translationCardSelect)
    .eq('diary_entry_id', diaryEntryId)
    .order('sort_order', { ascending: true });

  if (error) {
    return { type: 'error' as const, status: 500, message: error.message };
  }

  return { type: 'cards' as const, cards: data ?? [] };
}

async function claimExistingDiaryEntryForRetry(
  context: { supabase: any },
  diaryEntry: DiaryEntryRow,
  {
    source,
    rawTranscriptText,
    cleanedText,
  }: {
    source: 'text' | 'voice';
    rawTranscriptText: string;
    cleanedText: string;
  }
) {
  const { data, error } = await context.supabase
    .from('diary_entries')
    .update({
      source,
      raw_transcript_text: rawTranscriptText,
      cleaned_text: cleanedText,
      generation_status: 'processing',
      generation_error: null,
    })
    .eq('id', diaryEntry.id)
    .eq('generation_status', diaryEntry.generation_status)
    .select(diaryEntrySelect)
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
    .eq('diary_entry_id', diaryEntry.id);

  if (deleteError) {
    await markGenerationFailed(context, diaryEntry.id, deleteError.message);
    return { type: 'error' as const, status: 500, message: deleteError.message };
  }

  return { type: 'claimed' as const, diaryEntry: data as DiaryEntryRow };
}

async function markGenerationFailed(context: { supabase: any }, diaryEntryId: string, message: string) {
  await context.supabase
    .from('diary_entries')
    .update({
      generation_status: 'failed',
      generation_error: message,
    })
    .eq('id', diaryEntryId);
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

function isProcessingStale(diaryEntry: DiaryEntryRow) {
  const updatedAtMs = Date.parse(diaryEntry.updated_at);
  return Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > processingRetryTimeoutMs;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPublicDiaryEntry(diaryEntry: DiaryEntryRow) {
  return {
    id: diaryEntry.id,
    user_id: diaryEntry.user_id,
    source: diaryEntry.source,
    title: diaryEntry.title,
    summary_points: diaryEntry.summary_points,
    raw_transcript_text: diaryEntry.raw_transcript_text,
    cleaned_text: diaryEntry.cleaned_text,
    created_at: diaryEntry.created_at,
  };
}

function normalizeTitle(title: string, fallbackText: string) {
  const normalizedTitle = title.replace(/\s+/g, ' ').replace(/[。．.]+$/g, '').trim();

  if (normalizedTitle) {
    return truncateTitle(normalizedTitle);
  }

  const normalizedFallback = fallbackText.replace(/\s+/g, ' ').replace(/[。．.]+$/g, '').trim();

  if (normalizedFallback) {
    return truncateTitle(normalizedFallback);
  }

  return '日記の記録';
}

function truncateTitle(value: string) {
  const chars = Array.from(value);

  if (chars.length <= 28) {
    return value;
  }

  return `${chars.slice(0, 27).join('')}…`;
}

function normalizeSummaryPoints(points: string[]) {
  const normalizedPoints = points
    .map((point) => point.replace(/\s+/g, ' ').replace(/[。．.]+$/g, '').trim())
    .filter(Boolean)
    .map(truncateSummaryPoint);

  return Array.from(new Set(normalizedPoints)).slice(0, 3);
}

function truncateSummaryPoint(value: string) {
  const chars = Array.from(value);

  if (chars.length <= 34) {
    return value;
  }

  return `${chars.slice(0, 33).join('')}…`;
}
