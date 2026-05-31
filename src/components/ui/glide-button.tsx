import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

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
  busy = false,
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
  busy?: boolean;
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
  const hasCaption = Boolean(caption);
  const sideAccessory = busy ? (
    <GlideButtonBusyIndicator color={toneStyle.textColor} size={size} />
  ) : icon ? (
    <SymbolView
      name={icon}
      size={sizeMetrics.iconSize}
      tintColor={toneStyle.textColor}
      fallback={<ThemedText style={{ color: toneStyle.textColor }}>{'>'}</ThemedText>}
    />
  ) : null;

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
      accessibilityState={{ disabled, busy }}
      style={hasCaption && size === 'large' ? { paddingVertical: 11 } : undefined}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'space-between',
          gap: 10,
        }}>
        {sideAccessory && iconSide === 'left' ? sideAccessory : null}

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
              numberOfLines={1}
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

        {sideAccessory && iconSide === 'right' ? sideAccessory : null}
      </View>
    </GlideFrame>
  );
}

function GlideButtonBusyIndicator({
  color,
  size,
}: {
  color: string;
  size: GlideButtonSize;
}) {
  const compact = size === 'compact';
  const dotSize = compact ? 5 : size === 'medium' ? 6 : 7;
  const dotGap = compact ? 3 : 4;
  const paddingHorizontal = compact ? 0 : 7;
  const travel = compact ? -2 : -3;

  return (
    <View
      accessible={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: dotGap,
        minWidth: compact ? 26 : 39,
        height: compact ? 14 : 24,
        borderWidth: compact ? 0 : 2,
        borderColor: color,
        borderRadius: 999,
        paddingHorizontal,
        backgroundColor: compact ? 'transparent' : getGlideRgba(color, 0.06),
      }}>
      {[0, 1, 2].map((index) => (
        <GlideButtonBusyDot
          key={index}
          color={color}
          delay={index * 130}
          dotSize={dotSize}
          travel={travel}
        />
      ))}
    </View>
  );
}

function GlideButtonBusyDot({
  color,
  delay,
  dotSize,
  travel,
}: {
  color: string;
  delay: number;
  dotSize: number;
  travel: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 260,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, {
            duration: 260,
            easing: Easing.in(Easing.quad),
          }),
          withDelay(420, withTiming(0, { duration: 1 }))
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.38 + progress.value * 0.62,
    transform: [
      { translateY: progress.value * travel },
      { scale: 0.84 + progress.value * 0.16 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}
