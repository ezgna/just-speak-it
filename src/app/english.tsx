import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listTranslationCards, type TranslationCard } from '@/lib/backend/practice';

export default function EnglishScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const [cards, setCards] = useState<TranslationCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setErrorMessage(null);

    try {
      const nextCards = await listTranslationCards();
      setCards(nextCards);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '英語カードを読み込めませんでした。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadCards();
    }, [loadCards])
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
        <RefreshControl refreshing={isLoading} onRefresh={loadCards} tintColor={palette.primary} />
      }>
      <View style={styles.container}>
        {isLoading && cards.length === 0 && (
          <View style={styles.centerState}>
            <ActivityIndicator color={palette.primary} />
          </View>
        )}

        {!isLoading && cards.length === 0 && !errorMessage && (
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              英語
            </ThemedText>
            <ThemedText themeColor="textSecondary" selectable>
              まだ英語カードはありません。
            </ThemedText>
          </View>
        )}

        {errorMessage && (
          <View style={styles.centerState}>
            <ThemedText type="title" selectable>
              英語
            </ThemedText>
            <ThemedText style={{ color: palette.coral }} selectable>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        {cards.map((card, index) => (
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
    </ScrollView>
  );
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
