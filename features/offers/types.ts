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
  /** Item length in cm (nullable) */
  itemLengthCm?: number | null;
  /** Item width in cm (nullable) */
  itemWidthCm?: number | null;
  /** Item height in cm (nullable) */
  itemHeightCm?: number | null;
  /** Estimated fare amount */
  estimatedFare: number;
  /** Final fare (null until completed) */
  finalFare?: number | null;
  /**
   * Server-computed earnings breakdown. Null when the offer has no priceable fare — the
   * backend withholds it rather than quoting ₱0.00, which would read as "this job pays
   * nothing" instead of "not priced yet". Callers must fall back to the gross fare.
   */
  earningDetails?: OfferEarningDetails | null;
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

/**
 * One deduction taken off the gross fare.
 *
 * Sent as a list rather than a single commission field so a second deduction (tips,
 * surcharges, penalties) can ship without an app release — render the array, never a
 * hardcoded row.
 */
export interface OfferEarningsDeduction {
  /** Display label, e.g. "Platform commission" */
  label: string;
  /** Fractional rate, e.g. 0.05 */
  rate: number;
  /** The same rate as a percentage, so clients need not multiply */
  ratePercent: number;
  /** Amount deducted */
  amount: number;
}

/**
 * Present only for cash offers. The driver collects the whole fare from the customer and the
 * platform's share is debited from their top-up wallet afterwards, so accepting a cash job
 * creates an obligation the driver should see before they take it.
 */
export interface OfferCashSettlement {
  /** What the driver collects from the customer, in full */
  collectedFromCustomer: number;
  /** What the platform will take back */
  owedToPlatform: number;
  /** Where the debit lands, e.g. "TopUpWallet" */
  settledFrom: string;
}

/**
 * What a driver actually takes home from an offer, computed server-side.
 *
 * Every amount here is authoritative and must be displayed verbatim — never recompute the
 * split in the client. The backend derives it from a single shared formula precisely so the
 * number quoted before accepting matches the number paid after completing.
 */
export interface OfferEarningDetails {
  /** Resolved payment method */
  paymentMethod: 'Cash' | 'Online';
  /**
   * False when no payment record existed yet and the method was inferred. Cash bookings
   * always have one by offer time, so an unconfirmed method is effectively an assumed
   * "Online" — hedge the label, not the cash warning.
   */
  paymentMethodConfirmed: boolean;
  /** ISO-ish currency code, e.g. "PHP" */
  currency: string;
  /** True while based on the estimated fare — must never be presented as a promise */
  isEstimate: boolean;
  /** The gross fare the split is taken from */
  baseEarnings: number;
  /** Deductions applied to the base */
  deductions: OfferEarningsDeduction[];
  /** Base minus deductions */
  netEarnings: number;
  /**
   * What the driver ends up with. Equal to netEarnings while commission is the only
   * deduction; kept distinct so adding one later is not a breaking change.
   */
  totalNetEarnings: number;
  /** Cash obligation (cash offers only) */
  cashSettlement?: OfferCashSettlement | null;
}

export interface AcceptOfferResponse {
  success: boolean;
  dispatchId?: string;
  message: string;
}

