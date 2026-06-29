import { ensureAnonymousSession } from '@/lib/backend/auth';
import type { TranscriptionWord } from '@/lib/backend/transcription';
import { normalizeWaveformPeaks } from '@/lib/audio/waveform';
import { type CardSplitPolicy } from '@/lib/card-split-policy';
import { UserFacingBackendError } from '@/lib/backend/errors';
import type { CardLearningProgress, CardLearningStatus } from '@/lib/card-learning-statuses';
import { requireSupabaseClient } from '@/lib/supabase/client';
import { DefaultTranslationStyle, type TranslationStyle } from '@/lib/translation-style';

export type TranslationCard = {
  id: string;
  practiceGenerationId: string;
  sortOrder: number;
  japanese: string;
  english: string;
  sourceWordStartIndex: number | null;
  sourceWordEndIndex: number | null;
  audioStartSec: number | null;
  audioEndSec: number | null;
  learningProgress: CardLearningProgress;
  createdAt?: string;
};

export type PracticeGenerationStatus = 'draft' | 'translating' | 'completed' | 'failed' | 'discarded';

export type PracticeDraftCard = {
  id: string;
  practiceGenerationId: string;
  sortOrder: number;
  japanese: string;
  english: null;
  sourceWordStartIndex: number | null;
  sourceWordEndIndex: number | null;
  audioStartSec: number | null;
  audioEndSec: number | null;
  learningProgress: CardLearningProgress;
  createdAt?: string;
};

export type PracticeDiaryEntry = {
  id: string;
  source: 'text' | 'voice';
  originalText: string;
  plainText: string;
  isTranscriptEdited: boolean;
  bulletPoints: string[];
  transcriptWords: TranscriptionWord[];
  waveformPeaks: number[];
  createdAt: string;
};

export type PracticeDraft = {
  cardSplitPolicy: CardSplitPolicy;
  diaryEntry: PracticeDiaryEntry;
  errorMessage?: string;
  practiceGenerationId: string;
  source: 'text' | 'voice';
  status: Extract<PracticeGenerationStatus, 'draft' | 'failed' | 'translating'>;
  cards: PracticeDraftCard[];
  createdAt: string;
};

export type CompletedPractice = {
  cardSplitPolicy: CardSplitPolicy;
  diaryEntry: PracticeDiaryEntry;
  practiceGenerationId: string;
  source: 'text' | 'voice';
  status: 'completed';
  translationStyle: TranslationStyle;
  cards: TranslationCard[];
  createdAt: string;
};

export type TranslationCardGroup = {
  cardSplitPolicy: CardSplitPolicy;
  diaryEntryId: string;
  practiceGenerationId: string;
  source: 'text' | 'voice';
  translationStyle: TranslationStyle;
  isTranscriptEdited: boolean;
  diaryText: string;
  diaryExcerpt: string;
  createdAt: string;
  cards: TranslationCard[];
};

type TranslationCardRow = {
  audio_end_sec: number | null;
  audio_start_sec: number | null;
  created_at?: string;
  english: string | null;
  id: string;
  japanese: string;
  last_reviewed_at: string | null;
  learning_status: string;
  next_review_at: string | null;
  practice_generation_id: string;
  review_count: number;
  sort_order: number;
  source_word_end_index: number | null;
  source_word_start_index: number | null;
  success_count: number;
};

export type DiaryEntry = {
  id: string;
  source: 'text' | 'voice';
  originalText: string;
  plainText: string;
  isTranscriptEdited: boolean;
  bulletPoints: string[];
  waveformPeaks: number[];
  createdAt: string;
};

type DiaryEntryRow = {
  id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
  is_transcript_edited?: boolean;
  bullet_points: unknown;
  transcript_words?: unknown;
  waveform_peaks?: unknown;
  created_at: string;
};

type DiaryEntryGroupRow = {
  id: string;
  source: 'text' | 'voice';
  plain_text: string;
  is_transcript_edited?: boolean;
  created_at: string;
};

