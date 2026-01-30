import type { User } from '../types';

/**
 * Check if a user has an allowed role for the drivers app
 * 
 * Allowed roles:
 * 1. Solo drivers/owner-drivers: isSoloDriver === true (includes solo drivers and owners who also drive)
 * 2. Drivers under company/tenant: role === "Driver" AND tenantId !== null AND isSoloDriver === false
 * 3. Drivers in registration process: role === "Driver" AND not yet onboarded (allows completion of registration)
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

  // Case 3: Drivers in registration process (not yet onboarded)
  // - Must be Driver role
  // - Not yet onboarded (allows them to complete registration even without company)
  // This allows drivers who just registered to complete their onboarding
  if (
    user.role === 'Driver' &&
    !user.isOnboarded
  ) {
    return true;
  }

  // All other roles are not allowed, including:
  // - Fleet owners who don't drive (role === "Owner" AND isSoloDriver === false)
  // - Admin, Dispatcher, Client, BusinessClient, SuperAdmin, etc.
  // - Drivers who are onboarded but have no company and are not solo drivers
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
    // Drivers in registration process are allowed (handled by isAllowedRole)
    if (!user.isOnboarded) {
      return 'Please complete your registration to continue.';
    }
    // Onboarded drivers should have either solo driver status or company
    if (!user.isSoloDriver && user.tenantId === null) {
      return 'Your driver account is not associated with a company. Please contact support.';
    }
  }

  return 'Access denied. Your account role is not authorized for this app.';
}
