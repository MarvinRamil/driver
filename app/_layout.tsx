import 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth';
import { isAllowedRole } from '@/features/auth/utils/roleValidation';
import { AppClerkProvider } from '@/shared/providers/AppClerkProvider';
import { DriverStatusProvider } from '@/features/driver/context/DriverStatusContext';
import { useColorScheme } from '@/shared/hooks/use-color-scheme';
import { useNotifications } from '@/shared/hooks/useNotifications';
import { useOTAUpdates } from '@/shared/hooks/useOTAUpdates';
import { BiometricPromptManager } from '@/shared/components/BiometricPromptManager';
import { LoginAdkitPopup } from '@/shared/components/LoginAdkitPopup';

// Initialize Mapbox (required before any map renders)
import Mapbox from '@rnmapbox/maps';
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (mapboxToken) {
  Mapbox.setAccessToken(mapboxToken);
}

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

function hideSplash() {
  SplashScreen.hideAsync().catch(() => {});
}

function NavigationGuard() {
  const { user, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const isAuthenticated = user !== null;
  const hasAllowedRole = isAllowedRole(user);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    try {
      const currentRoute = segments[0];
      const inTabsGroup = currentRoute === '(tabs)';
      const isLoginPage = currentRoute === 'login';
      const isSignupPage = currentRoute === 'signup';
      const isForgotPasswordPage = currentRoute === 'forgot-password';
      const isLivenessPage = currentRoute === 'liveness';
      const isDriverCompletePage = currentRoute === 'driver-complete';

      const isDriver = user?.role === 'Driver';
      const livenessVerifiedAt =
        user?.livenessVerifiedAt ??
        (user as { LivenessVerifiedAt?: string } | null)?.LivenessVerifiedAt;
      const needsLiveness = isDriver && !user?.isOnboarded && !livenessVerifiedAt;
      const needsDriverComplete = isDriver && !user?.isOnboarded && !!livenessVerifiedAt;

      if (!isAuthenticated) {
        if (isLoginPage || isSignupPage || isForgotPasswordPage) {
          return;
        }
        router.replace('/login');
        return;
      }

      if (needsLiveness && !isLivenessPage) {
        router.replace('/liveness');
        return;
      }
      if (needsDriverComplete && !isDriverCompletePage) {
        router.replace('/driver-complete');
        return;
      }

      if (isAuthenticated && !hasAllowedRole) {
        logout().catch(console.error);
        if (!isLoginPage && !isSignupPage) {
          router.replace('/login');
        }
        return;
      }

      if (isAuthenticated && hasAllowedRole && (isLoginPage || isSignupPage)) {
        if (needsLiveness) {
          router.replace('/liveness');
          return;
        }
        if (needsDriverComplete) {
          router.replace('/driver-complete');
          return;
        }
        router.replace('/(tabs)');
        return;
      }

      if (
        isAuthenticated &&
        hasAllowedRole &&
        (inTabsGroup ||
          currentRoute === 'liveness' ||
          currentRoute === 'driver-complete' ||
          currentRoute === 'accept-booking' ||
          currentRoute === 'in-ride' ||
          currentRoute === 'rating' ||
          currentRoute === 'support' ||
          currentRoute === 'booking' ||
          currentRoute === 'complete-registration' ||
          currentRoute === 'pending-approval')
      ) {
        return;
      }
    } catch (error) {
      console.error('[NavigationGuard]', error);
    }
  }, [user, isLoading, segments, router, isAuthenticated, hasAllowedRole, logout]);

  return null;
}

export default function RootLayout() {
  // Load fonts in background — never block rendering on them (FontAwesome loads many files)
  useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    hideSplash();
    const timers = [50, 250, 1000].map((ms) => setTimeout(hideSplash, ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <AppClerkProvider>
      <SafeAreaProvider>
        <RootLayoutNav />
      </SafeAreaProvider>
    </AppClerkProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <DriverStatusProvider>
          <AppInitializer />
          <BiometricPromptManager />
          <LoginAdkitPopup />
          <NavigationGuard />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="liveness" options={{ headerShown: false }} />
            <Stack.Screen name="driver-complete" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="accept-booking" options={{ headerShown: false }} />
            <Stack.Screen name="in-ride" options={{ headerShown: false }} />
            <Stack.Screen name="rating" options={{ headerShown: false }} />
            <Stack.Screen name="support" options={{ headerShown: false }} />
            <Stack.Screen name="support/ticket/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: 'modal', title: 'Modal' }}
            />
          </Stack>
          <StatusBar style="light" />
        </DriverStatusProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppInitializer() {
  useNotifications();
  useOTAUpdates();
  return null;
}
