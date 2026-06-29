export type TranslationStyle = 'native' | 'simple';

export const DefaultTranslationStyle: TranslationStyle = 'simple';

export function isTranslationStyle(value: string | null): value is TranslationStyle {
  return value === 'native' || value === 'simple';
}
