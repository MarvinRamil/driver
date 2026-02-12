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
      const raw = response.data;
      let list: any[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        if (Array.isArray((raw as any).items)) list = (raw as any).items;
        else if (Array.isArray((raw as any).data)) list = (raw as any).data;
        else if ((raw as any).data && Array.isArray((raw as any).data.items)) list = (raw as any).data.items;
      }

      if (list.length === 0 && raw != null) {
        console.warn('[OfferService] Pending offers response had no array. Shape:', typeof raw, raw && typeof raw === 'object' ? Object.keys(raw) : raw);
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
          customerId: offer.customerId || '',
          customerName: offer.customerName || 'Customer',
          vehicleType: offer.vehicleType || offer.truckType || 'Medium',
        cargoDescription: offer.cargoDescription || offer.cargo || '',
          scheduleDate: scheduleDate || new Date(),
          bookingStatus: offer.bookingStatus || offer.status || 'Pending',
          notes: offer.notes || null,
          weightKg: offer.weightKg ?? null,
          itemImagePath: offer.itemImagePath || null,
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
      const response = await apiClient.post<{ dispatchId?: string }>(
        `/api/driver-offers/${offerId}/accept`,
        {
          requiresAuth: true,
        }
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to accept offer');
      }

      return {
        success: true,
        dispatchId: response.data?.dispatchId,
        message: response.message || 'Offer accepted successfully',
      };
    } catch (error) {
      console.error('Failed to accept offer:', error);
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

