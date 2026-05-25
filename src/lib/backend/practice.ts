import { ensureAnonymousSession } from '@/lib/backend/auth';
import { type GenerationMode } from '@/lib/generation-mode';
import { requireSupabaseClient } from '@/lib/supabase/client';

export type TranslationCard = {
  id: string;
  practiceGenerationId: string;
  sortOrder: number;
  japanese: string;
  english: string;
  createdAt?: string;
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
  english: string;
  created_at?: string;
};

export type DiaryEntry = {
  id: string;
  source: 'text' | 'voice';
  originalText: string;
  plainText: string;
  polishedText: string;
  createdAt: string;
};

type DiaryEntryRow = {
  id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
  polished_text: string;
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
  created_at: string;
};

export type GeneratePracticeParams = {
  diaryText: string;
  generationMode?: GenerationMode;
  source: 'text' | 'voice';
  rawTranscriptText?: string;
  cleanedText?: string;
};

export type GeneratePracticeResponse = {
  diaryEntry: {
    id: string;
    source: 'text' | 'voice';
    original_text: string;
    plain_text: string;
    polished_text: string;
    created_at: string;
  };
  cards: TranslationCardRow[];
  reused?: boolean;
};

export async function generatePracticeFromDiary({
  diaryText,
  generationMode = 'natural',
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
        generationMode,
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
      practiceGenerationId: card.practice_generation_id,
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
    .select('id, source, original_text, plain_text, polished_text, created_at')
    .order('created_at', { ascending: false });

  if (entriesError) {
    throw entriesError;
  }

  return ((entries ?? []) as DiaryEntryRow[]).map((entry) => ({
    id: entry.id,
    source: entry.source,
    originalText: entry.original_text,
    plainText: normalizeDiaryBodyText(entry.plain_text),
    polishedText: normalizeDiaryBodyText(entry.polished_text),
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
    .select('id, practice_generation_id, sort_order, japanese, english, created_at')
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
    const mappedCard = mapTranslationCard(card);
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
    english: card.english,
    createdAt: card.created_at,
  };
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
