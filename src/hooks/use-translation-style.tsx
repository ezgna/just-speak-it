import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getLocalString, setLocalString } from '@/lib/local-storage';
import { isTranslationStyle, type TranslationStyle } from '@/lib/translation-style';

type TranslationStyleContextValue = {
  isLoaded: boolean;
  setTranslationStyle: (nextStyle: TranslationStyle) => void;
  translationStyle: TranslationStyle;
};

const TranslationStyleStorageKey = 'just-speak-it:translation-style:v1';
const DefaultTranslationStyle: TranslationStyle = 'native';
const TranslationStyleContext = createContext<TranslationStyleContextValue | null>(null);

export function TranslationStyleProvider({ children }: { children: ReactNode }) {
  const [translationStyle, setTranslationStyleState] = useState<TranslationStyle>(() => {
    const storedStyle = getLocalString(TranslationStyleStorageKey);
    return isTranslationStyle(storedStyle) ? storedStyle : DefaultTranslationStyle;
  });
  const isLoaded = true;

  const setTranslationStyle = useCallback((nextStyle: TranslationStyle) => {
    setTranslationStyleState(nextStyle);
    setLocalString(TranslationStyleStorageKey, nextStyle);
  }, []);

  const value = useMemo(
    () => ({
      isLoaded,
      setTranslationStyle,
      translationStyle,
    }),
    [isLoaded, setTranslationStyle, translationStyle]
  );

  return (
    <TranslationStyleContext.Provider value={value}>
      {children}
    </TranslationStyleContext.Provider>
  );
}

export function useTranslationStyle() {
  const context = use(TranslationStyleContext);

  if (!context) {
    throw new Error('useTranslationStyle must be used inside TranslationStyleProvider.');
  }

  return context;
}
