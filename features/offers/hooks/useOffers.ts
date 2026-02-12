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
  
  // Track polling interval and whether polling should continue
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldPollRef = useRef<boolean>(true);

  /** @param silent - if true, do not set loading state (used for background polling so the page doesn't show refresh spinner) */
  const fetchOffers = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = await offerService.getPendingOffers(limit);
      setOffers(data);
      setError(null);
      shouldPollRef.current = true;
    } catch (err) {
      if (isRateLimitError(err)) {
        const until = Date.now() + RATE_LIMIT_BACKOFF_MS;
        setRateLimitBackoffUntil(until);
        setError('Too many requests. Slowing down; you\'ll still receive offers.');
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
      shouldPollRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      console.log('[useOffers] Polling stopped due to error. User must manually refresh.');
    } finally {
      if (!silent) setIsLoading(false);
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

  // Manual refresh (shows loading spinner). User pull-to-refresh or explicit refresh.
  const refresh = useCallback(async () => {
    await fetchOffers(false);
    if (pollingInterval > 0 && shouldPollRef.current && !pollingIntervalRef.current) {
      pollingIntervalRef.current = setInterval(() => {
        if (shouldPollRef.current) {
          fetchOffers(true);
        } else {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }, pollingInterval);
    }
  }, [fetchOffers, pollingInterval]);

  const isInBackoff = rateLimitBackoffUntil !== null && Date.now() < rateLimitBackoffUntil;
  const effectiveInterval = isInBackoff ? RATE_LIMIT_POLL_MS : pollingInterval;

  useEffect(() => {
    // Initial fetch (show loading)
    fetchOffers(false);

    // Background polling: do not set loading so the page doesn't show refresh spinner
    // Use effectiveInterval (slower when rate limited)
    if (effectiveInterval > 0 && shouldPollRef.current) {
      pollingIntervalRef.current = setInterval(() => {
        if (shouldPollRef.current) {
          fetchOffers(true);
        } else {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }, effectiveInterval);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchOffers, effectiveInterval]);

  return {
    offers,
    isLoading,
    error,
    refresh,
    acceptOffer,
    rejectOffer,
  };
}
