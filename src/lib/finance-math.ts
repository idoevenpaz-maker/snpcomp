import { differenceInCalendarDays, parseISO } from 'date-fns';
import { DailyPricePoint, MetricType, PerformanceRow } from './types';

export const STOCK_COLORS = [
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
  '#e11d48', // rose-600
  '#d97706', // amber-600
  '#0d9488', // teal-600
  '#ea580c', // orange-600
  '#4f46e5', // indigo-600
  '#9333ea', // purple-600
];

export const PORTFOLIO_COLOR = '#0284c7'; // sky-600
export const SP500_COLOR = '#059669'; // emerald-600
export const NASDAQ_COLOR = '#ea580c'; // orange-600
export const VXUS_COLOR = '#db2777'; // pink-600

export const COMBINED_BENCH_COLOR = '#1e293b'; // slate-800

export const PORTFOLIO_KEY = 'PORTFOLIO_EQ';
export const COMBINED_BENCH_KEY = 'BENCH_MIX';

/** Weights (%) per benchmark symbol for the blended "Combined Benchmark" line. */
export type BenchmarkMix = Record<string, number>;

/** Short label such as "SPY 60% · QQQ 20% · VXUS 20%" (weights normalized to 100%). */
export function describeBenchmarkMix(mix: BenchmarkMix): string {
  const symbols = Object.keys(mix);
  const norm = resolveNormalizedWeights(symbols, mix);
  return symbols
    .filter((s) => (norm[s] ?? 0) > 0)
    .map((s) => `${s} ${Math.round((norm[s] ?? 0) * 100)}%`)
    .join(' · ');
}

/** Value ratio (P_t / P_0) of a buy-and-hold basket on one day. */
function basketRatio(
  prices: Record<string, number>,
  basePrices: Record<string, number>,
  normWeights: Record<string, number>
): number {
  let ratio = 0;
  for (const [sym, w] of Object.entries(normWeights)) {
    const p0 = basePrices[sym] || 1;
    const pt = prices[sym] ?? p0;
    ratio += w * (pt / p0);
  }
  return ratio;
}

export interface ChartDataPoint {
  date: string;
  [symbol: string]: number | string;
}

/**
 * Resolves normalized fractional weights (summing to 1.0) for the given tickers.
 * Falls back to equal weights (1 / N) if all weights are zero or undefined.
 */
export function resolveNormalizedWeights(
  userTickers: string[],
  customWeights?: Record<string, number>
): Record<string, number> {
  const n = userTickers.length;
  if (n === 0) return {};

  if (!customWeights) {
    const eq = 1 / n;
    return Object.fromEntries(userTickers.map((t) => [t, eq]));
  }

  let total = 0;
  for (const t of userTickers) {
    const w = Number(customWeights[t]);
    if (!isNaN(w) && w > 0) {
      total += w;
    }
  }

  if (total <= 0) {
    const eq = 1 / n;
    return Object.fromEntries(userTickers.map((t) => [t, eq]));
  }

  const normalized: Record<string, number> = {};
  for (const t of userTickers) {
    const w = Number(customWeights[t]);
    normalized[t] = !isNaN(w) && w > 0 ? w / total : 0;
  }
  return normalized;
}

/**
 * Normalizes aligned daily price series into either Percentage Return (%)
 * or Growth of Total Investment ($), and computes the Weighted Portfolio series.
 */
