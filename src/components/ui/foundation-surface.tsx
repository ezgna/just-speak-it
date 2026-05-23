import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type Insets,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

type SurfaceHaptic = 'none' | 'selection';
export type FoundationSurfaceDirection = 'down' | 'diagonal';
type FoundationSurfaceRadiusMode = 'same' | 'concentric';
type FoundationEasing = (value: number) => number;

export const FOUNDATION_SCROLL_PRESS_DELAY_MS = 200;

const FoundationSurfacePressDelayContext = createContext<number | undefined>(undefined);

export function FoundationSurfacePressDelayProvider({
  children,
  pressDelay,
}: {
  children: ReactNode;
  pressDelay?: number;
}) {
  return (
    <FoundationSurfacePressDelayContext.Provider value={pressDelay}>
      {children}
    </FoundationSurfacePressDelayContext.Provider>
  );
}

const createBezierEasing = (x1: number, y1: number, x2: number, y2: number): FoundationEasing => {
  return Easing.bezier(x1, y1, x2, y2);
};

export type FoundationSurfaceProps = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  pressed?: boolean;
  holdPressOut?: boolean;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityLabel?: string;
  accessibilityState?: PressableProps['accessibilityState'];
  androidRippleColor?: string;
  hitSlop?: Insets | number;
  haptic?: SurfaceHaptic;
  testID?: string;
  foundationDepth?: number;
  foundationDistanceScale?: number;
  foundationDirection?: FoundationSurfaceDirection;
  foundationColor?: string;
  foundationBorderColor?: string;
  foundationBorderWidth?: number;
  foundationOffsetX?: number;
  foundationOffsetY?: number;
  foundationRadiusMode?: FoundationSurfaceRadiusMode;
  pressedOffsetX?: number;
  pressedOffsetY?: number;
  pressTravelRatio?: number;
  pressDiagonalRatio?: number;
  pressInDuration?: number;
  pressOutDuration?: number;
  pressInEasing?: FoundationEasing;
  pressOutEasing?: FoundationEasing;
  pressDelay?: number;
};

const DefaultFoundationDepth = 8;
const DefaultFoundationDistanceScale = 0.56;
const DefaultTravelRatio = 0.5;
const DefaultDiagonalRatio = 0.28;
const DefaultPressInDuration = 176;
const DefaultPressOutDuration = 244;
const DefaultPressInEasing = createBezierEasing(0.28, 0.9, 0.22, 1);
const DefaultPressOutEasing = createBezierEasing(0.16, 1, 0.24, 1);

const getFoundationOffset = ({
  depth,
  direction,
}: {
  depth: number;
  direction: FoundationSurfaceDirection;
}) => {
  if (direction === 'diagonal') {
    const minimumX = depth >= 4 ? 3 : 1;

    return {
      x: Math.min(Math.max(Math.round(depth * 0.5), minimumX), depth),
      y: depth,
    };
  }

  return {
    x: 0,
    y: depth,
  };
};

