import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type CleanTranscriptOutput = {
  cleaned_text: string;
};

type TranscriptWord = {
  index: number;
  word: string;
  start: number;
  end: number;
};

const cleanTranscriptSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cleaned_text'],
  properties: {
    cleaned_text: { type: 'string' },
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

    const { response } = await getAuthenticatedContext(req);

    if (response) {
      return response;
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      return errorResponse('OPENAI_API_KEYが未設定です。', 500);
    }

    const formData = await req.formData();
    const audio = formData.get('audio');

    if (!(audio instanceof File)) {
      return errorResponse('audioファイルが必要です。');
    }

    const transcriptionForm = new FormData();
    transcriptionForm.append('file', audio, audio.name || 'daily-recording.m4a');
    transcriptionForm.append('model', 'whisper-1');
    transcriptionForm.append('language', 'ja');
    transcriptionForm.append('response_format', 'verbose_json');
    transcriptionForm.append('timestamp_granularities[]', 'word');

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: transcriptionForm,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      return errorResponse(`OpenAI文字起こしに失敗しました: ${errorText}`, 502);
    }

    const result = await transcriptionResponse.json();

    if (typeof result.text !== 'string' || !result.text.trim()) {
      return errorResponse('文字起こし結果が空でした。', 502);
    }

    const rawText = result.text.trim();
    const words = readTranscriptWords(result);
    const cleaned = await createOpenAIJsonResponse<CleanTranscriptOutput>({
      schemaName: 'daily_to_english_clean_transcript',
      schema: cleanTranscriptSchema,
      instructions: [
        'あなたは日本語の音声文字起こしを、日記として読めて、英語カード生成の土台にも使える自然な文章に整える編集者です。',
        '「えー」「えっと」「あの」「うーん」「まあ」「なんか」「その」「こう」「ていうか」などの明らかなフィラー、口癖、間つなぎは削除してください。',
        '「さ」「ね」「じゃん」などの話し言葉の語尾も、意味や温度感に必要ない場合は読みやすい文に整えてください。',
        '無意味な重複、言い直し、話し始めの迷いは整理してください。',
        '句読点と文の区切りを自然に補ってください。',
        '日本語として不自然な助詞、語順、主語と述語のつながり、途中で崩れた文は、元の意味を保ったまま自然な日本語に直してください。',
        '直訳調、文字起こし調、話し始めたまま終わっている文は、話者の意図が変わらない範囲で整えてください。',
        '明らかな誤字、脱字、音声認識の聞き間違いは、文脈から高い確度で判断できる場合だけ修正してください。',
        '意味を足さないでください。要約しないでください。話者の意図や事実関係を変えないでください。',
        '差別的、攻撃的、露骨、乱暴、断定的な表現でも、それが話者の意味や感情なら検閲、省略、伏せ字、婉曲化、道徳的な修正をしないでください。',
        '曖昧な内容を推測で補わないでください。固有名詞、数字、時系列、感情の強さは変えないでください。',
        '元の話し言葉の温度感は残しつつ、読みやすい日本語にしてください。',
      ].join('\n'),
      input: rawText,
      maxOutputTokens: 8000,
    });

    const cleanedText = cleaned.cleaned_text.trim();

    if (!cleanedText) {
      return errorResponse('整形後の文字起こし結果が空でした。', 502);
    }

    return jsonResponse({ rawText, cleanedText, words });
  },
};

function readTranscriptWords(payload: unknown): TranscriptWord[] {
  if (!isRecord(payload) || !Array.isArray(payload.words)) {
    return [];
  }

  return payload.words.flatMap((word, index) => {
    if (!isRecord(word)) {
      return [];
    }

    const text =
      typeof word.word === 'string'
        ? word.word
        : typeof word.text === 'string'
          ? word.text
          : null;

    if (
      !text?.trim() ||
      typeof word.start !== 'number' ||
      typeof word.end !== 'number'
    ) {
      return [];
    }

    return {
      index,
      word: text.trim(),
      start: word.start,
      end: word.end,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
