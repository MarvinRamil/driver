import { useAuth } from '@/features/auth';
import { useBookings } from '@/features/bookings';
import { useWallet } from '@/features/wallet';
import { useMemo } from 'react';

/**
 * Dashboard statistics interface
 */
export interface DashboardStats {
  /** Total bookings */
  totalBookings: number;
  /** Active bookings */
  activeBookings: number;
  /** Completed bookings */
  completedBookings: number;
  /** Incoming deliveries count */
  incomingDeliveries: number;
  /** Ongoing deliveries count */
  ongoingDeliveries: number;
  /** Done deliveries count */
  doneDeliveries: number;
  /** Wallet balance (only for Driver/Operator) */
  walletBalance: number | null;
  /** Can access wallet */
  canAccessWallet: boolean;
}

/**
 * Custom hook for dashboard statistics
 * Aggregates data from bookings and wallet features
 * @returns Dashboard statistics
 */
export function useDashboardStats(): DashboardStats {
  const { user } = useAuth();
  const { allBookings } = useBookings();
  const { wallet } = useWallet();

  const canAccessWallet = user?.role === 'Driver';

  const stats = useMemo(() => {
    // Safe defaults if bookings haven't loaded yet
    const bookings = allBookings || [];
    
    const totalBookings = bookings.length;
    const activeBookings = bookings.filter(
      (booking) =>
        booking.status === 'Pending' ||
        booking.status === 'Assigned' ||
        booking.status === 'Broadcasting' ||
        booking.status === 'Confirmed' ||
        booking.status === 'InProgress'
    ).length;
    const completedBookings = bookings.filter(
      (booking) => booking.status === 'Completed'
    ).length;
    
    // Incoming/Ongoing/Done counts
    // Incoming: Bookings assigned but driver hasn't started working on yet
    const incomingDeliveries = bookings.filter(
      (booking) =>
        booking.status === 'Pending' ||
        booking.status === 'Confirmed'
    ).length;
    // Ongoing: Bookings actively in progress (driver is working on them)
    const ongoingDeliveries = bookings.filter(
      (booking) =>
        booking.status === 'DriverAssigned' ||
        booking.status === 'PickedUp' ||
        booking.status === 'InTransit' ||
        // Legacy statuses
        booking.status === 'OnTheWayToPickup' ||
        booking.status === 'InProgress'
    ).length;
    // Done: Completed deliveries
    const doneDeliveries = bookings.filter(
      (booking) =>
        booking.status === 'Completed' ||
        booking.status === 'Delivered'
    ).length;

    return {
      totalBookings,
      activeBookings,
      completedBookings,
      incomingDeliveries,
      ongoingDeliveries,
      doneDeliveries,
      walletBalance: canAccessWallet ? wallet?.balance ?? null : null,
      canAccessWallet,
    };
  }, [allBookings, wallet, canAccessWallet]);

  return stats;
}

