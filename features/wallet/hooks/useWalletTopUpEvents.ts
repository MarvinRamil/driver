import { useEffect, useRef } from 'react';
import { walletTopUpEventsService } from '../services/walletTopUpEventsService';

/**
 * Subscribe to real-time top-up paid events (SignalR).
 * When the backend receives a Xendit webhook and credits the wallet, this fires and you can refresh wallet/history.
 */
export function useWalletTopUpEvents(
  driverId: string | undefined,
  onTopUpPaid: () => void
): void {
  const onTopUpPaidRef = useRef(onTopUpPaid);
  onTopUpPaidRef.current = onTopUpPaid;

  useEffect(() => {
    if (!driverId) return;

    walletTopUpEventsService.start(driverId, () => {
      onTopUpPaidRef.current();
    });

    return () => {
      walletTopUpEventsService.stop();
    };
  }, [driverId]);
}
