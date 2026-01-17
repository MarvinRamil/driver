import { apiClient } from '@/shared/services/apiClient';
import type { DriverMission, MissionStatus } from '../types';

class MissionService {
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    try {
      return new Date(dateString);
    } catch {
      return null;
    }
  }

  /**
   * Get driver missions
   * GET /api/drivers/{driverId}/missions
   */
  async getMissions(driverId: string, status?: MissionStatus): Promise<DriverMission[]> {
    try {
      const params: Record<string, string> = {};
      if (status) {
        params.status = status;
      }

      const response = await apiClient.get<{ data: any[] }>(
        `/api/drivers/${driverId}/missions`,
        {
          requiresAuth: true,
          params,
        }
      );

      if (!response.success || !response.data) {
        return [];
      }

      const data = response.data.data || response.data;
      const missions = Array.isArray(data) ? data : [];

      return missions.map((mission: any) => ({
        id: mission.id,
        title: mission.title || mission.name || '',
        description: mission.description || '',
        status: mission.status || 'Available',
        reward: mission.reward || mission.bonus || 0,
        progress: mission.progress || mission.currentProgress || 0,
        target: mission.target || mission.targetProgress || 1,
        expiresAt: this.parseDate(mission.expiresAt),
        completedAt: this.parseDate(mission.completedAt),
        claimedAt: this.parseDate(mission.claimedAt),
        icon: mission.icon,
      }));
    } catch (error) {
      console.error('Failed to fetch missions:', error);
      throw new Error(
        `Failed to fetch missions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Claim mission reward
   * POST /api/drivers/{driverId}/missions/{missionId}/claim
   */
  async claimMission(driverId: string, missionId: string): Promise<DriverMission> {
    try {
      const response = await apiClient.post<{ data: any }>(
        `/api/drivers/${driverId}/missions/${missionId}/claim`,
        {
          requiresAuth: true,
        }
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to claim mission');
      }

      const mission = response.data.data || response.data;
      return {
        id: mission.id,
        title: mission.title || mission.name || '',
        description: mission.description || '',
        status: 'Claimed',
        reward: mission.reward || mission.bonus || 0,
        progress: mission.progress || mission.currentProgress || 0,
        target: mission.target || mission.targetProgress || 1,
        expiresAt: this.parseDate(mission.expiresAt),
        completedAt: this.parseDate(mission.completedAt),
        claimedAt: this.parseDate(mission.claimedAt) || new Date(),
        icon: mission.icon,
      };
    } catch (error) {
      console.error('Failed to claim mission:', error);
      throw new Error(
        `Failed to claim mission: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const missionService = new MissionService();

