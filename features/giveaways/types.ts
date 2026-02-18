export interface Giveaway {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  rewardDetails?: string | null;
  isActive: boolean;
  imageUrl?: string | null;
}
