import { apiClient } from '@/shared/services/apiClient';
import type { DriverOffer, AcceptOfferResponse } from '../types';

class OfferService {
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Get pending offers for current driver
   * GET /api/driver-offers/pending?limit={limit}
   * 
   * @param limit - Maximum number of offers to return (default: 3, max: 10)
   * @returns Promise resolving to array of driver offers
   */
  async getPendingOffers(limit: number = 3): Promise<DriverOffer[]> {
    try {
      // Ensure limit is within valid range (1-10)
      const validLimit = Math.max(1, Math.min(10, limit));
      
      const response = await apiClient.get<DriverOffer[] | { items?: any[]; data?: any[] }>('/api/driver-offers/pending', {
        params: { limit: validLimit },
        requiresAuth: true,
      });

      if (!response.success) {
        return [];
      }

      // Extract list from common API response shapes: array, { items }, { data }, { data: { items } }
      // Handle nested ApiResponse wrapper: { success, data, message, errors }
      const raw = response.data;
      let list: any[] = [];
      
      // Check if raw is a nested ApiResponse wrapper: { success, data, message, errors }
      if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
        const nestedSuccess = (raw as any).success;
        const nestedData = (raw as any).data;
        
        // If nested response indicates failure, return empty (no offers or error)
        if (nestedSuccess === false) {
          return [];
        }
        
        // If nested data is an array, use it
        if (Array.isArray(nestedData)) {
          list = nestedData;
        } else {
          // nestedData is null, undefined, or non-array (e.g., empty object) = no offers
          return [];
        }
      } else if (Array.isArray(raw)) {
        // Direct array response
        list = raw;
      } else if (raw && typeof raw === 'object') {
        // Try other common shapes
        if (Array.isArray((raw as any).items)) {
          list = (raw as any).items;
        } else if (Array.isArray((raw as any).data)) {
          list = (raw as any).data;
        } else if ((raw as any).data && Array.isArray((raw as any).data.items)) {
          list = (raw as any).data.items;
        }
      } else if (raw === null || raw === undefined) {
        // No data - return empty array (no offers)
        return [];
      }

      // Only warn if we got an unexpected structure (not null/undefined/empty array)
      if (list.length === 0 && raw != null && raw !== undefined && !Array.isArray(raw)) {
        const keys = raw && typeof raw === 'object' ? Object.keys(raw) : [];
        // Check if it's a nested response with null data (this is fine - no offers)
        if ('success' in raw && 'data' in raw && (raw as any).data === null) {
          return [];
        }
        console.warn('[OfferService] Pending offers response had no array. Shape:', typeof raw, keys);
        // If it's an error response nested in data, log the message
        if ('message' in raw || 'errors' in raw) {
          console.warn('[OfferService] Response may be an error:', {
            message: (raw as any).message,
            errors: (raw as any).errors,
            success: (raw as any).success,
          });
        }
        return [];
      }

      return list.map((offer: any) => {
        // Parse dates
        const expiresAt = this.parseDate(offer.expiresAt);
        const offeredAt = this.parseDate(offer.offeredAt);
        const respondedAt = offer.respondedAt ? this.parseDate(offer.respondedAt) : null;
        const scheduleDate = this.parseDate(offer.scheduleDate);

        // Parse stops array (multi-stop support)
        const stops: any[] = Array.isArray(offer.stops) ? offer.stops : [];

        // Extract pickup and dropoff from stops for backward compatibility
        const pickupStop = stops.find(s => s.type === 'Pickup' || s.sequence === 0);
        const dropoffStops = stops.filter(s => s.type === 'Dropoff' || s.sequence > 0);
        const lastDropoff = dropoffStops[dropoffStops.length - 1];

        // Customer/booker name: try camelCase, PascalCase, nested booking, and common API variants
        const rawName = offer.customerName ?? offer.CustomerName ?? offer.bookerName ?? offer.BookerName
          ?? offer.senderName ?? offer.SenderName
          ?? (offer.booking && (offer.booking.customerName ?? offer.booking.CustomerName ?? offer.booking.bookerName ?? offer.booking.BookerName ?? offer.booking.senderName ?? offer.booking.SenderName));
        const customerName = (rawName != null && String(rawName).trim() !== '') ? String(rawName).trim() : 'Customer';

        return {
        id: offer.id,
        bookingId: offer.bookingId,
        driverId: offer.driverId,
          tenantId: offer.tenantId || null,
        status: offer.status || 'Pending',
          offeredAt: offeredAt || new Date(),
          respondedAt: respondedAt,
          expiresAt: expiresAt || new Date(),
          sequenceNumber: offer.sequenceNumber || 0,
          distanceKm: offer.distanceKm ?? null,
          isFavouriteDriver: offer.isFavouriteDriver || false,
          driverRating: offer.driverRating ?? null,
          estimatedArrivalMinutes: offer.estimatedArrivalMinutes ?? null,
          bookingNumber: offer.bookingNumber || `BKG-${offer.bookingId?.slice(0, 8) || 'UNKNOWN'}`,
          customerId: offer.customerId ?? offer.CustomerId ?? offer.booking?.customerId ?? offer.booking?.CustomerId ?? '',
          customerName,
          vehicleType: offer.vehicleType || offer.truckType || 'Medium',
        cargoDescription: offer.cargoDescription || offer.cargo || '',
          scheduleDate: scheduleDate || new Date(),
          bookingStatus: offer.bookingStatus || offer.status || 'Pending',
          notes: offer.notes || null,
          weightKg: offer.weightKg ?? null,
          itemImagePath: offer.itemImagePath || null,
          itemLengthCm: offer.itemLengthCm != null && !isNaN(Number(offer.itemLengthCm)) ? Number(offer.itemLengthCm) : null,
          itemWidthCm: offer.itemWidthCm != null && !isNaN(Number(offer.itemWidthCm)) ? Number(offer.itemWidthCm) : null,
          itemHeightCm: offer.itemHeightCm != null && !isNaN(Number(offer.itemHeightCm)) ? Number(offer.itemHeightCm) : null,
          estimatedFare: offer.estimatedFare ?? offer.fare ?? 0,
          finalFare: offer.finalFare ?? null,
          distanceKmTotal: offer.distanceKmTotal ?? offer.distanceKm ?? null,
          stops: stops.map((stop: any) => ({
            sequence: stop.sequence ?? 0,
            address: stop.address || '',
            type: stop.type || (stop.sequence === 0 ? 'Pickup' : 'Dropoff'),
            latitude: stop.latitude ?? null,
            longitude: stop.longitude ?? null,
            contactName: stop.contactName || null,
            contactPhone: stop.contactPhone || null,
            notes: stop.notes || null,
          })),
          
          // Legacy fields for backward compatibility
          pickupLocation: pickupStop?.address || offer.pickupLocation || offer.pickupAddress || '',
          dropoffLocation: lastDropoff?.address || offer.dropoffLocation || offer.dropoffAddress || '',
          pickupCoordinates: pickupStop?.latitude && pickupStop?.longitude ? {
            latitude: pickupStop.latitude,
            longitude: pickupStop.longitude,
          } : offer.pickupCoordinates,
          dropoffCoordinates: lastDropoff?.latitude && lastDropoff?.longitude ? {
            latitude: lastDropoff.latitude,
            longitude: lastDropoff.longitude,
          } : offer.dropoffCoordinates,
          truckType: offer.vehicleType || offer.truckType || offer.requiredTruckType || '',
          estimatedDistance: offer.distanceKmTotal ?? offer.distanceKm ?? offer.estimatedDistance ?? 0,
          estimatedDuration: offer.estimatedArrivalMinutes ?? offer.estimatedDuration ?? offer.duration ?? 0,
          customerRating: offer.customerRating ?? offer.riderRating ?? null,
          createdAt: offeredAt || new Date(),
        };
      });
    } catch (error) {
      console.error('[OfferService] Failed to fetch pending offers:', error);
      throw new Error(
        `Failed to fetch offers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Accept an offer
   * POST /api/driver-offers/{id}/accept
   */
  async acceptOffer(offerId: string): Promise<AcceptOfferResponse> {
    try {
      const response = await apiClient.post<{ success?: boolean; dispatchId?: string; data?: { dispatchId?: string }; message?: string }>(
        `/api/driver-offers/${offerId}/accept`,
        {
          body: {},
          requiresAuth: true,
        }
      );

      // Check both HTTP success and optional nested success in body
      if (!response.success) {
        throw new Error(response.message || 'Failed to accept offer');
      }
      const body = response.data as Record<string, unknown> | null;
      if (body && body.success === false) {
        throw new Error((body.message as string) || 'Failed to accept offer');
      }

      const dispatchId = body?.dispatchId ?? (body?.data as Record<string, unknown> | undefined)?.dispatchId;

      return {
        success: true,
        dispatchId: typeof dispatchId === 'string' ? dispatchId : undefined,
        message: (body?.message as string) || response.message || 'Offer accepted successfully',
      };
    } catch (error) {
      console.error('[OfferService] Failed to accept offer:', { offerId, error });
      throw new Error(
        `Failed to accept offer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Reject an offer
   * POST /api/driver-offers/{id}/reject
   */
  async rejectOffer(offerId: string): Promise<void> {
    try {
      const response = await apiClient.post(`/api/driver-offers/${offerId}/reject`, {
        body: {},
        requiresAuth: true,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to reject offer');
      }
    } catch (error) {
      console.error('Failed to reject offer:', error);
      throw new Error(
        `Failed to reject offer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const offerService = new OfferService();

