import { ensureAnonymousSession } from '@/lib/backend/auth';
import type { TranscriptionWord } from '@/lib/backend/transcription';
import { normalizeWaveformPeaks } from '@/lib/audio/waveform';
import { type GenerationMode } from '@/lib/generation-mode';
import { requireSupabaseClient } from '@/lib/supabase/client';

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
  createdAt?: string;
};

export type PracticeGenerationStatus = 'draft' | 'translating' | 'completed' | 'failed';

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
  createdAt?: string;
};

export type PracticeDiaryEntry = {
  id: string;
  source: 'text' | 'voice';
  originalText: string;
  plainText: string;
  polishedText: string;
  bulletPoints: string[];
  transcriptWords: TranscriptionWord[];
  waveformPeaks: number[];
  createdAt: string;
};

export type PracticeDraft = {
  diaryEntry: PracticeDiaryEntry;
  generationMode: GenerationMode;
  practiceGenerationId: string;
  source: 'text' | 'voice';
  status: 'draft';
  cards: PracticeDraftCard[];
  createdAt: string;
};

export type CompletedPractice = {
  diaryEntry: PracticeDiaryEntry;
  generationMode: GenerationMode;
  practiceGenerationId: string;
  source: 'text' | 'voice';
  status: 'completed';
  cards: TranslationCard[];
  createdAt: string;
};

export type TranslationCardGroup = {
  diaryEntryId: string;
  generationMode: GenerationMode;
  practiceGenerationId: string;
  source: 'text' | 'voice';
  diaryText: string;
  diaryExcerpt: string;
  createdAt: string;
  cards: TranslationCard[];
};

type TranslationCardRow = {
  id: string;
  practice_generation_id: string;
  sort_order: number;
  japanese: string;
  english: string | null;
  source_word_start_index: number | null;
  source_word_end_index: number | null;
  audio_start_sec: number | null;
  audio_end_sec: number | null;
  created_at?: string;
};

export type DiaryEntry = {
  id: string;
  source: 'text' | 'voice';
  originalText: string;
  plainText: string;
  polishedText: string;
  bulletPoints: string[];
  waveformPeaks: number[];
  createdAt: string;
};

type DiaryEntryRow = {
  id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
  polished_text: string;
  bullet_points: unknown;
  transcript_words?: unknown;
  waveform_peaks?: unknown;
  created_at: string;
};

type DiaryEntryGroupRow = {
  id: string;
  source: 'text' | 'voice';
  plain_text: string;
  created_at: string;
};

type PracticeGenerationRow = {
  id: string;
  diary_entry_id: string;
  generation_mode: GenerationMode;
  practice_generation_status?: PracticeGenerationStatus;
  created_at: string;
  updated_at?: string;
};

export type PreparePracticeDraftParams = {
  diaryText: string;
  generationMode?: GenerationMode;
  source: 'text' | 'voice';
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
  polished_text: string;
  bullet_points?: unknown;
  transcript_words?: unknown;
  waveform_peaks?: unknown;
  created_at: string;
};

type PracticeFunctionGeneration = {
  id: string;
  diary_entry_id: string;
  generation_mode: GenerationMode;
  practice_generation_status: PracticeGenerationStatus;
  created_at: string;
};

export type PreparePracticeDraftResponse = {
  diaryEntry: PracticeFunctionDiaryEntry;
  practiceGeneration: PracticeFunctionGeneration;
  cards: TranslationCardRow[];
};

export type CompletePracticeDraftParams = {
  practiceGenerationId: string;
  cards: { id: string; japanese: string }[];
};

export type CompletePracticeResponse = {
  diaryEntry: PracticeFunctionDiaryEntry;
  practiceGeneration: PracticeFunctionGeneration;
  cards: TranslationCardRow[];
};

const translationCardSelect =
  'id, practice_generation_id, sort_order, japanese, english, source_word_start_index, source_word_end_index, audio_start_sec, audio_end_sec, created_at';

export async function preparePracticeDraft({
  diaryText,
  generationMode = 'compact',
  source,
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
        diaryText,
        generationMode,
        source,
        rawTranscriptText,
        cleanedText,
        transcriptWords: source === 'voice' ? transcriptWords ?? [] : [],
        waveformPeaks: source === 'voice' ? normalizeWaveformPeaks(waveformPeaks) : [],
      },
    }
  );

  if (error) {
    throw await normalizeFunctionError(error);
  }

  if (!data?.cards?.length) {
    throw new Error('分割カードを作成できませんでした。');
  }

  return mapPracticeDraftResponse(data);
}

export async function completePracticeDraft({
  practiceGenerationId,
  cards,
}: CompletePracticeDraftParams) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke<CompletePracticeResponse>(
    'complete-practice',
    {
      body: {
        practiceGenerationId,
        cards,
      },
    }
  );

  if (error) {
    throw await normalizeFunctionError(error);
  }

  if (!data?.cards?.length) {
    throw new Error('英語カードを作成できませんでした。');
  }

  return mapCompletedPracticeResponse(data);
}

