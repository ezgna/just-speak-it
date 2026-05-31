import {
  Button as SwiftButton,
  HStack as SwiftHStack,
  Host as SwiftHost,
  Image as SwiftImage,
  Text as SwiftText,
  ZStack as SwiftZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  controlSize,
  frame,
  opacity,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GenerationModeSelector } from '@/components/generation-mode-selector';
import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemePreferenceSelector } from '@/components/theme-preference-selector';
import { GlideButton } from '@/components/ui/glide-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedColorScheme } from '@/hooks/use-theme-preference';

const MemoStackerCopyAccent = '#276EF1';
const fadeButtonStateAnimation = Animation.easeInOut({ duration: 0.16 });

export default function SettingsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const colorScheme = useResolvedColorScheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: safeAreaInsets.top + Spacing.three,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
          paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
        },
      ]}>
      <View style={styles.container}>
        {__DEV__ ? (
          <View style={styles.labButtons}>
            <GlideButton
              label="実験室"
              caption="design lab"
              icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              tone="mint"
              size="medium"
              onPress={() => router.push('/design-lab')}
            />
            <GlideButton
              label="ワークベンチ"
              caption="workbench"
              icon={{ ios: 'square.grid.2x2.fill', android: 'dashboard_customize', web: 'dashboard_customize' }}
              tone="sky"
              size="medium"
              onPress={() => router.push('/workbench')}
            />
          </View>
        ) : null}

        <ThemePreferenceSelector />
        <GenerationModeSelector />
        <View style={styles.copyButtonDock}>
          <MemoStackerCopyButton colorScheme={colorScheme} />
        </View>
      </View>
    </ScrollView>
  );
}

function MemoStackerCopyButton({ colorScheme }: { colorScheme: 'dark' | 'light' }) {
  const [isCopied, setIsCopied] = useState(false);

  function handleCopyPress() {
    setIsCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  return (
    <SwiftHost matchContents colorScheme={colorScheme}>
      <SwiftButton
        onPress={handleCopyPress}
        modifiers={[
          accessibilityLabel(isCopied ? '完了' : 'コピー'),
          frame({ minWidth: 140, minHeight: 44 }),
          padding({ top: 0, bottom: 0, leading: 18, trailing: 18 }),
          controlSize('large'),
          buttonStyle('glassProminent'),
          tint(MemoStackerCopyAccent),
        ]}>
        <SwiftZStack modifiers={[animation(fadeButtonStateAnimation, isCopied)]}>
          <SwiftHStack spacing={6} modifiers={[opacity(isCopied ? 0 : 1)]}>
            <SwiftImage systemName="doc.on.doc" size={15} />
            <SwiftText>コピー</SwiftText>
          </SwiftHStack>
          <SwiftHStack spacing={6} modifiers={[opacity(isCopied ? 1 : 0)]}>
            <SwiftImage systemName="checkmark" size={15} />
            <SwiftText>完了</SwiftText>
          </SwiftHStack>
        </SwiftZStack>
      </SwiftButton>
    </SwiftHost>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  labButtons: {
    gap: Spacing.two,
  },
  copyButtonDock: {
    alignItems: 'center',
  },
});
