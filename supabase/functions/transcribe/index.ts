import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';

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
    transcriptionForm.append('model', Deno.env.get('OPENAI_TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe');
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

    return jsonResponse({ text: result.text.trim() });
  },
};
