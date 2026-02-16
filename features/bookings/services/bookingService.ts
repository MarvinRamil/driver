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
      'DriverAssigned',    // New status: Driver en route to pickup
      'OnTheWayToPickup',  // Legacy status (maps to DriverAssigned)
      'PickedUp',          // New status: Driver picked up items
      'InTransit',         // New status: Driver delivering
      'InProgress',        // Legacy status (maps to InTransit)
      'Delivered',         // Legacy status (maps to Completed)
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
      stops: Array.isArray(apiBooking.stops)
        ? apiBooking.stops.map((s: any) => ({
            id: s.id ?? '',
            sequence: s.sequence ?? 0,
            address: s.address ?? '',
            type: (s.type === 'Dropoff' ? 'Dropoff' : 'Pickup') as 'Pickup' | 'Dropoff',
            status: ['Pending', 'Arrived', 'Completed'].includes(s.status) ? s.status : 'Pending',
            arrivedAt: this.parseDate(s.arrivedAt),
            completedAt: this.parseDate(s.completedAt),
            latitude: s.latitude != null ? Number(s.latitude) : null,
            longitude: s.longitude != null ? Number(s.longitude) : null,
            contactName: s.contactName ?? null,
            contactPhone: s.contactPhone ?? null,
            notes: s.notes ?? null,
          }))
        : undefined,
    };
  }

  /**
   * Upload proof of delivery (POD) for a stop.
   * Requires delivery photo (image). Signature is optional.
   * @param bookingId Booking ID
   * @param stopId Dropoff stop ID (from booking.stops)
   * @param imageUri Local URI of delivery photo (required)
   * @param signatureUri Optional local URI of signature image
   * @param recipientName Optional recipient name
   * @param notes Optional notes
   */
  async uploadPod(
    bookingId: string,
    stopId: string,
    imageUri: string,
    signatureUri?: string | null,
    recipientName?: string | null,
    notes?: string | null
  ): Promise<void> {
    const formData = new FormData();
    formData.append('Image', {
      uri: imageUri,
      name: 'delivery.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    if (signatureUri) {
      formData.append('Signature', {
        uri: signatureUri,
        name: 'signature.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
    }
    if (recipientName?.trim()) formData.append('RecipientName', recipientName.trim());
    if (notes?.trim()) formData.append('Notes', notes.trim());

    const response = await apiClient.post<{ success: boolean; message?: string; data?: unknown }>(
      `/api/bookings/${bookingId}/stops/${stopId}/pod`,
      {
        body: formData,
        requiresAuth: true,
      }
    );

    if (!response.success) {
      throw new Error(response.message ?? 'Failed to upload proof of delivery');
    }
  }

  /**
   * Mark a stop as arrived.
   */
  async arriveStop(bookingId: string, stopId: string): Promise<Booking> {
    const response = await apiClient.post<Booking>(`/api/bookings/${bookingId}/stops/${stopId}/arrive`, {
      requiresAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.message ?? 'Failed to mark stop as arrived');
    }

    return this.mapApiBookingToBooking(response.data);
  }

  /**
   * Complete an arrived stop.
   */
  async completeStop(bookingId: string, stopId: string): Promise<Booking> {
    const response = await apiClient.post<Booking>(`/api/bookings/${bookingId}/stops/${stopId}/complete`, {
      requiresAuth: true,
    });

    if (!response.success || !response.data) {
      throw new Error(response.message ?? 'Failed to complete stop');
    }

    return this.mapApiBookingToBooking(response.data);
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
      // Check if driver is under an operator (has tenantId and is not solo driver)
      const isDriverUnderOperator = user.tenantId !== null && !user.isSoloDriver;
      
      if (isDriverUnderOperator) {
        // Driver under operator: Get assigned dispatches only
        console.log('[BookingService] ===== FETCHING DISPATCHES FOR DRIVER =====');
        console.log('[BookingService] Driver ID:', user.id);
        console.log('[BookingService] Driver Role:', user.role);
        console.log('[BookingService] Is Solo Driver:', user.isSoloDriver);
        console.log('[BookingService] Tenant ID:', user.tenantId);
        console.log('[BookingService] API Endpoint: GET /api/dispatches/driver/' + user.id);
        
        const response = await apiClient.get<Dispatch[]>(
          `/api/dispatches/driver/${user.id}`,
          { requiresAuth: true }
        );
        
        console.log('[BookingService] ===== DISPATCHES API RESPONSE =====');
        console.log('[BookingService] Response Status:', response.statusCode);
        console.log('[BookingService] Response Success:', response.success);
        console.log('[BookingService] Response Message:', response.message);

        console.log('[BookingService] Dispatches response:', {
          success: response.success,
          statusCode: response.statusCode,
          hasData: !!response.data,
          dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
          dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
          dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        });

        if (!response.success || !response.data) {
          console.warn('[BookingService] No dispatches found or request failed');
          return [];
        }

        // Handle API response structure - backend wraps in ApiResponse<T>
        // Response structure: { success: true, data: DispatchDto[] }
        let dispatches: any[] = [];
        
        // Check if response.data is directly an array
        if (Array.isArray(response.data)) {
          dispatches = response.data;
        } 
        // Check if response.data is wrapped in another data property
        else if (response.data && typeof response.data === 'object') {
          // Check for items array (paginated response)
          if ('items' in response.data && Array.isArray((response.data as any).items)) {
            dispatches = (response.data as any).items;
          }
          // Check for nested data property
          else if ('data' in response.data && Array.isArray((response.data as any).data)) {
            dispatches = (response.data as any).data;
          }
          // If it's an object but not an array, log it for debugging
          else {
            console.warn('[BookingService] Unexpected response.data structure:', response.data);
          }
        }

        console.log('[BookingService] Processed dispatches count:', dispatches.length);

        // Map dispatches to bookings
        // Fetch bookings in parallel for better performance
        console.log('[BookingService] ===== FETCHING BOOKINGS FOR DISPATCHES =====');
        console.log('[BookingService] Total dispatches to process:', dispatches.length);
        
        const bookingPromises = dispatches.map(async (dispatch, index) => {
          console.log(`[BookingService] [${index + 1}/${dispatches.length}] Processing dispatch:`, {
            id: dispatch?.id,
            dispatchNumber: dispatch?.dispatchNumber,
            hasBooking: !!dispatch?.booking,
            bookingId: dispatch?.bookingId || dispatch?.booking?.id,
            dispatchKeys: dispatch ? Object.keys(dispatch) : [],
          });
          
          console.log(`[BookingService] [${index + 1}/${dispatches.length}] Fetching booking for ID:`, dispatch?.bookingId);
          const booking = await this.mapDispatchToBooking(dispatch);
          if (booking) {
            console.log(`[BookingService] [${index + 1}/${dispatches.length}] ✓ Successfully fetched booking:`, booking.id, booking.bookingNumber);
          } else {
            console.warn(`[BookingService] [${index + 1}/${dispatches.length}] ✗ Failed to map dispatch to booking:`, dispatch);
          }
          return booking;
        });

        const bookingResults = await Promise.all(bookingPromises);
        const bookings = bookingResults.filter((booking): booking is Booking => booking !== null);

        // Deduplicate bookings by ID to prevent duplicate key errors
        // This can happen if the same booking appears in multiple dispatches
        const uniqueBookings = Array.from(
          new Map(bookings.map((booking) => [booking.id, booking])).values()
        );

        if (bookings.length !== uniqueBookings.length) {
          console.warn(
            `[BookingService] Found ${bookings.length - uniqueBookings.length} duplicate bookings, deduplicated to ${uniqueBookings.length}`
          );
        }

        console.log('[BookingService] Mapped bookings count:', uniqueBookings.length);
        return uniqueBookings;
      } else {
        // Solo driver: Get bookings assigned to this driver (by SelectedDriverId)
        console.log('[BookingService] ===== FETCHING BOOKINGS FOR SOLO DRIVER =====');
        console.log('[BookingService] Driver ID:', user.id);
        console.log('[BookingService] Driver Role:', user.role);
        console.log('[BookingService] Is Solo Driver:', user.isSoloDriver);
        console.log('[BookingService] API Endpoint: GET /api/bookings/driver/' + user.id);
        
        const response = await apiClient.get<any>(
          `/api/bookings/driver/${user.id}`,
          { requiresAuth: true }
        );
        
        console.log('[BookingService] ===== BOOKINGS API RESPONSE =====');
        console.log('[BookingService] Response Status:', response.statusCode);
        console.log('[BookingService] Response Success:', response.success);
        console.log('[BookingService] Response Message:', response.message);

        console.log('[BookingService] Bookings response:', {
          success: response.success,
          statusCode: response.statusCode,
          hasData: !!response.data,
          dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
          dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        });

        if (!response.success || !response.data) {
          console.warn('[BookingService] No bookings found or request failed');
          return [];
        }

        // Handle API response structure
        let bookings: any[] = [];
        
        if (Array.isArray(response.data)) {
          bookings = response.data;
        } else if (response.data && typeof response.data === 'object') {
          if ('items' in response.data && Array.isArray((response.data as any).items)) {
            bookings = (response.data as any).items;
          } else if ('data' in response.data && Array.isArray((response.data as any).data)) {
            bookings = (response.data as any).data;
          } else {
            console.warn('[BookingService] Unexpected response.data structure:', response.data);
          }
        }

        console.log('[BookingService] Processed bookings count:', bookings.length);

        // Map API bookings to Booking type
        const mappedBookings = bookings
          .map((apiBooking) => {
            try {
              return this.mapApiBookingToBooking(apiBooking);
            } catch (error) {
              console.error('[BookingService] Error mapping booking:', error, apiBooking);
              return null;
            }
          })
          .filter((booking): booking is Booking => booking !== null);

        // Deduplicate bookings by ID
        const uniqueBookings = Array.from(
          new Map(mappedBookings.map((booking) => [booking.id, booking])).values()
        );

        console.log('[BookingService] Mapped bookings count:', uniqueBookings.length);
        return uniqueBookings;
      }
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

