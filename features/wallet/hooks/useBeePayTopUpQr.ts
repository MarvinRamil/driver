import { useAuth } from '@/features/auth';
import { useCallback, useState } from 'react';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';
import type { BeePayTopUpQr } from '../types';

interface UseBeePayTopUpQrReturn {
  data: BeePayTopUpQr | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

/**
 * The driver's BeePay top-up QR.
 *
 * Fetched on demand rather than on mount: most visits to the wallet screen are not a top-up, and
 * generating a QR is a call to PayMongo every time.
 */
export function useBeePayTopUpQr(): UseBeePayTopUpQrReturn {
  const { user } = useAuth();
  const [data, setData] = useState<BeePayTopUpQr | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      setData(await payMongoOnboardingService.getBeePayTopUpQr(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your top-up QR code');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return { data, isLoading, error, load };
}
