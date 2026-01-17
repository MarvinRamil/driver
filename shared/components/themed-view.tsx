import { View, type ViewProps } from "react-native";

import { useThemeColor } from "@/shared/hooks/use-theme-color";

/**
 * Props for ThemedView component
 * Extends ViewProps with theme color overrides
 */
export type ThemedViewProps = ViewProps & {
  /** Light mode background color override */
  lightColor?: string;
  /** Dark mode background color override */
  darkColor?: string;
};

/**
 * Themed view component that automatically adapts background color to light/dark mode
 * @param props - ThemedView component props
 */
export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "background"
  );

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}

