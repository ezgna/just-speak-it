import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';
import { createOpenAIJsonResponse } from '../_shared/openai.ts';

type CleanTranscriptOutput = {
  cleaned_text: string;
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
    transcriptionForm.append('model', Deno.env.get('OPENAI_TRANSCRIBE_MODEL') ?? 'gpt-4o-transcribe');
    transcriptionForm.append('language', 'ja');

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
    const cleaned = await createOpenAIJsonResponse<CleanTranscriptOutput>({
      schemaName: 'daily_to_english_clean_transcript',
      schema: cleanTranscriptSchema,
      instructions: [
        'あなたは日本語の音声文字起こしを、日記として読める自然な文章に整える編集者です。',
        '「えっと」「あの」「まあ」「なんか」などの明らかなフィラー、無意味な重複、言い直しを整理してください。',
        '句読点と文の区切りを自然に補ってください。',
        '意味を足さないでください。要約しないでください。話者の意図や事実関係を変えないでください。',
        '元の話し言葉の温度感は残しつつ、読みやすい日本語にしてください。',
      ].join('\n'),
      input: rawText,
      maxOutputTokens: 2400,
    });

    const cleanedText = cleaned.cleaned_text.trim();

    if (!cleanedText) {
      return errorResponse('整形後の文字起こし結果が空でした。', 502);
    }

    return jsonResponse({ rawText, cleanedText });
  },
};