export function FoundationSurface({
  children,
  onPress,
  onLongPress,
  style,
  containerStyle,
  disabled = false,
  pressed = false,
  holdPressOut = false,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  androidRippleColor,
  hitSlop,
  haptic = 'none',
  testID,
  foundationDepth = DefaultFoundationDepth,
  foundationDistanceScale = DefaultFoundationDistanceScale,
  foundationDirection = 'down',
  foundationColor = '#111111',
  foundationBorderColor,
  foundationBorderWidth = 0,
  foundationOffsetX,
  foundationOffsetY,
  foundationRadiusMode = 'same',
  pressedOffsetX,
  pressedOffsetY,
  pressTravelRatio = DefaultTravelRatio,
  pressDiagonalRatio = DefaultDiagonalRatio,
  pressInDuration = DefaultPressInDuration,
  pressOutDuration = DefaultPressOutDuration,
  pressInEasing = DefaultPressInEasing,
  pressOutEasing = DefaultPressOutEasing,
  pressDelay,
}: FoundationSurfaceProps) {
  const contextPressDelay = useContext(FoundationSurfacePressDelayContext);
  const reduceMotion = useReducedMotion();
  const [translateX] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(0));
  const [pressProgress] = useState(() => new Animated.Value(0));
  const flattenedStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);
  const borderRadius =
    typeof flattenedStyle.borderRadius === 'number' ? flattenedStyle.borderRadius : 24;
  const isInteractive =
    !disabled && (typeof onPress === 'function' || typeof onLongPress === 'function');
  const resolvedPressDelay = pressDelay ?? contextPressDelay;
  const foundationDepthPx = Math.max(Math.round(foundationDepth * foundationDistanceScale), 2);
  const measuredFoundationOffset = getFoundationOffset({
    depth: foundationDepthPx,
    direction: foundationDirection,
  });
  const foundationOffset = {
    x: foundationOffsetX ?? measuredFoundationOffset.x,
    y: foundationOffsetY ?? measuredFoundationOffset.y,
  };
  const pressDepth = Math.max(Math.round(foundationDepth * pressTravelRatio), 2);
  const maxPressX = Math.max(
    pressedOffsetX === undefined ? foundationOffset.x - 1 : foundationOffset.x,
    0
  );
  const maxPressY = Math.max(
    pressedOffsetY === undefined ? foundationOffset.y - 1 : foundationOffset.y,
    0
  );
  const pressX = Math.min(
    pressedOffsetX ??
      (foundationDirection === 'diagonal'
        ? Math.max(Math.round(pressDepth * pressDiagonalRatio), 2)
        : 0),
    maxPressX
  );
  const pressY = Math.min(pressedOffsetY ?? pressDepth, maxPressY);
  const foundationRestBorderRadius =
    foundationRadiusMode === 'concentric'
      ? borderRadius + Math.max(foundationOffset.x, foundationOffset.y)
      : borderRadius;
  const foundationPressedBorderRadius =
    foundationRadiusMode === 'concentric'
      ? borderRadius + Math.max(foundationOffset.x - pressX, foundationOffset.y - pressY, 0)
      : borderRadius;
  const foundationBorderRadius = useMemo(() => {
    if (foundationRestBorderRadius === foundationPressedBorderRadius) {
      return foundationRestBorderRadius;
    }

    return pressProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [foundationRestBorderRadius, foundationPressedBorderRadius],
      extrapolate: 'clamp',
    });
  }, [foundationPressedBorderRadius, foundationRestBorderRadius, pressProgress]);

  const animatedStyle = useMemo(
    () => ({
      transform: [{ translateX }, { translateY }],
    }),
    [translateX, translateY]
  );

  const animateTo = useCallback(
    (
      nextX: number,
      nextY: number,
      nextProgress: number,
      duration: number,
      easing: FoundationEasing
    ) => {
      const resolvedDuration = reduceMotion ? 0 : duration;

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: nextX,
          duration: resolvedDuration,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: nextY,
          duration: resolvedDuration,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(pressProgress, {
          toValue: nextProgress,
          duration: resolvedDuration,
          easing,
          useNativeDriver: false,
        }),
      ]).start();
    },
    [pressProgress, reduceMotion, translateX, translateY]
  );

  useEffect(() => {
    if (pressed) {
      animateTo(pressX, pressY, 1, pressInDuration, pressInEasing);
      return;
    }

    animateTo(0, 0, 0, pressOutDuration, pressOutEasing);
  }, [
    animateTo,
    disabled,
    pressInDuration,
    pressInEasing,
    pressed,
    pressOutDuration,
    pressOutEasing,
    pressX,
    pressY,
  ]);

  const triggerHaptic = useCallback(() => {
    if (!isInteractive || haptic !== 'selection' || process.env.EXPO_OS !== 'ios') {
      return;
    }

    void Haptics.selectionAsync().catch(() => undefined);
  }, [haptic, isInteractive]);

  return (
    <View
      style={[
        {
          position: 'relative',
          paddingRight: foundationOffset.x,
          paddingBottom: foundationOffset.y,
          borderRadius,
        },
        containerStyle,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: foundationOffset.x,
          top: foundationOffset.y,
          right: 0,
          bottom: 0,
          borderRadius: foundationBorderRadius,
          borderCurve: 'continuous',
          borderWidth: foundationBorderWidth,
          borderColor: foundationBorderColor,
          backgroundColor: foundationColor,
        }}
      />

      <Animated.View style={[{ borderRadius }, animatedStyle]}>
        {isInteractive ? (
          <Pressable
            testID={testID}
            accessibilityRole={accessibilityRole ?? 'button'}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
            hitSlop={hitSlop}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={() => {
              triggerHaptic();
              animateTo(pressX, pressY, 1, pressInDuration, pressInEasing);
            }}
            onPressOut={() => {
              if (pressed || holdPressOut) {
                animateTo(pressX, pressY, 1, pressInDuration, pressInEasing);
                return;
              }

              animateTo(0, 0, 0, pressOutDuration, pressOutEasing);
            }}
            unstable_pressDelay={resolvedPressDelay}
            android_ripple={androidRippleColor ? { color: androidRippleColor } : undefined}
            style={[
              {
                borderRadius,
                borderCurve: 'continuous',
              },
              style,
            ]}>
            {children}
          </Pressable>
        ) : (
          <View
            testID={testID}
            accessible={typeof accessibilityLabel === 'string' && accessibilityLabel.length > 0}
            accessibilityRole={accessibilityRole}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
            style={[
              {
                borderRadius,
                borderCurve: 'continuous',
              },
              style,
            ]}>
            {children}
          </View>
        )}
      </Animated.View>
    </View>
  );
}
