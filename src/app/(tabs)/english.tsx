import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { EnglishPracticeDeck } from '@/components/english-practice-deck';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useTranslationCardGroups } from '@/hooks/use-translation-card-groups';

export default function EnglishScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const { groups, isInitialLoading, isRefreshing, errorMessage, refreshGroups } =
    useTranslationCardGroups();
  const emptyStateInsets = {
    paddingTop: safeAreaInsets.top + TopTabInset + Spacing.two,
    paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
    paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
    paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
  };
  const contentInsets = {
    paddingTop: safeAreaInsets.top + TopTabInset + Spacing.two,
    paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
    paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
    paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
  };

  if (groups.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={[styles.centerState, emptyStateInsets]}>
          {isInitialLoading ? (
            <ActivityIndicator color={palette.primary} />
          ) : errorMessage ? (
            <View style={styles.statePanel}>
              <ThemedText style={styles.stateTitle} selectable>
                読み込めませんでした
              </ThemedText>
              <ThemedText style={styles.stateText} selectable>
                {errorMessage}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                disabled={isRefreshing}
                onPress={refreshGroups}
                style={({ pressed }) => [
                  styles.retryButton,
                  { opacity: isRefreshing ? 0.5 : pressed ? 0.74 : 1 },
                ]}>
                <ThemedText style={styles.retryButtonText}>
                  再読み込み
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.statePanel}>
              <ThemedText style={styles.stateTitle} selectable>
                英語カードはまだありません
              </ThemedText>
              <ThemedText style={styles.stateText} selectable>
                日記から英語カードを作ると、この英語タブに表示されます。
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: palette.background }]}
      contentContainerStyle={[styles.content, contentInsets]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refreshGroups} tintColor={palette.primary} />
      }>
      <View style={styles.container}>
        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: palette.coral }} selectable>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        <EnglishPracticeDeck groups={groups} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  screen: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  errorBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  centerState: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statePanel: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: '#111111',
    backgroundColor: '#FFFFFF',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  stateTitle: {
    color: '#111111',
    fontSize: 24,
    lineHeight: 31,
    fontWeight: 800,
  },
  stateText: {
    color: '#5F6670',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
  },
  retryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#2FDD6C',
    paddingHorizontal: Spacing.three,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
  },
});
