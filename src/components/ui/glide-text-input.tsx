import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  GlideFrame,
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
  fullWidth = true,
  meta,
  containerStyle,
  frameStyle,
  inputStyle,
  placeholderTextColor,
  multiline = true,
  textAlignVertical = 'top',
  editable = true,
  ...props
}: GlideTextInputProps) {
  const toneStyle = GlideTones[tone];
  const accentStyle = GlideTones[accentTone];
  const resolvedPlaceholderColor =
    placeholderTextColor ?? getGlideRgba(toneStyle.textColor, 0.58);

  return (
    <GlideFrame
      tone={tone}
      size={size}
      fullWidth={fullWidth}
      containerStyle={containerStyle}
      style={[meta && size === 'large' ? styles.largeFrameWithMeta : null, frameStyle]}
      accessibilityRole="text">
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
        textAlignVertical={textAlignVertical}
        placeholderTextColor={resolvedPlaceholderColor}
        selectionColor={accentStyle.backgroundColor}
        style={[
          styles.input,
          {
            color: toneStyle.textColor,
            opacity: editable ? 1 : 0.92,
          },
          inputStyle,
        ]}
      />
    </GlideFrame>
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
  largeFrameWithMeta: {
    paddingVertical: 11,
  },
});
