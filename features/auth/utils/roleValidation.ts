import type { User } from '../types';

/**
 * Check if a user has an allowed role for the drivers app
 * 
 * Allowed roles:
 * 1. Solo drivers/owner-drivers: isSoloDriver === true (includes solo drivers and owners who also drive)
 * 2. Drivers under company/tenant: role === "Driver" AND tenantId !== null AND isSoloDriver === false
 * 
 * Note: Fleet owners who are NOT drivers (role === "Owner" AND isSoloDriver === false) are NOT allowed
 * 
 * @param user - User object to check
 * @returns true if user has an allowed role, false otherwise
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
    user.role === 'Driver' &&
    user.tenantId !== null &&
    !user.isSoloDriver
  ) {
    return true;
  }

  // All other roles are not allowed, including:
  // - Fleet owners who don't drive (role === "Owner" AND isSoloDriver === false)
  // - Admin, Dispatcher, Client, BusinessClient, SuperAdmin, etc.
  return false;
}

/**
 * Get a user-friendly error message for unauthorized roles
 * @param user - User object (can be null)
 * @returns Error message explaining why access is denied
 */
export function getRoleRestrictionMessage(user: User | null): string {
  if (!user) {
    return 'Access denied. Please login with a valid driver account.';
  }

  // Provide specific messages based on role
  if (user.role === 'Owner' && !user.isSoloDriver) {
    return 'This app is only available for drivers. Fleet owners who do not drive should use the fleet management app instead.';
  }

  if (user.role === 'Admin' || user.role === 'Dispatcher') {
    return 'This app is only available for drivers. Please use the fleet management app instead.';
  }

  if (user.role === 'Client' || user.role === 'BusinessClient') {
    return 'This app is only available for drivers. Please use the customer app instead.';
  }

  if (user.role === 'SuperAdmin') {
    return 'This app is only available for drivers. Please use the admin portal instead.';
  }

  // For Driver role without proper setup
  if (user.role === 'Driver') {
    if (user.isSoloDriver && user.tenantId === null) {
      return 'Your account setup is incomplete. Please contact support.';
    }
    if (!user.isSoloDriver && user.tenantId === null) {
      return 'Your driver account is not associated with a company. Please contact support.';
    }
  }

  return 'Access denied. Your account role is not authorized for this app.';
}
