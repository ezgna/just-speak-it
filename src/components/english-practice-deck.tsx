import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCardLearningStatuses } from '@/hooks/use-card-learning-statuses';
import type { TranslationCardGroup } from '@/lib/backend/practice';
import {
  formatNextReviewLabel,
  getCardProgress,
  getCardStatus,
  isCardDue,
  type CardLearningProgress,
  type CardLearningStatus,
} from '@/lib/card-learning-statuses';
import {
  flattenTranslationCardGroups,
  formatPracticeDate,
  StatusPriority,
} from '@/lib/practice-cards';

type CardFilter = 'review' | 'all' | 'known';
type SortMode = 'review' | 'timeline';
type Tone = 'amber' | 'green' | 'blue';
type Palette = ReturnType<typeof useDailyPalette>;

type EnglishPracticeDeckProps = {
  groups: TranslationCardGroup[];
};

export function EnglishPracticeDeck({ groups }: EnglishPracticeDeckProps) {
  const { width } = useWindowDimensions();
  const palette = useDailyPalette();
  const { cardStatuses, setCardStatus } = useCardLearningStatuses();
  const [cardFilter, setCardFilter] = useState<CardFilter>('review');
  const [sortMode, setSortMode] = useState<SortMode>('review');
  const isWideLayout = width >= 720;

  const cards = useMemo(() => flattenTranslationCardGroups(groups), [groups]);
  const cardCounts = useMemo(() => {
    return cards.reduce(
      (counts, card) => {
        const status = getCardStatus(cardStatuses, card.id);

        if (isCardDue(cardStatuses, card.id)) {
          counts.due += 1;
        }
        if (status === 'known') {
          counts.known += 1;
        } else if (status === 'learning') {
          counts.learning += 1;
        } else {
          counts.new += 1;
        }

        return counts;
      },
      { due: 0, new: 0, learning: 0, known: 0 }
    );
  }, [cards, cardStatuses]);

  const visibleCards = useMemo(() => {
    const filteredCards = cards.filter((card) => {
      const status = getCardStatus(cardStatuses, card.id);

      if (cardFilter === 'known') {
        return status === 'known';
      }

      if (cardFilter === 'review') {
        return isCardDue(cardStatuses, card.id);
      }

      return true;
    });

    if (sortMode === 'timeline') {
      return filteredCards;
    }

    return [...filteredCards].sort((firstCard, secondCard) => {
      const firstStatus = getCardStatus(cardStatuses, firstCard.id);
      const secondStatus = getCardStatus(cardStatuses, secondCard.id);
      const statusDiff = StatusPriority[firstStatus] - StatusPriority[secondStatus];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      const dateDiff =
        new Date(secondCard.diaryCreatedAt).getTime() -
        new Date(firstCard.diaryCreatedAt).getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return firstCard.sortOrder - secondCard.sortOrder;
    });
  }, [cardFilter, cardStatuses, cards, sortMode]);

  return (
    <>
      <View style={styles.topPanel}>
        <View style={styles.statsRow}>
          <StatTile label="復習" value={cardCounts.due} tone="amber" />
          <StatTile label="OK" value={cardCounts.known} tone="green" />
          <StatTile label="合計" value={cards.length} tone="blue" />
        </View>
      </View>

      <View style={styles.deckSection}>
        <View style={styles.optionRow}>
          <FilterButton
            label="復習"
            active={cardFilter === 'review'}
            onPress={() => setCardFilter('review')}
          />
          <FilterButton
            label="すべて"
            active={cardFilter === 'all'}
            onPress={() => setCardFilter('all')}
          />
          <FilterButton
            label="OK"
            active={cardFilter === 'known'}
            onPress={() => setCardFilter('known')}
          />
        </View>

        <View style={styles.optionRow}>
          <FilterButton
            label="復習順"
            active={sortMode === 'review'}
            onPress={() => setSortMode('review')}
          />
          <FilterButton
            label="時系列"
            active={sortMode === 'timeline'}
            onPress={() => setSortMode('timeline')}
          />
        </View>

        {visibleCards.length === 0 ? (
          <View
            style={[
              styles.emptyPanel,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}>
            <ThemedText type="smallBold" themeColor="textSecondary" selectable>
              表示できるカードはありません。
            </ThemedText>
          </View>
        ) : (
          <View style={styles.cardGrid}>
            {visibleCards.map((card) => {
              const progress = getCardProgress(cardStatuses, card.id);
              const status = getCardStatus(cardStatuses, card.id);

              return (
                <View
                  key={card.id}
                  style={[
                    styles.practiceCard,
                    {
                      width: isWideLayout ? '48.5%' : '100%',
                      backgroundColor: palette.card,
                      borderColor: getStatusBorderColor(status, palette),
                      boxShadow: palette.shadow,
                    },
                  ]}>
                  <View style={styles.cardMetaRow}>
                    <ThemedText type="code" themeColor="textSecondary" selectable>
                      {formatPracticeDate(card.diaryCreatedAt)}
                    </ThemedText>
                    <StatusPill progress={progress} />
                  </View>

                  <ThemedText style={styles.diaryTitle} numberOfLines={2} selectable>
                    {card.diaryTitle}
                  </ThemedText>

                  <View style={styles.cardBody}>
                    <ThemedText style={styles.japaneseText} selectable>
                      {card.japanese}
                    </ThemedText>
                    <View style={[styles.divider, { backgroundColor: palette.border }]} />
                    <ThemedText style={styles.englishText} selectable>
                      {card.english}
                    </ThemedText>
                  </View>

                  <View style={styles.cardActionRow}>
                    <StatusActionButton
                      label="まだ"
                      active={status === 'learning'}
                      tone="amber"
                      onPress={() => setCardStatus(card.id, 'learning')}
                    />
                    <StatusActionButton
                      label="OK"
                      active={status === 'known'}
                      tone="green"
                      onPress={() => setCardStatus(card.id, 'known')}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const palette = useDailyPalette();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterButton,
        {
          backgroundColor: active ? palette.cardAlt : palette.backgroundElement,
          borderColor: active ? palette.primary : palette.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: active ? palette.primary : palette.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const palette = useDailyPalette();
  const colors = getToneColors(tone, palette);

  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
      ]}>
      <ThemedText type="code" style={{ color: colors.color }}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.statValue, { color: colors.color }]} selectable>
        {value}
      </ThemedText>
    </View>
  );
}

function StatusPill({ progress }: { progress: CardLearningProgress }) {
  const palette = useDailyPalette();
  const colors = getStatusColors(progress.status, palette);
  const nextReviewLabel = formatNextReviewLabel(progress);

  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
      ]}>
      <ThemedText type="code" style={{ color: colors.color }}>
        {formatStatus(progress.status, nextReviewLabel)}
      </ThemedText>
    </View>
  );
}

function StatusActionButton({
  label,
  active,
  tone,
  onPress,
}: {
  label: string;
  active: boolean;
  tone: 'amber' | 'green';
  onPress: () => void;
}) {
  const palette = useDailyPalette();
  const colors = getToneColors(tone, palette);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.statusActionButton,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: active ? colors.color : colors.borderColor,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: colors.color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function formatStatus(status: CardLearningStatus, nextReviewLabel: string) {
  if (status === 'known') {
    return nextReviewLabel ? `OK・${nextReviewLabel}` : 'OK';
  }

  if (status === 'learning') {
    return nextReviewLabel ? `まだ・${nextReviewLabel}` : 'まだ';
  }

  return '未判定';
}

function getStatusBorderColor(status: CardLearningStatus, palette: Palette) {
  if (status === 'known') {
    return palette.green;
  }

  if (status === 'learning') {
    return palette.amber;
  }

  return palette.border;
}

function getStatusColors(status: CardLearningStatus, palette: Palette) {
  if (status === 'known') {
    return getToneColors('green', palette);
  }

  if (status === 'learning') {
    return getToneColors('amber', palette);
  }

  return {
    backgroundColor: palette.backgroundElement,
    borderColor: palette.border,
    color: palette.textSecondary,
  };
}

function getToneColors(tone: Tone, palette: Palette) {
  if (tone === 'green') {
    return {
      backgroundColor: palette.greenSoft,
      borderColor: palette.green,
      color: palette.green,
    };
  }

  if (tone === 'amber') {
    return {
      backgroundColor: palette.amberSoft,
      borderColor: palette.amber,
      color: palette.amber,
    };
  }

  return {
    backgroundColor: palette.cardAlt,
    borderColor: palette.primary,
    color: palette.primary,
  };
}

const styles = StyleSheet.create({
  topPanel: {
    gap: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  statTile: {
    flex: 1,
    minWidth: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  deckSection: {
    gap: Spacing.three,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterButton: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  emptyPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  practiceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  statusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  diaryTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  cardBody: {
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
  cardActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statusActionButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
