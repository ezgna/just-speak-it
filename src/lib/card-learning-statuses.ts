import { removeLocalValue } from '@/lib/local-storage';

export type CardLearningStatus = 'new' | 'learning' | 'known';
export type CardLearningProgress = {
  status: CardLearningStatus;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  successCount: number;
};
export type CardLearningProgresses = Record<string, CardLearningProgress>;

const LegacyCardStatusStorageKey = 'just-speak-it:card-statuses:v1';
const LearningRetryDays = 1;
const SuccessReviewIntervalsInDays = [3, 7, 14, 30, 60];
const DayInMilliseconds = 24 * 60 * 60 * 1000;

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

export function createNewCardProgress(): CardLearningProgress {
  return {
    status: 'new',
    reviewCount: 0,
    successCount: 0,
  };
}

export function createReviewedCardProgress(
  currentProgress: CardLearningProgress | undefined,
  status: CardLearningStatus
): CardLearningProgress {
  if (status === 'new') {
    return createNewCardProgress();
  }

  const now = new Date();
  const reviewCount = (currentProgress?.reviewCount ?? 0) + 1;
  const successCount = status === 'known' ? (currentProgress?.successCount ?? 0) + 1 : 0;

  return {
    status,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: getNextReviewDate({
      now,
      status,
      successCount,
    }).toISOString(),
    reviewCount,
    successCount,
  };
}

export function clearLegacyCardLearningStatuses() {
  removeLocalValue(LegacyCardStatusStorageKey);
}

export function isCardLearningStatus(status: unknown): status is CardLearningStatus {
  return status === 'new' || status === 'learning' || status === 'known';
}

function getNextReviewDate({
  now,
  status,
  successCount,
}: {
  now: Date;
  status: CardLearningStatus;
  successCount: number;
}) {
  const nextDate = new Date(now);
  const intervalDays =
    status === 'learning'
      ? LearningRetryDays
      : SuccessReviewIntervalsInDays[
          Math.min(Math.max(successCount - 1, 0), SuccessReviewIntervalsInDays.length - 1)
        ];

  nextDate.setDate(nextDate.getDate() + intervalDays);
  return nextDate;
}

function getLocalDayStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
