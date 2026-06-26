export type TranslationStyle = 'native' | 'simple';

export function isTranslationStyle(value: string | null): value is TranslationStyle {
  return value === 'native' || value === 'simple';
}
