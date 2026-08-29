import { useCallback, useEffect, useRef, useState } from 'react';
import { matrixClient } from '../services/matrixClient';
import type { RoomInfo } from '../types';

/** ~45s of retries while the booking-creation/driver-assignment consumer catches up. */
const RESOLUTION_BACKOFF_MS = [1500, 3000, 6000, 12000, 12000, 12000];

/**
 * Resolves the Matrix room for a booking, independent of whether the chat screen
 * itself is open — so entry-point buttons can reflect enabled/disabled state.
 * Retries with backoff while the room is `not_provisioned` (e.g. right after a
 * booking is created, or before a driver has been assigned).
 */
export function useBookingChatRoom(bookingId: string | undefined, roomIdHint?: string) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(!!bookingId);
  const [error, setError] = useState<Error | null>(null);

  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

  const attemptResolve = useCallback(
    (currentGeneration: number) => {
      if (!bookingId) return;

      matrixClient
        .findRoomForBooking(bookingId)
        .then((info) => {
          if (!mountedRef.current || currentGeneration !== generationRef.current) return;

          if (info.state === 'not_provisioned') {
            if (attemptRef.current >= RESOLUTION_BACKOFF_MS.length) {
              setIsResolving(false);
              setError(new Error("Chat isn't ready yet for this booking."));
              return;
            }
            const delay = RESOLUTION_BACKOFF_MS[attemptRef.current];
            attemptRef.current += 1;
            timerRef.current = setTimeout(() => attemptResolve(currentGeneration), delay);
            return;
          }

          setRoom(info);
          setIsResolving(false);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!mountedRef.current || currentGeneration !== generationRef.current) return;
          setIsResolving(false);
          setError(err instanceof Error ? err : new Error('Failed to resolve chat room.'));
        });
    },
    [bookingId]
  );

  const retry = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    attemptRef.current = 0;
    setIsResolving(true);
    setError(null);
    generationRef.current += 1;
    attemptResolve(generationRef.current);
  }, [attemptResolve]);

  useEffect(() => {
    mountedRef.current = true;

    if (!bookingId) {
      setIsResolving(false);
      return;
    }

    matrixClient.startSyncLoop();
    if (roomIdHint) {
      matrixClient.seedKnownRoom(bookingId, roomIdHint);
    }

    attemptRef.current = 0;
    setIsResolving(true);
    setError(null);
    generationRef.current += 1;
    attemptResolve(generationRef.current);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      matrixClient.stopSyncLoop();
    };
    // attemptResolve is stable per bookingId; roomIdHint is only used to seed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, roomIdHint]);

  return { room, isResolving, error, retry };
}
