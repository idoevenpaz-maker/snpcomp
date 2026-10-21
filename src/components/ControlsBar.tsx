'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import {
  Plus,
  X,
  Sparkles,
  Check,
  Scale,
  Wallet,
  Briefcase,
  Compass,
  Combine,
} from 'lucide-react';
import { STOCK_COLORS, resolveNormalizedWeights } from '@/lib/finance-math';

export type BenchmarkKey = 'sp500' | 'nasdaq' | 'vxus';
export type BenchmarkMixWeights = Record<BenchmarkKey, number>;

const MIX_FIELDS: Array<{ key: BenchmarkKey; label: string; ring: string }> = [
  { key: 'sp500', label: 'SPY', ring: 'border-emerald-400 focus:border-emerald-600' },
  { key: 'nasdaq', label: 'QQQ', ring: 'border-orange-400 focus:border-orange-600' },
  { key: 'vxus', label: 'VXUS', ring: 'border-pink-400 focus:border-pink-600' },
];

const MIX_PRESETS: Array<{ label: string; weights: BenchmarkMixWeights }> = [
  { label: '60/40 US/Intl', weights: { sp500: 60, nasdaq: 0, vxus: 40 } },
  { label: '80/20 US/Intl', weights: { sp500: 80, nasdaq: 0, vxus: 20 } },
  { label: 'Equal 1/3', weights: { sp500: 33.33, nasdaq: 33.33, vxus: 33.34 } },
];

const QUICK_ADD_SUGGESTIONS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor' },
  { symbol: 'ALAB', name: 'Astera Labs' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'PLTR', name: 'Palantir (2020 IPO)' },
];

interface ControlsBarProps {
  tickers: string[];
  onAddTicker: (ticker: string) => void;
  onRemoveTicker: (ticker: string) => void;
  weights: Record<string, number>;
  onWeightChange: (ticker: string, weight: number) => void;
  onStockDollarChange: (ticker: string, dollarAmount: number) => void;
  onEqualizeWeights: () => void;
  initialCapital: number;
  onInitialCapitalChange: (amount: number) => void;
  showSp500: boolean;
  onToggleSp500: () => void;
  showNasdaq: boolean;
  onToggleNasdaq: () => void;
  showVxus: boolean;
  onToggleVxus: () => void;
  showCombined: boolean;
  onToggleCombined: () => void;
  benchMix: BenchmarkMixWeights;
  onBenchMixChange: (next: BenchmarkMixWeights) => void;
}

