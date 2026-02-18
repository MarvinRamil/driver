import { apiClient } from '@/shared/services/apiClient';
import type { Giveaway } from '../types';

class GiveawayService {
  async getActiveGiveaways(): Promise<Giveaway[]> {
    const response = await apiClient.get<{ data: Giveaway[] }>('/api/giveaways', {
      requiresAuth: true,
      params: { activeOnly: true },
    });

    if (!response.success || !response.data) return [];
    const payload = (response.data as any).data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  }

  async enterGiveaway(giveawayId: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(`/api/giveaways/${giveawayId}/enter`, {
      requiresAuth: true,
    });
    if (!response.success) {
      throw new Error(response.message || 'Failed to enter giveaway');
    }
  }
}

export const giveawayService = new GiveawayService();
