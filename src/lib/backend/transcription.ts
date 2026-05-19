import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { ensureAnonymousSession } from '@/lib/backend/auth';
import { requireSupabaseClient, supabasePublishableKey, supabaseUrl } from '@/lib/supabase/client';

type TranscriptionResponse = {
  text: string;
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

  if (Platform.OS === 'web') {
    const recordingResponse = await fetch(recordingUri);
    const recordingBlob = await recordingResponse.blob();

    if (recordingBlob.size === 0) {
      throw new Error('録音ファイルが空でした。もう一度録音してください。');
    }

    body.append('audio', recordingBlob, 'daily-recording.webm');
  } else {
    const recordingFile = new File(recordingUri);

    if (!recordingFile.exists || recordingFile.size === 0) {
      throw new Error('録音ファイルを読み込めませんでした。もう一度録音してください。');
    }

    body.append('audio', recordingFile, recordingFile.name || 'daily-recording.m4a');
  }

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

  if (!data?.text) {
    throw new Error('文字起こし結果が空でした。');
  }

  return data.text;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
