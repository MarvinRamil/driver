import { useAuth } from '@/features/auth';
import { useState } from 'react';
import { walletService } from '../services/walletService';
import type { DriverTopUp } from '../types';

interface UseTopUpReturn {
  createTopUp: (amount: number, payerEmail?: string, description?: string) => Promise<DriverTopUp>;
  isSubmitting: boolean;
  error: string | null;
}

export function useTopUp(): UseTopUpReturn {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTopUp = async (amount: number, payerEmail?: string, description?: string): Promise<DriverTopUp> => {
    if (!user?.id) throw new Error('User not authenticated');

    setIsSubmitting(true);
    setError(null);
    try {
      return await walletService.createTopUp(user.id, amount, payerEmail, description);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create top-up';
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { createTopUp, isSubmitting, error };
}
