import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isGenerationMode, type GenerationMode } from '@/lib/generation-mode';

type GenerationModeContextValue = {
  generationMode: GenerationMode;
  isLoaded: boolean;
  setGenerationMode: (nextMode: GenerationMode) => void;
};

const GenerationModeStorageKey = 'just-speak-it:generation-mode:v1';
const GenerationModeContext = createContext<GenerationModeContextValue | null>(null);

export function GenerationModeProvider({ children }: { children: ReactNode }) {
  const [generationMode, setGenerationModeState] = useState<GenerationMode>('natural');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(GenerationModeStorageKey)
      .then((storedMode) => {
        if (isMounted && isGenerationMode(storedMode)) {
          setGenerationModeState(storedMode);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) {
          setIsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setGenerationMode = useCallback((nextMode: GenerationMode) => {
    setGenerationModeState(nextMode);
    void AsyncStorage.setItem(GenerationModeStorageKey, nextMode).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      generationMode,
      isLoaded,
      setGenerationMode,
    }),
    [generationMode, isLoaded, setGenerationMode]
  );

  return (
    <GenerationModeContext.Provider value={value}>
      {children}
    </GenerationModeContext.Provider>
  );
}

export function useGenerationMode() {
  const context = use(GenerationModeContext);

  if (!context) {
    throw new Error('useGenerationMode must be used inside GenerationModeProvider.');
  }

  return context;
}
