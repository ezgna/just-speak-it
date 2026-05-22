import { SymbolView, type SymbolViewProps } from 'expo-symbols';
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
  type PracticeCard,
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
  const masteredPercent = cards.length === 0 ? 0 : Math.round((cardCounts.known / cards.length) * 100);
  const masteryProgressWidth = `${masteredPercent}%` as `${number}%`;

  return (
    <>
      <View
        style={[
          styles.overviewPanel,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            boxShadow: palette.shadow,
          },
        ]}>
        <View style={styles.masteryHeader}>
          <ThemedText type="code" style={{ color: palette.textSecondary }}>
            習得 {masteredPercent}%
          </ThemedText>
          <ThemedText type="code" style={{ color: palette.textSecondary }}>
            {cardCounts.known} / {cards.length}
          </ThemedText>
        </View>
        <View style={[styles.masteryTrack, { backgroundColor: palette.backgroundElement }]}>
          <View
            style={[
              styles.masteryFill,
              {
                width: masteryProgressWidth,
                backgroundColor: palette.green,
              },
            ]}
          />
        </View>

        <View style={styles.statsRow}>
          <StatTile
            icon={{ ios: 'clock.arrow.circlepath', android: 'schedule', web: 'schedule' }}
            label="復習"
            value={cardCounts.due}
            detail={`${cardCounts.learning} 学習中`}
            tone="amber"
          />
          <StatTile
            icon={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
            label="言えた"
            value={cardCounts.known}
            detail={`${cardCounts.new} 未判定`}
            tone="green"
          />
          <StatTile
            icon={{ ios: 'rectangle.stack.fill', android: 'layers', web: 'layers' }}
            label="合計"
            value={cards.length}
            detail={`表示 ${visibleCards.length}`}
            tone="blue"
          />
        </View>
      </View>

      <View style={styles.deckSection}>
        <View
          style={[
            styles.controlPanel,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}>
          <View style={styles.controlBlock}>
            <ThemedText type="code" style={{ color: palette.textSecondary }}>
              表示
            </ThemedText>
            <View style={[styles.segmentedRow, { backgroundColor: palette.backgroundElement }]}>
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
                label="言えた"
                active={cardFilter === 'known'}
                onPress={() => setCardFilter('known')}
              />
            </View>
          </View>

          <View style={styles.controlBlock}>
            <ThemedText type="code" style={{ color: palette.textSecondary }}>
              並び順
            </ThemedText>
            <View style={[styles.segmentedRow, { backgroundColor: palette.backgroundElement }]}>
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
          </View>
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
              {getEmptyMessage(cardFilter)}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.cardGrid}>
            {visibleCards.map((card) => {
              const progress = getCardProgress(cardStatuses, card.id);
              const status = getCardStatus(cardStatuses, card.id);

              return (
                <PracticeCardItem
                  key={card.id}
                  card={card}
                  isWideLayout={isWideLayout}
                  palette={palette}
                  progress={progress}
                  status={status}
                  onSetStatus={setCardStatus}
                />
              );
            })}
          </View>
        )}
      </View>
    </>
  );
}

