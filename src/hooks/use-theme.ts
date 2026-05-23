/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useResolvedColorScheme } from '@/hooks/use-theme-preference';

export function useTheme() {
  const theme = useResolvedColorScheme();

  return Colors[theme];
}
