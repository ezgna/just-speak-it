import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type TranslationCard = {
  japanese: string;
  english: string;
};

type GeneratePracticeOutput = {
  cards: TranslationCard[];
};

const translationCardSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['japanese', 'english'],
        properties: {
          japanese: { type: 'string' },
          english: { type: 'string' },
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
    const cleanedText =
      typeof body?.cleanedText === 'string' && body.cleanedText.trim()
        ? body.cleanedText.trim()
        : typeof body?.diaryText === 'string'
          ? body.diaryText.trim()
          : '';
    const rawTranscriptText =
      typeof body?.rawTranscriptText === 'string' && body.rawTranscriptText.trim()
        ? body.rawTranscriptText.trim()
        : typeof body?.transcriptText === 'string' && body.transcriptText.trim()
          ? body.transcriptText.trim()
          : cleanedText;

    if (!cleanedText) {
      return errorResponse('cleanedTextが必要です。');
    }

    const output = await createOpenAIJsonResponse<GeneratePracticeOutput>({
      schemaName: 'daily_to_english_translation_cards',
      schema: translationCardSchema,
      instructions: [
        'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
        '入力は日本語の文字起こしです。まず全体の意味を理解し、英語ならどこまでを一文にするのが自然かを逆算してください。',
        '日本語の句点や話し言葉の切れ目に引きずられず、英語ネイティブが自然に言う一文ごとのカードに分けてください。',
        '各カードは japanese と english の一対一にしてください。',
        'japanese は、その english に対応する日本語の意味の塊だけを入れてください。文の途中で不自然に切らないでください。',
        'english は説明調ではなく、実際にネイティブが会話や打ち合わせで言う自然な一文にしてください。',
        'カード数に上限はありません。無理に増やさず、自然に分けられる分だけ返してください。',
      ].join('\n'),
      input: cleanedText,
      maxOutputTokens: 2400,
    });

    const cardDrafts = output.cards
      .map((card, index) => ({
        sort_order: index + 1,
        japanese: card.japanese.trim(),
        english: card.english.trim(),
      }))
      .filter((card) => card.japanese && card.english);

    if (cardDrafts.length === 0) {
      return errorResponse('英語カードを作成できませんでした。', 502);
    }

    const { data: diaryEntry, error: diaryError } = await context.supabase
      .from('diary_entries')
      .insert({
        user_id: userId,
        source: body?.source === 'text' ? 'text' : 'voice',
        raw_transcript_text: rawTranscriptText,
        cleaned_text: cleanedText,
      })
      .select('id, user_id, source, raw_transcript_text, cleaned_text, created_at')
      .single();

    if (diaryError) {
      return errorResponse(diaryError.message, 500);
    }

    const cardRows = cardDrafts.map((card) => ({
      user_id: userId,
      diary_entry_id: diaryEntry.id,
      sort_order: card.sort_order,
      japanese: card.japanese,
      english: card.english,
    }));

    const { data: cards, error: cardsError } = await context.supabase
      .from('translation_cards')
      .insert(cardRows)
      .select('id, diary_entry_id, sort_order, japanese, english, created_at')
      .order('sort_order', { ascending: true });

    if (cardsError) {
      return errorResponse(cardsError.message, 500);
    }

    if (!cards?.length) {
      return errorResponse('英語カードを保存できませんでした。', 500);
    }

    return jsonResponse({ diaryEntry, cards });
  },
};
