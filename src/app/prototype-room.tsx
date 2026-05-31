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

const SampleEnglishPairs = [
  {
    japanese: '今日は帰り道に、駅前でコーヒーを買いました。',
    english: 'I picked up coffee near the station on my way home today.',
  },
  {
    japanese: '少し遠回りして、いつもより静かな道を歩きました。',
    english: 'I took a small detour and walked down a quieter street than usual.',
  },
  {
    japanese: '夕方の光がきれいで、気持ちが少し落ち着きました。',
    english: 'The evening light was beautiful, and it helped me calm down a little.',
  },
] as const;
const EnglishTimecodes = ['00:04', '00:11', '00:18'] as const;

export default function PrototypeRoomScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
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

        <PrototypeSection eyebrow="English tab prototypes" title="カードじゃない英語タブ">
          <EnglishRuledTranscriptMock />
          <EnglishRuledTranscriptWideMock />
          <EnglishRuledTranscriptBaselineMock />
          <EnglishRuledTimecodeInsetMock />
          <EnglishRuledTimecodeInsetDenseMock />
          <EnglishRuledTimecodeInsetLeadMock />
          <EnglishRuledTimecodeTabMock />
          <EnglishRuledTimecodeTabOutlineMock />
          <EnglishRuledTimecodeTabHangingMock />
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

function EnglishRuledTranscriptMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Ruled Transcript">
      <View style={styles.englishRuledList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledRow}>
            {index > 0 ? (
              <View style={styles.englishRuledSeparator}>
                <ThemedText style={[styles.englishRuledTime, { color: palette.muted }]}>
                  {EnglishTimecodes[index]}
                </ThemedText>
                <View style={[styles.englishRuledRule, { backgroundColor: palette.border }]} />
              </View>
            ) : null}
            <View style={styles.englishRuledCopy}>
              <ThemedText style={styles.englishRuledEnglish}>{pair.english}</ThemedText>
              <ThemedText style={[styles.englishRuledJapanese, { color: palette.muted }]}>
                {pair.japanese}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTranscriptWideMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Ruled Transcript Wide Gap">
      <View style={styles.englishRuledWideList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledWideRow}>
            {index > 0 ? (
              <View style={styles.englishRuledWideSeparator}>
                <ThemedText style={[styles.englishRuledWideTime, { color: palette.muted }]}>
                  {EnglishTimecodes[index]}
                </ThemedText>
                <View style={[styles.englishRuledWideRule, { backgroundColor: palette.border }]} />
              </View>
            ) : null}
            <View style={styles.englishRuledWideCopy}>
              <ThemedText style={styles.englishRuledWideEnglish}>{pair.english}</ThemedText>
              <ThemedText style={[styles.englishRuledWideJapanese, { color: palette.muted }]}>
                {pair.japanese}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTranscriptBaselineMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Ruled Transcript Baseline">
      <View style={styles.englishRuledBaseList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledBaseRow}>
            {index > 0 ? (
              <View style={styles.englishRuledBaseSeparator}>
                <ThemedText style={[styles.englishRuledBaseTime, { color: RailColors[index] }]}>
                  {EnglishTimecodes[index]}
                </ThemedText>
                <View style={[styles.englishRuledBaseRule, { backgroundColor: palette.border }]} />
              </View>
            ) : null}
            <ThemedText style={styles.englishRuledBaseEnglish}>{pair.english}</ThemedText>
            <ThemedText style={[styles.englishRuledBaseJapanese, { color: palette.muted }]}>
              {pair.japanese}
            </ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTimecodeInsetMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Inset Timecode Rule">
      <View style={styles.englishRuledInsetList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledInsetRow}>
            {index > 0 ? (
              <View style={styles.englishRuledInsetSeparator}>
                <View style={[styles.englishRuledInsetStub, { backgroundColor: palette.border }]} />
                <ThemedText style={[styles.englishRuledInsetTime, { color: RailColors[index] }]}>
                  {EnglishTimecodes[index]}
                </ThemedText>
                <View style={[styles.englishRuledInsetRule, { backgroundColor: palette.border }]} />
              </View>
            ) : null}
            <ThemedText style={styles.englishRuledInsetEnglish}>{pair.english}</ThemedText>
            <ThemedText style={[styles.englishRuledInsetJapanese, { color: palette.muted }]}>
              {pair.japanese}
            </ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTimecodeInsetDenseMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Dense Inset Rule">
      <View style={styles.englishRuledDenseList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledDenseRow}>
            {index > 0 ? (
              <View style={styles.englishRuledDenseSeparator}>
                <View style={[styles.englishRuledDenseStub, { backgroundColor: palette.border }]} />
                <ThemedText style={[styles.englishRuledDenseTime, { color: palette.muted }]}>
                  {EnglishTimecodes[index]}
                </ThemedText>
                <View style={[styles.englishRuledDenseRule, { backgroundColor: palette.border }]} />
              </View>
            ) : null}
            <ThemedText style={styles.englishRuledDenseEnglish}>{pair.english}</ThemedText>
            <ThemedText style={[styles.englishRuledDenseJapanese, { color: palette.muted }]}>
              {pair.japanese}
            </ThemedText>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTimecodeInsetLeadMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Lead Inset Rule">
      <View style={styles.englishRuledLeadList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledLeadRow}>
            {index > 0 ? (
              <View style={styles.englishRuledLeadSeparator}>
                <View style={[styles.englishRuledLeadStub, { backgroundColor: palette.border }]} />
                <ThemedText style={[styles.englishRuledLeadTime, { color: RailColors[index] }]}>
                  {EnglishTimecodes[index]}
                </ThemedText>
                <View style={[styles.englishRuledLeadRule, { backgroundColor: palette.border }]} />
              </View>
            ) : null}
            <View style={styles.englishRuledLeadCopy}>
              <ThemedText style={styles.englishRuledLeadEnglish}>{pair.english}</ThemedText>
              <ThemedText style={[styles.englishRuledLeadJapanese, { color: palette.muted }]}>
                {pair.japanese}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTimecodeTabMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Timecode Tab Rule">
      <View style={styles.englishRuledTabList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledTabRow}>
            {index > 0 ? (
              <View style={styles.englishRuledTabSeparator}>
                <View style={[styles.englishRuledTabPlate, { backgroundColor: RailColors[index] }]}>
                  <ThemedText style={styles.englishRuledTabTime}>{EnglishTimecodes[index]}</ThemedText>
                </View>
                <View style={[styles.englishRuledTabRule, { backgroundColor: palette.border }]} />
              </View>
            ) : null}
            <View style={styles.englishRuledTabCopy}>
              <ThemedText style={styles.englishRuledTabEnglish}>{pair.english}</ThemedText>
              <ThemedText style={[styles.englishRuledTabJapanese, { color: palette.muted }]}>
                {pair.japanese}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTimecodeTabOutlineMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Outline Tab Rule">
      <View style={styles.englishRuledOutlineTabList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledOutlineTabRow}>
            {index > 0 ? (
              <View style={styles.englishRuledOutlineTabSeparator}>
                <View
                  style={[
                    styles.englishRuledOutlineTabPlate,
                    { borderColor: RailColors[index] },
                  ]}>
                  <ThemedText
                    style={[styles.englishRuledOutlineTabTime, { color: RailColors[index] }]}>
                    {EnglishTimecodes[index]}
                  </ThemedText>
                </View>
                <View
                  style={[styles.englishRuledOutlineTabRule, { backgroundColor: palette.border }]}
                />
              </View>
            ) : null}
            <View style={styles.englishRuledOutlineTabCopy}>
              <ThemedText style={styles.englishRuledOutlineTabEnglish}>{pair.english}</ThemedText>
              <ThemedText style={[styles.englishRuledOutlineTabJapanese, { color: palette.muted }]}>
                {pair.japanese}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </MockBlock>
  );
}

