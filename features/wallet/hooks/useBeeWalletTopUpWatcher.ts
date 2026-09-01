import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';

/** How often to ask while the driver is actually watching the QR. */
const POLL_MS = 3000;

/** Stop after this long. A QR left open all day should not poll all day. */
const MAX_WATCH_MS = 10 * 60 * 1000;

/**
 * Watches for a BeeWallet top-up to land while the QR is on screen, and says so the moment it does.
 *
 * Polling, because there is nothing to push. PayMongo emits transaction events on the **child**
 * account, and only onboarding events reach the platform's webhook — so the SignalR channel that
 * carries checkout top-ups (`useWalletTopUpEvents`) never fires for a QR paid into a driver's own
 * wallet. The balance endpoint reads PayMongo directly, which makes it the only thing that sees the
 * money arrive at all.
 *
 * The cost is bounded by construction: it runs only while the modal is open, stops on close, and
 * gives up after ten minutes. A driver staring at a QR is precisely when a live read is worth
 * paying for.
 *
 * @param active Whether the QR is on screen.
 * @param onArrived Called once, with the amount that landed.
 */
export function useBeeWalletTopUpWatcher(
  active: boolean,
  onArrived: (amount: number) => void,
): void {
  const { user } = useAuth();
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  useEffect(() => {
    if (!active || !user?.id) return;

    // Captured on open, so only money arriving *after* the driver started looking counts.
    let baseline: number | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelled) return;

      try {
        const balance = await payMongoOnboardingService.getWithdrawable(user.id);
        if (cancelled) return;

        const current = balance.balance;
        if (baseline === null) {
          baseline = current;
        } else if (current > baseline) {
          // Fire once and stop; the caller closes the QR.
          cancelled = true;
          onArrivedRef.current(current - baseline);
          return;
        }
      } catch {
        // A failed poll is not worth surfacing: the QR is still valid and the next tick retries.
        // Showing an error here would make a transient network blip look like a failed payment.
      }

      if (!cancelled && Date.now() - startedAt < MAX_WATCH_MS) {
        timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, user?.id]);
}
