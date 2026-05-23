import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  type ThemePreference,
  useThemePreference,
} from '@/hooks/use-theme-preference';

type ThemePreferenceOption = {
  icon: SymbolViewProps['name'];
  label: string;
  value: ThemePreference;
};

const ThemePreferenceOptions: ThemePreferenceOption[] = [
  {
    value: 'system',
    label: '自動',
    icon: { ios: 'circle.lefthalf.filled', android: 'brightness_auto', web: 'brightness_auto' },
  },
  {
    value: 'light',
    label: 'ライト',
    icon: { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' },
  },
  {
    value: 'dark',
    label: 'ダーク',
    icon: { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' },
  },
];

export function ThemePreferenceSelector() {
  const palette = useDailyPalette();
  const { resolvedColorScheme, setThemePreference, systemColorScheme, themePreference } =
    useThemePreference();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          boxShadow: palette.shadow,
        },
      ]}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold">表示モード</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {themePreference === 'system'
            ? `自動: ${systemColorScheme === 'dark' ? 'ダーク' : 'ライト'}`
            : resolvedColorScheme === 'dark'
              ? 'ダーク'
              : 'ライト'}
        </ThemedText>
      </View>

      <View style={styles.optionRow}>
        {ThemePreferenceOptions.map((option) => {
          const isSelected = option.value === themePreference;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => setThemePreference(option.value)}
              style={({ pressed }) => [
                styles.optionButton,
                {
                  backgroundColor: isSelected ? palette.backgroundSelected : palette.cardAlt,
                  borderColor: isSelected ? palette.text : palette.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}>
              <SymbolView
                name={option.icon}
                size={18}
                tintColor={isSelected ? palette.text : palette.textSecondary}
                fallback={<ThemedText>{'>'}</ThemedText>}
              />
              <ThemedText
                type="smallBold"
                style={{ color: isSelected ? palette.text : palette.textSecondary }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: 'continuous',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 98,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
