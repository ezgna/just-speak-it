import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  FoundationSurface,
  type FoundationSurfaceDirection,
} from '@/components/ui/foundation-surface';

export type GlideButtonTone = 'mint' | 'blue' | 'cream' | 'amber' | 'coral' | 'green';
export type GlideButtonSize = 'large' | 'medium' | 'compact';

const AdoptedFoundationDistance = 0.56;
const FoundationBorderColor = '#111111';

const GlideTones: Record<
  GlideButtonTone,
  {
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  }
> = {
  mint: {
    backgroundColor: '#2FDD6C',
    textColor: '#111111',
    accentColor: '#111111',
  },
  blue: {
    backgroundColor: '#276EF1',
    textColor: '#FFFFFF',
    accentColor: '#FFFFFF',
  },
  cream: {
    backgroundColor: '#FFF6E7',
    textColor: '#111111',
    accentColor: '#111111',
  },
  amber: {
    backgroundColor: '#FFE2A6',
    textColor: '#111111',
    accentColor: '#111111',
  },
  coral: {
    backgroundColor: '#FF7661',
    textColor: '#111111',
    accentColor: '#111111',
  },
  green: {
    backgroundColor: '#37C878',
    textColor: '#111111',
    accentColor: '#111111',
  },
};

const GlideSizeMetrics: Record<
  GlideButtonSize,
  {
    borderRadius: number;
    borderWidth: number;
    foundationDepth: number;
    iconSize: number;
    labelLineHeight: number;
    labelSize: number;
    minHeight: number;
    paddingHorizontal: number;
    paddingVertical: number;
  }
> = {
  large: {
    borderRadius: 12,
    borderWidth: 4,
    foundationDepth: 8,
    iconSize: 20,
    labelLineHeight: 26,
    labelSize: 22,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  medium: {
    borderRadius: 12,
    borderWidth: 3,
    foundationDepth: 6,
    iconSize: 17,
    labelLineHeight: 22,
    labelSize: 17,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compact: {
    borderRadius: 999,
    borderWidth: 3,
    foundationDepth: 6,
    iconSize: 15,
    labelLineHeight: 19,
    labelSize: 15,
    minHeight: 0,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(0, 0, 0, ${alpha})`;

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const noopPress = () => {};

export function GlideButton({
  label,
  tone = 'blue',
  caption,
  icon,
  iconSide = 'right',
  size = 'large',
  fullWidth = true,
  direction = 'diagonal',
  containerStyle,
  disabled = false,
  accessibilityLabel,
  onPress = noopPress,
}: {
  label: string;
  tone?: GlideButtonTone;
  caption?: string;
  icon?: SymbolViewProps['name'];
  iconSide?: 'left' | 'right';
  size?: GlideButtonSize;
  fullWidth?: boolean;
  direction?: FoundationSurfaceDirection;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const toneStyle = GlideTones[tone];
  const sizeMetrics = GlideSizeMetrics[size];
  const compact = size === 'compact';
  const hasCaption = Boolean(caption);
  const paddingVertical = hasCaption && size === 'large' ? 11 : sizeMetrics.paddingVertical;

  return (
    <FoundationSurface
      onPress={onPress}
      haptic="selection"
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      androidRippleColor={hexToRgba(toneStyle.accentColor, tone === 'blue' ? 0.16 : 0.12)}
      foundationDepth={sizeMetrics.foundationDepth}
      foundationDistanceScale={AdoptedFoundationDistance}
      foundationDirection={direction}
      foundationColor={FoundationBorderColor}
      containerStyle={[
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.48 : 1,
        },
        containerStyle,
      ]}
      style={{
        width: fullWidth ? '100%' : undefined,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        borderRadius: sizeMetrics.borderRadius,
        borderWidth: sizeMetrics.borderWidth,
        borderColor: FoundationBorderColor,
        backgroundColor: toneStyle.backgroundColor,
        paddingHorizontal: sizeMetrics.paddingHorizontal,
        paddingVertical,
        minHeight: sizeMetrics.minHeight,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'space-between',
          gap: 10,
        }}>
        {icon && iconSide === 'left' ? (
          <SymbolView
            name={icon}
            size={sizeMetrics.iconSize}
            tintColor={toneStyle.textColor}
            fallback={<ThemedText style={{ color: toneStyle.textColor }}>{'>'}</ThemedText>}
          />
        ) : null}

        <View
          style={{
            flex: compact ? 0 : 1,
            minWidth: 0,
            gap: hasCaption ? 1 : 0,
            alignItems: compact ? 'center' : 'flex-start',
          }}>
          {caption ? (
            <ThemedText
              numberOfLines={1}
              style={{
                color: hexToRgba(toneStyle.textColor, 0.82),
                fontSize: 10,
                lineHeight: 14,
                fontWeight: 900,
              }}>
              {caption}
            </ThemedText>
          ) : null}
          <ThemedText
            numberOfLines={1}
            style={{
              color: toneStyle.textColor,
              fontSize: sizeMetrics.labelSize,
              lineHeight: sizeMetrics.labelLineHeight,
              fontWeight: 900,
              textAlign: compact ? 'center' : 'left',
            }}>
            {label}
          </ThemedText>
        </View>

        {icon && iconSide === 'right' ? (
          <SymbolView
            name={icon}
            size={sizeMetrics.iconSize}
            tintColor={toneStyle.textColor}
            fallback={<ThemedText style={{ color: toneStyle.textColor }}>{'>'}</ThemedText>}
          />
        ) : null}
      </View>
    </FoundationSurface>
  );
}
