import { useCssElement } from 'react-native-css';

import { Image as RNImage } from 'expo-image';
import React from 'react';
import { type ImageStyle, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(RNImage);
const cssElement = useCssElement as unknown as (
  component: React.ElementType,
  props: Record<string, unknown>,
  mapping: Record<string, string>
) => React.ReactElement | null;

function CSSImage(props: React.ComponentProps<typeof AnimatedExpoImage>) {
  type ExpoImageProps = React.ComponentProps<typeof RNImage>;
  type CSSImageStyle = ImageStyle & {
    objectFit?: ExpoImageProps['contentFit'];
    objectPosition?: ExpoImageProps['contentPosition'];
  };

  const { objectFit, objectPosition, ...style } =
    (StyleSheet.flatten(props.style) as CSSImageStyle | undefined) || {};

  return (
    <AnimatedExpoImage
      contentFit={objectFit}
      contentPosition={objectPosition}
      {...props}
      source={
        typeof props.source === 'string' ? { uri: props.source } : props.source
      }
      style={style as React.ComponentProps<typeof AnimatedExpoImage>['style']}
    />
  );
}

export type ImageProps = React.ComponentProps<typeof CSSImage> & {
  className?: string;
};

export const Image = (props: ImageProps) => {
  return cssElement(CSSImage, props as unknown as Record<string, unknown>, {
    className: 'style',
  });
};

Image.displayName = 'CSS(Image)';
