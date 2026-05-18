import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  MetricTile,
  Pill,
  SectionHeader,
  Surface,
  useDailyPalette,
} from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { practiceItems, practiceModes, reviewItems } from '@/data/daily-to-english';

export default function ReviewScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const [activeMode, setActiveMode] = useState(practiceModes[0].id);

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
  };

  const activeModeDetail = practiceModes.find((mode) => mode.id === activeMode) ?? practiceModes[0];

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: palette.background }]}
      contentInset={insets}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom,
          paddingLeft: Math.max(insets.left, Spacing.three),
          paddingRight: Math.max(insets.right, Spacing.three),
        },
      ]}>
      <View style={styles.container}>
        <SectionHeader
          eyebrow="REVIEW"
          title="言えなかった文だけ戻ってくる"
          description="添削で終わらせず、次に口から出るまで再利用する。"
        />

        <View style={styles.metricsRow}>
          <MetricTile label="今日の復習" value="2枚" tone="coral" />
          <MetricTile label="型ストック" value="5個" tone="teal" />
          <MetricTile label="言い直し" value="1回" tone="green" />
        </View>

        <Surface>
          <SectionHeader
            eyebrow="MODE"
            title="練習モード"
            description="MVPではこの3つを見せれば、単なる日記アプリではないことが伝わる。"
          />

          <View style={styles.modeTabs}>
            {practiceModes.map((mode) => {
              const active = mode.id === activeMode;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => setActiveMode(mode.id)}
                  style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}>
                  <View
                    style={[
                      styles.modeButtonInner,
                      {
                        backgroundColor: active ? palette.tealSoft : palette.backgroundElement,
                        borderColor: active ? palette.teal : palette.border,
                      },
                    ]}>
                    <Pill tone={active ? 'teal' : 'neutral'}>{mode.badge}</Pill>
                    <ThemedText type="smallBold" selectable>
                      {mode.title}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.activeModePanel, { backgroundColor: palette.tealSoft }]}>
            <View style={styles.activeModeIcon}>
              <SymbolView
                name={{ ios: 'speaker.wave.2.fill', android: 'record_voice_over', web: 'record_voice_over' }}
                size={22}
                tintColor={palette.teal}
              />
            </View>
            <View style={styles.activeModeText}>
              <ThemedText type="smallBold" selectable>
                {activeModeDetail.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" selectable>
                {activeModeDetail.description}
              </ThemedText>
            </View>
          </View>
        </Surface>

        <Surface>
          <SectionHeader
            eyebrow="DUE"
            title="今日の再利用カード"
            description="昨日や一週間前に詰まった文だけを、短く出し直す。"
          />

          <View style={styles.reviewList}>
            {reviewItems.map((item) => (
              <View key={item.id} style={[styles.reviewCard, { borderColor: palette.border }]}>
                <View style={styles.reviewCardHeader}>
                  <Pill tone={item.nextReview === '今日' ? 'coral' : 'amber'}>
                    {item.nextReview}
                  </Pill>
                  <ThemedText type="code" themeColor="textSecondary">
                    {item.weakPoint}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" selectable>
                  {item.japanese}
                </ThemedText>
                <View style={styles.answerPreview}>
                  <ThemedText type="small" themeColor="textSecondary" selectable>
                    前回:
                  </ThemedText>
                  <ThemedText type="small" selectable>
                    {item.lastAnswer}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <ActionButton
            label="今日の復習を始める"
            icon={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
          />
        </Surface>

        <View style={styles.patternSection}>
          <SectionHeader
            eyebrow="PATTERNS"
            title="使い回せる型"
            description="日記の文を、次の日も別の場面で使える言い方に変える。"
          />

          <View style={styles.patternGrid}>
            {practiceItems.map((item) => (
              <Surface key={item.id} style={styles.patternCard}>
                <Pill tone="blue">{item.patternLabel}</Pill>
                <ThemedText type="smallBold" selectable>
                  {item.pattern}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" selectable>
                  {item.simpleEnglish}
                </ThemedText>
              </Surface>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  modeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  modeButton: {
    flexGrow: 1,
    flexBasis: 170,
  },
  modeButtonInner: {
    minHeight: 112,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  activeModePanel: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  activeModeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModeText: {
    flex: 1,
    gap: Spacing.one,
  },
  reviewList: {
    gap: Spacing.two,
  },
  reviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  answerPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  patternSection: {
    gap: Spacing.three,
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  patternCard: {
    flexGrow: 1,
    flexBasis: 250,
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
});
