import { useAuth } from '@/features/auth';
import { useCallback, useState } from 'react';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';
import type { BeeWalletTopUpQr } from '../types';

interface UseBeeWalletTopUpQrReturn {
  data: BeeWalletTopUpQr | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  /** Drops the fetched QR so the next open starts clean rather than flashing the previous one. */
  reset: () => void;
}

/**
 * The driver's BeeWallet top-up QR.
 *
 * Fetched on demand rather than on mount: most visits to the wallet screen are not a top-up, and
 * generating a QR is a call to PayMongo every time.
 */
export function useBeeWalletTopUpQr(): UseBeeWalletTopUpQrReturn {
  const { user } = useAuth();
  const [data, setData] = useState<BeeWalletTopUpQr | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      setData(await payMongoOnboardingService.getBeeWalletTopUpQr(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your top-up QR code');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, load, reset };
}
