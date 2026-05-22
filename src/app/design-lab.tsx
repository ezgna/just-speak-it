import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import {
  FOUNDATION_SCROLL_PRESS_DELAY_MS,
  FoundationSurface,
  FoundationSurfacePressDelayProvider,
} from '@/components/ui/foundation-surface';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const AdoptedFoundationDistance = 0.56;
const FoundationBorderColor = '#111111';

function LabSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionEyebrow}>
        <ThemedText type="code" style={styles.sectionEyebrowText}>
          {eyebrow}
        </ThemedText>
      </View>
      <ThemedText type="subtitle" style={styles.labTitle} selectable>
        {title}
      </ThemedText>
      <ThemedText style={styles.labDescription} selectable>
        {description}
      </ThemedText>
    </View>
  );
}

function ButtonSourceShelf() {
  return (
    <View style={styles.buttonSourceShelf}>
      <View style={styles.buttonSourceCopy}>
        <ThemedText style={styles.buttonSourceTitle} selectable>
          Glide Button Source
        </ThemedText>
        <ThemedText style={styles.buttonSourceDescription} selectable>
          斜め下近接土台の元ボタン。サイズ差だけを比較するための基準。
        </ThemedText>
      </View>

      <View style={styles.buttonSourceGrid}>
        <ButtonSourceSample label="large">
          <GlideButton
            label="つづける"
            tone="mint"
            caption="アクセント方向"
            icon={{ ios: 'arrow.forward', android: 'arrow_forward', web: 'arrow_forward' }}
          />
        </ButtonSourceSample>

        <ButtonSourceSample label="medium">
          <GlideButton
            label="言えた"
            tone="green"
            size="medium"
            icon={{ ios: 'checkmark', android: 'check', web: 'check' }}
          />
        </ButtonSourceSample>

        <ButtonSourceSample label="compact">
          <GlideButton label="スキップ" tone="cream" size="compact" fullWidth={false} />
        </ButtonSourceSample>
      </View>
    </View>
  );
}

function ButtonSourceSample({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.buttonSourceSample}>
      <ThemedText style={styles.buttonSourceLabel}>{label}</ThemedText>
      {children}
    </View>
  );
}

type DiaryConceptEntry = {
  id: string;
  date: string;
  title: string;
  body: string;
  cardCount: number;
  source: string;
  accent: string;
};

const DiaryConceptEntries: DiaryConceptEntry[] = [
  {
    id: 'bakery',
    date: '今日 18:42',
    title: '帰り道のパン屋',
    body: '今日は帰り道に、ずっと気になっていたパン屋に寄りました。',
    cardCount: 4,
    source: '音声',
    accent: '#276EF1',
  },
  {
    id: 'meeting',
    date: '昨日 09:18',
    title: '朝の会議',
    body: '朝の会議で話したことを、あとで英語でも説明できるようにしたいです。',
    cardCount: 3,
    source: '手入力',
    accent: '#2FDD6C',
  },
  {
    id: 'shopping',
    date: '5月20日',
    title: '疲れていた日の買い物',
    body: '今日は少し疲れていたけれど、帰る前に買い物だけ済ませました。',
    cardCount: 2,
    source: '音声',
    accent: '#FF7661',
  },
];

