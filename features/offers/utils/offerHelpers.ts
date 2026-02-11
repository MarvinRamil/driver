import type { DriverOffer, DeliveryStop } from '../types';

/**
 * Utility functions for working with driver offers
 */

/**
 * Get the pickup stop from an offer
 * @param offer - Driver offer
 * @returns Pickup stop or null
 */
export function getPickupStop(offer: DriverOffer): DeliveryStop | null {
  return offer.stops.find(s => s.type === 'Pickup' || s.sequence === 0) || null;
}

/**
 * Get all dropoff stops from an offer
 * @param offer - Driver offer
 * @returns Array of dropoff stops
 */
export function getDropoffStops(offer: DriverOffer): DeliveryStop[] {
  return offer.stops.filter(s => s.type === 'Dropoff' || s.sequence > 0);
}

/**
 * Get pickup location address (supports both new stops array and legacy fields)
 * @param offer - Driver offer
 * @returns Pickup address string
 */
export function getPickupAddress(offer: DriverOffer): string {
  const pickupStop = getPickupStop(offer);
  return pickupStop?.address || offer.pickupLocation || 'Pickup location not specified';
}

/**
 * Get dropoff location address (supports both new stops array and legacy fields)
 * For multi-stop bookings, returns the last dropoff address
 * @param offer - Driver offer
 * @returns Dropoff address string
 */
export function getDropoffAddress(offer: DriverOffer): string {
  const dropoffs = getDropoffStops(offer);
  const lastDropoff = dropoffs.length > 0 ? dropoffs[dropoffs.length - 1] : null;
  return lastDropoff?.address || offer.dropoffLocation || 'Dropoff location not specified';
}

/**
 * Check if offer has multiple dropoff stops
 * @param offer - Driver offer
 * @returns True if multiple dropoffs, false otherwise
 */
export function isMultiStopOffer(offer: DriverOffer): boolean {
  return getDropoffStops(offer).length > 1;
}

/**
 * Calculate time remaining until offer expires
 * @param offer - Driver offer
 * @returns Seconds remaining (0 if expired)
 */
export function getTimeRemaining(offer: DriverOffer): number {
  const expires = new Date(offer.expiresAt);
  const now = new Date();
  const remaining = Math.floor((expires.getTime() - now.getTime()) / 1000);
  return Math.max(0, remaining);
}

/**
 * Check if offer is expired
 * @param offer - Driver offer
 * @returns True if expired, false otherwise
 */
export function isOfferExpired(offer: DriverOffer): boolean {
  return getTimeRemaining(offer) === 0;
}

/**
 * Filter out expired offers
 * @param offers - Array of offers
 * @returns Array of non-expired offers
 */
export function filterValidOffers(offers: DriverOffer[]): DriverOffer[] {
  return offers.filter(offer => !isOfferExpired(offer) && offer.status === 'Pending');
}

