import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { useAuth } from "@/features/auth";
import { livenessService } from "@/features/liveness";
import { HeadPoseCapture } from "@/features/liveness/components/HeadPoseCapture";

/**
 * Face liveness verification (legacy fallback) during driver onboarding.
 * Used when the hosted KYC provider is unavailable (see kyc-verification.tsx);
 * runs before document submission.
 */
export default function LivenessScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleAllPassed = useCallback(async () => {
    await refreshUser?.();
    router.replace("/complete-registration");
  }, [refreshUser, router]);

  return (
    <HeadPoseCapture
      title="Verify your identity"
      subtitle="We need to confirm you're a real person. You'll take a few photos with your front camera."
      createSession={() => livenessService.createSession()}
      submitImage={(sessionId, direction, imageUri) =>
        livenessService.submitImage(sessionId, direction, imageUri)
      }
      onAllPassed={handleAllPassed}
    />
  );
}