type PracticeGenerationRow = {
  card_split_policy: CardSplitPolicy;
  client_request_id?: string;
  error_message?: string | null;
  id: string;
  diary_entry_id: string;
  status?: PracticeGenerationStatus;
  translation_style: TranslationStyle;
  created_at: string;
  updated_at?: string;
};

export type PreparePracticeDraftParams = {
  cardSplitPolicy?: CardSplitPolicy;
  clientRequestId: string;
  diaryText: string;
  source: 'text' | 'voice';
  isTranscriptEdited?: boolean;
  rawTranscriptText?: string;
  cleanedText?: string;
  transcriptWords?: TranscriptionWord[];
  waveformPeaks?: number[];
};

type PracticeFunctionDiaryEntry = {
  id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
  is_transcript_edited?: boolean;
  bullet_points?: unknown;
  transcript_words?: unknown;
  waveform_peaks?: unknown;
  created_at: string;
};

type PracticeFunctionGeneration = {
  card_split_policy: CardSplitPolicy;
  id: string;
  diary_entry_id: string;
  status: PracticeGenerationStatus;
  translation_style: TranslationStyle;
  created_at: string;
};

export type PreparePracticeDraftResponse = {
  diaryEntry: PracticeFunctionDiaryEntry;
  practiceGeneration: PracticeFunctionGeneration;
  cards: TranslationCardRow[];
};

export type CompletePracticeDraftParams = {
  practiceGenerationId: string;
  translationStyle?: TranslationStyle;
};

export type CompletePracticeResponse = {
  diaryEntry: PracticeFunctionDiaryEntry;
  practiceGeneration: PracticeFunctionGeneration;
  cards: TranslationCardRow[];
};

const translationCardSelect =
  'id, practice_generation_id, sort_order, japanese, english, source_word_start_index, source_word_end_index, audio_start_sec, audio_end_sec, learning_status, last_reviewed_at, next_review_at, review_count, success_count, created_at';
const NoPracticeContentMessage = '英語カードにできる内容が見つかりませんでした。';
const DraftFailureMessage = '分割カードの作成に失敗しました。';
const CompleteFailureMessage = '英語カードの作成に失敗しました。';
const RestorablePracticeGenerationStatuses = ['draft', 'failed', 'translating'] as const;
const TranslatingGenerationRestoreAfterMs = 10 * 60 * 1000;

export async function preparePracticeDraft({
  cardSplitPolicy = 'small_steps',
  clientRequestId,
  diaryText,
  source,
  isTranscriptEdited,
  rawTranscriptText,
  cleanedText,
  transcriptWords,
  waveformPeaks,
}: PreparePracticeDraftParams) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke<PreparePracticeDraftResponse>(
    'prepare-practice-draft',
    {
      body: {
        cardSplitPolicy,
        clientRequestId,
        diaryText,
        source,
        isTranscriptEdited: source === 'voice' ? Boolean(isTranscriptEdited) : false,
        rawTranscriptText,
        cleanedText,
        transcriptWords: source === 'voice' ? transcriptWords ?? [] : [],
        waveformPeaks: source === 'voice' ? normalizeWaveformPeaks(waveformPeaks) : [],
      },
    }
  );

  if (error) {
    throw await normalizeFunctionError(error, DraftFailureMessage);
  }

  if (!data?.cards?.length) {
    throw new UserFacingBackendError({ userMessage: NoPracticeContentMessage });
  }

  return mapPracticeDraftResponse(data);
}

export async function completePracticeDraft({
  practiceGenerationId,
  translationStyle = DefaultTranslationStyle,
}: CompletePracticeDraftParams) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke<CompletePracticeResponse>(
    'complete-practice',
    {
      body: {
        practiceGenerationId,
        translationStyle,
      },
    }
  );

  if (error) {
    throw await normalizeFunctionError(error, CompleteFailureMessage);
  }

  if (!data?.cards?.length) {
    throw new UserFacingBackendError({ userMessage: CompleteFailureMessage });
  }

  return mapCompletedPracticeResponse(data);
}

