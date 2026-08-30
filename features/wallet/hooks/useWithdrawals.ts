import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { walletService } from '../services/walletService';
import type { WithdrawalRequest, WithdrawalRequestInput } from '../types';

interface UseWithdrawalsReturn {
    requests: WithdrawalRequest[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    requestWithdrawal: (request: WithdrawalRequestInput) => Promise<void>;
}

export function useWithdrawals(): UseWithdrawalsReturn {
    const { user } = useAuth();
    const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        if (!user || user.role !== 'Driver') {
            setIsLoading(false);
            setRequests([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await walletService.getWithdrawalRequests(user.id);
            setRequests(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch withdrawal requests';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const requestWithdrawal = useCallback(async (request: WithdrawalRequestInput) => {
        if (!user) throw new Error('User not authenticated');

        await walletService.requestWithdrawal(user.id, request);
        await fetchRequests();
    }, [user, fetchRequests]);

    const refresh = useCallback(async () => {
        await fetchRequests();
    }, [fetchRequests]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    return {
        requests,
        isLoading,
        error,
        refresh,
        requestWithdrawal,
    };
}
