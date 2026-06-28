import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import '@/global.css';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CardSplitPolicyProvider } from '@/hooks/use-card-split-policy';
import {
  ThemePreferenceProvider,
  useResolvedColorScheme,
} from '@/hooks/use-theme-preference';
import { TranslationStyleProvider } from '@/hooks/use-translation-style';
import { ensureBackendSchemaGeneration } from '@/lib/backend/schema-generation';

export default function TabLayout() {
  const [isBackendSchemaReady, setIsBackendSchemaReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    ensureBackendSchemaGeneration()
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) {
          setIsBackendSchemaReady(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        {isBackendSchemaReady && (
          <ThemePreferenceProvider>
            <CardSplitPolicyProvider>
              <TranslationStyleProvider>
                <RootNavigator />
              </TranslationStyleProvider>
            </CardSplitPolicyProvider>
          </ThemePreferenceProvider>
        )}
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const colorScheme = useResolvedColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="design-lab" options={{ title: '実験室' }} />
        <Stack.Screen name="prototype-room" options={{ title: '試作室' }} />
        <Stack.Screen name="workbench" options={{ title: 'ワークベンチ' }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
