import type { User } from '../types';

/**
 * Check if a user is allowed to use the driver app.
 * Only role "Driver" is accepted. All drivers are independent (no company/tenant).
 */
export function isAllowedRole(user: User | null): boolean {
  if (!user) {
    return false;
  }

  // Case 1: Solo drivers/owner-drivers
  // - Solo drivers (isSoloDriver === true)
  // - Owner-drivers (role === "Owner" AND isSoloDriver === true)
  // This excludes fleet owners who don't drive (role === "Owner" AND isSoloDriver === false)
  if (user.isSoloDriver) {
    return true;
  }

  // Case 2: Drivers under company/tenant
  // - Must be Driver role
  // - Must have tenantId (not null)
  // - Must NOT be solo driver
  if (
    user.role === 'Driver'
  ) {
    return true;
  }

  // All other roles are not allowed, including:
  // - Fleet owners who don't drive (role === "Owner" AND isSoloDriver === false)
  // - Admin, Dispatcher, Client, BusinessClient, SuperAdmin, etc.
  return false;
}

/**
 * Get a user-friendly error message for unauthorized roles.
 */
export function getRoleRestrictionMessage(user: User | null): string {
  if (!user) {
    return 'Access denied. Please login with a valid driver account.';
  }

  if (user.role !== 'Driver') {
    return 'This app is only for drivers. Please use the correct app for your account.';
  }

  if (!user.isOnboarded) {
    return 'Please complete your registration to continue.';
  }

  return 'Access denied. Your account role is not authorized for this app.';
}
