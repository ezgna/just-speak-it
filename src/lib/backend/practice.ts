import { ensureAnonymousSession } from '@/lib/backend/auth';
import { requireSupabaseClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';

export type TranslationCard = {
  id: string;
  diaryEntryId: string;
  sortOrder: number;
  japanese: string;
  english: string;
  createdAt?: string;
};

export type TranslationCardGroup = {
  diaryEntryId: string;
  source: 'text' | 'voice';
  title: string;
  summaryPoints: string[];
  createdAt: string;
  cards: TranslationCard[];
};

type TranslationCardRow = {
  id: string;
  diary_entry_id: string;
  sort_order: number;
  japanese: string;
  english: string;
  created_at?: string;
};

export type DiaryEntry = {
  id: string;
  source: 'text' | 'voice';
  title: string;
  summaryPoints: string[];
  transcriptText: string;
  rawTranscriptText: string;
  cleanedText: string;
  createdAt: string;
  cardCount: number;
};

type DiaryEntryRow = {
  id: string;
  source: 'text' | 'voice';
  title: string;
  summary_points: Json;
  raw_transcript_text: string;
  cleaned_text: string;
  created_at: string;
};

type DiaryEntryGroupRow = {
  id: string;
  source: 'text' | 'voice';
  title: string;
  summary_points: Json;
  created_at: string;
};

type TranslationCardDiaryRow = {
  diary_entry_id: string;
};

export type GeneratePracticeParams = {
  diaryText: string;
  source: 'text' | 'voice';
  rawTranscriptText?: string;
  cleanedText?: string;
};

export type GeneratePracticeResponse = {
  diaryEntry: {
    id: string;
    source: 'text' | 'voice';
    title: string;
    summary_points: Json;
    raw_transcript_text: string;
    cleaned_text: string;
    created_at: string;
  };
  cards: TranslationCardRow[];
};

export async function generatePracticeFromDiary({
  diaryText,
  source,
  rawTranscriptText,
  cleanedText,
}: GeneratePracticeParams) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke<GeneratePracticeResponse>(
    'generate-practice',
    {
      body: {
        diaryText,
        source,
        rawTranscriptText,
        cleanedText,
      },
    }
  );

  if (error) {
    throw await normalizeFunctionError(error);
  }

  if (!data?.cards?.length) {
    throw new Error('英語カードを作成できませんでした。');
  }

  return {
    diaryEntry: data.diaryEntry,
    cards: data.cards.map((card) => ({
      id: card.id,
      diaryEntryId: card.diary_entry_id,
      sortOrder: card.sort_order,
      japanese: card.japanese,
      english: card.english,
      createdAt: card.created_at,
    })),
  };
}

export async function listDiaryEntries() {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: entries, error: entriesError } = await supabase
    .from('diary_entries')
    .select('id, source, title, summary_points, raw_transcript_text, cleaned_text, created_at')
    .order('created_at', { ascending: false });

  if (entriesError) {
    throw entriesError;
  }

  const { data: cards, error: cardsError } = await supabase
    .from('translation_cards')
    .select('diary_entry_id');

  if (cardsError) {
    throw cardsError;
  }

  const cardCountsByDiaryId = new Map<string, number>();

  for (const card of (cards ?? []) as TranslationCardDiaryRow[]) {
    const currentCount = cardCountsByDiaryId.get(card.diary_entry_id) ?? 0;
    cardCountsByDiaryId.set(card.diary_entry_id, currentCount + 1);
  }

  return ((entries ?? []) as DiaryEntryRow[]).map((entry) => ({
    id: entry.id,
    source: entry.source,
    title: normalizeDiaryTitle(entry.title),
    summaryPoints: normalizeDiarySummaryPoints(entry.summary_points),
    transcriptText: entry.cleaned_text,
    rawTranscriptText: entry.raw_transcript_text,
    cleanedText: entry.cleaned_text,
    createdAt: entry.created_at,
    cardCount: cardCountsByDiaryId.get(entry.id) ?? 0,
  }));
}

export async function listTranslationCardGroups() {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: entries, error: entriesError } = await supabase
    .from('diary_entries')
    .select('id, source, title, summary_points, created_at')
    .order('created_at', { ascending: false });

  if (entriesError) {
    throw entriesError;
  }

  const { data, error } = await supabase
    .from('translation_cards')
    .select('id, diary_entry_id, sort_order, japanese, english, created_at')
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  const cardsByDiaryId = new Map<string, TranslationCard[]>();

  for (const card of data ?? []) {
    const mappedCard = mapTranslationCard(card);
    const diaryCards = cardsByDiaryId.get(mappedCard.diaryEntryId) ?? [];
    diaryCards.push(mappedCard);
    cardsByDiaryId.set(mappedCard.diaryEntryId, diaryCards);
  }

  return ((entries ?? []) as DiaryEntryGroupRow[])
    .map((entry) => ({
      diaryEntryId: entry.id,
      source: entry.source,
      title: normalizeDiaryTitle(entry.title),
      summaryPoints: normalizeDiarySummaryPoints(entry.summary_points),
      createdAt: entry.created_at,
      cards: cardsByDiaryId.get(entry.id) ?? [],
    }))
    .filter((group) => group.cards.length > 0);
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
    diaryEntryId: card.diary_entry_id,
    sortOrder: card.sort_order,
    japanese: card.japanese,
    english: card.english,
    createdAt: card.created_at,
  };
}

function normalizeDiaryTitle(value: string) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  if (normalizedValue) {
    return normalizedValue;
  }

  return '日記の記録';
}

function normalizeDiarySummaryPoints(points: Json) {
  if (Array.isArray(points)) {
    return points
      .filter((point): point is string => typeof point === 'string')
      .map((point) => point.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  return [];
}
