import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { apiClient } from "@/shared/services/apiClient";
import { clerkTokenCache } from "@/shared/services/clerkTokenCache";

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Feeds Clerk's session token to the API client. Rendered only inside ClerkProvider,
 * so useAuth() is always valid here. On unmount it clears the provider, reverting
 * the API client to the legacy token path.
 */
function ClerkApiTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    apiClient.setClerkTokenProvider(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => apiClient.setClerkTokenProvider(null);
  }, [getToken]);
  return null;
}

/**
 * Mounts Clerk only when a publishable key is configured. Until then this is a
 * pass-through, so the app keeps running on the existing AuthContext with no
 * behaviour change. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env to enable Clerk.
 */
export function AppClerkProvider({ children }: { children: ReactNode }) {
  if (!PUBLISHABLE_KEY) {
    if (__DEV__) {
      console.log("[Clerk] No EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY set — Clerk disabled.");
    }
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={clerkTokenCache}>
      <ClerkApiTokenBridge />
      {children}
    </ClerkProvider>
  );
}

/** True when Clerk is configured (publishable key present). */
export const isClerkEnabled = !!PUBLISHABLE_KEY;
