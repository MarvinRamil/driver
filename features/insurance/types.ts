/**
 * Driver-facing package-insurance types (issue #38), wired to the real backend (issue #104).
 *
 * This is package/cargo coverage — for the goods a driver carries, paid annually, priced by
 * vehicle type — not the driver's own vehicle insurance document
 * (`DriverApplication.InsurancePath`, unrelated and untouched by this feature).
 */

/**
 * Where a policy stands. `NotEnrolled` means no payment has ever landed; `Active` means the
 * current coverage year is paid; `Lapsed` means a covered year ran out without being renewed.
 */
export type InsurancePolicyStatus = 'NotEnrolled' | 'Active' | 'Lapsed';

/**
 * Mirrors the backend's `DriverPackageInsuranceStatusDto` exactly
 * (`GET /api/drivers/{driverId}/wallet/package-insurance`).
 */
export interface InsurancePolicy {
  driverId: string;
  vehicleType: string | null;
  /** Price for the next unpaid year. Null when no rate is configured for the vehicle type. */
  amountDue: number | null;
  /** 0 = never paid; N = years 1..N are covered. */
  paidThroughYearNumber: number;
  coverageStartDate: Date | null;
  coverageEndDate: Date | null;
  status: InsurancePolicyStatus;
}

/**
 * One row from the general wallet-transaction history, filtered to
 * `WalletTransactionType.PackageInsurancePayment` — there is no insurance-specific history
 * endpoint, so this reuses `walletService.getTransactions` with a type filter.
 */
export interface InsurancePaymentHistoryItem {
  id: string;
  amount: number;
  paidAt: Date;
  status: 'Completed' | 'Pending' | 'Failed';
}

/**
 * The QR that pays the next-due annual premium into the platform wallet. Mirrors the backend's
 * `PackageInsuranceQrDto` (`POST /api/drivers/{driverId}/wallet/package-insurance/qr`) — same
 * shape and same platform-wallet routing as `CashBondQr`.
 */
export interface InsuranceQr {
  qrString: string;
  qrImage: string;
  amount: number;
  referenceLabel: string;
  expiresAt: Date | null;
  /** Which policy year this QR settles. */
  policyYearNumber: number;
}
