import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FoundationSurface } from '@/components/ui/foundation-surface';
import { Spacing } from '@/constants/theme';
import {
  type ThemePreference,
  useThemePreference,
} from '@/hooks/use-theme-preference';

type ThemePreferenceOption = {
  activeBackgroundColor: string;
  activeTextColor: string;
  icon: SymbolViewProps['name'];
  label: string;
  value: ThemePreference;
};

const SelectorColors = {
  ink: '#111111',
  paper: '#FFF6E7',
  cream: '#FFFFFF',
  mint: '#2FDD6C',
  lemon: '#F4E75E',
  aqua: '#65D7F2',
  dark: '#111111',
  white: '#FFFFFF',
} as const;

const ThemePreferenceOptions: ThemePreferenceOption[] = [
  {
    value: 'system',
    label: '自動',
    icon: { ios: 'circle.lefthalf.filled', android: 'brightness_auto', web: 'brightness_auto' },
    activeBackgroundColor: SelectorColors.aqua,
    activeTextColor: SelectorColors.ink,
  },
  {
    value: 'light',
    label: 'ライト',
    icon: { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' },
    activeBackgroundColor: SelectorColors.lemon,
    activeTextColor: SelectorColors.ink,
  },
  {
    value: 'dark',
    label: 'ダーク',
    icon: { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' },
    activeBackgroundColor: SelectorColors.dark,
    activeTextColor: SelectorColors.white,
  },
];

export function ThemePreferenceSelector() {
  const { resolvedColorScheme, setThemePreference, systemColorScheme, themePreference } =
    useThemePreference();
  const currentLabel =
    themePreference === 'system'
      ? `自動: ${systemColorScheme === 'dark' ? 'ダーク' : 'ライト'}`
      : resolvedColorScheme === 'dark'
        ? 'ダーク'
        : 'ライト';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionKicker}>
          <ThemedText style={styles.sectionKickerText}>Look</ThemedText>
        </View>
        <View style={styles.titleRow}>
          <ThemedText style={styles.sectionTitle} selectable>
            表示モード
          </ThemedText>
          <View style={styles.currentBadge}>
            <ThemedText style={styles.currentBadgeText}>{currentLabel}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.optionRow} accessibilityRole="radiogroup">
        {ThemePreferenceOptions.map((option) => {
          const isSelected = option.value === themePreference;
          const textColor = isSelected ? option.activeTextColor : SelectorColors.ink;

          return (
            <FoundationSurface
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => setThemePreference(option.value)}
              haptic="selection"
              foundationDepth={isSelected ? 8 : 6}
              foundationDistanceScale={0.56}
              foundationDirection="diagonal"
              foundationColor={SelectorColors.ink}
              containerStyle={styles.optionSurface}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected
                    ? option.activeBackgroundColor
                    : SelectorColors.paper,
                },
              ]}>
              <View style={styles.iconBadge}>
                <SymbolView
                  name={option.icon}
                  size={18}
                  tintColor={SelectorColors.ink}
                  fallback={<ThemedText style={styles.iconFallback}>{'>'}</ThemedText>}
                />
              </View>
              <ThemedText numberOfLines={1} style={[styles.optionLabel, { color: textColor }]}>
                {option.label}
              </ThemedText>
              <View
                style={[
                  styles.selectionDot,
                  {
                    backgroundColor: isSelected ? textColor : 'transparent',
                    borderColor: textColor,
                  },
                ]}
              />
            </FoundationSurface>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    gap: Spacing.two,
  },
  sectionKicker: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: SelectorColors.ink,
    backgroundColor: SelectorColors.mint,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sectionKickerText: {
    color: SelectorColors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: {
    color: SelectorColors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 900,
  },
  currentBadge: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: SelectorColors.ink,
    backgroundColor: SelectorColors.cream,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  currentBadgeText: {
    color: SelectorColors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  optionSurface: {
    flex: 1,
    minWidth: 128,
  },
  optionButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: SelectorColors.ink,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: SelectorColors.ink,
    backgroundColor: SelectorColors.cream,
  },
  iconFallback: {
    color: SelectorColors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 900,
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 900,
  },
  selectionDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 3,
  },
});