export async function getLatestPracticeDraft(cardSplitPolicy: CardSplitPolicy) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: generationRows, error: generationError } = await supabase
    .from('practice_generations')
    .select('id, diary_entry_id, client_request_id, card_split_policy, translation_style, status, error_message, created_at, updated_at')
    .eq('card_split_policy', cardSplitPolicy)
    .in('status', RestorablePracticeGenerationStatuses)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (generationError) {
    throw generationError;
  }

  const generation =
    ((generationRows ?? []) as PracticeGenerationRow[]).find(isRestorablePracticeGeneration) ?? null;

  if (!generation) {
    return null;
  }

  const { data: diaryEntry, error: diaryError } = await supabase
    .from('diary_entries')
    .select('id, source, original_text, plain_text, is_transcript_edited, bullet_points, transcript_words, waveform_peaks, created_at')
    .eq('id', generation.diary_entry_id)
    .maybeSingle();

  if (diaryError) {
    throw diaryError;
  }

  if (!diaryEntry) {
    return null;
  }

  const { data: cards, error: cardsError } = await supabase
    .from('translation_cards')
    .select(translationCardSelect)
    .eq('practice_generation_id', generation.id)
    .order('sort_order', { ascending: true });

  if (cardsError) {
    throw cardsError;
  }

  if (!cards?.length) {
    return null;
  }

  return {
    cardSplitPolicy: generation.card_split_policy,
    diaryEntry: mapPracticeDiaryEntry(diaryEntry as DiaryEntryRow),
    errorMessage: generation.error_message ?? undefined,
    practiceGenerationId: generation.id,
    source: (diaryEntry as DiaryEntryRow).source,
    status: normalizeRestorablePracticeGenerationStatus(generation.status),
    cards: (cards as TranslationCardRow[]).map(mapPracticeDraftCard),
    createdAt: generation.created_at,
  } satisfies PracticeDraft;
}

export async function discardPracticeDraft(practiceGenerationId: string) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: generation, error: generationError } = await supabase
    .from('practice_generations')
    .select('id, diary_entry_id, client_request_id, status, updated_at')
    .eq('id', practiceGenerationId)
    .in('status', RestorablePracticeGenerationStatuses)
    .maybeSingle();

  if (generationError) {
    throw generationError;
  }

  if (!generation) {
    return;
  }

  const draftGeneration = generation as PracticeGenerationRow;

  if (!isRestorablePracticeGeneration(draftGeneration)) {
    return;
  }

  const { error } = await supabase.rpc('discard_practice_generation', {
    p_generation_id: draftGeneration.id,
  });

  if (error) {
    throw error;
  }
}

export async function generatePracticeFromDiary({
  translationStyle = DefaultTranslationStyle,
  ...params
}: PreparePracticeDraftParams & { translationStyle?: TranslationStyle }) {
  const draft = await preparePracticeDraft(params);
  return completePracticeDraft({
    practiceGenerationId: draft.practiceGenerationId,
    translationStyle,
  });
}

function mapPracticeDraftResponse(data: PreparePracticeDraftResponse): PracticeDraft {
  return {
    cardSplitPolicy: data.practiceGeneration.card_split_policy,
    diaryEntry: mapPracticeFunctionDiaryEntry(data.diaryEntry),
    practiceGenerationId: data.practiceGeneration.id,
    source: data.diaryEntry.source,
    status: normalizeRestorablePracticeGenerationStatus(data.practiceGeneration.status),
    cards: data.cards.map(mapPracticeDraftCard),
    createdAt: data.practiceGeneration.created_at,
  };
}

function mapCompletedPracticeResponse(data: CompletePracticeResponse): CompletedPractice {
  return {
    cardSplitPolicy: data.practiceGeneration.card_split_policy,
    diaryEntry: mapPracticeFunctionDiaryEntry(data.diaryEntry),
    practiceGenerationId: data.practiceGeneration.id,
    source: data.diaryEntry.source,
    status: 'completed',
    translationStyle: data.practiceGeneration.translation_style,
    cards: data.cards.map(mapTranslationCard),
    createdAt: data.practiceGeneration.created_at,
  };
}

