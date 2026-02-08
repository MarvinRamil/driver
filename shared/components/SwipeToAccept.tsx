import React, { useRef, useEffect } from 'react';
import { View, Animated, PanResponder, StyleSheet, type ViewStyle } from 'react-native';
import { ThemedText } from './themed-text';
import { Ionicons } from '@expo/vector-icons';

const THUMB_SIZE = 44;
const TRACK_HEIGHT = 48;
const THRESHOLD_RATIO = 0.75; // trigger accept when thumb passes 75% of track

interface SwipeToAcceptProps {
  label?: string;
  onAccept: () => void | Promise<void>;
  disabled?: boolean;
  trackColor?: string;
  thumbColor?: string;
  textColor?: string;
  style?: ViewStyle;
}

export function SwipeToAccept({
  label = 'Swipe to accept',
  onAccept,
  disabled = false,
  trackColor = '#e0e0e0',
  thumbColor = '#FFCD36',
  textColor = '#333',
  style,
}: SwipeToAcceptProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const trackWidth = useRef(0);
  const maxDrag = useRef(0);
  const hasTriggered = useRef(false);

  const reset = () => {
    hasTriggered.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !hasTriggered.current,
      onMoveShouldSetPanResponder: () => !disabled && !hasTriggered.current,
      onPanResponderGrant: () => {
        if (hasTriggered.current) return;
        translateX.setOffset(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (hasTriggered.current) return;
        const max = maxDrag.current;
        const dx = Math.max(0, Math.min(gestureState.dx, max));
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (hasTriggered.current) return;
        const max = maxDrag.current;
        const threshold = max * THRESHOLD_RATIO;
        if (gestureState.dx >= threshold && max > 0) {
          hasTriggered.current = true;
          Animated.timing(translateX, {
            toValue: max,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            Promise.resolve(onAccept()).finally(() => reset());
          });
        } else {
          reset();
        }
        translateX.flattenOffset();
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: trackColor, height: TRACK_HEIGHT, opacity: disabled ? 0.6 : 1 },
        style,
      ]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        trackWidth.current = w;
        maxDrag.current = Math.max(0, w - THUMB_SIZE - 8);
      }}>
      <ThemedText style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </ThemedText>
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: thumbColor,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}>
        <Ionicons name="chevron-forward" size={24} color="#333" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    paddingLeft: 6,
    paddingRight: 6,
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  thumb: {
    position: 'absolute',
    left: 4,
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
