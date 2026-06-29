export type CardSplitPolicy = 'meaning_unit' | 'small_steps';
export type EntrySource = 'text' | 'voice';
export type PracticeGenerationStatus = 'draft' | 'translating' | 'completed' | 'failed' | 'discarded';
export type TranslationStyle = 'native' | 'simple';
export const DefaultTranslationStyle: TranslationStyle = 'simple';

export type TranscriptWord = {
  index: number;
  word: string;
  start: number;
  end: number;
};

export type PreparePracticeDraftRequest = {
  cardSplitPolicy: CardSplitPolicy;
  cleanedText: string;
  clientRequestId: string;
  diaryText: string;
  isTranscriptEdited: boolean;
  rawTranscriptText: string;
  source: EntrySource;
  transcriptWords: TranscriptWord[];
  waveformPeaks: number[];
};

export type CompletePracticeRequest = {
  practiceGenerationId: string;
  translationStyle: TranslationStyle;
};

export type ParseResult<T> =
  | { type: 'ok'; value: T }
  | { type: 'error'; message: string };

export const DraftPromptVersion = 'draft-v2';
export const DraftSchemaVersion = 'daily_to_english_practice_draft_v2';
export const TranslationPromptVersion = 'translation-v2';
export const TranslationSchemaVersion = 'daily_to_english_completed_practice_v2';

export function parsePreparePracticeDraftRequest(value: unknown): ParseResult<PreparePracticeDraftRequest> {
  if (!isRecord(value)) {
    return { type: 'error', message: 'リクエスト本文が必要です。' };
  }

  const clientRequestId = readRequiredString(value.clientRequestId, 'clientRequestId');

  if (clientRequestId.type === 'error') {
    return clientRequestId;
  }

  const diaryText = readOptionalString(value.diaryText);
  const cleanedText = readOptionalString(value.cleanedText);
  const plainText = cleanedText || diaryText;

  if (!plainText) {
    return { type: 'error', message: '日記本文が必要です。' };
  }

  const source = parseEntrySource(value.source);

  if (!source) {
    return { type: 'error', message: 'sourceはtextまたはvoiceで指定してください。' };
  }

  const cardSplitPolicy = parseCardSplitPolicy(value.cardSplitPolicy);

  if (!cardSplitPolicy) {
    return { type: 'error', message: 'cardSplitPolicyが不正です。' };
  }

  const rawTranscriptText =
    readOptionalString(value.rawTranscriptText) ||
    readOptionalString(value.transcriptText) ||
    plainText;

  return {
    type: 'ok',
    value: {
      cardSplitPolicy,
      cleanedText: plainText,
      clientRequestId: clientRequestId.value,
      diaryText: diaryText || plainText,
      isTranscriptEdited: source === 'voice' && value.isTranscriptEdited === true,
      rawTranscriptText,
      source,
      transcriptWords: source === 'voice' ? normalizeTranscriptWords(value.transcriptWords) : [],
      waveformPeaks: source === 'voice' ? normalizeWaveformPeaks(value.waveformPeaks) : [],
    },
  };
}

export function parseCompletePracticeRequest(value: unknown): ParseResult<CompletePracticeRequest> {
  if (!isRecord(value)) {
    return { type: 'error', message: 'リクエスト本文が必要です。' };
  }

  const practiceGenerationId = readRequiredString(value.practiceGenerationId, 'practiceGenerationId');

  if (practiceGenerationId.type === 'error') {
    return practiceGenerationId;
  }

  const translationStyle =
    value.translationStyle === undefined || value.translationStyle === null
      ? DefaultTranslationStyle
      : parseTranslationStyle(value.translationStyle);

  if (!translationStyle) {
    return { type: 'error', message: 'translationStyleが不正です。' };
  }

  return {
    type: 'ok',
    value: {
      practiceGenerationId: practiceGenerationId.value,
      translationStyle,
    },
  };
}

export function normalizeTranscriptWords(value: unknown): TranscriptWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((word, fallbackIndex) => {
      if (
        !isRecord(word) ||
        typeof word.word !== 'string' ||
        typeof word.start !== 'number' ||
        typeof word.end !== 'number'
      ) {
        return [];
      }

      return {
        index: typeof word.index === 'number' ? word.index : fallbackIndex,
        word: word.word.trim(),
        start: word.start,
        end: word.end,
      };
    })
    .filter((word) => word.word.length > 0);
}

export function normalizeWaveformPeaks(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((peak) => {
      if (typeof peak !== 'number' || !Number.isFinite(peak)) {
        return [];
      }

      return [Math.round(Math.max(0, Math.min(1, peak)) * 1000) / 1000];
    })
    .slice(0, 96);
}

function parseCardSplitPolicy(value: unknown): CardSplitPolicy | null {
  return value === 'meaning_unit' || value === 'small_steps' ? value : null;
}

function parseEntrySource(value: unknown): EntrySource | null {
  return value === 'text' || value === 'voice' ? value : null;
}

function parseTranslationStyle(value: unknown): TranslationStyle | null {
  return value === 'native' || value === 'simple' ? value : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readRequiredString(value: unknown, fieldName: string): ParseResult<string> {
  const text = readOptionalString(value);

  if (!text) {
    return { type: 'error', message: `${fieldName}が必要です。` };
  }

  return { type: 'ok', value: text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
