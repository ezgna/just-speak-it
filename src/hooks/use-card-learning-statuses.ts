import { useCallback, useEffect, useState } from 'react';

import {
  loadCardLearningStatuses,
  restoreCardLearningProgress,
  setCardLearningStatus,
  subscribeToCardLearningStatuses,
  type CardLearningProgress,
  type CardLearningProgresses,
  type CardLearningStatus,
} from '@/lib/card-learning-statuses';

export function useCardLearningStatuses() {
  const [cardStatuses, setCardStatuses] = useState<CardLearningProgresses>({});
  const [hasLoadedCardStatuses, setHasLoadedCardStatuses] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = subscribeToCardLearningStatuses((nextStatuses) => {
      if (!isCancelled) {
        setCardStatuses(nextStatuses);
        setHasLoadedCardStatuses(true);
      }
    });

    loadCardLearningStatuses()
      .then((nextStatuses) => {
        if (!isCancelled) {
          setCardStatuses(nextStatuses);
          setHasLoadedCardStatuses(true);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHasLoadedCardStatuses(true);
        }
      });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, []);

  const setCardStatus = useCallback((cardId: string, status: CardLearningStatus) => {
    void setCardLearningStatus(cardId, status).catch(() => {});
  }, []);

  const restoreCardProgress = useCallback((
    cardId: string,
    progress: CardLearningProgress | undefined
  ) => {
    void restoreCardLearningProgress(cardId, progress).catch(() => {});
  }, []);

  return {
    cardStatuses,
    hasLoadedCardStatuses,
    restoreCardProgress,
    setCardStatus,
  };
}
