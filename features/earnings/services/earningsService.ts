import { apiClient } from '@/shared/services/apiClient';
import type {
  DriverEarnings,
  DailyEarning,
  DriverEarningsHistory,
  EarningsHistoryItem,
} from '../types';

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

      // Backend returns: today, thisWeek, thisMonth, total, breakdown (array of { date, amount, bookingsCount })
      const breakdown = data.breakdown || data.Breakdown || [];
      const dailyBreakdown = breakdown.map((item: any) => ({
        date: this.parseDate(item.date) || new Date(),
        earnings: item.amount ?? item.earnings ?? 0,
        trips: item.bookingsCount ?? item.trips ?? 0,
      }));

      const totalEarnings = data.total ?? data.totalEarnings ?? data.Total ?? 0;
      const trips = breakdown.reduce(
        (sum: number, item: any) => sum + (item.bookingsCount ?? item.trips ?? 0),
        0
      );

      return {
        totalEarnings: Number(totalEarnings),
        period: data.period || '',
        trips: data.trips ?? data.totalTrips ?? trips,
        onlineHours: data.onlineHours ?? 0,
        dailyBreakdown,
        today: data.today ?? 0,
        thisWeek: data.thisWeek ?? 0,
        thisMonth: data.thisMonth ?? 0,
      };
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
      throw new Error(
        `Failed to fetch earnings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get driver earnings history with 5% platform fee breakdown
   * GET /api/drivers/{driverId}/earnings/history
   */
  async getEarningsHistory(
    driverId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<DriverEarningsHistory> {
    try {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      if (limit != null && limit > 0) params.limit = String(limit);

      const response = await apiClient.get<{ data: any }>(
        `/api/drivers/${driverId}/earnings/history`,
        { requiresAuth: true, params }
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch earnings history');
      }

      const raw = response.data.data || response.data;
      const items: EarningsHistoryItem[] = (raw.items || []).map((item: any) => ({
        bookingId: item.bookingId ?? '',
        date: this.parseDate(item.date) || new Date(),
        paymentMethod: item.paymentMethod ?? 'Cash',
        grossAmount: Number(item.grossAmount ?? 0),
        platformFeePercent: Number(item.platformFeePercent ?? 5),
        platformFeeAmount: Number(item.platformFeeAmount ?? 0),
        netAmount: Number(item.netAmount ?? 0),
      }));

      return {
        items,
        totalGross: Number(raw.totalGross ?? 0),
        totalPlatformFee: Number(raw.totalPlatformFee ?? 0),
        totalNet: Number(raw.totalNet ?? 0),
      };
    } catch (error) {
      console.error('Failed to fetch earnings history:', error);
      throw new Error(
        `Failed to fetch earnings history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const earningsService = new EarningsService();

