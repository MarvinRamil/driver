import { apiClient } from '@/shared/services/apiClient';
import type {
  CreateLivenessSessionResult,
  SubmitLivenessImageResult,
  LivenessSessionStatusResult,
} from '../types';

export interface SubmitShiftCheckImageResult extends SubmitLivenessImageResult {
  matchScore?: number | null;
}

/**
 * Per-shift face check service: same head-pose challenge as onboarding liveness,
 * but the backend also face-matches each frame against the driver's verified
 * KYC reference selfie. Required before going online when the last check is stale.
 * Calls backend POST /api/shift-check/session, submit image, GET status.
 */
class ShiftCheckService {
  async createSession(): Promise<CreateLivenessSessionResult> {
    const response = await apiClient.post<CreateLivenessSessionResult>('api/shift-check/session', {
      body: {},
      requiresAuth: true,
    });
    if (!response.data?.sessionId) {
      throw new Error(response.message || 'Failed to start face check');
    }
    return response.data;
  }

  async submitImage(
    sessionId: string,
    direction: string,
    imageUri: string
  ): Promise<SubmitShiftCheckImageResult> {
    const formData = new FormData();
    formData.append('direction', direction);
    formData.append('image', {
      uri: imageUri,
      name: 'shift-check.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const response = await apiClient.post<SubmitShiftCheckImageResult>(
      `api/shift-check/session/${sessionId}/submit`,
      {
        body: formData,
        requiresAuth: true,
        headers: {}, // Let fetch set Content-Type with boundary for FormData
      }
    );
    if (!response.data) {
      throw new Error(response.message || 'Face check failed');
    }
    return response.data;
  }

  async getStatus(sessionId: string): Promise<LivenessSessionStatusResult> {
    const response = await apiClient.get<LivenessSessionStatusResult>(
      `api/shift-check/session/${sessionId}`,
      { requiresAuth: true }
    );
    if (!response.data?.status) {
      throw new Error(response.message || 'Failed to get status');
    }
    return response.data;
  }
}

export const shiftCheckService = new ShiftCheckService();
