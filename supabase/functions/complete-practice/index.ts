import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type CardSplitPolicy = 'meaning_unit' | 'small_steps';
type TranslationStyle = 'native' | 'simple';
type PracticeGenerationStatus = 'draft' | 'translating' | 'completed' | 'failed';

type CompletePracticeCardInput = {
  id: string;
  japanese: string;
};

type TranslationOutputCard = {
  id: string;
  english: string;
};

type CompletePracticeOutput = {
  cards: TranslationOutputCard[];
};

type DiaryEntryRow = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  original_text: string;
  plain_text: string;
  bullet_points: unknown;
  transcript_words: unknown;
  waveform_peaks: unknown;
  content_hash: string;
  created_at: string;
  updated_at: string;
};

type PracticeGenerationRow = {
  card_split_policy: CardSplitPolicy;
  id: string;
  user_id: string;
  diary_entry_id: string;
  practice_generation_status: PracticeGenerationStatus;
  practice_generation_error: string | null;
  translation_style: TranslationStyle;
  created_at: string;
  updated_at: string;
};

type TranslationCardRow = {
  id: string;
  practice_generation_id: string;
  sort_order: number;
  japanese: string;
  english: string | null;
  source_word_start_index: number | null;
  source_word_end_index: number | null;
  audio_start_sec: number | null;
  audio_end_sec: number | null;
  created_at?: string;
};

const translationSchema = {
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
        required: ['id', 'english'],
        properties: {
          id: { type: 'string' },
          english: { type: 'string' },
        },
      },
    },
  },
};

const diaryEntrySelect =
  'id, user_id, source, original_text, plain_text, bullet_points, transcript_words, waveform_peaks, content_hash, created_at, updated_at';
const practiceGenerationSelect =
  'id, user_id, diary_entry_id, card_split_policy, translation_style, practice_generation_status, practice_generation_error, created_at, updated_at';
const translationCardSelect =
  'id, practice_generation_id, sort_order, japanese, english, source_word_start_index, source_word_end_index, audio_start_sec, audio_end_sec, created_at';

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
    const practiceGenerationId =
      typeof body?.practiceGenerationId === 'string' ? body.practiceGenerationId.trim() : '';
    const translationStyle = parseTranslationStyle(body?.translationStyle);
    const cardInputs = parseCardInputs(body?.cards);

    if (!practiceGenerationId) {
      return errorResponse('practiceGenerationIdが必要です。');
    }

    if (cardInputs.length === 0) {
      return errorResponse('英訳するカードが必要です。');
    }

    const supabase = context.supabase as any;
    const { data: practiceGeneration, error: generationFetchError } = await supabase
      .from('practice_generations')
      .select(practiceGenerationSelect)
      .eq('id', practiceGenerationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (generationFetchError) {
      return errorResponse(generationFetchError.message, 500);
    }

    if (!practiceGeneration) {
      return errorResponse('分割下書きを確認できませんでした。', 404);
    }

    const generation = practiceGeneration as PracticeGenerationRow;

    if (generation.practice_generation_status === 'completed') {
      return await returnCompletedPractice({ supabase }, generation);
    }

    if (generation.practice_generation_status !== 'draft') {
      return errorResponse('この下書きは英訳できる状態ではありません。', 409);
    }

    const existingCardsResult = await fetchPracticeGenerationCards({ supabase }, generation.id);

    if (existingCardsResult.type === 'error') {
      return errorResponse(existingCardsResult.message, 500);
    }

    const orderedCards = mergeEditedCards(existingCardsResult.cards, cardInputs);

    if (orderedCards.type === 'error') {
      return errorResponse(orderedCards.message);
    }

    const { data: claimedGeneration, error: claimError } = await supabase
      .from('practice_generations')
      .update({
        practice_generation_status: 'translating',
        practice_generation_error: null,
        translation_style: translationStyle,
      })
      .eq('id', generation.id)
      .eq('practice_generation_status', 'draft')
      .select(practiceGenerationSelect)
      .maybeSingle();

    if (claimError) {
      return errorResponse(claimError.message, 500);
    }

    if (!claimedGeneration) {
      return errorResponse('この下書きはすでに処理中です。', 409);
    }

    let output: CompletePracticeOutput;

    try {
      output = await createOpenAIJsonResponse<CompletePracticeOutput>({
        schemaName: 'daily_to_english_completed_practice',
        schema: translationSchema,
        instructions: createTranslationInstructions(translationStyle),
        input: JSON.stringify({
          cards: orderedCards.cards.map((card) => ({
            id: card.id,
            japanese: card.japanese,
          })),
        }),
        maxOutputTokens: 4200,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '英語カードの生成に失敗しました。';
      await markGenerationFailed({ supabase }, generation.id, message);
      return errorResponse(message, 502);
    }

    const translations = validateTranslations(orderedCards.cards, output.cards);

    if (translations.type === 'error') {
      await markGenerationFailed({ supabase }, generation.id, translations.message);
      return errorResponse(translations.message, 502);
    }

    for (const card of orderedCards.cards) {
      const english = translations.byId.get(card.id);

      if (!english) {
        await markGenerationFailed({ supabase }, generation.id, '英語カードの生成結果が不足しています。');
        return errorResponse('英語カードの生成結果が不足しています。', 502);
      }

      const { error: updateError } = await supabase
        .from('translation_cards')
        .update({
          japanese: card.japanese,
          english,
          ...(card.shouldClearTimestamp
            ? {
                source_word_start_index: null,
                source_word_end_index: null,
                audio_start_sec: null,
                audio_end_sec: null,
              }
            : {}),
        })
        .eq('id', card.id)
        .eq('practice_generation_id', generation.id);

      if (updateError) {
        await markGenerationFailed({ supabase }, generation.id, updateError.message);
        return errorResponse(updateError.message, 500);
      }
    }

    const { data: completedGeneration, error: completeError } = await supabase
      .from('practice_generations')
      .update({
        practice_generation_status: 'completed',
        practice_generation_error: null,
      })
      .eq('id', generation.id)
      .select(practiceGenerationSelect)
      .single();

    if (completeError || !completedGeneration) {
      await markGenerationFailed(
        { supabase },
        generation.id,
        completeError?.message ?? '英語カードを完了状態にできませんでした。'
      );
      return errorResponse(completeError?.message ?? '英語カードを完了状態にできませんでした。', 500);
    }

    return await returnCompletedPractice({ supabase }, completedGeneration as PracticeGenerationRow);
  },
};

function parseCardInputs(value: unknown): CompletePracticeCardInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((card) => {
      if (
        typeof card === 'object' &&
        card !== null &&
        'id' in card &&
        'japanese' in card &&
        typeof card.id === 'string' &&
        typeof card.japanese === 'string'
      ) {
        return {
          id: card.id.trim(),
          japanese: card.japanese.trim(),
        };
      }

      return null;
    })
    .filter((card): card is CompletePracticeCardInput => Boolean(card?.id && card.japanese));
}