export async function listDiaryEntries() {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: generationRows, error: generationsError } = await supabase
    .from('practice_generations')
    .select('diary_entry_id, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (generationsError) {
    throw generationsError;
  }

  const diaryEntryIds = Array.from(
    new Set(
      ((generationRows ?? []) as { diary_entry_id: string }[]).map(
        (generation) => generation.diary_entry_id
      )
    )
  );

  if (diaryEntryIds.length === 0) {
    return [];
  }

  const { data: entries, error: entriesError } = await supabase
    .from('diary_entries')
    .select('id, source, original_text, plain_text, is_transcript_edited, bullet_points, transcript_words, waveform_peaks, created_at')
    .in('id', diaryEntryIds);

  if (entriesError) {
    throw entriesError;
  }

  const entriesById = new Map(((entries ?? []) as DiaryEntryRow[]).map((entry) => [entry.id, entry]));

  return diaryEntryIds
    .map((entryId) => entriesById.get(entryId) ?? null)
    .filter((entry): entry is DiaryEntryRow => entry !== null)
    .map((entry) => ({
      id: entry.id,
      source: entry.source,
      originalText: entry.original_text,
      plainText: normalizeDiaryBodyText(entry.plain_text),
      isTranscriptEdited: Boolean(entry.is_transcript_edited),
      bulletPoints: normalizeBulletPoints(entry.bullet_points, entry.plain_text),
      waveformPeaks: normalizeWaveformPeaks(entry.waveform_peaks),
      createdAt: entry.created_at,
    }));
}

export async function listTranslationCardGroups() {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: generationRows, error: generationsError } = await supabase
    .from('practice_generations')
    .select('id, diary_entry_id, card_split_policy, translation_style, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (generationsError) {
    throw generationsError;
  }

  const practiceGenerations = (generationRows ?? []) as PracticeGenerationRow[];

  if (practiceGenerations.length === 0) {
    return [];
  }

  const diaryEntryIds = Array.from(
    new Set(practiceGenerations.map((generation) => generation.diary_entry_id))
  );
  const practiceGenerationIds = practiceGenerations.map((generation) => generation.id);

  const { data: entries, error: entriesError } = await supabase
    .from('diary_entries')
    .select('id, source, plain_text, is_transcript_edited, created_at')
    .in('id', diaryEntryIds);

  if (entriesError) {
    throw entriesError;
  }

  const { data, error } = await supabase
    .from('translation_cards')
    .select(translationCardSelect)
    .in('practice_generation_id', practiceGenerationIds)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  const diaryEntriesById = new Map(
    ((entries ?? []) as DiaryEntryGroupRow[]).map((entry) => [entry.id, entry])
  );
  const cardsByPracticeGenerationId = new Map<string, TranslationCard[]>();
  const cardCountsByPracticeGenerationId = new Map<string, number>();

  for (const card of data ?? []) {
    const rawCard = card as TranslationCardRow;
    cardCountsByPracticeGenerationId.set(
      rawCard.practice_generation_id,
      (cardCountsByPracticeGenerationId.get(rawCard.practice_generation_id) ?? 0) + 1
    );
    const mappedCard = mapCompletedTranslationCard(card);

    if (!mappedCard) {
      continue;
    }

    const generationCards =
      cardsByPracticeGenerationId.get(mappedCard.practiceGenerationId) ?? [];
    generationCards.push(mappedCard);
    cardsByPracticeGenerationId.set(mappedCard.practiceGenerationId, generationCards);
  }

  return practiceGenerations
    .map((generation) => {
      const entry = diaryEntriesById.get(generation.diary_entry_id);
      const cards = cardsByPracticeGenerationId.get(generation.id) ?? [];
      const cardCount = cardCountsByPracticeGenerationId.get(generation.id) ?? 0;

      if (!entry || cards.length === 0 || cards.length !== cardCount) {
        return null;
      }

      return {
        cardSplitPolicy: generation.card_split_policy,
        diaryEntryId: entry.id,
        practiceGenerationId: generation.id,
        source: entry.source,
        translationStyle: generation.translation_style,
        isTranscriptEdited: Boolean(entry.is_transcript_edited),
        diaryText: normalizeDiaryBodyText(entry.plain_text),
        diaryExcerpt: createDiaryExcerpt(entry.plain_text),
        createdAt: entry.created_at,
        cards,
      };
    })
    .filter((group): group is TranslationCardGroup => group !== null);
}

