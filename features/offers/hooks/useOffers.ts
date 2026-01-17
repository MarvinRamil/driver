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

export function useOffers(): UseOffersReturn {
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await offerService.getPendingOffers();
      setOffers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch offers';
      setError(errorMessage);
      console.error('Error fetching offers:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    // Poll for new offers every 5 seconds
    const interval = setInterval(fetchOffers, 5000);
    return () => clearInterval(interval);
  }, [fetchOffers]);

  return {
    offers,
    isLoading,
    error,
    refresh: fetchOffers,
    acceptOffer,
    rejectOffer,
  };
}