async function fetchPracticeGenerationCards(
  context: { supabase: any },
  practiceGenerationId: string
) {
  const { data, error } = await context.supabase
    .from('translation_cards')
    .select(translationCardSelect)
    .eq('practice_generation_id', practiceGenerationId)
    .order('sort_order', { ascending: true });

  if (error) {
    return { type: 'error' as const, message: error.message };
  }

  return { type: 'cards' as const, cards: (data ?? []) as TranslationCardRow[] };
}

function mergeEditedCards(
  existingCards: TranslationCardRow[],
  inputCards: CompletePracticeCardInput[]
) {
  if (existingCards.length === 0) {
    return { type: 'error' as const, message: '分割カードを確認できませんでした。' };
  }

  if (existingCards.length !== inputCards.length) {
    return { type: 'error' as const, message: 'カードの枚数は変更できません。' };
  }

  const inputById = new Map(inputCards.map((card) => [card.id, card]));
  const cards = existingCards.map((card) => {
    const input = inputById.get(card.id);

    if (!input) {
      return null;
    }

    return {
      id: card.id,
      practice_generation_id: card.practice_generation_id,
      sort_order: card.sort_order,
      japanese: input.japanese,
      shouldClearTimestamp: input.japanese !== card.japanese,
    };
  });

  if (cards.some((card) => card === null)) {
    return { type: 'error' as const, message: 'カードの並びは変更できません。' };
  }

  return {
    type: 'cards' as const,
    cards: cards as {
      id: string;
      practice_generation_id: string;
      sort_order: number;
      japanese: string;
      shouldClearTimestamp: boolean;
    }[],
  };
}

