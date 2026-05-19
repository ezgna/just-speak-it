import { isSupabaseConfigured, requireSupabaseClient } from '@/lib/supabase/client';

export type BackendSessionState =
  | { status: 'not-configured'; userId: null }
  | { status: 'ready'; userId: string };

export async function ensureAnonymousSession(): Promise<BackendSessionState> {
  if (!isSupabaseConfigured) {
    return { status: 'not-configured', userId: null };
  }

  const supabase = requireSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userData.user && !userError) {
    return { status: 'ready', userId: userData.user.id };
  }

  if (userError) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
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
