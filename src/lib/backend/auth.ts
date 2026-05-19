import { isSupabaseConfigured, requireSupabaseClient } from '@/lib/supabase/client';

export type BackendSessionState =
  | { status: 'not-configured'; userId: null }
  | { status: 'ready'; userId: string };

export async function ensureAnonymousSession(): Promise<BackendSessionState> {
  if (!isSupabaseConfigured) {
    return { status: 'not-configured', userId: null };
  }

  const supabase = requireSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (sessionData.session?.user) {
    return { status: 'ready', userId: sessionData.session.user.id };
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('匿名ユーザーの作成に失敗しました。');
  }

  return { status: 'ready', userId: data.user.id };
}
