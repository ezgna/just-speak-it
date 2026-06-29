import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  unstable_batchedUpdates,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { EdgeInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { LocalRecordingPlayButton } from '@/components/local-recording-play-button';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useCardLearningStatuses } from '@/hooks/use-card-learning-statuses';
import {
  beginExclusiveAudioPlayback,
  registerAudioPlaybackStopper,
  stopSpeechSafely,
  type AudioPlaybackLease,
} from '@/lib/audio/playback-coordinator';
import type { TranslationCardGroup } from '@/lib/backend/practice';
import {
  getCardProgress,
  getCardStatus,
  isCardDue,
  type CardLearningProgress,
  type CardLearningProgresses,
  type CardLearningStatus,
} from '@/lib/card-learning-statuses';
import {
  flattenTranslationCardGroups,
  StatusPriority,
  type PracticeCard,
} from '@/lib/practice-cards';

type SlackFlashcardLabProps = {
  groups: TranslationCardGroup[];
  safeAreaInsets: EdgeInsets;
  footerAccessory?: ReactNode;
  headerAccessory?: ReactNode;
  onDueCountChange?: (dueCount: number) => void;
  variant?: 'screen' | 'embedded';
};

type UndoEntry = {
  cardId: string;
  card: PracticeCard;
  previousProgress: CardLearningProgress | undefined;
};

type PendingDismissals = Record<string, { dismissedAt: string }>;
type PendingStatusUpdate = {
  cardId: string;
  status: CardLearningStatus;
};

