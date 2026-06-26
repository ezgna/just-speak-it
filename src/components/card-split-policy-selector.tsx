import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GlideOptionSurface } from '@/components/ui/glide-option-surface';
import { Spacing } from '@/constants/theme';
import { useCardSplitPolicy } from '@/hooks/use-card-split-policy';
import { type CardSplitPolicy } from '@/lib/card-split-policy';

type CardSplitPolicyOption = {
  activeBackgroundColor: string;
  activeTextColor: string;
  caption: string;
  icon: SymbolViewProps['name'];
  label: string;
  value: CardSplitPolicy;
};

const SelectorColors = {
  ink: '#111111',
  paper: '#FFF6E7',
  cream: '#FFFFFF',
  blue: '#276EF1',
  orange: '#FF9F45',
  coral: '#FF7661',
  white: '#FFFFFF',
} as const;

const CardSplitPolicyOptions: CardSplitPolicyOption[] = [
  {
    value: 'meaning_unit',
    label: '自然なまとまり',
    caption: '流れを保って分ける',
    icon: { ios: 'text.bubble.fill', android: 'chat_bubble', web: 'chat_bubble' },
    activeBackgroundColor: SelectorColors.blue,
    activeTextColor: SelectorColors.white,
  },
  {
    value: 'small_steps',
    label: '細かく分ける',
    caption: '短いカードにする',
    icon: { ios: 'rectangle.split.2x1.fill', android: 'splitscreen', web: 'splitscreen' },
    activeBackgroundColor: SelectorColors.orange,
    activeTextColor: SelectorColors.ink,
  },
];

export function CardSplitPolicySelector() {
  const { cardSplitPolicy, setCardSplitPolicy } = useCardSplitPolicy();
  const selectedOption =
    CardSplitPolicyOptions.find((option) => option.value === cardSplitPolicy) ??
    CardSplitPolicyOptions[0];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionKicker}>
          <ThemedText style={styles.sectionKickerText}>Build</ThemedText>
        </View>
        <View style={styles.titleRow}>
            <ThemedText style={styles.sectionTitle} selectable>
            カードの分け方
          </ThemedText>
          <View style={styles.currentBadge}>
            <ThemedText style={styles.currentBadgeText}>{selectedOption.label}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.optionRow} accessibilityRole="radiogroup">
        {CardSplitPolicyOptions.map((option) => {
          const isSelected = option.value === cardSplitPolicy;
          const textColor = isSelected ? option.activeTextColor : SelectorColors.ink;
          const captionColor =
            isSelected && option.value === 'meaning_unit'
              ? 'rgba(255, 255, 255, 0.82)'
              : 'rgba(17, 17, 17, 0.66)';

          return (
            <GlideOptionSurface
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => setCardSplitPolicy(option.value)}
              selected={isSelected}
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
                  size={19}
                  tintColor={SelectorColors.ink}
                  fallback={<ThemedText style={styles.iconFallback}>{'>'}</ThemedText>}
                />
              </View>
              <View style={styles.optionCopy}>
                <ThemedText numberOfLines={1} style={[styles.optionLabel, { color: textColor }]}>
                  {option.label}
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  style={[styles.optionCaption, { color: captionColor }]}>
                  {option.caption}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.selectionDot,
                  {
                    backgroundColor: isSelected ? textColor : 'transparent',
                    borderColor: textColor,
                  },
                ]}
              />
            </GlideOptionSurface>
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
    backgroundColor: SelectorColors.coral,
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
    minWidth: 184,
  },
  optionButton: {
    alignItems: 'center',
  },
  iconBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
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
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  optionLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 900,
  },
  optionCaption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  selectionDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 3,
  },
});
