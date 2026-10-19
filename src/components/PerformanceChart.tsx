'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  BarChart3,
  Layers,
  Calendar,
  Percent,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  ChartDataPoint,
  NASDAQ_COLOR,
  PORTFOLIO_COLOR,
  PORTFOLIO_KEY,
  SP500_COLOR,
  STOCK_COLORS,
  VXUS_COLOR,
} from '@/lib/finance-math';
import { ComparisonMode, MetricType, TimeframePreset } from '@/lib/types';

const TIMEFRAME_PRESETS: TimeframePreset[] = ['1M', '6M', 'YTD', '1Y', '3Y', '5Y', 'MAX'];

interface PerformanceChartProps {
  data: ChartDataPoint[];
  tickers: string[];
  sp500Symbol: string;
  nasdaqSymbol: string;
  vxusSymbol: string;
  showSp500: boolean;
  showNasdaq: boolean;
  showVxus: boolean;
  mode: ComparisonMode;
  onModeChange: (mode: ComparisonMode) => void;
  timeframe: TimeframePreset;
  onTimeframeChange: (preset: TimeframePreset) => void;
  startDate: string;
  endDate: string;
  onCustomDateChange: (start: string, end: string) => void;
  metric: MetricType;
  onMetricChange: (metric: MetricType) => void;
  initialCapital: number;
  loading: boolean;
  onRefresh: () => void;
}

interface TooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  metric: MetricType;
  initialCapital: number;
  sp500Symbol: string;
  nasdaqSymbol: string;
  vxusSymbol: string;
}

