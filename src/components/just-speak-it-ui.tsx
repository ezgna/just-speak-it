import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function useDailyPalette() {
  const theme = useTheme();
  const isDark = theme.background === '#000000';

  return {
    ...theme,
    card: isDark ? '#15171C' : '#FFFFFF',
    cardAlt: isDark ? '#20242B' : '#F6F2EA',
    border: isDark ? '#303640' : '#E5E0D7',
    muted: isDark ? '#AEB7C2' : '#5F6670',
    primary: '#276EF1',
    primaryPressed: '#1556D6',
    primaryText: '#FFFFFF',
    coral: '#E8664F',
    coralSoft: isDark ? '#3A211D' : '#FFF0EC',
    teal: '#088A81',
    tealSoft: isDark ? '#14332F' : '#E8F7F4',
    amber: '#B7791F',
    amberSoft: isDark ? '#332A17' : '#FFF4D8',
    green: '#278B54',
    greenSoft: isDark ? '#173224' : '#E9F7EE',
    shadow: isDark ? '0 12px 28px rgba(0, 0, 0, 0.35)' : '0 12px 28px rgba(31, 28, 20, 0.08)',
  };
}

type SurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'soft' | 'accent';
};

export function Surface({ children, style, tone = 'default' }: SurfaceProps) {
  const palette = useDailyPalette();
  const backgroundColor =
    tone === 'soft' ? palette.cardAlt : tone === 'accent' ? palette.tealSoft : palette.card;

  return (
    <ThemedView
      style={[
        styles.surface,
        {
          backgroundColor,
          borderColor: palette.border,
          boxShadow: palette.shadow,
        },
        style,
      ]}>
      {children}
    </ThemedView>
  );
}

type PillProps = {
  children: React.ReactNode;
  tone?: 'blue' | 'coral' | 'teal' | 'amber' | 'neutral' | 'green';
  style?: StyleProp<ViewStyle>;
};

export function Pill({ children, tone = 'neutral', style }: PillProps) {
  const palette = useDailyPalette();
  const colors = {
    blue: { backgroundColor: '#EAF1FF', color: palette.primary },
    coral: { backgroundColor: palette.coralSoft, color: palette.coral },
    teal: { backgroundColor: palette.tealSoft, color: palette.teal },
    amber: { backgroundColor: palette.amberSoft, color: palette.amber },
    green: { backgroundColor: palette.greenSoft, color: palette.green },
    neutral: { backgroundColor: palette.backgroundElement, color: palette.textSecondary },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: colors.backgroundColor }, style]}>
      <ThemedText type="code" style={{ color: colors.color }}>
        {children}
      </ThemedText>
    </View>
  );
}

type ActionButtonProps = PressableProps & {
  label: string;
  icon?: SymbolViewProps['name'];
  variant?: 'primary' | 'secondary' | 'quiet';
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  label,
  icon,
  variant = 'primary',
  style,
  disabled,
  ...props
}: ActionButtonProps) {
  const palette = useDailyPalette();
  const isPrimary = variant === 'primary';
  const isQuiet = variant === 'quiet';

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: isPrimary
            ? pressed
              ? palette.primaryPressed
              : palette.primary
            : isQuiet
              ? 'transparent'
              : palette.backgroundElement,
          borderColor: isQuiet ? 'transparent' : isPrimary ? palette.primary : palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}>
      {icon && (
        <SymbolView
          name={icon}
          size={16}
          tintColor={isPrimary ? palette.primaryText : palette.text}
          fallback={<ThemedText>{'>'}</ThemedText>}
        />
      )}
      <ThemedText
        type="smallBold"
        style={{ color: isPrimary ? palette.primaryText : palette.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow && <Pill tone="teal">{eyebrow}</Pill>}
      <ThemedText type="subtitle" selectable>
        {title}
      </ThemedText>
      {description && (
        <ThemedText themeColor="textSecondary" selectable>
          {description}
        </ThemedText>
      )}
    </View>
  );
}

type MetricTileProps = {
  label: string;
  value: string;
  tone?: PillProps['tone'];
};

export function MetricTile({ label, value, tone = 'blue' }: MetricTileProps) {
  const palette = useDailyPalette();

  return (
    <Surface style={styles.metricTile}>
      <Pill tone={tone}>{label}</Pill>
      <ThemedText type="subtitle" style={[styles.metricValue, { color: palette.text }]} selectable>
        {value}
      </ThemedText>
    </Surface>
  );
}

type FlowStepsProps = {
  steps: string[];
  activeIndex?: number;
};

export function FlowSteps({ steps, activeIndex = steps.length - 1 }: FlowStepsProps) {
  const palette = useDailyPalette();

  return (
    <View style={styles.flowRow}>
      {steps.map((step, index) => {
        const isActive = index <= activeIndex;
        return (
          <View
            key={step}
            style={[
              styles.flowStep,
              {
                backgroundColor: isActive ? palette.tealSoft : palette.backgroundElement,
                borderColor: isActive ? palette.teal : palette.border,
              },
            ]}>
            <ThemedText
              type="code"
              style={{ color: isActive ? palette.teal : palette.textSecondary }}>
              {step}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  actionButton: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  sectionHeader: {
    gap: Spacing.two,
  },
  metricTile: {
    flex: 1,
    minWidth: 150,
    padding: Spacing.three,
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flowStep: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
