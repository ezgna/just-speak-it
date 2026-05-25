import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isGenerationMode, type GenerationMode } from '@/lib/generation-mode';
import { getLocalString, setLocalString } from '@/lib/local-storage';

type GenerationModeContextValue = {
  generationMode: GenerationMode;
  isLoaded: boolean;
  setGenerationMode: (nextMode: GenerationMode) => void;
};

const GenerationModeStorageKey = 'just-speak-it:generation-mode:v1';
const DefaultGenerationMode: GenerationMode = 'compact';
const GenerationModeContext = createContext<GenerationModeContextValue | null>(null);

export function GenerationModeProvider({ children }: { children: ReactNode }) {
  const [generationMode, setGenerationModeState] = useState<GenerationMode>(() => {
    const storedMode = getLocalString(GenerationModeStorageKey);
    return isGenerationMode(storedMode) ? storedMode : DefaultGenerationMode;
  });
  const isLoaded = true;

  const setGenerationMode = useCallback((nextMode: GenerationMode) => {
    setGenerationModeState(nextMode);
    setLocalString(GenerationModeStorageKey, nextMode);
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
