import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';

type DiaryMode = 'original' | 'bullets';

const BulletPoints = [
  '駅前でコーヒーを買った',
  'いつもより静かな道を遠回りして歩いた',
  '夕方の光がきれいで気持ちが落ち着いた',
  '明日はこの話を英語で自然に言いたい',
] as const;

const ModeLabels: Record<DiaryMode, string> = {
  original: '原文',
  bullets: '箇条書き',
};

export function DiaryDisplayPrototypeGallery() {
  return (
    <View style={styles.gallery}>
      <PrototypeSection
        eyebrow="Diary tab / Waveform component"
        title="波形表示パーツ案"
        description="同じ原文カード上で、波形の本数、太さ、gap、高さだけを比較する案。再生アイコンと秒数は固定して、波形部分の読みやすさを見る。"
        count={6}>
        <WaveformThickMiniPrototype />
        <WaveformChunkyPrototype />
        <WaveformRailPrototype />
        <WaveformSymmetricPrototype />
        <WaveformSegmentPrototype />
        <WaveformCompactLinePrototype />
      </PrototypeSection>

      <PrototypeSection
        eyebrow="Diary tab / Bullets"
        title="箇条書きの表示案"
        description="要点メモを本文とは別の読み方にする置き方。短く見返す、選ぶ、思い出す動作を試す。"
        count={5}>
        <BulletChecklistPrototype />
        <BulletTimelinePrototype />
        <BulletChipsPrototype />
        <BulletGridPrototype />
        <BulletIndexPrototype />
      </PrototypeSection>
    </View>
  );
}

function PrototypeSection({
  children,
  count,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  count: number;
  description: string;
  eyebrow: string;
  title: string;
}) {
  const palette = useDailyPalette();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleBlock}>
          <ThemedText style={[styles.eyebrow, { color: palette.muted }]}>{eyebrow}</ThemedText>
          <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: palette.muted }]} selectable>
            {description}
          </ThemedText>
        </View>
        <View style={styles.countPill}>
          <ThemedText style={styles.countText}>{count}案</ThemedText>
        </View>
      </View>
      <View style={styles.ideaList}>{children}</View>
    </View>
  );
}

function IdeaBlock({
  children,
  description,
  index,
  mode,
  title,
}: {
  children: ReactNode;
  description: string;
  index: number;
  mode: DiaryMode;
  title: string;
}) {
  const palette = useDailyPalette();

  return (
    <View style={[styles.ideaBlock, { borderTopColor: palette.border }]}>
      <View style={styles.ideaHeader}>
        <View style={styles.ideaNumber}>
          <ThemedText style={styles.ideaNumberText}>{String(index).padStart(2, '0')}</ThemedText>
        </View>
        <View style={styles.ideaCopy}>
          <View style={styles.ideaTitleRow}>
            <ThemedText style={styles.ideaTitle}>{title}</ThemedText>
            <ModePill mode={mode} />
          </View>
          <ThemedText style={[styles.ideaDescription, { color: palette.muted }]} selectable>
            {description}
          </ThemedText>
        </View>
      </View>
      {children}
    </View>
  );
}

function ModePill({ mode }: { mode: DiaryMode }) {
  return (
    <View style={styles.modePill}>
      <ThemedText style={styles.modePillText}>表示中: {ModeLabels[mode]}</ThemedText>
    </View>
  );
}

const WaveformPrototypeShape = [
  0.18, 0.32, 0.54, 0.28, 0.72, 0.42, 0.22, 0.64, 0.84, 0.36, 0.5, 0.68, 0.26, 0.44, 0.78,
  0.34, 0.2, 0.58, 0.74, 0.3, 0.48, 0.88, 0.4, 0.62,
] as const;

function buildWaveformPrototypeHeights(barCount: number, trackHeight: number) {
  return Array.from({ length: barCount }, (_, index) => {
    const shape = WaveformPrototypeShape[index % WaveformPrototypeShape.length];
    const wave = 0.5 + Math.sin(index * 0.63) * 0.16;
    const level = Math.max(0.08, Math.min(0.96, shape * 0.74 + wave * 0.26));
    return Math.round(7 + level * (trackHeight - 9));
  });
}

