import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FoundationSurface } from '@/components/ui/foundation-surface';
import { Spacing } from '@/constants/theme';
import { type TranslationCard } from '@/lib/backend/practice';

type GeneratedPracticePreviewProps = {
  cards: TranslationCard[];
};

const FoundationBorderColor = '#111111';
const FoundationDistance = 0.56;

export function GeneratedPracticePreview({ cards }: GeneratedPracticePreviewProps) {
  const visibleCards = cards.filter((card) => card.japanese.trim().length > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        accessibilityLabel="作成された日本語カード"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.cardStack}>
        {visibleCards.map((card) => (
          <FoundationSurface
            key={card.id}
            accessibilityRole="summary"
            foundationDepth={7}
            foundationDistanceScale={FoundationDistance}
            foundationDirection="diagonal"
            foundationColor={FoundationBorderColor}
            style={styles.cardSlip}>
            <ThemedText style={styles.japaneseText} selectable>
              {card.japanese}
            </ThemedText>
          </FoundationSurface>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: 220,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  cardStack: {
    gap: Spacing.three,
    paddingBottom: Spacing.half,
  },
  cardSlip: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: FoundationBorderColor,
    backgroundColor: '#FFF9EC',
    padding: Spacing.three,
  },
  japaneseText: {
    color: '#111111',
    fontSize: 22,
    lineHeight: 32,
    fontWeight: 900,
  },
});
