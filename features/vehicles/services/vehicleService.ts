import { apiClient } from '@/shared/services/apiClient';
import type { VehiclePricingOption } from '../types';

/**
 * Vehicle catalog service. Reads the vehicle pricing table — the single source of truth
 * for which vehicle types a driver may register — via GET /api/vehicle-pricing.
 *
 * The endpoint is AllowAnonymous, so it is callable during registration before the
 * driver application exists.
 */
class VehicleService {
  /**
   * Fetch the vehicle types a driver can register for: active pricing rows only,
   * ordered cheapest-first so the list reads smallest vehicle to largest.
   */
  async getVehicleTypes(): Promise<VehiclePricingOption[]> {
    const response = await apiClient.get<VehiclePricingOption[] | { data: VehiclePricingOption[] }>(
      'api/vehicle-pricing',
      { requiresAuth: false }
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to load vehicle types');
    }

    // The backend wraps responses in { success, data }, and apiClient wraps again under
    // `data` — so the list usually sits at response.data.data. Tolerate both shapes.
    const payload = response.data;
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    return list
      .filter((option) => option.isActive !== false)
      .sort((a, b) => (a.baseFare ?? Infinity) - (b.baseFare ?? Infinity));
  }
}

export const vehicleService = new VehicleService();
