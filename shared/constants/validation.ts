/**
 * Validation constants and limits for the driver app
 * Matches backend constraints for double validation (app + API)
 */

/** Character limits matching backend (IdentityAppDbContext, AddDriverVehicleInfo migration) */
export const LIMITS = {
  /** Vehicle license plate - backend max 20 */
  VEHICLE_PLATE: 20,
  /** Vehicle model - backend max 100 */
  VEHICLE_MODEL: 100,
  /** Vehicle color - backend max 50 */
  VEHICLE_COLOR: 50,
  /** Vehicle type - backend max 50 */
  VEHICLE_TYPE: 50,
  /** Full name - backend max 500 */
  FULL_NAME: 500,
  /** Email - Identity default ~256 */
  EMAIL: 256,
  /** Password min length (Identity requirement) */
  PASSWORD_MIN: 8,
  /** Security question answer min */
  SECURITY_ANSWER_MIN: 3,
  /** Security question answer max (reasonable limit) */
  SECURITY_ANSWER_MAX: 200,
  /** License number - reasonable limit */
  LICENSE_NUMBER: 50,
  /** Address - reasonable limit */
  ADDRESS: 500,
  /** OTP length */
  OTP_LENGTH: 6,
  /** Phone number */
  PHONE: 50,
} as const;

/** Regex for common validations */
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /**
   * Phone numbers:
   * - Local: 09XXXXXXXXX
   * - International: 639XXXXXXXXX
   */
  PHONE: /^(09\d{9}|639\d{9})$/,
  /** License plate: alphanumeric, hyphens, spaces (e.g. ABC-1234, XYZ 5678) */
  PLATE: /^[A-Za-z0-9\s\-]+$/,
} as const;

/** Trim and enforce max length */
export function trimToMax(value: string, max: number): string {
  return value.trim().slice(0, max);
}
