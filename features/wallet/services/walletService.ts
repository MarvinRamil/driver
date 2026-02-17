import { apiClient } from '@/shared/services/apiClient';
import type {
  CashJobEligibility,
  DriverEarnings,
  DriverTopUp,
  DriverWallet,
  WalletBucket,
  WalletTransaction,
  WalletTransactionType,
} from '../types';

/**
 * Wallet service for managing driver wallet operations
 * Only available for Driver/Operator (solo drivers)
 */
class WalletService {
  private extractPayload<T>(response: any): T | null {
    if (!response?.success) return null;
    // API client wraps HTTP success, while backend wraps data again in { success, data, ... }.
    const raw = response.data;
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return (raw as any).data as T;
    }
    return (raw as T) ?? null;
  }
  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) {
      return null;
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get driver wallet
   * GET /api/drivers/{driverId}/wallet
   * @param driverId - Driver ID
   * @returns Promise resolving to wallet data
   */
  async getWallet(driverId: string): Promise<DriverWallet> {
    try {
      const response = await apiClient.get<DriverWallet>(
        `/api/drivers/${driverId}/wallet`,
        { requiresAuth: true }
      );
      const wallet = this.extractPayload<DriverWallet>(response);
      if (!wallet) {
        throw new Error('Failed to fetch wallet');
      }

      return {
        ...wallet,
        personalBalance: wallet.personalBalance ?? 0,
        topUpBalance: wallet.topUpBalance ?? 0,
        pendingPayout: wallet.pendingPayout ?? 0,
        canAcceptCashJobs: wallet.canAcceptCashJobs ?? true,
        lastUpdatedAt: this.parseDate((wallet as any).lastUpdatedAt) || new Date(),
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get wallet transactions
   * GET /api/drivers/{driverId}/wallet/transactions
   * @param driverId - Driver ID
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @param type - Optional transaction type filter
   * @returns Promise resolving to array of transactions
   */
  async getTransactions(
    driverId: string,
    startDate?: Date,
    endDate?: Date,
    type?: WalletTransactionType
  ): Promise<WalletTransaction[]> {
    try {
      const params: Record<string, string | number> = {};
      
      if (startDate) {
        params.startDate = startDate.toISOString();
      }
      if (endDate) {
        params.endDate = endDate.toISOString();
      }
      if (type) {
        params.type = type;
      }

      const response = await apiClient.get<WalletTransaction[]>(
        `/api/drivers/${driverId}/wallet/transactions`,
        {
          requiresAuth: true,
          params,
        }
      );
      const transactions = this.extractPayload<WalletTransaction[]>(response);
      if (!transactions || !Array.isArray(transactions)) {
        return [];
      }
      
      return transactions.map((tx) => ({
        ...tx,
        amount: tx.amount ?? 0,
        date: this.parseDate((tx as any).transactionDate ?? (tx as any).date) || new Date(),
        bookingId: (tx as any).relatedBookingId ?? tx.bookingId ?? null,
      }));
    } catch (error) {
      throw new Error(
        `Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get driver earnings
   * GET /api/drivers/{driverId}/earnings
   * @param driverId - Driver ID
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns Promise resolving to earnings data
   */
  async getEarnings(
    driverId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DriverEarnings> {
    try {
      const params: Record<string, string> = {};
      
      if (startDate) {
        params.startDate = startDate.toISOString();
      }
      if (endDate) {
        params.endDate = endDate.toISOString();
      }

      const response = await apiClient.get<DriverEarnings>(
        `/api/drivers/${driverId}/earnings`,
        {
          requiresAuth: true,
          params,
        }
      );
      const earnings = this.extractPayload<DriverEarnings>(response);
      if (!earnings) {
        throw new Error('Failed to fetch earnings');
      }
      return earnings;
    } catch (error) {
      throw new Error(
        `Failed to fetch earnings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Request withdrawal
   * POST /api/drivers/{driverId}/wallet/withdraw
   * @param driverId - Driver ID
   * @param amount - Withdrawal amount
   * @param bankAccountNumber - Bank account number
   * @param bankName - Bank name
   * @param accountHolderName - Account holder name
   * @returns Promise resolving when withdrawal is requested
   */
  async requestWithdrawal(
    driverId: string,
    amount: number,
    bankAccountNumber: string,
    bankName: string,
    accountHolderName: string
  ): Promise<void> {
    try {
      const response = await apiClient.post(
        `/api/drivers/${driverId}/wallet/withdraw`,
        {
          body: {
            amount,
            bankAccountNumber,
            bankName,
            accountHolderName,
          },
          requiresAuth: true,
        }
      );

      const payload: any = response.data;
      if (!response.success || (payload && payload.success === false)) {
        throw new Error(payload?.message || response.message || 'Failed to request withdrawal');
      }
    } catch (error) {
      throw new Error(
        `Failed to request withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async createTopUp(
    driverId: string,
    amount: number,
    payerEmail?: string,
    description?: string,
    idempotencyKey?: string
  ): Promise<DriverTopUp> {
    const resolvedIdempotencyKey =
      idempotencyKey && idempotencyKey.trim().length > 0
        ? idempotencyKey.trim()
        : `topup-${driverId}-${amount}-${Date.now()}`;

    const response = await apiClient.post<DriverTopUp>(
      `/api/drivers/${driverId}/wallet/topup/create`,
      {
        body: { amount, payerEmail, description, idempotencyKey: resolvedIdempotencyKey },
        headers: { 'Idempotency-Key': resolvedIdempotencyKey },
        requiresAuth: true,
      }
    );
    const topUp = this.extractPayload<DriverTopUp>(response);
    if (!topUp) {
      const payload: any = response.data;
      throw new Error(payload?.message || response.message || 'Failed to create top-up');
    }

    return {
      ...topUp,
      createdAt: this.parseDate((topUp as any).createdAt) || new Date(),
      paidAt: this.parseDate((topUp as any).paidAt),
      expiresAt: this.parseDate((topUp as any).expiresAt),
      creditedAt: this.parseDate((topUp as any).creditedAt),
    };
  }

  async getTopUpHistory(driverId: string): Promise<DriverTopUp[]> {
    const response = await apiClient.get<DriverTopUp[]>(
      `/api/drivers/${driverId}/wallet/topup/history`,
      { requiresAuth: true }
    );
    const topUps = this.extractPayload<DriverTopUp[]>(response);
    if (!topUps || !Array.isArray(topUps)) return [];
    return topUps.map((t) => ({
      ...t,
      createdAt: this.parseDate((t as any).createdAt) || new Date(),
      paidAt: this.parseDate((t as any).paidAt),
      expiresAt: this.parseDate((t as any).expiresAt),
      creditedAt: this.parseDate((t as any).creditedAt),
    }));
  }

  async transferWalletBalance(
    driverId: string,
    from: WalletBucket,
    to: WalletBucket,
    amount: number
  ): Promise<DriverWallet> {
    const response = await apiClient.post<DriverWallet>(
      `/api/drivers/${driverId}/wallet/transfer`,
      {
        body: { from, to, amount },
        requiresAuth: true,
      }
    );
    const wallet = this.extractPayload<DriverWallet>(response);
    if (!wallet) {
      const payload: any = response.data;
      throw new Error(payload?.message || response.message || 'Failed to transfer wallet balance');
    }
    return {
      ...wallet,
      personalBalance: wallet.personalBalance ?? 0,
      topUpBalance: wallet.topUpBalance ?? 0,
      pendingPayout: wallet.pendingPayout ?? 0,
      canAcceptCashJobs: wallet.canAcceptCashJobs ?? true,
      lastUpdatedAt: this.parseDate((wallet as any).lastUpdatedAt) || new Date(),
    };
  }

  async getCashJobEligibility(driverId: string): Promise<CashJobEligibility> {
    const response = await apiClient.get<CashJobEligibility>(
      `/api/drivers/${driverId}/wallet/eligibility/cash-jobs`,
      { requiresAuth: true }
    );
    const eligibility = this.extractPayload<CashJobEligibility>(response);
    if (!eligibility) {
      throw new Error(response.message || 'Failed to load cash-job eligibility');
    }
    return {
      canAcceptCashJobs: eligibility.canAcceptCashJobs ?? true,
      currentTopUpBalance: eligibility.currentTopUpBalance ?? 0,
      blockThreshold: eligibility.blockThreshold ?? 0,
      allowedNegativeLimit: eligibility.allowedNegativeLimit ?? 0,
    };
  }
}

/**
 * Singleton instance of wallet service
 */
export const walletService = new WalletService();

