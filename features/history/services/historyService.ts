import { apiClient } from '@/shared/services/apiClient';
import type { Dispatch } from '@/shared/types/booking';
import type { TripHistory, HistoryStats } from '../types';
import { bookingService } from '@/features/bookings/services/bookingService';

/**
 * Service for managing trip history
 */
class HistoryService {
  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) {
      return null;
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get trip history for a driver
   * GET /api/dispatches/driver/{driverId}
   * Filters to only completed dispatches (status = "Delivered")
   */
  async getTripHistory(driverId: string): Promise<TripHistory[]> {
    try {
      const response = await apiClient.get<Dispatch[]>(
        `/api/dispatches/driver/${driverId}`,
        { requiresAuth: true }
      );

      if (!response.success || !response.data) {
        return [];
      }

      const dispatches = Array.isArray(response.data) ? response.data : [];
      
      // Filter to only completed dispatches
      const completedDispatches = dispatches.filter(
        (d) => d.status === 'Delivered' || d.status === 'Completed'
      );

      // Map to TripHistory
      const history: TripHistory[] = [];
      for (const dispatch of completedDispatches) {
        if (!dispatch.booking) {
          // Try to fetch booking if not included
          try {
            const booking = await bookingService.getBookingById(dispatch.bookingId);
            dispatch.booking = booking;
          } catch (error) {
            console.warn(`Failed to fetch booking ${dispatch.bookingId}:`, error);
            continue;
          }
        }

        const completedAt = dispatch.arrivalTime || dispatch.departureTime || new Date();
        const earnings = this.calculateEarnings(dispatch);

        history.push({
          id: dispatch.id,
          dispatchNumber: dispatch.dispatchNumber || `DSP-${dispatch.id.slice(0, 8)}`,
          booking: dispatch.booking!,
          completedAt: completedAt instanceof Date ? completedAt : new Date(completedAt),
          earnings,
          rating: undefined, // TODO: Get rating from booking/dispatch if available
          status: dispatch.status,
        });
      }

      // Sort by completion date (newest first)
      return history.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    } catch (error) {
      console.error('Failed to fetch trip history:', error);
      throw new Error(
        `Failed to fetch trip history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate earnings for a dispatch
   * TODO: This should come from payment/dispatch data
   */
  private calculateEarnings(dispatch: Dispatch): number {
    // For now, use a placeholder calculation
    // In production, this should come from payment data
    return Math.random() * 50 + 10; // $10-$60 placeholder
  }

  /**
   * Get history statistics
   */
  async getHistoryStats(driverId: string, filter?: HistoryFilter): Promise<HistoryStats> {
    const history = await this.getTripHistory(driverId);
    
    // Apply date filter if provided
    let filteredHistory = history;
    if (filter && filter !== 'All') {
      const now = new Date();
      const startDate = this.getFilterStartDate(now, filter);
      filteredHistory = history.filter((trip) => trip.completedAt >= startDate);
    }

    const totalEarnings = filteredHistory.reduce((sum, trip) => sum + trip.earnings, 0);
    const totalTrips = filteredHistory.length;
    const ratings = filteredHistory
      .map((trip) => trip.rating)
      .filter((r): r is number => r !== undefined);
    const averageRating =
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;

    return {
      totalEarnings,
      totalTrips,
      averageRating,
    };
  }

  /**
   * Get start date for filter
   */
  private getFilterStartDate(now: Date, filter: HistoryFilter): Date {
    switch (filter) {
      case 'Today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'This Week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
      case 'Last Month':
        const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return monthStart;
      default:
        return new Date(0); // All time
    }
  }
}

export const historyService = new HistoryService();

