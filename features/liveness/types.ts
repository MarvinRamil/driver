/**
 * Liveness (face verification) API types
 */

export interface CreateLivenessSessionResult {
  sessionId: string;
  directions: string[];
  expiresAt: string;
}

export interface SubmitLivenessImageResult {
  directionPassed: boolean;
  allPassed: boolean;
  remainingDirections: string[];
  error?: string;
}

export interface LivenessSessionStatusResult {
  status: string;
  directionsPassed: string[];
  remainingDirections: string[];
}

export const LivenessStatus = {
  InProgress: 'InProgress',
  Passed: 'Passed',
  Failed: 'Failed',
  Expired: 'Expired',
  NotFound: 'NotFound',
} as const;
