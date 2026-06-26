import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, ScrollView, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { GeneratedPracticePreview } from '@/components/generated-practice-preview';
import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import { GlideTextInput } from '@/components/ui/glide-text-input';
import { MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useCardSplitPolicy } from '@/hooks/use-card-split-policy';
import { useTranslationStyle } from '@/hooks/use-translation-style';
import {
  appendMeteringSample,
  createWaveformPeaksFromMetering,
  normalizeWaveformPeaks,
} from '@/lib/audio/waveform';
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
import { transcribeRecording, type TranscriptionWord } from '@/lib/backend/transcription';
import {
  clearLocalRecordingError,
  deleteLocalRecording,
  finishLocalRecordingAfterTranscription,
  getLatestFailedRetryRecording,
  getLocalRecording,
  getLocalRecordingUri,
  isLocalRecordingSaveEnabled,
  isLocalRecordingSupported,
  markLocalRecordingFailed,
  saveLocalRecordingFromUri,
  type LocalRecording,
} from '@/lib/local-recordings';

type DiaryDraftSource = 'text' | 'voice';
type EntryMode = 'voice' | 'write';

const DraftInputMaxHeight = 444;
const DraftInputFrameMaxHeight = 500;
const RecordingStatusIntervalMs = 100;
const DailyRecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
} as const;

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const audioRecorder = useAudioRecorder(DailyRecordingOptions);
  const recorderState = useAudioRecorderState(audioRecorder, RecordingStatusIntervalMs);
  const { cardSplitPolicy } = useCardSplitPolicy();
  const { translationStyle } = useTranslationStyle();
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
  const [transcriptWords, setTranscriptWords] = useState<TranscriptionWord[]>([]);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [retryRecordingId, setRetryRecordingId] = useState<string | null>(null);
  const [pendingLocalRecordingId, setPendingLocalRecordingId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<PracticeDraft | null>(null);
  const [draftCards, setDraftCards] = useState<PracticeDraftCard[]>([]);
  const [completedPracticeCards, setCompletedPracticeCards] = useState<TranslationCard[]>([]);
  const generationInFlightRef = useRef(false);
  const resetDraftOnBlurRef = useRef(false);
  const draftInteractionVersionRef = useRef(0);
  const waveformMeteringSamplesRef = useRef<number[]>([]);
  const currentDraft = activeDraft?.cardSplitPolicy === cardSplitPolicy ? activeDraft : null;

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
  const shouldShowTranscribedPreview =
    isPreparingDraft &&
    diaryDraftSource === 'voice' &&
    hasDraftText &&
    !hasActiveDraft &&
    !hasCompletedPracticeCards;
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

  const clearRetryRecordingAction = useCallback(() => {
    setRetryRecordingId((currentRecordingId) => {
      discardRetryOnlyRecording(currentRecordingId);
      return null;
    });
  }, []);

  const clearPendingLocalRecordingAction = useCallback(() => {
    setPendingLocalRecordingId((currentRecordingId) => {
      discardRetryOnlyRecording(currentRecordingId);
      return null;
    });
  }, []);

  const resetDraftState = useCallback(() => {
    markDraftInteraction();
    clearRetryRecordingAction();
    clearPendingLocalRecordingAction();
    setEntryMode('voice');
    setDiaryDraftText('');
    setDiaryDraftSource('text');
    setRawTranscriptText(null);
    setTranscriptWords([]);
    setWaveformPeaks([]);
    setTranscriptionError(null);
    setGenerationError(null);
    setActiveDraft(null);
    setDraftCards([]);
    setCompletedPracticeCards([]);
  }, [clearPendingLocalRecordingAction, clearRetryRecordingAction, markDraftInteraction]);

  const applyPracticeDraft = useCallback((draft: PracticeDraft) => {
    setActiveDraft(draft);
    setDraftCards(draft.cards);
    setCompletedPracticeCards([]);
    setDiaryDraftText(draft.diaryEntry.plainText);
    setDiaryDraftSource(draft.source);
    setRawTranscriptText(draft.source === 'voice' ? draft.diaryEntry.originalText : null);
    setTranscriptWords(draft.source === 'voice' ? draft.diaryEntry.transcriptWords : []);
    setWaveformPeaks(draft.source === 'voice' ? draft.diaryEntry.waveformPeaks : []);
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
          draft.cardSplitPolicy !== cardSplitPolicy ||
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
  }, [applyPracticeDraft, cardSplitPolicy]);

  useEffect(() => {
    const failedRetryRecording = getLatestFailedRetryRecording();

    if (!failedRetryRecording) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setRetryRecordingId(failedRetryRecording.id);
      setTranscriptionError(
        failedRetryRecording.lastError ?? '前回の録音を文字起こしできませんでした。'
      );
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (!recorderState.isRecording || typeof recorderState.metering !== 'number') {
      return;
    }

    waveformMeteringSamplesRef.current = appendMeteringSample(
      waveformMeteringSamplesRef.current,
      recorderState.metering
    );
  }, [recorderState.durationMillis, recorderState.isRecording, recorderState.metering]);

  async function startRecording() {
    markDraftInteraction();
    clearRetryRecordingAction();
    clearPendingLocalRecordingAction();
    setEntryMode('voice');
    setIsRecordingBusy(true);
    setRecordingIntentActive(true);
    setIsStoppingRecording(false);
    setRecordingStopDurationMillis(0);
    waveformMeteringSamplesRef.current = [];
    setWaveformPeaks([]);
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
      await audioRecorder.prepareToRecordAsync(DailyRecordingOptions);
      await setRecordingHapticsAllowed(true);
      audioRecorder.record();
      setDiaryDraftText('');
      setDiaryDraftSource('voice');
      setRawTranscriptText(null);
      setTranscriptWords([]);
      setWaveformPeaks([]);
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
    const stoppedDurationMillis = recorderState.durationMillis;
    const nextWaveformPeaks = createWaveformPeaksFromMetering(waveformMeteringSamplesRef.current);
    setRecordingIntentActive(false);
    setIsRecordingBusy(true);
    setIsStoppingRecording(true);
    setRecordingStopDurationMillis(stoppedDurationMillis);
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
      const localRecording = await saveRecordingForTranscription({
        durationMillis: stoppedDurationMillis,
        recordingUri,
        waveformPeaks: nextWaveformPeaks,
      });
      const transcriptionUri =
        localRecording ? getLocalRecordingUri(localRecording.id) ?? recordingUri : recordingUri;

      await handleTranscription(transcriptionUri, localRecording?.id ?? null, nextWaveformPeaks);
    }
  }

  async function saveRecordingForTranscription({
    durationMillis,
    recordingUri,
    waveformPeaks,
  }: {
    durationMillis: number;
    recordingUri: string;
    waveformPeaks: number[];
  }): Promise<LocalRecording | null> {
    if (!isLocalRecordingSupported()) {
      return null;
    }

    try {
      return await saveLocalRecordingFromUri({
        durationMillis,
        recordingUri,
        retention: isLocalRecordingSaveEnabled() ? 'persistent' : 'retry',
        waveformPeaks,
      });
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : '録音ファイルを端末に保存できませんでした。'
      );
      return null;
    }
  }

  async function handleTranscription(
    recordingUri: string,
    localRecordingId: string | null = null,
    nextWaveformPeaks: number[] = []
  ) {
    setIsTranscribing(true);
    const normalizedWaveformPeaks = normalizeWaveformPeaks(nextWaveformPeaks);

    if (localRecordingId) {
      clearLocalRecordingError(localRecordingId);
      setRetryRecordingId(null);
    }

    try {
      const transcript = await transcribeRecording(recordingUri);
      const cleanedText = transcript.cleanedText.trim();
      setRawTranscriptText(cleanedText ? transcript.rawText : null);
      setTranscriptWords(cleanedText ? transcript.words : []);
      setWaveformPeaks(cleanedText ? normalizedWaveformPeaks : []);
      setDiaryDraftText(cleanedText);
      setDiaryDraftSource(cleanedText ? 'voice' : 'text');
      setActiveDraft(null);
      setDraftCards([]);
      setCompletedPracticeCards([]);
      setIsTranscribing(false);

      if (localRecordingId) {
        setPendingLocalRecordingId(localRecordingId);
      }

      if (cleanedText) {
        await handlePrepareDraft({
          diaryText: cleanedText,
          source: 'voice',
          rawTranscriptText: transcript.rawText,
          transcriptWords: transcript.words,
          waveformPeaks: normalizedWaveformPeaks,
          localRecordingId,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '音声の読み取りに失敗しました。';

      setTranscriptionError(errorMessage);

      if (localRecordingId) {
        markLocalRecordingFailed(localRecordingId, errorMessage);
        setRetryRecordingId(localRecordingId);
      }
    } finally {
      setIsTranscribing(false);
      setWritingPressHeld(false);
    }
  }

  async function handlePrepareDraft({
    diaryText,
    source,
    rawTranscriptText: nextRawTranscriptText,
    transcriptWords: nextTranscriptWords,
    waveformPeaks: nextWaveformPeaks,
    localRecordingId,
  }: {
    diaryText: string;
    source: DiaryDraftSource;
    rawTranscriptText?: string | null;
    transcriptWords?: TranscriptionWord[];
    waveformPeaks?: number[];
    localRecordingId?: string | null;
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
      return null;
    }

    generationInFlightRef.current = true;
    setIsPreparingDraft(true);
    setGenerationError(null);
    setActiveDraft(null);
    setDraftCards([]);
    setCompletedPracticeCards([]);
    const nextVoiceWaveformPeaks =
      source === 'voice' ? normalizeWaveformPeaks(nextWaveformPeaks ?? waveformPeaks) : [];

    try {
      const draft = await preparePracticeDraft({
        cardSplitPolicy,
        diaryText: normalizedDiaryText,
        source,
        cleanedText: normalizedDiaryText,
        rawTranscriptText:
          source === 'voice' ? nextRawTranscriptText ?? normalizedDiaryText : normalizedDiaryText,
        transcriptWords: source === 'voice' ? nextTranscriptWords ?? transcriptWords : [],
        waveformPeaks: nextVoiceWaveformPeaks,
      });
      applyPracticeDraft(draft);

      if (localRecordingId) {
        await finishLocalRecordingAfterTranscription({
          id: localRecordingId,
          diaryEntryId: draft.diaryEntry.id,
        });
        setPendingLocalRecordingId((currentRecordingId) =>
          currentRecordingId === localRecordingId ? null : currentRecordingId
        );
        setRetryRecordingId((currentRecordingId) =>
          currentRecordingId === localRecordingId ? null : currentRecordingId
        );
      }

      return draft;
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : '分割カードの作成に失敗しました。'
      );
      return null;
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
        translationStyle,
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
      setTranscriptWords(practice.source === 'voice' ? practice.diaryEntry.transcriptWords : []);
      setWaveformPeaks(practice.source === 'voice' ? practice.diaryEntry.waveformPeaks : []);
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

  async function handleRetryTranscription() {
    if (!retryRecordingId || isWorking) {
      return;
    }

    const retryRecordingUri = getLocalRecordingUri(retryRecordingId);
    const retryRecording = getLocalRecording(retryRecordingId);

    if (!retryRecordingUri) {
      setTranscriptionError('保存済み録音を読み込めませんでした。もう一度録音してください。');
      await deleteLocalRecording(retryRecordingId);
      setRetryRecordingId(null);
      return;
    }

    await handleTranscription(retryRecordingUri, retryRecordingId, retryRecording?.waveformPeaks ?? []);
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
        transcriptWords,
        waveformPeaks,
        localRecordingId: diaryDraftSource === 'voice' ? pendingLocalRecordingId : null,
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
    clearRetryRecordingAction();

    if (!rawTranscriptText || !nextText.trim()) {
      setRawTranscriptText(null);
      setDiaryDraftSource('text');
    }

    setTranscriptWords([]);
    setWaveformPeaks([]);
    setDiaryDraftText(nextText);
    setTranscriptionError(null);
    setGenerationError(null);
    setActiveDraft(null);
    setDraftCards([]);
    setCompletedPracticeCards([]);
  }

  function handleEnterWriteMode() {
    markDraftInteraction();
    clearRetryRecordingAction();
    clearPendingLocalRecordingAction();
    Keyboard.dismiss();
    setEntryMode('write');
    setDiaryDraftSource('text');
    setRawTranscriptText(null);
    setTranscriptWords([]);
    setWaveformPeaks([]);
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
          top: safeAreaInsets.top + TopTabInset + Spacing.three,
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
          top: safeAreaInsets.top + TopTabInset + Spacing.three,
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
          <View style={styles.errorStack}>
            <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
              {transcriptionError}
            </ThemedText>
            {retryRecordingId ? (
              <GlideButton
                label="再試行"
                accessibilityLabel="同じ録音でもう一度文字起こしする"
                icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
                tone="orange"
                size="compact"
                fullWidth={false}
                disabled={isWorking}
                onPress={handleRetryTranscription}
              />
            ) : null}
          </View>
        )}

        {hasActiveDraft ? (
          <GeneratedPracticePreview cards={draftCards} />
        ) : hasCompletedPracticeCards ? (
          <GeneratedPracticePreview cards={completedPracticeCards} />
        ) : shouldShowTranscribedPreview ? (
          <TranscribedDiaryPreview text={diaryDraftText} />
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
          paddingTop: safeAreaInsets.top + TopTabInset + Spacing.two,
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

function TranscribedDiaryPreview({ text }: { text: string }) {
  return (
    <View style={styles.transcribedPreview}>
      <View style={styles.transcribedStatusRow}>
        <View style={styles.transcribedStatusDot} />
        <ThemedText style={styles.transcribedStatusText}>Splitting</ThemedText>
      </View>
      <ScrollView
        accessibilityLabel="文字起こし済みの日記本文"
        showsVerticalScrollIndicator={false}
        style={styles.transcribedScrollView}
        contentContainerStyle={styles.transcribedBodyContainer}>
        <ThemedText style={styles.transcribedBody} selectable>
          {text}
        </ThemedText>
      </ScrollView>
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

function discardRetryOnlyRecording(recordingId: string | null) {
  if (!recordingId) {
    return;
  }

  const recording = getLocalRecording(recordingId);

  if (recording?.retention === 'retry') {
    void deleteLocalRecording(recordingId);
  }
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
  transcribedPreview: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  transcribedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  transcribedStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#088A81',
  },
  transcribedStatusText: {
    color: '#5F6670',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 900,
  },
  transcribedScrollView: {
    flexShrink: 1,
  },
  transcribedBodyContainer: {
    paddingBottom: Spacing.one,
  },
  transcribedBody: {
    fontSize: 22,
    lineHeight: 34,
    fontWeight: 800,
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
  errorStack: {
    alignItems: 'flex-start',
    gap: Spacing.two,
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
