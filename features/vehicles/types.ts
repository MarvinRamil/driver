/**
 * Vehicle pricing API types (GET /api/vehicle-pricing)
 *
 * The vehicle pricing table is the single source of truth for which vehicle types exist.
 * A driver may only register a type that has an active pricing row — otherwise no booking
 * in that class can be priced and the driver can never be matched.
 */

/** One active vehicle pricing row, limited to the fields the driver app needs. */
export interface VehiclePricingOption {
  /** Canonical vehicle type — the value submitted to the backend (e.g. "L300"). */
  vehicleType: string;
  /** Human-readable label (e.g. "L300 / Cargo Van"). May be "-" or absent. */
  types?: string | null;
  /** Base fare; used to order the list cheapest-first. */
  baseFare?: number;
  /** Inactive rows are filtered out; absent means active. */
  isActive?: boolean;
  /** Max dimensions, e.g. "240x140x130 cm". */
  sizeLimit?: string | null;
  /** Max payload in kilograms. */
  weightLimitKg?: number;
}

/**
 * Used only when GET /api/vehicle-pricing cannot be reached, so a driver on a bad
 * connection can still complete registration.
 *
 * Mirrors the seeded pricing rows in bee-backend `src/BeeLogistics.Api/DbSeeder.cs`
 * exactly — same types, same labels, same order. It must never contain a type that has
 * no pricing row: the backend validates against the live table and would reject it.
 * When pricing changes, this list is stale until updated, which is why it is a last
 * resort rather than the primary source.
 */
export const FALLBACK_VEHICLE_TYPES: VehiclePricingOption[] = [
  { vehicleType: 'Motorcycle', types: '-', baseFare: 49 },
  { vehicleType: 'Sedan', types: 'Hatchback/Sedan', baseFare: 100 },
  { vehicleType: 'SUV', types: 'Subcompact SUV / Crossover', baseFare: 115 },
  { vehicleType: 'Van', types: '7-seater SUV / Small Van', baseFare: 200 },
  { vehicleType: 'Pickup', types: 'Pickup', baseFare: 240 },
  { vehicleType: 'L300', types: 'L300 / Cargo Van', baseFare: 280 },
  { vehicleType: 'FB2000', types: 'FB', baseFare: 900 },
  { vehicleType: 'Aluminum2000', types: 'Aluminum', baseFare: 1040 },
  { vehicleType: 'Truck3000', types: 'Aluminum', baseFare: 1450 },
  { vehicleType: 'Truck7000', types: 'Aluminum', baseFare: 4420 },
  { vehicleType: 'Truck12000', types: 'Aluminum / Wing Van', baseFare: 7200 },
];

/**
 * Display label for a vehicle option. Several rows share a `types` label ("Aluminum" is
 * used by three), and Motorcycle's is literally "-", so the canonical `vehicleType` is
 * appended to keep every chip distinguishable.
 */
export function vehicleOptionLabel(option: VehiclePricingOption): string {
  const label = option.types?.trim();
  if (!label || label === '-' || label.toLowerCase() === option.vehicleType.toLowerCase()) {
    return option.vehicleType;
  }
  return `${option.vehicleType} · ${label}`;
}
