import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { GlideFrame, GlideTones } from '@/components/ui/glide-frame';
import { GlideButton } from '@/components/ui/glide-button';
import { GlideTextInput } from '@/components/ui/glide-text-input';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  generatePracticeFromDiary,
  type TranslationCard,
} from '@/lib/backend/practice';
import { setHapticsAllowedDuringRecording } from '@/lib/audio-session-haptics';
import { notifyPracticeChanged } from '@/lib/practice-refresh';
import { transcribeRecording } from '@/lib/backend/transcription';

type DiaryDraftSource = 'text' | 'voice';
type RecordingStartMode = 'new' | 'retry';

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [diaryDraftText, setDiaryDraftText] = useState('');
  const [diaryDraftSource, setDiaryDraftSource] = useState<DiaryDraftSource>('text');
  const [recordingStartMode, setRecordingStartMode] = useState<RecordingStartMode>('new');
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const [recordingIntentActive, setRecordingIntentActive] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const [recordingStopDurationMillis, setRecordingStopDurationMillis] = useState(0);
  const [writingPressHeld, setWritingPressHeld] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [rawTranscriptText, setRawTranscriptText] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [cards, setCards] = useState<TranslationCard[]>([]);
  const generationInFlightRef = useRef(false);

  const isRecordingButtonActive = recorderState.isRecording || isStoppingRecording;
  const isWritingButtonActive = !isRecordingButtonActive && (isTranscribing || isGeneratingCards);
  const recordingButtonDurationMillis = recorderState.isRecording
    ? recorderState.durationMillis
    : recordingStopDurationMillis;
  const isWorking = isRecordingBusy || isTranscribing || isGeneratingCards;
  const isRecordingButtonPressed =
    writingPressHeld || isTranscribing || isGeneratingCards;
  const isRecordingButtonDisabled =
    isWorking || (recordingIntentActive && !recorderState.isRecording);
  const hasCards = cards.length > 0;
  const isDraftInputEditable =
    !recorderState.isRecording && !isWorking && !hasCards;
  const hasDraftText = diaryDraftText.trim().length > 0;
  const isRetryDraft = diaryDraftSource === 'voice' && hasDraftText;
  const isRecordingStartPending = recordingIntentActive && !recorderState.isRecording;
  const shouldShowRetryAction =
    isRetryDraft || (isRecordingStartPending && recordingStartMode === 'retry');
  const isGenerateCardsButtonDisabled =
    !hasDraftText || hasCards || recorderState.isRecording || isWorking;

  async function startRecording(startMode: RecordingStartMode) {
    setIsRecordingBusy(true);
    setRecordingIntentActive(true);
    setRecordingStartMode(startMode);
    setIsStoppingRecording(false);
    setRecordingStopDurationMillis(0);
    setTranscriptionError(null);
    setGenerationError(null);

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setRecordingIntentActive(false);
        setRecordingStartMode('new');
        Alert.alert('録音できません', 'マイク権限がないため録音できません。');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      await setHapticsAllowedDuringRecording(true);
      audioRecorder.record();
      setDiaryDraftText('');
      setDiaryDraftSource('voice');
      setRawTranscriptText(null);
      setCards([]);
    } catch (error) {
      setRecordingIntentActive(false);
      setRecordingStartMode('new');
      void setHapticsAllowedDuringRecording(false).catch(() => undefined);
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
    setIsStoppingRecording(true);
    setRecordingStopDurationMillis(recorderState.durationMillis);
    setTranscriptionError(null);

    let recordingUri: string | null = null;

    try {
      await audioRecorder.stop();
      recordingUri = audioRecorder.uri ?? recorderState.url;
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      await setHapticsAllowedDuringRecording(false);

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
      setIsStoppingRecording(false);
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
      setDiaryDraftText(transcript.cleanedText);
      setDiaryDraftSource('voice');
    } catch (error) {
      setTranscriptionError(
        error instanceof Error ? error.message : '音声の読み取りに失敗しました。'
      );
    } finally {
      setIsTranscribing(false);
      setWritingPressHeld(false);
    }
  }

  async function handleGenerateCards() {
    const diaryText = diaryDraftText.trim();

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
        source: diaryDraftSource,
        cleanedText: diaryText,
        rawTranscriptText:
          diaryDraftSource === 'voice' ? rawTranscriptText ?? diaryText : diaryText,
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

    await startRecording(isRetryDraft ? 'retry' : 'new');
  }

  function handleDraftTextChange(nextText: string) {
    if (!rawTranscriptText || !nextText.trim()) {
      setRawTranscriptText(null);
      setDiaryDraftSource('text');
    }

    setDiaryDraftText(nextText);
    setTranscriptionError(null);
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
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          hasCards && styles.scrollContentWithCards,
        ]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.draftStack}>
          {transcriptionError && (
            <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
              {transcriptionError}
            </ThemedText>
          )}

          <GlideTextInput
            value={diaryDraftText}
            tone="cream"
            accentTone="mint"
            accessibilityLabel="今日の日本語を書く"
            editable={isDraftInputEditable}
            placeholder="今ふと考えていることをなんでも自由に日本語で話す・書く。"
            frameStyle={styles.draftInputFrame}
            inputStyle={[
              styles.draftInput,
              {
                opacity: isDraftInputEditable ? 1 : 0.78,
              },
            ]}
            onChangeText={handleDraftTextChange}
          />

          {hasCards && (
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
        {!hasCards && (
          <GenerateCardsButton
            disabled={isGenerateCardsButtonDisabled}
            isLoading={isGeneratingCards}
            onPress={handleGenerateCards}
          />
        )}
        <GlideButton
          label={
            isWritingButtonActive
              ? 'Writing it up'
              : isRecordingButtonActive
                ? 'Done'
                : shouldShowRetryAction
                  ? 'Try again'
                  : 'Speak it'
          }
          badge={
            isRecordingButtonActive
              ? formatDuration(recordingButtonDurationMillis)
              : undefined
          }
          icon={
            isRecordingButtonActive
              ? { ios: 'stop.circle.fill', android: 'stop_circle', web: 'stop_circle' }
              : isWritingButtonActive
                ? { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }
                : shouldShowRetryAction
                  ? { ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' }
                  : { ios: 'mic.fill', android: 'mic', web: 'mic' }
          }
          tone={
            isWritingButtonActive
              ? 'aqua'
              : isRecordingButtonActive
                ? 'orange'
                : shouldShowRetryAction
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

function GenerateCardsButton({
  disabled,
  isLoading,
  onPress,
}: {
  disabled: boolean;
  isLoading: boolean;
  onPress: () => void;
}) {
  const isUnavailable = disabled && !isLoading;
  const tone = isLoading ? 'aqua' : 'cream';
  const toneStyle = GlideTones[tone];
  const badgeColor = isUnavailable ? '#111111' : toneStyle.accentColor;

  return (
    <GlideFrame
      tone={tone}
      size="large"
      accessibilityLabel={isLoading ? '英語カードを作成中' : '英語カードを作る'}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: isLoading }}
      disabled={disabled}
      pressed={isLoading}
      containerStyle={styles.generateButtonContainer}
      style={styles.generateButton}
      onPress={onPress}>
      <View style={styles.generateButtonContent}>
        <View style={[styles.generateButtonBadge, { backgroundColor: badgeColor }]}>
          {isLoading ? (
            <ActivityIndicator color={toneStyle.backgroundColor} size="small" />
          ) : (
            <SymbolView
              name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              size={17}
              tintColor={toneStyle.backgroundColor}
              fallback={<ThemedText style={{ color: toneStyle.backgroundColor }}>{'+'}</ThemedText>}
            />
          )}
        </View>
        <ThemedText style={[styles.generateButtonLabel, { color: toneStyle.textColor }]}>
          {isLoading ? '英語カードを作成中' : '英語カードを作る'}
        </ThemedText>
        <SymbolView
          name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
          size={18}
          tintColor={toneStyle.textColor}
          fallback={<ThemedText style={{ color: toneStyle.textColor }}>{'>'}</ThemedText>}
        />
      </View>
    </GlideFrame>
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
  draftStack: {
    width: '100%',
    gap: Spacing.three,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  draftInputFrame: {
    minHeight: 220,
  },
  draftInput: {
    minHeight: 160,
    padding: 0,
    fontSize: 20,
    lineHeight: 31,
    fontWeight: 900,
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
    gap: Spacing.two,
  },
  generateButtonContainer: {
    alignSelf: 'stretch',
  },
  generateButton: {
    justifyContent: 'center',
  },
  generateButtonContent: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  generateButtonBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonLabel: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 900,
  },
  recordButtonContainer: {
    opacity: 1,
  },
});
