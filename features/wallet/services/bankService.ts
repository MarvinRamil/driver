import { apiClient } from '@/shared/services/apiClient';
import { PH_BANKS, type PhBank } from '@/shared/constants/banks';

/** Transfer rails a payout can travel on. */
export type TransferRail = 'instapay' | 'pesonet';

interface BankDto {
  code: string;
  name: string;
  legalName?: string | null;
  bic: string;
  instapay: boolean;
  pesonet: boolean;
  type: string;
  maxAmount: number;
}

/**
 * Banks and e-wallets a driver can withdraw to.
 *
 * The list is served by the backend rather than baked into the app so a corrected BIC
 * reaches drivers without a store release. `PH_BANKS` is the fallback when the request
 * fails: an empty picker would block withdrawals entirely, and the generated constant is
 * always a subset of what the API would return.
 *
 * Cached for the lifetime of the app process — the catalog only changes when the backend
 * is redeployed, so re-fetching per screen open buys nothing.
 */
class BankService {
  private cache: PhBank[] | null = null;
  private inFlight: Promise<PhBank[]> | null = null;

  async getBanks(rail?: TransferRail): Promise<PhBank[]> {
    const banks = await this.loadAll();
    if (!rail) return banks;
    return banks.filter((bank) => (rail === 'instapay' ? bank.instapay : bank.pesonet));
  }

  /** Drops the cache so the next read re-fetches. Used by pull-to-refresh. */
  invalidate(): void {
    this.cache = null;
    this.inFlight = null;
  }

  private async loadAll(): Promise<PhBank[]> {
    if (this.cache) return this.cache;
    // Collapse concurrent callers (the picker and the amount validator both ask on open)
    // onto a single request.
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchBanks()
      .then((banks) => {
        this.cache = banks;
        return banks;
      })
      .catch(() => {
        // Offline or the endpoint is down. The generated constant still lets the driver
        // withdraw to any of the institutions we have verified BICs for.
        this.cache = null;
        return [...PH_BANKS];
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async fetchBanks(): Promise<PhBank[]> {
    const response = await apiClient.get<BankDto[]>('/api/payments/banks', { requiresAuth: true });

    if (!response?.success) throw new Error(response?.message ?? 'Failed to fetch banks');

    // The API client wraps HTTP success; the backend wraps the payload again.
    const raw: any = response.data;
    const banks: BankDto[] | undefined =
      raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;

    if (!Array.isArray(banks) || banks.length === 0) throw new Error('Empty bank list');

    return banks.map((bank) => ({
      code: bank.code,
      name: bank.name,
      legalName: bank.legalName ?? undefined,
      bic: bank.bic,
      instapay: bank.instapay,
      pesonet: bank.pesonet,
      type: bank.type === 'ewallet' ? 'ewallet' : 'bank',
    }));
  }
}

export const bankService = new BankService();
