import * as signalR from '@microsoft/signalr';
import { apiClient } from '@/shared/services/apiClient';

export interface TopUpPaidPayload {
  topUpId: string;
  driverId: string;
  amount: number;
  status: string;
  personalBalance: number;
  topUpBalance: number;
  paidAtUtc: string;
}

/**
 * Connects to the notifications hub and joins the driver's wallet group
 * so we receive TopUpPaid when the webhook is processed (SSE/SignalR).
 */
class WalletTopUpEventsService {
  private connection: signalR.HubConnection | null = null;
  private apiBaseUrl: string;
  private driverId: string | null = null;

  constructor() {
    this.apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://localhost:5001';
    this.apiBaseUrl = this.apiBaseUrl.replace(/\/api$/, '');
  }

  /**
   * Start connection and join driver group. Call when wallet screen is focused and driverId is available.
   */
  async start(driverId: string, onTopUpPaid: (payload: TopUpPaidPayload) => void): Promise<void> {
    if (this.driverId === driverId && this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    // Must go through apiClient: under Clerk the legacy token store is empty, so reading it
    // directly made this return early every time and TopUpPaid never arrived.
    const token = await apiClient.getAuthToken();
    if (!token) return;

    if (this.connection) {
      this.connection.off('TopUpPaid');
      if (this.driverId !== driverId) {
        await this.connection.stop();
        this.connection = null;
      }
    }

    this.driverId = driverId;

    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${this.apiBaseUrl}/hubs/notifications`, {
          accessTokenFactory: async () => (await apiClient.getAuthToken()) || '',
        })
        .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 3000 })
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      try {
        await this.connection.start();
      } catch (err) {
        console.warn('Wallet TopUp events SignalR connect failed:', err);
        this.connection = null;
        return;
      }
    }

    this.connection.on('TopUpPaid', (data: TopUpPaidPayload) => {
      onTopUpPaid(data);
    });

    try {
      await this.connection.invoke('JoinGroup', `driver-${driverId}`);
    } catch (err) {
      console.warn('Wallet TopUp events JoinGroup failed:', err);
    }
  }

  /**
   * Stop connection. Call when leaving wallet screen if you want to disconnect.
   */
  async stop(): Promise<void> {
    if (this.connection) {
      this.connection.off('TopUpPaid');
      try {
        await this.connection.stop();
      } catch (_) {}
      this.connection = null;
    }
    this.driverId = null;
  }
}

export const walletTopUpEventsService = new WalletTopUpEventsService();
