import { useCallback, useEffect, useState } from 'react';
import { offerService } from '../services/offerService';
import type { DriverOffer } from '../types';

interface UseOffersReturn {
  offers: DriverOffer[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  acceptOffer: (offerId: string) => Promise<void>;
  rejectOffer: (offerId: string) => Promise<void>;
}

interface UseOffersOptions {
  /** Maximum number of offers to fetch (default: 3, max: 10) */
  limit?: number;
  /** Polling interval in milliseconds (default: 5000, set to 0 to disable) */
  pollingInterval?: number;
}

export function useOffers(options: UseOffersOptions = {}): UseOffersReturn {
  const { limit = 3, pollingInterval = 5000 } = options;
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await offerService.getPendingOffers(limit);
      setOffers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch offers';
      setError(errorMessage);
      console.error('[useOffers] Error fetching offers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const acceptOffer = useCallback(
    async (offerId: string) => {
      try {
        await offerService.acceptOffer(offerId);
        // Remove accepted offer from list
        setOffers((prev) => prev.filter((offer) => offer.id !== offerId));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept offer';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const rejectOffer = useCallback(
    async (offerId: string) => {
      try {
        await offerService.rejectOffer(offerId);
        // Remove rejected offer from list
        setOffers((prev) => prev.filter((offer) => offer.id !== offerId));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to reject offer';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    fetchOffers();
    // Poll for new offers if polling interval is set
    if (pollingInterval > 0) {
      const interval = setInterval(fetchOffers, pollingInterval);
    return () => clearInterval(interval);
    }
  }, [fetchOffers, pollingInterval]);

  return {
    offers,
    isLoading,
    error,
    refresh: fetchOffers,
    acceptOffer,
    rejectOffer,
  };
}

