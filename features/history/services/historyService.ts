import type { TripHistory, HistoryStats, HistoryFilter } from '../types';
import { bookingService } from '@/features/bookings/services/bookingService';

const COMPLETED_STATUSES = ['Delivered', 'Completed', 'Cancelled'];

/**
 * Service for managing trip history
 * Uses GET /api/bookings/driver/{driverId} and filters to completed/cancelled bookings.
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
   * GET /api/bookings/driver/{driverId} — filters to Delivered, Completed, Cancelled
   */
  async getTripHistory(driverId: string): Promise<TripHistory[]> {
    try {
      const bookings = await bookingService.getBookingsByDriverId(driverId);
      const completed = bookings.filter((b) =>
        COMPLETED_STATUSES.includes(b.status)
      );

      const PLATFORM_FEE_RATE = 0.05; // 5% platform fee; driver gets 95%

      const history: TripHistory[] = completed.map((booking) => {
        const completedAt = booking.updatedAt ?? booking.createdAt;
        const completedAtDate =
          completedAt instanceof Date ? completedAt : new Date(completedAt as unknown as string);
        const gross =
          booking.finalFare != null
            ? Number(booking.finalFare)
            : booking.estimatedFare != null
              ? Number(booking.estimatedFare)
              : 0;
        // Driver earnings after 5% platform fee (net take-home)
        const earnings =
          booking.status === 'Cancelled' ? 0 : Math.round(gross * (1 - PLATFORM_FEE_RATE) * 100) / 100;

        return {
          id: booking.id,
          dispatchNumber: booking.bookingNumber,
          booking,
          completedAt: completedAtDate,
          earnings,
          rating: undefined,
          status: booking.status,
        };
      });

      return history.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    } catch (error) {
      console.error('Failed to fetch trip history:', error);
      throw new Error(
        `Failed to fetch trip history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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

