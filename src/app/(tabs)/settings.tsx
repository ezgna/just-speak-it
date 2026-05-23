import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemePreferenceSelector } from '@/components/theme-preference-selector';
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
        <View style={styles.header}>
          <ThemedText type="subtitle" selectable>
            設定
          </ThemedText>
        </View>

        <ThemePreferenceSelector />
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
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
});
