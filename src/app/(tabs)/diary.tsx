import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemedText } from '@/components/themed-text';
import { FoundationSurface } from '@/components/ui/foundation-surface';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { pauseAudioPlayerSafely } from '@/lib/audio/player';
import { createDisplayWaveformPeaks } from '@/lib/audio/waveform';
import { listDiaryEntries, type DiaryEntry } from '@/lib/backend/practice';
import {
  getLocalRecordingUriForDiaryEntry,
  isLocalRecordingSupported,
  subscribeToLocalRecordings,
} from '@/lib/local-recordings';
import { getLocalString, setLocalString } from '@/lib/local-storage';
import { subscribeToPracticeRefresh } from '@/lib/practice-refresh';

type LoadMode = 'initial' | 'refresh' | 'sync';
type DiaryDisplayMode = 'original' | 'plain' | 'bullets';

const DiaryDisplayModeOptions: { label: string; value: DiaryDisplayMode }[] = [
  { label: '原文', value: 'original' },
  { label: '本文', value: 'plain' },
  { label: '箇条書き', value: 'bullets' },
];

const DiaryDisplayModeStorageKey = 'just-speak-it:diary-display-mode:v1';
const DefaultDiaryDisplayMode: DiaryDisplayMode = 'plain';

function isDiaryDisplayMode(value: string | null): value is DiaryDisplayMode {
  return (
    value === 'original' ||
    value === 'plain' ||
    value === 'bullets'
  );
}

const DiaryColors = {
  accent: '#276EF1',
  bodyText: '#111111',
  error: '#E8664F',
  paper: '#F8F6EF',
  foundation: '#D9E7E1',
  voiceAccent: '#168A73',
  voiceAccentDark: '#11705F',
  voiceAccentSoft: '#DDF3E8',
  voiceAccentMuted: '#8CD6BD',
  voiceDisabled: '#E7ECEF',
  voicePaper: '#EAF8F0',
  voiceProgress: '#168A73',
  voiceRule: '#C5E7DA',
  voiceSurface: '#FFFFFF',
  voiceText: '#102018',
  voiceWarm: '#FFFFFF',
} as const;

const CoralFoundationOffset = 7;

