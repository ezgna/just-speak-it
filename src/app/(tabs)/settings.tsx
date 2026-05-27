import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GenerationModeSelector } from '@/components/generation-mode-selector';
import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemePreferenceSelector } from '@/components/theme-preference-selector';
import { GlideButton } from '@/components/ui/glide-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: safeAreaInsets.top + Spacing.three,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      <View style={styles.container}>
        {__DEV__ ? (
          <GlideButton
            label="実験室"
            caption="design lab"
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            tone="mint"
            size="medium"
            onPress={() => router.push('/design-lab')}
          />
        ) : null}

        <ThemePreferenceSelector />
        <GenerationModeSelector />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
});
