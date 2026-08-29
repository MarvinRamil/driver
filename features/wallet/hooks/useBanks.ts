import { useCallback, useEffect, useState } from 'react';
import { maxAmountFor, PH_BANKS, type PhBank } from '@/shared/constants/banks';
import { bankService } from '../services/bankService';

interface UseBanksReturn {
    banks: PhBank[];
    /** E-wallets first, then banks — the two sections the picker renders. */
    ewallets: PhBank[];
    localBanks: PhBank[];
    isLoading: boolean;
    refresh: () => Promise<void>;
    findByCode: (code: string | null | undefined) => PhBank | undefined;
    /** Largest single transfer the institution can receive, or null when none is chosen. */
    maxAmountFor: (bank: PhBank | null | undefined) => number | null;
}

/**
 * The withdrawal destination catalog.
 *
 * Never returns an empty list: on failure it falls back to the generated PH_BANKS, so the
 * picker always has something to show and a driver is never locked out of withdrawing by
 * a backend blip. There is no error state for that reason — a partial list is strictly
 * better than a blocked screen here.
 */
export function useBanks(): UseBanksReturn {
    const [banks, setBanks] = useState<PhBank[]>([...PH_BANKS]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            setBanks(await bankService.getBanks());
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refresh = useCallback(async () => {
        bankService.invalidate();
        await load();
    }, [load]);

    useEffect(() => {
        load();
    }, [load]);

    const findByCode = useCallback(
        (code: string | null | undefined) => (code ? banks.find((b) => b.code === code) : undefined),
        [banks],
    );

    return {
        banks,
        ewallets: banks.filter((b) => b.type === 'ewallet'),
        localBanks: banks.filter((b) => b.type !== 'ewallet'),
        isLoading,
        refresh,
        findByCode,
        maxAmountFor: (bank) => (bank ? maxAmountFor(bank) : null),
    };
}
