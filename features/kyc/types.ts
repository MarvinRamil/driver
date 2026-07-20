/**
 * Didit KYC (ID document + selfie + liveness + face match) API types
 */

export interface CreateKycSessionResult {
  sessionId: string;
  verificationUrl: string;
}

export interface KycStatusResult {
  status: string;
  faceMatchScore?: number | null;
  livenessScore?: number | null;
  statusReason?: string | null;
  completedAt?: string | null;
}

export const KycStatus = {
  NotStarted: 'NotStarted',
  Pending: 'Pending',
  InProgress: 'InProgress',
  InReview: 'InReview',
  Approved: 'Approved',
  Declined: 'Declined',
  Abandoned: 'Abandoned',
  Expired: 'Expired',
  Legacy: 'Legacy',
} as const;

export type KycStatusValue = (typeof KycStatus)[keyof typeof KycStatus];
