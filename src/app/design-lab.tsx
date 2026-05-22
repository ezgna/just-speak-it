import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type CandidateTone = 'blue' | 'green' | 'amber';

const Candidates: {
  title: string;
  label: string;
  tone: CandidateTone;
  icon: SymbolViewProps['name'];
  japanese: string;
  english: string;
}[] = [
  {
    title: 'Review Console',
    label: '密度',
    tone: 'blue',
    icon: { ios: 'square.grid.2x2.fill', android: 'dashboard', web: 'dashboard' },
    japanese: '昨日、友だちと新しいカフェに行って、思ったより長く話しました。',
    english: 'I went to a new cafe with a friend yesterday and we ended up talking much longer than expected.',
  },
  {
    title: 'Phrase Card',
    label: 'カード',
    tone: 'green',
    icon: { ios: 'rectangle.stack.fill', android: 'view_carousel', web: 'view_carousel' },
    japanese: '今日は少し疲れていたけれど、帰る前に買い物だけ済ませました。',
    english: 'I was a bit tired today, but I still got the shopping done before heading home.',
  },
  {
    title: 'Quiet List',
    label: '一覧',
    tone: 'amber',
    icon: { ios: 'list.bullet.rectangle.fill', android: 'view_list', web: 'view_list' },
    japanese: '朝の会議で話したことを、あとで英語でも説明できるようにしたいです。',
    english: 'I want to be able to explain what we discussed in the morning meeting in English later.',
  },
];

export default function DesignLabScreen() {
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
        <View style={styles.candidateGrid}>
          {Candidates.map((candidate) => (
            <View
              key={candidate.title}
              style={[
                styles.candidateCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  boxShadow: palette.shadow,
                },
              ]}>
              <View style={styles.candidateHeader}>
                <View
                  style={[
                    styles.candidateIcon,
                    { backgroundColor: getToneSoftColor(candidate.tone, palette) },
                  ]}>
                  <SymbolView
                    name={candidate.icon}
                    size={18}
                    tintColor={getToneColor(candidate.tone, palette)}
                  />
                </View>
                <View style={styles.candidateTitleBlock}>
                  <ThemedText style={styles.candidateTitle} selectable>
                    {candidate.title}
                  </ThemedText>
                  <ThemedText type="code" style={{ color: getToneColor(candidate.tone, palette) }}>
                    {candidate.label}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.previewBody}>
                <ThemedText style={styles.previewJapanese} selectable>
                  {candidate.japanese}
                </ThemedText>
                <View style={[styles.previewDivider, { backgroundColor: palette.border }]} />
                <ThemedText style={styles.previewEnglish} selectable>
                  {candidate.english}
                </ThemedText>
              </View>

              <View style={styles.previewActions}>
                <View
                  style={[
                    styles.previewAction,
                    {
                      backgroundColor: palette.amberSoft,
                      borderColor: palette.amber,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: palette.amber }}>
                    もう一回
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.previewAction,
                    {
                      backgroundColor: palette.greenSoft,
                      borderColor: palette.green,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: palette.green }}>
                    言えた
                  </ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function getToneColor(tone: CandidateTone, palette: ReturnType<typeof useDailyPalette>) {
  if (tone === 'green') {
    return palette.green;
  }

  if (tone === 'amber') {
    return palette.amber;
  }

  return palette.primary;
}

function getToneSoftColor(tone: CandidateTone, palette: ReturnType<typeof useDailyPalette>) {
  if (tone === 'green') {
    return palette.greenSoft;
  }

  if (tone === 'amber') {
    return palette.amberSoft;
  }

  return palette.cardAlt;
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
  },
  candidateGrid: {
    gap: Spacing.three,
  },
  candidateCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  candidateIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateTitleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  candidateTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: 900,
  },
  previewBody: {
    gap: Spacing.two,
  },
  previewJapanese: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
  },
  previewDivider: {
    height: StyleSheet.hairlineWidth,
  },
  previewEnglish: {
    fontSize: 21,
    lineHeight: 30,
    fontWeight: 800,
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  previewAction: {
    flex: 1,
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
