import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemedText } from '@/components/themed-text';
import { FoundationSurface } from '@/components/ui/foundation-surface';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { listDiaryEntries, type DiaryEntry } from '@/lib/backend/practice';
import { subscribeToPracticeRefresh } from '@/lib/practice-refresh';

type LoadMode = 'initial' | 'refresh' | 'sync';
type DiaryDisplayMode = 'original' | 'plain' | 'polished' | 'bullets';

const DiaryDisplayModeOptions: { label: string; value: DiaryDisplayMode }[] = [
  { label: '原文', value: 'original' },
  { label: 'そのまま', value: 'plain' },
  { label: '読みやすく', value: 'polished' },
  { label: '箇条書き', value: 'bullets' },
];

const DiaryColors = {
  accent: '#D85642',
  bodyText: '#111111',
  error: '#E8664F',
  paper: '#FFF0EC',
  foundation: '#FF7661',
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
  const [displayMode, setDisplayMode] = useState<DiaryDisplayMode>('plain');

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
          <DiaryStatePaper>
            <ThemedText style={[styles.stateText, styles.errorText]} selectable>
              {errorMessage}
            </ThemedText>
          </DiaryStatePaper>
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
            <DiaryModeSwitch value={displayMode} onChange={setDisplayMode} />
            {entries.map((entry) => (
              <DiaryPaper key={entry.id} entry={entry} displayMode={displayMode} />
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
}: {
  entry: DiaryEntry;
  displayMode: DiaryDisplayMode;
}) {
  return (
    <DiaryPaperSurface>
      <ThemedText style={styles.diaryPaperDate} selectable>
        {formatDate(entry.createdAt)}
      </ThemedText>
      {displayMode === 'bullets' ? (
        <DiaryBulletList points={entry.bulletPoints} />
      ) : (
        <ThemedText style={styles.diaryPaperBody} selectable>
          {getDiaryDisplayText(entry, displayMode)}
        </ThemedText>
      )}
    </DiaryPaperSurface>
  );
}

function DiaryBulletList({ points }: { points: string[] }) {
  const visiblePoints = points.length > 0 ? points : ['本文はありません。'];

  return (
    <View style={styles.diaryBulletList}>
      {visiblePoints.map((point, index) => (
        <View key={`${index}-${point}`} style={styles.diaryBulletRow}>
          <ThemedText style={styles.diaryBulletMark}>・</ThemedText>
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

function getDiaryDisplayText(entry: DiaryEntry, displayMode: Exclude<DiaryDisplayMode, 'bullets'>) {
  if (displayMode === 'original') {
    return normalizeDisplayText(entry.originalText);
  }

  if (displayMode === 'polished') {
    return entry.polishedText;
  }

  return entry.plainText;
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
    gap: Spacing.two,
    padding: Spacing.three,
  },
  diaryPaperDate: {
    color: DiaryColors.accent,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  diaryPaperBody: {
    color: DiaryColors.bodyText,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: 800,
  },
  diaryBulletList: {
    gap: Spacing.one,
  },
  diaryBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  diaryBulletMark: {
    width: 18,
    color: DiaryColors.bodyText,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: 900,
    textAlign: 'center',
  },
  diaryBulletText: {
    flex: 1,
    color: DiaryColors.bodyText,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: 800,
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
