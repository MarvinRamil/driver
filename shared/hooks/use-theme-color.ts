import { Colors } from '@/constants/theme';
import { useColorScheme } from './use-color-scheme';

/**
 * Hook to get theme colors based on current color scheme
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 * @param props - Object with optional light and dark color overrides
 * @param colorName - Name of the color from the theme
 * @returns The color value for the current theme
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

