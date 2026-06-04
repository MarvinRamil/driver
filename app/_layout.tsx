import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';

// Import images as constants for reliable bundling in release builds
const splashIcon = require('../assets/images/splash-icon.png');
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeeColors, BRAND_YELLOW } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth';
import { isAllowedRole, getRoleRestrictionMessage } from '@/features/auth/utils/roleValidation';
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
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'welcome',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/**
 * Navigation guard component
 * Handles protected routes and redirects based on authentication state
 * Ensures unauthenticated users are redirected to login immediately
 * Also enforces role restrictions - only allows:
 * Only role "Driver" is accepted. All drivers are independent (no company/tenant).
 */
function NavigationGuard() {
  const { user, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  // Check if user is authenticated (user !== null)
  const isAuthenticated = user !== null;
  // Check if user has an allowed role
  const hasAllowedRole = isAllowedRole(user);

  useEffect(() => {
    // Don't navigate while loading auth state
    if (isLoading) {
      return;
    }

    try {
      const currentRoute = segments[0];
      const inTabsGroup = currentRoute === "(tabs)";
      const isWelcomePage = currentRoute === "welcome";
      const isLoginPage = currentRoute === "login";
      const isSignupPage = currentRoute === "signup";
      const isForgotPasswordPage = currentRoute === "forgot-password";
      const isLivenessPage = currentRoute === "liveness";
      const isDriverCompletePage = currentRoute === "driver-complete";

      // Driver onboarding: after email verification, require liveness then document submit
      const isDriver = user?.role === "Driver";
      const livenessVerifiedAt = user?.livenessVerifiedAt ?? (user as { LivenessVerifiedAt?: string } | null)?.LivenessVerifiedAt;
      const needsLiveness = isDriver && !user?.isOnboarded && !livenessVerifiedAt;
      const needsDriverComplete = isDriver && !user?.isOnboarded && !!livenessVerifiedAt;

      // If no user, redirect to welcome (pre-login entry point)
      if (!isAuthenticated) {
        if (isWelcomePage || isLoginPage || isSignupPage || isForgotPasswordPage) {
          return;
        }
        router.replace("/welcome");
        return;
      }

      // Driver onboarding: redirect to liveness or driver-complete if needed
      if (needsLiveness && !isLivenessPage) {
        router.replace("/liveness");
        return;
      }
      if (needsDriverComplete && !isDriverCompletePage) {
        router.replace("/driver-complete");
        return;
      }

      // ROLE RESTRICTION: If user is authenticated but doesn't have an allowed role,
      // log them out and redirect to login
      if (isAuthenticated && !hasAllowedRole) {
        console.warn('[NavigationGuard] User has unauthorized role:', user?.role);
        
        // Logout user to clear session
        logout().catch((err) => {
          console.error('[NavigationGuard] Error during logout:', err);
        });
        
        if (!isWelcomePage && !isLoginPage && !isSignupPage) {
          router.replace("/welcome");
        }
        return;
      }

      // If user is authenticated with allowed role and on welcome, login, or signup, redirect (tabs or onboarding)
      if (isAuthenticated && hasAllowedRole && (isWelcomePage || isLoginPage || isSignupPage)) {
        if (needsLiveness) {
          router.replace("/liveness");
          return;
        }
        if (needsDriverComplete) {
          router.replace("/driver-complete");
          return;
        }
        router.replace("/(tabs)");
        return;
      }

      // If user is authenticated with allowed role and in tabs or other protected routes, allow access
      if (
        isAuthenticated &&
        hasAllowedRole &&
        (inTabsGroup ||
         currentRoute === "liveness" ||
         currentRoute === "driver-complete" ||
         currentRoute === "accept-booking" ||
         currentRoute === "in-ride" ||
         currentRoute === "rating" ||
         currentRoute === "support" ||
         currentRoute === "booking" ||
         currentRoute === "complete-registration" ||
         currentRoute === "pending-approval")
      ) {
        // User is authenticated with allowed role and accessing protected routes - allow
        return;
      }
    } catch (error) {
      console.error('Error in NavigationGuard:', error);
      // Fallback: try to navigate to login on error
      try {
        const currentRoute = segments[0];
        const isLoginPage = currentRoute === "login";
        const isSignupPage = currentRoute === "signup";
        const isForgotPasswordPage = currentRoute === "forgot-password";
        const isWelcomePage = currentRoute === "welcome";
        if (!isWelcomePage && !isLoginPage && !isSignupPage && !isForgotPasswordPage) {
          router.replace("/welcome");
        }
      } catch (navError) {
        console.error('Error navigating to login in NavigationGuard:', navError);
      }
    }
  }, [user, isLoading, segments, router, isAuthenticated, hasAllowedRole, logout]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

const IN_APP_SPLASH_DURATION_MS = 2200;

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [showInAppSplash, setShowInAppSplash] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => setShowInAppSplash(false), IN_APP_SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <DriverStatusProvider>
            <AppInitializer />
            <BiometricPromptManager />
            <LoginAdkitPopup />
            <NavigationGuard />
            <View style={styles.root}>
              <Stack>
                <Stack.Screen name="welcome" options={{ headerShown: false }} />
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
              {showInAppSplash && (
                <View style={styles.inAppSplash} pointerEvents="box-none">
                  <View style={styles.inAppSplashContent}>
                    <Image
                      source={splashIcon}
                      style={styles.inAppSplashLogo}
                      contentFit="contain"
                    />
                    <Text style={styles.inAppSplashText}>BEE ON-DEMAND</Text>
                  </View>
                  <Text style={[styles.inAppSplashFooter, { bottom: 40 + insets.bottom }]}>
                    Made with ❤️ by Ilocos Script I.T. Solutions
                  </Text>
                </View>
              )}
            </View>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </DriverStatusProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inAppSplash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND_YELLOW,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inAppSplashContent: {
    alignItems: 'center',
    gap: 16,
  },
  inAppSplashLogo: {
    width: 120,
    height: 120,
  },
  inAppSplashText: {
    fontSize: 26,
    fontWeight: '700',
    color: BeeColors.gray[900],
    letterSpacing: 2,
  },
  inAppSplashFooter: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    fontWeight: '500',
    color: BeeColors.gray[700],
    textAlign: 'center',
  },
});

/**
 * Check API health on app load and log to console.
 * Uses EXPO_PUBLIC_API_URL + /health (same base works for staging and production).
 */
function checkApiHealth() {
  const base = process.env.EXPO_PUBLIC_API_URL || '';
  if (!base) {
    console.log('[API Health] No EXPO_PUBLIC_API_URL set, skipping health check');
    return;
  }
  const url = `${base.replace(/\/+$/, '')}/health`;
  console.log('[API Health] Checking:', url);
  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      console.log('[API Health] Response:', JSON.stringify(data, null, 2));
    })
    .catch((err) => {
      console.warn('[API Health] Failed:', url, err?.message ?? err);
    });
}

/**
 * Component to initialize app services (notifications, OTA updates)
 */
function AppInitializer() {
  useNotifications();
  useOTAUpdates();
  useEffect(() => {
    checkApiHealth();
  }, []);
  return null;
}
