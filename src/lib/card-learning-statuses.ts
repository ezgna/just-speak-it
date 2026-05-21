import AsyncStorage from '@react-native-async-storage/async-storage';

export type CardLearningStatus = 'new' | 'learning' | 'known';
export type CardLearningProgress = {
  status: CardLearningStatus;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  successCount: number;
};
export type CardLearningProgresses = Record<string, CardLearningProgress>;

const CardStatusStorageKey = 'daily-to-english:card-statuses:v1';
const LearningRetryDays = 1;
const SuccessReviewIntervalsInDays = [3, 7, 14, 30, 60];
const DayInMilliseconds = 24 * 60 * 60 * 1000;

let cachedStatuses: CardLearningProgresses = {};
let hasLoadedStatuses = false;
let loadPromise: Promise<CardLearningProgresses> | null = null;
let writePromise: Promise<void> = Promise.resolve();
const listeners = new Set<(statuses: CardLearningProgresses) => void>();

export function getCardStatus(
  statuses: CardLearningProgresses,
  cardId: string
): CardLearningStatus {
  return getCardProgress(statuses, cardId).status;
}

export function getCardProgress(statuses: CardLearningProgresses, cardId: string) {
  return statuses[cardId] ?? createNewCardProgress();
}

export function isCardDue(statuses: CardLearningProgresses, cardId: string, now = new Date()) {
  const progress = getCardProgress(statuses, cardId);

  if (progress.status === 'new') {
    return true;
  }

  if (!progress.nextReviewAt) {
    return true;
  }

  const nextReviewTime = new Date(progress.nextReviewAt).getTime();

  return Number.isNaN(nextReviewTime) || nextReviewTime <= now.getTime();
}

export function formatNextReviewLabel(progress: CardLearningProgress, now = new Date()) {
  if (progress.status === 'new') {
    return '';
  }

  if (!progress.nextReviewAt) {
    return '今日';
  }

  const nextReviewDate = new Date(progress.nextReviewAt);

  if (Number.isNaN(nextReviewDate.getTime())) {
    return '今日';
  }

  const diffDays = Math.ceil(
    (getLocalDayStart(nextReviewDate).getTime() - getLocalDayStart(now).getTime()) /
      DayInMilliseconds
  );

  if (diffDays <= 0) {
    return '今日';
  }

  if (diffDays === 1) {
    return '明日';
  }

  return `${diffDays}日後`;
}

export function subscribeToCardLearningStatuses(
  listener: (statuses: CardLearningProgresses) => void
) {
  listeners.add(listener);

  if (hasLoadedStatuses) {
    listener(cachedStatuses);
  }

  return () => {
    listeners.delete(listener);
  };
}

