import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isCardSplitPolicy, type CardSplitPolicy } from '@/lib/card-split-policy';
import { getLocalString, setLocalString } from '@/lib/local-storage';

type CardSplitPolicyContextValue = {
  cardSplitPolicy: CardSplitPolicy;
  isLoaded: boolean;
  setCardSplitPolicy: (nextPolicy: CardSplitPolicy) => void;
};

const CardSplitPolicyStorageKey = 'just-speak-it:card-split-policy:v1';
const DefaultCardSplitPolicy: CardSplitPolicy = 'small_steps';
const CardSplitPolicyContext = createContext<CardSplitPolicyContextValue | null>(null);

export function CardSplitPolicyProvider({ children }: { children: ReactNode }) {
  const [cardSplitPolicy, setCardSplitPolicyState] = useState<CardSplitPolicy>(() => {
    const storedPolicy = getLocalString(CardSplitPolicyStorageKey);
    return isCardSplitPolicy(storedPolicy) ? storedPolicy : DefaultCardSplitPolicy;
  });
  const isLoaded = true;

  const setCardSplitPolicy = useCallback((nextPolicy: CardSplitPolicy) => {
    setCardSplitPolicyState(nextPolicy);
    setLocalString(CardSplitPolicyStorageKey, nextPolicy);
  }, []);

  const value = useMemo(
    () => ({
      cardSplitPolicy,
      isLoaded,
      setCardSplitPolicy,
    }),
    [cardSplitPolicy, isLoaded, setCardSplitPolicy]
  );

  return (
    <CardSplitPolicyContext.Provider value={value}>
      {children}
    </CardSplitPolicyContext.Provider>
  );
}

export function useCardSplitPolicy() {
  const context = use(CardSplitPolicyContext);

  if (!context) {
    throw new Error('useCardSplitPolicy must be used inside CardSplitPolicyProvider.');
  }

  return context;
}
