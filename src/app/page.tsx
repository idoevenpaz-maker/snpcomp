'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subMonths, subYears, startOfYear } from 'date-fns';
import {
  Sun,
  AlertTriangle,
  Activity,
  Award,
  TrendingUp,
  Globe,
  ShieldAlert,
  Database,
  Briefcase,
  Compass,
} from 'lucide-react';
import clsx from 'clsx';
import ControlsBar, { BenchmarkMixWeights } from '@/components/ControlsBar';
import PerformanceChart from '@/components/PerformanceChart';
import PerformanceTable from '@/components/PerformanceTable';
import {
  BenchmarkMix,
  buildNormalizedChartData,
  computePerformanceTable,
  describeBenchmarkMix,
  PORTFOLIO_KEY,
} from '@/lib/finance-math';
import { fetchStocksClient } from '@/lib/client-fetch';
import {
  ComparisonMode,
  MetricType,
  StockApiResponse,
  TimeframePreset,
} from '@/lib/types';

function computePresetDates(preset: TimeframePreset): { start: string; end: string } {
  const now = new Date();
  const end = format(now, 'yyyy-MM-dd');
  let startObj: Date;

  switch (preset) {
    case '1M':
      startObj = subMonths(now, 1);
      break;
    case '6M':
      startObj = subMonths(now, 6);
      break;
    case 'YTD':
      startObj = startOfYear(now);
      break;
    case '1Y':
      startObj = subYears(now, 1);
      break;
    case '3Y':
      startObj = subYears(now, 3);
      break;
    case '5Y':
      startObj = subYears(now, 5);
      break;
    case 'MAX':
      startObj = subYears(now, 10);
      break;
    default:
      startObj = subYears(now, 1);
  }

  return {
    start: format(startObj, 'yyyy-MM-dd'),
    end,
  };
}

function buildEqualWeights(list: string[]): Record<string, number> {
  if (list.length === 0) return {};
  const eq = Number((100 / list.length).toFixed(2));
  const result: Record<string, number> = {};
  list.forEach((t, idx) => {
    if (idx === list.length - 1) {
      const sumPrior = eq * (list.length - 1);
      result[t] = Number(Math.max(0, 100 - sumPrior).toFixed(2));
    } else {
      result[t] = eq;
    }
  });
  return result;
}

