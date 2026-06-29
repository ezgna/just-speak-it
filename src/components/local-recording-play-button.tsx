import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  beginExclusiveAudioPlayback,
  cancelAudioPlaybackKey,
  registerAudioPlaybackStopper,
  type AudioPlaybackLease,
} from '@/lib/audio/playback-coordinator';
import { pauseAudioPlayerSafely, seekAudioPlayerSafely } from '@/lib/audio/player';
import {
  getLocalRecordingUriForDiaryEntry,
  isLocalRecordingSupported,
  subscribeToLocalRecordings,
} from '@/lib/local-recordings';

type LocalRecordingPlayButtonProps = {
  diaryEntryId: string;
  audioStartSec: number | null;
  audioEndSec: number | null;
  size?: number;
  iconSize?: number;
  backgroundColor?: string;
  activeBackgroundColor?: string;
  borderColor?: string;
  tintColor?: string;
  activeTintColor?: string;
  style?: StyleProp<ViewStyle>;
  onPlayStart?: () => Promise<void> | void;
};

export type LocalRecordingPlayButtonHandle = {
  stop: () => void;
};

const ClipStopToleranceSec = 0.04;
let localRecordingPlayButtonInstanceId = 0;

export const LocalRecordingPlayButton = forwardRef<
  LocalRecordingPlayButtonHandle,
  LocalRecordingPlayButtonProps
