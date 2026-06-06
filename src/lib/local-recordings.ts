import { Directory, File, Paths } from 'expo-file-system';

import { normalizeWaveformPeaks } from '@/lib/audio/waveform';
import { getLocalString, removeLocalValue, setLocalString } from '@/lib/local-storage';

export type LocalRecordingStatus = 'pending' | 'failed' | 'linked';
export type LocalRecordingRetention = 'persistent' | 'retry';

export type LocalRecording = {
  id: string;
  relativePath: string;
  diaryEntryId: string | null;
  durationMillis: number;
  sizeBytes: number;
  mimeType: string;
  waveformPeaks: number[];
  status: LocalRecordingStatus;
  retention: LocalRecordingRetention;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};

export type LocalRecordingStats = {
  count: number;
  sizeBytes: number;
};

const LocalRecordingIndexStorageKey = 'just-speak-it:local-recordings:v1';
const LocalRecordingSavePreferenceStorageKey = 'just-speak-it:save-local-recordings:v1';
const LocalRecordingDirectoryName = 'recordings';
const LocalRecordingDefaultExtension = '.m4a';
const LocalRecordingDefaultMimeType = 'audio/mp4';

let listeners = new Set<() => void>();

export function isLocalRecordingSupported() {
  return process.env.EXPO_OS !== 'web';
}

export function isLocalRecordingSaveEnabled() {
  const storedValue = getLocalString(LocalRecordingSavePreferenceStorageKey);
  return storedValue !== 'false';
}

export function setLocalRecordingSaveEnabled(enabled: boolean) {
  setLocalString(LocalRecordingSavePreferenceStorageKey, enabled ? 'true' : 'false');
  notifyLocalRecordingListeners();
}

