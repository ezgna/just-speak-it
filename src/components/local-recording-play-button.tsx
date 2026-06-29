import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
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
  onPlayStart?: () => void;
};

export type LocalRecordingPlayButtonHandle = {
  stop: () => void;
};

const ClipStopToleranceSec = 0.04;

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
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const isPlaying = isClipActive && status.playing;
  const currentTintColor = isPlaying ? activeTintColor : tintColor;
  const stopPlayback = useCallback(() => {
    pauseAudioPlayerSafely(player);
    setIsClipActive(false);
  }, [player]);

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

    pauseAudioPlayerSafely(player);
    frameId = requestAnimationFrame(() => {
      setIsClipActive(false);
    });

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [player, sourceKey]);

  useEffect(() => {
    return () => {
      pauseAudioPlayerSafely(player);
    };
  }, [player]);

  useEffect(() => {
    if (
      !isClipActive ||
      typeof clipStartSec !== 'number' ||
      typeof clipEndSec !== 'number'
    ) {
      return;
    }

    if (
      !status.playing ||
      (status.currentTime < clipEndSec - ClipStopToleranceSec && !status.didJustFinish)
    ) {
      return;
    }

    pauseAudioPlayerSafely(player);
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
    status.playing,
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

    if (isPlaying) {
      stopPlayback();
      return;
    }

    try {
      await player.seekTo(clipStartSec);
      onPlayStart?.();
      setIsClipActive(true);
      player.play();
    } catch {
      setIsClipActive(false);
    }
  }, [clipEndSec, clipStartSec, isPlaying, onPlayStart, player, source, stopPlayback]);

  if (!isLocalRecordingSupported() || !source || !hasPlayableRange) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="録音の該当箇所を再生"
      accessibilityState={{ selected: isPlaying }}
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderColor,
          backgroundColor: isPlaying ? activeBackgroundColor : backgroundColor,
          opacity: pressed ? 0.72 : 1,
        },
        style,
      ]}>
      <SymbolView
        name={{
          ios: isPlaying ? 'pause.fill' : 'waveform',
          android: isPlaying ? 'pause' : 'graphic_eq',
          web: isPlaying ? 'pause' : 'graphic_eq',
        }}
        size={iconSize}
        tintColor={currentTintColor}
        fallback={
          <ThemedText style={[styles.fallbackIcon, { color: currentTintColor }]}>
            {isPlaying ? '||' : '>'}
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
