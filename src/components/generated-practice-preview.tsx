import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FoundationSurface } from '@/components/ui/foundation-surface';
import { Spacing } from '@/constants/theme';
import { type PracticeDraftCard, type TranslationCard } from '@/lib/backend/practice';

type PreviewPracticeCard = PracticeDraftCard | TranslationCard;

type GeneratedPracticePreviewProps = {
  cards: PreviewPracticeCard[];
  editable?: boolean;
  onCardJapaneseChange?: (cardId: string, nextJapanese: string) => void;
};

const FoundationBorderColor = '#111111';
const FoundationDistance = 0.56;

export function GeneratedPracticePreview({
  cards,
  editable = false,
  onCardJapaneseChange,
}: GeneratedPracticePreviewProps) {
  const visibleCards = editable
    ? cards
    : cards.filter((card) => card.japanese.trim().length > 0);

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
            {editable ? (
              <TextInput
                value={card.japanese}
                accessibilityLabel="日本語カード案を編集"
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                selectionColor="#276EF1"
                onChangeText={(nextJapanese) => onCardJapaneseChange?.(card.id, nextJapanese)}
                style={styles.japaneseInput}
              />
            ) : (
              <ThemedText style={styles.japaneseText} selectable>
                {card.japanese}
              </ThemedText>
            )}
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
  japaneseInput: {
    minHeight: 44,
    padding: 0,
    color: '#111111',
    fontSize: 22,
    lineHeight: 32,
    fontWeight: 900,
  },
});
