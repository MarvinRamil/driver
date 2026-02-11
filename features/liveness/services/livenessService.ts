import { apiClient } from '@/shared/services/apiClient';
import type {
  CreateLivenessSessionResult,
  SubmitLivenessImageResult,
  LivenessSessionStatusResult,
} from '../types';

/**
 * Liveness (face verification) service for onboarding.
 * Calls backend POST /api/liveness/session, submit image, GET status.
 */
class LivenessService {
  /**
   * Create a liveness session. Returns sessionId and randomized directions (e.g. left, right, up, down).
   */
  async createSession(): Promise<CreateLivenessSessionResult> {
    const response = await apiClient.post<CreateLivenessSessionResult>('api/liveness/session', {
      body: {},
      requiresAuth: true,
    });
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to start verification');
    }
    return response.data;
  }

  /**
   * Submit an image for one direction.
   * @param sessionId - From createSession
   * @param direction - One of: left, right, up, down
   * @param imageUri - Local file URI (e.g. from ImagePicker or Camera)
   */
  async submitImage(
    sessionId: string,
    direction: string,
    imageUri: string
  ): Promise<SubmitLivenessImageResult> {
    const formData = new FormData();
    formData.append('direction', direction);
    formData.append('image', {
      uri: imageUri,
      name: 'liveness.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const response = await apiClient.post<SubmitLivenessImageResult>(
      `api/liveness/session/${sessionId}/submit`,
      {
        body: formData,
        requiresAuth: true,
        headers: {}, // Let fetch set Content-Type with boundary for FormData
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.data?.error || response.message || 'Verification failed');
    }
    return response.data;
  }

  /**
   * Get current session status.
   */
  async getStatus(sessionId: string): Promise<LivenessSessionStatusResult> {
    const response = await apiClient.get<LivenessSessionStatusResult>(
      `api/liveness/session/${sessionId}`,
      { requiresAuth: true }
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get status');
    }
    return response.data;
  }
}

export const livenessService = new LivenessService();
