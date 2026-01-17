import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import { Image } from 'expo-image';
import { BeeColors, BRAND_YELLOW } from '@/constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animate logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate after animation
    const timer = setTimeout(() => {
      try {
        if (!isLoading) {
          if (isAuthenticated) {
            router.replace('/(tabs)');
          } else {
            router.replace('/login');
          }
        }
      } catch (error) {
        console.error('Error navigating from splash screen:', error);
        // Fallback to login on error
        try {
          router.replace('/login');
        } catch (navError) {
          console.error('Error navigating to login:', navError);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        <Image
          source={require('@/assets/images/adaptive-icon.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.appName}>
          ON-DEMAND
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_YELLOW,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 120,
    height: 120,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: BeeColors.gray[900], // Same dark text as login screen
    letterSpacing: 2,
  },
});

