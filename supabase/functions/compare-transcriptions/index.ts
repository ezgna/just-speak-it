import { errorResponse, getAuthenticatedContext, jsonResponse, optionsResponse } from '../_shared/http.ts';

type ComparisonKey = 'gpt4o' | 'diarize' | 'whisper1' | 'whisper1_word';

type ComparisonConfig = {
  key: ComparisonKey;
  label: string;
  model: string;
  configure: (formData: FormData) => void;
};

type TranscriptSegment = {
  speaker?: string;
  start?: number;
  end?: number;
  text: string;
};

type TranscriptWord = {
  start?: number;
  end?: number;
  word: string;
};

const ComparisonConfigs: ComparisonConfig[] = [
  {
    key: 'gpt4o',
    label: 'GPT-4o Transcribe',
    model: 'gpt-4o-transcribe',
    configure: () => undefined,
  },
  {
    key: 'diarize',
    label: 'GPT-4o Diarize / refsなし',
    model: 'gpt-4o-transcribe-diarize',
    configure: (formData) => {
      formData.append('response_format', 'diarized_json');
      formData.append('chunking_strategy', 'auto');
    },
  },
  {
    key: 'whisper1',
    label: 'Whisper-1 / segment',
    model: 'whisper-1',
    configure: (formData) => {
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');
    },
  },
  {
    key: 'whisper1_word',
    label: 'Whisper-1 / word',
    model: 'whisper-1',
    configure: (formData) => {
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');
    },
  },
];

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

    const audioBytes = await audio.arrayBuffer();

    if (audioBytes.byteLength === 0) {
      return errorResponse('録音ファイルが空でした。');
    }

    const audioFileName = audio.name || 'prototype-recording.m4a';
    const audioType = audio.type || 'audio/mp4';
    const startedAt = performance.now();
    const results = await Promise.all(
      ComparisonConfigs.map((config) =>
        transcribeWithModel({
          apiKey,
          audioBytes,
          audioFileName,
          audioType,
          config,
        })
      )
    );
    const totalDurationMs = Math.round(performance.now() - startedAt);

    return jsonResponse({
      audioFileName,
      totalDurationMs,
      results,
    });
  },
};

async function transcribeWithModel({
  apiKey,
  audioBytes,
  audioFileName,
  audioType,
  config,
}: {
  apiKey: string;
  audioBytes: ArrayBuffer;
  audioFileName: string;
  audioType: string;
  config: ComparisonConfig;
}) {
  const startedAt = performance.now();
  const transcriptionForm = new FormData();
  const audio = new File([audioBytes], audioFileName, { type: audioType });

  transcriptionForm.append('file', audio, audioFileName);
  transcriptionForm.append('model', config.model);
  transcriptionForm.append('language', 'ja');
  config.configure(transcriptionForm);

  try {
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: transcriptionForm,
    });
    const durationMs = Math.round(performance.now() - startedAt);
    const responseText = await transcriptionResponse.text();

    if (!transcriptionResponse.ok) {
      return {
        key: config.key,
        label: config.label,
        model: config.model,
        durationMs,
        text: null,
        segments: [],
        words: [],
        error: `OpenAI文字起こしに失敗しました: ${responseText}`,
      };
    }

    const payload = parseJson(responseText);
    const text = readTranscriptText(payload);

    return {
      key: config.key,
      label: config.label,
      model: config.model,
      durationMs,
      text,
      segments: readTranscriptSegments(payload),
      words: readTranscriptWords(payload),
    };
  } catch (error) {
    return {
      key: config.key,
      label: config.label,
      model: config.model,
      durationMs: Math.round(performance.now() - startedAt),
      text: null,
      segments: [],
      words: [],
      error: error instanceof Error ? error.message : '文字起こしに失敗しました。',
    };
  }
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readTranscriptText(payload: Record<string, unknown> | null) {
  if (!payload) {
    return null;
  }

  if (typeof payload.text === 'string') {
    return payload.text.trim() || null;
  }

  const segments = readTranscriptSegments(payload);
  const text = segments
    .map((segment) => segment.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  return text || null;
}

function readTranscriptSegments(payload: Record<string, unknown> | null): TranscriptSegment[] {
  if (!payload || !Array.isArray(payload.segments)) {
    return [];
  }

  return payload.segments.flatMap((segment) => {
    if (!isRecord(segment) || typeof segment.text !== 'string') {
      return [];
    }

    return {
      speaker: typeof segment.speaker === 'string' ? segment.speaker : undefined,
      start: typeof segment.start === 'number' ? segment.start : undefined,
      end: typeof segment.end === 'number' ? segment.end : undefined,
      text: segment.text.trim(),
    };
  });
}

function readTranscriptWords(payload: Record<string, unknown> | null): TranscriptWord[] {
  if (!payload || !Array.isArray(payload.words)) {
    return [];
  }

  return payload.words.flatMap((word) => {
    if (!isRecord(word)) {
      return [];
    }

    const text =
      typeof word.word === 'string'
        ? word.word
        : typeof word.text === 'string'
          ? word.text
          : null;

    if (!text?.trim()) {
      return [];
    }

    return {
      start: typeof word.start === 'number' ? word.start : undefined,
      end: typeof word.end === 'number' ? word.end : undefined,
      word: text.trim(),
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
