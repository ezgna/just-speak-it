import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listDiaryEntries, type DiaryEntry } from '@/lib/backend/practice';
import { subscribeToPracticeRefresh } from '@/lib/practice-refresh';

type LoadMode = 'initial' | 'refresh' | 'sync';
type Palette = ReturnType<typeof useDailyPalette>;

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
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.scrollView, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: safeAreaInsets.top + Spacing.two,
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
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.primary} />
          </View>
        )}

        {!isInitialLoading && entries.length === 0 && !errorMessage && (
          <View style={styles.emptyState}>
            <ThemedText style={[styles.emptyText, { color: palette.textSecondary }]} selectable>
              まだ積まれた日記はありません。
            </ThemedText>
          </View>
        )}

        {errorMessage && entries.length === 0 && (
          <View style={styles.emptyState}>
            <ThemedText style={[styles.emptyText, { color: palette.coral }]} selectable>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        {errorMessage && entries.length > 0 && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: palette.coral }} selectable>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        {entries.length > 0 && (
          <View style={styles.paperList}>
            {entries.map((entry, index) => (
              <DiaryPaper key={entry.id} entry={entry} index={index} palette={palette} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function DiaryPaper({
  entry,
  index,
  palette,
}: {
  entry: DiaryEntry;
  index: number;
  palette: Palette;
}) {
  const paperColor = getPaperColor(index, palette);

  return (
    <View style={styles.paperStack}>
      <View
        pointerEvents="none"
        style={[
          styles.paperBackLayer,
          {
            backgroundColor: palette.cardAlt,
            borderColor: palette.border,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.paperMiddleLayer,
          {
            backgroundColor: palette.backgroundElement,
            borderColor: palette.border,
          },
        ]}
      />
      <View
        style={[
          styles.entryPaper,
          {
            backgroundColor: paperColor,
            borderColor: palette.border,
            boxShadow: palette.shadow,
          },
        ]}>
        <ThemedText type="code" style={{ color: palette.textSecondary }} selectable>
          {formatDate(entry.createdAt)}
        </ThemedText>
        <ThemedText style={[styles.bodyText, { color: palette.text }]} selectable>
          {entry.bodyText}
        </ThemedText>
      </View>
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getPaperColor(index: number, palette: Palette) {
  const colors = [palette.card, palette.cardAlt, '#FFF8EA'];
  return colors[index % colors.length];
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
  loadingState: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  errorBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  emptyState: {
    minHeight: 360,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: 600,
  },
  paperList: {
    gap: Spacing.three,
  },
  paperStack: {
    position: 'relative',
    paddingRight: 9,
    paddingBottom: 10,
  },
  paperBackLayer: {
    position: 'absolute',
    left: 9,
    top: 10,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 23,
    borderCurve: 'continuous',
  },
  paperMiddleLayer: {
    position: 'absolute',
    left: 5,
    top: 5,
    right: 4,
    bottom: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 23,
    borderCurve: 'continuous',
  },
  entryPaper: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 23,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 31,
    fontWeight: 600,
  },
});
