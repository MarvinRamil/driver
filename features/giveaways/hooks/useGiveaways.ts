import { useCallback, useEffect, useState } from 'react';
import { giveawayService } from '../services/giveawayService';
import type { Giveaway } from '../types';

export function useGiveaways() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await giveawayService.getActiveGiveaways();
      setGiveaways(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load giveaways');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enterGiveaway = useCallback(async (id: string) => {
    await giveawayService.enterGiveaway(id);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    giveaways,
    isLoading,
    error,
    refresh,
    enterGiveaway,
  };
}
