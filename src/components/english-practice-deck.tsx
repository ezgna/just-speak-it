import { StyleSheet, View } from 'react-native';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { LocalRecordingPlayButton } from '@/components/local-recording-play-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TranslationCardGroup } from '@/lib/backend/practice';
import { flattenTranslationCardGroups, type PracticeCard } from '@/lib/practice-cards';

type EnglishPracticeDeckProps = {
  groups: TranslationCardGroup[];
};

const InkColor = '#111111';
const TimecodeColors = ['#2FDD6C', '#65D7F2', '#FF9F45', '#9B7CFF'] as const;

export function EnglishPracticeDeck({ groups }: EnglishPracticeDeckProps) {
  const cards = flattenTranslationCardGroups(groups);

  return (
    <View style={styles.transcriptList}>
      {cards.map((card, index) => (
        <EnglishPracticeLine
          key={card.id}
          card={card}
          index={index}
        />
      ))}
    </View>
  );
}

function EnglishPracticeLine({
  card,
  index,
}: {
  card: PracticeCard;
  index: number;
}) {
  const palette = useDailyPalette();
  const tabColor = TimecodeColors[index % TimecodeColors.length];
  const timecode =
    typeof card.audioStartSec === 'number' ? formatTranscriptTime(card.audioStartSec) : null;

  return (
    <View style={styles.transcriptRow}>
      {timecode ? (
        <View style={styles.separator}>
          <LocalRecordingPlayButton
            diaryEntryId={card.diaryEntryId}
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
          <View style={[styles.rule, { backgroundColor: palette.border }]} />
        </View>
      ) : null}

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