export async function setTranslationCardLearningStatus(
  cardId: string,
  status: CardLearningStatus
) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { error } = await supabase.rpc('set_translation_card_learning_status', {
    p_card_id: cardId,
    p_learning_status: status,
  });

  if (error) {
    throw error;
  }
}

export async function restoreTranslationCardLearningProgress(
  cardId: string,
  progress: CardLearningProgress
) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { error } = await (supabase.rpc as any)('restore_translation_card_learning_progress', {
    p_card_id: cardId,
    p_last_reviewed_at: progress.lastReviewedAt ?? null,
    p_learning_status: progress.status,
    p_next_review_at: progress.nextReviewAt ?? null,
    p_review_count: progress.reviewCount,
    p_success_count: progress.successCount,
  });

  if (error) {
    throw error;
  }
}

async function normalizeFunctionError(error: unknown, fallbackUserMessage: string) {
  const response = isFunctionErrorWithResponse(error) ? error.context : null;
  let debugMessage: string | null = null;

  if (response) {
    const body = await response.text().catch(() => '');
    const parsed = parseJson<{ error?: string }>(body);

    if (parsed?.error) {
      debugMessage = parsed.error;
    } else if (body) {
      debugMessage = body;
    }
  } else if (error instanceof Error) {
    debugMessage = error.message;
  } else if (typeof error === 'string') {
    debugMessage = error;
  }

  if (debugMessage === NoPracticeContentMessage) {
    return new UserFacingBackendError({ userMessage: NoPracticeContentMessage });
  }

  return new UserFacingBackendError({
    userMessage: fallbackUserMessage,
    debugMessage,
    cause: error,
  });
}

function isFunctionErrorWithResponse(error: unknown): error is { context: { text: () => Promise<string> } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'context' in error &&
    typeof error.context === 'object' &&
    error.context !== null &&
    'text' in error.context &&
    typeof error.context.text === 'function'
  );
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function mapTranslationCard(card: TranslationCardRow): TranslationCard {
  return {
    id: card.id,
    practiceGenerationId: card.practice_generation_id,
    sortOrder: card.sort_order,
    japanese: card.japanese,
    english: card.english ?? '',
    sourceWordStartIndex: card.source_word_start_index,
    sourceWordEndIndex: card.source_word_end_index,
    audioStartSec: card.audio_start_sec,
    audioEndSec: card.audio_end_sec,
    learningProgress: mapCardLearningProgress(card),
    createdAt: card.created_at,
  };
}

function mapCompletedTranslationCard(card: TranslationCardRow): TranslationCard | null {
  const english = card.english?.trim();

  if (!english) {
    return null;
  }

  return {
    id: card.id,
    practiceGenerationId: card.practice_generation_id,
    sortOrder: card.sort_order,
    japanese: card.japanese,
    english,
    sourceWordStartIndex: card.source_word_start_index,
    sourceWordEndIndex: card.source_word_end_index,
    audioStartSec: card.audio_start_sec,
    audioEndSec: card.audio_end_sec,
    learningProgress: mapCardLearningProgress(card),
    createdAt: card.created_at,
  };
}

function mapPracticeDraftCard(card: TranslationCardRow): PracticeDraftCard {
  return {
    id: card.id,
    practiceGenerationId: card.practice_generation_id,
    sortOrder: card.sort_order,
    japanese: card.japanese,
    english: null,
    sourceWordStartIndex: card.source_word_start_index,
    sourceWordEndIndex: card.source_word_end_index,
    audioStartSec: card.audio_start_sec,
    audioEndSec: card.audio_end_sec,
    learningProgress: mapCardLearningProgress(card),
    createdAt: card.created_at,
  };
}

