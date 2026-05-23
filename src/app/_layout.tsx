import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/global.css';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import {
  ThemePreferenceProvider,
  useResolvedColorScheme,
} from '@/hooks/use-theme-preference';

export default function TabLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemePreferenceProvider>
        <RootNavigator />
      </ThemePreferenceProvider>
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
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