export async function loadCardLearningStatuses() {
  if (hasLoadedStatuses) {
    return cachedStatuses;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = AsyncStorage.getItem(CardStatusStorageKey)
    .then((storedStatuses) => {
      cachedStatuses = parseStoredCardStatuses(storedStatuses);
      hasLoadedStatuses = true;
      notifyCardLearningStatusListeners();

      return cachedStatuses;
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export async function setCardLearningStatus(cardId: string, status: CardLearningStatus) {
  if (!hasLoadedStatuses) {
    await loadCardLearningStatuses();
  }

  cachedStatuses = {
    ...cachedStatuses,
    [cardId]: createReviewedCardProgress(cachedStatuses[cardId], status),
  };
  notifyCardLearningStatusListeners();
  await persistCardLearningStatuses();
}

export async function restoreCardLearningProgress(
  cardId: string,
  progress: CardLearningProgress | undefined
) {
  if (!hasLoadedStatuses) {
    await loadCardLearningStatuses();
  }

  if (progress) {
    cachedStatuses = {
      ...cachedStatuses,
      [cardId]: progress,
    };
  } else {
    const nextStatuses = { ...cachedStatuses };
    delete nextStatuses[cardId];
    cachedStatuses = nextStatuses;
  }

  notifyCardLearningStatusListeners();
  await persistCardLearningStatuses();
}

function persistCardLearningStatuses() {
  const serializedStatuses = JSON.stringify(cachedStatuses);
  writePromise = writePromise
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(CardStatusStorageKey, serializedStatuses));

  return writePromise;
}

function notifyCardLearningStatusListeners() {
  for (const listener of listeners) {
    listener(cachedStatuses);
  }
}

function parseStoredCardStatuses(storedStatuses: string | null): CardLearningProgresses {
  if (!storedStatuses) {
    return {};
  }

  try {
    const parsedStatuses: unknown = JSON.parse(storedStatuses);

    if (
      typeof parsedStatuses !== 'object' ||
      parsedStatuses === null ||
      Array.isArray(parsedStatuses)
    ) {
      return {};
    }

    return Object.entries(parsedStatuses).reduce<CardLearningProgresses>(
      (nextStatuses, [cardId, status]) => {
        const progress = normalizeStoredCardProgress(status);

        if (progress) {
          nextStatuses[cardId] = progress;
        }

        return nextStatuses;
      },
      {}
    );
  } catch {
    return {};
  }
}

function isCardLearningStatus(status: unknown): status is CardLearningStatus {
  return status === 'new' || status === 'learning' || status === 'known';
}

function normalizeStoredCardProgress(value: unknown): CardLearningProgress | null {
  if (isCardLearningStatus(value)) {
    return createLegacyCardProgress(value);
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const status = 'status' in value ? value.status : null;

  if (!isCardLearningStatus(status)) {
    return null;
  }

  return {
    status,
    lastReviewedAt: getOptionalString(value, 'lastReviewedAt'),
    nextReviewAt: getOptionalString(value, 'nextReviewAt'),
    reviewCount: getNonNegativeNumber(value, 'reviewCount'),
    successCount: getNonNegativeNumber(value, 'successCount'),
  };
}

function createNewCardProgress(): CardLearningProgress {
  return {
    status: 'new',
    reviewCount: 0,
    successCount: 0,
  };
}

function createLegacyCardProgress(status: CardLearningStatus): CardLearningProgress {
  if (status === 'new') {
    return createNewCardProgress();
  }

  const now = new Date();
  const successCount = status === 'known' ? 1 : 0;

  return {
    status,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addDays(now, status === 'known' ? SuccessReviewIntervalsInDays[0] : 0).toISOString(),
    reviewCount: 1,
    successCount,
  };
}

function createReviewedCardProgress(
  currentProgress: CardLearningProgress | undefined,
  status: CardLearningStatus
): CardLearningProgress {
  const now = new Date();
  const progress = currentProgress ?? createNewCardProgress();
  const reviewCount = progress.reviewCount + 1;

  if (status === 'new') {
    return createNewCardProgress();
  }

  if (status === 'learning') {
    return {
      status,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: addDays(now, LearningRetryDays).toISOString(),
      reviewCount,
      successCount: 0,
    };
  }

  const successCount = progress.successCount + 1;
  const interval =
    SuccessReviewIntervalsInDays[
      Math.min(successCount - 1, SuccessReviewIntervalsInDays.length - 1)
    ];

  return {
    status,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addDays(now, interval).toISOString(),
    reviewCount,
    successCount,
  };
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DayInMilliseconds);
}

function getLocalDayStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getOptionalString(value: object, key: string) {
  if (!(key in value)) {
    return undefined;
  }

  const fieldValue = value[key as keyof typeof value];

  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function getNonNegativeNumber(value: object, key: string) {
  if (!(key in value)) {
    return 0;
  }

  const fieldValue = value[key as keyof typeof value];

  return typeof fieldValue === 'number' && Number.isFinite(fieldValue) && fieldValue > 0
    ? fieldValue
    : 0;
}
