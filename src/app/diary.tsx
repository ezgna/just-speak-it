import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listDiaryEntries, type DiaryEntry } from '@/lib/backend/practice';

export default function DiaryScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setErrorMessage(null);

    try {
      const nextEntries = await listDiaryEntries();
      setEntries(nextEntries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '日記を読み込めませんでした。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadEntries();
    }, [loadEntries])
  );

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: safeAreaInsets.top + Spacing.four,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={loadEntries} tintColor={palette.primary} />
      }>
      <View style={styles.container}>
        {isLoading && entries.length === 0 && (
          <View style={styles.centerState}>
            <ActivityIndicator color={palette.primary} />
          </View>
        )}

        {!isLoading && entries.length === 0 && !errorMessage && (
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              日記
            </ThemedText>
            <ThemedText themeColor="textSecondary" selectable>
              まだ日記はありません。
            </ThemedText>
          </View>
        )}

        {errorMessage && (
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              日記
            </ThemedText>
            <ThemedText style={{ color: palette.coral }} selectable>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        {entries.map((entry) => (
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
            <ThemedText type="code" themeColor="textSecondary" selectable>
              {formatDate(entry.createdAt)}
            </ThemedText>
            <ThemedText style={styles.transcriptText} selectable>
              {entry.transcriptText}
            </ThemedText>
            {entry.cards.length > 0 && (
              <View style={styles.japaneseCardList}>
                {entry.cards.map((card) => (
                  <View
                    key={card.id}
                    style={[
                      styles.japaneseCard,
                      {
                        backgroundColor: palette.cardAlt,
                        borderColor: palette.border,
                      },
                    ]}>
                    <ThemedText type="smallBold" selectable>
                      {card.japanese}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
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
    gap: Spacing.three,
  },
  entryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  transcriptText: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: 600,
  },
  japaneseCardList: {
    gap: Spacing.two,
  },
  japaneseCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
});
