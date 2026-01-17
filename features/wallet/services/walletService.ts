import { apiClient } from '@/shared/services/apiClient';
import type { DriverWallet, DriverEarnings, WalletTransaction } from '../types';

/**
 * Wallet service for managing driver wallet operations
 * Only available for Driver/Operator (solo drivers)
 */
class WalletService {
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

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch wallet');
      }

      const wallet = response.data;
      return {
        ...wallet,
        balance: wallet.balance ?? 0,
        pendingBalance: wallet.pendingBalance ?? 0,
        totalEarnings: wallet.totalEarnings ?? 0,
        updatedAt: this.parseDate(wallet.updatedAt as any) || new Date(),
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

      if (!response.success || !response.data) {
        return [];
      }

      const transactions = Array.isArray(response.data) ? response.data : [];
      
      return transactions.map((tx) => ({
        ...tx,
        amount: tx.amount ?? 0,
        date: this.parseDate(tx.date as any) || new Date(),
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

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch earnings');
      }

      return response.data;
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

      if (!response.success) {
        throw new Error(response.message || 'Failed to request withdrawal');
      }
    } catch (error) {
      throw new Error(
        `Failed to request withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Singleton instance of wallet service
 */
export const walletService = new WalletService();

