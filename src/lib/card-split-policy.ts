export type CardSplitPolicy = 'meaning_unit' | 'small_steps';

export function isCardSplitPolicy(value: string | null): value is CardSplitPolicy {
  return value === 'meaning_unit' || value === 'small_steps';
}
