import { useCallback, useMemo, useState } from 'react';

import {
  restoreTranslationCardLearningProgress,
  setTranslationCardLearningStatus,
} from '@/lib/backend/practice';
import {
  createReviewedCardProgress,
  type CardLearningProgress,
  type CardLearningProgresses,
  type CardLearningStatus,
} from '@/lib/card-learning-statuses';

export function useCardLearningStatuses(initialStatuses: CardLearningProgresses = {}) {
  const [overriddenStatuses, setOverriddenStatuses] = useState<CardLearningProgresses>({});
  const cardStatuses = useMemo(
    () => ({
      ...initialStatuses,
      ...overriddenStatuses,
    }),
    [initialStatuses, overriddenStatuses]
  );

  const setCardStatus = useCallback(
    (cardId: string, status: CardLearningStatus) => {
      setOverriddenStatuses((currentStatuses) => ({
        ...currentStatuses,
        [cardId]: createReviewedCardProgress(
          currentStatuses[cardId] ?? initialStatuses[cardId],
          status
        ),
      }));

      void setTranslationCardLearningStatus(cardId, status).catch(() => {});
    },
    [initialStatuses]
  );

  const restoreCardProgress = useCallback(
    (cardId: string, progress: CardLearningProgress | undefined) => {
      setOverriddenStatuses((currentStatuses) => {
        if (progress) {
          return {
            ...currentStatuses,
            [cardId]: progress,
          };
        }

        const nextStatuses = { ...currentStatuses };
        delete nextStatuses[cardId];
        return nextStatuses;
      });

      if (progress) {
        void restoreTranslationCardLearningProgress(cardId, progress).catch(() => {});
      }
    },
    []
  );

  return {
    cardStatuses,
    hasLoadedCardStatuses: true,
    restoreCardProgress,
    setCardStatus,
  };
}
