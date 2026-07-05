import { apiClient } from '@/shared/services/apiClient';

export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  referralLink: string;
  createdAt: string;
}

export interface UserPoints {
  id: string;
  userId: string;
  totalPoints: number;
  availablePoints: number;
  pendingPoints: number;
  lastUpdatedAt?: string | null;
}

export interface ReferralEntry {
  id: string;
  referrerId: string;
  referredUserId: string;
  status: string;
  referredAt: string;
  completedAt?: string | null;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export const referralService = {
  async getMyCode(userId: string): Promise<ReferralCode> {
    const res = await apiClient.get<Envelope<ReferralCode>>(`api/referrals/code/${userId}`, {
      requiresAuth: true,
    });
    return res.data.data;
  },

  async getQrCode(userId: string): Promise<{ qrCode: string; referralLink: string }> {
    const res = await apiClient.get<{ qrCode: string; referralLink: string }>(
      `api/referrals/code/${userId}/qr`,
      { requiresAuth: true }
    );
    return res.data;
  },

  async getPoints(userId: string): Promise<UserPoints> {
    const res = await apiClient.get<Envelope<UserPoints>>(`api/referrals/${userId}/points`, {
      requiresAuth: true,
    });
    return res.data.data;
  },

  async getReferrals(userId: string): Promise<ReferralEntry[]> {
    const res = await apiClient.get<Envelope<ReferralEntry[]>>(`api/referrals/${userId}/referrals`, {
      requiresAuth: true,
    });
    return res.data.data ?? [];
  },
};
