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
  formatPracticeSource,
  StatusPriority,
  type PracticeCard,
} from '@/lib/practice-cards';

type SlackFlashcardLabProps = {
  groups: TranslationCardGroup[];
  safeAreaInsets: EdgeInsets;
};

type UndoEntry = {
  card: PracticeCard;
  previousProgress: CardLearningProgress | undefined;
};

type PendingDismissals = Record<string, { dismissedAt: string }>;

const SpringConfig = {
  damping: 18,
  stiffness: 190,
};
const PromotionSpringConfig = {
  damping: 13,
  stiffness: 180,
  mass: 0.72,
};
const VisibleCardCount = 2;
const DecisionCommitDelayMs = 34;

function SlackCardLayer({
  card,
  cardHeight,
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
  cardHeight: number;
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
  const cardStyle = useAnimatedStyle(() => {
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
          [LabColors.keepBlue, 'rgba(255, 255, 255, 0.54)', LabColors.green]
        ),
        opacity:
          isOutgoing
            ? 0
            : interpolate(
                activeAbsoluteX,
                [0, swipeThreshold * 1.6],
                [1, 0.94],
                Extrapolation.CLAMP
              ),
        transform: [
          { translateX: activeX },
          { translateY: activeY },
          {
            rotate: `${interpolate(
              activeX,
              [-swipeThreshold * 1.6, 0, swipeThreshold * 1.6],
              [-9, 0, 9],
              Extrapolation.CLAMP
            )}deg`,
          },
          {
            scale: interpolate(
              activeAbsoluteX,
              [0, swipeThreshold * 1.5],
              [1, 0.975],
              Extrapolation.CLAMP
            ),
          },
        ],
      };
    }

    const isPromotionOwner = promotionOwnerCardId.get() === card.id;
    const shouldPreviewSwipe = promotionOwnerCardId.get() === null;
    const swipePreviewProgress = interpolate(
      shouldPreviewSwipe || isPromotionOwner ? absoluteX : 0,
      [0, swipeThreshold * 0.3, swipeThreshold],
      [0, 0.45, 0.9],
      Extrapolation.CLAMP
    );
    const promotion = isPromotionOwner ? promotionProgress.get() : 0;
    const revealProgress = Math.max(swipePreviewProgress, promotion);

    return {
      opacity: interpolate(revealProgress, [0, 0.2, 1], [0, 0.44, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(
            revealProgress,
            [0, 1, 1.12],
            [34, 0, -5],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            revealProgress,
            [0, 1, 1.12],
            [0.94, 1, 1.025],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={position === 0 && !isOutgoing ? 'auto' : 'none'}
      style={[
        styles.cardLayer,
        position === 0 ? styles.frontCardLayer : styles.nextCardLayer,
        {
          width: cardWidth,
          height: cardHeight,
        },
        cardStyle,
      ]}>
      <SlackCardFace
        card={card}
        isAnswerVisible={position === 0 && isAnswerVisible && !isOutgoing}
        isPreview={position !== 0 || isOutgoing}
        onToggleAnswer={position === 0 && !isOutgoing ? onToggleAnswer : undefined}
      />
      {position === 0 && (
        <DecisionOverlay
          cardId={card.id}
          swipeThreshold={swipeThreshold}
          swipeOwnerCardId={swipeOwnerCardId}
          translateX={translateX}
        />
      )}
    </Animated.View>
  );
}

export function SlackFlashcardLab({ groups, safeAreaInsets }: SlackFlashcardLabProps) {
  const { width, height } = useWindowDimensions();
  const { cardStatuses, restoreCardProgress, setCardStatus } = useCardLearningStatuses();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const promotionProgress = useSharedValue(0);
  const swipeOwnerCardId = useSharedValue<string | null>(null);
  const promotionOwnerCardId = useSharedValue<string | null>(null);
  const isDecisionAnimating = useSharedValue(false);
  const [pendingDismissals, setPendingDismissals] = useState<PendingDismissals>({});
  const [frontPinnedCard, setFrontPinnedCard] = useState<PracticeCard | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [outgoingCardId, setOutgoingCardId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  const horizontalPadding =
    Math.max(safeAreaInsets.left, Spacing.three) +
    Math.max(safeAreaInsets.right, Spacing.three);
  const verticalReservedSpace =
    safeAreaInsets.top + safeAreaInsets.bottom + BottomTabInset + 260;
  const cardWidth = Math.min(width - horizontalPadding, 560);
  const cardHeight = Math.min(Math.max(height - verticalReservedSpace, 340), 520);
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
  const [visualQueueOverride, setVisualQueueOverride] = useState<PracticeCard[] | null>(null);
  const [displayDueCountOverride, setDisplayDueCountOverride] = useState<number | null>(null);
  const visualQueue = visualQueueOverride ?? displayQueue;
  const displayDueCount = displayDueCountOverride ?? displayQueue.length;
  const visibleCards = useMemo(
    () => visualQueue.slice(0, VisibleCardCount),
    [visualQueue]
  );
  const activeCard = visibleCards[0] ?? null;
  const promotedCardId = visibleCards[1]?.id ?? null;
  const activeCardId = activeCard?.id ?? null;

  const resetPosition = useCallback(() => {
    translateX.set(0);
    translateY.set(0);
    promotionProgress.set(0);
    swipeOwnerCardId.set(null);
    promotionOwnerCardId.set(null);
  }, [promotionOwnerCardId, promotionProgress, swipeOwnerCardId, translateX, translateY]);

  useEffect(() => {
    if (isDecisionAnimating.get()) {
      return;
    }

    if (swipeOwnerCardId.get() && swipeOwnerCardId.get() !== activeCardId) {
      resetPosition();
    }
  }, [activeCardId, isDecisionAnimating, resetPosition, swipeOwnerCardId]);

  const handleToggleAnswerPress = useCallback(() => {
    setIsAnswerVisible((currentValue) => !currentValue);
  }, []);

  const completeDecision = useCallback(
    (status: CardLearningStatus) => {
      if (!activeCard) {
        resetPosition();
        isDecisionAnimating.set(false);
        return;
      }

      const decidedCard = activeCard;
      const dismissedAt = new Date().toISOString();
      const nextVisualQueue = visualQueue.filter((card) => card.id !== decidedCard.id);

      unstable_batchedUpdates(() => {
        setVisualQueueOverride(nextVisualQueue);
        setOutgoingCardId(null);
        setIsAnswerVisible(false);
      });

      setTimeout(() => {
        resetPosition();

        unstable_batchedUpdates(() => {
          setDisplayDueCountOverride(nextVisualQueue.length);
          setUndoStack((currentStack) => [
            ...currentStack.slice(-4),
            {
              card: decidedCard,
              previousProgress: cardStatuses[decidedCard.id],
            },
          ]);
          setPendingDismissals((currentDismissals) => ({
            ...currentDismissals,
            [decidedCard.id]: { dismissedAt },
          }));
          setFrontPinnedCard(null);
          setCardStatus(decidedCard.id, status);
        });

        isDecisionAnimating.set(false);

        setTimeout(() => {
          setVisualQueueOverride(null);
          setDisplayDueCountOverride(null);
        }, DecisionCommitDelayMs);
      }, DecisionCommitDelayMs);
    },
    [activeCard, cardStatuses, isDecisionAnimating, resetPosition, setCardStatus, visualQueue]
  );

  const animateDecision = useCallback(
    (status: CardLearningStatus) => {
      if (!activeCardId || isDecisionAnimating.get()) {
        return;
      }

      isDecisionAnimating.set(true);

      const direction = status === 'known' ? 1 : -1;

      swipeOwnerCardId.set(activeCardId);
      promotionOwnerCardId.set(null);
      promotionProgress.set(0);
      translateX.set(
        withTiming(direction * swipeOutDistance, { duration: 210 }, (finished) => {
          if (finished) {
            runOnJS(setOutgoingCardId)(activeCardId);
            if (promotedCardId) {
              promotionOwnerCardId.set(promotedCardId);
              promotionProgress.set(0);
              promotionProgress.set(
                withSpring(1, PromotionSpringConfig, (promoted) => {
                  if (promoted) {
                    runOnJS(completeDecision)(status);
                  }
                })
              );
            } else {
              runOnJS(completeDecision)(status);
            }
          }
        })
      );
      translateY.set(withTiming(status === 'known' ? -16 : 16, { duration: 210 }));
    },
    [
      activeCardId,
      completeDecision,
      isDecisionAnimating,
      promotionOwnerCardId,
      promotedCardId,
      promotionProgress,
      swipeOutDistance,
      swipeOwnerCardId,
      translateX,
      translateY,
    ]
  );

  const handleUndoPress = useCallback(() => {
    const undoEntry = undoStack[undoStack.length - 1];

    if (!undoEntry) {
      return;
    }

    const restoredCard = cardsById.get(undoEntry.card.id) ?? undoEntry.card;
    unstable_batchedUpdates(() => {
      isDecisionAnimating.set(false);
      resetPosition();
      setOutgoingCardId(null);
      setVisualQueueOverride(null);
      setDisplayDueCountOverride(null);
      setPendingDismissals((currentDismissals) => {
        if (!(undoEntry.card.id in currentDismissals)) {
          return currentDismissals;
        }

        const nextDismissals = { ...currentDismissals };
        delete nextDismissals[undoEntry.card.id];
        return nextDismissals;
      });
      setFrontPinnedCard(restoredCard);
      setUndoStack((currentStack) => currentStack.slice(0, -1));
      setIsAnswerVisible(false);
      restoreCardProgress(undoEntry.card.id, undoEntry.previousProgress);
    });
  }, [cardsById, isDecisionAnimating, resetPosition, restoreCardProgress, undoStack]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onBegin(() => {
          if (activeCardId) {
            swipeOwnerCardId.set(activeCardId);
            promotionOwnerCardId.set(null);
            promotionProgress.set(0);
          }
        })
        .onUpdate((event) => {
          translateX.set(event.translationX);
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
            translateY.set(withSpring(0, SpringConfig));
            promotionOwnerCardId.set(null);
            promotionProgress.set(0);
            return;
          }

          const status = event.translationX > 0 ? 'known' : 'learning';
          const direction = status === 'known' ? 1 : -1;

          if (isDecisionAnimating.get()) {
            return;
          }

          isDecisionAnimating.set(true);
          translateX.set(
            withTiming(direction * swipeOutDistance, { duration: 210 }, (finished) => {
              if (finished) {
                if (activeCardId) {
                  runOnJS(setOutgoingCardId)(activeCardId);
                }
                if (promotedCardId) {
                  promotionOwnerCardId.set(promotedCardId);
                  promotionProgress.set(0);
                  promotionProgress.set(
                    withSpring(1, PromotionSpringConfig, (promoted) => {
                      if (promoted) {
                        runOnJS(completeDecision)(status);
                      }
                    })
                  );
                } else {
                  runOnJS(completeDecision)(status);
                }
              }
            })
          );
          translateY.set(withTiming(event.translationY * 0.32, { duration: 210 }));
        }),
    [
      activeCardId,
      completeDecision,
      isDecisionAnimating,
      promotionOwnerCardId,
      promotedCardId,
      promotionProgress,
      swipeOutDistance,
      swipeOwnerCardId,
      swipeThreshold,
      translateX,
      translateY,
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
                  size={44}
                  tintColor={LabColors.green}
                />
              </View>
              <ThemedText style={styles.doneTitle} selectable>
                今日の復習は完了です
              </ThemedText>
              <ThemedText style={styles.doneText} selectable>
                次に復習日が来たカードから、このインボックスに戻ってきます。
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
          dueCount={displayDueCount}
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

        <View style={styles.actionBar}>
          <DecisionButton
            label="もう一回"
            tone="keep"
            onPress={() => animateDecision('learning')}
          />
          <DecisionButton
            label="言えた"
            tone="read"
            onPress={() => animateDecision('known')}
          />
        </View>
      </View>
    </Animated.View>
  );
}

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

function SlackCardFace({
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
        <View style={styles.messageMetaRow}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              英
            </ThemedText>
          </View>
          <View style={styles.messageMetaText}>
            <View style={styles.authorLine}>
              <ThemedText style={styles.authorName} numberOfLines={1} selectable>
                Daily to English
              </ThemedText>
              <ThemedText style={styles.messageTime} selectable>
                {formatShortTime(card.diaryCreatedAt)}
              </ThemedText>
            </View>
            <ThemedText style={styles.diaryTitle} numberOfLines={1} selectable>
              {formatPracticeDate(card.diaryCreatedAt)} ・ {formatPracticeSource(card.source)}
            </ThemedText>
          </View>
          {!isPreview && isAnswerVisible && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="英語を読み上げる"
              onPress={handleSpeakPress}
              style={({ pressed }) => [
                styles.headerSoundButton,
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
          )}
        </View>

        <TapToFlipArea
          accessibilityLabel={isAnswerVisible ? '日本語カード' : '英語カード'}
          disabled={isPreview || !onToggleAnswer}
          onPress={onToggleAnswer}>
          <ThemedText
            style={isAnswerVisible ? styles.answerText : styles.promptText}
            numberOfLines={isAnswerVisible ? 6 : 8}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            selectable>
            {isAnswerVisible ? card.english : card.japanese}
          </ThemedText>
        </TapToFlipArea>
      </View>
    </View>
  );
}

function TapToFlipArea({
  accessibilityLabel,
  children,
  disabled,
  onPress,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  disabled: boolean;
  onPress?: () => void;
}) {
  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .maxDistance(8)
        .maxDuration(220)
        .onEnd((_event, success) => {
          if (success && onPress) {
            runOnJS(onPress)();
          }
        }),
    [disabled, onPress]
  );

  return (
    <GestureDetector gesture={tapGesture}>
      <View
        accessible={!disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        collapsable={false}
        onAccessibilityTap={disabled ? undefined : onPress}
        style={styles.messageBody}>
        {children}
      </View>
    </GestureDetector>
  );
}

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
  const overlayStyle = useAnimatedStyle(() => {
    const x = swipeOwnerCardId.get() === cardId ? translateX.get() : 0;
    const absoluteX = Math.abs(x);

    return {
      opacity: interpolate(absoluteX, [16, swipeThreshold], [0, 0.9], Extrapolation.CLAMP),
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
    <Animated.View pointerEvents="none" style={[styles.decisionOverlay, overlayStyle]}>
      <Animated.View style={[styles.overlayLabel, styles.keepOverlayLabel, keepLabelStyle]}>
        <View style={styles.overlayIcon}>
          <SymbolView
            name={{
              ios: 'arrow.counterclockwise',
              android: 'replay',
              web: 'replay',
            }}
            size={33}
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
    </Animated.View>
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

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const LabColors = {
  plum: '#4B154E',
  white: '#FFFFFF',
  text: '#1D1C1D',
  mutedText: '#616061',
  subtleText: '#717274',
  line: '#E6E2E8',
  cardTint: '#F3F4F6',
  keepBlue: '#2D6FB5',
  keepOverlay: '#3678BD',
  green: '#2E8B62',
  readOverlay: '#2F8B61',
  avatar: '#F4B251',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
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
    borderWidth: 1.5,
    borderRadius: 34,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: LabColors.white,
    boxShadow: '0 22px 46px rgba(18, 8, 22, 0.28)',
  },
  nextCardLayer: {
    zIndex: 1,
    boxShadow: '0 18px 38px rgba(18, 8, 22, 0.18)',
  },
  frontCardLayer: {
    zIndex: 2,
  },
  cardFace: {
    flex: 1,
    backgroundColor: LabColors.white,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: LabColors.avatar,
  },
  avatarText: {
    color: LabColors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 900,
  },
  messageMetaText: {
    flex: 1,
    gap: Spacing.one,
  },
  headerSoundButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  authorLine: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  authorName: {
    flexShrink: 1,
    color: LabColors.text,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: 900,
  },
  messageTime: {
    color: LabColors.subtleText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  diaryTitle: {
    color: LabColors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
  messageBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  promptText: {
    color: LabColors.text,
    fontSize: 28,
    lineHeight: 38,
    fontWeight: 900,
  },
  answerText: {
    color: LabColors.text,
    fontSize: 30,
    lineHeight: 40,
    fontWeight: 900,
  },
  decisionOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
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
