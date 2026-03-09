// Export hooks
export { useOffers } from './hooks/useOffers';

// Export services
export { offerService } from './services/offerService';

// Export types
export type { DriverOffer, DeliveryStop, OfferStatus, AcceptOfferResponse } from './types';

// Export components
export { OfferDetailsModal } from './components/OfferDetailsModal';

// Export utility functions
export {
  getPickupStop,
  getDropoffStops,
  getPickupAddress,
  getDropoffAddress,
  isMultiStopOffer,
  getTimeRemaining,
  isOfferExpired,
  filterValidOffers,
} from './utils/offerHelpers';

