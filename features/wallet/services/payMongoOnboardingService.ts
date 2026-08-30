import { apiClient } from '@/shared/services/apiClient';
import type {
  PayMongoOnboarding,
  PayMongoOnboardingDetailsInput,
  WithdrawableBalance,
} from '../types';

/**
 * Driver-side PayMongo wallet setup.
 *
 * The child account and its wallet are infrastructure the driver never sees named: from their side
 * this is "setting up your wallet", triggered by funding their starting float. Nothing here is
 * called "create wallet" in the UI.
 */
class PayMongoOnboardingService {
  private extractPayload<T>(response: any): T | null {
    if (!response?.success) return null;
    // apiClient wraps HTTP success; the backend wraps its own payload again.
    const raw = response.data;
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return (raw as any).data as T;
    }
    return (raw as T) ?? null;
  }

  private parse(raw: any): PayMongoOnboarding {
    return {
      status: raw?.status ?? 'None',
      accountId: raw?.accountId ?? null,
      accountEmail: raw?.accountEmail ?? null,
      walletAccountNumber: raw?.walletAccountNumber ?? null,
      verificationUrl: raw?.verificationUrl ?? null,
      verificationExpiresAt: raw?.verificationExpiresAt
        ? new Date(raw.verificationExpiresAt)
        : null,
      walletReady: Boolean(raw?.walletReady),
    };
  }

  /**
   * The most this driver can withdraw right now.
   *
   * Read before enabling the withdraw button rather than derived from the wallet balance: for a
   * driver on their own PayMongo wallet the fee is taken from that wallet, so offering the full
   * balance guarantees a rejection.
   */
  async getWithdrawable(driverId: string): Promise<WithdrawableBalance> {
    const response = await apiClient.get<WithdrawableBalance>(
      `/api/drivers/${driverId}/wallet/withdrawable`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error('Unable to check your withdrawable balance');
    }
    return {
      balance: Number(payload.balance ?? 0),
      withdrawable: Number(payload.withdrawable ?? 0),
      fee: Number(payload.fee ?? 0),
      feePaidByDriver: Boolean(payload.feePaidByDriver),
    };
  }

  async getStatus(driverId: string): Promise<PayMongoOnboarding> {
    const response = await apiClient.get<PayMongoOnboarding>(
      `/api/drivers/${driverId}/wallet/paymongo`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error('Unable to check wallet setup status');
    }
    return this.parse(payload);
  }

  /**
   * Opens the driver's wallet and returns the identity-verification link.
   *
   * Safe to call again — the backend re-issues a verification session rather than opening a second
   * account, which would be permanent and would split the driver's balance across two wallets.
   */
  async start(driverId: string): Promise<PayMongoOnboarding> {
    const response = await apiClient.post<PayMongoOnboarding>(
      `/api/drivers/${driverId}/wallet/paymongo/start`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error(
        (response as any)?.data?.message ??
          (response as any)?.message ??
          'Unable to start wallet setup'
      );
    }
    return this.parse(payload);
  }

  /**
   * Submits the remaining details and activates the wallet.
   *
   * Irreversible: PayMongo freezes the account on activation and rejects every later edit, and a
   * decline cannot be appealed or retried. The form must be confirmed before this is called.
   */
  async activate(
    driverId: string,
    details: PayMongoOnboardingDetailsInput
  ): Promise<PayMongoOnboarding> {
    const response = await apiClient.post<PayMongoOnboarding>(
      `/api/drivers/${driverId}/wallet/paymongo/activate`,
      { body: details, requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error(
        (response as any)?.data?.message ??
          (response as any)?.message ??
          'Unable to finish wallet setup'
      );
    }
    return this.parse(payload);
  }
}

export const payMongoOnboardingService = new PayMongoOnboardingService();