function WaveformOptionPreview({
  activeColor = '#276EF1',
  barCount,
  barGap,
  barWidth,
  baseline = false,
  inactiveColor = '#7AAFA9',
  surface = 'light',
  trackHeight,
}: {
  activeColor?: string;
  barCount: number;
  barGap: number;
  barWidth: number;
  baseline?: boolean;
  inactiveColor?: string;
  surface?: 'light' | 'paper' | 'dark';
  trackHeight: number;
}) {
  const heights = buildWaveformPrototypeHeights(barCount, trackHeight);
  const playedCount = Math.round(barCount * 0.42);
  const isDark = surface === 'dark';

  return (
    <View
      style={[
        styles.waveformOptionSurface,
        surface === 'paper' && styles.waveformOptionSurfacePaper,
        isDark && styles.waveformOptionSurfaceDark,
      ]}>
      <View style={styles.waveformOptionHeader}>
        <View style={[styles.waveformOptionPlay, isDark && styles.waveformOptionPlayDark]}>
          <ThemedText style={[styles.waveformOptionPlayIcon, isDark && styles.waveformOptionPlayIconDark]}>
            ▶
          </ThemedText>
        </View>
        <View style={styles.waveformOptionHeaderCopy}>
          <ThemedText style={[styles.waveformOptionMeta, isDark && styles.waveformOptionMetaDark]}>
            2026/06/02 0:43
          </ThemedText>
          <ThemedText style={[styles.waveformOptionSpec, isDark && styles.waveformOptionSpecDark]}>
            {`${barCount}本 / ${barWidth}px / gap ${barGap}px`}
          </ThemedText>
        </View>
        <ThemedText style={[styles.waveformOptionTime, isDark && styles.waveformOptionTimeDark]}>
          00:18
        </ThemedText>
      </View>
      <View style={[styles.waveformOptionTrack, { minHeight: trackHeight, gap: barGap }]}>
        {baseline && <View style={styles.waveformOptionBaseline} />}
        {heights.map((height, index) => (
          <View
            key={`${barCount}-${height}-${index}`}
            style={[
              styles.waveformOptionBar,
              {
                width: barWidth,
                height,
                backgroundColor: index <= playedCount ? activeColor : inactiveColor,
              },
            ]}
          />
        ))}
      </View>
      <ThemedText style={[styles.waveformOptionText, isDark && styles.waveformOptionTextDark]} selectable>
        今日は帰り道に、駅前でコーヒーを買いました。少し遠回りして、いつもより静かな道を歩きました。
      </ThemedText>
    </View>
  );
}

function WaveformThickMiniPrototype() {
  return (
    <IdeaBlock
      index={31}
      mode="original"
      title="太めミニ波形"
      description="40本、3px、gap 2。今の細かすぎる感じを減らし、日記カード内で一番バランスよく見せる案。">
      <WaveformOptionPreview barCount={40} barWidth={3} barGap={2} trackHeight={44} />
    </IdeaBlock>
  );
}

function WaveformChunkyPrototype() {
  return (
    <IdeaBlock
      index={32}
      mode="original"
      title="ブロック波形"
      description="30本、5px、gap 3。音声の細部より、録音の塊として見やすくする案。">
      <WaveformOptionPreview
        activeColor="#111111"
        barCount={30}
        barWidth={5}
        barGap={3}
        inactiveColor="#8AC7BE"
        surface="paper"
        trackHeight={42}
      />
    </IdeaBlock>
  );
}

function WaveformRailPrototype() {
  return (
    <IdeaBlock
      index={33}
      mode="original"
      title="レール付き波形"
      description="36本、3px、gap 2。中央の薄い基準線で、タップできるタイムライン感を強める案。">
      <WaveformOptionPreview
        activeColor="#276EF1"
        barCount={36}
        barWidth={3}
        barGap={2}
        baseline
        inactiveColor="#93B3AA"
        trackHeight={48}
      />
    </IdeaBlock>
  );
}

