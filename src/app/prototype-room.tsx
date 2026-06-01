import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemedText } from '@/components/themed-text';
import { TranscriptionModelComparisonLab } from '@/components/transcription-model-comparison-lab';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const SampleSplitCards = [
  '今日は帰り道に、駅前でコーヒーを買いました。',
  '少し遠回りして、いつもより静かな道を歩きました。',
  '夕方の光がきれいで、気持ちが少し落ち着きました。',
  '明日はこの話を英語で自然に言えるようにしたいです。',
] as const;

export default function PrototypeRoomScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      <View style={styles.container}>
        <TranscriptionModelComparisonLab />

        <PrototypeSection eyebrow="Split output prototypes" title="カードじゃない一覧">
          <RailMock />
          <TranscriptMock />
          <BandMock />
          <IndexMock />
          <ChipMock />
        </PrototypeSection>
      </View>
    </ScrollView>
  );
}

function PrototypeSection({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  const palette = useDailyPalette();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText style={[styles.eyebrow, { color: palette.muted }]}>{eyebrow}</ThemedText>
        <ThemedText style={styles.title}>{title}</ThemedText>
      </View>
      {children}
    </View>
  );
}

function MockBlock({ children, title }: { children: React.ReactNode; title: string }) {
  const palette = useDailyPalette();

  return (
    <View style={styles.mockBlock}>
      <View style={styles.mockHeader}>
        <View style={[styles.mockHeaderMark, { backgroundColor: palette.primary }]} />
        <ThemedText style={styles.mockTitle}>{title}</ThemedText>
      </View>
      {children}
    </View>
  );
}

function RailMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Rail">
      <View style={styles.railList}>
        <View style={[styles.railLine, { backgroundColor: palette.border }]} />
        {SampleSplitCards.map((text, index) => (
          <View key={text} style={styles.railItem}>
            <View style={[styles.railDot, { backgroundColor: RailColors[index] }]} />
            <ThemedText style={styles.railText}>{text}</ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function TranscriptMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Transcript">
      <View style={styles.transcriptList}>
        {SampleSplitCards.map((text, index) => (
          <View key={text} style={styles.transcriptRow}>
            <ThemedText style={[styles.transcriptIndex, { color: palette.muted }]}>
              {String(index + 1).padStart(2, '0')}
            </ThemedText>
            <ThemedText
              style={[
                styles.transcriptText,
                {
                  borderLeftColor: RailColors[index],
                },
              ]}>
              {text}
            </ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function BandMock() {
  return (
    <MockBlock title="Bands">
      <View style={styles.bandList}>
        {SampleSplitCards.map((text, index) => (
          <View
            key={text}
            style={[
              styles.band,
              {
                backgroundColor: BandColors[index],
              },
            ]}>
            <ThemedText style={styles.bandIndex}>{index + 1}</ThemedText>
            <ThemedText style={styles.bandText}>{text}</ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function IndexMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Index">
      <View style={styles.indexList}>
        {SampleSplitCards.map((text, index) => (
          <View
            key={text}
            style={[
              styles.indexRow,
              {
                borderBottomColor: palette.border,
              },
            ]}>
            <ThemedText style={[styles.indexNumber, { color: palette.muted }]}>
              {index + 1}
            </ThemedText>
            <ThemedText style={styles.indexText}>{text}</ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function ChipMock() {
  return (
    <MockBlock title="Chips">
      <View style={styles.chipWrap}>
        {SampleSplitCards.map((text, index) => (
          <View
            key={text}
            style={[
              styles.chip,
              {
                backgroundColor: ChipColors[index],
              },
            ]}>
            <ThemedText style={styles.chipText}>{text}</ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

const RailColors = ['#2FDD6C', '#65D7F2', '#FF9F45', '#9B7CFF'] as const;
const BandColors = ['#FFF6E7', '#E8F7F4', '#FFF4D8', '#F0EDFF'] as const;
const ChipColors = ['#F4E75E', '#B7E3F0', '#FFE2A6', '#FFB8AA'] as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.four,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 900,
  },
  mockBlock: {
    gap: Spacing.three,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mockHeaderMark: {
    width: 28,
    height: 10,
    borderRadius: 999,
  },
  mockTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 900,
  },
  railList: {
    position: 'relative',
    gap: Spacing.three,
    paddingLeft: 30,
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
    marginTop: 4,
  },
  railText: {
    flex: 1,
    minWidth: 0,
    fontSize: 19,
    lineHeight: 29,
    fontWeight: 800,
  },
  transcriptList: {
    gap: Spacing.two,
  },
  transcriptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  transcriptIndex: {
    width: 26,
    paddingTop: 3,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  transcriptText: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 5,
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: 800,
  },
  bandList: {
    gap: Spacing.two,
  },
  band: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 3,
    borderColor: '#111111',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bandIndex: {
    width: 28,
    color: '#111111',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  bandText: {
    flex: 1,
    minWidth: 0,
    color: '#111111',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: 900,
  },
  indexList: {
    gap: 0,
  },
  indexRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderBottomWidth: 1,
    paddingVertical: Spacing.three,
  },
  indexNumber: {
    width: 34,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  indexText: {
    flex: 1,
    minWidth: 0,
    fontSize: 19,
    lineHeight: 29,
    fontWeight: 700,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipText: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: 900,
  },
});