function PracticeCardItem({
  card,
  isWideLayout,
  palette,
  progress,
  status,
  onSetStatus,
}: {
  card: PracticeCard;
  isWideLayout: boolean;
  palette: Palette;
  progress: CardLearningProgress;
  status: CardLearningStatus;
  onSetStatus: (cardId: string, status: CardLearningStatus) => void;
}) {
  const statusColor = getStatusBorderColor(status, palette);

  return (
    <View
      style={[
        styles.practiceCard,
        {
          width: isWideLayout ? '48.5%' : '100%',
          backgroundColor: palette.card,
          borderColor: palette.border,
          boxShadow: palette.shadow,
        },
      ]}>
      <View style={[styles.statusStripe, { backgroundColor: statusColor }]} />

      <View style={styles.cardMetaRow}>
        <View style={styles.dateRow}>
          <SymbolView
            name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
            size={13}
            tintColor={palette.textSecondary}
          />
          <ThemedText type="code" themeColor="textSecondary" selectable>
            {formatPracticeDate(card.diaryCreatedAt)}
          </ThemedText>
        </View>
        <StatusPill progress={progress} />
      </View>

      <ThemedText style={styles.diaryTitle} numberOfLines={2} selectable>
        {card.diaryTitle}
      </ThemedText>

      <View style={styles.cardBody}>
        <View style={styles.languageBlock}>
          <ThemedText type="code" style={{ color: palette.textSecondary }}>
            日本語
          </ThemedText>
          <ThemedText style={styles.japaneseText} selectable>
            {card.japanese}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: palette.border }]} />

        <View style={styles.languageBlock}>
          <ThemedText type="code" style={{ color: palette.primary }}>
            ENGLISH
          </ThemedText>
          <ThemedText style={styles.englishText} selectable>
            {card.english}
          </ThemedText>
        </View>
      </View>

      <View style={styles.cardActionRow}>
        <StatusActionButton
          icon={{ ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' }}
          label="もう一回"
          active={status === 'learning'}
          tone="amber"
          onPress={() => onSetStatus(card.id, 'learning')}
        />
        <StatusActionButton
          icon={{ ios: 'checkmark', android: 'check', web: 'check' }}
          label="言えた"
          active={status === 'known'}
          tone="green"
          onPress={() => onSetStatus(card.id, 'known')}
        />
      </View>
    </View>
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
          backgroundColor: active ? palette.card : 'transparent',
          borderColor: active ? palette.border : 'transparent',
          boxShadow: active ? '0 2px 8px rgba(31, 28, 20, 0.08)' : 'none',
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: active ? palette.primary : palette.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StatTile({
  detail,
  icon,
  label,
  value,
  tone,
}: {
  detail: string;
  icon: SymbolViewProps['name'];
  label: string;
  value: number;
  tone: Tone;
}) {
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
      <View style={styles.statHeader}>
        <SymbolView name={icon} size={15} tintColor={colors.color} />
        <ThemedText type="code" style={{ color: colors.color }}>
          {label}
        </ThemedText>
      </View>
      <ThemedText style={[styles.statValue, { color: colors.color }]} selectable>
        {value}
      </ThemedText>
      <ThemedText type="code" style={{ color: colors.color }} selectable>
        {detail}
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
  icon,
  label,
  active,
  tone,
  onPress,
}: {
  icon: SymbolViewProps['name'];
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
      <SymbolView name={icon} size={16} tintColor={colors.color} />
      <ThemedText type="smallBold" style={{ color: colors.color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function formatStatus(status: CardLearningStatus, nextReviewLabel: string) {
  if (status === 'known') {
    return nextReviewLabel ? `言えた・${nextReviewLabel}` : '言えた';
  }

  if (status === 'learning') {
    return nextReviewLabel ? `もう一回・${nextReviewLabel}` : 'もう一回';
  }

  return '未判定';
}

function getEmptyMessage(cardFilter: CardFilter) {
  if (cardFilter === 'review') {
    return '復習待ちのカードはありません。';
  }

  if (cardFilter === 'known') {
    return '言えたカードはまだありません。';
  }

  return '表示できるカードはありません。';
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
  overviewPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  masteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  masteryTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  statTile: {
    flex: 1,
    minWidth: 128,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
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
  controlPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.two,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  controlBlock: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
  },
  segmentedRow: {
    minHeight: 44,
    flexDirection: 'row',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: Spacing.one,
    gap: Spacing.one,
  },
  filterButton: {
    flex: 1,
    minHeight: 36,
    minWidth: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 11,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
    gap: Spacing.three,
  },
  practiceCard: {
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: Spacing.three,
    paddingLeft: Spacing.three + Spacing.one,
    gap: Spacing.three,
  },
  statusStripe: {
    position: 'absolute',
    top: Spacing.three,
    bottom: Spacing.three,
    left: 0,
    width: 4,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  diaryTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  cardBody: {
    gap: Spacing.three,
  },
  languageBlock: {
    gap: Spacing.one,
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
    fontSize: 21,
    lineHeight: 31,
    fontWeight: 800,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statusActionButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 13,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
