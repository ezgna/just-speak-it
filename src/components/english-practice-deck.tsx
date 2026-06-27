import { StyleSheet, View } from 'react-native';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { LocalRecordingPlayButton } from '@/components/local-recording-play-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TranslationCard, TranslationCardGroup } from '@/lib/backend/practice';
import { formatPracticeDate } from '@/lib/practice-cards';

type EnglishPracticeDeckProps = {
  groups: TranslationCardGroup[];
};

const InkColor = '#111111';
const TimecodeColors = ['#2FDD6C', '#65D7F2', '#FF9F45', '#9B7CFF'] as const;

export function EnglishPracticeDeck({ groups }: EnglishPracticeDeckProps) {
  return (
    <View style={styles.memoList}>
      {groups.map((group) => (
        <MemoPracticeGroup key={group.practiceGenerationId} group={group} />
      ))}
    </View>
  );
}

function MemoPracticeGroup({ group }: { group: TranslationCardGroup }) {
  const sourceLabel =
    group.source === 'voice'
      ? group.isTranscriptEdited
        ? 'Voice · Edited'
        : 'Voice'
      : 'Text';
  const cardCountLabel = `${group.cards.length} ${group.cards.length === 1 ? 'card' : 'cards'}`;

  return (
    <View style={styles.memoGroup}>
      <View style={styles.memoHeader}>
        <View style={styles.memoMetaRow}>
          <View style={styles.memoSourcePill}>
            <ThemedText style={styles.memoSourceText}>{sourceLabel}</ThemedText>
          </View>
          <ThemedText style={styles.memoDateText} selectable>
            {formatPracticeDate(group.createdAt)}
          </ThemedText>
        </View>

        <ThemedText style={styles.memoExcerptText} numberOfLines={2} selectable>
          {group.diaryExcerpt}
        </ThemedText>

        <ThemedText style={styles.memoCardCountText} selectable>
          {cardCountLabel}
        </ThemedText>
      </View>

      <View style={styles.transcriptList}>
        {group.cards.map((card, index) => (
          <EnglishPracticeLine
            key={card.id}
            card={card}
            diaryEntryId={group.diaryEntryId}
            index={index}
          />
        ))}
      </View>
    </View>
  );
}

function EnglishPracticeLine({
  card,
  diaryEntryId,
  index,
}: {
  card: TranslationCard;
  diaryEntryId: string;
  index: number;
}) {
  const palette = useDailyPalette();
  const tabColor = TimecodeColors[index % TimecodeColors.length];
  const timecode =
    typeof card.audioStartSec === 'number' ? formatTranscriptTime(card.audioStartSec) : null;

  return (
    <View style={styles.transcriptRow}>
      <View style={styles.separator}>
        {timecode ? (
          <>
            <LocalRecordingPlayButton
              diaryEntryId={diaryEntryId}
              audioStartSec={card.audioStartSec}
              audioEndSec={card.audioEndSec}
              size={32}
              iconSize={15}
              backgroundColor="#FFFFFF"
              activeBackgroundColor={tabColor}
              borderColor={InkColor}
              tintColor={InkColor}
              activeTintColor={InkColor}
              style={styles.timecodeAudioButton}
            />
            <View style={[styles.timecodeTab, { backgroundColor: tabColor }]}>
              <ThemedText style={styles.timecodeText}>{timecode}</ThemedText>
            </View>
          </>
        ) : null}
        <View style={[styles.rule, { backgroundColor: palette.border }]} />
      </View>

      <View style={styles.copy}>
        <ThemedText style={styles.englishText} selectable>
          {card.english}
        </ThemedText>
        <ThemedText style={[styles.japaneseText, { color: palette.muted }]} selectable>
          {card.japanese}
        </ThemedText>
      </View>
    </View>
  );
}

function formatTranscriptTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  memoList: {
    gap: Spacing.four,
  },
  memoGroup: {
    gap: Spacing.three,
    borderTopWidth: 3,
    borderColor: InkColor,
    paddingTop: Spacing.three,
  },
  memoHeader: {
    gap: Spacing.two,
  },
  memoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  memoSourcePill: {
    borderWidth: 2,
    borderColor: InkColor,
    backgroundColor: '#FFF6E7',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  memoSourceText: {
    color: InkColor,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  memoDateText: {
    color: InkColor,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: 800,
  },
  memoExcerptText: {
    color: InkColor,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: 800,
  },
  memoCardCountText: {
    color: '#5F6670',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: 800,
  },
  transcriptList: {
    gap: Spacing.three,
  },
  transcriptRow: {
    gap: Spacing.two,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timecodeAudioButton: {
    marginRight: Spacing.one,
  },
  timecodeTab: {
    minWidth: 56,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: InkColor,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  timecodeText: {
    color: InkColor,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  rule: {
    flex: 1,
    height: 3,
    borderRadius: 999,
  },
  copy: {
    gap: Spacing.one,
  },
  englishText: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  japaneseText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
});
