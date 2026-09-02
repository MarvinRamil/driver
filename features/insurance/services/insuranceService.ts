import { apiClient } from '@/shared/services/apiClient';
import { walletService } from '@/features/wallet/services/walletService';
import type {
  InsurancePaymentHistoryItem,
  InsurancePolicy,
  InsurancePolicyStatus,
  InsuranceQr,
} from '../types';

/**
 * Driver-side package-insurance service (issue #104). Same request/response shape as
 * `payMongoOnboardingService`'s cashbond methods — status query, QR creation — because payment
 * follows the identical platform-wallet QR flow.
 */
class InsuranceService {
  private extractPayload<T>(response: any): T | null {
    if (!response?.success) return null;
    const raw = response.data;
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return (raw as any).data as T;
    }
    return (raw as T) ?? null;
  }

  private parsePolicy(raw: any, driverId: string): InsurancePolicy {
    return {
      driverId,
      vehicleType: raw?.vehicleType ?? null,
      amountDue: raw?.amountDue != null ? Number(raw.amountDue) : null,
      paidThroughYearNumber: Number(raw?.paidThroughYearNumber ?? 0),
      coverageStartDate: raw?.coverageStartDate ? new Date(raw.coverageStartDate) : null,
      coverageEndDate: raw?.coverageEndDate ? new Date(raw.coverageEndDate) : null,
      status: (raw?.status as InsurancePolicyStatus) ?? 'NotEnrolled',
    };
  }

  /** Vehicle type, amount due for the next unpaid year, and coverage window. */
  async getPolicyStatus(driverId: string): Promise<InsurancePolicy> {
    const response = await apiClient.get<InsurancePolicy>(
      `/api/drivers/${driverId}/wallet/package-insurance`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error('Unable to check your package-insurance status');
    }
    return this.parsePolicy(payload, driverId);
  }

  /**
   * Past premium payments. There is no insurance-specific history endpoint — this reuses the
   * general wallet-transactions query, filtered to the PackageInsurancePayment type, the same
   * way any other transaction type is listed.
   */
  async getPaymentHistory(driverId: string): Promise<InsurancePaymentHistoryItem[]> {
    const transactions = await walletService.getTransactions(
      driverId,
      undefined,
      undefined,
      'PackageInsurancePayment'
    );
    return transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      paidAt: t.date,
      status: (t.status as InsurancePaymentHistoryItem['status']) ?? 'Completed',
    }));
  }

  /**
   * Issues the QR that pays the next-due annual premium into the platform wallet. Safe to call
   * again: an outstanding payment re-issues a code for the same transaction rather than opening
   * a second one, same as `createCashBondQr`.
   */
  async createInsuranceQr(driverId: string): Promise<InsuranceQr> {
    const response = await apiClient.post<InsuranceQr>(
      `/api/drivers/${driverId}/wallet/package-insurance/qr`,
      { requiresAuth: true }
    );
    const payload = this.extractPayload<any>(response);
    if (!payload) {
      throw new Error(
        (response as any)?.data?.message ??
          (response as any)?.message ??
          'Could not create your package-insurance payment QR'
      );
    }
    return {
      qrString: payload.qrString ?? '',
      qrImage: payload.qrImage ?? '',
      amount: Number(payload.amount ?? 0),
      referenceLabel: payload.referenceLabel ?? '',
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      policyYearNumber: Number(payload.policyYearNumber ?? 0),
    };
  }
}

export const insuranceService = new InsuranceService();
