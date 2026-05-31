import { type ReactNode } from 'react';
import { type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import {
  FoundationSurface,
  type FoundationSurfaceDirection,
} from '@/components/ui/foundation-surface';

export type GlideTone =
  | 'mint'
  | 'blue'
  | 'cream'
  | 'amber'
  | 'coral'
  | 'green'
  | 'sky'
  | 'violet'
  | 'pink'
  | 'lemon'
  | 'orange'
  | 'aqua'
  | 'grape';
export type GlideSize = 'large' | 'medium' | 'compact';

export const GlideFoundationDistance = 0.56;
export const GlideFoundationColor = '#111111';

export const GlideTones: Record<
  GlideTone,
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
  sky: {
    backgroundColor: '#9FD0F8',
    textColor: '#111111',
    accentColor: '#111111',
  },
  violet: {
    backgroundColor: '#9B7CFF',
    textColor: '#111111',
    accentColor: '#111111',
  },
  pink: {
    backgroundColor: '#FF8DA1',
    textColor: '#111111',
    accentColor: '#111111',
  },
  lemon: {
    backgroundColor: '#F4E75E',
    textColor: '#111111',
    accentColor: '#111111',
  },
  orange: {
    backgroundColor: '#FF9F45',
    textColor: '#111111',
    accentColor: '#111111',
  },
  aqua: {
    backgroundColor: '#65D7F2',
    textColor: '#111111',
    accentColor: '#111111',
  },
  grape: {
    backgroundColor: '#6E56CF',
    textColor: '#FFFFFF',
    accentColor: '#FFFFFF',
  },
};

export const GlideSizeMetrics: Record<
  GlideSize,
  {
    borderRadius: number;
    borderWidth: number;
    foundationDepth: number;
    minHeight: number;
    paddingHorizontal: number;
    paddingVertical: number;
  }
> = {
  large: {
    borderRadius: 12,
    borderWidth: 4,
    foundationDepth: 8,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  medium: {
    borderRadius: 12,
    borderWidth: 3,
    foundationDepth: 6,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compact: {
    borderRadius: 999,
    borderWidth: 3,
    foundationDepth: 6,
    minHeight: 0,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
};

export const getGlideRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(0, 0, 0, ${alpha})`;

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

type GlideFrameProps = {
  children: ReactNode;
  tone?: GlideTone;
  size?: GlideSize;
  fullWidth?: boolean;
  direction?: FoundationSurfaceDirection;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  pressed?: boolean;
  holdPressOut?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityState?: PressableProps['accessibilityState'];
  onPress?: () => void;
};

export function GlideFrame({
  children,
  tone = 'blue',
  size = 'large',
  fullWidth = true,
  direction = 'diagonal',
  containerStyle,
  style,
  disabled = false,
  pressed = false,
  holdPressOut = false,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  onPress,
}: GlideFrameProps) {
  const toneStyle = GlideTones[tone];
  const sizeMetrics = GlideSizeMetrics[size];

  return (
    <FoundationSurface
      onPress={onPress}
      haptic="selection"
      disabled={disabled}
      pressed={pressed}
      holdPressOut={holdPressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      androidRippleColor={getGlideRgba(toneStyle.accentColor, tone === 'blue' ? 0.16 : 0.12)}
      foundationDepth={sizeMetrics.foundationDepth}
      foundationDistanceScale={GlideFoundationDistance}
      foundationDirection={direction}
      foundationColor={GlideFoundationColor}
      containerStyle={[
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.48 : 1,
        },
        containerStyle,
      ]}
      style={[
        {
          width: fullWidth ? '100%' : undefined,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderRadius: sizeMetrics.borderRadius,
          borderWidth: sizeMetrics.borderWidth,
          borderColor: GlideFoundationColor,
          backgroundColor: toneStyle.backgroundColor,
          paddingHorizontal: sizeMetrics.paddingHorizontal,
          paddingVertical: sizeMetrics.paddingVertical,
          minHeight: sizeMetrics.minHeight,
        },
        style,
      ]}>
      {children}
    </FoundationSurface>
  );
}
