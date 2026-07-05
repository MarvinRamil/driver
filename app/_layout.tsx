import 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import {
  getDriverApplicationSubmitted,
  clearDriverApplicationSubmitted,
} from '@/shared/services/driverApplicationStorage';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth';
import { isAllowedRole } from '@/features/auth/utils/roleValidation';
import { AppClerkProvider } from '@/shared/providers/AppClerkProvider';
import { DriverStatusProvider } from '@/features/driver/context/DriverStatusContext';
import { AnimatedSplash } from '@/shared/components/AnimatedSplash';
import { useColorScheme } from '@/shared/hooks/use-color-scheme';
import { useNotifications } from '@/shared/hooks/useNotifications';
import { useOTAUpdates } from '@/shared/hooks/useOTAUpdates';
import { BiometricPromptManager } from '@/shared/components/BiometricPromptManager';
import { LoginAdkitPopup } from '@/shared/components/LoginAdkitPopup';

// Import images as constants for reliable bundling in release builds
const splashIcon = require('../assets/images/splash-icon.png');

// Set the Mapbox access token synchronously at module load (required before any map
// renders). Uses the build-time env token as the bootstrap; configService then hydrates
// the cached/Vault value and re-applies it (here via initialize(), and on login via
// loadRemoteConfig()) so Vault overrides the env value at runtime.
import Mapbox from '@rnmapbox/maps';
import { configService } from '@/shared/services/configService';

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (mapboxToken) {
  Mapbox.setAccessToken(mapboxToken);
}
configService.initialize();

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync().catch(() => {});
// Cross-fade the native (OS) splash into the animated splash instead of a hard
// cut, for a smoother handoff. `fade` is iOS-only; Android still cuts.
SplashScreen.setOptions({ fade: true, duration: 200 });

function hideSplash() {
  SplashScreen.hideAsync().catch(() => {});
}

function NavigationGuard() {
  const { user, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);

  const isAuthenticated = user !== null;
  const hasAllowedRole = isAllowedRole(user);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setApplicationSubmitted(false);
      return;
    }

    (async () => {
      const fromStore = await getDriverApplicationSubmitted();
      if (mounted) {
        setApplicationSubmitted(fromStore);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    try {
      // Cast: expo-router's generated route union lags behind newly added screens
      const currentRoute = segments[0] as string;
      const inTabsGroup = currentRoute === '(tabs)';
      const isLoginPage = currentRoute === 'login';
      const isSignupPage = currentRoute === 'signup';
      const isForgotPasswordPage = currentRoute === 'forgot-password';
      const isLivenessPage = currentRoute === 'liveness';
      const isApplicationPage = currentRoute === 'complete-registration';
      const isWelcomePage = currentRoute === 'welcome';

      const isDriver = user?.role === 'Driver';
      const livenessVerifiedAt =
        user?.livenessVerifiedAt ??
        (user as { LivenessVerifiedAt?: string } | null)?.LivenessVerifiedAt;
      const needsLiveness = isDriver && !user?.isOnboarded && !livenessVerifiedAt;
      const needsApplication =
        isDriver && !user?.isOnboarded && !!livenessVerifiedAt && !applicationSubmitted;
      const needsWelcome =
        isDriver && !user?.isOnboarded && !!livenessVerifiedAt && applicationSubmitted;

      if (!isAuthenticated) {
        if (isLoginPage || isSignupPage || isForgotPasswordPage) {
          return;
        }
        router.replace('/login');
        return;
      }

      if (user?.isOnboarded) {
        clearDriverApplicationSubmitted().catch(() => {});
      }

      if (needsLiveness && !isLivenessPage) {
        router.replace('/liveness');
        return;
      }
      if (needsApplication && !isApplicationPage && !isWelcomePage) {
        router.replace('/complete-registration');
        return;
      }
      // Allow the application page too: rejected drivers navigate from /welcome to
      // /complete-registration to resubmit. The form itself redirects drivers whose
      // application is not rejected back to /welcome.
      if (needsWelcome && !isWelcomePage && !isApplicationPage) {
        router.replace('/welcome');
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
        if (needsApplication) {
          router.replace('/complete-registration');
          return;
        }
        if (needsWelcome) {
          router.replace('/welcome');
          return;
        }
        router.replace('/(tabs)');
        return;
      }

      if (isAuthenticated && hasAllowedRole && isForgotPasswordPage) {
        if (needsLiveness) {
          router.replace('/liveness');
          return;
        }
        if (needsApplication) {
          router.replace('/complete-registration');
          return;
        }
        if (needsWelcome) {
          router.replace('/welcome');
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
          currentRoute === 'welcome' ||
          currentRoute === 'accept-booking' ||
          currentRoute === 'in-ride' ||
          currentRoute === 'rating' ||
          currentRoute === 'support' ||
          currentRoute === 'booking' ||
          currentRoute === 'referrals' ||
          currentRoute === 'complete-registration')
      ) {
        return;
      }
    } catch (error) {
      console.error('[NavigationGuard]', error);
    }
  }, [
    user,
    isLoading,
    segments,
    router,
    isAuthenticated,
    hasAllowedRole,
    logout,
    applicationSubmitted,
  ]);

  return null;
}

export default function RootLayout() {
  // Load fonts in background — never block rendering on them (FontAwesome loads many files)
  useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // The native splash is hidden by AnimatedSplash (inside SafeAreaProvider) once
  // it has actually painted — hiding it eagerly here would expose a white flash
  // during SafeAreaProvider's first-frame inset measurement. This timer is only
  // a safety net in case the splash component never mounts.
  useEffect(() => {
    const fallback = setTimeout(hideSplash, 3000);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <AppClerkProvider>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#ffcd36' }}>
        <RootLayoutNav />
      </SafeAreaProvider>
    </AppClerkProvider>
  );
}

/**
 * Animated in-app splash overlay. Lives inside AuthProvider so it can loop
 * until the auth session has finished resolving, then fades itself out.
 */
function SplashGate() {
  const { isLoading } = useAuth();
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <AnimatedSplash
      logo={splashIcon}
      appReady={!isLoading}
      onHidden={() => setShow(false)}
    />
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
            <Stack.Screen name="complete-registration" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="accept-booking" options={{ headerShown: false }} />
            <Stack.Screen name="in-ride" options={{ headerShown: false }} />
            <Stack.Screen name="rating" options={{ headerShown: false }} />
            <Stack.Screen name="referrals" options={{ headerShown: false }} />
            <Stack.Screen name="support" options={{ headerShown: false }} />
            <Stack.Screen name="support/ticket/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: 'modal', title: 'Modal' }}
            />
          </Stack>
          <StatusBar style="light" />
          <SplashGate />
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
