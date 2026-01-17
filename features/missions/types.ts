export interface DriverMission {
  id: string;
  title: string;
  description: string;
  status: MissionStatus;
  reward: number;
  progress: number;
  target: number;
  expiresAt: Date | null;
  completedAt: Date | null;
  claimedAt: Date | null;
  icon?: string;
}

export type MissionStatus = 'Active' | 'Available' | 'Completed' | 'Claimed';

