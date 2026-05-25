import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FoundationSurface } from '@/components/ui/foundation-surface';
import { Spacing } from '@/constants/theme';
import type { TranslationCardGroup } from '@/lib/backend/practice';
import { flattenTranslationCardGroups, type PracticeCard } from '@/lib/practice-cards';

type EnglishPracticeDeckProps = {
  groups: TranslationCardGroup[];
};

const FoundationBorderColor = '#111111';
const FoundationDistance = 0.56;

export function EnglishPracticeDeck({ groups }: EnglishPracticeDeckProps) {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 760;
  const cards = flattenTranslationCardGroups(groups);

  return (
    <View style={styles.deckGrid}>
      {cards.map((card) => (
        <EnglishPracticePair
          key={card.id}
          card={card}
          isWideLayout={isWideLayout}
        />
      ))}
    </View>
  );
}

function EnglishPracticePair({
  card,
  isWideLayout,
}: {
  card: PracticeCard;
  isWideLayout: boolean;
}) {
  return (
    <FoundationSurface
      accessibilityRole="summary"
      containerStyle={[
        styles.practiceCardContainer,
        {
          width: isWideLayout ? '48.5%' : '100%',
        },
      ]}
      foundationDepth={7}
      foundationDistanceScale={FoundationDistance}
      foundationDirection="diagonal"
      foundationColor={FoundationBorderColor}
      style={styles.practiceCard}>
      <View style={styles.japanesePanel}>
        <ThemedText style={styles.japaneseText} selectable>
          {card.japanese}
        </ThemedText>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.englishPanel}>
        <ThemedText style={styles.englishText} selectable>
          {card.english}
        </ThemedText>
      </View>
    </FoundationSurface>
  );
}

const styles = StyleSheet.create({
  deckGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  practiceCardContainer: {
    flexShrink: 0,
  },
  practiceCard: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: FoundationBorderColor,
    backgroundColor: '#FFF9EC',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  japanesePanel: {
    padding: Spacing.two,
  },
  cardDivider: {
    height: 3,
    borderRadius: 999,
    backgroundColor: FoundationBorderColor,
  },
  englishPanel: {
    padding: Spacing.two,
  },
  japaneseText: {
    color: '#111111',
    fontSize: 21,
    lineHeight: 31,
    fontWeight: 900,
  },
  englishText: {
    color: '#111111',
    fontSize: 22,
    lineHeight: 32,
    fontWeight: 900,
  },
});
