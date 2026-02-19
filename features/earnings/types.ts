export interface DriverEarnings {
  totalEarnings: number;
  period: string;
  trips: number;
  onlineHours: number;
  dailyBreakdown: DailyEarning[];
  weeklyBreakdown?: WeeklyEarning[];
  monthlyBreakdown?: MonthlyEarning[];
  /** Period-specific totals from API (for Today / Week / Month selector) */
  today?: number;
  thisWeek?: number;
  thisMonth?: number;
}

export interface DailyEarning {
  date: Date;
  earnings: number;
  trips: number;
}

export interface WeeklyEarning {
  week: string;
  earnings: number;
  trips: number;
}

export interface MonthlyEarning {
  month: string;
  earnings: number;
  trips: number;
}

export type EarningsPeriod = 'Today' | 'Week' | 'Month';

/** Single row from GET /api/drivers/{id}/earnings/history (5% breakdown) */
export interface EarningsHistoryItem {
  bookingId: string;
  date: Date;
  paymentMethod: string;
  grossAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  netAmount: number;
}

/** Response from GET /api/drivers/{id}/earnings/history */
export interface DriverEarningsHistory {
  items: EarningsHistoryItem[];
  totalGross: number;
  totalPlatformFee: number;
  totalNet: number;
}

