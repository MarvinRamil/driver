import { apiClient } from '@/shared/services/apiClient';
import type { CreateKycSessionResult, KycStatusResult } from '../types';

/**
 * Thrown only when the backend reports the KYC provider is switched off (HTTP 503), so callers
 * can show a retry screen instead of a generic failure. A provider that is configured but
 * erroring comes back as 502/500 and must stay a plain error. Either way the driver retries
 * Didit — there is no second identity check to fall back to.
 */
export class KycUnavailableError extends Error {
  constructor(message = 'Identity verification is temporarily unavailable') {
    super(message);
    this.name = 'KycUnavailableError';
  }
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status?: number }).status;
  }
  return undefined;
}

/**
 * Didit KYC service for onboarding: the hosted flow scans the driver's ID,
 * takes a selfie with liveness, and face-matches it against the ID portrait.
 * Calls backend POST /api/kyc/session and GET /api/kyc/status.
 */
class KycService {
  /** Create a KYC session. Returns the hosted verification URL to open in a WebView. */
  async createSession(): Promise<CreateKycSessionResult> {
    try {
      const response = await apiClient.post<CreateKycSessionResult>('api/kyc/session', {
        body: {},
        requiresAuth: true,
      });
      if (!response.data?.verificationUrl) {
        throw new Error(response.message || 'Failed to start verification');
      }
      return response.data;
    } catch (e) {
      // 503 = provider disabled (distinct retry copy). 502/500 = provider erroring.
      if (statusOf(e) === 503) {
        throw new KycUnavailableError();
      }
      throw e instanceof Error || (e && typeof e === 'object' && 'message' in e)
        ? new Error((e as { message: string }).message)
        : new Error('Failed to start verification');
    }
  }

  /** Latest KYC status for the current driver. */
  async getStatus(): Promise<KycStatusResult> {
    const response = await apiClient.get<KycStatusResult>('api/kyc/status', {
      requiresAuth: true,
    });
    if (!response.data?.status) {
      throw new Error(response.message || 'Failed to get verification status');
    }
    return response.data;
  }
}

export const kycService = new KycService();
