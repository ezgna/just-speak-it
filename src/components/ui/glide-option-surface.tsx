import { type ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { FoundationSurface } from '@/components/ui/foundation-surface';
import {
  GlideFoundationColor,
  GlideFoundationDistance,
  type GlideSize,
  GlideSizeMetrics,
} from '@/components/ui/glide-frame';
import { Spacing } from '@/constants/theme';

type GlideOptionSurfaceProps = {
  children: ReactNode;
  selected: boolean;
  onPress: () => void;
  size?: GlideSize;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityState?: PressableProps['accessibilityState'];
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

const SelectedFoundationDepth = GlideSizeMetrics.large.foundationDepth;
const RestingFoundationDepth = GlideSizeMetrics.medium.foundationDepth;

export function GlideOptionSurface({
  accessibilityRole,
  accessibilityState,
  children,
  containerStyle,
  onPress,
  selected,
  size = 'large',
  style,
}: GlideOptionSurfaceProps) {
  const sizeMetrics = GlideSizeMetrics[size];

  return (
    <FoundationSurface
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      containerStyle={containerStyle}
      foundationColor={GlideFoundationColor}
      foundationDepth={selected ? SelectedFoundationDepth : RestingFoundationDepth}
      foundationDirection="diagonal"
      foundationDistanceScale={GlideFoundationDistance}
      haptic="selection"
      style={[
        styles.surface,
        {
          borderRadius: sizeMetrics.borderRadius,
          borderWidth: sizeMetrics.borderWidth,
          minHeight: sizeMetrics.minHeight,
          paddingHorizontal: sizeMetrics.paddingHorizontal,
          paddingVertical: sizeMetrics.paddingVertical,
        },
        style,
      ]}
      onPress={onPress}>
      {children}
    </FoundationSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderCurve: 'continuous',
    borderColor: GlideFoundationColor,
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
