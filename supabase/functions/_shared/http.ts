import { createSupabaseContext } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js/cors';

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function optionsResponse() {
  return new Response('ok', { headers: corsHeaders });
}

export async function getAuthenticatedContext(req: Request) {
  const { data: context, error } = await createSupabaseContext(req, { auth: 'user' });

  if (error || !context) {
    return {
      context: null,
      userId: null,
      response: errorResponse('ログイン状態を確認できませんでした。', 401),
    };
  }

  const claims = context.userClaims as Record<string, unknown> | null;
  const userId =
    claims && typeof claims.id === 'string'
      ? claims.id
      : typeof claims?.sub === 'string'
        ? claims.sub
        : null;

  if (!userId) {
    return {
      context: null,
      userId: null,
      response: errorResponse('ユーザーIDを確認できませんでした。', 401),
    };
  }

  return { context, userId, response: null };
}
