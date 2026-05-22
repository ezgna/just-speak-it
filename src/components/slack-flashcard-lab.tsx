import { SymbolView } from 'expo-symbols';
import * as Speech from 'expo-speech';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCardLearningStatuses } from '@/hooks/use-card-learning-statuses';
import type { TranslationCardGroup } from '@/lib/backend/practice';
import {
  getCardStatus,
  isCardDue,
  type CardLearningProgress,
  type CardLearningStatus,
} from '@/lib/card-learning-statuses';
import {
  flattenTranslationCardGroups,
  formatPracticeDate,
  StatusPriority,
  type PracticeCard,
} from '@/lib/practice-cards';

type SlackFlashcardLabProps = {
  groups: TranslationCardGroup[];
  safeAreaInsets: EdgeInsets;
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
const ActiveBackCardTranslateY = 12;
const ActiveBackCardScale = 0.985;
const DeepCardDragLag = 0.78;

export function SlackFlashcardLab({ groups, safeAreaInsets }: SlackFlashcardLabProps) {
  const { width, height } = useWindowDimensions();
  const { cardStatuses, restoreCardProgress, setCardStatus } = useCardLearningStatuses();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const promotionProgress = useSharedValue(0);
  const swipeOwnerCardId = useSharedValue<string | null>(null);
  const promotionOwnerCardId = useSharedValue<string | null>(null);
  const trailingPromotionOwnerCardId = useSharedValue<string | null>(null);
  const decisionOwnerCardId = useSharedValue<string | null>(null);
  const pendingStatusUpdatesRef = useRef<PendingStatusUpdate[]>([]);
  const [pendingDismissals, setPendingDismissals] = useState<PendingDismissals>({});
  const [pendingStatusUpdates, setPendingStatusUpdates] = useState<PendingStatusUpdate[]>([]);
  const [frontPinnedCard, setFrontPinnedCard] = useState<PracticeCard | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [visualQueue, setVisualQueue] = useState<PracticeCard[] | null>(null);
  const [pendingVisualQueueRelease, setPendingVisualQueueRelease] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  const horizontalPadding =
    Math.max(safeAreaInsets.left, Spacing.three) +
    Math.max(safeAreaInsets.right, Spacing.three);
  const verticalReservedSpace =
    safeAreaInsets.top + safeAreaInsets.bottom + BottomTabInset + 252;
  const cardWidth = Math.min(width - horizontalPadding, 560);
  const cardHeight = Math.min(Math.max(height - verticalReservedSpace, 360), 540);
  const swipeThreshold = Math.max(88, cardWidth * 0.22);
  const swipeOutDistance = width + 180;
  const rootInsets = {
    paddingTop: safeAreaInsets.top + Spacing.two,
    paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
    paddingLeft: Math.max(safeAreaInsets.left, Spacing.three),
    paddingRight: Math.max(safeAreaInsets.right, Spacing.three),
  };

  const cards = useMemo(() => flattenTranslationCardGroups(groups), [groups]);
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
  }, [
    decisionOwnerCardId,
    promotionOwnerCardId,
    promotionProgress,
    resetCardTranslation,
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
            previousProgress: cardStatuses[activeCard.id],
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
            return;
          }

          const status = event.translationX > 0 ? 'known' : 'learning';
          const direction = status === 'known' ? 1 : -1;

          if (!activeCardId) {
            return;
          }

          decisionOwnerCardId.set(activeCardId);
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
      promotedCardId,
      promotionOwnerCardId,
      promotionProgress,
      swipeOutDistance,
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
      <Animated.View style={[styles.root, rootInsets]}>
        <View style={styles.content}>
          <LabHeader
            dueCount={0}
            onUndo={handleUndoPress}
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
                  tintColor={LabColors.green}
                />
              </View>
              <ThemedText style={styles.doneTitle} selectable>
                今日の復習は完了です
              </ThemedText>
              <ThemedText style={styles.doneText} selectable>
                次に復習日が来たカードから、この実験タブに戻ってきます。
              </ThemedText>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.root, rootInsets]}>
      <View style={styles.content}>
        <LabHeader
          dueCount={displayQueue.length}
          onUndo={handleUndoPress}
          undoDisabled={undoStack.length === 0}
        />

        <View style={[styles.stage, { width: cardWidth, height: cardHeight }]}>
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
        position === 0 ? styles.frontCardLayer : styles.previewCardLayer,
        layerStyle,
      ]}>
      <View style={styles.cardClip}>
        <SlackCardFace
          card={card}
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
  undoDisabled,
}: {
  dueCount: number;
  onUndo: () => void;
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
          tintColor={LabColors.white}
          fallback={
            <ThemedText style={styles.headerFallbackIcon}>
              ←
            </ThemedText>
          }
        />
      </Pressable>

      <View style={styles.headerCenter}>
        <ThemedText style={styles.leftCount} selectable>
          残り {dueCount}
        </ThemedText>
      </View>

      <View style={styles.headerIconButtonPlaceholder} />
    </View>
  );
}

