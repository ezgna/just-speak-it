import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  useSafeAreaInsets,
  type EdgeInsets,
} from 'react-native-safe-area-context';

import { SlackFlashcardLab } from '@/components/slack-flashcard-lab';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslationCardGroups } from '@/hooks/use-translation-card-groups';

export default function FlashcardsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { groups, isInitialLoading, isRefreshing, errorMessage, refreshGroups } =
    useTranslationCardGroups();

  return (
    <View style={styles.screen}>
      {isInitialLoading && groups.length === 0 ? (
        <View style={[styles.centerState, getStateInsets(safeAreaInsets)]}>
          <ActivityIndicator color={ReviewColors.white} />
        </View>
      ) : errorMessage && groups.length === 0 ? (
        <View style={[styles.centerState, getStateInsets(safeAreaInsets)]}>
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
        </View>
      ) : groups.length === 0 ? (
        <View style={[styles.centerState, getStateInsets(safeAreaInsets)]}>
          <View style={styles.statePanel}>
            <ThemedText style={styles.stateTitle} selectable>
              復習カードはまだありません
            </ThemedText>
            <ThemedText style={styles.stateText} selectable>
              日記から英語カードを作ると、この復習タブに表示されます。
            </ThemedText>
          </View>
        </View>
      ) : (
        <SlackFlashcardLab groups={groups} safeAreaInsets={safeAreaInsets} />
      )}
    </View>
  );
}

function getStateInsets(safeAreaInsets: EdgeInsets) {
  return {
    paddingTop: safeAreaInsets.top + Spacing.two,
    paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
    paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
    paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
  };
}

const ReviewColors = {
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#4B154E',
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
    borderRadius: 28,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  stateTitle: {
    color: '#1D1C1D',
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
    backgroundColor: '#2E8B62',
    paddingHorizontal: Spacing.three,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
  },
});
