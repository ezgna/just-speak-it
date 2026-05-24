import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRef, useState } from 'react';
import { Alert, Keyboard, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import { GlideTextInput } from '@/components/ui/glide-text-input';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useGenerationMode } from '@/hooks/use-generation-mode';
import { generatePracticeFromDiary } from '@/lib/backend/practice';
import { setHapticsAllowedDuringRecording } from '@/lib/audio-session-haptics';
import { notifyPracticeChanged } from '@/lib/practice-refresh';
import { transcribeRecording } from '@/lib/backend/transcription';

type DiaryDraftSource = 'text' | 'voice';

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const { generationMode } = useGenerationMode();
  const [diaryDraftText, setDiaryDraftText] = useState('');
  const [diaryDraftSource, setDiaryDraftSource] = useState<DiaryDraftSource>('text');
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
  const [hasSavedCurrentDraft, setHasSavedCurrentDraft] = useState(false);
  const generationInFlightRef = useRef(false);

  const isRecordingButtonActive = recorderState.isRecording || isStoppingRecording;
  const isWritingButtonActive = !isRecordingButtonActive && (isTranscribing || isGeneratingCards);
  const recordingButtonDurationMillis = recorderState.isRecording
    ? recorderState.durationMillis
    : recordingStopDurationMillis;
  const recordingButtonDurationLabel = formatDuration(recordingButtonDurationMillis);
  const isWorking = isRecordingBusy || isTranscribing || isGeneratingCards;
  const isRecordingButtonPressed =
    writingPressHeld || isTranscribing || isGeneratingCards;
  const isRecordingButtonDisabled =
    isWorking || (recordingIntentActive && !recorderState.isRecording);
  const isDraftInputEditable =
    !recorderState.isRecording && !isWorking;
  const hasDraftText = diaryDraftText.trim().length > 0;
  const shouldShowMakeCardsAction =
    hasDraftText && !hasSavedCurrentDraft && !isRecordingButtonActive && !isWritingButtonActive;

  async function startRecording() {
    setIsRecordingBusy(true);
    setRecordingIntentActive(true);
    setIsStoppingRecording(false);
    setRecordingStopDurationMillis(0);
    setTranscriptionError(null);
    setGenerationError(null);

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
      await setRecordingHapticsAllowed(true);
      audioRecorder.record();
      setDiaryDraftText('');
      setDiaryDraftSource('voice');
      setRawTranscriptText(null);
      setHasSavedCurrentDraft(false);
    } catch (error) {
      setRecordingIntentActive(false);
      void setRecordingHapticsAllowed(false);
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
      await setRecordingHapticsAllowed(false);

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
      const cleanedText = transcript.cleanedText.trim();
      setRawTranscriptText(cleanedText ? transcript.rawText : null);
      setDiaryDraftText(cleanedText);
      setDiaryDraftSource(cleanedText ? 'voice' : 'text');
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

    if (
      !diaryText ||
      isGeneratingCards ||
      generationInFlightRef.current ||
      hasSavedCurrentDraft
    ) {
      return;
    }

    generationInFlightRef.current = true;
    setIsGeneratingCards(true);
    setGenerationError(null);
    setHasSavedCurrentDraft(false);

    try {
      await generatePracticeFromDiary({
        diaryText,
        source: diaryDraftSource,
        cleanedText: diaryText,
        rawTranscriptText:
          diaryDraftSource === 'voice' ? rawTranscriptText ?? diaryText : diaryText,
        generationMode,
      });
      setHasSavedCurrentDraft(true);
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

  async function handlePrimaryActionPress() {
    Keyboard.dismiss();

    if (recorderState.isRecording) {
      setWritingPressHeld(true);
      await stopRecording();
      return;
    }

    if (hasDraftText && !hasSavedCurrentDraft) {
      await handleGenerateCards();
      return;
    }

    await startRecording();
  }

  function handleDraftTextChange(nextText: string) {
    if (!rawTranscriptText || !nextText.trim()) {
      setRawTranscriptText(null);
      setDiaryDraftSource('text');
    }

    setDiaryDraftText(nextText);
    setTranscriptionError(null);
    setGenerationError(null);
    setHasSavedCurrentDraft(false);
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: palette.background,
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom + Spacing.three,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={styles.contentArea}>
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

            {generationError && (
              <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
                {generationError}
              </ThemedText>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.buttonDock}>
        <GlideButton
          label={
            isWritingButtonActive
              ? 'Making it'
              : isRecordingButtonActive
                ? recordingButtonDurationLabel
                : shouldShowMakeCardsAction
                  ? 'Make cards'
                  : 'Speak it'
          }
          accessibilityLabel={
            isRecordingButtonActive
              ? `録音を停止 ${recordingButtonDurationLabel}`
              : shouldShowMakeCardsAction
                ? '英語カードを作る'
              : undefined
          }
          icon={
            isRecordingButtonActive
              ? { ios: 'stop.circle.fill', android: 'stop_circle', web: 'stop_circle' }
              : shouldShowMakeCardsAction
                ? { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }
                : { ios: 'mic.fill', android: 'mic', web: 'mic' }
          }
          busy={isWritingButtonActive}
          tone={
            isWritingButtonActive
              ? 'aqua'
              : isRecordingButtonActive
                ? 'orange'
                : shouldShowMakeCardsAction
                  ? 'blue'
                  : 'mint'
          }
          size="large"
          disabled={isRecordingButtonDisabled}
          pressed={isRecordingButtonPressed}
          holdPressOut={recorderState.isRecording}
          containerStyle={styles.recordButtonContainer}
          onPress={handlePrimaryActionPress}
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

async function setRecordingHapticsAllowed(allowed: boolean) {
  await setHapticsAllowedDuringRecording(allowed).catch(() => undefined);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.three,
  },
  contentArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  draftStack: {
    width: '100%',
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
  errorText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
  },
  buttonDock: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
  },
  recordButtonContainer: {
    opacity: 1,
  },
});