>(function LocalRecordingPlayButton(
  {
    diaryEntryId,
    audioStartSec,
    audioEndSec,
    size = 36,
    iconSize = 16,
    backgroundColor = '#FFFFFF',
    activeBackgroundColor = '#111111',
    borderColor = '#111111',
    tintColor = '#111111',
    activeTintColor = '#FFFFFF',
    style,
    onPlayStart,
  },
  ref
) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isClipActive, setIsClipActive] = useState(false);
  const [isPlaybackStarting, setIsPlaybackStarting] = useState(false);
  const activePlaybackLeaseRef = useRef<AudioPlaybackLease | null>(null);
  const instanceIdRef = useRef((localRecordingPlayButtonInstanceId += 1));
  const playbackRequestIdRef = useRef(0);
  const clipStartSec = normalizeClipBoundary(audioStartSec);
  const clipEndSec = normalizeClipBoundary(audioEndSec);
  const hasPlayableRange =
    typeof clipStartSec === 'number' &&
    typeof clipEndSec === 'number' &&
    clipEndSec > clipStartSec;
  const recordingUri =
    refreshVersion >= 0 && isLocalRecordingSupported() && hasPlayableRange
      ? getLocalRecordingUriForDiaryEntry(diaryEntryId)
      : null;
  const source = useMemo(() => (recordingUri ? { uri: recordingUri } : null), [recordingUri]);
  const sourceKey = source?.uri ?? 'none';
  const playbackKey = useMemo(
    () =>
      `local-recording:${diaryEntryId}:${sourceKey}:${clipStartSec ?? 'none'}:${clipEndSec ?? 'none'}:${instanceIdRef.current}`,
    [clipEndSec, clipStartSec, diaryEntryId, sourceKey]
  );
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const isPlaybackActive = isClipActive || isPlaybackStarting;
  const currentTintColor = isPlaybackActive ? activeTintColor : tintColor;
  const stopPlayback = useCallback(() => {
    playbackRequestIdRef.current += 1;
    activePlaybackLeaseRef.current?.cancel();
    activePlaybackLeaseRef.current = null;
    cancelAudioPlaybackKey(playbackKey);
    pauseAudioPlayerSafely(player);
    setIsClipActive(false);
    setIsPlaybackStarting(false);
  }, [playbackKey, player]);

  useImperativeHandle(
    ref,
    () => ({
      stop: stopPlayback,
    }),
    [stopPlayback]
  );

  useEffect(() => {
    return subscribeToLocalRecordings(() => {
      setRefreshVersion((currentVersion) => currentVersion + 1);
    });
  }, []);

  useEffect(() => {
    let frameId: number | null = null;

    playbackRequestIdRef.current += 1;
    activePlaybackLeaseRef.current?.cancel();
    activePlaybackLeaseRef.current = null;
    cancelAudioPlaybackKey(playbackKey);
    pauseAudioPlayerSafely(player);
    frameId = requestAnimationFrame(() => {
      setIsClipActive(false);
      setIsPlaybackStarting(false);
    });

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [playbackKey, player, sourceKey]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  useEffect(() => {
    return registerAudioPlaybackStopper(playbackKey, stopPlayback);
  }, [playbackKey, stopPlayback]);

  useEffect(() => {
    if (
      !isClipActive ||
      typeof clipStartSec !== 'number' ||
      typeof clipEndSec !== 'number'
    ) {
      return;
    }

    const hasClipEnded =
      status.didJustFinish || status.currentTime >= clipEndSec - ClipStopToleranceSec;

    if (!hasClipEnded) {
      return;
    }

    pauseAudioPlayerSafely(player);
    activePlaybackLeaseRef.current?.finish();
    activePlaybackLeaseRef.current = null;
    const frameId = requestAnimationFrame(() => {
      setIsClipActive(false);
      void seekAudioPlayerSafely(player, clipStartSec);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    clipEndSec,
    clipStartSec,
    isClipActive,
    player,
    status.currentTime,
    status.didJustFinish,
  ]);

  const handlePress = useCallback(async () => {
    if (
      !source ||
      typeof clipStartSec !== 'number' ||
      typeof clipEndSec !== 'number' ||
      clipEndSec <= clipStartSec
    ) {
      return;
    }

    if (isPlaybackActive) {
      stopPlayback();
      return;
    }

    const playbackRequestId = playbackRequestIdRef.current + 1;
    playbackRequestIdRef.current = playbackRequestId;
    setIsPlaybackStarting(true);

    try {
      await onPlayStart?.();
      const playbackLease = await beginExclusiveAudioPlayback({ key: playbackKey });

      if (!playbackLease) {
        return;
      }

      activePlaybackLeaseRef.current = playbackLease;

      if (playbackRequestIdRef.current !== playbackRequestId) {
        playbackLease.cancel();
        return;
      }

      await player.seekTo(clipStartSec);

      if (
        playbackRequestIdRef.current !== playbackRequestId ||
        !playbackLease.isCurrent()
      ) {
        playbackLease.cancel();
        return;
      }

      setIsClipActive(true);
      player.play();
    } catch {
      if (playbackRequestIdRef.current === playbackRequestId) {
        setIsClipActive(false);
        activePlaybackLeaseRef.current?.finish();
        activePlaybackLeaseRef.current = null;
      }
    } finally {
      if (playbackRequestIdRef.current === playbackRequestId) {
        setIsPlaybackStarting(false);
      }
    }
  }, [
    clipEndSec,
    clipStartSec,
    isPlaybackActive,
    onPlayStart,
    playbackKey,
    player,
    source,
    stopPlayback,
  ]);

  if (!isLocalRecordingSupported() || !source || !hasPlayableRange) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="録音の該当箇所を再生"
      accessibilityState={{ busy: isPlaybackStarting, selected: isPlaybackActive }}
      hitSlop={8}
      onPress={handlePress}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderColor,
          backgroundColor: isPlaybackActive ? activeBackgroundColor : backgroundColor,
        },
        style,
      ]}>
      <SymbolView
        name={{
          ios: isPlaybackActive ? 'pause.fill' : 'waveform',
          android: isPlaybackActive ? 'pause' : 'graphic_eq',
          web: isPlaybackActive ? 'pause' : 'graphic_eq',
        }}
        size={iconSize}
        tintColor={currentTintColor}
        fallback={
          <ThemedText style={[styles.fallbackIcon, { color: currentTintColor }]}>
            {isPlaybackActive ? '||' : '>'}
          </ThemedText>
        }
      />
    </Pressable>
  );
});

function normalizeClipBoundary(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, value);
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 2,
  },
  fallbackIcon: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: 900,
  },
});
