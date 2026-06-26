import type { TranslationCard, TranslationCardGroup } from '@/lib/backend/practice';
import type { CardLearningStatus } from '@/lib/card-learning-statuses';

export type PracticeCard = TranslationCard & {
  cardSplitPolicy: TranslationCardGroup['cardSplitPolicy'];
  diaryEntryId: TranslationCardGroup['diaryEntryId'];
  diaryText: string;
  diaryExcerpt: string;
  diaryCreatedAt: string;
  source: TranslationCardGroup['source'];
  translationStyle: TranslationCardGroup['translationStyle'];
};

export const StatusPriority: Record<CardLearningStatus, number> = {
  learning: 0,
  new: 1,
  known: 2,
};

export function flattenTranslationCardGroups(groups: TranslationCardGroup[]): PracticeCard[] {
  return groups.flatMap((group) =>
    group.cards.map((card) => ({
      ...card,
      cardSplitPolicy: group.cardSplitPolicy,
      diaryEntryId: group.diaryEntryId,
      diaryText: group.diaryText,
      diaryExcerpt: group.diaryExcerpt,
      diaryCreatedAt: group.createdAt,
      source: group.source,
      translationStyle: group.translationStyle,
    }))
  );
}

export function formatPracticeDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