export default function DiaryScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const isMountedRef = useRef(false);
  const isLoadingEntriesRef = useRef(false);
  const shouldSyncAfterCurrentLoadRef = useRef(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queuedSyncVersion, setQueuedSyncVersion] = useState(0);
  const [displayMode, setDisplayMode] = useState<DiaryDisplayMode>(() => {
    const storedMode = getLocalString(DiaryDisplayModeStorageKey);
    return isDiaryDisplayMode(storedMode) ? storedMode : DefaultDiaryDisplayMode;
  });
  const [isWaveformScrubbing, setIsWaveformScrubbing] = useState(false);

  const handleDisplayModeChange = useCallback((nextMode: DiaryDisplayMode) => {
    setDisplayMode(nextMode);
    setLocalString(DiaryDisplayModeStorageKey, nextMode);
  }, []);

  const loadEntries = useCallback(async (mode: LoadMode = 'initial') => {
    if (isLoadingEntriesRef.current) {
      if (mode !== 'initial') {
        shouldSyncAfterCurrentLoadRef.current = true;
      }
      return;
    }

    isLoadingEntriesRef.current = true;
    const shouldShowInitialLoading = mode === 'initial';

    try {
      await Promise.resolve();

      if (!isMountedRef.current) {
        return;
      }

      if (shouldShowInitialLoading) {
        setIsInitialLoading(true);
      }
      if (mode === 'refresh') {
        setIsRefreshing(true);
      }

      setErrorMessage(null);

      const nextEntries = await listDiaryEntries();
      if (!isMountedRef.current) {
        return;
      }

      setEntries(nextEntries);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '日記を読み込めませんでした。');
    } finally {
      isLoadingEntriesRef.current = false;

      if (!isMountedRef.current) {
        return;
      }

      if (shouldShowInitialLoading) {
        setIsInitialLoading(false);
      }
      if (mode === 'refresh') {
        setIsRefreshing(false);
      }

      const shouldRunQueuedSync = shouldSyncAfterCurrentLoadRef.current;
      shouldSyncAfterCurrentLoadRef.current = false;

      if (shouldRunQueuedSync) {
        setQueuedSyncVersion((currentVersion) => currentVersion + 1);
      }
    }
  }, []);

  const refreshEntries = useCallback(() => {
    void loadEntries('refresh');
  }, [loadEntries]);

  useEffect(() => {
    isMountedRef.current = true;
    const timeoutId = setTimeout(() => {
      void loadEntries('initial');
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      shouldSyncAfterCurrentLoadRef.current = false;
    };
  }, [loadEntries]);

  useEffect(() => {
    return subscribeToPracticeRefresh(() => {
      void loadEntries('sync');
    });
  }, [loadEntries]);

  useEffect(() => {
    if (queuedSyncVersion === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void loadEntries('sync');
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadEntries, queuedSyncVersion]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: palette.background }]}
      scrollEnabled={!isWaveformScrubbing}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: safeAreaInsets.top + TopTabInset + Spacing.two,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refreshEntries} tintColor={palette.primary} />
      }>
      <View style={styles.container}>
        {isInitialLoading && entries.length === 0 && (
          <DiaryStatePaper>
            <ActivityIndicator color={DiaryColors.accent} />
            <ThemedText style={styles.stateText} selectable>
              日記を読み込んでいます。
            </ThemedText>
          </DiaryStatePaper>
        )}

        {!isInitialLoading && entries.length === 0 && !errorMessage && (
          <DiaryStatePaper>
            <ThemedText style={styles.stateText} selectable>
              まだ積まれた日記はありません。
            </ThemedText>
          </DiaryStatePaper>
        )}

        {errorMessage && entries.length === 0 && (
          <View style={styles.centerState}>
            <View style={styles.statePanel}>
              <ThemedText style={styles.stateTitle} selectable>
                読み込めませんでした
              </ThemedText>
              <ThemedText style={styles.stateDescription} selectable>
                {errorMessage}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                disabled={isRefreshing}
                onPress={refreshEntries}
                style={({ pressed }) => [
                  styles.retryButton,
                  { opacity: isRefreshing ? 0.5 : pressed ? 0.74 : 1 },
                ]}>
                <ThemedText style={styles.retryButtonText}>
                  再読み込み
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {errorMessage && entries.length > 0 && (
          <View style={styles.errorBanner}>
            <ThemedText type="smallBold" style={styles.errorText} selectable>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        {entries.length > 0 && (
          <View style={styles.diaryPaperList}>
            <DiaryModeSwitch value={displayMode} onChange={handleDisplayModeChange} />
            {entries.map((entry) => (
              <DiaryPaper
                key={entry.id}
                entry={entry}
                displayMode={displayMode}
                onWaveformScrubbingChange={setIsWaveformScrubbing}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function DiaryModeSwitch({
  value,
  onChange,
}: {
  value: DiaryDisplayMode;
  onChange: (value: DiaryDisplayMode) => void;
}) {
  return (
    <View style={styles.modeSwitch} accessibilityRole="radiogroup">
      {DiaryDisplayModeOptions.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.modeButton,
              index > 0 && styles.modeButtonDivider,
              isSelected && styles.modeButtonSelected,
              pressed && styles.modeButtonPressed,
            ]}>
            <ThemedText
              style={[
                styles.modeButtonText,
                isSelected && styles.modeButtonTextSelected,
              ]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DiaryPaper({
  entry,
  displayMode,
  onWaveformScrubbingChange,
}: {
  entry: DiaryEntry;
  displayMode: DiaryDisplayMode;
  onWaveformScrubbingChange: (isScrubbing: boolean) => void;
}) {
  if (displayMode === 'bullets') {
    return (
      <View style={styles.diaryOriginalEntry}>
        <View style={styles.diaryOriginalRail} />
        <View style={styles.diaryOriginalContent}>
          <ThemedText style={[styles.diaryPaperDate, styles.diaryOriginalDate]} selectable>
            {formatDate(entry.createdAt)}
          </ThemedText>
          <DiaryBulletList points={entry.bulletPoints} />
        </View>
      </View>
    );
  }

  if (displayMode === 'original' || displayMode === 'plain') {
    const bodyStyles: StyleProp<TextStyle> =
      displayMode === 'plain'
        ? [styles.diaryPaperBody, styles.diaryPaperBodyReadable, styles.diaryPaperBodyReadableOnMint]
        : [styles.diaryPaperBody, styles.diaryPaperBodyRaw];

    return (
      <View style={styles.diaryOriginalEntry}>
        <View style={styles.diaryOriginalRail} />
        <View style={styles.diaryOriginalContent}>
          <ThemedText style={[styles.diaryPaperDate, styles.diaryOriginalDate]} selectable>
            {formatDate(entry.createdAt)}
          </ThemedText>
          {displayMode === 'original' && (
            <DiaryWaveform
              diaryEntryId={entry.id}
              peaks={entry.waveformPeaks}
              onScrubbingChange={onWaveformScrubbingChange}
            />
          )}
          <ThemedText
            style={bodyStyles}
            selectable>
            {getDiaryDisplayText(entry, displayMode)}
          </ThemedText>
        </View>
      </View>
    );
  }

  return null;
}

function DiaryWaveform({
  diaryEntryId,
  peaks,
  onScrubbingChange,
}: {
  diaryEntryId: string;
  peaks: number[];
  onScrubbingChange: (isScrubbing: boolean) => void;
}) {
  const visiblePeaks = createDisplayWaveformPeaks(peaks, 30);
  const waveformRef = useRef<View>(null);
  const scrubPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [waveformWidth, setWaveformWidth] = useState(0);
  const [scrubPreviewSec, setScrubPreviewSec] = useState<number | null>(null);
  const recordingUri =
    refreshVersion >= 0 && visiblePeaks.length > 0 && isLocalRecordingSupported()
      ? getLocalRecordingUriForDiaryEntry(diaryEntryId)
      : null;
  const source = useMemo(() => (recordingUri ? { uri: recordingUri } : null), [recordingUri]);
  const sourceKey = source?.uri ?? 'none';
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const isPlayable = Boolean(source);
  const isPlaying = isPlayable && status.playing;
  const durationSec = Number.isFinite(status.duration) ? status.duration : 0;
  const statusCurrentTimeSec = Number.isFinite(status.currentTime) ? status.currentTime : 0;
  const currentTimeSec = scrubPreviewSec ?? statusCurrentTimeSec;
  const playbackProgress =
    isPlayable && durationSec > 0
      ? Math.min(1, Math.max(0, currentTimeSec / durationSec))
      : 0;
  const hasPlaybackProgress = isPlayable && (isPlaying || playbackProgress > 0 || scrubPreviewSec !== null);
  const timeLabel = isPlayable ? formatWaveformTime(currentTimeSec) : null;

  useEffect(() => {
    return subscribeToLocalRecordings(() => {
      setRefreshVersion((currentVersion) => currentVersion + 1);
    });
  }, []);

  useEffect(() => {
    pauseAudioPlayerSafely(player);

    return () => {
      onScrubbingChange(false);
      if (scrubPreviewTimeoutRef.current) {
        clearTimeout(scrubPreviewTimeoutRef.current);
      }
      pauseAudioPlayerSafely(player);
    };
  }, [onScrubbingChange, player, sourceKey]);

  const scheduleScrubPreviewClear = useCallback(() => {
    if (scrubPreviewTimeoutRef.current) {
      clearTimeout(scrubPreviewTimeoutRef.current);
    }

    scrubPreviewTimeoutRef.current = setTimeout(() => {
      scrubPreviewTimeoutRef.current = null;
      setScrubPreviewSec(null);
    }, 260);
  }, []);

  const handlePlayButtonPress = useCallback(async () => {
    if (!source) {
      return;
    }

    if (isPlaying) {
      setScrubPreviewSec(null);
      pauseAudioPlayerSafely(player);
      return;
    }

    try {
      const currentTime = Number.isFinite(status.currentTime) ? status.currentTime : 0;
      const shouldRestart = durationSec > 0 && currentTime >= durationSec - 0.08;

      if (shouldRestart) {
        await player.seekTo(0);
      }

      setScrubPreviewSec(null);
      player.play();
    } catch {
      pauseAudioPlayerSafely(player);
    }
  }, [durationSec, isPlaying, player, source, status.currentTime]);

  const handleWaveformLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setWaveformWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  const seekToWaveformPosition = useCallback(
    async (relativeX: number, width: number) => {
      if (!source || durationSec <= 0) {
        return;
      }

      const resolvedWidth = width > 0 ? width : waveformWidth;
      if (resolvedWidth <= 0) {
        return;
      }

      const progress = Math.min(1, Math.max(0, relativeX / resolvedWidth));
      const nextTimeSec = durationSec * progress;
      setScrubPreviewSec(nextTimeSec);
      scheduleScrubPreviewClear();

      try {
        await player.seekTo(nextTimeSec);
      } catch {
        pauseAudioPlayerSafely(player);
      }
    },
    [durationSec, player, scheduleScrubPreviewClear, source, waveformWidth]
  );

  const handleWaveformPress = useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, pageX } = event.nativeEvent;

      if (!waveformRef.current) {
        void seekToWaveformPosition(locationX, waveformWidth);
        return;
      }

      waveformRef.current.measureInWindow((x, _y, width) => {
        const measuredWidth = width > 0 ? width : waveformWidth;
        const relativeX = Number.isFinite(pageX) && width > 0 ? pageX - x : locationX;
        void seekToWaveformPosition(relativeX, measuredWidth);
      });
    },
    [seekToWaveformPosition, waveformWidth]
  );

  const handleWaveformPressIn = useCallback(() => {
    onScrubbingChange(true);
  }, [onScrubbingChange]);

  const handleWaveformPressOut = useCallback(() => {
    onScrubbingChange(false);
  }, [onScrubbingChange]);

  const shouldKeepWaveformResponder = useCallback(() => isPlayable, [isPlayable]);

  if (visiblePeaks.length === 0) {
    return null;
  }

  const waveformBarsContent = (
    <>
      {visiblePeaks.map((peak, index) => (
        <View
          key={`${index}-${peak}`}
          style={[
            styles.diaryWaveformBar,
            {
              height: 8 + peak * 42,
              opacity: 0.62 + peak * 0.38,
              backgroundColor:
                hasPlaybackProgress &&
                index / Math.max(1, visiblePeaks.length - 1) <= playbackProgress
                  ? DiaryColors.voiceProgress
                  : DiaryColors.voiceAccentMuted,
            },
          ]}
        />
      ))}
    </>
  );
  const waveformBars = isPlayable ? (
    <Pressable
      ref={waveformRef}
      accessibilityRole="button"
      accessibilityLabel="録音の再生位置を移動"
      delayLongPress={260}
      hitSlop={8}
      onLayout={handleWaveformLayout}
      onLongPress={handleWaveformPress}
      onPress={handleWaveformPress}
      onPressIn={handleWaveformPressIn}
      onPressMove={handleWaveformPress}
      onPressOut={handleWaveformPressOut}
      onMoveShouldSetResponder={shouldKeepWaveformResponder}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={shouldKeepWaveformResponder}
      style={styles.diaryWaveformBars}>
      {waveformBarsContent}
    </Pressable>
  ) : (
    <View style={styles.diaryWaveformBars}>{waveformBarsContent}</View>
  );
  const playIconColor = !isPlayable
    ? '#7A8790'
    : DiaryColors.voiceAccentDark;
  const playerContent = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? '録音の再生を一時停止' : '録音を再生'}
        accessibilityState={{ disabled: !isPlayable, selected: isPlaying }}
        disabled={!isPlayable}
        hitSlop={8}
        onPress={handlePlayButtonPress}
        style={[
          styles.diaryWaveformPlayButton,
          !isPlayable && styles.diaryWaveformPlayButtonDisabled,
        ]}>
        <SymbolView
          name={{
            ios: isPlaying ? 'pause.fill' : 'play.fill',
            android: isPlaying ? 'pause' : 'play_arrow',
            web: isPlaying ? 'pause' : 'play_arrow',
          }}
          size={17}
          tintColor={playIconColor}
          fallback={
            <ThemedText
              style={[
                styles.diaryWaveformPlayIcon,
                !isPlayable && styles.diaryWaveformPlayIconDisabled,
              ]}>
              {isPlaying ? 'Ⅱ' : '▶'}
            </ThemedText>
          }
        />
      </Pressable>
      {waveformBars}
      {timeLabel && <ThemedText style={styles.diaryWaveformTime}>{timeLabel}</ThemedText>}
    </>
  );

  if (!isPlayable) {
    return (
      <View accessibilityLabel="録音の音量波形" accessible style={styles.diaryWaveform}>
        {playerContent}
      </View>
    );
  }

  return <View style={styles.diaryWaveform}>{playerContent}</View>;
}

function DiaryBulletList({ points }: { points: string[] }) {
  const visiblePoints = points.length > 0 ? points : ['本文はありません。'];

  return (
    <View>
      {visiblePoints.map((point, index) => (
        <View key={`${index}-${point}`} style={styles.diaryBulletRow}>
          <View style={styles.diaryBulletDotSlot}>
            <View style={styles.diaryBulletDot} />
          </View>
          <ThemedText style={styles.diaryBulletText} selectable>
            {normalizeDisplayText(point)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function DiaryStatePaper({ children }: { children: React.ReactNode }) {
  return <DiaryPaperSurface style={styles.statePaper}>{children}</DiaryPaperSurface>;
}

function DiaryPaperSurface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FoundationSurface
      foundationDepth={12}
      foundationDistanceScale={0.72}
      foundationDirection="diagonal"
      foundationColor={DiaryColors.foundation}
      foundationBorderColor={DiaryColors.bodyText}
      foundationBorderWidth={4}
      foundationOffsetX={CoralFoundationOffset}
      foundationOffsetY={CoralFoundationOffset}
      foundationRadiusMode="concentric"
      pressTravelRatio={0.36}
      pressDiagonalRatio={1}
      pressInDuration={142}
      pressOutDuration={270}
      containerStyle={styles.diaryPaperSurface}
      style={[styles.diaryPaper, style]}>
      {children}
    </FoundationSurface>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatWaveformTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getDiaryDisplayText(entry: DiaryEntry, displayMode: Exclude<DiaryDisplayMode, 'bullets'>) {
  if (displayMode === 'original') {
    return normalizeDisplayText(entry.originalText);
  }

  return formatReadableDisplayText(entry.plainText);
}

function formatReadableDisplayText(value: string) {
  return normalizeDisplayText(value)
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/([。！？!?]+[」』）)]*)\s*/g, '$1\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function normalizeDisplayText(value: string) {
  const normalizedValue = value.replace(/\n{3,}/g, '\n\n').trim();

  if (normalizedValue) {
    return normalizedValue;
  }

  return '本文はありません。';
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  centerState: {
    minHeight: 360,
    justifyContent: 'center',
  },
  diaryPaperList: {
    gap: Spacing.three,
  },
  modeSwitch: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: DiaryColors.bodyText,
    backgroundColor: DiaryColors.paper,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  modeButtonDivider: {
    borderLeftWidth: 4,
    borderLeftColor: DiaryColors.bodyText,
  },
  modeButtonSelected: {
    backgroundColor: DiaryColors.bodyText,
  },
  modeButtonPressed: {
    opacity: 0.72,
  },
  modeButtonText: {
    color: DiaryColors.bodyText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 900,
  },
  modeButtonTextSelected: {
    color: DiaryColors.paper,
  },
  diaryPaperSurface: {
    alignSelf: 'stretch',
  },
  diaryPaper: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: DiaryColors.bodyText,
    backgroundColor: DiaryColors.paper,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  diaryOriginalEntry: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: DiaryColors.voicePaper,
    padding: Spacing.two,
  },
  diaryOriginalRail: {
    width: 6,
    alignSelf: 'stretch',
    borderRadius: 999,
    backgroundColor: DiaryColors.voiceAccentMuted,
  },
  diaryOriginalContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
  },
  diaryPaperDate: {
    color: DiaryColors.accent,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  diaryOriginalDate: {
    color: DiaryColors.voiceAccent,
    fontFamily: Fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  diaryWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: DiaryColors.voiceRule,
    backgroundColor: DiaryColors.voiceSurface,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  diaryWaveformPlayButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: DiaryColors.voiceAccent,
    backgroundColor: DiaryColors.voiceWarm,
  },
  diaryWaveformPlayButtonDisabled: {
    backgroundColor: DiaryColors.voiceDisabled,
    borderColor: DiaryColors.voiceAccentMuted,
  },
  diaryWaveformPlayIcon: {
    color: DiaryColors.voiceAccentDark,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 900,
  },
  diaryWaveformPlayIconDisabled: {
    color: '#7A8790',
  },
  diaryWaveformBars: {
    minHeight: 42,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    overflow: 'hidden',
  },
  diaryWaveformBar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 5,
    minWidth: 3,
    maxWidth: 7,
    borderRadius: 999,
    backgroundColor: DiaryColors.voiceAccentMuted,
  },
  diaryWaveformTime: {
    width: 50,
    flexShrink: 0,
    borderRadius: 8,
    backgroundColor: DiaryColors.voiceAccentSoft,
    color: DiaryColors.voiceAccentDark,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  diaryPaperBody: {
    color: DiaryColors.bodyText,
  },
  diaryPaperBodyRaw: {
    color: DiaryColors.voiceText,
    fontSize: 18,
    lineHeight: 30,
    fontWeight: 800,
  },
  diaryPaperBodyReadable: {
    fontSize: 19,
    lineHeight: 33,
    fontWeight: 900,
  },
  diaryPaperBodyReadableOnMint: {
    color: DiaryColors.voiceText,
    fontSize: 18,
    lineHeight: 31,
  },
  diaryBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  diaryBulletDotSlot: {
    width: 14,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryBulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: DiaryColors.voiceAccent,
  },
  diaryBulletText: {
    flex: 1,
    minWidth: 0,
    color: DiaryColors.voiceText,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: 900,
  },
  statePaper: {
    minHeight: 148,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stateText: {
    color: DiaryColors.bodyText,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: 800,
  },
  statePanel: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: DiaryColors.bodyText,
    backgroundColor: '#FFFFFF',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  stateTitle: {
    color: DiaryColors.bodyText,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: 800,
  },
  stateDescription: {
    color: '#5F6670',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
  },
  retryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: DiaryColors.bodyText,
    backgroundColor: '#2FDD6C',
    paddingHorizontal: Spacing.three,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
  },
  errorBanner: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: DiaryColors.bodyText,
    backgroundColor: DiaryColors.paper,
    padding: Spacing.three,
  },
  errorText: {
    color: DiaryColors.error,
  },
});
