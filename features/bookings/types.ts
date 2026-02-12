/**
 * Booking feature-specific types
 */

import type { Booking } from '@/shared/types/booking';

/**
 * Booking filter options
 */
export type BookingFilter = 'All' | 'Active' | 'Completed' | 'Incoming' | 'Ongoing' | 'Done';

/**
 * Re-export shared types for convenience
 */
export type { Booking };

