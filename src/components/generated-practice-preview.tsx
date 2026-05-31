import { ScrollView, StyleSheet, View } from 'react-native';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { type PracticeDraftCard, type TranslationCard } from '@/lib/backend/practice';

type PreviewPracticeCard = PracticeDraftCard | TranslationCard;

type GeneratedPracticePreviewProps = {
  cards: PreviewPracticeCard[];
};

const RailColors = ['#2FDD6C', '#65D7F2', '#FF9F45', '#9B7CFF'] as const;

export function GeneratedPracticePreview({ cards }: GeneratedPracticePreviewProps) {
  const palette = useDailyPalette();
  const visibleCards = cards.filter((card) => card.japanese.trim().length > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        accessibilityLabel="作成された日本語カード"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.railList}>
        {visibleCards.length > 0 ? (
          <View
            accessible={false}
            style={[styles.railLine, { backgroundColor: palette.border }]}
          />
        ) : null}
        {visibleCards.map((card, index) => {
          const japanese = card.japanese.trim();

          return (
            <View key={card.id} style={styles.railItem}>
              <View
                accessible={false}
                style={[
                  styles.railDot,
                  {
                    backgroundColor: RailColors[index % RailColors.length],
                  },
                ]}
              />
              <ThemedText style={styles.railText}>
                {japanese}
              </ThemedText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexShrink: 1,
  },
  scrollView: {
    flexShrink: 1,
  },
  railList: {
    position: 'relative',
    gap: Spacing.three,
    paddingLeft: 30,
    paddingBottom: Spacing.half,
  },
  railLine: {
    position: 'absolute',
    left: 8,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 999,
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  railDot: {
    width: 19,
    height: 19,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    marginLeft: -30,
    marginTop: 5,
  },
  railText: {
    flex: 1,
    minWidth: 0,
    fontSize: 19,
    lineHeight: 29,
    fontWeight: 700,
  },
});