function EnglishRuledTimecodeTabHangingMock() {
  const palette = useDailyPalette();

  return (
    <MockBlock title="Hanging Tab Rule">
      <View style={styles.englishRuledHangingTabList}>
        {SampleEnglishPairs.map((pair, index) => (
          <View key={pair.english} style={styles.englishRuledHangingTabRow}>
            {index > 0 ? (
              <View style={styles.englishRuledHangingTabSeparator}>
                <View
                  style={[
                    styles.englishRuledHangingTabRule,
                    { backgroundColor: palette.border },
                  ]}
                />
                <View
                  style={[
                    styles.englishRuledHangingTabPlate,
                    { backgroundColor: RailColors[index] },
                  ]}>
                  <ThemedText style={styles.englishRuledHangingTabTime}>
                    {EnglishTimecodes[index]}
                  </ThemedText>
                </View>
              </View>
            ) : null}
            <ThemedText style={styles.englishRuledHangingTabEnglish}>{pair.english}</ThemedText>
            <ThemedText style={[styles.englishRuledHangingTabJapanese, { color: palette.muted }]}>
              {pair.japanese}
            </ThemedText>
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
  englishRuledList: {
    gap: Spacing.three,
  },
  englishRuledRow: {
    gap: Spacing.three,
  },
  englishRuledSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  englishRuledTime: {
    width: 44,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledRule: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  englishRuledCopy: {
    gap: Spacing.one,
  },
  englishRuledEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  englishRuledJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  englishRuledWideList: {
    gap: Spacing.four,
  },
  englishRuledWideRow: {
    gap: Spacing.three,
  },
  englishRuledWideSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  englishRuledWideTime: {
    width: 58,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledWideRule: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  englishRuledWideCopy: {
    gap: Spacing.one,
  },
  englishRuledWideEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  englishRuledWideJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  englishRuledBaseList: {
    gap: Spacing.three,
  },
  englishRuledBaseRow: {
    gap: Spacing.one,
  },
  englishRuledBaseSeparator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  englishRuledBaseTime: {
    width: 46,
    paddingBottom: 1,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledBaseRule: {
    flex: 1,
    height: 2,
    borderRadius: 999,
    marginBottom: 4,
  },
  englishRuledBaseEnglish: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: 900,
  },
  englishRuledBaseJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  englishRuledInsetList: {
    gap: Spacing.three,
  },
  englishRuledInsetRow: {
    gap: Spacing.two,
  },
  englishRuledInsetSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  englishRuledInsetStub: {
    width: 14,
    height: 2,
    borderRadius: 999,
  },
  englishRuledInsetTime: {
    width: 44,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledInsetRule: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  englishRuledInsetEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  englishRuledInsetJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  englishRuledDenseList: {
    gap: Spacing.three,
  },
  englishRuledDenseRow: {
    gap: Spacing.one,
  },
  englishRuledDenseSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  englishRuledDenseStub: {
    width: 8,
    height: 2,
    borderRadius: 999,
  },
  englishRuledDenseTime: {
    width: 42,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledDenseRule: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  englishRuledDenseEnglish: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: 900,
  },
  englishRuledDenseJapanese: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: 700,
  },
  englishRuledLeadList: {
    gap: Spacing.four,
  },
  englishRuledLeadRow: {
    gap: Spacing.two,
  },
  englishRuledLeadSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  englishRuledLeadStub: {
    width: 34,
    height: 2,
    borderRadius: 999,
  },
  englishRuledLeadTime: {
    width: 44,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledLeadRule: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  englishRuledLeadCopy: {
    gap: Spacing.one,
    paddingLeft: 18,
  },
  englishRuledLeadEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  englishRuledLeadJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  englishRuledTabList: {
    gap: Spacing.three,
  },
  englishRuledTabRow: {
    gap: Spacing.two,
  },
  englishRuledTabSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  englishRuledTabPlate: {
    minWidth: 56,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111111',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  englishRuledTabTime: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledTabRule: {
    flex: 1,
    height: 3,
    borderRadius: 999,
  },
  englishRuledTabCopy: {
    gap: Spacing.one,
  },
  englishRuledTabEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  englishRuledTabJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  englishRuledOutlineTabList: {
    gap: Spacing.three,
  },
  englishRuledOutlineTabRow: {
    gap: Spacing.two,
  },
  englishRuledOutlineTabSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  englishRuledOutlineTabPlate: {
    minWidth: 56,
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  englishRuledOutlineTabTime: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledOutlineTabRule: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  englishRuledOutlineTabCopy: {
    gap: Spacing.one,
  },
  englishRuledOutlineTabEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  englishRuledOutlineTabJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  englishRuledHangingTabList: {
    gap: Spacing.four,
  },
  englishRuledHangingTabRow: {
    gap: Spacing.two,
  },
  englishRuledHangingTabSeparator: {
    position: 'relative',
    minHeight: 25,
    justifyContent: 'center',
  },
  englishRuledHangingTabRule: {
    height: 3,
    borderRadius: 999,
  },
  englishRuledHangingTabPlate: {
    position: 'absolute',
    left: 0,
    top: 0,
    minWidth: 58,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111111',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  englishRuledHangingTabTime: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  englishRuledHangingTabEnglish: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 900,
  },
  englishRuledHangingTabJapanese: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
});
