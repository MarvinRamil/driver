import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';
import type {
  PayMongoOnboarding,
  PayMongoOnboardingDetailsInput,
} from '../types';

interface UsePayMongoOnboardingReturn {
  data: PayMongoOnboarding | null;
  isLoading: boolean;
  isWorking: boolean;
  error: string | null;
  /** Opens the wallet and returns the identity-verification link to hand the driver. */
  start: () => Promise<string | null>;
  activate: (details: PayMongoOnboardingDetailsInput) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Drives PayMongo wallet setup for the signed-in driver.
 *
 * `start` and `activate` are kept separate from `refresh` via `isWorking` so a background status
 * poll cannot blank the screen while the driver is mid-action.
 */
export function usePayMongoOnboarding(): UsePayMongoOnboardingReturn {
  const { user } = useAuth();
  const [data, setData] = useState<PayMongoOnboarding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id || user.role !== 'Driver') {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setData(await payMongoOnboardingService.getStatus(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet setup status');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const start = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return null;

    setIsWorking(true);
    setError(null);
    try {
      const result = await payMongoOnboardingService.start(user.id);
      setData(result);
      return result.verificationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start wallet setup');
      return null;
    } finally {
      setIsWorking(false);
    }
  }, [user]);

  const activate = useCallback(
    async (details: PayMongoOnboardingDetailsInput): Promise<boolean> => {
      if (!user?.id) return false;

      setIsWorking(true);
      setError(null);
      try {
        const result = await payMongoOnboardingService.activate(user.id, details);
        setData(result);
        // Activation can succeed while the wallet is not yet addressable, in which case the driver
        // is not finished - reporting success there would show them a wallet nothing can pay into.
        return result.walletReady;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to finish wallet setup');
        return false;
      } finally {
        setIsWorking(false);
      }
    },
    [user]
  );

  return { data, isLoading, isWorking, error, start, activate, refresh };
}
