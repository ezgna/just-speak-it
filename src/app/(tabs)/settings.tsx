import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardSplitPolicySelector } from '@/components/card-split-policy-selector';
import { useDailyPalette } from '@/components/just-speak-it-ui';
import { LocalRecordingSettings } from '@/components/local-recording-settings';
import { ThemePreferenceSelector } from '@/components/theme-preference-selector';
import { TranslationStyleSelector } from '@/components/translation-style-selector';
import { GlideButton } from '@/components/ui/glide-button';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';

export default function SettingsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: safeAreaInsets.top + TopTabInset + Spacing.two,
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
            <GlideButton
              label="試作室"
              caption="prototype room"
              icon={{ ios: 'hammer.fill', android: 'construction', web: 'construction' }}
              tone="orange"
              size="medium"
              onPress={() => router.push('/prototype-room')}
            />
          </View>
        ) : null}

        <ThemePreferenceSelector />
        <CardSplitPolicySelector />
        <TranslationStyleSelector />
        <LocalRecordingSettings />
      </View>
    </ScrollView>
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
});
