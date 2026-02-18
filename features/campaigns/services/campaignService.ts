import { apiClient } from '@/shared/services/apiClient';
import type { CampaignItem } from '../types';

class CampaignService {
  async getActiveCampaigns(): Promise<CampaignItem[]> {
    const response = await apiClient.get<{ data: CampaignItem[] }>('/api/campaigns/active', {
      requiresAuth: true,
    });

    if (!response.success || !response.data) return [];
    const payload = (response.data as any).data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  }
}

export const campaignService = new CampaignService();
