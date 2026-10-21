/**
 * Browser-side stock data pipeline for the static GitHub Pages build.
 *
 * GitHub Pages cannot run the server-side `/api/stocks` route, and Yahoo Finance does not
 * allow direct browser (CORS) requests. Instead, a GitHub Actions workflow runs
 * `scripts/fetch-data.mjs` (which uses `yahooFinance.chart()`) and saves raw daily `close`
 * prices to `public/data/<TICKER>.json`. This module loads those files, slices them to the
 * selected date range, and aligns the series exactly like the original API route.
 * All returns are still computed in the app from raw close prices.
 */
import { DailyPricePoint, StockApiResponse } from './types';

const SP500_BENCHMARK = 'SPY';
const NASDAQ_BENCHMARK = 'QQQ';
const VXUS_BENCHMARK = 'VXUS';
const BENCHMARKS = [SP500_BENCHMARK, NASDAQ_BENCHMARK, VXUS_BENCHMARK];

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type PricePoint = { date: string; adjClose: number };
interface TickerFile {
  symbol: string;
  updatedAt: string;
  points: Array<[string, number]>;
}

// Cache full histories per ticker (null = not available)
const historyCache = new Map<string, Promise<Array<[string, number]> | null>>();

const HISTORY_START_UNIX = Math.floor(Date.UTC(2015, 0, 1) / 1000);

function loadLocalHistory(symbol: string): Promise<Array<[string, number]> | null> {
  return fetch(`${BASE_PATH}/data/${encodeURIComponent(symbol)}.json`)
    .then(async (res) => {
      if (!res.ok) return null;
      const json = (await res.json()) as TickerFile;
      return Array.isArray(json.points) && json.points.length >= 2 ? json.points : null;
    })
    .catch(() => null);
}

/**
 * Fallback for tickers that were not pre-fetched (not in tickers.txt): load the same
 * Yahoo v8 chart data live. Yahoo blocks direct browser (CORS) requests, so the call is
 * relayed through the r.jina.ai reader, which returns the raw JSON with CORS headers.
 */
async function loadLiveHistory(symbol: string): Promise<Array<[string, number]> | null> {
  const p2 = Math.floor(Date.now() / 1000);
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${HISTORY_START_UNIX}&period2=${p2}&interval=1d`;
  const res = await fetch(`https://r.jina.ai/${yahooUrl}`, {
    headers: { 'X-Return-Format': 'text' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const start = text.indexOf('{');
  if (start < 0) throw new Error('Unexpected response');
  const json = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  const result = json?.chart?.result?.[0];
  if (!result) return null; // Yahoo says the symbol does not exist
  const timestamps: number[] = result.timestamp ?? [];
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];
  const byDate = new Map<string, number>();
  timestamps.forEach((t, i) => {
    const c = closes[i];
    if (typeof c === 'number' && !isNaN(c) && c > 0) {
      byDate.set(new Date(t * 1000).toISOString().slice(0, 10), Number(c.toFixed(4)));
    }
  });
  const points = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return points.length >= 2 ? points : null;
}

function loadHistory(symbol: string): Promise<Array<[string, number]> | null> {
  let p = historyCache.get(symbol);
  if (!p) {
    p = loadLocalHistory(symbol).then(async (local) => {
      if (local) return local;
      try {
        return await loadLiveHistory(symbol);
      } catch {
        // Network/proxy hiccup: don't cache the failure so a retry can succeed
        historyCache.delete(symbol);
        return null;
      }
    });
    historyCache.set(symbol, p);
  }
  return p;
}

let availableTickersPromise: Promise<string[]> | null = null;
/** List of tickers that were pre-fetched into the static site. */
export function getAvailableTickers(): Promise<string[]> {
  if (!availableTickersPromise) {
    availableTickersPromise = fetch(`${BASE_PATH}/data/index.json`)
      .then((r) => (r.ok ? r.json() : { tickers: [] }))
      .then((j: { tickers?: string[] }) => j.tickers ?? [])
      .catch(() => []);
  }
  return availableTickersPromise;
}

async function fetchSymbolHistory(symbol: string, start: string, end: string) {
  const all = await loadHistory(symbol);
  if (!all) return { points: [] as PricePoint[], notFound: true };
  const points = all
    .filter(([d, c]) => d >= start && d <= end && c > 0)
    .map(([date, adjClose]) => ({ date, adjClose }));
  if (points.length < 2) return { points: [] as PricePoint[], notFound: true };
  return { points, notFound: false };
}

