import React, { useEffect, useRef } from "react";
import { Animated, Easing, type DimensionValue, type ViewStyle } from "react-native";
import { useTheme } from "@/shared/hooks/use-theme";

interface SkeletonProps {
  /** Width of the placeholder bar; number (px) or percentage string */
  width?: DimensionValue;
  /** Height of the placeholder bar */
  height?: number;
  /** Corner radius; defaults to a pill-ish 6 */
  radius?: number;
  /** Render on a dark surface (e.g. the black wallet card) */
  onDark?: boolean;
  style?: ViewStyle;
}

/**
 * A single pulsing placeholder bar.
 *
 * Uses the built-in Animated API rather than reanimated: opacity is the only animated property,
 * so this runs on the native driver with no worklet/babel setup.
 */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 6,
  onDark = false,
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // Stop on unmount so navigating away mid-load doesn't leave the loop running
    return () => loop.stop();
  }, [pulse]);

  // White on the near-black wallet card needs a much lower range than theme.border does on a
  // light surface, or the bar reads as solid rather than as a placeholder.
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: onDark ? [0.12, 0.3] : [0.5, 1],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: onDark ? "#ffffff" : theme.border,
          opacity,
        },
        style,
      ]}
    />
  );
}
