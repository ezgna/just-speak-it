import type { TranslationCard, TranslationCardGroup } from '@/lib/backend/practice';
import type { CardLearningStatus } from '@/lib/card-learning-statuses';

export type PracticeCard = TranslationCard & {
  diaryTitle: string;
  diaryCreatedAt: string;
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
      diaryTitle: group.title,
      diaryCreatedAt: group.createdAt,
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

export function formatPracticeSource(source: TranslationCardGroup['source']) {
  return source === 'text' ? 'テキスト' : '音声';
}
