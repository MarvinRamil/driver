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
   * GET /api/driver-offers/pending
   */
  async getPendingOffers(): Promise<DriverOffer[]> {
    try {
      const response = await apiClient.get<{ data: any[] }>('/api/driver-offers/pending', {
        requiresAuth: true,
      });

      if (!response.success || !response.data) {
        return [];
      }

      const data = response.data.data || response.data;
      const offers = Array.isArray(data) ? data : [];

      return offers.map((offer: any) => ({
        id: offer.id,
        bookingId: offer.bookingId,
        driverId: offer.driverId,
        status: offer.status || 'Pending',
        expiresAt: this.parseDate(offer.expiresAt) || new Date(),
        estimatedFare: offer.estimatedFare || offer.fare || 0,
        estimatedDistance: offer.estimatedDistance || offer.distance || 0,
        estimatedDuration: offer.estimatedDuration || offer.duration || 0,
        pickupLocation: offer.pickupLocation || offer.pickupAddress || '',
        dropoffLocation: offer.dropoffLocation || offer.dropoffAddress || '',
        pickupCoordinates: offer.pickupCoordinates,
        dropoffCoordinates: offer.dropoffCoordinates,
        paymentMethod: offer.paymentMethod || 'Cash',
        specialRequests: offer.specialRequests || [],
        customerRating: offer.customerRating || offer.riderRating, // Support both for backward compatibility
        cargoDescription: offer.cargoDescription || offer.cargo || '',
        truckType: offer.truckType || offer.requiredTruckType || '',
        createdAt: this.parseDate(offer.createdAt) || new Date(),
      }));
    } catch (error) {
      console.error('Failed to fetch pending offers:', error);
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