function mapPracticeFunctionDiaryEntry(entry: PracticeFunctionDiaryEntry): PracticeDiaryEntry {
  return {
    id: entry.id,
    source: entry.source,
    originalText: entry.original_text,
    plainText: normalizeDiaryBodyText(entry.plain_text),
    isTranscriptEdited: Boolean(entry.is_transcript_edited),
    bulletPoints: normalizeBulletPoints(entry.bullet_points, entry.plain_text),
    transcriptWords: normalizeTranscriptWords(entry.transcript_words),
    waveformPeaks: normalizeWaveformPeaks(entry.waveform_peaks),
    createdAt: entry.created_at,
  };
}

function mapPracticeDiaryEntry(entry: DiaryEntryRow): PracticeDiaryEntry {
  return {
    id: entry.id,
    source: entry.source,
    originalText: entry.original_text,
    plainText: normalizeDiaryBodyText(entry.plain_text),
    isTranscriptEdited: Boolean(entry.is_transcript_edited),
    bulletPoints: normalizeBulletPoints(entry.bullet_points, entry.plain_text),
    transcriptWords: normalizeTranscriptWords(entry.transcript_words),
    waveformPeaks: normalizeWaveformPeaks(entry.waveform_peaks),
    createdAt: entry.created_at,
  };
}

function normalizeTranscriptWords(value: unknown): TranscriptionWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((word, fallbackIndex) => {
    if (
      !isRecord(word) ||
      typeof word.word !== 'string' ||
      typeof word.start !== 'number' ||
      typeof word.end !== 'number'
    ) {
      return [];
    }

    return {
      index: 'index' in word && typeof word.index === 'number' ? word.index : fallbackIndex,
      word: word.word,
      start: word.start,
      end: word.end,
    };
  });
}

function isRestorablePracticeGeneration(generation: PracticeGenerationRow) {
  const status = generation.status;

  if (status === 'draft' || status === 'failed') {
    return true;
  }

  if (status !== 'translating' || !generation.updated_at) {
    return false;
  }

  const updatedAt = Date.parse(generation.updated_at);

  if (!Number.isFinite(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt >= TranslatingGenerationRestoreAfterMs;
}

function normalizeRestorablePracticeGenerationStatus(
  status: PracticeGenerationStatus | undefined
): PracticeDraft['status'] {
  if (status === 'failed' || status === 'translating') {
    return status;
  }

  return 'draft';
}

function mapCardLearningProgress(card: TranslationCardRow): CardLearningProgress {
  return {
    status: isCardLearningStatus(card.learning_status) ? card.learning_status : 'new',
    lastReviewedAt: card.last_reviewed_at ?? undefined,
    nextReviewAt: card.next_review_at ?? undefined,
    reviewCount: Math.max(0, card.review_count ?? 0),
    successCount: Math.max(0, card.success_count ?? 0),
  };
}

function isCardLearningStatus(value: unknown): value is CardLearningStatus {
  return value === 'new' || value === 'learning' || value === 'known';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeBulletPoints(value: unknown, fallbackText: string) {
  if (Array.isArray(value)) {
    const bulletPoints = value
      .filter((point): point is string => typeof point === 'string')
      .map((point) => point.replace(/^[\s・\-*、。]+/g, '').trim())
      .filter((point) => point.length > 0);

    if (bulletPoints.length > 0) {
      return bulletPoints;
    }
  }

  return [normalizeDiaryBodyText(fallbackText).replace(/\s+/g, ' ').trim()];
}

function normalizeDiaryBodyText(value: string) {
  const normalizedValue = value.replace(/\n{3,}/g, '\n\n').trim();

  if (normalizedValue) {
    return normalizedValue;
  }

  return '本文はありません。';
}

function createDiaryExcerpt(value: string) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  if (!normalizedValue) {
    return '日記の記録';
  }

  const chars = Array.from(normalizedValue);

  if (chars.length <= 46) {
    return normalizedValue;
  }

  return `${chars.slice(0, 45).join('')}…`;
}
