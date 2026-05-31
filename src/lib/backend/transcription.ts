import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { ensureAnonymousSession } from '@/lib/backend/auth';
import { requireSupabaseClient, supabasePublishableKey, supabaseUrl } from '@/lib/supabase/client';

type TranscriptionResponse = {
  rawText: string;
  cleanedText: string;
};

export type TranscriptionComparisonSegment = {
  speaker?: string;
  start?: number;
  end?: number;
  text: string;
};

export type TranscriptionComparisonWord = {
  start?: number;
  end?: number;
  word: string;
};

export type TranscriptionComparisonResult = {
  key: 'gpt4o' | 'diarize' | 'whisper1' | 'whisper1_word';
  label: string;
  model: string;
  durationMs: number;
  text: string | null;
  segments: TranscriptionComparisonSegment[];
  words: TranscriptionComparisonWord[];
  error?: string;
};

export type TranscriptionComparisonResponse = {
  audioFileName: string;
  totalDurationMs: number;
  results: TranscriptionComparisonResult[];
};

export async function transcribeRecording(recordingUri: string) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionData.session?.access_token) {
    throw new Error('文字起こし用のログイン状態を確認できませんでした。');
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabaseの公開URLとpublishable keyが未設定です。');
  }

  const body = new FormData();
  await appendRecording(body, recordingUri, 'daily-recording');

  const request = Platform.OS === 'web' ? fetch : expoFetch;
  const response = await request(`${supabaseUrl}/functions/v1/transcribe`, {
    method: 'POST',
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body,
  });
  const responseText = await response.text();
  const data = parseJson<TranscriptionResponse & { error?: string }>(responseText);

  if (!response.ok) {
    throw new Error(data?.error ?? `文字起こしAPIが${response.status}を返しました。`);
  }

  if (!data?.cleanedText) {
    throw new Error('文字起こし結果が空でした。');
  }

  return data;
}

export async function compareTranscriptionModels(recordingUri: string) {
  await ensureAnonymousSession();

  const supabase = requireSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionData.session?.access_token) {
    throw new Error('文字起こし比較用のログイン状態を確認できませんでした。');
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabaseの公開URLとpublishable keyが未設定です。');
  }

  const body = new FormData();
  await appendRecording(body, recordingUri, 'prototype-recording');

  const request = Platform.OS === 'web' ? fetch : expoFetch;
  const response = await request(`${supabaseUrl}/functions/v1/compare-transcriptions`, {
    method: 'POST',
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body,
  });
  const responseText = await response.text();
  const data = parseJson<TranscriptionComparisonResponse & { error?: string }>(responseText);

  if (!response.ok) {
    throw new Error(data?.error ?? `文字起こし比較APIが${response.status}を返しました。`);
  }

  if (!data?.results?.length) {
    throw new Error('文字起こし比較結果が空でした。');
  }

  return data;
}

async function appendRecording(body: FormData, recordingUri: string, fileNamePrefix: string) {
  if (Platform.OS === 'web') {
    const recordingResponse = await fetch(recordingUri);
    const recordingBlob = await recordingResponse.blob();

    if (recordingBlob.size === 0) {
      throw new Error('録音ファイルが空でした。もう一度録音してください。');
    }

    body.append('audio', recordingBlob, `${fileNamePrefix}.webm`);
    return;
  }

  const recordingFile = new File(recordingUri);

  if (!recordingFile.exists || recordingFile.size === 0) {
    throw new Error('録音ファイルを読み込めませんでした。もう一度録音してください。');
  }

  body.append('audio', recordingFile, recordingFile.name || `${fileNamePrefix}.m4a`);
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
