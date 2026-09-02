import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { insuranceService } from '../services/insuranceService';
import type { InsurancePaymentHistoryItem, InsurancePolicy, InsuranceQr } from '../types';

interface RefreshOptions {
  /** Same purpose as `useCashBond`'s: refetch without flashing a skeleton over a still-correct card. */
  silent?: boolean;
}

interface UseInsuranceReturn {
  data: InsurancePolicy | null;
  history: InsurancePaymentHistoryItem[];
  isLoading: boolean;
  isCreatingQr: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  /** Issues the payment QR — same step as `useCashBond`'s `createQr`. */
  createQr: () => Promise<InsuranceQr>;
}

/**
 * Where the driver stands on their package-insurance policy and its payment history, plus the
 * pay-by-QR flow — shaped after `useCashBond`, since #38 asks for the same payment flow. Backed
 * by the real backend (issue #104): status and payment history are recurring/annual rather than
 * a one-time paid/unpaid boolean.
 */
export function useInsurance(): UseInsuranceReturn {
  const { user } = useAuth();
  // Destructured rather than depending on `user` itself — same reasoning as useCashBond: the
  // callbacks below are used as useFocusEffect deps by screens that mount this hook, so an auth
  // context that hands back a new object each render would turn "refetch on focus" into a loop.
  const userId = user?.id;
  const role = user?.role;
  const [data, setData] = useState<InsurancePolicy | null>(null);
  const [history, setHistory] = useState<InsurancePaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingQr, setIsCreatingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async ({ silent = false }: RefreshOptions = {}) => {
    if (!userId || role !== 'Driver') {
      setData(null);
      setHistory([]);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const [policy, paymentHistory] = await Promise.all([
        insuranceService.getPolicyStatus(userId),
        insuranceService.getPaymentHistory(userId),
      ]);
      setData(policy);
      setHistory(paymentHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your package-insurance status');
      // A silent refresh keeps whatever was already on screen — a failed background poll should
      // not blank out a card the driver is looking at.
      if (!silent) {
        setData(null);
        setHistory([]);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createQr = useCallback(async () => {
    if (!userId) throw new Error('Not signed in');

    setIsCreatingQr(true);
    setError(null);
    try {
      return await insuranceService.createInsuranceQr(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create your package-insurance payment QR';
      setError(message);
      throw new Error(message);
    } finally {
      setIsCreatingQr(false);
    }
  }, [userId]);

  return { data, history, isLoading, isCreatingQr, error, refresh, createQr };
}
