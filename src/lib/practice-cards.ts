import type { TranslationCard, TranslationCardGroup } from '@/lib/backend/practice';
import type { CardLearningStatus } from '@/lib/card-learning-statuses';

export type PracticeCard = TranslationCard & {
  diaryEntryId: TranslationCardGroup['diaryEntryId'];
  diaryText: string;
  diaryExcerpt: string;
  diaryCreatedAt: string;
  generationMode: TranslationCardGroup['generationMode'];
  source: TranslationCardGroup['source'];
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
      diaryEntryId: group.diaryEntryId,
      diaryText: group.diaryText,
      diaryExcerpt: group.diaryExcerpt,
      diaryCreatedAt: group.createdAt,
      generationMode: group.generationMode,
      source: group.source,
    }))
  );
}

export function formatPracticeDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
