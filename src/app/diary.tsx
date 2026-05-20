import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listDiaryEntries, type DiaryEntry } from '@/lib/backend/practice';
import { subscribeToPracticeRefresh } from '@/lib/practice-refresh';

type LoadMode = 'initial' | 'refresh' | 'sync';

export default function DiaryScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const isMountedRef = useRef(false);
  const isLoadingEntriesRef = useRef(false);
  const shouldSyncAfterCurrentLoadRef = useRef(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());
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

  const toggleEntry = useCallback((entryId: string) => {
    setExpandedEntryIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(entryId)) {
        nextIds.delete(entryId);
      } else {
        nextIds.add(entryId);
      }

      return nextIds;
    });
  }, []);

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
          paddingTop: safeAreaInsets.top,
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
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              日記
            </ThemedText>
            <ThemedText themeColor="textSecondary" selectable>
              まだ日記はありません。
            </ThemedText>
          </View>
        )}

        {errorMessage && entries.length === 0 && (
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              日記
            </ThemedText>
            <ThemedText style={{ color: palette.coral }} selectable>
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

        {entries.map((entry) => {
          const isExpanded = expandedEntryIds.has(entry.id);
          const summaryPoints = entry.summaryPoints ?? [];

          return (
            <View
              key={entry.id}
              style={[
                styles.entryCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  boxShadow: palette.shadow,
                },
              ]}>
              <View style={styles.entryMetaRow}>
                <ThemedText type="code" themeColor="textSecondary" selectable>
                  {formatDate(entry.createdAt)}
                </ThemedText>
                <ThemedText type="code" themeColor="textSecondary" selectable>
                  {formatSource(entry.source)} / {formatCardCount(entry.cardCount)}
                </ThemedText>
              </View>

              <ThemedText style={styles.entryTitle} numberOfLines={2} selectable>
                {entry.title}
              </ThemedText>

              {summaryPoints.length > 0 && (
                <View style={styles.summaryList}>
                  {summaryPoints.map((point, index) => (
                    <View key={`${entry.id}-${index}`} style={styles.summaryRow}>
                      <View style={[styles.summaryBullet, { backgroundColor: palette.teal }]} />
                      <ThemedText style={styles.summaryText} selectable>
                        {point}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {!isExpanded && (
                <ThemedText
                  style={styles.previewText}
                  themeColor="textSecondary"
                  numberOfLines={2}
                  selectable>
                  {formatPreview(entry.transcriptText)}
                </ThemedText>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                style={({ pressed }) => [
                  styles.bodyToggle,
                  { borderTopColor: palette.border },
                  pressed && styles.pressedToggle,
                ]}
                onPress={() => toggleEntry(entry.id)}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {isExpanded ? '本文を閉じる' : '全文を読む'}
                </ThemedText>
                <SymbolView
                  name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
                  size={18}
                  weight="bold"
                  tintColor={palette.textSecondary}
                  style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                />
              </Pressable>

              {isExpanded && (
                <ThemedText style={styles.transcriptText} selectable>
                  {entry.transcriptText}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatSource(source: DiaryEntry['source']) {
  return source === 'text' ? 'テキスト' : '音声';
}

function formatCardCount(count: number) {
  return `英語カード${count}件`;
}

function formatPreview(value: string) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  if (!normalizedValue) {
    return '本文はありません。';
  }

  return normalizedValue;
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
  centerState: {
    minHeight: 360,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  entryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  entryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  entryTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 800,
  },
  summaryList: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  summaryBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 11,
  },
  summaryText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: 600,
  },
  previewText: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: 500,
  },
  bodyToggle: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pressedToggle: {
    opacity: 0.7,
  },
  transcriptText: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: 500,
  },
});
