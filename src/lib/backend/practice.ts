import { ensureAnonymousSession } from '@/lib/backend/auth';
import { requireSupabaseClient } from '@/lib/supabase/client';

export type TranslationCard = {
  id: string;
  diaryEntryId: string;
  sortOrder: number;
  japanese: string;
  english: string;
  createdAt?: string;
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
  transcriptText: string;
  rawTranscriptText: string;
  cleanedText: string;
  createdAt: string;
  cards: TranslationCard[];
};

type DiaryEntryRow = {
  id: string;
  source: 'text' | 'voice';
  raw_transcript_text: string;
  cleaned_text: string;
  created_at: string;
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
    .select('id, source, raw_transcript_text, cleaned_text, created_at')
    .order('created_at', { ascending: false });

  if (entriesError) {
    throw entriesError;
  }

  const { data: cards, error: cardsError } = await supabase
    .from('translation_cards')
    .select('id, diary_entry_id, sort_order, japanese, english, created_at')
    .order('sort_order', { ascending: true });

  if (cardsError) {
    throw cardsError;
  }

  const cardsByDiaryId = new Map<string, TranslationCard[]>();

  for (const card of cards ?? []) {
    const mappedCard = mapTranslationCard(card);
    const diaryCards = cardsByDiaryId.get(mappedCard.diaryEntryId) ?? [];
    diaryCards.push(mappedCard);
    cardsByDiaryId.set(mappedCard.diaryEntryId, diaryCards);
  }

  return ((entries ?? []) as DiaryEntryRow[]).map((entry) => ({
    id: entry.id,
    source: entry.source,
    transcriptText: entry.cleaned_text,
    rawTranscriptText: entry.raw_transcript_text,
    cleanedText: entry.cleaned_text,
    createdAt: entry.created_at,
    cards: cardsByDiaryId.get(entry.id) ?? [],
  }));
}

export async function listTranslationCards() {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('translation_cards')
    .select('id, diary_entry_id, sort_order, japanese, english, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapTranslationCard);
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