export default function ControlsBar({
  tickers,
  onAddTicker,
  onRemoveTicker,
  weights,
  onWeightChange,
  onStockDollarChange,
  onEqualizeWeights,
  initialCapital,
  onInitialCapitalChange,
  showSp500,
  onToggleSp500,
  showNasdaq,
  onToggleNasdaq,
  showVxus,
  onToggleVxus,
  showCombined,
  onToggleCombined,
  benchMix,
  onBenchMixChange,
}: ControlsBarProps) {
  const mixSum = benchMix.sp500 + benchMix.nasdaq + benchMix.vxus;
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputVal.trim().toUpperCase();
    if (cleaned) {
      onAddTicker(cleaned);
      setInputVal('');
    }
  };

  const rawWeightSum = tickers.reduce((acc, t) => acc + (Number(weights[t]) || 0), 0);
  const normWeights = resolveNormalizedWeights(tickers, weights);
  const isSum100 = Math.abs(rawWeightSum - 100) < 0.1;

  return (
    <div className="space-y-4">
      {/* SECTION 1: PORTFOLIO BUILDER & CAPITAL ALLOCATION */}
      <div className="bg-white/95 border-2 border-sky-400 shadow-lg shadow-sky-100/80 rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-sky-100">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-sky-100 border border-sky-300 text-sky-600 shadow-sm">
              <Briefcase className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-sky-800">
                1. Your Equity Portfolio &amp; Position Sizing
              </h2>
              <p className="text-xs text-slate-600">
                Add equities and edit either the{' '}
                <span className="text-slate-900 font-semibold">Dollar Amount ($)</span> or{' '}
                <span className="text-slate-900 font-semibold">Weight (%)</span> for each position.
              </p>
            </div>
          </div>
        </div>

        {/* Ticker Input, Active Chips, and Quick-Add Suggestions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value.toUpperCase())}
                placeholder="Add ticker (e.g. NVDA)..."
                maxLength={10}
                aria-label="Add stock ticker"
                className="w-48 sm:w-56 bg-sky-50/60 border-2 border-sky-300 focus:border-sky-600 focus:bg-white focus:outline-none rounded-xl pl-3 pr-9 py-1.5 text-sm font-mono font-semibold text-slate-800 placeholder:text-slate-400 transition-colors"
              />
              <button
                type="submit"
                title="Add Ticker"
                className="absolute right-1.5 p-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {/* Active Ticker Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {tickers.map((t, idx) => {
                const color = STOCK_COLORS[idx % STOCK_COLORS.length];
                return (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold bg-white border-2 border-slate-300 text-slate-800 shadow-sm"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {t}
                    <button
                      type="button"
                      onClick={() => onRemoveTicker(t)}
                      aria-label={`Remove ${t}`}
                      className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Quick-Add Preset Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-amber-600 flex items-center gap-1 mr-1 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick Add:
            </span>
            {QUICK_ADD_SUGGESTIONS.map((item) => {
              const isSelected = tickers.includes(item.symbol);
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() =>
                    isSelected ? onRemoveTicker(item.symbol) : onAddTicker(item.symbol)
                  }
                  title={item.name}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border-2 flex items-center gap-1',
                    isSelected
                      ? 'bg-sky-100 border-sky-500 text-sky-900 font-bold shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-sky-300'
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-sky-600" />}
                  {item.symbol}
                </button>
              );
            })}
          </div>
        </div>

        {/* Total Investment Capital & Per-Stock Dual ($ and %) Allocation Grid */}
        {tickers.length > 0 && (
          <div className="bg-gradient-to-r from-sky-50/80 via-indigo-50/50 to-amber-50/60 border-2 border-sky-200 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-sky-200/70">
              {/* Total Investment Capital Input */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-sky-600" />
                  <label
                    htmlFor="total-investment-input"
                    className="text-xs font-mono uppercase tracking-wider text-slate-800 font-bold"
                  >
                    Total Portfolio Sum ($):
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-xs font-mono font-bold text-emerald-700">
                      $
                    </span>
                    <input
                      id="total-investment-input"
                      type="number"
                      min={1}
                      step={100}
                      value={Number(initialCapital.toFixed(2))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onInitialCapitalChange(isNaN(val) || val < 0 ? 0 : val);
                      }}
                      className="w-32 bg-white border-2 border-emerald-400 focus:border-emerald-600 focus:outline-none rounded-lg pl-6 pr-2.5 py-1 text-xs font-mono font-bold text-emerald-700 shadow-sm"
                    />
                  </div>
                </div>

                {/* Quick Capital Presets */}
                <div className="flex items-center gap-1.5">
                  {[1000, 10000, 50000, 100000].map((presetAmt) => (
                    <button
                      key={presetAmt}
                      type="button"
                      onClick={() => onInitialCapitalChange(presetAmt)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-[11px] font-mono border-2 transition-colors',
                        Math.abs(initialCapital - presetAmt) < 0.5
                          ? 'bg-emerald-500 border-emerald-600 text-white font-bold shadow-sm'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300'
                      )}
                    >
                      ${presetAmt.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight Sum Indicator & Equalize Button */}
              <div className="flex items-center gap-2.5 text-xs font-mono">
                <span
                  className={clsx(
                    'px-2.5 py-1 rounded-lg border-2 font-bold',
                    isSum100
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                      : 'bg-amber-100 border-amber-400 text-amber-900'
                  )}
                >
                  Total Weight: {rawWeightSum.toFixed(1)}%
                  {!isSum100 && ' (Normalized to 100%)'}
                </span>

                <button
                  type="button"
                  onClick={onEqualizeWeights}
                  className="px-3 py-1 rounded-lg bg-white hover:bg-sky-50 border-2 border-sky-400 text-sky-800 font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                  title="Split Total Portfolio Sum equally across all selected stocks"
                >
                  <Scale className="w-3.5 h-3.5 text-sky-600" />
                  Equalize (1/N)
                </button>
              </div>
            </div>

            {/* Per-Stock Cards with BOTH Editable Dollar ($) and Editable Weight (%) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {tickers.map((t, idx) => {
                const color = STOCK_COLORS[idx % STOCK_COLORS.length];
                const rawW = weights[t] ?? 0;
                const effectiveFrac = normWeights[t] ?? 0;
                const stockDollar = Number((initialCapital * (rawW / 100)).toFixed(2));

                return (
                  <div
                    key={t}
                    className="bg-white border-2 border-slate-300 hover:border-sky-500 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all shadow-sm"
                  >
                    {/* Card Header: Symbol & Share */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span>{t}</span>
                      </div>
                      <span className="text-[11px] font-mono text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                        {(effectiveFrac * 100).toFixed(1)}% share
                      </span>
                    </div>

                    {/* Dual Inputs: Dollar ($) & Percentage (%) */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Editable Dollar Amount ($) */}
                      <div>
                        <label
                          htmlFor={`dollar-${t}`}
                          className="block text-[10px] font-mono uppercase font-semibold text-slate-500 mb-0.5"
                        >
                          Amount ($)
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-xs font-mono font-bold text-emerald-600">
                            $
                          </span>
                          <input
                            id={`dollar-${t}`}
                            type="number"
                            min={0}
                            step={50}
                            aria-label={`${t} dollar amount`}
                            value={stockDollar}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              onStockDollarChange(t, isNaN(val) || val < 0 ? 0 : val);
                            }}
                            className="w-full bg-emerald-50/50 border-2 border-emerald-300 focus:border-emerald-600 focus:bg-white focus:outline-none rounded-lg pl-5 pr-2 py-1 text-right text-xs font-mono font-bold text-emerald-800"
                          />
                        </div>
                      </div>

                      {/* Editable Percentage Weight (%) */}
                      <div>
                        <label
                          htmlFor={`weight-${t}`}
                          className="block text-[10px] font-mono uppercase font-semibold text-slate-500 mb-0.5"
                        >
                          Weight (%)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id={`weight-${t}`}
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            aria-label={`${t} weight percentage`}
                            value={Number(rawW.toFixed(2))}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              onWeightChange(t, isNaN(val) || val < 0 ? 0 : val);
                            }}
                            className="w-full bg-sky-50/50 border-2 border-sky-300 focus:border-sky-600 focus:bg-white focus:outline-none rounded-lg pl-2 pr-5 py-1 text-right text-xs font-mono font-bold text-slate-800"
                          />
                          <span className="absolute right-2 text-xs font-mono font-bold text-sky-700">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Visual Share Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, effectiveFrac * 100))}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: MARKET BENCHMARKS BAR */}
      <div className="bg-white/95 border-2 border-emerald-400 shadow-lg shadow-emerald-100/80 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 shadow-sm">
              <Compass className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-emerald-800">
                2. Market Benchmarks Reference
              </h2>
              <p className="text-xs text-slate-600">
                Toggle major index benchmarks to compare against your portfolio.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleSp500}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border-2 flex items-center gap-2 transition-all',
                showSp500
                  ? 'bg-emerald-100 border-emerald-500 text-emerald-900 shadow-sm'
                  : 'bg-slate-50 border-slate-300 text-slate-500 hover:text-slate-800'
              )}
            >
              <span className="w-3.5 border-b-2 border-dashed border-emerald-600 inline-block" />
              S&amp;P 500 (SPY)
            </button>

            <button
              type="button"
              onClick={onToggleNasdaq}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border-2 flex items-center gap-2 transition-all',
                showNasdaq
                  ? 'bg-amber-100 border-amber-500 text-amber-900 shadow-sm'
                  : 'bg-slate-50 border-slate-300 text-slate-500 hover:text-slate-800'
              )}
            >
              <span className="w-3.5 border-b-2 border-dashed border-orange-600 inline-block" />
              Nasdaq (QQQ)
            </button>

            <button
              type="button"
              onClick={onToggleVxus}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border-2 flex items-center gap-2 transition-all',
                showVxus
                  ? 'bg-pink-100 border-pink-500 text-pink-900 shadow-sm'
                  : 'bg-slate-50 border-slate-300 text-slate-500 hover:text-slate-800'
              )}
            >
              <span className="w-3.5 border-b-2 border-dashed border-pink-600 inline-block" />
              Intl (VXUS)
            </button>

            <button
              type="button"
              onClick={onToggleCombined}
              title="Plot one blended line that mixes SPY, QQQ and VXUS by the weights you choose"
              className={clsx(
                'px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border-2 flex items-center gap-2 transition-all',
                showCombined
                  ? 'bg-slate-800 border-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 border-slate-300 text-slate-500 hover:text-slate-800'
              )}
            >
              <Combine className="w-3.5 h-3.5" />
              Combined Mix
            </button>
          </div>
        </div>

        {/* Combined benchmark weights */}
        {showCombined && (
          <div className="mt-4 pt-3 border-t-2 border-emerald-100 flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              Combined mix weights:
            </span>
            {MIX_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700">
                {f.label}
                <span className="relative flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={`${f.label} weight in combined benchmark`}
                    value={Number(benchMix[f.key].toFixed(2))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBenchMixChange({
                        ...benchMix,
                        [f.key]: isNaN(val) || val < 0 ? 0 : val,
                      });
                    }}
                    className={clsx(
                      'w-20 bg-white border-2 focus:outline-none rounded-lg pl-2 pr-5 py-1 text-right text-xs font-mono font-bold text-slate-800',
                      f.ring
                    )}
                  />
                  <span className="absolute right-2 text-xs font-mono font-bold text-slate-500">%</span>
                </span>
              </label>
            ))}
            <span
              className={clsx(
                'px-2.5 py-1 rounded-lg border-2 text-xs font-mono font-bold',
                Math.abs(mixSum - 100) < 0.1
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                  : 'bg-amber-100 border-amber-400 text-amber-900'
              )}
            >
              Total: {mixSum.toFixed(1)}%
              {Math.abs(mixSum - 100) >= 0.1 && ' (Normalized to 100%)'}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {MIX_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onBenchMixChange(p.weights)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono border-2 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-500"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
