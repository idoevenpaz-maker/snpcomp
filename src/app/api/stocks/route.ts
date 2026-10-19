import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { generateDeterministicSeries, isKnownFallbackSymbol } from '@/lib/mock-generator';
import { DailyPricePoint, StockApiResponse } from '@/lib/types';

const SP500_BENCHMARK = 'SPY';
const NASDAQ_BENCHMARK = 'QQQ';
const VXUS_BENCHMARK = 'VXUS';

// Instantiate yahoo-finance2 v3 client
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
});

class SymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`Symbol "${symbol}" not found on Yahoo Finance.`);
    this.name = 'SymbolNotFoundError';
  }
}

interface DirectYahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }> | null;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
}

/**
 * Direct Yahoo Finance v8 chart API fetcher with browser User-Agent header
 * as a secondary live source before falling back to synthetic mock data.
 */
async function fetchYahooDirectChart(
  symbol: string,
  startDateStr: string,
  endDateStr: string
): Promise<{ date: string; adjClose: number }[]> {
  const period1 = Math.floor(new Date(`${startDateStr}T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(new Date(`${endDateStr}T23:59:59Z`).getTime() / 1000);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    next: { revalidate: 300 },
  });

  if (res.status === 404 || res.status === 400) {
    throw new SymbolNotFoundError(symbol);
  }

  if (!res.ok) {
    throw new Error(`Yahoo direct HTTP ${res.status} for ${symbol}`);
  }

  const json = (await res.json()) as DirectYahooChartResponse;
  if (json?.chart?.error) {
    throw new SymbolNotFoundError(symbol);
  }

  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  if (!timestamps || !Array.isArray(timestamps) || timestamps.length === 0) {
    throw new SymbolNotFoundError(symbol);
  }

  const adjCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const rawCloses = result?.indicators?.quote?.[0]?.close ?? [];

  const pointsMap = new Map<string, number>();
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    if (!ts) continue;
    const isoDate = new Date(ts * 1000).toISOString().slice(0, 10);
    if (isoDate < startDateStr || isoDate > endDateStr) continue;

    const adj = adjCloses[i];
    const cls = rawCloses[i];
    const price =
      typeof cls === 'number' && !isNaN(cls) && cls > 0
        ? cls
        : typeof adj === 'number' && !isNaN(adj) && adj > 0
        ? adj
        : null;

    if (price !== null) {
      pointsMap.set(isoDate, Number(price.toFixed(4)));
    }
  }

  const points = Array.from(pointsMap.entries())
    .map(([date, adjClose]) => ({ date, adjClose }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    throw new SymbolNotFoundError(symbol);
  }

  return points;
}

async function fetchSymbolHistory(
  symbol: string,
  startDateStr: string,
  endDateStr: string
): Promise<{
  points: { date: string; adjClose: number }[];
  fromFallback: boolean;
  notFound: boolean;
}> {
  // 1. Primary: yahoo-finance2 v3 chart()
  try {
    const period1 = new Date(`${startDateStr}T00:00:00Z`);
    const period2Date = new Date(`${endDateStr}T23:59:59Z`);

    const chartResult = (await yahooFinance.chart(
      symbol,
      {
        period1,
        period2: period2Date,
        interval: '1d',
      },
      { validateResult: false }
    )) as {
      quotes?: Array<{
        date?: Date | string | number;
        adjclose?: number | null;
        close?: number | null;
      }>;
    };

    const quotes = chartResult?.quotes;
    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
      throw new SymbolNotFoundError(symbol);
    }

    const pointsMap = new Map<string, number>();
    for (const q of quotes) {
      if (!q || !q.date) continue;
      const dateObj = q.date instanceof Date ? q.date : new Date(q.date);
      if (isNaN(dateObj.getTime())) continue;
      const isoDate = dateObj.toISOString().slice(0, 10);
      if (isoDate < startDateStr || isoDate > endDateStr) continue;

      const price =
        typeof q.close === 'number' && !isNaN(q.close) && q.close > 0
          ? q.close
          : typeof q.adjclose === 'number' && !isNaN(q.adjclose) && q.adjclose > 0
          ? q.adjclose
          : null;

      if (price !== null) {
        pointsMap.set(isoDate, Number(price.toFixed(4)));
      }
    }

    const points = Array.from(pointsMap.entries())
      .map(([date, adjClose]) => ({ date, adjClose }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (points.length < 2) {
      throw new SymbolNotFoundError(symbol);
    }

    return { points, fromFallback: false, notFound: false };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isExplicitNotFound =
      err instanceof SymbolNotFoundError ||
      /Not Found|No data found|delisted|404/i.test(errMsg);

    if (isExplicitNotFound) {
      return { points: [], fromFallback: false, notFound: true };
    }

    // 2. Secondary: Direct Yahoo v8 chart endpoint with Chrome User-Agent
    try {
      const directPoints = await fetchYahooDirectChart(symbol, startDateStr, endDateStr);
      return { points: directPoints, fromFallback: false, notFound: false };
    } catch (directErr: unknown) {
      if (directErr instanceof SymbolNotFoundError) {
        return { points: [], fromFallback: false, notFound: true };
      }

      // 3. Tertiary: Only use deterministic fallback if Yahoo rate-limited/timed out
      // AND the symbol is a known benchmark/profile (never invent data for arbitrary strings!)
      if (isKnownFallbackSymbol(symbol)) {
        const fallbackPoints = generateDeterministicSeries(symbol, startDateStr, endDateStr);
        return { points: fallbackPoints, fromFallback: true, notFound: false };
      }

      return { points: [], fromFallback: false, notFound: true };
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTickers = searchParams.get('tickers') || '';
  const startDateParam = searchParams.get('startDate') || '2025-10-19';
  const endDateParam = searchParams.get('endDate') || '2026-10-19';

  // Strip optional leading '$' (e.g. $ALAB, $TSM -> ALAB, TSM)
  const requestedUserTickers = Array.from(
    new Set(
      rawTickers
        .split(',')
        .map((t) => t.trim().toUpperCase().replace(/^\$+/, ''))
        .filter(
          (t) =>
            /^[A-Z0-9.^=-]{1,12}$/.test(t) &&
            t !== SP500_BENCHMARK &&
            t !== NASDAQ_BENCHMARK &&
            t !== VXUS_BENCHMARK
        )
    )
  );

  const allSymbols = Array.from(
    new Set([
      ...requestedUserTickers,
      SP500_BENCHMARK,
      NASDAQ_BENCHMARK,
      VXUS_BENCHMARK,
    ])
  );

  const fetchedResults = await Promise.all(
    allSymbols.map(async (symbol) => {
      const res = await fetchSymbolHistory(symbol, startDateParam, endDateParam);
      return { symbol, ...res };
    })
  );

  const invalidTickers = fetchedResults
    .filter(
      (r) =>
        r.notFound &&
        r.symbol !== SP500_BENCHMARK &&
        r.symbol !== NASDAQ_BENCHMARK &&
        r.symbol !== VXUS_BENCHMARK
    )
    .map((r) => r.symbol);

  const validUserTickers = requestedUserTickers.filter(
    (t) => !invalidTickers.includes(t)
  );

  const activeSymbols = Array.from(
    new Set([
      ...validUserTickers,
      SP500_BENCHMARK,
      NASDAQ_BENCHMARK,
      VXUS_BENCHMARK,
    ])
  );

  const validResults = fetchedResults.filter((r) =>
    activeSymbols.includes(r.symbol)
  );

  const rawBySymbol = new Map<string, Map<string, number>>();
  const firstDateBySymbol = new Map<string, string>();
  const allFromFallback = validResults.every((r) => r.fromFallback);

  for (const item of validResults) {
    const map = new Map<string, number>();
    for (const p of item.points) {
      map.set(p.date, p.adjClose);
    }
    rawBySymbol.set(item.symbol, map);
    if (item.points.length > 0) {
      firstDateBySymbol.set(item.symbol, item.points[0].date);
    }
  }

  // Collect master sorted list of all trading dates (preferring real Yahoo benchmark dates if available)
  const allDatesSet = new Set<string>();
  const spyResult = validResults.find(
    (r) => r.symbol === SP500_BENCHMARK && !r.fromFallback
  );
  if (spyResult && spyResult.points.length > 0) {
    for (const p of spyResult.points) {
      allDatesSet.add(p.date);
    }
  } else {
    for (const map of rawBySymbol.values()) {
      for (const d of map.keys()) {
        allDatesSet.add(d);
      }
    }
  }
  const sortedDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));

  if (sortedDates.length === 0) {
    return NextResponse.json(
      { error: 'No trading data available for the selected date range.' },
      { status: 400 }
    );
  }

  // Determine dynamic comparison start date (t_0):
  // Latest first-available date across all valid selected symbols
  let effectiveStartDate = sortedDates[0];
  let limitingSymbol: string | null = null;

  for (const symbol of activeSymbols) {
    const firstDate = firstDateBySymbol.get(symbol);
    if (firstDate && firstDate > effectiveStartDate) {
      effectiveStartDate = firstDate;
      limitingSymbol = symbol;
    }
  }

  const firstBenchmarkDate =
    firstDateBySymbol.get(SP500_BENCHMARK) || sortedDates[0];

  let adjustedStartDate: string | null = null;
  let adjustedReason: string | null = null;

  if (effectiveStartDate > firstBenchmarkDate && limitingSymbol) {
    adjustedStartDate = effectiveStartDate;
    adjustedReason = `${limitingSymbol} began trading on ${effectiveStartDate} (after requested start ${startDateParam}). Comparison start date (t₀) dynamically shifted to ${effectiveStartDate}.`;
  }

  // Filter trading calendar to >= effectiveStartDate and forward-fill missing gaps
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

  const series: DailyPricePoint[] = [];
  for (const date of activeDates) {
    const prices: Record<string, number> = {};
    for (const symbol of activeSymbols) {
      const symbolMap = rawBySymbol.get(symbol)!;
      const currentVal = symbolMap.get(date);
      if (currentVal !== undefined && currentVal > 0) {
        lastKnownPrice.set(symbol, currentVal);
        prices[symbol] = currentVal;
      } else {
        prices[symbol] = lastKnownPrice.get(symbol) ?? 100;
      }
    }
    series.push({ date, prices });
  }

  const responsePayload: StockApiResponse = {
    tickers: validUserTickers,
    invalidTickers: invalidTickers.length > 0 ? invalidTickers : undefined,
    benchmarks: {
      sp500: SP500_BENCHMARK,
      nasdaq: NASDAQ_BENCHMARK,
      vxus: VXUS_BENCHMARK,
    },
    requestedStartDate: startDateParam,
    effectiveStartDate: series[0]?.date ?? startDateParam,
    effectiveEndDate: series[series.length - 1]?.date ?? endDateParam,
    adjustedStartDate,
    adjustedReason,
    source: allFromFallback ? 'fallback' : 'yahoo',
    series,
  };

  return NextResponse.json(responsePayload);
}
