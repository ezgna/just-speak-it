import {
  useCssElement,
  useNativeVariable as useFunctionalVariable,
} from 'react-native-css';

import { Link as RouterLink } from 'expo-router';
import React from 'react';
import {
  type ColorValue,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableHighlight as RNTouchableHighlight,
  View as RNView,
} from 'react-native';
import Animated from 'react-native-reanimated';

const cssElement = useCssElement as unknown as (
  component: React.ElementType,
  props: Record<string, unknown>,
  mapping: Record<string, string>
) => React.ReactElement | null;

export const Link = (
  props: React.ComponentProps<typeof RouterLink> & { className?: string }
) => {
  return cssElement(RouterLink, props as unknown as Record<string, unknown>, {
    className: 'style',
  });
};

Link.Trigger = RouterLink.Trigger;
Link.Menu = RouterLink.Menu;
Link.MenuAction = RouterLink.MenuAction;
Link.Preview = RouterLink.Preview;

export const useCSSVariable =
  process.env.EXPO_OS !== 'web'
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;

export type ViewProps = React.ComponentProps<typeof RNView> & {
  className?: string;
};

export const View = (props: ViewProps) => {
  return cssElement(RNView, props as unknown as Record<string, unknown>, {
    className: 'style',
  });
};
View.displayName = 'CSS(View)';

export const Text = (
  props: React.ComponentProps<typeof RNText> & { className?: string }
) => {
  return cssElement(RNText, props as unknown as Record<string, unknown>, {
    className: 'style',
  });
};
Text.displayName = 'CSS(Text)';

export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) => {
  return cssElement(RNScrollView, props as unknown as Record<string, unknown>, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  });
};
ScrollView.displayName = 'CSS(ScrollView)';

export const Pressable = (
  props: React.ComponentProps<typeof RNPressable> & { className?: string }
) => {
  return cssElement(RNPressable, props as unknown as Record<string, unknown>, {
    className: 'style',
  });
};
Pressable.displayName = 'CSS(Pressable)';

export const TextInput = (
  props: React.ComponentProps<typeof RNTextInput> & { className?: string }
) => {
  return cssElement(RNTextInput, props as unknown as Record<string, unknown>, {
    className: 'style',
  });
};
TextInput.displayName = 'CSS(TextInput)';

export const AnimatedScrollView = (
  props: React.ComponentProps<typeof Animated.ScrollView> & {
    className?: string;
    contentClassName?: string;
    contentContainerClassName?: string;
  }
) => {
  return cssElement(
    Animated.ScrollView,
    props as unknown as Record<string, unknown>,
    {
      className: 'style',
      contentClassName: 'contentContainerStyle',
      contentContainerClassName: 'contentContainerStyle',
    }
  );
};
AnimatedScrollView.displayName = 'CSS(AnimatedScrollView)';

function CSSTouchableHighlight(
  props: React.ComponentProps<typeof RNTouchableHighlight>
) {
  const { underlayColor, ...style } =
    (StyleSheet.flatten(props.style) as
      | (Record<string, unknown> & { underlayColor?: ColorValue })
      | undefined) || {};

  return (
    <RNTouchableHighlight
      underlayColor={underlayColor}
      {...props}
      style={style}
    />
  );
}

export const TouchableHighlight = (
  props: React.ComponentProps<typeof RNTouchableHighlight> & {
    className?: string;
  }
) => {
  return cssElement(
    CSSTouchableHighlight,
    props as unknown as Record<string, unknown>,
    { className: 'style' }
  );
};
TouchableHighlight.displayName = 'CSS(TouchableHighlight)';