const CancelReturnSpringConfig = {
  damping: 30,
  mass: 0.9,
  stiffness: 210,
};
const PromotionDuration = 170;
const VisibleCardCount = 3;
const BackCardTranslateY = 38;
const BackCardScale = 0.93;
const DeepCardTranslateY = BackCardTranslateY;
const DeepCardScale = 0.88;
const EmbeddedCardFooterClearance = BackCardTranslateY + Spacing.two;
const ActiveBackCardTranslateY = 12;
const ActiveBackCardScale = 0.985;
const DeepCardDragLag = 0.78;
const PromptTextMetrics = {
  fontSize: 27,
  lineHeight: 37,
};
const AnswerTextMetrics = {
  fontSize: 28,
  lineHeight: 38,
};
const AnswerSoundControlSize = 40;
const EnglishSpeechFallbackPaddingMs = 3200;
const EnglishSpeechFallbackMinMs = 6000;
const EnglishSpeechFallbackMaxMs = 45000;
const EnglishSpeechStartDelayMs = 90;
const DecisionRingSize = 68;
const DecisionRingStrokeWidth = 4;
const DecisionRingStartOffset = 32;
const DecisionRingCenter = DecisionRingSize / 2;
const DecisionRingRadius = (DecisionRingSize - DecisionRingStrokeWidth) / 2;
const DecisionRingCircumference = 2 * Math.PI * DecisionRingRadius;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SlackFlashcardLab({
  footerAccessory,
  groups,
  headerAccessory,
  onDueCountChange,
  safeAreaInsets,
  variant = 'screen',
}: SlackFlashcardLabProps) {
  const { width, height } = useWindowDimensions();
  const palette = useDailyPalette();
  const isEmbedded = variant === 'embedded';
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const promotionProgress = useSharedValue(0);
  const swipeOwnerCardId = useSharedValue<string | null>(null);
  const promotionOwnerCardId = useSharedValue<string | null>(null);
  const trailingPromotionOwnerCardId = useSharedValue<string | null>(null);
  const decisionOwnerCardId = useSharedValue<string | null>(null);
  const swipeHapticDecisionDirection = useSharedValue(0);
  const pendingStatusUpdatesRef = useRef<PendingStatusUpdate[]>([]);
  const [pendingDismissals, setPendingDismissals] = useState<PendingDismissals>({});
  const [pendingStatusUpdates, setPendingStatusUpdates] = useState<PendingStatusUpdate[]>([]);
  const [frontPinnedCard, setFrontPinnedCard] = useState<PracticeCard | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [bodySize, setBodySize] = useState({ width: 0, height: 0 });
  const [rootSize, setRootSize] = useState({ width: 0, height: 0 });
  const [visualQueue, setVisualQueue] = useState<PracticeCard[] | null>(null);
  const [pendingVisualQueueRelease, setPendingVisualQueueRelease] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  const rootWidth = rootSize.width > 0 ? rootSize.width : width;
  const horizontalPadding = isEmbedded
    ? 0
    : Math.max(safeAreaInsets.left, Spacing.three) +
      Math.max(safeAreaInsets.right, Spacing.three);
  const verticalReservedSpace =
    safeAreaInsets.top + TopTabInset + safeAreaInsets.bottom + BottomTabInset + 252;
  const cardWidth = Math.min(Math.max(rootWidth - horizontalPadding, 0), 560);
  const measuredBodyHeight = bodySize.height > 0 ? bodySize.height : 360;
  const embeddedMinCardHeight = Math.min(measuredBodyHeight, 220);
  const embeddedCardHeight = Math.max(
    embeddedMinCardHeight,
    measuredBodyHeight - EmbeddedCardFooterClearance
  );
  const cardHeight = isEmbedded
    ? embeddedCardHeight
    : Math.min(Math.max(height - verticalReservedSpace, 360), 540);
  const stageHeight = isEmbedded ? '100%' : cardHeight;
  const swipeThreshold = Math.max(88, cardWidth * 0.22);
  const swipeOutDistance = width + 180;
  const rootInsets = isEmbedded
    ? {
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }
    : {
        paddingTop: safeAreaInsets.top + TopTabInset + Spacing.two,
        paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
        paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
        paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
      };
  const rootBackgroundColor = isEmbedded ? 'transparent' : palette.background;
  const doneBodyText = isEmbedded
    ? '次に復習日が来たカードから、この画面にまた出ます。'
    : '次に復習日が来たカードから、この画面にまた戻ってきます。';

  const handleRootLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;

    setRootSize((currentSize) => {
      if (
        Math.abs(currentSize.width - nextWidth) < 1 &&
        Math.abs(currentSize.height - nextHeight) < 1
      ) {
        return currentSize;
      }

      return { width: nextWidth, height: nextHeight };
    });
  }, []);

  const handleBodyLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;

    setBodySize((currentSize) => {
      if (
        Math.abs(currentSize.width - nextWidth) < 1 &&
        Math.abs(currentSize.height - nextHeight) < 1
      ) {
        return currentSize;
      }

      return { width: nextWidth, height: nextHeight };
    });
  }, []);

  const cards = useMemo(() => flattenTranslationCardGroups(groups), [groups]);
  const initialCardStatuses = useMemo<CardLearningProgresses>(() => {
    return cards.reduce<CardLearningProgresses>((nextStatuses, card) => {
      nextStatuses[card.id] = card.learningProgress;
      return nextStatuses;
    }, {});
  }, [cards]);
  const { cardStatuses, restoreCardProgress, setCardStatus } =
    useCardLearningStatuses(initialCardStatuses);
  const cardsById = useMemo(() => {
    return new Map(cards.map((card) => [card.id, card]));
  }, [cards]);
  const reviewQueue = useMemo(() => {
    return cards
      .filter((card) => isCardDue(cardStatuses, card.id))
      .sort((firstCard, secondCard) => {
        const firstStatus = getCardStatus(cardStatuses, firstCard.id);
        const secondStatus = getCardStatus(cardStatuses, secondCard.id);
        const statusDiff = StatusPriority[firstStatus] - StatusPriority[secondStatus];

        if (statusDiff !== 0) {
          return statusDiff;
        }

        const dateDiff =
          new Date(secondCard.diaryCreatedAt).getTime() -
          new Date(firstCard.diaryCreatedAt).getTime();

        if (dateDiff !== 0) {
          return dateDiff;
        }

        return firstCard.sortOrder - secondCard.sortOrder;
      });
  }, [cardStatuses, cards]);
  const displayQueue = useMemo(() => {
    const availableQueue = reviewQueue.filter(
      (card) => !isPendingDismissalActive(card.id, pendingDismissals, cardStatuses)
    );

    if (!frontPinnedCard) {
      return availableQueue;
    }

    const pinnedCard =
      availableQueue.find((card) => card.id === frontPinnedCard.id) ?? frontPinnedCard;

    return [
      pinnedCard,
      ...availableQueue.filter((card) => card.id !== frontPinnedCard.id),
    ];
  }, [cardStatuses, frontPinnedCard, pendingDismissals, reviewQueue]);

  useEffect(() => {
    onDueCountChange?.(displayQueue.length);
  }, [displayQueue.length, onDueCountChange]);

  const renderQueue = visualQueue ?? displayQueue;
  const visibleCards = useMemo(
    () => renderQueue.slice(0, VisibleCardCount),
    [renderQueue]
  );
  const activeCard = renderQueue[0] ?? null;
  const activeCardId = activeCard?.id ?? null;
  const promotedCardId = visibleCards[1]?.id ?? null;
  const trailingPromotedCardId = visibleCards[2]?.id ?? null;

  const resetCardTranslation = useCallback(() => {
    translateX.set(0);
    translateY.set(0);
  }, [translateX, translateY]);

  const resetCardPosition = useCallback(() => {
    resetCardTranslation();
    promotionProgress.set(0);
    swipeOwnerCardId.set(null);
    promotionOwnerCardId.set(null);
    trailingPromotionOwnerCardId.set(null);
    decisionOwnerCardId.set(null);
    swipeHapticDecisionDirection.set(0);
  }, [
    decisionOwnerCardId,
    promotionOwnerCardId,
    promotionProgress,
    resetCardTranslation,
    swipeHapticDecisionDirection,
    swipeOwnerCardId,
    trailingPromotionOwnerCardId,
  ]);

  const persistStatusUpdates = useCallback((pendingUpdates: PendingStatusUpdate[]) => {
    for (const pendingUpdate of pendingUpdates) {
      setCardStatus(pendingUpdate.cardId, pendingUpdate.status);
    }
  }, [setCardStatus]);

  useEffect(() => {
    pendingStatusUpdatesRef.current = pendingStatusUpdates;
  }, [pendingStatusUpdates]);

  useEffect(() => {
    return () => {
      const updatesToPersist = pendingStatusUpdatesRef.current;
      pendingStatusUpdatesRef.current = [];
      persistStatusUpdates(updatesToPersist);
    };
  }, [persistStatusUpdates]);

  useEffect(() => {
    if (pendingVisualQueueRelease !== 0) {
      return;
    }

    if (swipeOwnerCardId.get() && swipeOwnerCardId.get() !== activeCardId) {
      resetCardPosition();
    }
  }, [activeCardId, pendingVisualQueueRelease, resetCardPosition, swipeOwnerCardId]);

  useEffect(() => {
    if (pendingVisualQueueRelease === 0) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        resetCardPosition();
        setVisualQueue(null);
        setPendingVisualQueueRelease(0);
        requestAnimationFrame(() => {
          const updatesToPersist = pendingStatusUpdatesRef.current;
          pendingStatusUpdatesRef.current = [];
          setPendingStatusUpdates([]);
          persistStatusUpdates(updatesToPersist);
        });
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [
    pendingVisualQueueRelease,
    persistStatusUpdates,
    resetCardPosition,
  ]);

  const handleToggleAnswerPress = useCallback(() => {
    setIsAnswerVisible((currentValue) => !currentValue);
  }, []);

  const lockVisualQueue = useCallback(() => {
    setVisualQueue(displayQueue.slice(0, VisibleCardCount));
  }, [displayQueue]);

  const unlockVisualQueue = useCallback(() => {
    setVisualQueue(null);
  }, []);

  const playSwipeThresholdHaptic = useCallback(() => {
    if (process.env.EXPO_OS === 'web') {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, []);

  const completeSwipe = useCallback(
    (status: CardLearningStatus) => {
      if (!activeCard) {
        resetCardPosition();
        return;
      }

      const dismissedAt = new Date().toISOString();
      const nextVisualQueue = displayQueue
        .filter((card) => card.id !== activeCard.id)
        .slice(0, VisibleCardCount);
      unstable_batchedUpdates(() => {
        setPendingStatusUpdates((currentUpdates) => [
          ...currentUpdates.filter((update) => update.cardId !== activeCard.id),
          { cardId: activeCard.id, status },
        ]);
        setVisualQueue(nextVisualQueue);
        setPendingVisualQueueRelease((currentValue) => currentValue + 1);
        setUndoStack((currentStack) => [
          ...currentStack.slice(-4),
          {
            cardId: activeCard.id,
            card: activeCard,
            previousProgress: getCardProgress(cardStatuses, activeCard.id),
          },
        ]);
        setPendingDismissals((currentDismissals) => ({
          ...currentDismissals,
          [activeCard.id]: { dismissedAt },
        }));
        setFrontPinnedCard(null);
        setIsAnswerVisible(false);
      });
    },
    [activeCard, cardStatuses, displayQueue, resetCardPosition]
  );

  const handleUndoPress = useCallback(() => {
    const undoEntry = undoStack[undoStack.length - 1];

    if (!undoEntry) {
      return;
    }

    const restoredCard = cardsById.get(undoEntry.cardId) ?? undoEntry.card;

    unstable_batchedUpdates(() => {
      pendingStatusUpdatesRef.current = pendingStatusUpdatesRef.current.filter(
        (update) => update.cardId !== undoEntry.cardId
      );
      setPendingStatusUpdates((currentUpdates) =>
        currentUpdates.filter((update) => update.cardId !== undoEntry.cardId)
      );
      resetCardPosition();
      setVisualQueue(null);
      setPendingVisualQueueRelease(0);
      setPendingDismissals((currentDismissals) => {
        if (!(undoEntry.cardId in currentDismissals)) {
          return currentDismissals;
        }

        const nextDismissals = { ...currentDismissals };
        delete nextDismissals[undoEntry.cardId];
        return nextDismissals;
      });
      setFrontPinnedCard(restoredCard);
      setUndoStack((currentStack) => currentStack.slice(0, -1));
      setIsAnswerVisible(false);
      restoreCardProgress(undoEntry.cardId, undoEntry.previousProgress);
    });
  }, [cardsById, resetCardPosition, restoreCardProgress, undoStack]);

  const animateCardDecision = useCallback(
    (status: CardLearningStatus, releaseTranslateY = status === 'known' ? -18 : 18) => {
      const decisionQueue = displayQueue.slice(0, VisibleCardCount);
      const decisionActiveCardId = decisionQueue[0]?.id ?? null;
      const decisionPromotedCardId = decisionQueue[1]?.id ?? null;
      const decisionTrailingPromotedCardId = decisionQueue[2]?.id ?? null;

      if (!decisionActiveCardId || decisionOwnerCardId.get()) {
        return;
      }

      const direction = status === 'known' ? 1 : -1;

      setVisualQueue(decisionQueue);
      decisionOwnerCardId.set(decisionActiveCardId);
      swipeOwnerCardId.set(decisionActiveCardId);
      promotionOwnerCardId.set(null);
      trailingPromotionOwnerCardId.set(null);
      promotionProgress.set(0);
      swipeHapticDecisionDirection.set(0);
      translateX.set(
        withTiming(direction * swipeOutDistance, { duration: 190 }, (finished) => {
          if (finished) {
            promotionOwnerCardId.set(decisionPromotedCardId);
            trailingPromotionOwnerCardId.set(decisionTrailingPromotedCardId);
            promotionProgress.set(0);
            promotionProgress.set(
              withTiming(1, { duration: PromotionDuration }, (promoted) => {
                if (promoted) {
                  runOnJS(completeSwipe)(status);
                }
              })
            );
          }
        })
      );
      translateY.set(withTiming(releaseTranslateY, { duration: 190 }));
    },
    [
      completeSwipe,
      decisionOwnerCardId,
      displayQueue,
      promotionOwnerCardId,
      promotionProgress,
      swipeOutDistance,
      swipeOwnerCardId,
      swipeHapticDecisionDirection,
      trailingPromotionOwnerCardId,
      translateX,
      translateY,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          if (activeCardId && !decisionOwnerCardId.get()) {
            runOnJS(lockVisualQueue)();
            swipeOwnerCardId.set(activeCardId);
            promotionOwnerCardId.set(null);
            trailingPromotionOwnerCardId.set(null);
            promotionProgress.set(0);
            swipeHapticDecisionDirection.set(0);
          }
        })
        .onUpdate((event) => {
          if (decisionOwnerCardId.get()) {
            return;
          }

          if (activeCardId && swipeOwnerCardId.get() !== activeCardId) {
            swipeOwnerCardId.set(activeCardId);
          }

          translateX.set(event.translationX);
          translateY.set(event.translationY);

          const decisionDirection =
            event.translationX > swipeThreshold ? 1 : event.translationX < -swipeThreshold ? -1 : 0;
          const currentHapticDecisionDirection = swipeHapticDecisionDirection.get();

          if (decisionDirection === 0) {
            if (currentHapticDecisionDirection !== 0) {
              swipeHapticDecisionDirection.set(0);
            }
            return;
          }

          if (currentHapticDecisionDirection !== decisionDirection) {
            swipeHapticDecisionDirection.set(decisionDirection);
            runOnJS(playSwipeThresholdHaptic)();
          }
        })
        .onEnd((event) => {
          if (decisionOwnerCardId.get()) {
            return;
          }

          const shouldDecide =
            Math.abs(event.translationX) > swipeThreshold || Math.abs(event.velocityX) > 760;

          if (!shouldDecide) {
            translateX.set(
              withSpring(0, CancelReturnSpringConfig, (finished) => {
                if (finished) {
                  swipeOwnerCardId.set(null);
                  runOnJS(unlockVisualQueue)();
                }
              })
            );
            translateY.set(withSpring(0, CancelReturnSpringConfig));
            promotionOwnerCardId.set(null);
            trailingPromotionOwnerCardId.set(null);
            promotionProgress.set(0);
            swipeHapticDecisionDirection.set(0);
            return;
          }

          const status = event.translationX > 0 ? 'known' : 'learning';
          const direction = status === 'known' ? 1 : -1;

          if (!activeCardId) {
            return;
          }

          decisionOwnerCardId.set(activeCardId);
          swipeHapticDecisionDirection.set(0);
          translateX.set(
            withTiming(direction * swipeOutDistance, { duration: 190 }, (finished) => {
              if (finished) {
                promotionOwnerCardId.set(promotedCardId);
                trailingPromotionOwnerCardId.set(trailingPromotedCardId);
                promotionProgress.set(0);
                promotionProgress.set(
                  withTiming(1, { duration: PromotionDuration }, (promoted) => {
                    if (promoted) {
                      runOnJS(completeSwipe)(status);
                    }
                  })
                );
              }
            })
          );
          translateY.set(withTiming(event.translationY * 0.35, { duration: 190 }));
        }),
    [
      activeCardId,
      completeSwipe,
      decisionOwnerCardId,
      lockVisualQueue,
      playSwipeThresholdHaptic,
      promotedCardId,
      promotionOwnerCardId,
      promotionProgress,
      swipeOutDistance,
      swipeHapticDecisionDirection,
      swipeThreshold,
      swipeOwnerCardId,
      trailingPromotedCardId,
      trailingPromotionOwnerCardId,
      translateX,
      translateY,
      unlockVisualQueue,
    ]
  );

  if (!activeCard) {
    return (
      <Animated.View
        onLayout={handleRootLayout}
        style={[
          styles.root,
          isEmbedded ? styles.embeddedRoot : null,
          rootInsets,
          { backgroundColor: rootBackgroundColor },
        ]}>
        <View style={[styles.content, isEmbedded ? styles.embeddedContent : null]}>
          <LabHeader
            dueCount={0}
            onUndo={handleUndoPress}
            rightAccessory={headerAccessory}
            undoDisabled={undoStack.length === 0}
          />
          <View style={styles.doneStage}>
            <View style={styles.donePanel}>
              <View style={styles.doneIcon}>
                <SymbolView
                  name={{
                    ios: 'checkmark.circle.fill',
                    android: 'check_circle',
                    web: 'check_circle',
                  }}
                  size={42}
                  tintColor={LabColors.mint}
                />
              </View>
              <ThemedText style={styles.doneTitle} selectable>
                今日の復習は完了です
              </ThemedText>
              <ThemedText style={styles.doneText} selectable>
                {doneBodyText}
              </ThemedText>
            </View>
          </View>
          {footerAccessory ? (
            <View style={[styles.reviewFooter, isEmbedded ? styles.embeddedReviewFooter : null]}>
              <View style={styles.footerAccessory}>
                {footerAccessory}
              </View>
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      onLayout={handleRootLayout}
      style={[
        styles.root,
        isEmbedded ? styles.embeddedRoot : null,
        rootInsets,
        { backgroundColor: rootBackgroundColor },
      ]}>
      <View style={[styles.content, isEmbedded ? styles.embeddedContent : null]}>
        <LabHeader
          dueCount={displayQueue.length}
          onUndo={handleUndoPress}
          rightAccessory={headerAccessory}
          undoDisabled={undoStack.length === 0}
        />

        <View onLayout={handleBodyLayout} style={styles.reviewBody}>
          <View
            style={[
              styles.stage,
              isEmbedded ? styles.embeddedStage : null,
              { width: cardWidth, height: stageHeight },
            ]}>
            <GestureDetector gesture={panGesture}>
              <View collapsable={false} style={styles.cardStack}>
                {visibleCards.map((card, position) => (
                  <SlackCardLayer
                    key={card.id}
                    card={card}
                    cardHeight={cardHeight}
                    cardWidth={cardWidth}
                    isAnswerVisible={position === 0 && isAnswerVisible}
                    onToggleAnswer={position === 0 ? handleToggleAnswerPress : undefined}
                    position={position}
                    promotionOwnerCardId={promotionOwnerCardId}
                    promotionProgress={promotionProgress}
                    swipeOwnerCardId={swipeOwnerCardId}
                    swipeThreshold={swipeThreshold}
                    trailingPromotionOwnerCardId={trailingPromotionOwnerCardId}
                    translateX={translateX}
                    translateY={translateY}
                  />
                ))}
              </View>
            </GestureDetector>
          </View>
        </View>

        <View style={[styles.reviewFooter, isEmbedded ? styles.embeddedReviewFooter : null]}>
          <View style={styles.actionBar}>
            <DecisionButton
              label="もう一回"
              tone="keep"
              onPress={() => animateCardDecision('learning')}
            />
            <DecisionButton
              label="言えた"
              tone="read"
              onPress={() => animateCardDecision('known')}
            />
          </View>
          {footerAccessory ? (
            <View style={styles.footerAccessory}>
              {footerAccessory}
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const SlackCardLayer = memo(function SlackCardLayer({
  card,
  cardHeight,
  cardWidth,
  isAnswerVisible,
  onToggleAnswer,
  position,
  promotionOwnerCardId,
  promotionProgress,
  swipeOwnerCardId,
  swipeThreshold,
  trailingPromotionOwnerCardId,
  translateX,
  translateY,
}: {
  card: PracticeCard;
  cardHeight: number;
  cardWidth: number;
  isAnswerVisible: boolean;
  onToggleAnswer?: () => void;
  position: number;
  promotionOwnerCardId: SharedValue<string | null>;
  promotionProgress: SharedValue<number>;
  swipeOwnerCardId: SharedValue<string | null>;
  swipeThreshold: number;
  trailingPromotionOwnerCardId: SharedValue<string | null>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}) {
  const layerStyle = useAnimatedStyle(() => {
    const x = translateX.get();
    const y = translateY.get();
    const absoluteX = Math.abs(x);
    const isSwipeOwner = swipeOwnerCardId.get() === card.id;
    const activeX = isSwipeOwner ? x : 0;
    const activeY = isSwipeOwner ? y : 0;
    const activeAbsoluteX = Math.abs(activeX);

    if (position === 0) {
      return {
        transform: [
          { translateX: activeX },
          { translateY: activeY },
          {
            rotate: `${interpolate(
              activeX,
              [-swipeThreshold * 1.4, 0, swipeThreshold * 1.4],
              [-8, 0, 8],
              Extrapolation.CLAMP
            )}deg`,
          },
          {
            scale: interpolate(
              activeAbsoluteX,
              [0, swipeThreshold * 1.6],
              [1, 0.97],
              Extrapolation.CLAMP
            ),
          },
        ],
      };
    }

    const swipeProgress = interpolate(
      absoluteX,
      [0, swipeThreshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    const promotionOwner = promotionOwnerCardId.get();
    const isPromotionOwner = promotionOwner === card.id;
    const isPromotingStack = promotionOwner !== null;

    if (position === 1) {
      const dragProgress = isPromotionOwner ? 1 : isPromotingStack ? 0 : swipeProgress;
      const promotion = isPromotionOwner ? promotionProgress.get() : 0;
      const previewTranslateY = interpolate(
        dragProgress,
        [0, 1],
        [BackCardTranslateY, ActiveBackCardTranslateY],
        Extrapolation.CLAMP
      );
      const previewScale = interpolate(
        dragProgress,
        [0, 1],
        [BackCardScale, ActiveBackCardScale],
        Extrapolation.CLAMP
      );

      return {
        transform: [
          { translateY: previewTranslateY * (1 - promotion) },
          { scale: previewScale + (1 - previewScale) * promotion },
        ],
      };
    }

    const isTrailingPromotionOwner = trailingPromotionOwnerCardId.get() === card.id;
    const trailingBaseProgress = swipeProgress * DeepCardDragLag;
    const trailingProgress = isTrailingPromotionOwner
      ? DeepCardDragLag + (1 - DeepCardDragLag) * promotionProgress.get()
      : isPromotingStack
        ? 0
        : trailingBaseProgress;
    const previewTranslateY = interpolate(
      trailingProgress,
      [0, 1],
      [DeepCardTranslateY, BackCardTranslateY],
      Extrapolation.CLAMP
    );
    const previewScale = interpolate(
      trailingProgress,
      [0, 1],
      [DeepCardScale, BackCardScale],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY: previewTranslateY },
        { scale: previewScale },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={position === 0 ? 'auto' : 'none'}
      style={[
        styles.cardLayer,
        {
          width: cardWidth,
          height: cardHeight,
          zIndex: getCardLayerZIndex(position),
        },
        layerStyle,
      ]}>
      <View style={styles.cardClip}>
        <SlackCardFace
          card={card}
          cardHeight={cardHeight}
          isAnswerVisible={position === 0 && isAnswerVisible}
          isPreview={position !== 0}
          onToggleAnswer={position === 0 ? onToggleAnswer : undefined}
        />
        {position === 0 && (
          <DecisionOverlay
            cardId={card.id}
            swipeThreshold={swipeThreshold}
            swipeOwnerCardId={swipeOwnerCardId}
            translateX={translateX}
          />
        )}
      </View>
    </Animated.View>
  );
});

function LabHeader({
  dueCount,
  onUndo,
  rightAccessory,
  undoDisabled,
}: {
  dueCount: number;
  onUndo: () => void;
  rightAccessory?: ReactNode;
  undoDisabled: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="直前の判定を取り消す"
        disabled={undoDisabled}
        onPress={onUndo}
        style={({ pressed }) => [
          styles.headerIconButton,
          { opacity: undoDisabled ? 0.36 : pressed ? 0.7 : 1 },
        ]}>
        <SymbolView
          name={{
            ios: 'arrow.uturn.backward',
            android: 'undo',
            web: 'undo',
          }}
          size={22}
          tintColor={LabColors.bodyText}
          fallback={
            <ThemedText style={styles.headerFallbackIcon}>
              ←
            </ThemedText>
          }
        />
      </Pressable>

      <View pointerEvents="none" style={styles.headerCenter}>
        <ThemedText style={styles.leftCount} selectable>
          残り {dueCount}
        </ThemedText>
      </View>

      <View style={styles.headerRightSlot}>
        {rightAccessory ?? <View style={styles.headerIconButtonPlaceholder} />}
      </View>
    </View>
  );
}

const SlackCardFace = memo(function SlackCardFace({
  card,
  cardHeight,
  isAnswerVisible,
  isPreview = false,
  onToggleAnswer,
}: {
  card: PracticeCard;
  cardHeight: number;
  isAnswerVisible: boolean;
  isPreview?: boolean;
  onToggleAnswer?: () => void;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechPlaybackLeaseRef = useRef<AudioPlaybackLease | null>(null);
  const speechPlaybackIdRef = useRef(0);
  const speechFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechPlaybackKey = useMemo(() => `english-tts:${card.id}`, [card.id]);
  const flipAccessibilityLabel = isAnswerVisible ? '日本語を表示する' : '英語を表示する';
  const cardBodyText = isAnswerVisible ? card.english : card.japanese;
  const answerBodyMaxLines = Math.max(
    4,
    Math.floor(
      (cardHeight - Spacing.three * 2 - AnswerSoundControlSize * 2) /
        AnswerTextMetrics.lineHeight
    )
  );
  const cardBodyMaxLines = isAnswerVisible ? Math.min(7, answerBodyMaxLines) : 8;
  const cardBodyTextStyle = isAnswerVisible ? styles.answerText : styles.promptText;

  const clearSpeechFallbackTimeout = useCallback(() => {
    if (speechFallbackTimeoutRef.current) {
      clearTimeout(speechFallbackTimeoutRef.current);
      speechFallbackTimeoutRef.current = null;
    }
  }, []);

  const finishSpeechPlayback = useCallback(
    (playbackId: number) => {
      if (speechPlaybackIdRef.current !== playbackId) {
        return;
      }

      clearSpeechFallbackTimeout();
      speechPlaybackLeaseRef.current?.finish();
      speechPlaybackLeaseRef.current = null;
      setIsSpeaking(false);
    },
    [clearSpeechFallbackTimeout]
  );

  const scheduleSpeechFallbackTimeout = useCallback(
    (playbackId: number, text: string) => {
      clearSpeechFallbackTimeout();
      speechFallbackTimeoutRef.current = setTimeout(() => {
        if (speechPlaybackIdRef.current !== playbackId) {
          return;
        }

        void Speech.stop();
        finishSpeechPlayback(playbackId);
      }, estimateEnglishSpeechFallbackMs(text));
    },
    [clearSpeechFallbackTimeout, finishSpeechPlayback]
  );

  const cancelEnglishSpeechPlayback = useCallback(() => {
    speechPlaybackIdRef.current += 1;
    clearSpeechFallbackTimeout();
    speechPlaybackLeaseRef.current?.cancel();
    speechPlaybackLeaseRef.current = null;
    void stopSpeechSafely();
  }, [clearSpeechFallbackTimeout]);

  const stopEnglishSpeech = useCallback(() => {
    cancelEnglishSpeechPlayback();
    setIsSpeaking(false);
  }, [cancelEnglishSpeechPlayback]);

  useEffect(() => {
    if (isPreview) {
      return;
    }

    return registerAudioPlaybackStopper(speechPlaybackKey, () => {
      cancelEnglishSpeechPlayback();
      setIsSpeaking(false);
    });
  }, [cancelEnglishSpeechPlayback, isPreview, speechPlaybackKey]);

  useEffect(() => {
    if (isPreview) {
      return;
    }

    if (!isAnswerVisible) {
      cancelEnglishSpeechPlayback();
      const frameId = requestAnimationFrame(() => {
        setIsSpeaking(false);
      });

      return () => {
        cancelAnimationFrame(frameId);
      };
    }
  }, [cancelEnglishSpeechPlayback, isAnswerVisible, isPreview]);

  useEffect(() => {
    if (isPreview) {
      return;
    }

    return () => {
      cancelEnglishSpeechPlayback();
    };
  }, [cancelEnglishSpeechPlayback, card.id, isPreview]);

  const startEnglishSpeechPlayback = useCallback(
    async (playbackId: number, text: string) => {
      const playbackLease = await beginExclusiveAudioPlayback({
        delayMs: EnglishSpeechStartDelayMs,
        key: speechPlaybackKey,
      });

      if (!playbackLease) {
        return;
      }

      speechPlaybackLeaseRef.current = playbackLease;

      if (speechPlaybackIdRef.current !== playbackId || !playbackLease.isCurrent()) {
        playbackLease.cancel();
        return;
      }

      Speech.speak(text, {
        language: 'en-US',
        rate: 0.9,
        pitch: 1,
        volume: 1,
        onDone: () => finishSpeechPlayback(playbackId),
        onStopped: () => finishSpeechPlayback(playbackId),
        onError: () => finishSpeechPlayback(playbackId),
      });
    },
    [finishSpeechPlayback, speechPlaybackKey]
  );

  const handleSpeakPress = useCallback(() => {
    if (isSpeaking) {
      stopEnglishSpeech();
      return;
    }

    const playbackId = speechPlaybackIdRef.current + 1;
    speechPlaybackIdRef.current = playbackId;
    clearSpeechFallbackTimeout();
    setIsSpeaking(true);
    scheduleSpeechFallbackTimeout(playbackId, card.english);

    void startEnglishSpeechPlayback(playbackId, card.english).catch(() => {
      requestAnimationFrame(() => {
        if (speechPlaybackIdRef.current !== playbackId) {
          return;
        }

        finishSpeechPlayback(playbackId);
      });
    });
  }, [
    card.english,
    clearSpeechFallbackTimeout,
    finishSpeechPlayback,
    isSpeaking,
    scheduleSpeechFallbackTimeout,
    startEnglishSpeechPlayback,
    stopEnglishSpeech,
  ]);
  const handleLocalRecordingPlayStart = useCallback(() => {
    speechPlaybackIdRef.current += 1;
    clearSpeechFallbackTimeout();
    speechPlaybackLeaseRef.current?.cancel();
    speechPlaybackLeaseRef.current = null;
    setIsSpeaking(false);
  }, [clearSpeechFallbackTimeout]);
  const backgroundTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!isPreview && typeof onToggleAnswer === 'function')
        .maxDistance(8)
        .maxDuration(260)
        .onEnd((_event, success) => {
          if (success && onToggleAnswer) {
            runOnJS(onToggleAnswer)();
          }
        }),
    [isPreview, onToggleAnswer]
  );
  const contentTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!isPreview && typeof onToggleAnswer === 'function')
        .maxDistance(8)
        .maxDuration(260)
        .onEnd((_event, success) => {
          if (success && onToggleAnswer) {
            runOnJS(onToggleAnswer)();
          }
        }),
    [isPreview, onToggleAnswer]
  );

  return (
    <View style={styles.cardFace}>
      <GestureDetector gesture={backgroundTapGesture}>
        <View collapsable={false} style={styles.cardFlipTapBackground} />
      </GestureDetector>

      <View pointerEvents="box-none" style={styles.cardContent}>
        <View pointerEvents="box-none" style={styles.cardContentSurface}>
          <GestureDetector gesture={contentTapGesture}>
            <View
              accessible={!isPreview}
              accessibilityRole="button"
              accessibilityLabel={flipAccessibilityLabel}
              onAccessibilityTap={onToggleAnswer}
              style={[
                styles.answerTouchArea,
                isAnswerVisible ? styles.answerTouchAreaWithSoundControls : null,
              ]}>
              <ThemedText
                style={cardBodyTextStyle}
                adjustsFontSizeToFit
                minimumFontScale={0.88}
                numberOfLines={cardBodyMaxLines}
                selectable>
                {cardBodyText}
              </ThemedText>
            </View>
          </GestureDetector>

          {!isPreview && isAnswerVisible ? (
            <View pointerEvents="box-none" style={styles.answerSoundRow}>
              <LocalRecordingPlayButton
                diaryEntryId={card.diaryEntryId}
                audioStartSec={card.audioStartSec}
                audioEndSec={card.audioEndSec}
                size={AnswerSoundControlSize}
                iconSize={18}
                backgroundColor={LabColors.cardTint}
                activeBackgroundColor={LabColors.mint}
                borderColor={LabColors.bodyText}
                tintColor={LabColors.text}
                activeTintColor={LabColors.bodyText}
                onPlayStart={handleLocalRecordingPlayStart}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="英語を読み上げる"
                hitSlop={8}
                onPress={handleSpeakPress}
                style={[
                  styles.soundButton,
                  {
                    backgroundColor: isSpeaking ? LabColors.mint : LabColors.cardTint,
                  },
                ]}>
                <SymbolView
                  name={{
                    ios: isSpeaking ? 'pause.fill' : 'speaker.wave.2.fill',
                    android: isSpeaking ? 'pause' : 'volume_up',
                    web: isSpeaking ? 'pause' : 'volume_up',
                  }}
                  size={18}
                  tintColor={LabColors.text}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

function DecisionButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'keep' | 'read';
  onPress: () => void;
}) {
  const isRead = tone === 'read';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.decisionButton,
        isRead ? styles.readButton : styles.keepButton,
        { opacity: pressed ? 0.76 : 1 },
      ]}>
      <SymbolView
        name={{
          ios: isRead ? 'checkmark.circle.fill' : 'arrow.counterclockwise.circle.fill',
          android: isRead ? 'check_circle' : 'replay_circle_filled',
          web: isRead ? 'check_circle' : 'replay_circle_filled',
        }}
        size={20}
        tintColor={LabColors.bodyText}
      />
      <ThemedText style={styles.decisionButtonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function DecisionOverlay({
  cardId,
  swipeThreshold,
  swipeOwnerCardId,
  translateX,
}: {
  cardId: string;
  swipeThreshold: number;
  swipeOwnerCardId: SharedValue<string | null>;
  translateX: SharedValue<number>;
}) {
  const overlaySurfaceStyle = useAnimatedStyle(() => {
    const x = swipeOwnerCardId.get() === cardId ? translateX.get() : 0;
    const absoluteX = Math.abs(x);

    return {
      opacity: interpolate(absoluteX, [16, swipeThreshold], [0, 0.92], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        x,
        [-swipeThreshold, 0, swipeThreshold],
        [LabColors.keepOverlay, 'rgba(255, 255, 255, 0)', LabColors.readOverlay]
      ),
    };
  });
  const keepLabelStyle = useAnimatedStyle(() => {
    const x = swipeOwnerCardId.get() === cardId ? translateX.get() : 0;

    return {
      opacity: interpolate(x, [-swipeThreshold, -28], [1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            x,
            [-swipeThreshold, 0],
            [0, 22],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });
  const readLabelStyle = useAnimatedStyle(() => {
    const x = swipeOwnerCardId.get() === cardId ? translateX.get() : 0;

    return {
      opacity: interpolate(x, [28, swipeThreshold], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            x,
            [0, swipeThreshold],
            [-22, 0],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={styles.decisionOverlay}>
      <Animated.View style={[styles.decisionOverlaySurface, overlaySurfaceStyle]} />
      <Animated.View style={[styles.overlayLabel, styles.keepOverlayLabel, keepLabelStyle]}>
        <DecisionProgressIcon
          cardId={cardId}
          direction="keep"
          progressColor={LabColors.keepOverlay}
          swipeOwnerCardId={swipeOwnerCardId}
          swipeThreshold={swipeThreshold}
          translateX={translateX}>
          <SymbolView
            name={{
              ios: 'arrow.counterclockwise',
              android: 'replay',
              web: 'replay',
            }}
            size={32}
            tintColor={LabColors.keepOverlay}
          />
        </DecisionProgressIcon>
        <ThemedText style={styles.overlayText}>
          もう一回
        </ThemedText>
      </Animated.View>

      <Animated.View style={[styles.overlayLabel, styles.readOverlayLabel, readLabelStyle]}>
        <DecisionProgressIcon
          cardId={cardId}
          direction="read"
          progressColor={LabColors.readOverlay}
          swipeOwnerCardId={swipeOwnerCardId}
          swipeThreshold={swipeThreshold}
          translateX={translateX}>
          <SymbolView
            name={{
              ios: 'checkmark',
              android: 'check',
              web: 'check',
            }}
            size={36}
            tintColor={LabColors.readOverlay}
          />
        </DecisionProgressIcon>
        <ThemedText style={styles.overlayText}>
          言えた
        </ThemedText>
      </Animated.View>
    </View>
  );
}

function DecisionProgressIcon({
  cardId,
  children,
  direction,
  progressColor,
  swipeOwnerCardId,
  swipeThreshold,
  translateX,
}: {
  cardId: string;
  children: ReactNode;
  direction: 'keep' | 'read';
  progressColor: string;
  swipeOwnerCardId: SharedValue<string | null>;
  swipeThreshold: number;
  translateX: SharedValue<number>;
}) {
  const directionSign = direction === 'keep' ? -1 : 1;
  const animatedRingProps = useAnimatedProps(() => {
    const x = swipeOwnerCardId.get() === cardId ? translateX.get() : 0;
    const dragDistance = Math.max(0, x * directionSign);
    const progressRange = Math.max(1, swipeThreshold - DecisionRingStartOffset);
    const progress = Math.max(
      0,
      Math.min(1, (dragDistance - DecisionRingStartOffset) / progressRange)
    );

    return {
      strokeDashoffset: DecisionRingCircumference * (1 - progress),
    };
  });

  return (
    <View style={styles.overlayIcon}>
      <Svg
        width={DecisionRingSize}
        height={DecisionRingSize}
        viewBox={`0 0 ${DecisionRingSize} ${DecisionRingSize}`}
        style={styles.overlayProgressRing}>
        <Circle
          cx={DecisionRingCenter}
          cy={DecisionRingCenter}
          r={DecisionRingRadius}
          fill="none"
          stroke={LabColors.ringTrack}
          strokeWidth={DecisionRingStrokeWidth}
        />
        <AnimatedCircle
          cx={DecisionRingCenter}
          cy={DecisionRingCenter}
          r={DecisionRingRadius}
          animatedProps={animatedRingProps}
          fill="none"
          stroke={progressColor}
          strokeDasharray={`${DecisionRingCircumference} ${DecisionRingCircumference}`}
          strokeLinecap="round"
          strokeWidth={DecisionRingStrokeWidth}
          transform={`rotate(-90 ${DecisionRingCenter} ${DecisionRingCenter})`}
        />
      </Svg>
      <View style={styles.overlayIconContent}>{children}</View>
    </View>
  );
}

function isPendingDismissalActive(
  cardId: string,
  pendingDismissals: PendingDismissals,
  cardStatuses: Record<string, CardLearningProgress | undefined>
) {
  const pendingDismissal = pendingDismissals[cardId];

  if (!pendingDismissal) {
    return false;
  }

  const lastReviewedAt = cardStatuses[cardId]?.lastReviewedAt;

  if (!lastReviewedAt) {
    return true;
  }

  const lastReviewedTime = new Date(lastReviewedAt).getTime();
  const dismissedTime = new Date(pendingDismissal.dismissedAt).getTime();

  return (
    Number.isNaN(lastReviewedTime) ||
    Number.isNaN(dismissedTime) ||
    lastReviewedTime < dismissedTime
  );
}

function getCardLayerZIndex(position: number) {
  return VisibleCardCount + 1 - position;
}

function estimateEnglishSpeechFallbackMs(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSpeechMs = wordCount * 460 + EnglishSpeechFallbackPaddingMs;

  return Math.min(
    EnglishSpeechFallbackMaxMs,
    Math.max(EnglishSpeechFallbackMinMs, estimatedSpeechMs)
  );
}

const LabColors = {
  white: '#FFFFFF',
  bodyText: '#111111',
  text: '#111111',
  mutedText: '#5F6670',
  subtleText: '#717274',
  cardTint: '#FFF6E7',
  coral: '#FF7661',
  keepOverlay: '#FF7661',
  mint: '#2FDD6C',
  mintSoft: '#E9F7EE',
  ringTrack: 'rgba(17, 17, 17, 0.16)',
  readOverlay: '#2FDD6C',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  embeddedRoot: {
    minHeight: 0,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    gap: Spacing.three,
  },
  embeddedContent: {
    minHeight: 0,
  },
  header: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  headerIconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: LabColors.bodyText,
    backgroundColor: LabColors.white,
    zIndex: 1,
  },
  headerIconButtonPlaceholder: {
    width: 48,
    height: 48,
  },
  headerRightSlot: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerFallbackIcon: {
    color: LabColors.bodyText,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: 800,
  },
  headerCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftCount: {
    color: LabColors.bodyText,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  reviewBody: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    minHeight: 360,
    maxHeight: 620,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  embeddedStage: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
  },
  cardStack: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLayer: {
    position: 'absolute',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: LabColors.bodyText,
    backgroundColor: LabColors.white,
  },
  cardClip: {
    flex: 1,
    borderRadius: 19.5,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: LabColors.white,
  },
  cardFace: {
    flex: 1,
    position: 'relative',
    backgroundColor: LabColors.white,
  },
  cardContent: {
    flex: 1,
    position: 'relative',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  cardFlipTapBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardContentSurface: {
    flex: 1,
    zIndex: 1,
  },
  answerTouchArea: {
    flex: 1,
    justifyContent: 'center',
  },
  answerTouchAreaWithSoundControls: {
    paddingTop: AnswerSoundControlSize,
  },
  promptText: {
    color: LabColors.text,
    fontSize: PromptTextMetrics.fontSize,
    lineHeight: PromptTextMetrics.lineHeight,
    fontWeight: 900,
  },
  answerText: {
    color: LabColors.text,
    fontSize: AnswerTextMetrics.fontSize,
    lineHeight: AnswerTextMetrics.lineHeight,
    fontWeight: 900,
  },
  soundButton: {
    width: AnswerSoundControlSize,
    height: AnswerSoundControlSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: LabColors.bodyText,
  },
  answerSoundRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: Spacing.two,
  },
  decisionOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
  },
  decisionOverlaySurface: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
  },
  overlayLabel: {
    position: 'absolute',
    top: Spacing.four,
    gap: Spacing.two,
  },
  keepOverlayLabel: {
    right: Spacing.four,
    alignItems: 'flex-end',
  },
  readOverlayLabel: {
    left: Spacing.four,
    alignItems: 'flex-start',
  },
  overlayIcon: {
    width: DecisionRingSize,
    height: DecisionRingSize,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: LabColors.white,
  },
  overlayProgressRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlayIconContent: {
    zIndex: 1,
  },
  overlayText: {
    color: LabColors.bodyText,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: 900,
  },
  reviewFooter: {
    width: '100%',
    gap: Spacing.four,
    zIndex: 4,
  },
  embeddedReviewFooter: {
    paddingTop: Spacing.two,
  },
  footerAccessory: {
    width: '100%',
  },
  actionBar: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  decisionButton: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  keepButton: {
    borderWidth: 3,
    borderColor: LabColors.bodyText,
    backgroundColor: LabColors.coral,
  },
  readButton: {
    borderWidth: 3,
    borderColor: LabColors.bodyText,
    backgroundColor: LabColors.mint,
  },
  decisionButtonText: {
    color: LabColors.bodyText,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 900,
  },
  doneStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePanel: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: LabColors.bodyText,
    backgroundColor: LabColors.white,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  doneIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: LabColors.mintSoft,
  },
  doneTitle: {
    color: LabColors.text,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 900,
  },
  doneText: {
    color: LabColors.mutedText,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 700,
  },
});
