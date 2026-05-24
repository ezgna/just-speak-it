import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useGenerationMode } from '@/hooks/use-generation-mode';
import { type GenerationMode } from '@/lib/generation-mode';

type GenerationModeOption = {
  caption: string;
  icon: SymbolViewProps['name'];
  label: string;
  value: GenerationMode;
};

const GenerationModeOptions: GenerationModeOption[] = [
  {
    value: 'natural',
    label: '自然さ優先',
    caption: '自然な一文',
    icon: { ios: 'text.bubble.fill', android: 'chat_bubble', web: 'chat_bubble' },
  },
  {
    value: 'compact',
    label: '短さ優先',
    caption: '接続詞で分割',
    icon: { ios: 'rectangle.split.2x1.fill', android: 'splitscreen', web: 'splitscreen' },
  },
];

export function GenerationModeSelector() {
  const palette = useDailyPalette();
  const { generationMode, setGenerationMode } = useGenerationMode();
  const selectedOption =
    GenerationModeOptions.find((option) => option.value === generationMode) ??
    GenerationModeOptions[0];

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
        <ThemedText type="smallBold">カード生成</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {selectedOption.label}
        </ThemedText>
      </View>

      <View style={styles.optionRow}>
        {GenerationModeOptions.map((option) => {
          const isSelected = option.value === generationMode;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => setGenerationMode(option.value)}
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
              <View style={styles.optionCopy}>
                <ThemedText
                  type="smallBold"
                  style={{ color: isSelected ? palette.text : palette.textSecondary }}>
                  {option.label}
                </ThemedText>
                <ThemedText
                  type="code"
                  style={{ color: isSelected ? palette.textSecondary : palette.muted }}>
                  {option.caption}
                </ThemedText>
              </View>
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
    minHeight: 58,
    minWidth: 138,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  optionCopy: {
    flex: 1,
    gap: Spacing.half,
  },
});