export async function getLatestPracticeDraft() {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: generationRows, error: generationError } = await supabase
    .from('practice_generations')
    .select('id, diary_entry_id, generation_mode, practice_generation_status, created_at, updated_at')
    .eq('practice_generation_status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (generationError) {
    throw generationError;
  }

  const generation = (generationRows?.[0] ?? null) as PracticeGenerationRow | null;

  if (!generation) {
    return null;
  }

  const { data: diaryEntry, error: diaryError } = await supabase
    .from('diary_entries')
    .select('id, source, original_text, plain_text, polished_text, bullet_points, transcript_words, waveform_peaks, created_at')
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
    diaryEntry: mapPracticeDiaryEntry(diaryEntry as DiaryEntryRow),
    generationMode: generation.generation_mode,
    practiceGenerationId: generation.id,
    source: (diaryEntry as DiaryEntryRow).source,
    status: 'draft',
    cards: (cards as TranslationCardRow[]).map(mapPracticeDraftCard),
    createdAt: generation.created_at,
  } satisfies PracticeDraft;
}

export async function discardPracticeDraft(practiceGenerationId: string) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: generation, error: generationError } = await supabase
    .from('practice_generations')
    .select('id, diary_entry_id, practice_generation_status')
    .eq('id', practiceGenerationId)
    .eq('practice_generation_status', 'draft')
    .maybeSingle();

  if (generationError) {
    throw generationError;
  }

  if (!generation) {
    return;
  }

  const draftGeneration = generation as { diary_entry_id: string };
  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('id', draftGeneration.diary_entry_id);

  if (error) {
    throw error;
  }
}

export async function generatePracticeFromDiary(params: PreparePracticeDraftParams) {
  const draft = await preparePracticeDraft(params);
  return completePracticeDraft({
    practiceGenerationId: draft.practiceGenerationId,
    cards: draft.cards.map((card) => ({
      id: card.id,
      japanese: card.japanese,
    })),
  });
}

function mapPracticeDraftResponse(data: PreparePracticeDraftResponse): PracticeDraft {
  return {
    diaryEntry: mapPracticeFunctionDiaryEntry(data.diaryEntry),
    generationMode: data.practiceGeneration.generation_mode,
    practiceGenerationId: data.practiceGeneration.id,
    source: data.diaryEntry.source,
    status: 'draft',
    cards: data.cards.map(mapPracticeDraftCard),
    createdAt: data.practiceGeneration.created_at,
  };
}

function mapCompletedPracticeResponse(data: CompletePracticeResponse): CompletedPractice {
  return {
    diaryEntry: mapPracticeFunctionDiaryEntry(data.diaryEntry),
    generationMode: data.practiceGeneration.generation_mode,
    practiceGenerationId: data.practiceGeneration.id,
    source: data.diaryEntry.source,
    status: 'completed',
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
    .eq('practice_generation_status', 'completed')
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
    .select('id, source, original_text, plain_text, polished_text, bullet_points, transcript_words, waveform_peaks, created_at')
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
      polishedText: normalizeDiaryBodyText(entry.polished_text),
      bulletPoints: normalizeBulletPoints(entry.bullet_points, entry.polished_text),
      waveformPeaks: normalizeWaveformPeaks(entry.waveform_peaks),
      createdAt: entry.created_at,
    }));
}

export async function listTranslationCardGroups() {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: generationRows, error: generationsError } = await supabase
    .from('practice_generations')
    .select('id, diary_entry_id, generation_mode, created_at')
    .eq('practice_generation_status', 'completed')
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
    .select('id, source, plain_text, created_at')
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

  for (const card of data ?? []) {
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

      if (!entry || cards.length === 0) {
        return null;
      }

      return {
        diaryEntryId: entry.id,
        generationMode: generation.generation_mode,
        practiceGenerationId: generation.id,
        source: entry.source,
        diaryText: normalizeDiaryBodyText(entry.plain_text),
        diaryExcerpt: createDiaryExcerpt(entry.plain_text),
        createdAt: entry.created_at,
        cards,
      };
    })
    .filter((group): group is TranslationCardGroup => group !== null);
}

async function normalizeFunctionError(error: unknown) {
  const response = isFunctionErrorWithResponse(error) ? error.context : null;

  if (response) {
    const body = await response.text().catch(() => '');
    const parsed = parseJson<{ error?: string }>(body);

    if (parsed?.error) {
      return new Error(parsed.error);
    }

    if (body) {
      return new Error(body);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('英語カードの作成に失敗しました。');
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
    createdAt: card.created_at,
  };
}

function mapPracticeFunctionDiaryEntry(entry: PracticeFunctionDiaryEntry): PracticeDiaryEntry {
  return {
    id: entry.id,
    source: entry.source,
    originalText: entry.original_text,
    plainText: normalizeDiaryBodyText(entry.plain_text),
    polishedText: normalizeDiaryBodyText(entry.polished_text),
    bulletPoints: normalizeBulletPoints(entry.bullet_points, entry.polished_text),
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
    polishedText: normalizeDiaryBodyText(entry.polished_text),
    bulletPoints: normalizeBulletPoints(entry.bullet_points, entry.polished_text),
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
