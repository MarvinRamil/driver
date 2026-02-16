export type CampaignType = 'Giveaway' | 'News' | 0 | 1;

export interface CampaignItem {
  id: string;
  type: CampaignType;
  title: string;
  body: string;
  startDate: string;
  endDate: string;
  ctaText?: string | null;
  ctaRoute?: string | null;
  imageUrl?: string | null;
}
