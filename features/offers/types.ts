/**
 * Driver offers types
 * Updated to match the new API structure with multi-stop support
 */

/**
 * Delivery stop information for multi-stop bookings
 */
export interface DeliveryStop {
  /** Stop sequence (0 = pickup, 1+ = dropoffs) */
  sequence: number;
  /** Full address */
  address: string;
  /** Stop type: "Pickup" or "Dropoff" */
  type: 'Pickup' | 'Dropoff';
  /** GPS latitude (nullable) */
  latitude?: number | null;
  /** GPS longitude (nullable) */
  longitude?: number | null;
  /** Contact person name (nullable) */
  contactName?: string | null;
  /** Contact phone number (nullable) */
  contactPhone?: string | null;
  /** Stop-specific notes (nullable) */
  notes?: string | null;
}

/**
 * Driver offer interface matching the API response
 */
export interface DriverOffer {
  /** Offer ID (Guid) */
  id: string;
  /** Booking ID (Guid) */
  bookingId: string;
  /** Driver ID (Guid) */
  driverId: string;
  /** Tenant/Company ID (Guid, nullable) */
  tenantId?: string | null;
  /** Offer status */
  status: OfferStatus;
  /** When the offer was created */
  offeredAt: Date;
  /** When driver responded (null if pending) */
  respondedAt?: Date | null;
  /** When the offer expires */
  expiresAt: Date;
  /** Queue position (lower = closer driver) */
  sequenceNumber: number;
  /** Distance from driver to pickup location in km (nullable) */
  distanceKm?: number | null;
  /** Whether driver is customer's favourite */
  isFavouriteDriver: boolean;
  /** Driver's average rating (nullable) */
  driverRating?: number | null;
  /** Estimated minutes to arrive at pickup (nullable) */
  estimatedArrivalMinutes?: number | null;
  /** Human-readable booking number */
  bookingNumber: string;
  /** Customer ID (Guid) */
  customerId: string;
  /** Customer name */
  customerName: string;
  /** Required vehicle type */
  vehicleType: string;
  /** Description of cargo */
  cargoDescription: string;
  /** Scheduled pickup date/time */
  scheduleDate: Date;
  /** Booking status */
  bookingStatus: string;
  /** Additional notes (nullable) */
  notes?: string | null;
  /** Cargo weight in kilograms (nullable) */
  weightKg?: number | null;
  /** Path to item image (nullable) */
  itemImagePath?: string | null;
  /** Estimated fare amount */
  estimatedFare: number;
  /** Final fare (null until completed) */
  finalFare?: number | null;
  /** Total route distance in km (nullable) */
  distanceKmTotal?: number | null;
  /** Multi-stop route information */
  stops: DeliveryStop[];
  
  // Legacy fields for backward compatibility
  /** @deprecated Use stops[0].address instead */
  pickupLocation?: string;
  /** @deprecated Use stops[stops.length - 1].address instead */
  dropoffLocation?: string;
  /** @deprecated Use stops[0].latitude/longitude instead */
  pickupCoordinates?: {
    latitude: number;
    longitude: number;
  };
  /** @deprecated Use stops[stops.length - 1].latitude/longitude instead */
  dropoffCoordinates?: {
    latitude: number;
    longitude: number;
  };
  /** @deprecated Use vehicleType instead */
  truckType?: string;
  /** @deprecated Use distanceKmTotal instead */
  estimatedDistance?: number;
  /** @deprecated Use estimatedArrivalMinutes instead */
  estimatedDuration?: number;
  /** @deprecated Use driverRating instead */
  customerRating?: number;
  /** @deprecated Use offeredAt instead */
  createdAt?: Date;
}

export type OfferStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Expired';

export interface AcceptOfferResponse {
  success: boolean;
  dispatchId?: string;
  message: string;
}