function validateTranslations(
  sourceCards: { id: string }[],
  outputCards: TranslationOutputCard[]
) {
  const sourceIds = new Set(sourceCards.map((card) => card.id));
  const byId = new Map<string, string>();

  for (const card of outputCards) {
    const id = card.id.trim();
    const english = card.english.trim();

    if (!sourceIds.has(id) || !english) {
      return { type: 'error' as const, message: '英語カードの生成結果が壊れていました。' };
    }

    byId.set(id, english);
  }

  if (byId.size !== sourceCards.length) {
    return { type: 'error' as const, message: '英語カードの生成結果が不足しています。' };
  }

  return { type: 'translations' as const, byId };
}

function parseTranslationStyle(value: unknown): TranslationStyle {
  return value === 'simple' ? 'simple' : 'native';
}

async function returnCompletedPractice(
  context: { supabase: any },
  practiceGeneration: PracticeGenerationRow
) {
  const { data: diaryEntry, error: diaryError } = await context.supabase
    .from('diary_entries')
    .select(diaryEntrySelect)
    .eq('id', practiceGeneration.diary_entry_id)
    .single();

  if (diaryError || !diaryEntry) {
    return errorResponse(diaryError?.message ?? '日記を確認できませんでした。', 500);
  }

  const cards = await fetchPracticeGenerationCards(context, practiceGeneration.id);

  if (cards.type === 'error') {
    return errorResponse(cards.message, 500);
  }

  const completedCards = cards.cards.filter(
    (card) => typeof card.english === 'string' && card.english.trim().length > 0
  );

  if (completedCards.length === 0) {
    return errorResponse('英語カードを確認できませんでした。', 500);
  }

  return jsonResponse({
    diaryEntry: toPublicDiaryEntry(diaryEntry as DiaryEntryRow),
    practiceGeneration: toPublicPracticeGeneration(practiceGeneration),
    cards: completedCards,
  });
}

async function markGenerationFailed(
  context: { supabase: any },
  practiceGenerationId: string,
  message: string
) {
  await context.supabase
    .from('practice_generations')
    .update({
      practice_generation_status: 'failed',
      practice_generation_error: message,
    })
    .eq('id', practiceGenerationId);
}

function createTranslationInstructions(translationStyle: TranslationStyle) {
  const commonInstructions = [
    'あなたは日本語話者の自然な英語表現を作るネイティブ編集者です。',
    '入力は、すでに英語カード用に分割済みの日本語カード配列です。',
    'カードを結合、分割、削除、並べ替えしないでください。',
    '必ず入力と同じidを、同じカード境界のまま返してください。',
    'english は直訳や教材っぽい説明文にせず、日常会話で自然に言える一文にしてください。',
    'japanese の意味、出来事、感情、温度感を保ってください。事実や理由を新しく足さないでください。',
    '文の断片ではなく、それぞれ単独で自然に言える英語文にしてください。',
  ];

  const styleInstructions =
    translationStyle === 'simple'
      ? [
          '現在の英訳スタイルは「簡単さ優先」です。',
          '自然さは保ちつつ、基本語彙、短い文、単純な文構造を優先してください。',
          '難しいイディオム、句動詞、熟語、凝った言い換えは避け、学習者がそのまま覚えやすい表現にしてください。',
          '目安は1文12〜16語程度です。ただし意味の欠落防止が必要なら少し超えて構いません。',
        ]
      : [
          '現在の英訳スタイルは「自然さ優先」です。',
          'ネイティブが日常会話で自然によく使う語彙、句動詞、熟語、イディオム、自然な言い回しを適切に使ってください。',
          '直訳っぽさや教材っぽさを避け、少し長くなっても意味の流れとネイティブらしさを優先してください。',
        ];

  return [...commonInstructions, ...styleInstructions].join('\n');
}

function toPublicDiaryEntry(diaryEntry: DiaryEntryRow) {
  return {
    id: diaryEntry.id,
    source: diaryEntry.source,
    original_text: diaryEntry.original_text,
    plain_text: diaryEntry.plain_text,
    bullet_points: diaryEntry.bullet_points,
    transcript_words: diaryEntry.transcript_words,
    waveform_peaks: diaryEntry.waveform_peaks,
    created_at: diaryEntry.created_at,
  };
}

function toPublicPracticeGeneration(practiceGeneration: PracticeGenerationRow) {
  return {
    card_split_policy: practiceGeneration.card_split_policy,
    id: practiceGeneration.id,
    diary_entry_id: practiceGeneration.diary_entry_id,
    practice_generation_status: practiceGeneration.practice_generation_status,
    translation_style: practiceGeneration.translation_style,
    created_at: practiceGeneration.created_at,
  };
}
