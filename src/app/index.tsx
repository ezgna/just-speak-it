import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  FlowSteps,
  MetricTile,
  Pill,
  SectionHeader,
  Surface,
  useDailyPalette,
} from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { practiceItems, sampleDiaryText } from '@/data/daily-to-english';

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const [diaryText, setDiaryText] = useState(sampleDiaryText);
  const [isRecording, setIsRecording] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(true);
  const [selectedId, setSelectedId] = useState(practiceItems[0].id);
  const [answer, setAnswer] = useState("I haven't decided the details yet.");
  const [showFeedback, setShowFeedback] = useState(true);
  const [retryCount, setRetryCount] = useState(1);

  const selectedItem = useMemo(
    () => practiceItems.find((item) => item.id === selectedId) ?? practiceItems[0],
    [selectedId]
  );

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
  };

  function handleGenerate() {
    setHasGenerated(true);
    setSelectedId(practiceItems[0].id);
    setAnswer('');
    setShowFeedback(false);
    setRetryCount(1);
  }

  function handleSelectCard(id: string) {
    setSelectedId(id);
    setAnswer('');
    setShowFeedback(false);
    setRetryCount(1);
  }

  function handleShowFeedback() {
    setShowFeedback(true);
  }

  function handleRetry() {
    setRetryCount((current) => current + 1);
    setAnswer('');
    setShowFeedback(false);
  }

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
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Pill tone="coral">自分の生活が教材になる</Pill>
            <ThemedText type="title" style={styles.heroTitle} selectable>
              Daily to English
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.heroDescription} selectable>
              まず日本語で吐き出す。そこから、英語で本当に言いたい文だけを練習カードにする。
            </ThemedText>
          </View>

          <Surface style={styles.heroPanel} tone="accent">
            <FlowSteps steps={['話す', '分解', '練習', '言い直す']} />
            <View style={styles.heroPanelRow}>
              <MetricTile label="今日の抽出" value="5文" tone="teal" />
              <MetricTile label="復習待ち" value="3枚" tone="amber" />
            </View>
          </Surface>
        </View>

        <Surface>
          <SectionHeader
            eyebrow="STEP 1"
            title="今日のことを日本語で話す"
            description="英語で頑張り始めない。まずは考えたことを日本語のまま残す。"
          />

          <TextInput
            value={diaryText}
            onChangeText={setDiaryText}
            multiline
            textAlignVertical="top"
            placeholder="今日あったこと、言いたかったことを書く"
            placeholderTextColor={palette.muted}
            style={[
              styles.diaryInput,
              {
                color: palette.text,
                backgroundColor: palette.cardAlt,
                borderColor: palette.border,
              },
            ]}
          />

          <View style={styles.buttonRow}>
            <ActionButton
              label={isRecording ? '録音中の想定' : '音声で話す'}
              icon={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
              variant={isRecording ? 'secondary' : 'primary'}
              onPress={() => setIsRecording((current) => !current)}
              style={styles.flexButton}
            />
            <ActionButton
              label="練習文を作る"
              icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              variant="secondary"
              onPress={handleGenerate}
              style={styles.flexButton}
            />
          </View>
        </Surface>

        {hasGenerated && (
          <View style={styles.gridSection}>
            <SectionHeader
              eyebrow="STEP 2"
              title="AIが練習価値の高い文に分解"
              description="日記を丸ごと翻訳せず、会話で再利用できる単位に切る。"
            />

            <View style={styles.practiceGrid}>
              {practiceItems.map((item, index) => {
                const selected = item.id === selectedId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelectCard(item.id)}
                    style={({ pressed }) => [styles.practicePressable, pressed && styles.pressed]}>
                    <Surface
                      style={[
                        styles.practiceCard,
                        selected && {
                          borderColor: palette.primary,
                          backgroundColor: palette.cardAlt,
                        },
                      ]}>
                      <View style={styles.cardTopRow}>
                        <Pill tone={selected ? 'blue' : 'neutral'}>{`CARD ${index + 1}`}</Pill>
                        {selected && (
                          <SymbolView
                            name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                            size={18}
                            tintColor={palette.primary}
                          />
                        )}
                      </View>
                      <ThemedText type="smallBold" selectable>
                        {item.japanese}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" selectable>
                        {item.intent}
                      </ThemedText>
                      <View style={styles.patternBox}>
                        <ThemedText type="code" style={{ color: palette.coral }} selectable>
                          {item.patternLabel}
                        </ThemedText>
                        <ThemedText type="smallBold" selectable>
                          {item.pattern}
                        </ThemedText>
                      </View>
                    </Surface>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {hasGenerated && (
          <Surface style={styles.practicePanel}>
            <SectionHeader
              eyebrow="STEP 3"
              title="これ英語でどう言う？"
              description="10秒で口から出す。完璧な英文を書くより、まず出すことを優先する。"
            />

            <View style={[styles.promptBox, { backgroundColor: palette.coralSoft }]}>
              <Pill tone="coral">日本語カード</Pill>
              <ThemedText type="subtitle" style={styles.promptText} selectable>
                {selectedItem.japanese}
              </ThemedText>
              <ThemedText type="small" style={{ color: palette.coral }} selectable>
                {selectedItem.shortPhrase}
              </ThemedText>
            </View>

            <TextInput
              value={answer}
              onChangeText={setAnswer}
              multiline
              textAlignVertical="top"
              placeholder="英語で言ってみる / 書いてみる"
              placeholderTextColor={palette.muted}
              style={[
                styles.answerInput,
                {
                  color: palette.text,
                  backgroundColor: palette.cardAlt,
                  borderColor: palette.border,
                },
              ]}
            />

            <View style={styles.buttonRow}>
              <ActionButton
                label="添削を見る"
                icon={{ ios: 'checkmark.seal.fill', android: 'task_alt', web: 'task_alt' }}
                onPress={handleShowFeedback}
                style={styles.flexButton}
              />
              <ActionButton
                label={`言い直す ${retryCount}回目`}
                icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
                variant="secondary"
                onPress={handleRetry}
                style={styles.flexButton}
              />
            </View>

            {showFeedback && (
              <View style={styles.feedbackGrid}>
                <Surface style={styles.feedbackCard} tone="soft">
                  <Pill tone="neutral">自分の英語</Pill>
                  <ThemedText selectable>
                    {answer.trim() || "I haven't decided the details yet."}
                  </ThemedText>
                </Surface>

                <Surface style={styles.feedbackCard} tone="accent">
                  <Pill tone="teal">自然な英語</Pill>
                  <ThemedText type="smallBold" selectable>
                    {selectedItem.naturalEnglish}
                  </ThemedText>
                </Surface>

                <Surface style={styles.feedbackCard}>
                  <Pill tone="green">簡単に言える英語</Pill>
                  <ThemedText selectable>{selectedItem.simpleEnglish}</ThemedText>
                </Surface>

                <Surface style={styles.feedbackCard}>
                  <Pill tone="amber">次の復習</Pill>
                  <ThemedText selectable>{selectedItem.nextReview}</ThemedText>
                  <View style={styles.stuckList}>
                    {selectedItem.stuckPoints.map((point) => (
                      <Pill key={point} tone="neutral">
                        {point}
                      </Pill>
                    ))}
                  </View>
                </Surface>
              </View>
            )}
          </Surface>
        )}
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
  hero: {
    gap: Spacing.four,
  },
  heroText: {
    gap: Spacing.two,
  },
  heroTitle: {
    fontSize: 44,
    lineHeight: 48,
  },
  heroDescription: {
    maxWidth: 620,
  },
  heroPanel: {
    padding: Spacing.three,
  },
  heroPanelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  diaryInput: {
    minHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  answerInput: {
    minHeight: 104,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flexButton: {
    flexGrow: 1,
  },
  gridSection: {
    gap: Spacing.three,
  },
  practiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  practicePressable: {
    flexGrow: 1,
    flexBasis: 260,
  },
  practiceCard: {
    minHeight: 190,
    height: '100%',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  patternBox: {
    gap: Spacing.one,
  },
  practicePanel: {
    marginBottom: Spacing.three,
  },
  promptBox: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  promptText: {
    fontSize: 28,
    lineHeight: 36,
  },
  feedbackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  feedbackCard: {
    flexGrow: 1,
    flexBasis: 260,
    padding: Spacing.three,
  },
  stuckList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
});
