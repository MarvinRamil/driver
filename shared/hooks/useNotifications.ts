import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/shared/services/notificationService';
import { useAuth } from '@/features/auth';

/**
 * Hook for managing push notifications
 * Handles initialization, token registration, and notification handling
 */
export function useNotifications() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Initialize notifications when user is authenticated
    if (user) {
      notificationService.initialize().catch((error) => {
        console.error('Failed to initialize notifications:', error);
      });
    }

    // Setup notification listeners
    notificationService.setupListeners(
      // Notification received (foreground)
      (notification) => {
        console.log('Notification received:', notification);
        // You can show an in-app notification here if needed
      },
      // Notification tapped
      (response) => {
        try {
          const data = response.notification.request.content.data;
          console.log('Notification tapped:', data);

          // Handle deep linking based on notification data
          if (data?.type === 'booking-offer') {
            if (data.offerId) {
              router.push({
                pathname: '/accept-booking',
                params: { offerId: data.offerId },
              });
            }
          } else if (data?.type === 'dispatch') {
            if (data.dispatchId) {
              router.push({
                pathname: '/in-ride',
                params: { dispatchId: data.dispatchId },
              });
            }
          } else if (data?.type === 'manifest') {
            // Navigate to bookings or relevant screen
            router.push('/(tabs)');
          } else if (data?.type === 'booking_chat') {
            if (data.bookingId) {
              router.push({
                pathname: '/chat',
                params: { bookingId: data.bookingId as string, roomId: data.roomId as string | undefined },
              });
            }
          }
        } catch (error) {
          console.error('Error handling notification tap:', error);
          // Fallback to main screen on error
          try {
            router.push('/(tabs)');
          } catch (navError) {
            console.error('Error navigating to main screen:', navError);
          }
        }
      }
    );

    return () => {
      notificationService.removeListeners();
    };
  }, [user, router]);

  // Re-register token when user logs in
  useEffect(() => {
    if (user) {
      notificationService
        .getDeviceToken()
        .then((token) => {
          if (token) {
            notificationService.registerDeviceToken(token);
          }
        })
        .catch((error) => {
          console.error('Failed to register device token:', error);
        });
    } else {
      // Unregister when user logs out
      notificationService.unregisterDeviceToken();
    }
  }, [user]);

  return {
    // Expose methods if needed
  };
}

