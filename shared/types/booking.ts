/**
 * Common booking types used across features
 * These types are shared and can be used by multiple features
 */

/**
 * Booking status enumeration
 * Matches API booking status values
 */
export type BookingStatus =
  | "Pending"
  | "Assigned"
  | "Broadcasting"
  | "Confirmed"
  | "Dispatched"
  | "OnTheWayToPickup"
  | "InProgress"
  | "Delivered"
  | "Completed"
  | "Cancelled";

/**
 * Assignment status enumeration
 * Indicates the assignment state of a booking
 */
export type AssignmentStatus =
  | "Unassigned"
  | "PendingAssignment"
  | "Assigned"
  | "AssignedToOperator"
  | "Broadcasting"
  | "BroadcastingToDrivers"
  | "AcceptedByDriver"
  | "RejectedByAllDrivers";

/**
 * Booking size classification
 */
export type BookingSize = "Small" | "Medium" | "Large";

/**
 * Truck type enumeration
 * Matches API truck type values
 */
export type TruckType =
  | "Small"
  | "Medium"
  | "Large"
  | "Flatbed"
  | "Refrigerated"
  | "Container"
  | "Closed Van"
  | "L300"
  | "Small Truck"
  | "Medium Truck"
  | "Large Truck";

/**
 * Location coordinates
 */
export interface LocationCoordinates {
  /** Latitude */
  latitude: number;
  /** Longitude */
  longitude: number;
}

/**
 * Delivery stop (pickup or dropoff) with id for POD upload
 */
export interface DeliveryStop {
  id: string;
  sequence: number;
  address: string;
  type: 'Pickup' | 'Dropoff';
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

/**
 * Booking entity interface
 * Represents a booking/order in the system
 */
export interface Booking {
  /** Unique booking identifier (Guid) */
  id: string;
  /** Human-readable booking number (e.g., "BK-20240101001") */
  bookingNumber: string;
  /** Customer ID (Guid) */
  customerId: string;
  /** Pickup location address */
  pickupLocation: string;
  /** Dropoff/delivery location address */
  dropoffLocation: string;
  /** Type of truck required */
  truckType: TruckType;
  /** Description of cargo being transported */
  cargoDescription: string;
  /** Scheduled pickup date and time (ISO 8601) */
  scheduleDate: Date;
  /** Current booking status */
  status: BookingStatus;
  /** Additional notes (nullable) */
  notes: string | null;
  /** When booking was created (ISO 8601) */
  createdAt: Date;
  /** When booking was last updated (ISO 8601, nullable) */
  updatedAt: Date | null;
  /** Booking size classification (nullable) */
  size: BookingSize | null;
  /** Assignment status */
  assignmentStatus: AssignmentStatus;
  /** ID of tenant assigned to handle booking (nullable) */
  assignedToTenantId: string | null;
  /** ID of user who assigned booking (nullable) */
  assignedByUserId: string | null;
  /** When booking was assigned (ISO 8601, nullable) */
  assignedAt: Date | null;
  /** Bee platform tenant ID (nullable) */
  beeTenantId: string | null;
  /** Weight of cargo in kilograms (nullable) */
  weightKg: number | null;
  /** GPS latitude of pickup location (nullable) */
  pickupLatitude: number | null;
  /** GPS longitude of pickup location (nullable) */
  pickupLongitude: number | null;
  /** GPS latitude of dropoff location (nullable) */
  dropoffLatitude: number | null;
  /** GPS longitude of dropoff location (nullable) */
  dropoffLongitude: number | null;

  // Legacy fields for backward compatibility
  /** Optional description of cargo (legacy - use cargoDescription) */
  description?: string;
  /** Optional weight in kg (legacy - use weightKg) */
  weight?: number;
  /** Optional driver ID assigned to this booking (legacy) */
  driverId?: string;
  /** Optional driver location coordinates (legacy) */
  driverLocation?: LocationCoordinates;
  /** Stops (pickup/dropoff) with ids for POD upload */
  stops?: DeliveryStop[];
}

/**
 * Dispatch entity interface
 * Represents a dispatch assignment for a driver
 */
export interface Dispatch {
  /** Unique dispatch identifier */
  id: string;
  /** Dispatch number */
  dispatchNumber: string;
  /** Booking ID associated with this dispatch */
  bookingId: string;
  /** Truck ID */
  truckId: string | null;
  /** Driver ID */
  driverId: string;
  /** Status */
  status: string;
  /** Departure time */
  departureTime: Date | null;
  /** Arrival time */
  arrivalTime: Date | null;
  /** Notes */
  notes: string | null;
  /** Associated booking */
  booking?: Booking;
}

/**
 * Booking statistics interface
 */
export interface BookingStats {
  /** Total number of bookings */
  total: number;
  /** Number of pending bookings */
  pending: number;
  /** Number of bookings in transit */
  inTransit: number;
  /** Number of completed bookings */
  completed: number;
}

