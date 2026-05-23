import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  GlideFrame,
  GlideTones,
  getGlideRgba,
  type GlideSize,
  type GlideTone,
} from '@/components/ui/glide-frame';
import { type FoundationSurfaceDirection } from '@/components/ui/foundation-surface';

export type GlideButtonTone = GlideTone;
export type GlideButtonSize = GlideSize;

const GlideSizeMetrics: Record<
  GlideButtonSize,
  {
    iconSize: number;
    labelLineHeight: number;
    labelSize: number;
  }
> = {
  extraLarge: {
    iconSize: 20,
    labelLineHeight: 29,
    labelSize: 18,
  },
  large: {
    iconSize: 20,
    labelLineHeight: 26,
    labelSize: 22,
  },
  medium: {
    iconSize: 17,
    labelLineHeight: 22,
    labelSize: 17,
  },
  compact: {
    iconSize: 15,
    labelLineHeight: 19,
    labelSize: 15,
  },
};

const noopPress = () => {};

export function GlideButton({
  label,
  tone = 'blue',
  caption,
  badge,
  icon,
  iconSide = 'right',
  size = 'large',
  fullWidth = true,
  direction = 'diagonal',
  containerStyle,
  disabled = false,
  pressed = false,
  holdPressOut = false,
  accessibilityLabel,
  onPress = noopPress,
}: {
  label: string;
  tone?: GlideButtonTone;
  caption?: string;
  badge?: string;
  icon?: SymbolViewProps['name'];
  iconSide?: 'left' | 'right';
  size?: GlideButtonSize;
  fullWidth?: boolean;
  direction?: FoundationSurfaceDirection;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  pressed?: boolean;
  holdPressOut?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const toneStyle = GlideTones[tone];
  const sizeMetrics = GlideSizeMetrics[size];
  const compact = size === 'compact';
  const extraLarge = size === 'extraLarge';
  const hasCaption = Boolean(caption);

  return (
    <GlideFrame
      onPress={onPress}
      tone={tone}
      size={size}
      fullWidth={fullWidth}
      direction={direction}
      containerStyle={containerStyle}
      disabled={disabled}
      pressed={pressed}
      holdPressOut={holdPressOut}
      accessibilityLabel={accessibilityLabel ?? (badge ? `${label} ${badge}` : label)}
      accessibilityRole="button"
      style={hasCaption && size === 'large' ? { paddingVertical: 11 } : undefined}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: extraLarge ? 'flex-end' : 'center',
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
                color: getGlideRgba(toneStyle.textColor, 0.82),
                fontSize: 10,
                lineHeight: 14,
                fontWeight: 900,
              }}>
              {caption}
            </ThemedText>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}>
            <ThemedText
              numberOfLines={extraLarge ? undefined : 1}
              style={{
                flexShrink: 1,
                color: toneStyle.textColor,
                fontSize: sizeMetrics.labelSize,
                lineHeight: sizeMetrics.labelLineHeight,
                fontWeight: 900,
                textAlign: compact ? 'center' : 'left',
              }}>
              {label}
            </ThemedText>
            {badge ? (
              <View
                style={{
                  borderWidth: 2,
                  borderColor: toneStyle.textColor,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 1,
                  backgroundColor: getGlideRgba(toneStyle.textColor, 0.08),
                }}>
                <ThemedText
                  numberOfLines={1}
                  style={{
                    color: toneStyle.textColor,
                    fontSize: 12,
                    lineHeight: 16,
                    fontWeight: 900,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {badge}
                </ThemedText>
              </View>
            ) : null}
          </View>
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
    </GlideFrame>
  );
}