export async function fetchStocksClient(
  rawTickers: string[],
  startDateParam: string,
  endDateParam: string
): Promise<StockApiResponse> {
  const requestedUserTickers = Array.from(
    new Set(
      rawTickers
        .map((t) => t.trim().toUpperCase().replace(/^\$+/, ''))
        .filter((t) => /^[A-Z0-9.^=-]{1,12}$/.test(t) && !BENCHMARKS.includes(t))
    )
  );

  const allSymbols = [...requestedUserTickers, ...BENCHMARKS];
  const fetchedResults = await Promise.all(
    allSymbols.map(async (symbol) => ({
      symbol,
      ...(await fetchSymbolHistory(symbol, startDateParam, endDateParam)),
    }))
  );

  if (BENCHMARKS.some((b) => fetchedResults.find((r) => r.symbol === b)?.notFound)) {
    throw new Error('Benchmark price data is missing for the selected date range.');
  }

  const invalidTickers = fetchedResults
    .filter((r) => r.notFound && !BENCHMARKS.includes(r.symbol))
    .map((r) => r.symbol);
  const validUserTickers = requestedUserTickers.filter((t) => !invalidTickers.includes(t));
  const activeSymbols = [...validUserTickers, ...BENCHMARKS];
  const validResults = fetchedResults.filter((r) => activeSymbols.includes(r.symbol));

  const rawBySymbol = new Map<string, Map<string, number>>();
  const firstDateBySymbol = new Map<string, string>();
  for (const item of validResults) {
    const map = new Map<string, number>();
    for (const p of item.points) map.set(p.date, p.adjClose);
    rawBySymbol.set(item.symbol, map);
    if (item.points.length > 0) firstDateBySymbol.set(item.symbol, item.points[0].date);
  }

  // Master trading calendar = SPY trading days
  const sortedDates = validResults
    .find((r) => r.symbol === SP500_BENCHMARK)!
    .points.map((p) => p.date)
    .sort((a, b) => a.localeCompare(b));
  if (sortedDates.length === 0) {
    throw new Error('No trading data available for the selected date range.');
  }

  // Dynamic t0: latest first-available date across all active symbols
  let effectiveStartDate = sortedDates[0];
  let limitingSymbol: string | null = null;
  for (const symbol of activeSymbols) {
    const firstDate = firstDateBySymbol.get(symbol);
    if (firstDate && firstDate > effectiveStartDate) {
      effectiveStartDate = firstDate;
      limitingSymbol = symbol;
    }
  }

  const firstBenchmarkDate = firstDateBySymbol.get(SP500_BENCHMARK) || sortedDates[0];
  let adjustedStartDate: string | null = null;
  let adjustedReason: string | null = null;
  if (effectiveStartDate > firstBenchmarkDate && limitingSymbol) {
    adjustedStartDate = effectiveStartDate;
    adjustedReason = `${limitingSymbol} began trading on ${effectiveStartDate} (after requested start ${startDateParam}). Comparison start date (t₀) dynamically shifted to ${effectiveStartDate}.`;
  }

  // Align + forward-fill
  const activeDates = sortedDates.filter((d) => d >= effectiveStartDate);
  const lastKnownPrice = new Map<string, number>();
  for (const symbol of activeSymbols) {
    const symbolMap = rawBySymbol.get(symbol)!;
    const exact = symbolMap.get(effectiveStartDate);
    if (exact !== undefined) {
      lastKnownPrice.set(symbol, exact);
    } else {
      for (const d of activeDates) {
        if (symbolMap.has(d)) {
          lastKnownPrice.set(symbol, symbolMap.get(d)!);
          break;
        }
      }
    }
  }

  const series: DailyPricePoint[] = activeDates.map((date) => {
    const prices: Record<string, number> = {};
    for (const symbol of activeSymbols) {
      const v = rawBySymbol.get(symbol)!.get(date);
      if (v !== undefined && v > 0) {
        lastKnownPrice.set(symbol, v);
        prices[symbol] = v;
      } else {
        prices[symbol] = lastKnownPrice.get(symbol) ?? 100;
      }
    }
    return { date, prices };
  });

  return {
    tickers: validUserTickers,
    invalidTickers: invalidTickers.length > 0 ? invalidTickers : undefined,
    benchmarks: { sp500: SP500_BENCHMARK, nasdaq: NASDAQ_BENCHMARK, vxus: VXUS_BENCHMARK },
    requestedStartDate: startDateParam,
    effectiveStartDate: series[0]?.date ?? startDateParam,
    effectiveEndDate: series[series.length - 1]?.date ?? endDateParam,
    adjustedStartDate,
    adjustedReason,
    source: 'yahoo',
    series,
  };
}
