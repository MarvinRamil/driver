export interface DriverEarnings {
  totalEarnings: number;
  period: string;
  trips: number;
  onlineHours: number;
  dailyBreakdown: DailyEarning[];
  weeklyBreakdown?: WeeklyEarning[];
  monthlyBreakdown?: MonthlyEarning[];
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