function WaveformSymmetricPrototype() {
  return (
    <IdeaBlock
      index={34}
      mode="original"
      title="上下対称波形"
      description="44本、2px、gap 2。音声編集アプリっぽい波形感を出しつつ、密度は抑える案。">
      <WaveformOptionPreview
        activeColor="#2FDD6C"
        barCount={44}
        barWidth={2}
        barGap={2}
        inactiveColor="#52606B"
        surface="dark"
        trackHeight={46}
      />
    </IdeaBlock>
  );
}

function WaveformSegmentPrototype() {
  return (
    <IdeaBlock
      index={35}
      mode="original"
      title="セグメント型"
      description="22本、8px、gap 3。波形というより、押しやすい音声 scrubber として見せる案。">
      <WaveformOptionPreview
        activeColor="#088A81"
        barCount={22}
        barWidth={8}
        barGap={3}
        inactiveColor="#BFD8D3"
        surface="paper"
        trackHeight={32}
      />
    </IdeaBlock>
  );
}

function WaveformCompactLinePrototype() {
  return (
    <IdeaBlock
      index={36}
      mode="original"
      title="細長ライン"
      description="52本、2px、gap 1。本文を邪魔しない控えめな表示。音声感は残しつつ高さを抑える案。">
      <WaveformOptionPreview
        activeColor="#D85642"
        barCount={52}
        barWidth={2}
        barGap={1}
        inactiveColor="#9BB6C7"
        trackHeight={28}
      />
    </IdeaBlock>
  );
}

