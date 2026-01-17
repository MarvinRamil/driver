/**
 * Driver offers types
 */

export interface DriverOffer {
  id: string;
  bookingId: string;
  driverId: string;
  status: OfferStatus;
  expiresAt: Date;
  estimatedFare: number;
  estimatedDistance: number;
  estimatedDuration: number;
  pickupLocation: string;
  dropoffLocation: string;
  pickupCoordinates?: {
    latitude: number;
    longitude: number;
  };
  dropoffCoordinates?: {
    latitude: number;
    longitude: number;
  };
  paymentMethod: string;
  specialRequests?: string[];
  customerRating?: number;
  cargoDescription?: string;
  truckType?: string;
  createdAt: Date;
}

export type OfferStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Expired';

export interface AcceptOfferResponse {
  success: boolean;
  dispatchId?: string;
  message: string;
}