export default function HomePage() {
  // Pre-load AAPL, MSFT, NVDA on initial load as specified
  const [tickers, setTickers] = useState<string[]>(['AAPL', 'MSFT', 'NVDA']);
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    buildEqualWeights(['AAPL', 'MSFT', 'NVDA'])
  );
  const [initialCapital, setInitialCapital] = useState<number>(10000);

  const [showSp500, setShowSp500] = useState<boolean>(true);
  const [showNasdaq, setShowNasdaq] = useState<boolean>(true);
  const [showVxus, setShowVxus] = useState<boolean>(true);
  const [showCombined, setShowCombined] = useState<boolean>(false);
  const [benchMixWeights, setBenchMixWeights] = useState<BenchmarkMixWeights>({
    sp500: 60,
    nasdaq: 0,
    vxus: 40,
  });
  const [mode, setMode] = useState<ComparisonMode>('portfolio');
  const [timeframe, setTimeframe] = useState<TimeframePreset>('1Y');
  const [metric, setMetric] = useState<MetricType>('percentage');

  const initialDates = useMemo(() => computePresetDates('1Y'), []);
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);

  const [apiData, setApiData] = useState<StockApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [invalidTickerNotice, setInvalidTickerNotice] = useState<string | null>(null);

  const fetchStockData = useCallback(
    async (currentTickers: string[], start: string, end: string) => {
      setLoading(true);
      setError(null);
      try {
        // Static GitHub Pages build: load pre-fetched Yahoo Finance close prices
        const json: StockApiResponse = await fetchStocksClient(currentTickers, start, end);
        setApiData(json);

        if (json.invalidTickers && json.invalidTickers.length > 0) {
          const badList = json.invalidTickers.join(', ');
          setInvalidTickerNotice(
            `Ticker${json.invalidTickers.length > 1 ? 's' : ''} not found and removed: ${badList}. Check the symbol (Yahoo Finance format, e.g. BRK-B, TEVA.TA) and try again.`
          );
          setTickers((prev) => {
            const next = prev.filter((t) => !json.invalidTickers!.includes(t));
            setWeights(buildEqualWeights(next));
            return next;
          });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load stock data');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchStockData(tickers, startDate, endDate);
  }, [tickers, startDate, endDate, fetchStockData]);

  const handleAddTicker = (rawTicker: string) => {
    const clean = rawTicker
      .trim()
      .toUpperCase()
      .replace(/^\$+/, '')
      .replace(/[^A-Z0-9.^=-]/g, '');
    if (!clean) return;
    setInvalidTickerNotice(null);
    if (clean === 'SPY' || clean === '^GSPC') {
      setShowSp500(true);
      return;
    }
    if (clean === 'QQQ' || clean === '^IXIC') {
      setShowNasdaq(true);
      return;
    }
    if (clean === 'VXUS') {
      setShowVxus(true);
      return;
    }
    if (!tickers.includes(clean)) {
      const next = [...tickers, clean];
      setTickers(next);
      setWeights(buildEqualWeights(next));
    }
  };

  const handleRemoveTicker = (symbol: string) => {
    const next = tickers.filter((t) => t !== symbol);
    setTickers(next);
    setWeights(buildEqualWeights(next));
  };

  const handleWeightChange = (symbol: string, weight: number) => {
    setWeights((prev) => ({
      ...prev,
      [symbol]: weight,
    }));
  };

  /**
   * When the user edits the dollar amount ($) for a single stock:
   * - Keeps the dollar amounts of all other stocks unchanged
   * - Updates Total Portfolio Capital ($) to the new sum of all stock dollar amounts
   * - Recomputes every stock's percentage weight (%) out of the new total sum
   */
  const handleStockDollarChange = (symbol: string, newDollarAmount: number) => {
    const safeNewDollar = Math.max(0, newDollarAmount);
    const currentDollars: Record<string, number> = {};
    let newTotalCapital = 0;

    for (const t of tickers) {
      if (t === symbol) {
        currentDollars[t] = safeNewDollar;
      } else {
        const w = weights[t] ?? 0;
        currentDollars[t] = Math.max(0, initialCapital * (w / 100));
      }
      newTotalCapital += currentDollars[t];
    }

    setInitialCapital(Number(newTotalCapital.toFixed(2)));

    if (newTotalCapital > 0) {
      const nextWeights: Record<string, number> = {};
      for (const t of tickers) {
        nextWeights[t] = Number(((currentDollars[t] / newTotalCapital) * 100).toFixed(2));
      }
      setWeights(nextWeights);
    } else {
      const zeroWeights: Record<string, number> = {};
      for (const t of tickers) {
        zeroWeights[t] = 0;
      }
      setWeights(zeroWeights);
    }
  };

  const handleEqualizeWeights = () => {
    setWeights(buildEqualWeights(tickers));
  };

  const handleTimeframeChange = (preset: TimeframePreset) => {
    setTimeframe(preset);
    const { start, end } = computePresetDates(preset);
    setStartDate(start);
    setEndDate(end);
  };

  const handleCustomDateChange = (start: string, end: string) => {
    if (!start || !end) return;
    setTimeframe('CUSTOM');
    setStartDate(start);
    setEndDate(end);
  };

  const sp500Symbol = apiData?.benchmarks.sp500 ?? 'SPY';
  const nasdaqSymbol = apiData?.benchmarks.nasdaq ?? 'QQQ';
  const vxusSymbol = apiData?.benchmarks.vxus ?? 'VXUS';

  // Blended benchmark (symbol -> weight %), only when the Combined Mix toggle is on
  const benchmarkMix = useMemo<BenchmarkMix | undefined>(() => {
    if (!showCombined) return undefined;
    return {
      [sp500Symbol]: benchMixWeights.sp500,
      [nasdaqSymbol]: benchMixWeights.nasdaq,
      [vxusSymbol]: benchMixWeights.vxus,
    };
  }, [showCombined, benchMixWeights, sp500Symbol, nasdaqSymbol, vxusSymbol]);

  const chartData = useMemo(() => {
    if (!apiData) return [];
    return buildNormalizedChartData(
      apiData.series,
      apiData.tickers,
      sp500Symbol,
      nasdaqSymbol,
      vxusSymbol,
      metric,
      weights,
      initialCapital,
      benchmarkMix
    );
  }, [apiData, sp500Symbol, nasdaqSymbol, vxusSymbol, metric, weights, initialCapital, benchmarkMix]);

  const performanceRows = useMemo(() => {
    if (!apiData) return [];
    return computePerformanceTable(
      apiData.series,
      apiData.tickers,
      sp500Symbol,
      nasdaqSymbol,
      vxusSymbol,
      weights,
      initialCapital,
      benchmarkMix
    );
  }, [apiData, sp500Symbol, nasdaqSymbol, vxusSymbol, weights, initialCapital, benchmarkMix]);

  // Summary KPI Cards
  const portfolioRow = performanceRows.find((r) => r.symbol === PORTFOLIO_KEY);
  const sp500Row = performanceRows.find((r) => r.symbol === sp500Symbol);
  const nasdaqRow = performanceRows.find((r) => r.symbol === nasdaqSymbol);
  const vxusRow = performanceRows.find((r) => r.symbol === vxusSymbol);
  const topPerformer = useMemo(() => {
    const stockRows = performanceRows.filter((r) => r.type === 'stock');
    if (stockRows.length === 0) return null;
    return [...stockRows].sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0];
  }, [performanceRows]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bright & Cheerful Header Bar */}
      <header className="border-b-2 border-sky-200 bg-white/90 backdrop-blur sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-400 to-pink-500 flex items-center justify-center text-white shadow-md">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 font-mono">
                  ALPHABENCH <span className="text-sky-600 font-bold">v2.8</span>
                </h1>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 border border-amber-300 text-amber-800">
                  BRIGHT PORTFOLIO STUDIO
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Historical Equity &amp; Weighted Portfolio Benchmark Studio vs. S&amp;P 500, Nasdaq &amp; VXUS
              </p>
            </div>
          </div>

          {/* Data Feed Status Badge */}
          <div className="flex items-center gap-3 text-xs font-mono">
            {apiData && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-slate-700 shadow-sm">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold">FEED:</span>
                <span
                  className={clsx(
                    'font-bold',
                    apiData.source === 'yahoo' ? 'text-emerald-700' : 'text-amber-700'
                  )}
                >
                  {apiData.source === 'yahoo'
                    ? 'YAHOO FINANCE LIVE (PRICE)'
                    : 'DETERMINISTIC ENGINE'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Controls Bar (Visually Divided into 1. Portfolio Builder and 2. Market Benchmarks) */}
        <ControlsBar
          tickers={tickers}
          onAddTicker={handleAddTicker}
          onRemoveTicker={handleRemoveTicker}
          weights={weights}
          onWeightChange={handleWeightChange}
          onStockDollarChange={handleStockDollarChange}
          onEqualizeWeights={handleEqualizeWeights}
          initialCapital={initialCapital}
          onInitialCapitalChange={setInitialCapital}
          showSp500={showSp500}
          onToggleSp500={() => setShowSp500((v) => !v)}
          showNasdaq={showNasdaq}
          onToggleNasdaq={() => setShowNasdaq((v) => !v)}
          showVxus={showVxus}
          onToggleVxus={() => setShowVxus((v) => !v)}
          showCombined={showCombined}
          onToggleCombined={() => setShowCombined((v) => !v)}
          benchMix={benchMixWeights}
          onBenchMixChange={setBenchMixWeights}
        />

        {/* Dynamic IPO Start Date Adjustment Banner */}
        {apiData?.adjustedStartDate && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 px-4 flex items-start sm:items-center gap-3 text-xs sm:text-sm text-amber-900 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1 font-mono">
              <span className="font-bold text-amber-800">
                DYNAMIC START DATE SHIFT (t₀ = {apiData.adjustedStartDate}):{' '}
              </span>
              {apiData.adjustedReason ||
                `One or more selected stocks IPO'd after ${apiData.requestedStartDate}. Comparison window aligned to ${apiData.adjustedStartDate}.`}
            </div>
          </div>
        )}

        {/* Invalid Ticker Alert Banner */}
        {invalidTickerNotice && (
          <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-3.5 px-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-rose-900 font-mono shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-semibold">{invalidTickerNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setInvalidTickerNotice(null)}
              className="text-xs font-bold text-rose-700 hover:text-rose-950 underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-4 flex items-center gap-3 text-sm text-rose-900 font-mono shadow-sm">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Visually Divided KPI Summary Panels: Left = Your Portfolio, Right = Market Benchmarks */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel (5 cols): Your Portfolio Summary */}
          <div className="lg:col-span-5 bg-white/95 border-2 border-sky-400 shadow-lg shadow-sky-100/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-sky-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-sky-800">
                <Briefcase className="w-3.5 h-3.5 text-sky-600" />
                <span>Your Portfolio Summary</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                Capital: ${initialCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: Weighted Portfolio Return & Ending Dollar Value */}
              <div className="bg-sky-50/60 border-2 border-sky-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 mb-1">
                  <span>PORTFOLIO RETURN</span>
                  <Activity className="w-3.5 h-3.5 text-sky-600" />
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={clsx(
                      'text-xl font-mono font-extrabold',
                      (portfolioRow?.totalReturnPct ?? 0) >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    )}
                  >
                    {portfolioRow
                      ? `${portfolioRow.totalReturnPct >= 0 ? '+' : ''}${portfolioRow.totalReturnPct.toFixed(2)}%`
                      : '—'}
                  </span>
                  {portfolioRow?.finalDollar !== undefined && (
                    <span className="text-xs font-mono text-sky-800 font-bold">
                      → ${portfolioRow.finalDollar.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-1.5 flex items-center justify-between">
                  <span>Alpha vs S&amp;P 500:</span>
                  <span
                    className={clsx(
                      'font-bold',
                      (portfolioRow?.alphaVsSp500Pct ?? 0) >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    )}
                  >
                    {portfolioRow
                      ? `${portfolioRow.alphaVsSp500Pct >= 0 ? '+' : ''}${portfolioRow.alphaVsSp500Pct.toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Card 2: Top Performing Selection */}
              <div className="bg-amber-50/70 border-2 border-amber-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 mb-1">
                  <span>TOP HOLDING LEADER</span>
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-mono font-extrabold text-slate-900">
                    {topPerformer ? topPerformer.symbol : '—'}
                  </span>
                  <span
                    className={clsx(
                      'text-lg font-mono font-extrabold',
                      (topPerformer?.totalReturnPct ?? 0) >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    )}
                  >
                    {topPerformer
                      ? `${topPerformer.totalReturnPct >= 0 ? '+' : ''}${topPerformer.totalReturnPct.toFixed(2)}%`
                      : ''}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-1.5 flex items-center justify-between">
                  <span>Alpha vs S&amp;P 500:</span>
                  <span
                    className={clsx(
                      'font-bold',
                      (topPerformer?.alphaVsSp500Pct ?? 0) >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    )}
                  >
                    {topPerformer
                      ? `${topPerformer.alphaVsSp500Pct >= 0 ? '+' : ''}${topPerformer.alphaVsSp500Pct.toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel (7 cols): Market Benchmarks Summary */}
          <div className="lg:col-span-7 bg-white/95 border-2 border-emerald-400 shadow-lg shadow-emerald-100/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-emerald-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Market Benchmarks Comparison</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Reference Indices (SPY / QQQ / VXUS)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* S&P 500 Benchmark */}
              <div className="bg-emerald-50/60 border-2 border-emerald-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 mb-1">
                  <span>S&amp;P 500 ({sp500Symbol})</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div
                  className={clsx(
                    'text-xl font-mono font-extrabold',
                    (sp500Row?.totalReturnPct ?? 0) >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  )}
                >
                  {sp500Row
                    ? `${sp500Row.totalReturnPct >= 0 ? '+' : ''}${sp500Row.totalReturnPct.toFixed(2)}%`
                    : '—'}
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-1.5 flex items-center justify-between">
                  <span>CAGR / Max DD:</span>
                  <span className="text-slate-800 font-semibold">
                    {sp500Row
                      ? `${sp500Row.cagrPct >= 0 ? '+' : ''}${sp500Row.cagrPct.toFixed(1)}% / ${sp500Row.maxDrawdownPct.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Nasdaq Benchmark */}
              <div className="bg-orange-50/70 border-2 border-orange-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 mb-1">
                  <span>NASDAQ 100 ({nasdaqSymbol})</span>
                  <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
                </div>
                <div
                  className={clsx(
                    'text-xl font-mono font-extrabold',
                    (nasdaqRow?.totalReturnPct ?? 0) >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  )}
                >
                  {nasdaqRow
                    ? `${nasdaqRow.totalReturnPct >= 0 ? '+' : ''}${nasdaqRow.totalReturnPct.toFixed(2)}%`
                    : '—'}
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-1.5 flex items-center justify-between">
                  <span>CAGR / Max DD:</span>
                  <span className="text-slate-800 font-semibold">
                    {nasdaqRow
                      ? `${nasdaqRow.cagrPct >= 0 ? '+' : ''}${nasdaqRow.cagrPct.toFixed(1)}% / ${nasdaqRow.maxDrawdownPct.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* VXUS International Benchmark */}
              <div className="bg-pink-50/70 border-2 border-pink-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 mb-1">
                  <span>INTL EX-US ({vxusSymbol})</span>
                  <Globe className="w-3.5 h-3.5 text-pink-600" />
                </div>
                <div
                  className={clsx(
                    'text-xl font-mono font-extrabold',
                    (vxusRow?.totalReturnPct ?? 0) >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  )}
                >
                  {vxusRow
                    ? `${vxusRow.totalReturnPct >= 0 ? '+' : ''}${vxusRow.totalReturnPct.toFixed(2)}%`
                    : '—'}
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-1.5 flex items-center justify-between">
                  <span>CAGR / Max DD:</span>
                  <span className="text-slate-800 font-semibold">
                    {vxusRow
                      ? `${vxusRow.cagrPct >= 0 ? '+' : ''}${vxusRow.cagrPct.toFixed(1)}% / ${vxusRow.maxDrawdownPct.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Recharts LineChart */}
        <PerformanceChart
          data={chartData}
          tickers={apiData?.tickers ?? tickers}
          sp500Symbol={sp500Symbol}
          nasdaqSymbol={nasdaqSymbol}
          vxusSymbol={vxusSymbol}
          showSp500={showSp500}
          showNasdaq={showNasdaq}
          showVxus={showVxus}
          combinedLabel={benchmarkMix ? describeBenchmarkMix(benchmarkMix) : null}
          mode={mode}
          onModeChange={setMode}
          timeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          startDate={startDate}
          endDate={endDate}
          onCustomDateChange={handleCustomDateChange}
          metric={metric}
          onMetricChange={setMetric}
          initialCapital={initialCapital}
          loading={loading}
          onRefresh={() => fetchStockData(tickers, startDate, endDate)}
        />

        {/* Sortable Performance Breakdown Table */}
        <PerformanceTable
          rows={performanceRows}
          effectiveStartDate={apiData?.effectiveStartDate ?? startDate}
          effectiveEndDate={apiData?.effectiveEndDate ?? endDate}
          initialCapital={initialCapital}
        />
      </main>
    </div>
  );
}
