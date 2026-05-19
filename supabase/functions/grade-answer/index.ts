import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type GradeAnswerOutput = {
  corrected_text: string;
  simple_text: string;
  feedback_summary: string;
  stuck_points: string[];
  score: number;
};

const gradeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['corrected_text', 'simple_text', 'feedback_summary', 'stuck_points', 'score'],
  properties: {
    corrected_text: { type: 'string' },
    simple_text: { type: 'string' },
    feedback_summary: { type: 'string' },
    stuck_points: {
      type: 'array',
      minItems: 0,
      maxItems: 4,
      items: { type: 'string' },
    },
    score: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
    },
  },
};

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

    const body = await req.json().catch(() => null);
    const practiceItemId = typeof body?.practiceItemId === 'string' ? body.practiceItemId : '';
    const answerText = typeof body?.answerText === 'string' ? body.answerText.trim() : '';
    const retryCount = Number.isFinite(body?.retryCount) ? Math.max(1, Math.floor(body.retryCount)) : 1;

    if (!practiceItemId || !answerText) {
      return errorResponse('practiceItemIdとanswerTextが必要です。');
    }

    const { data: practiceItem, error: itemError } = await context.supabase
      .from('practice_items')
      .select('id, japanese, natural_english, simple_english, pattern')
      .eq('id', practiceItemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !practiceItem) {
      return errorResponse(itemError?.message ?? '練習カードが見つかりません。', 404);
    }

    const output = await createOpenAIJsonResponse<GradeAnswerOutput>({
      schemaName: 'daily_to_english_grade',
      schema: gradeSchema,
      instructions:
        'あなたは日本語話者向けの英語添削コーチです。ユーザーの英語を自然で短く言える形に直し、次に詰まりやすい単語や構文を短く返してください。',
      input: JSON.stringify({
        japanese: practiceItem.japanese,
        targetNaturalEnglish: practiceItem.natural_english,
        targetSimpleEnglish: practiceItem.simple_english,
        reusablePattern: practiceItem.pattern,
        userAnswer: answerText,
      }),
      maxOutputTokens: 900,
    });

    const { data: answer, error: answerError } = await context.supabase
      .from('practice_answers')
      .insert({
        user_id: userId,
        practice_item_id: practiceItemId,
        answer_text: answerText,
        corrected_text: output.corrected_text,
        simple_text: output.simple_text,
        feedback_summary: output.feedback_summary,
        stuck_points: output.stuck_points,
        score: output.score,
        retry_count: retryCount,
      })
      .select('*')
      .single();

    if (answerError) {
      return errorResponse(answerError.message, 500);
    }

    const intervalDays = output.score >= 4 ? 3 : 1;
    const dueAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

    await context.supabase
      .from('review_schedules')
      .update({
        due_at: dueAt,
        interval_days: intervalDays,
        status: 'scheduled',
      })
      .eq('user_id', userId)
      .eq('practice_item_id', practiceItemId);

    return jsonResponse({ answer, nextReviewAt: dueAt });
  },
};