export function subscribeToLocalRecordings(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function listLocalRecordings() {
  return Object.values(readLocalRecordingIndex()).sort((first, second) => {
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

export function getLocalRecordingStats(): LocalRecordingStats {
  return listLocalRecordings().reduce(
    (stats, recording) => ({
      count: stats.count + 1,
      sizeBytes: stats.sizeBytes + Math.max(0, recording.sizeBytes),
    }),
    { count: 0, sizeBytes: 0 }
  );
}

export function getLocalRecording(id: string) {
  return readLocalRecordingIndex()[id] ?? null;
}

export function getLocalRecordingUri(id: string) {
  const recording = getLocalRecording(id);

  if (!recording) {
    return null;
  }

  const file = createRecordingFile(recording.relativePath);
  return file.exists ? file.uri : null;
}

export function getLocalRecordingForDiaryEntry(diaryEntryId: string) {
  const recording = listLocalRecordings().find((candidate) => {
    return candidate.diaryEntryId === diaryEntryId && candidate.retention === 'persistent';
  });

  if (!recording) {
    return null;
  }

  const file = createRecordingFile(recording.relativePath);
  return file.exists ? recording : null;
}

export function getLocalRecordingUriForDiaryEntry(diaryEntryId: string) {
  const recording = getLocalRecordingForDiaryEntry(diaryEntryId);
  return recording ? getLocalRecordingUri(recording.id) : null;
}

export function getLatestFailedRetryRecording() {
  return (
    listLocalRecordings().find((recording) => {
      return (
        recording.retention === 'retry' &&
        recording.status === 'failed' &&
        getLocalRecordingUri(recording.id) !== null
      );
    }) ?? null
  );
}

export async function saveLocalRecordingFromUri({
  durationMillis,
  recordingUri,
  retention,
  waveformPeaks,
}: {
  durationMillis: number;
  recordingUri: string;
  retention: LocalRecordingRetention;
  waveformPeaks?: number[];
}) {
  if (!isLocalRecordingSupported()) {
    return null;
  }

  const sourceFile = new File(recordingUri);

  if (!sourceFile.exists || sourceFile.size === 0) {
    throw new Error('録音ファイルを保存できませんでした。');
  }

  const recordingsDirectory = new Directory(Paths.document, LocalRecordingDirectoryName);
  recordingsDirectory.create({ idempotent: true, intermediates: true });

  const id = createRecordingId();
  const extension = normalizeRecordingExtension(sourceFile.extension);
  const fileName = `${id}${extension}`;
  const relativePath = `${LocalRecordingDirectoryName}/${fileName}`;
  const destinationFile = new File(recordingsDirectory, fileName);

  await sourceFile.copy(destinationFile, { overwrite: true });

  const now = new Date().toISOString();
  const recording: LocalRecording = {
    id,
    relativePath,
    diaryEntryId: null,
    durationMillis: Math.max(0, Math.round(durationMillis)),
    sizeBytes: Math.max(0, destinationFile.size || sourceFile.size || 0),
    mimeType: getMimeTypeForExtension(extension),
    waveformPeaks: normalizeWaveformPeaks(waveformPeaks),
    status: 'pending',
    retention,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };

  upsertLocalRecording(recording);
  return recording;
}

export function markLocalRecordingFailed(id: string, errorMessage: string) {
  updateLocalRecording(id, {
    status: 'failed',
    lastError: errorMessage,
  });
}

export function clearLocalRecordingError(id: string) {
  updateLocalRecording(id, {
    status: 'pending',
    lastError: null,
  });
}

export async function finishLocalRecordingAfterTranscription({
  diaryEntryId,
  id,
}: {
  diaryEntryId: string | null;
  id: string;
}) {
  const recording = getLocalRecording(id);

  if (!recording) {
    return;
  }

  if (recording.retention === 'retry') {
    await deleteLocalRecording(id);
    return;
  }

  updateLocalRecording(id, {
    diaryEntryId,
    status: diaryEntryId ? 'linked' : 'pending',
    lastError: null,
  });
}

export async function deleteLocalRecording(id: string) {
  const index = readLocalRecordingIndex();
  const recording = index[id];

  if (!recording) {
    return;
  }

  delete index[id];
  writeLocalRecordingIndex(index);

  try {
    const file = createRecordingFile(recording.relativePath);

    if (file.exists) {
      file.delete();
    }
  } catch {
    return;
  } finally {
    notifyLocalRecordingListeners();
  }
}

export async function deleteAllLocalRecordings() {
  const recordings = listLocalRecordings();
  removeLocalValue(LocalRecordingIndexStorageKey);

  for (const recording of recordings) {
    try {
      const file = createRecordingFile(recording.relativePath);

      if (file.exists) {
        file.delete();
      }
    } catch {}
  }

  notifyLocalRecordingListeners();
}

function upsertLocalRecording(recording: LocalRecording) {
  const index = readLocalRecordingIndex();
  index[recording.id] = recording;
  writeLocalRecordingIndex(index);
  notifyLocalRecordingListeners();
}

function updateLocalRecording(
  id: string,
  patch: Partial<Pick<LocalRecording, 'diaryEntryId' | 'lastError' | 'status'>>
) {
  const index = readLocalRecordingIndex();
  const currentRecording = index[id];

  if (!currentRecording) {
    return;
  }

  index[id] = {
    ...currentRecording,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeLocalRecordingIndex(index);
  notifyLocalRecordingListeners();
}

function createRecordingFile(relativePath: string) {
  return new File(Paths.document, ...relativePath.split('/').filter(Boolean));
}

function readLocalRecordingIndex(): Record<string, LocalRecording> {
  const storedValue = getLocalString(LocalRecordingIndexStorageKey);

  if (!storedValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;

    if (!isRecord(parsedValue)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue).flatMap(([id, value]) => {
        const recording = normalizeLocalRecording(id, value);
        return recording ? [[id, recording]] : [];
      })
    );
  } catch {
    return {};
  }
}

function writeLocalRecordingIndex(index: Record<string, LocalRecording>) {
  const nextValue = Object.keys(index).length > 0 ? JSON.stringify(index) : null;

  if (nextValue) {
    setLocalString(LocalRecordingIndexStorageKey, nextValue);
    return;
  }

  removeLocalValue(LocalRecordingIndexStorageKey);
}

function normalizeLocalRecording(id: string, value: unknown): LocalRecording | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.relativePath !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  const status = isLocalRecordingStatus(value.status) ? value.status : 'pending';
  const retention = isLocalRecordingRetention(value.retention) ? value.retention : 'persistent';

  return {
    id,
    relativePath: value.relativePath,
    diaryEntryId: typeof value.diaryEntryId === 'string' ? value.diaryEntryId : null,
    durationMillis: typeof value.durationMillis === 'number' ? value.durationMillis : 0,
    sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : 0,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : LocalRecordingDefaultMimeType,
    waveformPeaks: normalizeWaveformPeaks(value.waveformPeaks),
    status,
    retention,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastError: typeof value.lastError === 'string' ? value.lastError : null,
  };
}

function createRecordingId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeRecordingExtension(extension: string) {
  return extension.startsWith('.') && extension.length > 1
    ? extension.toLowerCase()
    : LocalRecordingDefaultExtension;
}

function getMimeTypeForExtension(extension: string) {
  switch (extension) {
    case '.webm':
      return 'audio/webm';
    case '.3gp':
      return 'audio/3gpp';
    case '.m4a':
    default:
      return LocalRecordingDefaultMimeType;
  }
}

function isLocalRecordingStatus(value: unknown): value is LocalRecordingStatus {
  return value === 'pending' || value === 'failed' || value === 'linked';
}

function isLocalRecordingRetention(value: unknown): value is LocalRecordingRetention {
  return value === 'persistent' || value === 'retry';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function notifyLocalRecordingListeners() {
  for (const listener of listeners) {
    listener();
  }
}
