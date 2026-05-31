import {
  FieldGroup,
  Host,
  Row,
  Spacer,
  Text,
  TextInput,
  type TextInputRef,
  useNativeState,
} from '@expo/ui';
import {
  Button as SwiftButton,
  HStack as SwiftHStack,
  Host as SwiftHost,
  Image as SwiftImage,
  type ImageProps as SwiftImageProps,
  Text as SwiftText,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  font,
  lineLimit,
  opacity,
  padding,
  scrollIndicators,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useGenerationMode } from '@/hooks/use-generation-mode';
import { useResolvedColorScheme } from '@/hooks/use-theme-preference';
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
type NativeEditablePracticeCard = PracticeDraftCard;
type NativeReadOnlyPracticeCard = PracticeDraftCard | TranslationCard;
type NativeColorSet = {
  errorText: string;
  placeholderText: string;
  primaryText: string;
  screenBackground: string;
  secondaryText: string;
  selection: string;
};

const NativeColors: Record<'dark' | 'light', NativeColorSet> = {
  dark: {
    errorText: '#FF453A',
    placeholderText: '#8E8E93',
    primaryText: '#FFFFFF',
    screenBackground: '#000000',
    secondaryText: '#A6A6AE',
    selection: '#65D7F2',
  },
  light: {
    errorText: '#D92D20',
    placeholderText: '#8A8A8E',
    primaryText: '#111111',
    screenBackground: '#F2F2F7',
    secondaryText: '#6E6E73',
    selection: '#276EF1',
  },
};
const MemoStackerCopyAccent = '#276EF1';
const PrimaryActionButtonHeight = 82;
const PrimaryActionButtonFontSize = 20;
const PrimaryActionButtonHorizontalPadding = 26;
const PrimaryActionButtonSideInset = Spacing.four;
const PrimaryActionIconSize = 22;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const colorScheme = useResolvedColorScheme();
  const nativeColors = NativeColors[colorScheme];
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const { generationMode } = useGenerationMode();
  const [diaryDraftText, setDiaryDraftText] = useState('');
  const { nativeText: diaryDraftNativeText, setNativeText: setDiaryDraftNativeText } =
    useSyncedNativeText(diaryDraftText);
  const [diaryDraftSource, setDiaryDraftSource] = useState<DiaryDraftSource>('text');
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const [recordingIntentActive, setRecordingIntentActive] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const [recordingStopDurationMillis, setRecordingStopDurationMillis] = useState(0);
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
  const diaryDraftInputRef = useRef<TextInputRef>(null);
  const currentDraft = activeDraft?.generationMode === generationMode ? activeDraft : null;

  const isRecordingButtonActive = recorderState.isRecording || isStoppingRecording;
  const isWritingButtonActive =
    !isRecordingButtonActive && (isTranscribing || isPreparingDraft || isCompletingPractice);
  const recordingButtonDurationMillis = recorderState.isRecording
    ? recorderState.durationMillis
    : recordingStopDurationMillis;
  const recordingButtonDurationLabel = formatDuration(recordingButtonDurationMillis);
  const isWorking = isRecordingBusy || isTranscribing || isPreparingDraft || isCompletingPractice;
  const isRecordingButtonDisabled =
    isWorking || (recordingIntentActive && !recorderState.isRecording);
  const isDraftInputEditable =
    !recorderState.isRecording && !isWorking && !currentDraft && completedPracticeCards.length === 0;
  const hasDraftText = diaryDraftText.trim().length > 0;
  const hasActiveDraft = Boolean(currentDraft && draftCards.length > 0);
  const hasCompletedPracticeCards = completedPracticeCards.length > 0;
  const shouldShowSplitAction =
    hasDraftText &&
    !hasActiveDraft &&
    !hasCompletedPracticeCards &&
    !isRecordingButtonActive &&
    !isWritingButtonActive;
  const shouldShowMakeCardsAction =
    hasActiveDraft &&
    !hasCompletedPracticeCards &&
    !isRecordingButtonActive &&
    !isWritingButtonActive;
  const shouldShowReviewAction =
    hasCompletedPracticeCards && !isRecordingButtonActive && !isWritingButtonActive;
  const primaryActionLabel = getPrimaryActionLabel({
    isCompletingPractice,
    isPreparingDraft,
    isRecordingButtonActive,
    isTranscribing,
    recordingButtonDurationLabel,
    shouldShowMakeCardsAction,
    shouldShowReviewAction,
    shouldShowSplitAction,
  });
  const statusMessages = getStatusMessages({
    isCompletingPractice,
    isPreparingDraft,
    isRecordingBusy,
    isStoppingRecording,
    isTranscribing,
    recordingButtonDurationLabel,
    recorderIsRecording: recorderState.isRecording,
  });
  const visibleCompletedPracticeCards = completedPracticeCards.filter(
    (card) => card.japanese.trim().length > 0
  );
  const horizontalScreenPadding =
    Math.max(safeAreaInsets.left, Spacing.three) + Math.max(safeAreaInsets.right, Spacing.three);
  const primaryActionButtonWidth = Math.min(
    Math.max(width - horizontalScreenPadding - PrimaryActionButtonSideInset * 2, 0),
    MaxContentWidth
  );
  const markDraftInteraction = useCallback(() => {
    draftInteractionVersionRef.current += 1;
  }, []);

  const resetDraftState = useCallback(() => {
    markDraftInteraction();
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
    diaryDraftInputRef.current?.blur();

    if (recorderState.isRecording) {
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
    setDiaryDraftNativeText(nextText);
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

  function handleDraftCardJapaneseChange(cardId: string, nextJapanese: string) {
    setDraftCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId ? { ...card, japanese: nextJapanese } : card
      )
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: nativeColors.screenBackground,
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      <Host colorScheme={colorScheme} style={styles.host}>
        <FieldGroup
          modifiers={[scrollIndicators('never', 'vertical')]}
          style={{ backgroundColor: nativeColors.screenBackground }}>
          {!hasActiveDraft && !hasCompletedPracticeCards ? (
            <FieldGroup.Section title="入力">
              <TextInput
                ref={diaryDraftInputRef}
                value={diaryDraftNativeText}
                editable={isDraftInputEditable}
                multiline
                numberOfLines={6}
                autoCapitalize="sentences"
                autoCorrect
                placeholder="今ふと考えていることをなんでも自由に日本語で話す・書く。"
                placeholderTextColor={nativeColors.placeholderText}
                returnKeyType="default"
                selectionColor={nativeColors.selection}
                style={getDiaryInputStyle(isDraftInputEditable)}
                textStyle={getDiaryInputTextStyle(nativeColors)}
                testID="today-diary-input"
                onChangeText={handleDraftTextChange}
              />
            </FieldGroup.Section>
          ) : null}

          {hasActiveDraft ? (
            <FieldGroup.Section title="カード下書き">
              {draftCards.map((card, index) => (
                <EditablePracticeCardRow
                  key={card.id}
                  card={card}
                  colors={nativeColors}
                  disabled={isCompletingPractice}
                  index={index}
                  onCardJapaneseChange={handleDraftCardJapaneseChange}
                />
              ))}
            </FieldGroup.Section>
          ) : null}

          {hasCompletedPracticeCards ? (
            <FieldGroup.Section title="作成済みカード">
              {visibleCompletedPracticeCards.map((card, index) => (
                <ReadOnlyPracticeCardRow
                  key={card.id}
                  card={card}
                  colors={nativeColors}
                  index={index}
                />
              ))}
            </FieldGroup.Section>
          ) : null}

          {statusMessages.length > 0 ? (
            <FieldGroup.Section title="状態">
              {statusMessages.map((message) => (
                <Text key={message} textStyle={getStatusTextStyle(nativeColors)}>
                  {message}
                </Text>
              ))}
            </FieldGroup.Section>
          ) : null}

          {transcriptionError || generationError ? (
            <FieldGroup.Section title="エラー">
              {transcriptionError ? (
                <Text textStyle={getErrorTextStyle(nativeColors)}>{transcriptionError}</Text>
              ) : null}
              {generationError ? (
                <Text textStyle={getErrorTextStyle(nativeColors)}>{generationError}</Text>
              ) : null}
            </FieldGroup.Section>
          ) : null}
        </FieldGroup>
      </Host>
      <View style={styles.buttonStack}>
        {hasActiveDraft && !isCompletingPractice ? (
          <View style={styles.draftActionStack}>
            <View style={styles.primaryButtonDock}>
              <MemoStackerPrimaryActionButton
                colorScheme={colorScheme}
                disabled={isRecordingButtonDisabled}
                iconName={getPrimaryActionIconName(primaryActionLabel)}
                label={primaryActionLabel}
                width={primaryActionButtonWidth}
                onPress={handlePrimaryActionPress}
              />
            </View>
            <StartOverTextAction colorScheme={colorScheme} onPress={handleDiscardDraft} />
          </View>
        ) : (
          <View style={styles.primaryButtonDock}>
            <MemoStackerPrimaryActionButton
              colorScheme={colorScheme}
              disabled={isRecordingButtonDisabled}
              iconName={getPrimaryActionIconName(primaryActionLabel)}
              label={primaryActionLabel}
              width={primaryActionButtonWidth}
              onPress={handlePrimaryActionPress}
            />
          </View>
        )}

      </View>
    </View>
  );
}

function MemoStackerPrimaryActionButton({
  colorScheme,
  disabled,
  iconName,
  label,
  onPress,
  width,
}: {
  colorScheme: 'dark' | 'light';
  disabled: boolean;
  iconName: NonNullable<SwiftImageProps['systemName']>;
  label: string;
  onPress: () => void;
  width: number;
}) {
  const contentWidth = Math.max(width - PrimaryActionButtonHorizontalPadding * 2, 0);

  return (
    <SwiftHost colorScheme={colorScheme} style={{ height: PrimaryActionButtonHeight, width }}>
      <SwiftButton
        onPress={onPress}
        modifiers={[
          accessibilityLabel(label),
          frame({ width, minHeight: PrimaryActionButtonHeight }),
          padding({
            top: 0,
            bottom: 0,
            leading: PrimaryActionButtonHorizontalPadding,
            trailing: PrimaryActionButtonHorizontalPadding,
          }),
          controlSize('large'),
          buttonStyle('glassProminent'),
          tint(MemoStackerCopyAccent),
          disabledModifier(disabled),
          opacity(disabled ? 0.82 : 1),
        ]}>
        <SwiftHStack
          spacing={9}
          modifiers={[frame({ width: contentWidth, minHeight: PrimaryActionButtonHeight })]}>
          <SwiftImage
            systemName={iconName}
            size={PrimaryActionIconSize}
          />
          <SwiftText
            modifiers={[
              font({ size: PrimaryActionButtonFontSize, weight: 'semibold' }),
              lineLimit(1),
            ]}>
            {label}
          </SwiftText>
        </SwiftHStack>
      </SwiftButton>
    </SwiftHost>
  );
}

function StartOverTextAction({
  colorScheme,
  onPress,
}: {
  colorScheme: 'dark' | 'light';
  onPress: () => void;
}) {
  return (
    <SwiftHost matchContents colorScheme={colorScheme}>
      <SwiftButton
        onPress={onPress}
        modifiers={[
          accessibilityLabel('Start over'),
          buttonStyle('plain'),
          tint(MemoStackerCopyAccent),
          padding({ top: 4, bottom: 4, leading: 18, trailing: 18 }),
        ]}>
        <SwiftText
          modifiers={[font({ size: 16, weight: 'medium' }), lineLimit(1), opacity(0.84)]}>
          Start over
        </SwiftText>
      </SwiftButton>
    </SwiftHost>
  );
}

function EditablePracticeCardRow({
  card,
  colors,
  disabled,
  index,
  onCardJapaneseChange,
}: {
  card: NativeEditablePracticeCard;
  colors: NativeColorSet;
  disabled: boolean;
  index: number;
  onCardJapaneseChange: (cardId: string, nextJapanese: string) => void;
}) {
  const { nativeText: cardNativeText, setNativeText: setCardNativeText } =
    useSyncedNativeText(card.japanese);

  const handleCardTextChange = useCallback(
    (nextJapanese: string) => {
      setCardNativeText(nextJapanese);
      onCardJapaneseChange(card.id, nextJapanese);
    },
    [card.id, onCardJapaneseChange, setCardNativeText]
  );

  return (
    <Row alignment="start" spacing={10}>
      <Text textStyle={getCardIndexTextStyle(colors)}>{String(index + 1)}</Text>
      <TextInput
        value={cardNativeText}
        editable={!disabled}
        multiline
        numberOfLines={3}
        selectionColor={colors.selection}
        style={getCardInputStyle(disabled)}
        textStyle={getCardInputTextStyle(colors)}
        testID={`today-draft-card-${card.id}`}
        onChangeText={handleCardTextChange}
      />
    </Row>
  );
}

/* eslint-disable react-hooks/immutability -- @expo/ui の ObservableState は value 更新が公式API。 */
function useSyncedNativeText(sourceText: string) {
  const nativeText = useNativeState(sourceText);
  const nativeSyncRef = useRef(sourceText);

  const setNativeText = useCallback(
    (nextText: string) => {
      nativeText.value = nextText;
      nativeSyncRef.current = nextText;
    },
    [nativeText]
  );

  useEffect(() => {
    if (nativeSyncRef.current === sourceText) {
      return;
    }

    setNativeText(sourceText);
  }, [setNativeText, sourceText]);

  return { nativeText, setNativeText };
}
/* eslint-enable react-hooks/immutability */

function ReadOnlyPracticeCardRow({
  card,
  colors,
  index,
}: {
  card: NativeReadOnlyPracticeCard;
  colors: NativeColorSet;
  index: number;
}) {
  return (
    <Row alignment="start" spacing={10}>
      <Text textStyle={getCardIndexTextStyle(colors)}>{String(index + 1)}</Text>
      <Text textStyle={getCardTextStyle(colors)}>{card.japanese}</Text>
      <Spacer flexible />
    </Row>
  );
}

function getPrimaryActionLabel({
  isCompletingPractice,
  isPreparingDraft,
  isRecordingButtonActive,
  isTranscribing,
  recordingButtonDurationLabel,
  shouldShowMakeCardsAction,
  shouldShowReviewAction,
  shouldShowSplitAction,
}: {
  isCompletingPractice: boolean;
  isPreparingDraft: boolean;
  isRecordingButtonActive: boolean;
  isTranscribing: boolean;
  recordingButtonDurationLabel: string;
  shouldShowMakeCardsAction: boolean;
  shouldShowReviewAction: boolean;
  shouldShowSplitAction: boolean;
}) {
  if (isTranscribing) {
    return 'Transcribing';
  }

  if (isPreparingDraft) {
    return 'Splitting';
  }

  if (isCompletingPractice) {
    return 'Making it';
  }

  if (isRecordingButtonActive) {
    return recordingButtonDurationLabel;
  }

  if (shouldShowReviewAction) {
    return 'Review it';
  }

  if (shouldShowMakeCardsAction) {
    return 'Make cards';
  }

  if (shouldShowSplitAction) {
    return 'Split it';
  }

  return 'Speak it';
}

function getPrimaryActionIconName(label: string): NonNullable<SwiftImageProps['systemName']> {
  if (/^\d+:\d{2}$/.test(label)) {
    return 'stop.circle.fill';
  }

  switch (label) {
    case 'Transcribing':
      return 'waveform';
    case 'Splitting':
    case 'Split it':
      return 'rectangle.split.2x1.fill';
    case 'Making it':
    case 'Make cards':
      return 'sparkles';
    case 'Review it':
      return 'rectangle.stack.fill';
    default:
      return 'mic.fill';
  }
}

function getStatusMessages({
  isCompletingPractice,
  isPreparingDraft,
  isRecordingBusy,
  isStoppingRecording,
  isTranscribing,
  recordingButtonDurationLabel,
  recorderIsRecording,
}: {
  isCompletingPractice: boolean;
  isPreparingDraft: boolean;
  isRecordingBusy: boolean;
  isStoppingRecording: boolean;
  isTranscribing: boolean;
  recordingButtonDurationLabel: string;
  recorderIsRecording: boolean;
}) {
  const messages: string[] = [];

  if (isRecordingBusy && !recorderIsRecording && !isStoppingRecording) {
    messages.push('録音を準備しています。');
  }

  if (recorderIsRecording || isStoppingRecording) {
    messages.push(`録音中 ${recordingButtonDurationLabel}`);
  }

  if (isTranscribing) {
    messages.push('文字起こし中です。');
  }

  if (isPreparingDraft) {
    messages.push('日本語をカード向けに分割しています。');
  }

  if (isCompletingPractice) {
    messages.push('英語カードを作成しています。');
  }

  return messages;
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

function getDiaryInputStyle(isEditable: boolean) {
  return {
    backgroundColor: 'transparent',
    height: 220,
    opacity: isEditable ? 1 : 0.72,
    padding: 0,
    width: '100%',
  } as const;
}

function getCardInputStyle(isDisabled: boolean) {
  return {
    backgroundColor: 'transparent',
    height: 88,
    opacity: isDisabled ? 0.72 : 1,
    padding: 0,
    width: '100%',
  } as const;
}

function getDiaryInputTextStyle(colors: NativeColorSet) {
  return {
    color: colors.primaryText,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 30,
  } as const;
}

function getCardInputTextStyle(colors: NativeColorSet) {
  return {
    color: colors.primaryText,
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 28,
  } as const;
}

function getCardTextStyle(colors: NativeColorSet) {
  return {
    color: colors.primaryText,
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 28,
  } as const;
}

function getCardIndexTextStyle(colors: NativeColorSet) {
  return {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  } as const;
}

function getStatusTextStyle(colors: NativeColorSet) {
  return {
    color: colors.secondaryText,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  } as const;
}

function getErrorTextStyle(colors: NativeColorSet) {
  return {
    color: colors.errorText,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  } as const;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  host: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  buttonStack: {
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  primaryButtonDock: {
    alignItems: 'center',
  },
  draftActionStack: {
    alignItems: 'center',
    gap: Spacing.one,
    width: '100%',
  },
});
