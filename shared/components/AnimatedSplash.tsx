import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Animated "Bee On-Demand — Liquid Organic" splash.
 *
 * Recreates the HTML splash design natively: a liquid radial-gradient
 * background, blurred animated blobs, expanding ripple rings and a floating
 * glass-morphism logo. The blur/radial-gradient are faked with stacked
 * translucent circles so no extra native modules (expo-blur / -linear-gradient)
 * are required.
 *
 * The animation loops continuously and only fades out once `appReady` is true
 * (and a minimum on-screen time has elapsed so it is always seen).
 */

const COLORS = {
  background: '#ffcd36', // brand yellow — matches the native splash for a seamless handoff
  glow: '#ffdf98',
  blobA: '#ffc82c',
  blobB: '#f5bf21',
  blobC: '#ffdf98',
  ripple: '#ffdf98',
  glassBorder: 'rgba(255, 255, 255, 0.35)',
  container: 'rgba(255, 200, 44, 0.78)', // primary-container @ 80%
  onContainer: '#705400',
  outline: '#817661',
  secondary: '#5f5e5e',
};

type Props = {
  logo: ImageSourcePropType;
  /** Flip to true once the app is ready; the splash holds briefly, then fades out. */
  appReady: boolean;
  /** Minimum time the splash stays up so the animation is always seen. */
  minDurationMs?: number;
  /** Extra time to keep the splash on screen AFTER the app is ready, before fading out. */
  holdAfterReadyMs?: number;
  onHidden?: () => void;
};

/** Soft, blurred-looking circle faked with stacked translucent layers (no expo-blur needed). */
function SoftCircle({
  size,
  color,
  opacity = 0.16,
  layers = 7,
}: {
  size: number;
  color: string;
  opacity?: number;
  layers?: number;
}) {
  const items = useMemo(() => Array.from({ length: layers }), [layers]);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {items.map((_, i) => {
        const t = layers === 1 ? 1 : i / (layers - 1);
        const s = size * (0.35 + 0.65 * t);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: color,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

function Blob({
  size,
  color,
  position,
  delay,
}: {
  size: number;
  color: string;
  position: object;
  delay: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 10000, easing: Easing.linear }), -1, false)
    );
    return () => cancelAnimation(p);
  }, [delay, p]);

  const animStyle = useAnimatedStyle(() => {
    const x = interpolate(p.value, [0, 0.33, 0.66, 1], [0, 30, -20, 0]);
    const y = interpolate(p.value, [0, 0.33, 0.66, 1], [0, -50, 20, 0]);
    const scale = interpolate(p.value, [0, 0.33, 0.66, 1], [1, 1.1, 0.9, 1]);
    return { transform: [{ translateX: x }, { translateY: y }, { scale }] };
  });

  return (
    <Animated.View style={[styles.absolute, position, animStyle]} pointerEvents="none">
      <SoftCircle size={size} color={color} />
    </Animated.View>
  );
}

function Ripple({ delay, size }: { delay: number; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.bezier(0, 0.2, 0.8, 1) }),
        -1,
        false
      )
    );
    return () => cancelAnimation(p);
  }, [delay, p]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [0.8, 2.5]) }],
    opacity: interpolate(p.value, [0, 1], [0.8, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: COLORS.ripple,
        },
        animStyle,
      ]}
    />
  );
}

export function AnimatedSplash({
  logo,
  appReady,
  minDurationMs = 1600,
  holdAfterReadyMs = 1500,
  onHidden,
}: Props) {
  const { width, height } = useWindowDimensions();
  // Start fully opaque so the overlay instantly covers the screen — the native
  // splash is only hidden once this has painted (see onLayout), so there is no
  // white flash in the handoff.
  const fade = useSharedValue(1);
  const logoIntro = useSharedValue(0);
  const float = useSharedValue(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [removed, setRemoved] = useState(false);

  // Hide the native (OS) splash only after this overlay's first frame is on
  // screen, so the native splash hands off directly to the animation.
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    logoIntro.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.back(1.4)) });
    float.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    const t = setTimeout(() => setMinElapsed(true), minDurationMs);
    return () => {
      clearTimeout(t);
      cancelAnimation(fade);
      cancelAnimation(logoIntro);
      cancelAnimation(float);
    };
  }, [fade, logoIntro, float, minDurationMs]);

  const finish = () => {
    setRemoved(true);
    onHidden?.();
  };

  useEffect(() => {
    if (appReady && minElapsed) {
      // App is ready and the minimum display time has passed — keep the
      // animation on screen for an extra beat, then fade out.
      const hold = setTimeout(() => {
        fade.value = withTiming(
          0,
          { duration: 500, easing: Easing.in(Easing.quad) },
          (done) => {
            'worklet';
            if (done) runOnJS(finish)();
          }
        );
      }, holdAfterReadyMs);
      return () => clearTimeout(hold);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady, minElapsed, holdAfterReadyMs]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const floatStyle = useAnimatedStyle(() => ({
    // The logo is fully visible from the first frame (no opacity fade-in, which
    // would otherwise show a near-blank screen for ~0.6s). It only does a subtle
    // scale "pop" as it settles.
    transform: [
      { translateY: interpolate(float.value, [0, 1], [0, -20]) },
      { rotateZ: `${interpolate(float.value, [0, 1], [0, 2])}deg` },
      { scale: interpolate(logoIntro.value, [0, 1], [0.92, 1]) },
    ],
  }));

  if (removed) return null;

  const diag = Math.max(width, height);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}
    >
      {/* Radial glow background */}
      <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
        <SoftCircle size={diag * 1.15} color={COLORS.glow} opacity={0.16} layers={8} />
      </View>

      {/* Animated blobs */}
      <Blob
        size={300}
        color={COLORS.blobA}
        delay={0}
        position={{ top: -height * 0.08, left: -width * 0.18 }}
      />
      <Blob
        size={380}
        color={COLORS.blobB}
        delay={2000}
        position={{ bottom: -height * 0.12, right: -width * 0.2 }}
      />
      <Blob
        size={260}
        color={COLORS.blobC}
        delay={4000}
        position={{ top: height * 0.38, right: -width * 0.05 }}
      />

      {/* Ripple waves from center */}
      <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
        <Ripple delay={0} size={260} />
        <Ripple delay={1300} size={260} />
        <Ripple delay={2600} size={260} />
      </View>

      {/* Floating glass logo */}
      <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
        <Animated.View style={floatStyle}>
          <View style={styles.glass}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brand}>BEE ON-DEMAND</Text>
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer} pointerEvents="none">
        <Text style={styles.poweredBy}>POWERED BY</Text>
        <Text style={styles.company}>ILOCOS SCRIPT</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.background },
  absolute: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  glass: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: COLORS.container,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#775a00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  logo: { width: 96, height: 96, marginBottom: 8 },
  brand: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '200',
    color: COLORS.onContainer,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  poweredBy: { fontSize: 10, letterSpacing: 4, color: COLORS.outline, fontWeight: '200' },
  company: { fontSize: 12, letterSpacing: 2, color: COLORS.secondary, fontWeight: '300' },
});

export default AnimatedSplash;