export function buildNormalizedChartData(
  series: DailyPricePoint[],
  userTickers: string[],
  sp500Symbol: string,
  nasdaqSymbol: string,
  vxusSymbol: string,
  metric: MetricType,
  customWeights?: Record<string, number>,
  initialCapital: number = 10000,
  benchmarkMix?: BenchmarkMix
): ChartDataPoint[] {
  if (!series || series.length === 0) return [];

  const basePrices = series[0].prices;
  const allSymbols = Array.from(
    new Set([...userTickers, sp500Symbol, nasdaqSymbol, vxusSymbol])
  );
  const normWeights = resolveNormalizedWeights(userTickers, customWeights);
  const mixWeights = benchmarkMix
    ? resolveNormalizedWeights(Object.keys(benchmarkMix), benchmarkMix)
    : null;
  const capital = initialCapital > 0 ? initialCapital : 10000;

  return series.map((point) => {
    const row: ChartDataPoint = { date: point.date };

    // Individual tickers + benchmarks (each normalized to its own 0% or full initialCapital)
    for (const sym of allSymbols) {
      const p0 = basePrices[sym] || 1;
      const pt = point.prices[sym] ?? p0;
      const ratio = pt / p0;

      if (metric === 'percentage') {
        row[sym] = Number(((ratio - 1) * 100).toFixed(2));
      } else {
        row[sym] = Number((capital * ratio).toFixed(2));
      }
    }

    // Weighted Portfolio across user-selected stocks
    if (userTickers.length > 0) {
      let portfolioRatio = 0;
      for (const ticker of userTickers) {
        const p0 = basePrices[ticker] || 1;
        const pt = point.prices[ticker] ?? p0;
        const w = normWeights[ticker] ?? 0;
        portfolioRatio += w * (pt / p0);
      }
      if (metric === 'percentage') {
        row[PORTFOLIO_KEY] = Number(((portfolioRatio - 1) * 100).toFixed(2));
      } else {
        row[PORTFOLIO_KEY] = Number((capital * portfolioRatio).toFixed(2));
      }
    }

    // Combined (blended) benchmark across the market indices
    if (mixWeights) {
      const mixRatio = basketRatio(point.prices, basePrices, mixWeights);
      row[COMBINED_BENCH_KEY] =
        metric === 'percentage'
          ? Number(((mixRatio - 1) * 100).toFixed(2))
          : Number((capital * mixRatio).toFixed(2));
    }

    return row;
  });
}

/**
 * Computes comprehensive risk & return metrics for a price trajectory:
 * - Total Return (%)
 * - Annualized Return / CAGR (%): ((P_end / P_start)^(365 / days) - 1) * 100
 * - Max Drawdown (%): Largest peak-to-trough drop
 * - Annualized Volatility (%): StdDev(daily returns) * sqrt(252) * 100
 */
function computeTrajectoryMetrics(
  values: number[],
  calendarDays: number
): {
  startPrice: number;
  endPrice: number;
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  volatilityPct: number;
} {
  if (values.length === 0) {
    return {
      startPrice: 0,
      endPrice: 0,
      totalReturnPct: 0,
      cagrPct: 0,
      maxDrawdownPct: 0,
      volatilityPct: 0,
    };
  }

  const startPrice = values[0];
  const endPrice = values[values.length - 1];
  const ratio = startPrice > 0 ? endPrice / startPrice : 1;
  const totalReturnPct = (ratio - 1) * 100;

  const effectiveDays = Math.max(calendarDays, 1);
  const cagrPct = (Math.pow(Math.max(ratio, 0.0001), 365 / effectiveDays) - 1) * 100;

  // Max Drawdown (%)
  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) {
      peak = v;
    }
    if (peak > 0) {
      const dd = ((v - peak) / peak) * 100;
      if (dd < maxDd) {
        maxDd = dd;
      }
    }
  }

  // Daily returns for Annualized Volatility
  const dailyReturns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    if (prev > 0) {
      dailyReturns.push((curr - prev) / prev);
    }
  }

  let volatilityPct = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((acc, r) => acc + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) /
      (dailyReturns.length - 1);
    volatilityPct = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  return {
    startPrice,
    endPrice,
    totalReturnPct,
    cagrPct,
    maxDrawdownPct: maxDd,
    volatilityPct,
  };
}

/**
 * Builds the Performance Breakdown Table rows for each user stock,
 * the Weighted Portfolio, S&P 500, Nasdaq, and VXUS.
 */