function CustomSortedTooltip({
  active,
  payload,
  label,
  metric,
  initialCapital,
  sp500Symbol,
  nasdaqSymbol,
  vxusSymbol,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Sort all active series from highest to lowest value on the hovered date
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  const formatLabel = (key: string) => {
    if (key === PORTFOLIO_KEY) return 'Weighted Portfolio';
    if (key === sp500Symbol) return `S&P 500 (${sp500Symbol})`;
    if (key === nasdaqSymbol) return `Nasdaq (${nasdaqSymbol})`;
    if (key === vxusSymbol) return `Intl Ex-US (${vxusSymbol})`;
    return key;
  };

  const formatValue = (val: number) => {
    if (metric === 'percentage') {
      const sign = val > 0 ? '+' : '';
      return `${sign}${val.toFixed(2)}%`;
    }
    return `$${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="bg-white/95 border-2 border-indigo-300 rounded-xl p-3.5 shadow-xl backdrop-blur-md min-w-[240px]">
      <div className="text-xs font-mono text-slate-500 border-b-2 border-slate-100 pb-1.5 mb-2 flex items-center justify-between">
        <span className="font-bold text-indigo-600">DATE</span>
        <span className="text-slate-900 font-bold">{label}</span>
      </div>
      <div className="space-y-1.5">
        {sorted.map((item) => {
          const val = Number(item.value) || 0;
          const isPositive = metric === 'percentage' ? val >= 0 : val >= initialCapital;
          const isBenchmark =
            item.dataKey === sp500Symbol ||
            item.dataKey === nasdaqSymbol ||
            item.dataKey === vxusSymbol;

          return (
            <div
              key={item.dataKey}
              className="flex items-center justify-between gap-4 text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className={
                    isBenchmark
                      ? 'text-slate-900 font-bold'
                      : 'text-slate-700 font-semibold'
                  }
                >
                  {formatLabel(item.dataKey)}
                </span>
              </div>
              <span
                className={
                  isPositive
                    ? 'text-emerald-600 font-bold'
                    : 'text-rose-600 font-bold'
                }
              >
                {formatValue(val)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PerformanceChart({
  data,
  tickers,
  sp500Symbol,
  nasdaqSymbol,
  vxusSymbol,
  showSp500,
  showNasdaq,
  showVxus,
  mode,
  onModeChange,
  timeframe,
  onTimeframeChange,
  startDate,
  endDate,
  onCustomDateChange,
  metric,
  onMetricChange,
  initialCapital,
  loading,
  onRefresh,
}: PerformanceChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const baselineValue = metric === 'percentage' ? 0 : initialCapital;

  return (
    <div className="bg-white/95 border-2 border-indigo-400 rounded-2xl p-4 sm:p-5 shadow-lg shadow-indigo-100/80 space-y-4">
      {/* Row 1: Chart Title & Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <span>
              {metric === 'percentage'
                ? 'Cumulative Percentage Return (%)'
                : `Growth of $${initialCapital.toLocaleString('en-US')} ($)`}
            </span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Normalized to{' '}
            <span className="font-semibold text-slate-800">
              {metric === 'percentage'
                ? '0.00%'
                : `$${initialCapital.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </span>{' '}
            at comparison start date (t₀). Dashed thick lines indicate market benchmarks.
          </p>
        </div>

        {/* Custom Interactive Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {mode === 'individual' ? (
            tickers.map((t, idx) => (
              <div
                key={t}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-bold"
              >
                <span
                  className="w-2.5 h-2.5 inline-block rounded-full"
                  style={{ backgroundColor: STOCK_COLORS[idx % STOCK_COLORS.length] }}
                />
                <span>{t}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-900 font-bold">
              <span
                className="w-3.5 h-1 inline-block rounded"
                style={{ backgroundColor: PORTFOLIO_COLOR }}
              />
              <span>Portfolio ({tickers.length})</span>
            </div>
          )}

          {showSp500 && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold">
              <span className="w-4 border-b-2 border-dashed border-emerald-600 inline-block" />
              <span>S&amp;P 500 ({sp500Symbol})</span>
            </div>
          )}

          {showNasdaq && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-bold">
              <span className="w-4 border-b-2 border-dashed border-orange-600 inline-block" />
              <span>Nasdaq ({nasdaqSymbol})</span>
            </div>
          )}

          {showVxus && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-100 border border-pink-300 text-pink-900 font-bold">
              <span className="w-4 border-b-2 border-dashed border-pink-600 inline-block" />
              <span>Intl ({vxusSymbol})</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Graph Toolbar (Plot Mode, Timeframe Presets, Date Range, Return % / Value $, Refresh) */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-3 bg-gradient-to-r from-indigo-50/80 via-sky-50/80 to-emerald-50/80 border-2 border-indigo-200 rounded-xl">
        {/* Left: Plot Individual Stocks vs Plot Combined Portfolio */}
        <div className="inline-flex bg-white p-1 rounded-xl border-2 border-indigo-200 shadow-sm">
          <button
            type="button"
            onClick={() => onModeChange('individual')}
            className={clsx(
              'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              mode === 'individual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Plot Individual Stocks
          </button>
          <button
            type="button"
            onClick={() => onModeChange('portfolio')}
            className={clsx(
              'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              mode === 'portfolio'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Plot Combined Portfolio
          </button>
        </div>

        {/* Right: Timeframe Presets, Custom Date Range, Return % / Value $, Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Presets */}
          <div className="inline-flex bg-white p-1 rounded-xl border-2 border-indigo-200 shadow-sm">
            {TIMEFRAME_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onTimeframeChange(preset)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all',
                  timeframe === preset
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Custom Start/End Date Pickers */}
          <div className="flex items-center gap-1.5 bg-white border-2 border-indigo-200 rounded-xl px-2.5 py-1 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <input
              type="date"
              value={startDate}
              max={endDate}
              aria-label="Start Date"
              onChange={(e) => onCustomDateChange(e.target.value, endDate)}
              className="bg-transparent text-xs font-mono font-semibold text-slate-800 focus:outline-none w-[110px]"
            />
            <span className="text-indigo-400 text-xs font-bold">→</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              aria-label="End Date"
              onChange={(e) => onCustomDateChange(startDate, e.target.value)}
              className="bg-transparent text-xs font-mono font-semibold text-slate-800 focus:outline-none w-[110px]"
            />
          </div>

          {/* Metric Toggle: Return % vs Value $ */}
          <div className="inline-flex bg-white p-1 rounded-xl border-2 border-indigo-200 shadow-sm">
            <button
              type="button"
              onClick={() => onMetricChange('percentage')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all',
                metric === 'percentage'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Percentage Return (%)"
            >
              <Percent className="w-3.5 h-3.5" />
              Return %
            </button>
            <button
              type="button"
              onClick={() => onMetricChange('dollar')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all',
                metric === 'dollar'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title={`Growth of $${initialCapital.toLocaleString('en-US')}`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Value $
            </button>
          </div>

          {/* Refresh Data Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh Data"
            className="p-2 rounded-xl bg-white border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={clsx('w-3.5 h-3.5', loading && 'animate-spin text-emerald-600')}
            />
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative h-[420px] w-full bg-slate-50/50 border border-slate-200 rounded-xl p-2">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/75 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
            <div className="px-4 py-2 rounded-xl bg-white border-2 border-sky-400 text-xs font-mono font-bold text-sky-700 flex items-center gap-2 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
              Synchronizing stock price time-series...
            </div>
          </div>
        )}

        {!mounted ? (
          <div className="w-full h-full bg-slate-100 rounded-xl animate-pulse" />
        ) : data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-sm font-mono text-slate-500 border-2 border-dashed border-slate-300 rounded-xl">
            Select at least one stock or benchmark to render chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 16, left: 8, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#cbd5e1"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fill: '#334155', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#94a3b8' }}
                minTickGap={38}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#334155', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#94a3b8' }}
                width={72}
                domain={['auto', 'auto']}
                tickFormatter={(val: number) =>
                  metric === 'percentage'
                    ? `${val > 0 ? '+' : ''}${val.toFixed(0)}%`
                    : `$${(val / 1000).toFixed(1)}k`
                }
              />
              <Tooltip
                content={
                  <CustomSortedTooltip
                    metric={metric}
                    initialCapital={initialCapital}
                    sp500Symbol={sp500Symbol}
                    nasdaqSymbol={nasdaqSymbol}
                    vxusSymbol={vxusSymbol}
                  />
                }
                cursor={{
                  stroke: '#6366f1',
                  strokeWidth: 1.5,
                  strokeDasharray: '4 4',
                }}
              />
              <ReferenceLine
                y={baselineValue}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />

              {/* Individual Stock Lines */}
              {mode === 'individual' &&
                tickers.map((ticker, idx) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    name={ticker}
                    stroke={STOCK_COLORS[idx % STOCK_COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}

              {/* Weighted Portfolio Line */}
              {mode === 'portfolio' && tickers.length > 0 && (
                <Line
                  type="monotone"
                  dataKey={PORTFOLIO_KEY}
                  name="Weighted Portfolio"
                  stroke={PORTFOLIO_COLOR}
                  strokeWidth={3.25}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}

              {/* Benchmark: S&P 500 (Thicker Dashed Line) */}
              {showSp500 && (
                <Line
                  type="monotone"
                  dataKey={sp500Symbol}
                  name={`S&P 500 (${sp500Symbol})`}
                  stroke={SP500_COLOR}
                  strokeWidth={2.75}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}

              {/* Benchmark: Nasdaq (Thicker Dashed Line) */}
              {showNasdaq && (
                <Line
                  type="monotone"
                  dataKey={nasdaqSymbol}
                  name={`Nasdaq (${nasdaqSymbol})`}
                  stroke={NASDAQ_COLOR}
                  strokeWidth={2.75}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}

              {/* Benchmark: VXUS (Thicker Dashed Line) */}
              {showVxus && (
                <Line
                  type="monotone"
                  dataKey={vxusSymbol}
                  name={`Intl Ex-US (${vxusSymbol})`}
                  stroke={VXUS_COLOR}
                  strokeWidth={2.75}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