function BulletChecklistPrototype() {
  return (
    <IdeaBlock
      index={16}
      mode="bullets"
      title="チェックリスト"
      description="要点を完了メモのように置く。英語化する内容を選びやすい。">
      <View style={styles.bulletChecklistSurface}>
        {BulletPoints.map((point) => (
          <View key={point} style={styles.bulletChecklistRow}>
            <View style={styles.checkBox} />
            <ThemedText style={styles.bulletChecklistText} selectable>
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    </IdeaBlock>
  );
}

function BulletTimelinePrototype() {
  return (
    <IdeaBlock
      index={17}
      mode="bullets"
      title="出来事タイムライン"
      description="要点を順番で思い出すための置き方。短い日記の流れが見える。">
      <View style={styles.bulletTimelineSurface}>
        <View style={styles.timelineRule} />
        {BulletPoints.map((point, index) => (
          <View key={point} style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: BulletColors[index] }]} />
            <ThemedText style={styles.timelineText} selectable>
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    </IdeaBlock>
  );
}

function BulletChipsPrototype() {
  return (
    <IdeaBlock
      index={18}
      mode="bullets"
      title="要点チップ"
      description="短いメモをタグのように置く。本文よりも、あとで拾うための面にする。">
      <View style={styles.bulletChipsSurface}>
        {BulletPoints.map((point, index) => (
          <View key={point} style={[styles.bulletChip, { backgroundColor: BulletSoftColors[index] }]}>
            <ThemedText style={styles.bulletChipText} selectable>
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    </IdeaBlock>
  );
}

function BulletGridPrototype() {
  return (
    <IdeaBlock
      index={19}
      mode="bullets"
      title="四分割メモ"
      description="要点ごとに面を分ける。箇条書きモードだけは一覧性を強くする案。">
      <View style={styles.bulletGridSurface}>
        {BulletPoints.map((point, index) => (
          <View key={point} style={styles.bulletGridCell}>
            <ThemedText style={styles.bulletGridIndex}>{index + 1}</ThemedText>
            <ThemedText style={styles.bulletGridText} selectable>
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    </IdeaBlock>
  );
}

function BulletIndexPrototype() {
  return (
    <IdeaBlock
      index={20}
      mode="bullets"
      title="番号インデックス"
      description="箇条書きを目次のように置く。長い日記でも要点へ戻りやすい。">
      <View style={styles.bulletIndexSurface}>
        {BulletPoints.map((point, index) => (
          <View key={point} style={styles.bulletIndexRow}>
            <ThemedText style={styles.bulletIndexNumber}>
              {String(index + 1).padStart(2, '0')}
            </ThemedText>
            <ThemedText style={styles.bulletIndexText} selectable>
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    </IdeaBlock>
  );
}

const BulletColors = ['#276EF1', '#088A81', '#D85642', '#B7791F'] as const;
const BulletSoftColors = ['#EAF1FF', '#E8F7F4', '#FFF0EC', '#FFF4D8'] as const;

const styles = StyleSheet.create({
  gallery: {
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  sectionTitleBlock: {
    flex: 1,
    minWidth: 240,
    gap: Spacing.one,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 900,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 700,
  },
  countPill: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#F4E75E',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  countText: {
    color: '#111111',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: 900,
  },
  ideaList: {
    gap: Spacing.four,
  },
  ideaBlock: {
    gap: Spacing.three,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  ideaNumber: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#2FDD6C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaNumberText: {
    color: '#111111',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  ideaCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  ideaTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  ideaTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 900,
  },
  ideaDescription: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 700,
  },
  modePill: {
    borderRadius: 999,
    backgroundColor: '#111111',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  modePillText: {
    color: '#FFF9EC',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  miniWaveRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  miniWaveBar: {
    width: 7,
    borderRadius: 999,
  },
  voiceColorEntry: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  voiceColorRail: {
    width: 7,
    alignSelf: 'stretch',
    borderRadius: 999,
  },
  voiceColorContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
  },
  voiceColorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  voiceColorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  voiceColorDate: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  voiceColorSpec: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  voiceColorTime: {
    width: 50,
    overflow: 'hidden',
    borderRadius: 8,
    paddingVertical: 1,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  voiceColorPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  voiceColorPlay: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 3,
  },
  voiceColorPlayIcon: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 900,
  },
  voiceColorWave: {
    minHeight: 42,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    overflow: 'hidden',
  },
  voiceColorBar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 5,
    minWidth: 3,
    maxWidth: 7,
    borderRadius: 999,
  },
  voiceColorText: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: 800,
  },
  waveformOptionSurface: {
    gap: Spacing.three,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#EAF1FF',
    padding: Spacing.three,
  },
  waveformOptionSurfacePaper: {
    backgroundColor: '#F8F6EF',
  },
  waveformOptionSurfaceDark: {
    backgroundColor: '#101216',
  },
  waveformOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  waveformOptionPlay: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#F4E75E',
  },
  waveformOptionPlayDark: {
    borderColor: '#FFF9EC',
    backgroundColor: '#2FDD6C',
  },
  waveformOptionPlayIcon: {
    color: '#111111',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 900,
  },
  waveformOptionPlayIconDark: {
    color: '#101216',
  },
  waveformOptionHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  waveformOptionMeta: {
    color: '#276EF1',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: 900,
  },
  waveformOptionMetaDark: {
    color: '#A9F5C4',
  },
  waveformOptionSpec: {
    color: '#5F6670',
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  waveformOptionSpecDark: {
    color: '#AEB7C2',
  },
  waveformOptionTime: {
    width: 48,
    color: '#111111',
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  waveformOptionTimeDark: {
    color: '#FFF9EC',
  },
  waveformOptionTrack: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  waveformOptionBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    backgroundColor: '#C9D4E8',
  },
  waveformOptionBar: {
    flexShrink: 0,
    borderRadius: 999,
  },
  waveformOptionText: {
    color: '#111111',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: 800,
  },
  waveformOptionTextDark: {
    color: '#FFF9EC',
  },
  rawTranscriptSurface: {
    gap: Spacing.two,
    backgroundColor: '#101216',
    padding: Spacing.three,
  },
  rawTranscriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E8664F',
  },
  rawTranscriptMeta: {
    color: '#AEB7C2',
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
  rawTranscriptLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  rawTranscriptTime: {
    width: 48,
    color: '#7D8794',
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 22,
    fontWeight: 800,
  },
  rawTranscriptText: {
    flex: 1,
    minWidth: 0,
    color: '#FFF9EC',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: 700,
  },
  rawWaveSurface: {
    gap: Spacing.three,
    backgroundColor: '#EAF1FF',
    padding: Spacing.three,
  },
  waveRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  waveBar: {
    width: 8,
    borderRadius: 999,
    backgroundColor: '#276EF1',
  },
  rawWaveText: {
    color: '#111111',
    fontSize: 16,
    lineHeight: 27,
    fontWeight: 800,
  },
  rawNotebookSurface: {
    gap: 0,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFFFFF',
  },
  rawNotebookRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#D8D8D8',
  },
  rawNotebookIndex: {
    width: 42,
    paddingVertical: Spacing.two,
    color: '#8A7665',
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 22,
    fontWeight: 900,
    textAlign: 'center',
  },
  rawNotebookText: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.two,
    paddingRight: Spacing.two,
    color: '#111111',
    fontFamily: Fonts.mono,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: 700,
  },
  rawSpeechSurface: {
    gap: Spacing.two,
    backgroundColor: '#F6F2EA',
    padding: Spacing.three,
  },
  rawSpeechBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    borderWidth: 3,
    borderColor: '#111111',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rawSpeechBubbleAlt: {
    alignSelf: 'flex-end',
    backgroundColor: '#E8F7F4',
  },
  rawSpeechText: {
    color: '#111111',
    fontSize: 16,
    lineHeight: 25,
    fontWeight: 800,
  },
  rawReceiptSurface: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 420,
    gap: Spacing.two,
    backgroundColor: '#FFF9EC',
    padding: Spacing.three,
  },
  rawReceiptTitle: {
    color: '#111111',
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    textAlign: 'center',
  },
  rawReceiptRule: {
    height: 2,
    backgroundColor: '#111111',
  },
  rawReceiptText: {
    color: '#111111',
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 23,
    fontWeight: 700,
  },
  greenOriginalSurface: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderWidth: 2,
    padding: Spacing.three,
  },
  greenOriginalRail: {
    width: 7,
    alignSelf: 'stretch',
    borderRadius: 999,
  },
  greenOriginalContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
  },
  greenOriginalHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  greenOriginalDatePill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  greenOriginalDate: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  greenOriginalLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  greenOriginalRule: {
    height: 2,
    borderRadius: 999,
  },
  greenOriginalText: {
    fontSize: 18,
    lineHeight: 30,
    fontWeight: 800,
  },
  plainPageSurface: {
    gap: Spacing.three,
    backgroundColor: '#FFF0EC',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  plainPageDate: {
    color: '#D85642',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 900,
  },
  plainPageText: {
    color: '#111111',
    fontSize: 19,
    lineHeight: 32,
    fontWeight: 800,
  },
  plainRailSurface: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
  },
  plainRail: {
    width: 10,
    borderRadius: 999,
    backgroundColor: '#088A81',
  },
  plainRailText: {
    flex: 1,
    minWidth: 0,
    color: '#111111',
    fontSize: 18,
    lineHeight: 31,
    fontWeight: 800,
  },
  plainRibbonSurface: {
    gap: Spacing.three,
    backgroundColor: '#F6F2EA',
    padding: Spacing.three,
  },
  plainRibbon: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4E75E',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  plainRibbonText: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 900,
  },
  plainRibbonBody: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 30,
    fontWeight: 800,
  },
  plainStickyFrame: {
    alignItems: 'center',
    backgroundColor: '#E8F7F4',
    padding: Spacing.four,
  },
  plainStickySurface: {
    width: '92%',
    maxWidth: 520,
    gap: Spacing.three,
    backgroundColor: '#FFF4D8',
    padding: Spacing.four,
    transform: [{ rotate: '-1deg' }],
  },
  plainStickyTape: {
    alignSelf: 'center',
    width: 82,
    height: 16,
    backgroundColor: '#FFFFFF',
    opacity: 0.72,
  },
  plainStickyText: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 30,
    fontWeight: 800,
  },
  plainColumnsSurface: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
  },
  plainColumn: {
    flex: 1,
    minWidth: 220,
    borderTopWidth: 5,
    borderTopColor: '#D85642',
    paddingTop: Spacing.two,
  },
  plainColumnText: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 29,
    fontWeight: 800,
  },
  polishedEssaySurface: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    backgroundColor: '#FFF9EC',
    padding: Spacing.four,
  },
  polishedEssayLead: {
    color: '#D85642',
    fontFamily: Fonts.serif,
    fontSize: 56,
    lineHeight: 62,
    fontWeight: 900,
  },
  polishedEssayText: {
    flex: 1,
    minWidth: 0,
    color: '#111111',
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 34,
    fontWeight: 800,
  },
  polishedQuietSurface: {
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  polishedQuietText: {
    maxWidth: 500,
    color: '#111111',
    fontSize: 21,
    lineHeight: 37,
    fontWeight: 900,
  },
  polishedMarkerSurface: {
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    padding: Spacing.four,
  },
  polishedMarkerText: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 31,
    fontWeight: 800,
  },
  polishedHighlight: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4E75E',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  polishedHighlightText: {
    color: '#111111',
    fontSize: 19,
    lineHeight: 31,
    fontWeight: 900,
  },
  polishedReaderSurface: {
    gap: Spacing.three,
    backgroundColor: '#101216',
    padding: Spacing.four,
  },
  polishedReaderText: {
    color: '#FFF9EC',
    fontSize: 20,
    lineHeight: 34,
    fontWeight: 900,
  },
  readerTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#3D4653',
  },
  readerFill: {
    width: '78%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2FDD6C',
  },
  polishedPracticeSurface: {
    gap: Spacing.two,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF0EC',
    padding: Spacing.four,
  },
  polishedPracticeKicker: {
    color: '#D85642',
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  polishedPracticeText: {
    color: '#111111',
    fontSize: 24,
    lineHeight: 38,
    fontWeight: 900,
  },
  bulletChecklistSurface: {
    gap: Spacing.two,
    backgroundColor: '#E9F7EE',
    padding: Spacing.three,
  },
  bulletChecklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFFFFF',
    marginTop: 3,
  },
  bulletChecklistText: {
    flex: 1,
    minWidth: 0,
    color: '#111111',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: 900,
  },
  bulletTimelineSurface: {
    position: 'relative',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.three,
  },
  timelineRule: {
    position: 'absolute',
    left: 36,
    top: Spacing.three,
    bottom: Spacing.three,
    width: 3,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    marginLeft: -2,
    marginTop: 4,
  },
  timelineText: {
    flex: 1,
    minWidth: 0,
    color: '#111111',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: 900,
  },
  bulletChipsSurface: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    backgroundColor: '#101216',
    padding: Spacing.three,
  },
  bulletChip: {
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#111111',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bulletChipText: {
    color: '#111111',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 900,
  },
  bulletGridSurface: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    backgroundColor: '#F6F2EA',
    padding: Spacing.three,
  },
  bulletGridCell: {
    flexGrow: 1,
    flexBasis: 240,
    minHeight: 112,
    justifyContent: 'space-between',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
  },
  bulletGridIndex: {
    color: '#D85642',
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  bulletGridText: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 27,
    fontWeight: 900,
  },
  bulletIndexSurface: {
    gap: 0,
    backgroundColor: '#FFF9EC',
    paddingHorizontal: Spacing.three,
  },
  bulletIndexRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#D8C7C2',
    paddingVertical: Spacing.three,
  },
  bulletIndexNumber: {
    width: 36,
    color: '#088A81',
    fontFamily: Fonts.mono,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  bulletIndexText: {
    flex: 1,
    minWidth: 0,
    color: '#111111',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: 900,
  },
});
