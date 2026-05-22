import { SymbolView } from 'expo-symbols';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  unstable_batchedUpdates,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

import { useDailyPalette } from '@/components/daily-to-english-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
  formatPracticeSource,
  StatusPriority,
  type PracticeCard,
} from '@/lib/practice-cards';

type SwipeFlashcardDeckProps = {
  groups: TranslationCardGroup[];
  feedbackX?: SharedValue<number>;
};

type SwipeUndoEntry = {
  cardId: string;
  card: PracticeCard;
  previousProgress: CardLearningProgress | undefined;
};

type PendingDismissal = {
  dismissedAt: string;
};
type PendingDismissals = Record<string, PendingDismissal>;

const SpringConfig = {
  damping: 18,
  stiffness: 190,
};
const FeedbackResetDuration = 240;
const PromotionDuration = 170;
const VisibleCardCount = 2;

export function SwipeFlashcardDeck({ groups, feedbackX }: SwipeFlashcardDeckProps) {
  const { width } = useWindowDimensions();
  const palette = useDailyPalette();
  const { cardStatuses, restoreCardProgress, setCardStatus } = useCardLearningStatuses();
  const translateX = useSharedValue(0);
  const internalFeedbackX = useSharedValue(0);
  const feedbackTranslateX = feedbackX ?? internalFeedbackX;
  const translateY = useSharedValue(0);
  const promotionProgress = useSharedValue(0);
  const swipeOwnerCardId = useSharedValue<string | null>(null);
  const promotionOwnerCardId = useSharedValue<string | null>(null);
  const cardWidth = Math.min(width - Spacing.four * 2, 560);
  const swipeThreshold = Math.max(92, cardWidth * 0.24);
  const swipeOutDistance = width + 160;

  const cards = useMemo(() => flattenTranslationCardGroups(groups), [groups]);
  const cardCounts = useMemo(() => {
    return cards.reduce(
      (counts, card) => {
        const status = getCardStatus(cardStatuses, card.id);

        if (status === 'known') {
          counts.known += 1;
        }
        if (isCardDue(cardStatuses, card.id)) {
          counts.review += 1;
        } else if (status !== 'known') {
          counts.waiting += 1;
        }

        return counts;
      },
      { review: 0, known: 0, waiting: 0 }
    );
  }, [cards, cardStatuses]);

  const flashcardQueue = useMemo(() => {
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
  const cardsById = useMemo(() => {
    return new Map(cards.map((card) => [card.id, card]));
  }, [cards]);
  const [pendingDismissals, setPendingDismissals] = useState<PendingDismissals>({});
  const [frontPinnedCard, setFrontPinnedCard] = useState<PracticeCard | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [outgoingCardId, setOutgoingCardId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SwipeUndoEntry[]>([]);
  const displayQueue = useMemo(() => {
    const availableQueue = flashcardQueue.filter(
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
  }, [cardStatuses, flashcardQueue, frontPinnedCard, pendingDismissals]);
  const activeCard = displayQueue[0] ?? null;
  const activeCardId = activeCard?.id ?? null;
  const visibleCards = useMemo(
    () => displayQueue.slice(0, VisibleCardCount),
    [displayQueue]
  );
  const promotedCardId = visibleCards[1]?.id ?? null;

  const resetCardTranslation = useCallback(() => {
    translateX.set(0);
    translateY.set(0);
  }, [translateX, translateY]);

  const resetCardPosition = useCallback(() => {
    resetCardTranslation();
    feedbackTranslateX.set(0);
    promotionProgress.set(0);
    swipeOwnerCardId.set(null);
    promotionOwnerCardId.set(null);
  }, [
    feedbackTranslateX,
    promotionOwnerCardId,
    promotionProgress,
    resetCardTranslation,
    swipeOwnerCardId,
  ]);

  useEffect(() => {
    if (swipeOwnerCardId.get() && swipeOwnerCardId.get() !== activeCardId) {
      resetCardPosition();
    }
  }, [activeCardId, resetCardPosition, swipeOwnerCardId]);

  const handleToggleAnswerPress = useCallback(() => {
    setIsAnswerVisible((currentValue) => !currentValue);
  }, []);

  const markCardAsOutgoing = useCallback((cardId: string) => {
    setOutgoingCardId(cardId);
  }, []);

  const completeSwipe = useCallback(
    (status: CardLearningStatus) => {
      if (!activeCard) {
        resetCardPosition();
        return;
      }

      const dismissedAt = new Date().toISOString();

      unstable_batchedUpdates(() => {
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
        setOutgoingCardId(null);
        setIsAnswerVisible(false);
        setCardStatus(activeCard.id, status);
      });
    },
    [
      activeCard,
      cardStatuses,
      resetCardPosition,
      setCardStatus,
    ]
  );

  const handleUndoPress = useCallback(() => {
    const undoEntry = undoStack[undoStack.length - 1];

    if (!undoEntry) {
      return;
    }

    const restoredCard = cardsById.get(undoEntry.cardId) ?? undoEntry.card;

    unstable_batchedUpdates(() => {
      resetCardPosition();
      setOutgoingCardId(null);
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

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          if (activeCardId) {
            swipeOwnerCardId.set(activeCardId);
            promotionOwnerCardId.set(null);
            promotionProgress.set(0);
          }
        })
        .onUpdate((event) => {
          if (activeCardId && swipeOwnerCardId.get() !== activeCardId) {
            swipeOwnerCardId.set(activeCardId);
          }
          translateX.set(event.translationX);
          feedbackTranslateX.set(event.translationX);
          translateY.set(event.translationY);
        })
        .onEnd((event) => {
          const shouldDecide =
            Math.abs(event.translationX) > swipeThreshold || Math.abs(event.velocityX) > 760;

          if (!shouldDecide) {
            translateX.set(
              withSpring(0, SpringConfig, (finished) => {
                if (finished) {
                  swipeOwnerCardId.set(null);
                }
              })
            );
            feedbackTranslateX.set(withTiming(0, { duration: FeedbackResetDuration }));
            translateY.set(withSpring(0, SpringConfig));
            promotionOwnerCardId.set(null);
            promotionProgress.set(0);
            return;
          }

          const status = event.translationX > 0 ? 'known' : 'learning';
          const direction = status === 'known' ? 1 : -1;

          feedbackTranslateX.set(withTiming(direction * swipeThreshold, { duration: 120 }));
          translateX.set(
            withTiming(direction * swipeOutDistance, { duration: 190 }, (finished) => {
              if (finished) {
                if (activeCardId) {
                  runOnJS(markCardAsOutgoing)(activeCardId);
                }
                feedbackTranslateX.set(withTiming(0, { duration: FeedbackResetDuration }));
                promotionOwnerCardId.set(promotedCardId);
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
      feedbackTranslateX,
      markCardAsOutgoing,
      promotionOwnerCardId,
      promotionProgress,
      promotedCardId,
      swipeOutDistance,
      swipeThreshold,
      swipeOwnerCardId,
      translateX,
      translateY,
    ]
  );

  const learningSignalStyle = useAnimatedStyle(() => {
    const signalFade = 1 - promotionProgress.get();

    return {
      opacity:
        interpolate(translateX.get(), [-swipeThreshold, -28], [0.72, 0], Extrapolation.CLAMP) *
        signalFade,
      transform: [
        {
          translateX: interpolate(
            translateX.get(),
            [-swipeThreshold, 0],
            [0, -18],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            translateX.get(),
            [-swipeThreshold, 0],
            [1.02, 0.96],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const knownSignalStyle = useAnimatedStyle(() => {
    const signalFade = 1 - promotionProgress.get();

    return {
      opacity:
        interpolate(translateX.get(), [28, swipeThreshold], [0, 0.72], Extrapolation.CLAMP) *
        signalFade,
      transform: [
        {
          translateX: interpolate(
            translateX.get(),
            [0, swipeThreshold],
            [18, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            translateX.get(),
            [0, swipeThreshold],
            [0.96, 1.02],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  if (!activeCard) {
    return (
      <View style={styles.root}>
        <View
          style={[
            styles.emptyPanel,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}>
          <ThemedText style={styles.emptyTitle} selectable>
            今日の復習は完了です。
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable>
            次の復習日が来たカードから、またここに表示されます。
          </ThemedText>
        </View>
        <UndoButton
          disabled={undoStack.length === 0}
          onPress={handleUndoPress}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <ThemedText type="code" themeColor="textSecondary" selectable>
            1 / {displayQueue.length}
          </ThemedText>
          <ThemedText style={styles.headerTitle} selectable>
            フラッシュカード
          </ThemedText>
        </View>
        <View style={styles.counterRow}>
          <CounterPill label="復習" value={cardCounts.review} tone="amber" />
          <CounterPill label="いえた" value={cardCounts.known} tone="green" />
        </View>
      </View>

      <View style={[styles.stage, { width: cardWidth }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.swipeSignal, styles.learningSignal, learningSignalStyle]}>
          <ThemedText style={[styles.swipeSignalText, { color: palette.amber }]}>
            まだ
          </ThemedText>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.swipeSignal, styles.knownSignal, knownSignalStyle]}>
          <ThemedText style={[styles.swipeSignalText, { color: palette.green }]}>
            いえた
          </ThemedText>
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <View collapsable={false} style={styles.cardStack}>
            {visibleCards.map((card, position) => (
              <FlashcardLayer
                key={card.id}
                card={card}
                cardWidth={cardWidth}
                isAnswerVisible={position === 0 && isAnswerVisible}
                isOutgoing={card.id === outgoingCardId}
                onToggleAnswer={position === 0 ? handleToggleAnswerPress : undefined}
                position={position}
                promotionOwnerCardId={promotionOwnerCardId}
                promotionProgress={promotionProgress}
                swipeOwnerCardId={swipeOwnerCardId}
                swipeThreshold={swipeThreshold}
                translateX={translateX}
                translateY={translateY}
              />
            ))}
          </View>
        </GestureDetector>
      </View>

      <UndoButton
        disabled={undoStack.length === 0}
        onPress={handleUndoPress}
      />
    </View>
  );
}

function FlashcardLayer({
  card,
  cardWidth,
  isAnswerVisible,
  isOutgoing,
  onToggleAnswer,
  position,
  promotionOwnerCardId,
  promotionProgress,
  swipeOwnerCardId,
  swipeThreshold,
  translateX,
  translateY,
}: {
  card: PracticeCard;
  cardWidth: number;
  isAnswerVisible: boolean;
  isOutgoing: boolean;
  onToggleAnswer?: () => void;
  position: number;
  promotionOwnerCardId: SharedValue<string | null>;
  promotionProgress: SharedValue<number>;
  swipeOwnerCardId: SharedValue<string | null>;
  swipeThreshold: number;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}) {
  const palette = useDailyPalette();
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
        borderColor: interpolateColor(
          activeX,
          [-swipeThreshold, 0, swipeThreshold],
          [palette.amber, palette.border, palette.green]
        ),
        opacity: isOutgoing
          ? 0
          : interpolate(activeAbsoluteX, [0, swipeThreshold * 1.4], [1, 0.9], Extrapolation.CLAMP),
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

    const isPromotionOwner = promotionOwnerCardId.get() === card.id;
    const shouldPreviewSwipe = promotionOwnerCardId.get() === null && position === 1;
    const swipeProgress = interpolate(
      shouldPreviewSwipe || isPromotionOwner ? absoluteX : 0,
      [0, swipeThreshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    const promotion = isPromotionOwner ? promotionProgress.get() : 0;
    const previewOpacity = interpolate(swipeProgress, [0, 1], [0.34, 0.78], Extrapolation.CLAMP);
    const previewTranslateY = interpolate(swipeProgress, [0, 1], [18, 8], Extrapolation.CLAMP);
    const previewScale = interpolate(swipeProgress, [0, 1], [0.94, 0.98], Extrapolation.CLAMP);

    return {
      opacity: previewOpacity + (1 - previewOpacity) * promotion,
      transform: [
        { translateY: previewTranslateY * (1 - promotion) },
        { scale: previewScale + (1 - previewScale) * promotion },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={position === 0 && !isOutgoing ? 'auto' : 'none'}
      style={[
        styles.cardLayer,
        {
          width: cardWidth,
          zIndex: getCardLayerZIndex(position),
          backgroundColor: palette.card,
          borderColor: palette.border,
          boxShadow: palette.shadow,
        },
        layerStyle,
      ]}>
      <FlashcardFace
        card={card}
        isAnswerVisible={position === 0 && isAnswerVisible && !isOutgoing}
        isPreview={position !== 0 || isOutgoing}
        onToggleAnswer={position === 0 && !isOutgoing ? onToggleAnswer : undefined}
      />
    </Animated.View>
  );
}

function UndoButton({
  disabled,
  onPress,
}: {
  disabled: boolean;
  onPress: () => void;
}) {
  const palette = useDailyPalette();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="直前の判定を取り消す"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.undoButton,
        {
          backgroundColor: palette.backgroundElement,
          borderColor: palette.border,
          opacity: disabled ? 0.36 : pressed ? 0.72 : 1,
        },
      ]}>
      <SymbolView
        name={{
          ios: 'arrow.uturn.backward',
          android: 'undo',
          web: 'undo',
        }}
        size={17}
        tintColor={palette.text}
        fallback={
          <ThemedText type="smallBold" style={{ color: palette.text }}>
            ←
          </ThemedText>
        }
      />
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        ひとつ戻る
      </ThemedText>
    </Pressable>
  );
}

function FlashcardFace({
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
  const palette = useDailyPalette();
  const [isSpeaking, setIsSpeaking] = useState(false);

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
    <>
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <ThemedText type="code" themeColor="textSecondary" selectable>
            {formatPracticeDate(card.diaryCreatedAt)} / {formatPracticeSource(card.source)}
          </ThemedText>
          <ThemedText style={styles.diaryTitle} numberOfLines={2} selectable>
            {card.diaryTitle}
          </ThemedText>
        </View>

        {!isPreview && isAnswerVisible && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="英語を読み上げる"
            hitSlop={8}
            onPress={handleSpeakPress}
            style={({ pressed }) => [
              styles.speechButton,
              {
                backgroundColor: isSpeaking ? palette.primary : palette.backgroundElement,
                borderColor: isSpeaking ? palette.primary : palette.border,
                opacity: pressed ? 0.72 : 1,
              },
            ]}>
            <SymbolView
              name={{
                ios: isSpeaking ? 'speaker.wave.3.fill' : 'speaker.wave.2.fill',
                android: isSpeaking ? 'volume_up' : 'volume_up',
                web: isSpeaking ? 'volume_up' : 'volume_up',
              }}
              size={19}
              tintColor={isSpeaking ? palette.primaryText : palette.text}
              fallback={
                <ThemedText
                  type="smallBold"
                  style={{ color: isSpeaking ? palette.primaryText : palette.text }}>
                  音
                </ThemedText>
              }
            />
          </Pressable>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isAnswerVisible ? '日本語を表示する' : '英語を表示する'}
        disabled={isPreview}
        onPress={onToggleAnswer}
        style={styles.promptArea}>
        <View>
          <ThemedText style={isAnswerVisible ? styles.answerText : styles.promptText}>
            {isAnswerVisible ? card.english : card.japanese}
          </ThemedText>
        </View>
      </Pressable>
    </>
  );
}

function CounterPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'green';
}) {
  const palette = useDailyPalette();
  const colors = tone === 'green'
    ? { backgroundColor: palette.greenSoft, borderColor: palette.green, color: palette.green }
    : { backgroundColor: palette.amberSoft, borderColor: palette.amber, color: palette.amber };

  return (
    <View
      style={[
        styles.counterPill,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
      ]}>
      <ThemedText type="code" style={{ color: colors.color }}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.counterValue, { color: colors.color }]} selectable>
        {value}
      </ThemedText>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.four,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
  },
  counterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  counterPill: {
    minWidth: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  counterValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  stage: {
    flex: 1,
    minHeight: 430,
    maxHeight: 560,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStack: {
    width: '100%',
    height: '100%',
    minHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoButton: {
    minHeight: 44,
    minWidth: 138,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  swipeSignal: {
    position: 'absolute',
    top: '43%',
    zIndex: 4,
  },
  learningSignal: {
    left: Spacing.four,
  },
  knownSignal: {
    right: Spacing.four,
  },
  swipeSignalText: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: 900,
  },
  cardLayer: {
    position: 'absolute',
    height: '100%',
    minHeight: 400,
    maxHeight: 520,
    borderWidth: 1,
    borderRadius: 28,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  cardMeta: {
    flex: 1,
    gap: Spacing.two,
  },
  speechButton: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  promptArea: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  promptText: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: 800,
  },
  answerText: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: 800,
  },
  emptyPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 800,
  },
});
