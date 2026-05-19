import { ensureAnonymousSession } from '@/lib/backend/auth';
import { requireSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type DiaryEntryRow = Database['public']['Tables']['diary_entries']['Row'];
type PracticeItemRow = Database['public']['Tables']['practice_items']['Row'];

export type GeneratePracticeParams = {
  diaryText: string;
  source: 'text' | 'voice';
  transcriptText?: string;
};

export type GeneratePracticeResponse = {
  diaryEntry: DiaryEntryRow;
  practiceItems: PracticeItemRow[];
};

export async function generatePracticeFromDiary({
  diaryText,
  source,
  transcriptText,
}: GeneratePracticeParams) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke<GeneratePracticeResponse>(
    'generate-practice',
    {
      body: {
        diaryText,
        source,
        transcriptText,
      },
    }
  );

  if (error) {
    throw await normalizeFunctionError(error);
  }

  if (!data?.practiceItems?.length) {
    throw new Error('練習文を作成できませんでした。');
  }

  return data;
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

  return new Error('練習文の作成に失敗しました。');
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
