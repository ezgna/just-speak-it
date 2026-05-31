import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  GlideFoundationColor,
  GlideSizeMetrics,
  GlideTones,
  getGlideRgba,
  type GlideSize,
  type GlideTone,
} from '@/components/ui/glide-frame';
import { Spacing } from '@/constants/theme';

type GlideTextInputProps = Omit<TextInputProps, 'style'> & {
  tone?: GlideTone;
  accentTone?: GlideTone;
  size?: GlideSize;
  variant?: 'surface' | 'canvas';
  canvasCornerColor?: string;
  fullWidth?: boolean;
  meta?: string;
  containerStyle?: StyleProp<ViewStyle>;
  frameStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
};

export function GlideTextInput({
  tone = 'cream',
  accentTone = 'mint',
  size = 'large',
  variant = 'surface',
  canvasCornerColor = GlideFoundationColor,
  fullWidth = true,
  meta,
  containerStyle,
  frameStyle,
  inputStyle,
  placeholderTextColor,
  multiline = true,
  scrollEnabled = multiline,
  textAlignVertical = 'top',
  editable = true,
  ...props
}: GlideTextInputProps) {
  const toneStyle = GlideTones[tone];
  const accentStyle = GlideTones[accentTone];
  const sizeMetrics = GlideSizeMetrics[size];
  const resolvedPlaceholderColor =
    placeholderTextColor ?? getGlideRgba(toneStyle.textColor, 0.58);
  const isCanvas = variant === 'canvas';

  return (
    <View
      style={[
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        containerStyle,
      ]}>
      <View
        style={[
          isCanvas
            ? styles.canvasFrame
            : {
                borderRadius: sizeMetrics.borderRadius,
                borderWidth: sizeMetrics.borderWidth,
                borderColor: GlideFoundationColor,
                backgroundColor: toneStyle.backgroundColor,
                paddingHorizontal: sizeMetrics.paddingHorizontal,
                paddingVertical: sizeMetrics.paddingVertical,
              },
          {
            width: fullWidth ? '100%' : undefined,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            minHeight: sizeMetrics.minHeight,
          },
          meta && size === 'large' ? styles.largeFrameWithMeta : null,
          frameStyle,
        ]}>
        {isCanvas ? (
          <>
            <View
              style={[
                styles.canvasCorner,
                styles.canvasCornerTop,
                { borderColor: canvasCornerColor },
              ]}
            />
            <View
              style={[
                styles.canvasCorner,
                styles.canvasCornerBottom,
                { borderColor: canvasCornerColor },
              ]}
            />
          </>
        ) : null}
        {meta ? (
          <View style={styles.metaRow}>
            <View
              style={[
                styles.accentRail,
                {
                  backgroundColor: accentStyle.backgroundColor,
                },
              ]}
            />
            <ThemedText style={[styles.metaText, { color: toneStyle.textColor }]}>
              {meta}
            </ThemedText>
          </View>
        ) : null}
        <TextInput
          {...props}
          editable={editable}
          multiline={multiline}
          scrollEnabled={scrollEnabled}
          textAlignVertical={textAlignVertical}
          placeholderTextColor={resolvedPlaceholderColor}
          selectionColor={accentStyle.backgroundColor}
          style={[
            isCanvas ? styles.canvasInput : styles.input,
            {
              color: toneStyle.textColor,
              opacity: editable ? 1 : 0.92,
            },
            inputStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  accentRail: {
    width: 34,
    height: 14,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
  },
  metaText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 116,
    padding: 0,
  },
  canvasFrame: {
    position: 'relative',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  canvasCorner: {
    position: 'absolute',
    width: 34,
    height: 34,
  },
  canvasCornerTop: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  canvasCornerBottom: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  canvasInput: {
    minHeight: 0,
    padding: 0,
    fontSize: 21,
    lineHeight: 32,
    fontWeight: 800,
  },
  largeFrameWithMeta: {
    paddingVertical: 11,
  },
});
