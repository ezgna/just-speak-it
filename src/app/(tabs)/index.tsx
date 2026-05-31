import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { GeneratedPracticePreview } from '@/components/generated-practice-preview';
import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import { GlideTextInput } from '@/components/ui/glide-text-input';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useGenerationMode } from '@/hooks/use-generation-mode';
import {
  completePracticeDraft,
  discardPracticeDraft,
  getLatestPracticeDraft,
  preparePracticeDraft,
  type PracticeDraft,
  type PracticeDraftCard,
  type TranslationCard,
} from '@/lib/backend/practice';
import { setHapticsAllowedDuringRecording } from '@/lib/audio-session-haptics';
import { notifyPracticeChanged } from '@/lib/practice-refresh';
import { transcribeRecording } from '@/lib/backend/transcription';

type DiaryDraftSource = 'text' | 'voice';
type EntryMode = 'voice' | 'write';

const DraftInputMaxHeight = 444;
const DraftInputFrameMaxHeight = 500;

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const { generationMode } = useGenerationMode();
  const [entryMode, setEntryMode] = useState<EntryMode>('voice');
  const [diaryDraftText, setDiaryDraftText] = useState('');
  const [diaryDraftSource, setDiaryDraftSource] = useState<DiaryDraftSource>('text');
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const [recordingIntentActive, setRecordingIntentActive] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const [recordingStopDurationMillis, setRecordingStopDurationMillis] = useState(0);
  const [writingPressHeld, setWritingPressHeld] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [isCompletingPractice, setIsCompletingPractice] = useState(false);
  const [rawTranscriptText, setRawTranscriptText] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<PracticeDraft | null>(null);
  const [draftCards, setDraftCards] = useState<PracticeDraftCard[]>([]);
  const [completedPracticeCards, setCompletedPracticeCards] = useState<TranslationCard[]>([]);
  const generationInFlightRef = useRef(false);
  const resetDraftOnBlurRef = useRef(false);
  const draftInteractionVersionRef = useRef(0);
  const currentDraft = activeDraft?.generationMode === generationMode ? activeDraft : null;

  const isRecordingButtonActive = recorderState.isRecording || isStoppingRecording;
  const isWritingButtonActive =
    !isRecordingButtonActive && (isTranscribing || isPreparingDraft || isCompletingPractice);
  const recordingButtonDurationMillis = recorderState.isRecording
    ? recorderState.durationMillis
    : recordingStopDurationMillis;
  const recordingButtonDurationLabel = formatDuration(recordingButtonDurationMillis);
  const isWorking = isRecordingBusy || isTranscribing || isPreparingDraft || isCompletingPractice;
  const isRecordingButtonPressed =
    writingPressHeld || isTranscribing || isPreparingDraft || isCompletingPractice;
  const isPrimaryButtonBusy = isWritingButtonActive;
  const isRecordingButtonDisabled =
    isWorking || (recordingIntentActive && !recorderState.isRecording);
  const isDraftInputEditable =
    entryMode === 'write' &&
    !recorderState.isRecording &&
    !isWorking &&
    !currentDraft &&
    completedPracticeCards.length === 0;
  const hasDraftText = diaryDraftText.trim().length > 0;
  const hasActiveDraft = Boolean(currentDraft && draftCards.length > 0);
  const hasCompletedPracticeCards = completedPracticeCards.length > 0;
  const isEntryIdle = !hasActiveDraft && !hasCompletedPracticeCards;
  const isWriteMode = entryMode === 'write';
  const shouldShowSplitAction =
    isWriteMode &&
    hasDraftText &&
    !hasActiveDraft &&
    !hasCompletedPracticeCards &&
    !isRecordingButtonActive &&
    !isWritingButtonActive;
  const shouldShowMakeCardsAction =
    hasActiveDraft && !hasCompletedPracticeCards && !isRecordingButtonActive && !isWritingButtonActive;
  const shouldShowReviewAction =
    hasCompletedPracticeCards &&
    !isRecordingButtonActive &&
    !isWritingButtonActive;
  const shouldShowModeSwitch = isEntryIdle && !isRecordingButtonActive && !isWritingButtonActive;
  const shouldShowBottomPrimaryAction =
    hasActiveDraft ||
    hasCompletedPracticeCards ||
    !isWriteMode ||
    (isWriteMode && (hasDraftText || isWritingButtonActive));

  const markDraftInteraction = useCallback(() => {
    draftInteractionVersionRef.current += 1;
  }, []);

  const resetDraftState = useCallback(() => {
    markDraftInteraction();
    setEntryMode('voice');
    setDiaryDraftText('');
    setDiaryDraftSource('text');
    setRawTranscriptText(null);
    setTranscriptionError(null);
    setGenerationError(null);
    setActiveDraft(null);
    setDraftCards([]);
    setCompletedPracticeCards([]);
  }, [markDraftInteraction]);

  const applyPracticeDraft = useCallback((draft: PracticeDraft) => {
    setActiveDraft(draft);
    setDraftCards(draft.cards);
    setCompletedPracticeCards([]);
    setDiaryDraftText(draft.diaryEntry.plainText);
    setDiaryDraftSource(draft.source);
    setRawTranscriptText(draft.source === 'voice' ? draft.diaryEntry.originalText : null);
    setTranscriptionError(null);
    setGenerationError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!resetDraftOnBlurRef.current) {
          return;
        }

        resetDraftOnBlurRef.current = false;
        resetDraftState();
      };
    }, [resetDraftState])
  );

  useEffect(() => {
    let isCancelled = false;
    const restoreInteractionVersion = draftInteractionVersionRef.current;

    async function restoreLatestDraft() {
      try {
        const draft = await getLatestPracticeDraft();

        if (
          isCancelled ||
          !draft ||
          draft.generationMode !== generationMode ||
          draftInteractionVersionRef.current !== restoreInteractionVersion
        ) {
          return;
        }

        applyPracticeDraft(draft);
      } catch (error) {
        if (!isCancelled) {
          setGenerationError(
            error instanceof Error ? error.message : '分割下書きを復元できませんでした。'
          );
        }
      }
    }

    void restoreLatestDraft();

    return () => {
      isCancelled = true;
    };
  }, [applyPracticeDraft, generationMode]);

  async function startRecording() {
    markDraftInteraction();
    setEntryMode('voice');
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
      setActiveDraft(null);
      setDraftCards([]);
      setCompletedPracticeCards([]);
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
      setActiveDraft(null);
      setDraftCards([]);
      setCompletedPracticeCards([]);
      setIsTranscribing(false);

      if (cleanedText) {
        await handlePrepareDraft({
          diaryText: cleanedText,
          source: 'voice',
          rawTranscriptText: transcript.rawText,
        });
      }
    } catch (error) {
      setTranscriptionError(
        error instanceof Error ? error.message : '音声の読み取りに失敗しました。'
      );
    } finally {
      setIsTranscribing(false);
      setWritingPressHeld(false);
    }
  }

  async function handlePrepareDraft({
    diaryText,
    source,
    rawTranscriptText: nextRawTranscriptText,
  }: {
    diaryText: string;
    source: DiaryDraftSource;
    rawTranscriptText?: string | null;
  }) {
    markDraftInteraction();
    const normalizedDiaryText = diaryText.trim();

    if (
      !normalizedDiaryText ||
      isPreparingDraft ||
      isCompletingPractice ||
      generationInFlightRef.current ||
      hasActiveDraft
    ) {
      return;
    }

    generationInFlightRef.current = true;
    setIsPreparingDraft(true);
    setGenerationError(null);
    setActiveDraft(null);
    setDraftCards([]);
    setCompletedPracticeCards([]);

    try {
      const draft = await preparePracticeDraft({
        diaryText: normalizedDiaryText,
        source,
        cleanedText: normalizedDiaryText,
        rawTranscriptText:
          source === 'voice' ? nextRawTranscriptText ?? normalizedDiaryText : normalizedDiaryText,
        generationMode,
      });
      applyPracticeDraft(draft);
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : '分割カードの作成に失敗しました。'
      );
    } finally {
      generationInFlightRef.current = false;
      setIsPreparingDraft(false);
    }
  }

  async function handleCompletePractice() {
    markDraftInteraction();
    if (
      !currentDraft ||
      draftCards.length === 0 ||
      isCompletingPractice ||
      generationInFlightRef.current
    ) {
      return;
    }

    generationInFlightRef.current = true;
    setIsCompletingPractice(true);
    setGenerationError(null);

    try {
      const practice = await completePracticeDraft({
        practiceGenerationId: currentDraft.practiceGenerationId,
        cards: draftCards.map((card) => ({
          id: card.id,
          japanese: card.japanese,
        })),
      });
      setCompletedPracticeCards(practice.cards);
      setActiveDraft(null);
      setDraftCards([]);
      setDiaryDraftText(practice.diaryEntry.plainText);
      setDiaryDraftSource(practice.source);
      notifyPracticeChanged();
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : '英語カードの作成に失敗しました。'
      );
    } finally {
      generationInFlightRef.current = false;
      setIsCompletingPractice(false);
    }
  }

  async function handlePrimaryActionPress() {
    Keyboard.dismiss();

    if (recorderState.isRecording) {
      setWritingPressHeld(true);
      await stopRecording();
      return;
    }

    if (shouldShowReviewAction) {
      resetDraftOnBlurRef.current = true;
      router.push('/flashcards');
      return;
    }

    if (shouldShowMakeCardsAction) {
      await handleCompletePractice();
      return;
    }

    if (hasDraftText) {
      await handlePrepareDraft({
        diaryText: diaryDraftText,
        source: diaryDraftSource,
        rawTranscriptText,
      });
      return;
    }

    await startRecording();
  }

  async function handleDiscardDraft() {
    markDraftInteraction();
    const draftId = currentDraft?.practiceGenerationId;

    resetDraftState();

    if (!draftId) {
      return;
    }

    try {
      await discardPracticeDraft(draftId);
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : '分割下書きを破棄できませんでした。'
      );
    }
  }

  function handleDraftTextChange(nextText: string) {
    markDraftInteraction();

    if (!rawTranscriptText || !nextText.trim()) {
      setRawTranscriptText(null);
      setDiaryDraftSource('text');
    }

    setDiaryDraftText(nextText);
    setTranscriptionError(null);
    setGenerationError(null);
    setActiveDraft(null);
    setDraftCards([]);
    setCompletedPracticeCards([]);
  }

  function handleEnterWriteMode() {
    markDraftInteraction();
    Keyboard.dismiss();
    setEntryMode('write');
    setDiaryDraftSource('text');
    setRawTranscriptText(null);
    setTranscriptionError(null);
    setGenerationError(null);
    setActiveDraft(null);
    setDraftCards([]);
    setCompletedPracticeCards([]);
  }

  function handleEnterVoiceMode() {
    Keyboard.dismiss();
    resetDraftState();
  }

  const topActionButton = hasActiveDraft && !isCompletingPractice ? (
    <View
      pointerEvents="box-none"
      style={[
        styles.modeActionLayer,
        {
          top: safeAreaInsets.top + Spacing.three,
          right: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      <GlideButton
        label="やり直す"
        accessibilityLabel="カード下書きを破棄してやり直す"
        icon={{ ios: 'arrow.counterclockwise', android: 'refresh', web: 'refresh' }}
        tone="coral"
        size="compact"
        fullWidth={false}
        onPress={handleDiscardDraft}
      />
    </View>
  ) : shouldShowModeSwitch ? (
    <View
      pointerEvents="box-none"
      style={[
        styles.modeActionLayer,
        {
          top: safeAreaInsets.top + Spacing.three,
          right: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      <GlideButton
        label={isWriteMode ? '話す' : '書く'}
        accessibilityLabel={isWriteMode ? '話すモードに戻る' : '書くモードに切り替える'}
        icon={
          isWriteMode
            ? { ios: 'mic.fill', android: 'mic', web: 'mic' }
            : { ios: 'square.and.pencil', android: 'edit', web: 'edit' }
        }
        tone={isWriteMode ? 'mint' : 'cream'}
        size="compact"
        fullWidth={false}
        onPress={isWriteMode ? handleEnterVoiceMode : handleEnterWriteMode}
      />
    </View>
  ) : null;

  const contentArea = (
    <View
      style={[
        styles.contentArea,
        hasActiveDraft && !isCompletingPractice ? styles.contentAreaWithTopAction : null,
      ]}>
      <View style={styles.draftStack}>
        {transcriptionError && (
          <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
            {transcriptionError}
          </ThemedText>
        )}

        {hasActiveDraft ? (
          <GeneratedPracticePreview cards={draftCards} />
        ) : hasCompletedPracticeCards ? (
          <GeneratedPracticePreview cards={completedPracticeCards} />
        ) : isWriteMode ? (
          <View style={styles.inputDismissArea}>
            <GlideTextInput
              value={diaryDraftText}
              tone="cream"
              accentTone="mint"
              variant="canvas"
              canvasCornerColor={palette.border}
              accessibilityLabel="今日の日本語を書く"
              editable={isDraftInputEditable}
              placeholder="今ふと考えていることをなんでも自由に日本語で話す・書く。"
              placeholderTextColor={palette.muted}
              autoFocus
              frameStyle={styles.draftInputFrame}
              inputStyle={[
                styles.draftInput,
                {
                  color: palette.text,
                  opacity: isDraftInputEditable ? 1 : 0.78,
                },
              ]}
              onChangeText={handleDraftTextChange}
            />
          </View>
        ) : null}

        {generationError && (
          <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
            {generationError}
          </ThemedText>
        )}
      </View>
    </View>
  );

  function renderPrimaryActionButton() {
    return (
      <GlideButton
        label={
          isTranscribing
            ? 'Transcribing'
            : isPreparingDraft
              ? 'Splitting'
              : isCompletingPractice
                ? 'Making it'
                : isRecordingButtonActive
                  ? recordingButtonDurationLabel
                  : shouldShowReviewAction
                    ? 'Review it'
                    : shouldShowMakeCardsAction
                      ? 'Make cards'
                      : shouldShowSplitAction
                        ? 'Split it'
                        : 'Speak it'
        }
        accessibilityLabel={
          isRecordingButtonActive
            ? `録音を停止 ${recordingButtonDurationLabel}`
            : shouldShowReviewAction
              ? '作った英語カードを復習する'
              : shouldShowMakeCardsAction
                ? '英語カードを作る'
                : shouldShowSplitAction
                  ? '日本語を英語カード向けに分割する'
                  : undefined
        }
        icon={
          isRecordingButtonActive
            ? { ios: 'stop.circle.fill', android: 'stop_circle', web: 'stop_circle' }
            : shouldShowReviewAction
              ? { ios: 'rectangle.stack.fill', android: 'layers', web: 'layers' }
              : shouldShowMakeCardsAction
                ? { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }
                : shouldShowSplitAction || isPreparingDraft
                  ? { ios: 'rectangle.split.2x1.fill', android: 'splitscreen', web: 'splitscreen' }
                  : { ios: 'mic.fill', android: 'mic', web: 'mic' }
        }
        busy={isPrimaryButtonBusy}
        tone={
          isPreparingDraft || isTranscribing
            ? 'aqua'
            : isCompletingPractice
              ? 'blue'
              : isRecordingButtonActive
                ? 'orange'
                : shouldShowReviewAction
                  ? 'grape'
                  : shouldShowMakeCardsAction
                    ? 'blue'
                    : shouldShowSplitAction
                      ? 'orange'
                      : 'mint'
        }
        size="large"
        disabled={isRecordingButtonDisabled}
        pressed={isRecordingButtonPressed}
        holdPressOut={recorderState.isRecording}
        containerStyle={styles.recordButtonContainer}
        onPress={handlePrimaryActionPress}
      />
    );
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
      {topActionButton}

      {isWriteMode && !hasActiveDraft && !hasCompletedPracticeCards ? (
        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          {contentArea}
        </TouchableWithoutFeedback>
      ) : (
        contentArea
      )}

      {shouldShowBottomPrimaryAction ? (
        <View style={styles.buttonDock}>
          {renderPrimaryActionButton()}
        </View>
      ) : null}
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
  contentAreaWithTopAction: {
    paddingTop: Spacing.six,
  },
  draftStack: {
    flex: 1,
    width: '100%',
    gap: Spacing.three,
  },
  inputDismissArea: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  modeActionLayer: {
    position: 'absolute',
    zIndex: 1,
    alignItems: 'flex-end',
  },
  draftInputFrame: {
    minHeight: 128,
    maxHeight: DraftInputFrameMaxHeight,
  },
  draftInput: {
    minHeight: 72,
    maxHeight: DraftInputMaxHeight,
    padding: 0,
    fontSize: 21,
    lineHeight: 32,
    fontWeight: 800,
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
