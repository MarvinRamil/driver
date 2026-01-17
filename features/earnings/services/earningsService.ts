import { apiClient } from '@/shared/services/apiClient';
import type { DriverEarnings, DailyEarning } from '../types';

class EarningsService {
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    try {
      return new Date(dateString);
    } catch {
      return null;
    }
  }

  /**
   * Get driver earnings
   * GET /api/drivers/{driverId}/earnings
   */
  async getEarnings(
    driverId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DriverEarnings> {
    try {
      const params: Record<string, string> = {};
      if (startDate) {
        params.startDate = startDate.toISOString();
      }
      if (endDate) {
        params.endDate = endDate.toISOString();
      }

      const response = await apiClient.get<{ data: any }>(
        `/api/drivers/${driverId}/earnings`,
        {
          requiresAuth: true,
          params,
        }
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch earnings');
      }

      const data = response.data.data || response.data;

      return {
        totalEarnings: data.totalEarnings || data.total || 0,
        period: data.period || '',
        trips: data.trips || data.totalTrips || 0,
        onlineHours: data.onlineHours || 0,
        dailyBreakdown: (data.dailyBreakdown || []).map((item: any) => ({
          date: this.parseDate(item.date) || new Date(),
          earnings: item.earnings || 0,
          trips: item.trips || 0,
        })),
      };
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
      throw new Error(
        `Failed to fetch earnings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const earningsService = new EarningsService();