function DiaryTabConcept({ columnWidth }: { columnWidth: ViewStyle['width'] }) {
  return (
    <View style={styles.diaryTabMockup}>
      <View style={styles.diaryHero}>
        <View style={styles.diaryHeroCopy}>
          <View style={styles.diaryHeroKicker}>
            <ThemedText style={styles.diaryHeroKickerText}>日記タブ案</ThemedText>
          </View>
          <ThemedText style={styles.diaryHeroTitle} selectable>
            今日のことば置き場
          </ThemedText>
          <ThemedText style={styles.diaryHeroText} selectable>
            書いた日記を、英語カードへ送る前の素材として扱う一覧画面。
          </ThemedText>
        </View>
        <View style={styles.diaryHeroActions}>
          <GlideButton
            label="今日を書く"
            tone="blue"
            caption="new diary"
            icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
          />
          <GlideButton
            label="音声で残す"
            tone="cream"
            icon={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
            iconSide="left"
            size="compact"
            fullWidth={false}
          />
        </View>
      </View>

      <View style={styles.diarySummaryRow}>
        <DiarySummaryPuck label="日記" value="12" color="#FFF9EC" />
        <DiarySummaryPuck label="カード" value="31" color="#2FDD6C" />
        <DiarySummaryPuck label="今週" value="5" color="#FFE2A6" />
      </View>

      <View style={styles.diaryBodyGrid}>
        <View style={[styles.diaryBodyColumn, { width: columnWidth }]}>
          <DiaryFocusCard />
        </View>
        <View style={[styles.diaryBodyColumn, { width: columnWidth }]}>
          <View style={styles.diaryTimeline}>
            {DiaryConceptEntries.map((entry) => (
              <DiaryTimelineItem key={entry.id} entry={entry} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function DiarySummaryPuck({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={[styles.diarySummaryPuck, { backgroundColor: color }]}>
      <ThemedText style={styles.diarySummaryValue}>{value}</ThemedText>
      <ThemedText style={styles.diarySummaryLabel}>{label}</ThemedText>
    </View>
  );
}

function DiaryFocusCard() {
  return (
    <RaisedPanel surfaceColor="#111111" style={styles.diaryFocusCard}>
      <View style={styles.diaryFocusTopRow}>
        <View style={styles.diaryFocusMark}>
          <SymbolView
            name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            size={16}
            tintColor="#111111"
          />
        </View>
        <ThemedText style={styles.diaryFocusDate}>今日 18:42</ThemedText>
      </View>

      <View style={styles.diaryFocusBody}>
        <ThemedText style={styles.diaryFocusTitle} selectable>
          帰り道のパン屋
        </ThemedText>
        <ThemedText style={styles.diaryFocusText} selectable>
          今日は帰り道に、ずっと気になっていたパン屋に寄りました。
        </ThemedText>
      </View>

      <View style={styles.diaryFocusFooter}>
        <View style={styles.diaryCardCountBadge}>
          <ThemedText style={styles.diaryCardCountText}>英語カード4件</ThemedText>
        </View>
        <GlideButton label="全文" tone="mint" size="compact" fullWidth={false} />
      </View>
    </RaisedPanel>
  );
}

function DiaryTimelineItem({ entry }: { entry: DiaryConceptEntry }) {
  return (
    <View style={styles.diaryTimelineItem}>
      <View style={[styles.diaryTimelineDot, { backgroundColor: entry.accent }]} />
      <View style={styles.diaryTimelineContent}>
        <View style={styles.diaryTimelineMeta}>
          <ThemedText style={styles.diaryTimelineDate}>{entry.date}</ThemedText>
          <ThemedText style={styles.diaryTimelineSource}>
            {entry.source} / {entry.cardCount}件
          </ThemedText>
        </View>
        <ThemedText style={styles.diaryTimelineTitle} selectable>
          {entry.title}
        </ThemedText>
        <ThemedText style={styles.diaryTimelineBody} numberOfLines={2} selectable>
          {entry.body}
        </ThemedText>
      </View>
    </View>
  );
}

function RaisedPanel({
  children,
  style,
  surfaceColor = '#FFF9EC',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  surfaceColor?: string;
}) {
  return (
    <FoundationSurface
      accessibilityRole="summary"
      foundationDepth={7}
      foundationDistanceScale={AdoptedFoundationDistance}
      foundationDirection="diagonal"
      foundationColor={FoundationBorderColor}
      style={[
        styles.raisedPanel,
        {
          backgroundColor: surfaceColor,
        },
        style,
      ]}>
      {children}
    </FoundationSurface>
  );
}

function PressboardHeader() {
  return (
    <View style={styles.pressboardHeader}>
      <View style={styles.brandStamp}>
        <SymbolView
          name={{ ios: 'pencil.and.list.clipboard', android: 'edit_note', web: 'edit_note' }}
          size={19}
          tintColor="#111111"
        />
      </View>
      <View style={styles.pressboardTitleBlock}>
        <ThemedText style={styles.pressboardTitle} selectable>
          Daily Pressboard
        </ThemedText>
        <ThemedText style={styles.pressboardSubtitle} selectable>
          日本語の紙片を押して、英語のカードへ送る
        </ThemedText>
      </View>
      <View style={styles.dayBadge}>
        <ThemedText style={styles.dayBadgeText}>DAY 18</ThemedText>
      </View>
    </View>
  );
}

function JapaneseSlip() {
  return (
    <RaisedPanel style={styles.japaneseSlip}>
      <View style={styles.slipTopRow}>
        <View style={styles.slipPin} />
        <ThemedText style={styles.slipLabel}>今日の日本語</ThemedText>
      </View>
      <ThemedText style={styles.japaneseText} selectable>
        今日は帰り道に、ずっと気になっていたパン屋に寄りました。
      </ThemedText>
      <View style={styles.slipFooter}>
        <ThemedText style={styles.slipFooterText}>1文</ThemedText>
        <ThemedText style={styles.slipFooterText}>18:42</ThemedText>
      </View>
    </RaisedPanel>
  );
}

function EnglishPlate() {
  return (
    <RaisedPanel surfaceColor="#111111" style={styles.englishPlate}>
      <View style={styles.plateHeader}>
        <ThemedText style={styles.plateLabel}>English Card</ThemedText>
        <View style={styles.plateDot} />
      </View>
      <ThemedText style={styles.englishText} selectable>
        I stopped by the bakery I had been curious about on my way home.
      </ThemedText>
      <View style={styles.phraseChipRow}>
        <View style={[styles.phraseChip, styles.mintChip]}>
          <ThemedText style={styles.phraseChipText}>on my way home</ThemedText>
        </View>
        <View style={[styles.phraseChip, styles.amberChip]}>
          <ThemedText style={styles.phraseChipText}>curious about</ThemedText>
        </View>
      </View>
    </RaisedPanel>
  );
}

function ActionWorkbench() {
  return (
    <View style={styles.workbenchActions}>
      <GlideButton
        label="英語にする"
        tone="blue"
        caption="今日の1文"
        icon={{ ios: 'arrow.forward', android: 'arrow_forward', web: 'arrow_forward' }}
      />
      <View style={styles.compactActionRow}>
        <GlideButton
          label="下書き"
          tone="cream"
          icon={{ ios: 'tray.and.arrow.down.fill', android: 'save', web: 'save' }}
          iconSide="left"
          size="compact"
          fullWidth={false}
        />
        <GlideButton
          label="音声"
          tone="amber"
          icon={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
          iconSide="left"
          size="compact"
          fullWidth={false}
        />
      </View>
    </View>
  );
}

function ReviewDock() {
  return (
    <View style={styles.reviewDock}>
      <View style={styles.reviewQuestion}>
        <ThemedText style={styles.reviewLabel}>復習ドック</ThemedText>
        <ThemedText style={styles.reviewPrompt} selectable>
          「思ったより長く話した」を英語で言う
        </ThemedText>
      </View>
      <View style={styles.reviewActionRow}>
        <GlideButton
          label="もう一回"
          tone="amber"
          size="medium"
          containerStyle={styles.reviewAction}
        />
        <GlideButton
          label="言えた"
          tone="green"
          size="medium"
          containerStyle={styles.reviewAction}
        />
      </View>
    </View>
  );
}

function ProgressRail() {
  return (
    <View style={styles.progressRail}>
      <ProgressTile label="書いた" value="12" color="#2FDD6C" />
      <ProgressTile label="復習" value="8" color="#FFE2A6" />
      <ProgressTile label="連続" value="5" color="#FF7661" />
    </View>
  );
}

function ProgressTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <RaisedPanel surfaceColor={color} style={styles.progressTile}>
      <ThemedText style={styles.progressValue}>{value}</ThemedText>
      <ThemedText style={styles.progressLabel}>{label}</ThemedText>
    </RaisedPanel>
  );
}

export default function DesignLabScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const { width } = useWindowDimensions();
  const boardColumnWidth: ViewStyle['width'] = width >= 760 ? '48.2%' : '100%';
  const diaryColumnWidth: ViewStyle['width'] = width >= 760 ? '48.2%' : '100%';

  return (
    <FoundationSurfacePressDelayProvider pressDelay={FOUNDATION_SCROLL_PRESS_DELAY_MS}>
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
          <LabSectionHeader
            eyebrow="new direction"
            title="Pressboard"
            description="土台付きボタンの物理感を、画面全体の紙片・版・押し出し操作に広げた案。"
          />

          <ButtonSourceShelf />

          <DiaryTabConcept columnWidth={diaryColumnWidth} />

          <View style={styles.pressboard}>
            <PressboardHeader />

            <View style={styles.boardBody}>
              <View style={[styles.boardColumn, { width: boardColumnWidth }]}>
                <JapaneseSlip />
                <ActionWorkbench />
              </View>

              <View style={[styles.boardColumn, { width: boardColumnWidth }]}>
                <EnglishPlate />
                <ReviewDock />
              </View>
            </View>

            <ProgressRail />
          </View>
        </View>
      </ScrollView>
    </FoundationSurfacePressDelayProvider>
  );
}

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
  sectionHeader: {
    gap: Spacing.two,
  },
  sectionEyebrow: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#E8F7F4',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  sectionEyebrowText: {
    color: '#088A81',
  },
  labTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 900,
  },
  labDescription: {
    color: '#5F6670',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: 700,
  },
  buttonSourceShelf: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  buttonSourceCopy: {
    gap: Spacing.one,
  },
  buttonSourceTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  buttonSourceDescription: {
    color: '#5C4B32',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 800,
  },
  buttonSourceGrid: {
    gap: Spacing.two,
  },
  buttonSourceSample: {
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  buttonSourceLabel: {
    color: '#6E604C',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  diaryTabMockup: {
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: '#111111',
    backgroundColor: '#DFF4EC',
    gap: Spacing.three,
    padding: Spacing.three,
    boxShadow: '0 18px 0 rgba(8, 138, 129, 0.16)',
  },
  diaryHero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignItems: 'flex-end',
  },
  diaryHeroCopy: {
    flex: 1,
    minWidth: 240,
    gap: Spacing.two,
  },
  diaryHeroKicker: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  diaryHeroKickerText: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  diaryHeroTitle: {
    color: '#111111',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 900,
  },
  diaryHeroText: {
    color: '#244A42',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: 800,
  },
  diaryHeroActions: {
    minWidth: 220,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  diarySummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  diarySummaryPuck: {
    flexGrow: 1,
    flexBasis: 92,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  diarySummaryValue: {
    color: '#111111',
    fontSize: 27,
    lineHeight: 31,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  diarySummaryLabel: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  diaryBodyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  diaryBodyColumn: {
    gap: Spacing.three,
  },
  diaryFocusCard: {
    minHeight: 292,
  },
  diaryFocusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  diaryFocusMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#2FDD6C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryFocusDate: {
    color: '#A8F3C0',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  diaryFocusBody: {
    gap: Spacing.two,
  },
  diaryFocusTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 900,
  },
  diaryFocusText: {
    color: '#F2F7F4',
    fontSize: 17,
    lineHeight: 27,
    fontWeight: 800,
  },
  diaryFocusFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  diaryCardCountBadge: {
    borderRadius: 999,
    backgroundColor: '#FFF9EC',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  diaryCardCountText: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
  },
  diaryTimeline: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  diaryTimelineItem: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
  },
  diaryTimelineDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#111111',
    marginTop: 3,
  },
  diaryTimelineContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  diaryTimelineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  diaryTimelineDate: {
    color: '#088A81',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  diaryTimelineSource: {
    color: '#6E604C',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  diaryTimelineTitle: {
    color: '#111111',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 900,
  },
  diaryTimelineBody: {
    color: '#4E594F',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 700,
  },
  pressboard: {
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: '#111111',
    backgroundColor: '#F6E7C8',
    gap: Spacing.three,
    padding: Spacing.three,
    boxShadow: '0 18px 0 rgba(17, 17, 17, 0.12)',
  },
  pressboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandStamp: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#2FDD6C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressboardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pressboardTitle: {
    color: '#111111',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: 900,
  },
  pressboardSubtitle: {
    color: '#3E3526',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
  },
  dayBadge: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dayBadgeText: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  boardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  boardColumn: {
    gap: Spacing.three,
  },
  raisedPanel: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  japaneseSlip: {
    minHeight: 188,
  },
  slipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slipPin: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FF7661',
  },
  slipLabel: {
    color: '#5C4B32',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  japaneseText: {
    color: '#111111',
    fontSize: 22,
    lineHeight: 32,
    fontWeight: 900,
  },
  slipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  slipFooterText: {
    color: '#6E604C',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  workbenchActions: {
    gap: Spacing.two,
  },
  compactActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  englishPlate: {
    minHeight: 188,
  },
  plateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  plateLabel: {
    color: '#A8F3C0',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  plateDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#276EF1',
  },
  englishText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 900,
  },
  phraseChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  phraseChip: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mintChip: {
    backgroundColor: '#2FDD6C',
  },
  amberChip: {
    backgroundColor: '#FFE2A6',
  },
  phraseChipText: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
  },
  reviewDock: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  reviewQuestion: {
    gap: Spacing.one,
  },
  reviewLabel: {
    color: '#088A81',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  reviewPrompt: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: 900,
  },
  reviewActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  reviewAction: {
    flex: 1,
  },
  progressRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  progressTile: {
    flexGrow: 1,
    flexBasis: 120,
    padding: Spacing.two,
    gap: 0,
    alignItems: 'center',
  },
  progressValue: {
    color: '#111111',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  progressLabel: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
});
