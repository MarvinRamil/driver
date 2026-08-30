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

/**
 * Converts a Philippine mobile number to E.164 (`+63…`), or null if it cannot be understood.
 *
 * Needed because this app's own convention (see `PATTERNS.PHONE`) is `09XXXXXXXXX` or
 * `639XXXXXXXXX` — **neither carries a `+`** — while PayMongo rejects anything that does not:
 * *"mobile number must start with + followed by 4 to 15 digits"*. That rejection lands on the
 * account update, after the child account already exists, so it is worth normalising before we
 * ever call them.
 *
 * Returns null rather than guessing at an unrecognised shape: a wrong number is frozen onto the
 * account at activation, and silently "fixing" one into a different valid number is worse than
 * asking the driver to check it.
 */
export function toE164Ph(input: string | null | undefined): string | null {
  if (!input) return null;

  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Already international: keep the country code they gave and just check the length PayMongo wants.
  if (raw.startsWith('+')) {
    return digits.length >= 4 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;   // 09171234567
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;             // 639171234567
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;             // 9171234567

  // Unrecognised. Do not invent a country code.
  return null;
}

/** Trim and enforce max length */
export function trimToMax(value: string, max: number): string {
  return value.trim().slice(0, max);
}
