import { useCallback, useEffect, useRef, useState } from 'react';
import { offerService } from '../services/offerService';
import type { DriverOffer } from '../types';

const RATE_LIMIT_BACKOFF_MS = 2 * 60 * 1000;  // 2 minutes
const RATE_LIMIT_POLL_MS = 30 * 1000;         // poll every 30s while in backoff

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

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) return (err as { status?: number }).status === 429;
  if (err && typeof err === 'object' && 'details' in err) {
    const d = (err as { details?: { statusCode?: number } }).details;
    return d?.statusCode === 429;
  }
  return false;
}

export function useOffers(options: UseOffersOptions = {}): UseOffersReturn {
  const { limit = 3, pollingInterval = 5000 } = options;
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitBackoffUntil, setRateLimitBackoffUntil] = useState<number | null>(null);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOffers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await offerService.getPendingOffers(limit);
      setOffers(data);
    } catch (err) {
      if (isRateLimitError(err)) {
        const until = Date.now() + RATE_LIMIT_BACKOFF_MS;
        setRateLimitBackoffUntil(until);
        setError('Too many requests. Slowing down; you’ll still receive offers.');
        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
        backoffTimerRef.current = setTimeout(() => {
          setRateLimitBackoffUntil(null);
          setError(null);
        }, RATE_LIMIT_BACKOFF_MS);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch offers';
        setError(errorMessage);
      }
      console.error('[useOffers] Error fetching offers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => () => {
    if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
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

  const isInBackoff = rateLimitBackoffUntil !== null && Date.now() < rateLimitBackoffUntil;
  const effectiveInterval = isInBackoff ? RATE_LIMIT_POLL_MS : pollingInterval;

  useEffect(() => {
    fetchOffers();
    if (effectiveInterval <= 0) return;
    const interval = setInterval(fetchOffers, effectiveInterval);
    return () => clearInterval(interval);
  }, [fetchOffers, effectiveInterval]);

  return {
    offers,
    isLoading,
    error,
    refresh: fetchOffers,
    acceptOffer,
    rejectOffer,
  };
}

