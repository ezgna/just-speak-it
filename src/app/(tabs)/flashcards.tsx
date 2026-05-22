import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { SwipeFlashcardDeck } from '@/components/swipe-flashcard-deck';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslationCardGroups } from '@/hooks/use-translation-card-groups';

export default function FlashcardsScreen() {
  const { width } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const swipeFeedbackX = useSharedValue(0);
  const { groups, isInitialLoading, isRefreshing, errorMessage, refreshGroups } =
    useTranslationCardGroups();
  const cardWidth = Math.min(width - Spacing.four * 2, 560);
  const swipeThreshold = Math.max(92, cardWidth * 0.24);

  const screenFeedbackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      swipeFeedbackX.get(),
      [-swipeThreshold, 0, swipeThreshold],
      [palette.amberSoft, palette.background, palette.greenSoft]
    ),
  }));

  return (
    <Animated.View
      style={[styles.screen, { backgroundColor: palette.background }, screenFeedbackStyle]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: '100%',
            paddingTop: safeAreaInsets.top,
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
            paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
            paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshGroups} tintColor={palette.primary} />
        }>
        <View style={styles.container}>
          {isInitialLoading && groups.length === 0 && (
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.primary} />
            </View>
          )}

          {!isInitialLoading && groups.length === 0 && !errorMessage && (
            <View style={styles.centerState}>
              <ThemedText type="title" selectable>
                復習
              </ThemedText>
              <ThemedText themeColor="textSecondary" selectable>
                まだ復習できる英語カードはありません。
              </ThemedText>
            </View>
          )}

          {errorMessage && groups.length === 0 && (
            <View style={styles.centerState}>
              <ThemedText type="title" selectable>
                復習
              </ThemedText>
              <ThemedText style={{ color: palette.coral }} selectable>
                {errorMessage}
              </ThemedText>
            </View>
          )}

          {errorMessage && groups.length > 0 && (
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

          {groups.length > 0 && (
            <SwipeFlashcardDeck groups={groups} feedbackX={swipeFeedbackX} />
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
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
  loadingState: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  errorBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  centerState: {
    minHeight: 360,
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
