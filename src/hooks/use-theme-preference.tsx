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

import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

type ThemePreferenceContextValue = {
  isLoaded: boolean;
  resolvedColorScheme: ResolvedColorScheme;
  setThemePreference: (nextPreference: ThemePreference) => void;
  systemColorScheme: ResolvedColorScheme;
  themePreference: ThemePreference;
};

const ThemePreferenceStorageKey = 'just-speak-it:theme-preference:v1';
const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const systemColorScheme: ResolvedColorScheme = systemScheme === 'dark' ? 'dark' : 'light';
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(ThemePreferenceStorageKey)
      .then((storedPreference) => {
        if (isMounted && isThemePreference(storedPreference)) {
          setThemePreferenceState(storedPreference);
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

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    setThemePreferenceState(nextPreference);
    void AsyncStorage.setItem(ThemePreferenceStorageKey, nextPreference).catch(() => undefined);
  }, []);

  const resolvedColorScheme =
    themePreference === 'system' ? systemColorScheme : themePreference;

  const value = useMemo(
    () => ({
      isLoaded,
      resolvedColorScheme,
      setThemePreference,
      systemColorScheme,
      themePreference,
    }),
    [isLoaded, resolvedColorScheme, setThemePreference, systemColorScheme, themePreference]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const context = use(ThemePreferenceContext);

  if (!context) {
    throw new Error('useThemePreference must be used inside ThemePreferenceProvider.');
  }

  return context;
}

export function useResolvedColorScheme() {
  return useThemePreference().resolvedColorScheme;
}
