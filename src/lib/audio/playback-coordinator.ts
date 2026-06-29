import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

type AudioPlaybackStopper = () => Promise<void> | void;

export type AudioPlaybackLease = {
  cancel: () => void;
  finish: () => void;
  isCurrent: () => boolean;
  key: string;
  serial: number;
};

type BeginExclusivePlaybackOptions = {
  delayMs?: number;
  key: string;
  stopSpeech?: boolean;
  timeoutMs?: number;
};

const DefaultPlaybackModeTimeoutMs = 900;
const DefaultPlaybackStartDelayMs = 80;
const DefaultSpeechStopTimeoutMs = 700;

let playbackSerial = 0;
let activePlayback: { key: string; serial: number } | null = null;

const playbackStoppers = new Map<string, Set<AudioPlaybackStopper>>();

export function registerAudioPlaybackStopper(key: string, stopper: AudioPlaybackStopper) {
  const currentStoppers = playbackStoppers.get(key) ?? new Set<AudioPlaybackStopper>();
  currentStoppers.add(stopper);
  playbackStoppers.set(key, currentStoppers);

  return () => {
    const nextStoppers = playbackStoppers.get(key);

    if (!nextStoppers) {
      return;
    }

    nextStoppers.delete(stopper);

    if (nextStoppers.size === 0) {
      playbackStoppers.delete(key);
    }
  };
}

export async function beginExclusiveAudioPlayback({
  delayMs = DefaultPlaybackStartDelayMs,
  key,
  stopSpeech = true,
  timeoutMs = DefaultPlaybackModeTimeoutMs,
}: BeginExclusivePlaybackOptions): Promise<AudioPlaybackLease | null> {
  const serial = playbackSerial + 1;
  playbackSerial = serial;
  activePlayback = { key, serial };

  await stopRegisteredPlaybackExcept(key);

  if (stopSpeech) {
    await stopSpeechSafely();
  }

  await waitForPromiseOrTimeout(configureAudioForPlayback(), timeoutMs);

  if (delayMs > 0) {
    await waitForMilliseconds(delayMs);
  }

  if (!isCurrentPlayback(key, serial)) {
    return null;
  }

  return {
    cancel: () => {
      cancelAudioPlayback(key, serial);
    },
    finish: () => {
      finishAudioPlayback(key, serial);
    },
    isCurrent: () => isCurrentPlayback(key, serial),
    key,
    serial,
  };
}

export function cancelAudioPlaybackKey(key: string) {
  if (activePlayback?.key !== key) {
    return;
  }

  playbackSerial += 1;
  activePlayback = null;
}

export function configureAudioForPlayback() {
  return setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
}

export function stopSpeechSafely() {
  return waitForPromiseOrTimeout(Speech.stop(), DefaultSpeechStopTimeoutMs);
}

export function waitForMilliseconds(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function stopRegisteredPlaybackExcept(key: string) {
  const stopPromises: Promise<void>[] = [];

  for (const [registeredKey, stoppers] of playbackStoppers) {
    if (registeredKey === key) {
      continue;
    }

    for (const stopper of stoppers) {
      try {
        stopPromises.push(Promise.resolve(stopper()).catch(() => undefined));
      } catch {
        continue;
      }
    }
  }

  await Promise.all(stopPromises);
}

function cancelAudioPlayback(key: string, serial: number) {
  if (!isCurrentPlayback(key, serial)) {
    return;
  }

  playbackSerial += 1;
  activePlayback = null;
}

function finishAudioPlayback(key: string, serial: number) {
  if (!isCurrentPlayback(key, serial)) {
    return;
  }

  activePlayback = null;
}

function isCurrentPlayback(key: string, serial: number) {
  return activePlayback?.key === key && activePlayback.serial === serial;
}

async function waitForPromiseOrTimeout(promise: Promise<unknown>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      promise.catch(() => undefined),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
