import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type PracticeItemDraft = {
  japanese: string;
  intent: string;
  natural_english: string;
  simple_english: string;
  pattern_label: string;
  pattern: string;
  short_phrase: string;
  stuck_points: string[];
};

type GeneratePracticeOutput = {
  items: PracticeItemDraft[];
};

const practiceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'japanese',
          'intent',
          'natural_english',
          'simple_english',
          'pattern_label',
          'pattern',
          'short_phrase',
          'stuck_points',
        ],
        properties: {
          japanese: { type: 'string' },
          intent: { type: 'string' },
          natural_english: { type: 'string' },
          simple_english: { type: 'string' },
          pattern_label: { type: 'string' },
          pattern: { type: 'string' },
          short_phrase: { type: 'string' },
          stuck_points: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
        },
      },
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
    const diaryText = typeof body?.diaryText === 'string' ? body.diaryText.trim() : '';

    if (!diaryText) {
      return errorResponse('diaryTextが必要です。');
    }

    const output = await createOpenAIJsonResponse<GeneratePracticeOutput>({
      schemaName: 'daily_to_english_practice',
      schema: practiceSchema,
      instructions:
        'あなたは日本語話者向けの英語学習コーチです。日本語の日記から、英語で言える価値が高い文を5個だけ抽出してください。丸ごと翻訳ではなく、会話で再利用できる単位に分けてください。',
      input: diaryText,
    });

    const { data: diaryEntry, error: diaryError } = await context.supabase
      .from('diary_entries')
      .insert({
        user_id: userId,
        source: body?.source === 'voice' ? 'voice' : 'text',
        original_text: diaryText,
        transcript_text: typeof body?.transcriptText === 'string' ? body.transcriptText : null,
      })
      .select('id, user_id, source, original_text, transcript_text, created_at')
      .single();

    if (diaryError) {
      return errorResponse(diaryError.message, 500);
    }

    const itemRows = output.items.map((item, index) => ({
      user_id: userId,
      diary_entry_id: diaryEntry.id,
      japanese: item.japanese,
      intent: item.intent,
      natural_english: item.natural_english,
      simple_english: item.simple_english,
      pattern_label: item.pattern_label,
      pattern: item.pattern,
      short_phrase: item.short_phrase,
      stuck_points: item.stuck_points,
      sort_order: index + 1,
    }));

    const { data: practiceItems, error: itemsError } = await context.supabase
      .from('practice_items')
      .insert(itemRows)
      .select('*');

    if (itemsError) {
      return errorResponse(itemsError.message, 500);
    }

    const firstDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const reviewRows = practiceItems.map((item: { id: string }) => ({
      user_id: userId,
      practice_item_id: item.id,
      due_at: firstDueAt,
    }));

    const { error: reviewError } = await context.supabase.from('review_schedules').insert(reviewRows);

    if (reviewError) {
      return errorResponse(reviewError.message, 500);
    }

    return jsonResponse({ diaryEntry, practiceItems });
  },
};
