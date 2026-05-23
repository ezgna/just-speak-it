import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  generatePracticeFromDiary,
  type TranslationCard,
} from '@/lib/backend/practice';
import { notifyPracticeChanged } from '@/lib/practice-refresh';
import { transcribeRecording } from '@/lib/backend/transcription';

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const [recordingIntentActive, setRecordingIntentActive] = useState(false);
  const [writingPressHeld, setWritingPressHeld] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [rawTranscriptText, setRawTranscriptText] = useState<string | null>(null);
  const [cleanedTranscriptText, setCleanedTranscriptText] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [cards, setCards] = useState<TranslationCard[]>([]);
  const generationInFlightRef = useRef(false);

  const isRecordingButtonActive =
    recorderState.isRecording || isRecordingBusy || recordingIntentActive;
  const isWorking = isRecordingBusy || isTranscribing || isGeneratingCards;
  const isRecordingButtonPressed =
    writingPressHeld || isTranscribing || isGeneratingCards;
  const isRecordingButtonDisabled =
    isWorking || (recordingIntentActive && !recorderState.isRecording);
  const hasTranscriptPanel = Boolean(
    isRecordingButtonActive ||
      isTranscribing ||
      cleanedTranscriptText !== null ||
      rawTranscriptText ||
      transcriptionError
  );
  const hasCards = cards.length > 0;

  async function startRecording() {
    setIsRecordingBusy(true);
    setRecordingIntentActive(true);
    setRawTranscriptText(null);
    setCleanedTranscriptText(null);
    setTranscriptionError(null);
    setGenerationError(null);
    setCards([]);

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setRecordingIntentActive(false);
        Alert.alert('録音できません', 'マイク権限がないため録音できません。');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      setRecordingIntentActive(false);
      Alert.alert(
        '録音できません',
        error instanceof Error ? error.message : '録音の開始に失敗しました。'
      );
    } finally {
      setIsRecordingBusy(false);
    }
  }

  async function stopRecording() {
    setRecordingIntentActive(false);
    setIsRecordingBusy(true);
    setTranscriptionError(null);

    let recordingUri: string | null = null;

    try {
      await audioRecorder.stop();
      recordingUri = audioRecorder.uri ?? recorderState.url;
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (!recordingUri) {
        throw new Error('録音ファイルを読み込めませんでした。もう一度録音してください。');
      }
    } catch (error) {
      Alert.alert(
        '録音を停止できません',
        error instanceof Error ? error.message : '録音の停止に失敗しました。'
      );
    } finally {
      if (recordingUri) {
        setIsTranscribing(true);
      } else {
        setWritingPressHeld(false);
      }
      setIsRecordingBusy(false);
    }

    if (recordingUri) {
      await handleTranscription(recordingUri);
    }
  }

  async function handleTranscription(recordingUri: string) {
    setIsTranscribing(true);

    try {
      const transcript = await transcribeRecording(recordingUri);
      setRawTranscriptText(transcript.rawText);
      setCleanedTranscriptText(transcript.cleanedText);
    } catch (error) {
      setTranscriptionError(
        error instanceof Error ? error.message : '文字起こしに失敗しました。'
      );
    } finally {
      setIsTranscribing(false);
      setWritingPressHeld(false);
    }
  }

  async function handleGenerateCards() {
    const diaryText = cleanedTranscriptText?.trim() ?? '';

    if (!diaryText || isGeneratingCards || generationInFlightRef.current || hasCards) {
      return;
    }

    generationInFlightRef.current = true;
    setIsGeneratingCards(true);
    setGenerationError(null);
    setCards([]);

    try {
      const result = await generatePracticeFromDiary({
        diaryText,
        source: 'voice',
        cleanedText: diaryText,
        rawTranscriptText: rawTranscriptText ?? diaryText,
      });
      setCards(result.cards);
      notifyPracticeChanged();
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : '英語カードの作成に失敗しました。'
      );
    } finally {
      generationInFlightRef.current = false;
      setIsGeneratingCards(false);
    }
  }

  async function handleRecordingPress() {
    if (recorderState.isRecording) {
      setWritingPressHeld(true);
      await stopRecording();
      return;
    }

    await startRecording();
  }

  function handleTranscriptChange(nextText: string) {
    setCleanedTranscriptText(nextText);
    setGenerationError(null);
    setCards([]);
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: palette.background,
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      {__DEV__ ? (
        <View style={styles.labEntry}>
          <GlideButton
            label="実験室"
            caption="design lab"
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            tone="mint"
            onPress={() => router.push('/design-lab')}
          />
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          hasCards && styles.scrollContentWithCards,
        ]}
        showsVerticalScrollIndicator={false}>
        {hasTranscriptPanel && (
          <View
            style={[
              styles.transcriptPanel,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                boxShadow: palette.shadow,
              },
            ]}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: transcriptionError
                      ? palette.coral
                      : recorderState.isRecording
                        ? palette.coral
                        : isTranscribing
                          ? palette.amber
                          : palette.green,
                  },
                ]}
              />
              <ThemedText type="code" themeColor="textSecondary" selectable>
                {transcriptionError
                  ? 'ERROR'
                  : recorderState.isRecording
                    ? `REC ${formatDuration(recorderState.durationMillis)}`
                    : isTranscribing
                      ? 'TRANSCRIBING'
                      : 'TRANSCRIPT'}
              </ThemedText>
            </View>

            {recorderState.isRecording && (
              <ThemedText type="subtitle" style={styles.pendingText} selectable>
                録音中
              </ThemedText>
            )}

            {isTranscribing && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.primary} />
                <ThemedText type="subtitle" style={styles.pendingText} selectable>
                  文字起こし中
                </ThemedText>
              </View>
            )}

            {transcriptionError && (
              <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
                {transcriptionError}
              </ThemedText>
            )}

            {cleanedTranscriptText !== null && !isTranscribing && (
              <>
                <TextInput
                  value={cleanedTranscriptText}
                  editable={!isGeneratingCards && !hasCards}
                  multiline
                  textAlignVertical="top"
                  placeholder="文字起こし"
                  placeholderTextColor={palette.textSecondary}
                  selectionColor={palette.primary}
                  style={[
                    styles.transcriptInput,
                    {
                      backgroundColor: palette.cardAlt,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  onChangeText={handleTranscriptChange}
                />
                {hasCards ? (
                  <View style={styles.generationComplete}>
                    <View style={styles.generationCompleteText}>
                      <ThemedText type="smallBold" selectable>
                        英語カードを作成しました
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" selectable>
                        {cards.length}枚のカードを保存済み
                      </ThemedText>
                    </View>
                    <View style={styles.generationCompleteActions}>
                      <ActionButton
                        label="英語タブで見る"
                        icon={{ ios: 'text.book.closed.fill', android: 'menu_book', web: 'menu_book' }}
                        variant="secondary"
                        onPress={() => router.push('/english')}
                      />
                      <ActionButton
                        label="復習する"
                        icon={{
                          ios: 'rectangle.stack.fill',
                          android: 'view_carousel',
                          web: 'view_carousel',
                        }}
                        variant="primary"
                        onPress={() => router.push('/flashcards')}
                      />
                    </View>
                  </View>
                ) : (
                  <ActionButton
                    label={isGeneratingCards ? '英語カードを作成中' : '英語カードを作る'}
                    icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                    variant="secondary"
                    disabled={isGeneratingCards || !cleanedTranscriptText.trim()}
                    onPress={handleGenerateCards}
                  />
                )}
              </>
            )}

            {isGeneratingCards && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.primary} />
                <ThemedText type="smallBold" selectable>
                  ネイティブ表現に分けています
                </ThemedText>
              </View>
            )}

            {generationError && (
              <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
                {generationError}
              </ThemedText>
            )}
          </View>
        )}

        {hasCards && (
          <View style={styles.cardList}>
            {cards.map((card, index) => (
              <View
                key={card.id}
                style={[
                  styles.translationCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}>
                <View style={styles.cardNumber}>
                  <ThemedText type="code" themeColor="textSecondary">
                    {String(index + 1).padStart(2, '0')}
                  </ThemedText>
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={styles.japaneseText} selectable>
                    {card.japanese}
                  </ThemedText>
                  <View style={[styles.divider, { backgroundColor: palette.border }]} />
                  <ThemedText style={styles.englishText} selectable>
                    {card.english}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonDock}>
        <GlideButton
          label={
            isTranscribing || isGeneratingCards
              ? 'Writing it up'
              : isRecordingButtonActive
                ? 'Done'
                : cleanedTranscriptText !== null
                  ? 'Try again'
                  : 'Speak It'
          }
          icon={
            isRecordingButtonActive
              ? { ios: 'stop.circle.fill', android: 'stop_circle', web: 'stop_circle' }
              : isTranscribing || isGeneratingCards
                ? { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }
                : cleanedTranscriptText !== null
                  ? { ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' }
                  : { ios: 'mic.fill', android: 'mic', web: 'mic' }
          }
          tone={
            isTranscribing || isGeneratingCards
              ? 'aqua'
              : isRecordingButtonActive
                ? 'orange'
                : cleanedTranscriptText !== null
                  ? 'violet'
                  : 'mint'
          }
          size="large"
          disabled={isRecordingButtonDisabled}
          pressed={isRecordingButtonPressed}
          holdPressOut={recorderState.isRecording}
          containerStyle={styles.recordButtonContainer}
          onPress={handleRecordingPress}
        />
      </View>
    </View>
  );
}

function formatDuration(durationMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.three,
  },
  scrollArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  labEntry: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  scrollContentWithCards: {
    justifyContent: 'flex-start',
  },
  transcriptPanel: {
    width: '100%',
    minHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pendingText: {
    fontSize: 28,
    lineHeight: 36,
  },
  transcriptInput: {
    minHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    fontSize: 21,
    lineHeight: 32,
    fontWeight: 600,
  },
  generationComplete: {
    gap: Spacing.three,
  },
  generationCompleteText: {
    gap: Spacing.one,
  },
  generationCompleteActions: {
    gap: Spacing.two,
  },
  errorText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
  },
  cardList: {
    gap: Spacing.three,
  },
  translationCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  cardNumber: {
    width: 28,
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
  cardBody: {
    flex: 1,
    gap: Spacing.two,
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
    fontSize: 20,
    lineHeight: 30,
    fontWeight: 700,
  },
  buttonDock: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  recordButtonContainer: {
    opacity: 1,
  },
});
