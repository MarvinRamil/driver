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
import { isAllowedRole, getRoleRestrictionMessage } from '@/features/auth/utils/roleValidation';
import { DriverStatusProvider } from '@/features/driver/context/DriverStatusContext';
import { useColorScheme } from '@/shared/hooks/use-color-scheme';
import { useNotifications } from '@/shared/hooks/useNotifications';
import { useOTAUpdates } from '@/shared/hooks/useOTAUpdates';
import { BiometricPromptManager } from '@/shared/components/BiometricPromptManager';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'login',
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
      const isLoginPage = currentRoute === "login";
      const isSignupPage = currentRoute === "signup";
      const isLivenessPage = currentRoute === "liveness";
      const isDriverCompletePage = currentRoute === "driver-complete";

      // Driver onboarding: after email verification, require liveness then document submit
      const isDriver = user?.role === "Driver";
      const livenessVerifiedAt = user?.livenessVerifiedAt ?? (user as { LivenessVerifiedAt?: string } | null)?.LivenessVerifiedAt;
      const needsLiveness = isDriver && !user?.isOnboarded && !livenessVerifiedAt;
      const needsDriverComplete = isDriver && !user?.isOnboarded && !!livenessVerifiedAt;

      // CRITICAL: If no user, redirect to login immediately
      // This ensures home page never loads when there's no authenticated user
      if (!isAuthenticated) {
        // If already on login or signup page, stay there
        if (isLoginPage || isSignupPage) {
          return;
        }
        // Otherwise, redirect to login
        router.replace("/login");
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
      // log them out and redirect to login with error message
      if (isAuthenticated && !hasAllowedRole) {
        console.warn('[NavigationGuard] User has unauthorized role:', user?.role);
        
        // Logout user to clear session
        logout().catch((err) => {
          console.error('[NavigationGuard] Error during logout:', err);
        });
        
        // Redirect to login
        if (!isLoginPage && !isSignupPage) {
          router.replace("/login");
        }
        return;
      }

      // If user is authenticated with allowed role and on login or signup page, redirect (tabs or onboarding)
      if (isAuthenticated && hasAllowedRole && (isLoginPage || isSignupPage)) {
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
        if (!isLoginPage && !isSignupPage) {
          router.replace("/login");
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

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <DriverStatusProvider>
            <AppInitializer />
            <BiometricPromptManager />
            <NavigationGuard />
          <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="liveness" options={{ headerShown: false }} />
            <Stack.Screen name="driver-complete" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="accept-booking" options={{ headerShown: false }} />
            <Stack.Screen name="in-ride" options={{ headerShown: false }} />
            <Stack.Screen name="rating" options={{ headerShown: false }} />
            <Stack.Screen name="support" options={{ headerShown: false }} />
            <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: 'modal', title: 'Modal' }}
            />
          </Stack>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </DriverStatusProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

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
