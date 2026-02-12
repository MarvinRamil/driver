import { useAuth } from '@/features/auth';
import type { Booking } from '@/shared/types/booking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingService } from '../services/bookingService';
import type { BookingFilter } from '../types';

/**
 * Return type for useBookings hook
 */
interface UseBookingsReturn {
  /** Array of bookings (filtered client-side) */
  bookings: Booking[];
  /** All bookings from API (unfiltered) */
  allBookings: Booking[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to refresh bookings */
  refresh: () => Promise<void>;
  /** Function to set filter */
  setFilter: (filter: BookingFilter) => void;
  /** Current filter */
  filter: BookingFilter;
}

/**
 * Filter bookings by status (client-side filtering)
 */
function filterBookingsByStatus(
  bookings: Booking[],
  filter: BookingFilter
): Booking[] {
  if (filter === 'All') {
    return bookings;
  }

  if (filter === 'Active') {
    const activeStatuses = [
      'Pending',
      'Assigned',
      'Broadcasting',
      'Confirmed',
      'Dispatched',
      'InProgress',
    ];
    return bookings.filter((booking) => activeStatuses.includes(booking.status));
  }

  if (filter === 'Completed') {
    return bookings.filter(
      (booking) => booking.status === 'Completed' || booking.status === 'Cancelled'
    );
  }

  if (filter === 'Incoming') {
    // Bookings that are assigned but driver hasn't started working on yet
    const incomingStatuses = [
      'Pending',
      'Confirmed',        // Driver accepted the offer but hasn't started
    ];
    return bookings.filter((booking) => incomingStatuses.includes(booking.status));
  }

  if (filter === 'Ongoing') {
    // Bookings that are actively in progress (driver is working on them)
    const ongoingStatuses = [
      'DriverAssigned',   // Driver en route to pickup (actively working)
      'PickedUp',         // Driver picked up items (actively delivering)
      'InTransit',        // Driver delivering (actively in transit)
      // Legacy statuses (mapped by backend)
      'OnTheWayToPickup', // Maps to DriverAssigned (legacy)
      'InProgress',       // Maps to InTransit (legacy)
    ];
    return bookings.filter((booking) => ongoingStatuses.includes(booking.status));
  }

  if (filter === 'Done') {
    // Completed deliveries
    const doneStatuses = [
      'Completed',        // All stops completed
      'Delivered',        // Legacy status (maps to Completed)
    ];
    return bookings.filter((booking) => doneStatuses.includes(booking.status));
  }

  return bookings;
}

/**
 * Custom hook for fetching and managing bookings for drivers
 * Automatically uses the correct endpoint based on user role:
 * - Driver under operator: GET /api/dispatches/driver/{driverId}
 * - Driver/Operator: GET /api/bookings
 * @param initialFilter - Initial filter to apply (default: 'All')
 * @returns Object containing bookings, loading state, error, and control functions
 */
export function useBookings(initialFilter: BookingFilter = 'All'): UseBookingsReturn {
  const { user } = useAuth();
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BookingFilter>(initialFilter);

  /** Stable user id so we only refetch when the logged-in user changes, not on every context re-render */
  const userId = user?.id ?? null;

  /**
   * Fetch bookings from API
   * Uses role-based endpoint selection
   */
  const fetchBookings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await bookingService.getBookings(user);
      
      // Deduplicate bookings by ID to prevent duplicate key errors in React
      // This can happen due to race conditions or API returning duplicates
      const uniqueBookings = Array.from(
        new Map(data.map((booking) => [booking.id, booking])).values()
      );
      
      // Log if duplicates were found
      if (data.length !== uniqueBookings.length) {
        console.warn(
          `[useBookings] Found ${data.length - uniqueBookings.length} duplicate bookings, deduplicated to ${uniqueBookings.length}`
        );
      }
      
      setAllBookings(uniqueBookings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bookings';
      setError(errorMessage);
      setAllBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Refresh bookings list
   */
  const refresh = useCallback(async () => {
    await fetchBookings();
  }, [fetchBookings]);

  /**
   * Update filter (client-side filtering)
   */
  const handleSetFilter = useCallback((newFilter: BookingFilter) => {
    setFilter(newFilter);
  }, []);

  /**
   * Apply client-side filtering based on current filter
   */
  const filteredBookings = useMemo(() => {
    return filterBookingsByStatus(allBookings, filter);
  }, [allBookings, filter]);

  // Fetch bookings on mount and when logged-in user id changes (stable dependency to avoid refetch loops)
  useEffect(() => {
    fetchBookings();
  }, [userId]);

  return {
    bookings: filteredBookings,
    allBookings,
    isLoading,
    error,
    refresh,
    setFilter: handleSetFilter,
    filter,
  };
}

