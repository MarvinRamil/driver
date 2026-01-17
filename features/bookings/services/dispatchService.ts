import { apiClient } from '@/shared/services/apiClient';
import type { Dispatch } from '@/shared/types/booking';

/**
 * Dispatch service for managing dispatch-related API calls
 */
class DispatchService {
  /**
   * Get dispatch by booking ID
   */
  async getDispatchByBookingId(bookingId: string): Promise<Dispatch | null> {
    try {
      const response = await apiClient.get<Dispatch>(
        `/api/dispatches/booking/${bookingId}`,
        { requiresAuth: true }
      );

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('[DispatchService] Error fetching dispatch by booking ID:', error);
      return null;
    }
  }

  /**
   * Update dispatch status
   * @param dispatchId - Dispatch ID
   * @param status - New status (Pending, InTransit, Delivered, Cancelled)
   */
  async updateDispatchStatus(
    dispatchId: string,
    status: 'Pending' | 'InTransit' | 'Delivered' | 'Cancelled'
  ): Promise<Dispatch> {
    const response = await apiClient.patch<Dispatch>(
      `/api/dispatches/${dispatchId}/status`,
      { status },
      { requiresAuth: true }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update dispatch status');
    }

    return response.data;
  }
}

export const dispatchService = new DispatchService();

