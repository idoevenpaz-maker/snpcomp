export interface DailyPricePoint {
  date: string; // YYYY-MM-DD
  prices: Record<string, number>; // Close price for each user ticker + SPY + QQQ + VXUS
}

export interface StockApiResponse {
  tickers: string[];
  invalidTickers?: string[];
  benchmarks: {
    sp500: string;
    nasdaq: string;
    vxus: string;
  };
  requestedStartDate: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  adjustedStartDate: string | null;
  adjustedReason?: string | null;
  source: 'yahoo' | 'fallback';
  series: DailyPricePoint[];
}

export type ComparisonMode = 'individual' | 'portfolio';
export type BenchmarkView = 'separate' | 'combined';
export type MetricType = 'percentage' | 'dollar';
export type TimeframePreset = '1M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX' | 'CUSTOM';

export interface PerformanceRow {
  symbol: string;
  label: string;
  type: 'stock' | 'portfolio' | 'benchmark';
  color: string;
  weightPct?: number;
  initialDollar?: number;
  finalDollar?: number;
  startPrice: number;
  endPrice: number;
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  volatilityPct: number;
  alphaVsSp500Pct: number;
}
