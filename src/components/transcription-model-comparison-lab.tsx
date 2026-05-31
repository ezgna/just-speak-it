import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import { Spacing } from '@/constants/theme';
import {
  compareTranscriptionModels,
  type TranscriptionComparisonResponse,
  type TranscriptionComparisonResult,
} from '@/lib/backend/transcription';

const PendingModels = [
  { key: 'gpt4o', label: 'GPT-4o Transcribe', model: 'gpt-4o-transcribe' },
  { key: 'diarize', label: 'GPT-4o Diarize / refsなし', model: 'gpt-4o-transcribe-diarize' },
  { key: 'whisper1', label: 'Whisper-1 / segment', model: 'whisper-1' },
  { key: 'whisper1_word', label: 'Whisper-1 / word', model: 'whisper-1' },
] as const;

export function TranscriptionModelComparisonLab() {
  const palette = useDailyPalette();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [recordingStopDurationMillis, setRecordingStopDurationMillis] = useState(0);
  const [comparison, setComparison] = useState<TranscriptionComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordingDurationMillis = recorderState.isRecording
    ? recorderState.durationMillis
    : recordingStopDurationMillis;
  const isBusy = isStarting || isStopping || isComparing;

  async function startRecording() {
    setIsStarting(true);
    setComparison(null);
    setError(null);
    setRecordingStopDurationMillis(0);

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('録音できません', 'マイク権限がないため録音できません。');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (nextError) {
      Alert.alert(
        '録音できません',
        nextError instanceof Error ? nextError.message : '録音の開始に失敗しました。'
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function stopRecording() {
    setIsStopping(true);
    setRecordingStopDurationMillis(recorderState.durationMillis);

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
    } catch (nextError) {
      Alert.alert(
        '録音を停止できません',
        nextError instanceof Error ? nextError.message : '録音の停止に失敗しました。'
      );
    } finally {
      setIsStopping(false);
    }

    if (!recordingUri) {
      return;
    }

    setIsComparing(true);
    setComparison(null);
    setError(null);

    try {
      setComparison(await compareTranscriptionModels(recordingUri));
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : '文字起こし比較に失敗しました。'
      );
    } finally {
      setIsComparing(false);
    }
  }

  async function handlePress() {
    if (recorderState.isRecording) {
      await stopRecording();
      return;
    }

    await startRecording();
  }

  const rows = comparison?.results ?? [];

  return (
    <View style={styles.lab}>
      <GlideButton
        label={
          isStopping
            ? '停止中'
            : recorderState.isRecording
              ? '停止して比較'
              : isComparing
              ? '比較中'
              : isStarting
                ? '録音準備中'
                : '録音比較'
        }
        badge={recorderState.isRecording ? formatRecordingDuration(recordingDurationMillis) : undefined}
        accessibilityLabel={
          recorderState.isRecording ? '録音を停止して文字起こし比較を開始' : '録音比較を開始'
        }
        tone={recorderState.isRecording ? 'orange' : isComparing ? 'aqua' : 'mint'}
        size="large"
        busy={isBusy && !recorderState.isRecording}
        disabled={isBusy}
        holdPressOut={recorderState.isRecording}
        onPress={handlePress}
      />

      {comparison ? (
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.summaryText, { color: palette.muted }]} selectable>
            {comparison.audioFileName}
          </ThemedText>
          <ThemedText style={[styles.summaryText, { color: palette.muted }]} selectable>
            total {formatElapsed(comparison.totalDurationMs)}
          </ThemedText>
        </View>
      ) : null}

      {error ? (
        <ThemedText style={[styles.errorText, { color: palette.coral }]} selectable>
          {error}
        </ThemedText>
      ) : null}

      {isComparing ? (
        <View style={[styles.resultList, { borderTopColor: palette.border }]}>
          {PendingModels.map((model) => (
            <PendingComparisonRow key={model.key} label={model.label} model={model.model} />
          ))}
        </View>
      ) : rows.length > 0 ? (
        <View style={[styles.resultList, { borderTopColor: palette.border }]}>
          {rows.map((result) => (
            <ComparisonResultRow key={result.key} result={result} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PendingComparisonRow({ label, model }: { label: string; model: string }) {
  const palette = useDailyPalette();

  return (
    <View style={[styles.resultRow, { borderBottomColor: palette.border }]}>
      <View style={styles.resultHeader}>
        <View style={styles.resultHeading}>
          <ThemedText style={styles.resultLabel}>{label}</ThemedText>
          <ThemedText style={[styles.resultModel, { color: palette.muted }]} selectable>
            {model}
          </ThemedText>
        </View>
        <ThemedText style={[styles.resultTime, { color: palette.muted }]}>running</ThemedText>
      </View>
    </View>
  );
}

function ComparisonResultRow({ result }: { result: TranscriptionComparisonResult }) {
  const palette = useDailyPalette();
  const displayText = result.error ?? result.text ?? '文字起こし結果が空でした。';
  const segments = result.segments ?? [];
  const words = result.words ?? [];

  return (
    <View style={[styles.resultRow, { borderBottomColor: palette.border }]}>
      <View style={styles.resultHeader}>
        <View style={styles.resultHeading}>
          <ThemedText style={styles.resultLabel}>{result.label}</ThemedText>
          <ThemedText style={[styles.resultModel, { color: palette.muted }]} selectable>
            {result.model}
          </ThemedText>
        </View>
        <ThemedText
          style={[
            styles.resultTime,
            {
              color: result.error ? palette.coral : palette.text,
            },
          ]}
          selectable>
          {formatElapsed(result.durationMs)}
        </ThemedText>
      </View>

      <ThemedText
        style={[
          styles.resultText,
          {
            color: result.error ? palette.coral : palette.text,
          },
        ]}
        selectable>
        {displayText}
      </ThemedText>

      {segments.length > 0 ? (
        <View style={styles.segmentList}>
          {segments.map((segment, index) => (
            <View key={`${result.key}-${index}`} style={styles.segmentRow}>
              <ThemedText style={[styles.segmentTime, { color: palette.muted }]} selectable>
                {formatSegmentRange(segment.start, segment.end)}
              </ThemedText>
              {segment.speaker ? (
                <ThemedText style={[styles.segmentSpeaker, { color: palette.teal }]} selectable>
                  {segment.speaker}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.segmentText, { color: palette.muted }]} selectable>
                {segment.text}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {words.length > 0 ? (
        <View style={styles.wordList}>
          {words.map((word, index) => (
            <View key={`${result.key}-word-${index}`} style={[styles.wordItem, { borderColor: palette.border }]}>
              <ThemedText style={[styles.wordTime, { color: palette.muted }]} selectable>
                {formatSegmentRange(word.start, word.end)}
              </ThemedText>
              <ThemedText style={[styles.wordText, { color: palette.text }]} selectable>
                {word.word}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function formatRecordingDuration(durationMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatElapsed(durationMillis: number) {
  return `${(Math.max(0, durationMillis) / 1000).toFixed(2)}s`;
}

function formatSegmentRange(start?: number, end?: number) {
  if (typeof start !== 'number' && typeof end !== 'number') {
    return '--:--';
  }

  if (typeof start !== 'number') {
    return `--:-- - ${formatSeconds(end ?? 0)}`;
  }

  if (typeof end !== 'number') {
    return formatSeconds(start);
  }

  return `${formatSeconds(start)} - ${formatSeconds(end)}`;
}

function formatSeconds(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  lab: {
    gap: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 700,
  },
  resultList: {
    borderTopWidth: 2,
  },
  resultRow: {
    gap: Spacing.two,
    borderBottomWidth: 1,
    paddingVertical: Spacing.three,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  resultHeading: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  resultLabel: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: 900,
  },
  resultModel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 800,
  },
  resultTime: {
    minWidth: 64,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  resultText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: 700,
  },
  segmentList: {
    gap: Spacing.one,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  segmentTime: {
    width: 88,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  segmentSpeaker: {
    minWidth: 28,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 900,
  },
  segmentText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: 700,
  },
  wordList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  wordItem: {
    borderWidth: 1,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
  },
  wordTime: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  wordText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
});