export function computePerformanceTable(
  series: DailyPricePoint[],
  userTickers: string[],
  sp500Symbol: string,
  nasdaqSymbol: string,
  vxusSymbol: string,
  customWeights?: Record<string, number>,
  initialCapital: number = 10000,
  benchmarkMix?: BenchmarkMix
): PerformanceRow[] {
  if (!series || series.length === 0) return [];

  const startDate = parseISO(series[0].date);
  const endDate = parseISO(series[series.length - 1].date);
  const calendarDays = Math.max(differenceInCalendarDays(endDate, startDate), 1);

  const normWeights = resolveNormalizedWeights(userTickers, customWeights);
  const capital = initialCapital > 0 ? initialCapital : 10000;

  // Compute S&P 500 metrics first so we have the benchmark return for Alpha calculation
  const sp500Values = series.map((pt) => pt.prices[sp500Symbol] ?? 0);
  const sp500Metrics = computeTrajectoryMetrics(sp500Values, calendarDays);
  const sp500TotalReturn = sp500Metrics.totalReturnPct;

  const rows: PerformanceRow[] = [];

  // 1. Individual User Stocks
  userTickers.forEach((ticker, idx) => {
    const values = series.map((pt) => pt.prices[ticker] ?? 0);
    const m = computeTrajectoryMetrics(values, calendarDays);
    const wFrac = normWeights[ticker] ?? 0;
    const initDol = capital * wFrac;
    const finDol = initDol * (1 + m.totalReturnPct / 100);

    rows.push({
      symbol: ticker,
      label: ticker,
      type: 'stock',
      color: STOCK_COLORS[idx % STOCK_COLORS.length],
      weightPct: wFrac * 100,
      initialDollar: initDol,
      finalDollar: finDol,
      startPrice: m.startPrice,
      endPrice: m.endPrice,
      totalReturnPct: m.totalReturnPct,
      cagrPct: m.cagrPct,
      maxDrawdownPct: m.maxDrawdownPct,
      volatilityPct: m.volatilityPct,
      alphaVsSp500Pct: m.totalReturnPct - sp500TotalReturn,
    });
  });

  // 2. Weighted Portfolio (starts at initialCapital)
  if (userTickers.length > 0) {
    const basePrices = series[0].prices;
    const portfolioValues = series.map((pt) => {
      let weightedRatio = 0;
      for (const ticker of userTickers) {
        const p0 = basePrices[ticker] || 1;
        const pCurr = pt.prices[ticker] ?? p0;
        const w = normWeights[ticker] ?? 0;
        weightedRatio += w * (pCurr / p0);
      }
      return capital * weightedRatio;
    });
    const portMetrics = computeTrajectoryMetrics(portfolioValues, calendarDays);

    // Check if weights are equal or custom
    const eqWeight = 1 / userTickers.length;
    const isEqual = userTickers.every(
      (t) => Math.abs((normWeights[t] ?? 0) - eqWeight) < 0.002
    );

    rows.push({
      symbol: PORTFOLIO_KEY,
      label: isEqual
        ? `Equal-Weight Portfolio (${userTickers.length})`
        : `Custom-Weight Portfolio (${userTickers.length})`,
      type: 'portfolio',
      color: PORTFOLIO_COLOR,
      weightPct: 100,
      initialDollar: capital,
      finalDollar: portMetrics.endPrice,
      startPrice: portMetrics.startPrice,
      endPrice: portMetrics.endPrice,
      totalReturnPct: portMetrics.totalReturnPct,
      cagrPct: portMetrics.cagrPct,
      maxDrawdownPct: portMetrics.maxDrawdownPct,
      volatilityPct: portMetrics.volatilityPct,
      alphaVsSp500Pct: portMetrics.totalReturnPct - sp500TotalReturn,
    });
  }

  // 3. S&P 500 Benchmark
  rows.push({
    symbol: sp500Symbol,
    label: `S&P 500 (${sp500Symbol})`,
    type: 'benchmark',
    color: SP500_COLOR,
    initialDollar: capital,
    finalDollar: capital * (1 + sp500Metrics.totalReturnPct / 100),
    startPrice: sp500Metrics.startPrice,
    endPrice: sp500Metrics.endPrice,
    totalReturnPct: sp500Metrics.totalReturnPct,
    cagrPct: sp500Metrics.cagrPct,
    maxDrawdownPct: sp500Metrics.maxDrawdownPct,
    volatilityPct: sp500Metrics.volatilityPct,
    alphaVsSp500Pct: 0,
  });

  // 4. Nasdaq Benchmark
  const nasdaqValues = series.map((pt) => pt.prices[nasdaqSymbol] ?? 0);
  const nasdaqMetrics = computeTrajectoryMetrics(nasdaqValues, calendarDays);
  rows.push({
    symbol: nasdaqSymbol,
    label: `Nasdaq 100 (${nasdaqSymbol})`,
    type: 'benchmark',
    color: NASDAQ_COLOR,
    initialDollar: capital,
    finalDollar: capital * (1 + nasdaqMetrics.totalReturnPct / 100),
    startPrice: nasdaqMetrics.startPrice,
    endPrice: nasdaqMetrics.endPrice,
    totalReturnPct: nasdaqMetrics.totalReturnPct,
    cagrPct: nasdaqMetrics.cagrPct,
    maxDrawdownPct: nasdaqMetrics.maxDrawdownPct,
    volatilityPct: nasdaqMetrics.volatilityPct,
    alphaVsSp500Pct: nasdaqMetrics.totalReturnPct - sp500TotalReturn,
  });

  // 5. VXUS Benchmark (Total International Stock)
  const vxusValues = series.map((pt) => pt.prices[vxusSymbol] ?? 0);
  const vxusMetrics = computeTrajectoryMetrics(vxusValues, calendarDays);
  rows.push({
    symbol: vxusSymbol,
    label: `Intl Ex-US (${vxusSymbol})`,
    type: 'benchmark',
    color: VXUS_COLOR,
    initialDollar: capital,
    finalDollar: capital * (1 + vxusMetrics.totalReturnPct / 100),
    startPrice: vxusMetrics.startPrice,
    endPrice: vxusMetrics.endPrice,
    totalReturnPct: vxusMetrics.totalReturnPct,
    cagrPct: vxusMetrics.cagrPct,
    maxDrawdownPct: vxusMetrics.maxDrawdownPct,
    volatilityPct: vxusMetrics.volatilityPct,
    alphaVsSp500Pct: vxusMetrics.totalReturnPct - sp500TotalReturn,
  });

  // 6. Combined (blended) Benchmark
  if (benchmarkMix) {
    const mixWeights = resolveNormalizedWeights(Object.keys(benchmarkMix), benchmarkMix);
    const basePrices = series[0].prices;
    const mixValues = series.map((pt) => capital * basketRatio(pt.prices, basePrices, mixWeights));
    const mixMetrics = computeTrajectoryMetrics(mixValues, calendarDays);
    rows.push({
      symbol: COMBINED_BENCH_KEY,
      label: `Combined (${describeBenchmarkMix(benchmarkMix)})`,
      type: 'benchmark',
      color: COMBINED_BENCH_COLOR,
      initialDollar: capital,
      finalDollar: mixMetrics.endPrice,
      startPrice: mixMetrics.startPrice,
      endPrice: mixMetrics.endPrice,
      totalReturnPct: mixMetrics.totalReturnPct,
      cagrPct: mixMetrics.cagrPct,
      maxDrawdownPct: mixMetrics.maxDrawdownPct,
      volatilityPct: mixMetrics.volatilityPct,
      alphaVsSp500Pct: mixMetrics.totalReturnPct - sp500TotalReturn,
    });
  }

  return rows;
}
