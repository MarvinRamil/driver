import { apiClient } from '@/shared/services/apiClient';
import type { Booking, Dispatch } from '@/shared/types/booking';
import type { User } from '@/features/auth/types';

/**
 * Booking service for managing booking-related API calls for drivers
 * Handles role-based booking fetching:
 * - Driver under operator: GET /api/dispatches/driver/{driverId} (assigned bookings only)
 * - Driver/Operator: GET /api/bookings (all bookings for operator)
 */
class BookingService {
  /**
   * Parse date string from API response to Date object
   */
  private parseDate(
    dateString: string | null | undefined,
    fallback?: Date
  ): Date | null {
    if (!dateString) {
      return fallback || null;
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return fallback || null;
      }
      return date;
    } catch (error) {
      return fallback || null;
    }
  }

  /**
   * Map API dispatch to Booking
   * Note: DispatchDto only contains BookingId, so we need to fetch the booking separately
   */
  private async mapDispatchToBooking(dispatch: any): Promise<Booking | null> {
    if (!dispatch) {
      console.warn('[BookingService] Dispatch is null or undefined');
      return null;
    }

    // Check if booking is nested in dispatch (some endpoints might include it)
    let apiBooking = dispatch.booking;
    
    // If no booking property, check if dispatch itself is the booking
    if (!apiBooking && dispatch.bookingId) {
      // Dispatch only has bookingId, need to fetch booking
      console.log('[BookingService] Fetching booking from API:', `/api/bookings/${dispatch.bookingId}`);
      try {
        const bookingResponse = await apiClient.get<any>(
          `/api/bookings/${dispatch.bookingId}`,
          { requiresAuth: true }
        );
        
        console.log('[BookingService] Booking API Response:', {
          success: bookingResponse.success,
          statusCode: bookingResponse.statusCode,
          hasData: !!bookingResponse.data,
          bookingId: dispatch.bookingId,
        });
        
        if (bookingResponse.success && bookingResponse.data) {
          apiBooking = bookingResponse.data;
          console.log('[BookingService] ✓ Booking fetched successfully:', {
            bookingId: apiBooking?.id,
            bookingNumber: apiBooking?.bookingNumber,
            status: apiBooking?.status,
          });
        } else {
          console.warn('[BookingService] ✗ Failed to fetch booking for dispatch:', {
            dispatchId: dispatch.id,
            bookingId: dispatch.bookingId,
            response: bookingResponse,
          });
          return null;
        }
      } catch (error) {
        console.error('[BookingService] ✗ Error fetching booking:', error, {
          dispatchId: dispatch.id,
          bookingId: dispatch.bookingId,
        });
        return null;
      }
    }
    
    // If still no booking, check for nested data structure
    if (!apiBooking && dispatch.data && dispatch.data.booking) {
      apiBooking = dispatch.data.booking;
    }

    if (!apiBooking) {
      console.warn('[BookingService] No booking found in dispatch:', {
        dispatchId: dispatch.id,
        dispatchKeys: Object.keys(dispatch),
        hasBooking: !!dispatch.booking,
        hasBookingId: !!dispatch.bookingId,
      });
      return null;
    }

    try {
      return this.mapApiBookingToBooking(apiBooking);
    } catch (error) {
      console.error('[BookingService] Error mapping booking:', error);
      console.error('[BookingService] Booking data structure:', {
        apiBooking,
        apiBookingType: typeof apiBooking,
        apiBookingKeys: apiBooking ? Object.keys(apiBooking) : [],
        hasId: apiBooking ? !!apiBooking.id : false,
        idValue: apiBooking?.id,
        stringified: JSON.stringify(apiBooking, null, 2),
      });
      return null;
    }
  }

  /**
   * Map API booking response to Booking type
   */
  private mapApiBookingToBooking(apiBooking: any): Booking {
    // Defensive check: handle nested data structures
    // Sometimes the API response wraps data in a 'data' property
    if (apiBooking && apiBooking.data && typeof apiBooking.data === 'object') {
      apiBooking = apiBooking.data;
    }

    // Validate required fields with detailed error logging
    if (!apiBooking) {
      console.error('[BookingService] mapApiBookingToBooking: apiBooking is null/undefined');
      throw new Error('Invalid booking data: missing required fields (apiBooking is null/undefined)');
    }

    if (!apiBooking.id) {
      console.error('[BookingService] mapApiBookingToBooking: Missing id field', {
        apiBooking,
        apiBookingType: typeof apiBooking,
        apiBookingKeys: apiBooking ? Object.keys(apiBooking) : [],
        hasId: !!apiBooking.id,
        idValue: apiBooking.id,
      });
      throw new Error('Invalid booking data: missing required fields (id is missing)');
    }

    const scheduleDate = this.parseDate(apiBooking.scheduleDate, new Date());
    const createdAt = this.parseDate(apiBooking.createdAt, new Date());

    const validStatuses = [
      'Pending',
      'Assigned',
      'Broadcasting',
      'Confirmed',
      'Dispatched',
      'OnTheWayToPickup',
      'InProgress',
      'Delivered',
      'Completed',
      'Cancelled',
    ];
    const status = validStatuses.includes(apiBooking.status)
      ? apiBooking.status
      : 'Pending';

    const validAssignmentStatuses = [
      'Unassigned',
      'PendingAssignment',
      'Assigned',
      'AssignedToOperator',
      'Broadcasting',
      'BroadcastingToDrivers',
      'AcceptedByDriver',
      'RejectedByAllDrivers',
    ];
    const assignmentStatus = validAssignmentStatuses.includes(
      apiBooking.assignmentStatus
    )
      ? apiBooking.assignmentStatus
      : 'Unassigned';

    const truckType = apiBooking.truckType || 'Medium';

    const weightKg =
      apiBooking.weightKg !== null && apiBooking.weightKg !== undefined
        ? Number(apiBooking.weightKg)
        : null;
    const pickupLatitude =
      apiBooking.pickupLatitude !== null &&
      apiBooking.pickupLatitude !== undefined
        ? Number(apiBooking.pickupLatitude)
        : null;
    const pickupLongitude =
      apiBooking.pickupLongitude !== null &&
      apiBooking.pickupLongitude !== undefined
        ? Number(apiBooking.pickupLongitude)
        : null;
    const dropoffLatitude =
      apiBooking.dropoffLatitude !== null &&
      apiBooking.dropoffLatitude !== undefined
        ? Number(apiBooking.dropoffLatitude)
        : null;
    const dropoffLongitude =
      apiBooking.dropoffLongitude !== null &&
      apiBooking.dropoffLongitude !== undefined
        ? Number(apiBooking.dropoffLongitude)
        : null;

    return {
      id: apiBooking.id,
      bookingNumber: apiBooking.bookingNumber || `BK-${apiBooking.id.slice(0, 8)}`,
      customerId: apiBooking.customerId || '',
      pickupLocation: apiBooking.pickupLocation || '',
      dropoffLocation: apiBooking.dropoffLocation || '',
      truckType: truckType as any,
      cargoDescription: apiBooking.cargoDescription || '',
      scheduleDate: scheduleDate!,
      status: status as any,
      notes: apiBooking.notes ?? null,
      createdAt: createdAt!,
      updatedAt: this.parseDate(apiBooking.updatedAt),
      size: apiBooking.size ?? null,
      assignmentStatus: assignmentStatus as any,
      assignedToTenantId: apiBooking.assignedToTenantId ?? null,
      assignedByUserId: apiBooking.assignedByUserId ?? null,
      assignedAt: this.parseDate(apiBooking.assignedAt),
      beeTenantId: apiBooking.beeTenantId ?? null,
      weightKg: weightKg !== null && !isNaN(weightKg) ? weightKg : null,
      pickupLatitude: pickupLatitude !== null && !isNaN(pickupLatitude) ? pickupLatitude : null,
      pickupLongitude: pickupLongitude !== null && !isNaN(pickupLongitude) ? pickupLongitude : null,
      dropoffLatitude: dropoffLatitude !== null && !isNaN(dropoffLatitude) ? dropoffLatitude : null,
      dropoffLongitude: dropoffLongitude !== null && !isNaN(dropoffLongitude) ? dropoffLongitude : null,
      description: apiBooking.cargoDescription || apiBooking.description,
      weight: weightKg ?? apiBooking.weight,
    };
  }

  /**
   * Get bookings for a driver based on their role
   * - Driver under operator: GET /api/dispatches/driver/{driverId}
   * - Driver/Operator: GET /api/bookings
   * @param user - Current user object
   * @returns Promise resolving to array of bookings
   */
  async getBookings(user: User): Promise<Booking[]> {
    try {
      // Driver app only has Driver role. All drivers are independent; no /api/bookings (back-office only).
      if (user.role !== 'Driver') {
        return [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      throw new Error(
        `Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a single booking by ID
   * @param id - Booking ID
   * @returns Promise resolving to booking data
   */
  async getBookingById(id: string): Promise<Booking> {
    try {
      const response = await apiClient.get<Booking>(`/api/bookings/${id}`, {
        requiresAuth: true,
      });
      
      if (response.success && response.data) {
        return this.mapApiBookingToBooking(response.data);
      }
      
      throw new Error('Booking not found');
    } catch (error) {
      throw new Error(
        `Failed to fetch booking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update booking status
   * @param id - Booking ID
   * @param status - New status
   * @returns Promise resolving to updated booking
   */
  async updateBookingStatus(id: string, status: string): Promise<Booking> {
    try {
      const response = await apiClient.patch<Booking>(`/api/bookings/${id}/status`, {
        body: { status },
        requiresAuth: true,
      });
      
      if (response.success && response.data) {
        return this.mapApiBookingToBooking(response.data);
      }
      
      throw new Error('Failed to update booking status');
    } catch (error) {
      throw new Error(
        `Failed to update booking status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Singleton instance of booking service
 */
export const bookingService = new BookingService();

