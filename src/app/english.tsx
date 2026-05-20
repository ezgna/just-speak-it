import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  listTranslationCardGroups,
  type TranslationCardGroup,
} from '@/lib/backend/practice';
import { subscribeToPracticeRefresh } from '@/lib/practice-refresh';

type LoadMode = 'initial' | 'refresh' | 'sync';

export default function EnglishScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const isMountedRef = useRef(false);
  const isLoadingGroupsRef = useRef(false);
  const shouldSyncAfterCurrentLoadRef = useRef(false);
  const [groups, setGroups] = useState<TranslationCardGroup[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queuedSyncVersion, setQueuedSyncVersion] = useState(0);

  const loadGroups = useCallback(async (mode: LoadMode = 'initial') => {
    if (isLoadingGroupsRef.current) {
      if (mode !== 'initial') {
        shouldSyncAfterCurrentLoadRef.current = true;
      }
      return;
    }

    isLoadingGroupsRef.current = true;
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

      const nextGroups = await listTranslationCardGroups();
      if (!isMountedRef.current) {
        return;
      }

      setGroups(nextGroups);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '英語カードを読み込めませんでした。');
    } finally {
      isLoadingGroupsRef.current = false;

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

  const refreshGroups = useCallback(() => {
    void loadGroups('refresh');
  }, [loadGroups]);

  useEffect(() => {
    isMountedRef.current = true;
    const timeoutId = setTimeout(() => {
      void loadGroups('initial');
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      shouldSyncAfterCurrentLoadRef.current = false;
    };
  }, [loadGroups]);

  useEffect(() => {
    return subscribeToPracticeRefresh(() => {
      void loadGroups('sync');
    });
  }, [loadGroups]);

  useEffect(() => {
    if (queuedSyncVersion === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void loadGroups('sync');
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadGroups, queuedSyncVersion]);

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
        <RefreshControl refreshing={isRefreshing} onRefresh={refreshGroups} tintColor={palette.primary} />
      }>
      <View style={styles.container}>
        {isInitialLoading && groups.length === 0 && (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.primary} />
          </View>
        )}

        {!isInitialLoading && groups.length === 0 && !errorMessage && (
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              英語
            </ThemedText>
            <ThemedText themeColor="textSecondary" selectable>
              まだ英語カードはありません。
            </ThemedText>
          </View>
        )}

        {errorMessage && groups.length === 0 && (
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              英語
            </ThemedText>
            <ThemedText style={{ color: palette.coral }} selectable>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        {errorMessage && groups.length > 0 && (
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

        {groups.map((group) => {
          const summaryPoints = group.summaryPoints ?? [];

          return (
            <View key={group.diaryEntryId} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <View style={styles.groupMetaRow}>
                  <ThemedText type="code" themeColor="textSecondary" selectable>
                    {formatDate(group.createdAt)}
                  </ThemedText>
                  <ThemedText type="code" themeColor="textSecondary" selectable>
                    {formatSource(group.source)} / {formatCardCount(group.cards.length)}
                  </ThemedText>
                </View>

                <ThemedText style={styles.groupTitle} numberOfLines={2} selectable>
                  {group.title}
                </ThemedText>

                {summaryPoints.length > 0 && (
                  <View style={styles.summaryList}>
                    {summaryPoints.map((point, index) => (
                      <View key={`${group.diaryEntryId}-${index}`} style={styles.summaryRow}>
                        <View style={[styles.summaryBullet, { backgroundColor: palette.teal }]} />
                        <ThemedText type="smallBold" selectable>
                          {point}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.cardList}>
                {group.cards.map((card, index) => (
                  <View
                    key={card.id}
                    style={[
                      styles.translationCard,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                      },
                    ]}>
                    <View style={styles.cardNumber}>
                      <ThemedText type="code" themeColor="textSecondary">
                        {String(index + 1).padStart(2, '0')}
                      </ThemedText>
                    </View>
                    <View style={styles.cardBody}>
                      <ThemedText style={styles.japaneseText} selectable>
                        {card.japanese}
                      </ThemedText>
                      <View style={[styles.divider, { backgroundColor: palette.border }]} />
                      <ThemedText style={styles.englishText} selectable>
                        {card.english}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
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

function formatSource(source: TranslationCardGroup['source']) {
  return source === 'text' ? 'テキスト' : '音声';
}

function formatCardCount(count: number) {
  return `英語カード${count}件`;
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
  groupSection: {
    gap: Spacing.two,
  },
  groupHeader: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  groupMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  groupTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: 800,
  },
  summaryList: {
    gap: Spacing.one,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  summaryBullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 8,
  },
  cardList: {
    gap: Spacing.two,
  },
  translationCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  cardNumber: {
    width: 28,
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
  cardBody: {
    flex: 1,
    gap: Spacing.two,
  },
  japaneseText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: 600,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  englishText: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 700,
  },
});
