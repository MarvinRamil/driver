import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Alert } from "react-native";
import { HeadPoseCapture } from "@/features/liveness/components/HeadPoseCapture";
import { shiftCheckService } from "@/features/liveness/services/shiftCheckService";
import { useDriverStatusContext } from "@/features/driver/context/DriverStatusContext";

/**
 * Per-shift face check before going online. The backend matches each captured
 * frame against the driver's verified KYC reference selfie; on pass, the driver
 * is switched online and returned to the previous screen.
 */
export default function ShiftCheckScreen() {
  const router = useRouter();
  const { updateStatus } = useDriverStatusContext();

  const handleAllPassed = useCallback(async () => {
    try {
      await updateStatus(true);
    } catch (e) {
      Alert.alert(
        "Face check passed",
        "You're verified, but going online failed. Please toggle online again." +
          (e instanceof Error ? `\n\n${e.message}` : "")
      );
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [router, updateStatus]);

  return (
    <HeadPoseCapture
      title="Quick face check"
      subtitle="Before going online, confirm it's you. Take a quick selfie — we'll match it with your verified photo."
      startLabel="Start face check"
      createSession={() => shiftCheckService.createSession()}
      submitImage={(sessionId, direction, imageUri) =>
        shiftCheckService.submitImage(sessionId, direction, imageUri)
      }
      onAllPassed={handleAllPassed}
    />
  );
}
