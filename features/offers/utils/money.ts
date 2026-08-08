/**
 * Money formatting for the offers feature.
 *
 * Scoped here on purpose: the rest of the app formats pesos inline as `₱{x.toFixed(2)}`, and
 * converting those sites is a separate change. New offer code uses this so the earnings
 * breakdown stays internally consistent.
 */

/**
 * Format an amount as pesos.
 * @param amount - Amount in PHP
 * @returns Formatted string, e.g. "₱475.00"
 */
export function formatPeso(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}

/**
 * Format a deduction rate for display.
 *
 * The server sends `ratePercent` already multiplied out, so this only trims the trailing
 * ".0" that a whole percentage would otherwise show (5% rather than 5.0%).
 *
 * @param ratePercent - Rate as a percentage, e.g. 5
 * @returns Formatted string, e.g. "5%"
 */
export function formatRatePercent(ratePercent: number): string {
  const rounded = Math.round(ratePercent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}