const SlackCardFace = memo(function SlackCardFace({
  card,
  isAnswerVisible,
  isPreview = false,
  onToggleAnswer,
}: {
  card: PracticeCard;
  isAnswerVisible: boolean;
  isPreview?: boolean;
  onToggleAnswer?: () => void;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const flipAccessibilityLabel = isAnswerVisible ? '日本語を表示する' : '英語を表示する';

  useEffect(() => {
    if (isPreview) {
      return;
    }

    if (!isAnswerVisible) {
      void Speech.stop();
    }
  }, [isAnswerVisible, isPreview]);

  useEffect(() => {
    if (isPreview) {
      return;
    }

    return () => {
      void Speech.stop();
    };
  }, [card.id, isPreview]);

  const handleSpeakPress = useCallback(() => {
    if (isSpeaking) {
      void Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    void Speech.stop();
    Speech.speak(card.english, {
      language: 'en-US',
      rate: 0.9,
      pitch: 1,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [card.english, isSpeaking]);

  return (
    <View style={styles.cardFace}>
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={styles.cardTopText}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle} numberOfLines={2} selectable>
                {card.diaryTitle}
              </ThemedText>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <SymbolView
                  name={{
                    ios: 'calendar',
                    android: 'calendar_today',
                    web: 'calendar_today',
                  }}
                  size={13}
                  tintColor={LabColors.subtleText}
                />
                <ThemedText style={styles.metaText} numberOfLines={1} selectable>
                  {formatPracticeDate(card.diaryCreatedAt)}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.cardTopActionSlot}>
            {!isPreview && isAnswerVisible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="英語を読み上げる"
                hitSlop={8}
                onPress={handleSpeakPress}
                style={({ pressed }) => [
                  styles.soundButton,
                  {
                    backgroundColor: isSpeaking ? LabColors.green : LabColors.cardTint,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}>
                <SymbolView
                  name={{
                    ios: isSpeaking ? 'speaker.wave.3.fill' : 'speaker.wave.2.fill',
                    android: 'volume_up',
                    web: 'volume_up',
                  }}
                  size={18}
                  tintColor={isSpeaking ? LabColors.white : LabColors.text}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={flipAccessibilityLabel}
          disabled={isPreview}
          onPress={onToggleAnswer}
          style={styles.answerTouchArea}>
          <ThemedText
            style={isAnswerVisible ? styles.answerText : styles.promptText}
            numberOfLines={isAnswerVisible ? 7 : 8}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            selectable>
            {isAnswerVisible ? card.english : card.japanese}
          </ThemedText>
        </Pressable>

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
        tintColor={isRead ? LabColors.white : LabColors.text}
      />
      <ThemedText style={[styles.decisionButtonText, { color: isRead ? LabColors.white : LabColors.text }]}>
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
        <View style={styles.overlayIcon}>
          <SymbolView
            name={{
              ios: 'arrow.counterclockwise',
              android: 'replay',
              web: 'replay',
            }}
            size={32}
            tintColor={LabColors.keepOverlay}
          />
        </View>
        <ThemedText style={styles.overlayText}>
          もう一回
        </ThemedText>
      </Animated.View>

      <Animated.View style={[styles.overlayLabel, styles.readOverlayLabel, readLabelStyle]}>
        <View style={styles.overlayIcon}>
          <SymbolView
            name={{
              ios: 'checkmark',
              android: 'check',
              web: 'check',
            }}
            size={36}
            tintColor={LabColors.readOverlay}
          />
        </View>
        <ThemedText style={styles.overlayText}>
          言えた
        </ThemedText>
      </Animated.View>
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

const LabColors = {
  plum: '#4B154E',
  white: '#FFFFFF',
  text: '#1D1C1D',
  mutedText: '#616061',
  subtleText: '#717274',
  cardTint: '#F4F4F4',
  keepOverlay: '#3678BD',
  green: '#2E8B62',
  readOverlay: '#2F8B61',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: LabColors.plum,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    gap: Spacing.three,
  },
  header: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
  },
  headerIconButtonPlaceholder: {
    width: 48,
    height: 48,
  },
  headerFallbackIcon: {
    color: LabColors.white,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: 800,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftCount: {
    color: LabColors.white,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
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
  cardStack: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLayer: {
    position: 'absolute',
    borderRadius: 34,
    borderCurve: 'continuous',
    backgroundColor: LabColors.white,
  },
  frontCardLayer: {
    boxShadow: '0 22px 46px rgba(18, 8, 22, 0.28)',
  },
  previewCardLayer: {
    borderColor: LabColors.white,
    boxShadow: '0 22px 46px rgba(18, 8, 22, 0.28)',
  },
  cardClip: {
    flex: 1,
    borderRadius: 32.5,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: LabColors.white,
  },
  cardFace: {
    flex: 1,
    backgroundColor: LabColors.white,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  cardTop: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardTopText: {
    flex: 1,
    gap: Spacing.two,
  },
  cardTopActionSlot: {
    width: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  cardTitle: {
    flex: 1,
    color: LabColors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: 900,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metaPill: {
    maxWidth: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: LabColors.cardTint,
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  metaText: {
    flexShrink: 1,
    color: LabColors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  answerTouchArea: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: Spacing.three,
  },
  promptText: {
    color: LabColors.text,
    fontSize: 29,
    lineHeight: 39,
    fontWeight: 900,
  },
  answerText: {
    color: LabColors.text,
    fontSize: 30,
    lineHeight: 40,
    fontWeight: 900,
  },
  soundButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
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
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: LabColors.white,
  },
  overlayText: {
    color: LabColors.white,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: 900,
  },
  actionBar: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.three,
    zIndex: 4,
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
    backgroundColor: LabColors.white,
  },
  readButton: {
    backgroundColor: LabColors.green,
  },
  decisionButtonText: {
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
    borderRadius: 34,
    borderCurve: 'continuous',
    backgroundColor: LabColors.white,
    padding: Spacing.four,
    gap: Spacing.three,
    boxShadow: '0 22px 46px rgba(18, 8, 22, 0.24)',
  },
  doneIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(46, 139, 98, 0.12)',
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
