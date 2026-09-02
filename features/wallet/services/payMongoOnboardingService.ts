import { apiClient } from '@/shared/services/apiClient';
import type {
  BeeWalletTopUpQr,
  CashBondQr,
  CashBondStatus,
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
      verificationFailureReason: raw?.verificationFailureReason ?? null,
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

  /**
   * The QR for topping up the driver's own BeeWallet wallet.
   *
   * Fails for a driver who has not finished setup — there is no wallet of their own to credit yet,
   * and the backend deliberately refuses rather than handing back the platform's QR.
   *
   * @param amount Optional. Sent as `?amount=`, which fixes the figure into the code so the payer
   * cannot mistype it. That makes the QR dynamic, and a dynamic QR **expires** — PayMongo defaults
   * to 30 minutes, returned as `expiresAt`. Omitted, the driver gets their reusable static code,
   * which never expires and carries no amount.
   */
  async getBeeWalletTopUpQr(
    driverId: string,
    amount?: number | null
  ): Promise<BeeWalletTopUpQr> {
    // Only a positive, finite figure is worth sending; anything else is the driver having skipped
    // the step, and an `amount=` with nothing after it reads as a malformed request.
    //
    // Two decimal places exactly: the backend rejects finer precision outright, because QR Ph
    // carries the amount in the payload and a sub-centavo value yields a code that either fails to
    // parse or silently rounds. Formatting here means that guard can never fire on us.
    const query =
      typeof amount === 'number' && Number.isFinite(amount) && amount > 0
        ? `?amount=${amount.toFixed(2)}`
        : '';

    const response = await apiClient.get<BeeWalletTopUpQr>(
      `/api/drivers/${driverId}/wallet/beewallet/topup-qr${query}`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload?.qrImage) {
      throw new Error(
        (response as any)?.data?.message ?? 'Could not load your top-up QR code'
      );
    }
    return {
      qrString: payload.qrString,
      qrImage: payload.qrImage,
      merchantName: payload.merchantName ?? null,
      accountNumber: payload.accountNumber ?? null,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      // Read from the response rather than echoing the argument back: this is what the code was
      // actually generated with, and it is null whenever the backend fell back to the static QR.
      amount: payload.amount != null ? Number(payload.amount) : null,
    };
  }

  private parseCashBond(raw: any, driverId: string): CashBondStatus {
    return {
      driverId,
      vehicleType: raw?.vehicleType ?? null,
      amountDue: raw?.amountDue != null ? Number(raw.amountDue) : null,
      cashBondBalance: Number(raw?.cashBondBalance ?? 0),
      paid: Boolean(raw?.paid),
    };
  }

  /**
   * Issues the QR that pays the cashbond into the platform wallet.
   *
   * Safe to call again: an outstanding payment re-issues a code for the same transaction rather
   * than opening a second one, so a driver who closes the sheet and reopens it does not end up
   * with two live codes for one debt.
   */
  async createCashBondQr(driverId: string): Promise<CashBondQr> {
    const response = await apiClient.post<CashBondQr>(
      `/api/drivers/${driverId}/wallet/cashbond/qr`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error(
        (response as any)?.data?.message ??
          (response as any)?.message ??
          'Could not create your cashbond QR'
      );
    }
    return {
      qrString: payload.qrString ?? '',
      qrImage: payload.qrImage ?? '',
      amount: Number(payload.amount ?? 0),
      referenceLabel: payload.referenceLabel ?? '',
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    };
  }

  /** Where the driver stands on their cashbond — amount due for their vehicle type, and paid status. */
  async getCashBondStatus(driverId: string): Promise<CashBondStatus> {
    const response = await apiClient.get<CashBondStatus>(
      `/api/drivers/${driverId}/wallet/cashbond`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error('Unable to check your cashbond status');
    }
    return this.parseCashBond(payload, driverId);
  }

  /**
   * Pays the cashbond in full, sweeping it from the driver's PayMongo child wallet.
   *
   * Fails with a message telling the driver to fund their wallet first if the child wallet does
   * not yet hold the configured amount — that funding happens through the existing BeeWallet QR
   * top-up flow, not here.
   */
  async payCashBond(driverId: string): Promise<CashBondStatus> {
    const response = await apiClient.post<CashBondStatus>(
      `/api/drivers/${driverId}/wallet/cashbond/pay`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error(
        (response as any)?.data?.message ??
          (response as any)?.message ??
          'Could not pay your cashbond'
      );
    }
    return this.parseCashBond(payload, driverId);
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
