import type { Booking } from '@/shared/types/booking';

/**
 * History filter options
 */
export type HistoryFilter = 'All' | 'Today' | 'This Week' | 'Last Month';

/**
 * Trip history item (completed dispatch with booking info)
 */
export interface TripHistory {
  /** Dispatch ID */
  id: string;
  /** Dispatch number */
  dispatchNumber: string;
  /** Booking information */
  booking: Booking;
  /** Trip completion date */
  completedAt: Date;
  /** Earnings for this trip */
  earnings: number;
  /** Rating received (if any) */
  rating?: number;
  /** Status */
  status: string;
}

/**
 * History statistics
 */
export interface HistoryStats {
  /** Total earnings for period */
  totalEarnings: number;
  /** Total trips completed */
  totalTrips: number;
  /** Average rating */
  averageRating: number;
}

