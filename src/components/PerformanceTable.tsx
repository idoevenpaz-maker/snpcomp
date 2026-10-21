'use client';

import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Briefcase,
  Compass,
} from 'lucide-react';
import { PerformanceRow } from '@/lib/types';
import { COMBINED_BENCH_KEY } from '@/lib/finance-math';

interface PerformanceTableProps {
  rows: PerformanceRow[];
  effectiveStartDate: string;
  effectiveEndDate: string;
  initialCapital: number;
}

type SortField =
  | 'label'
  | 'weightPct'
  | 'finalDollar'
  | 'startPrice'
  | 'endPrice'
  | 'totalReturnPct'
  | 'cagrPct'
  | 'maxDrawdownPct'
  | 'volatilityPct'
  | 'alphaVsSp500Pct';

export default function PerformanceTable({
  rows,
  effectiveStartDate,
  effectiveEndDate,
  initialCapital,
}: PerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalReturnPct');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'label');
    }
  };

  const sortGroup = useMemo(() => {
    const compareRows = (a: PerformanceRow, b: PerformanceRow) => {
      if (sortField === 'label') {
        return sortAsc
          ? a.label.localeCompare(b.label)
          : b.label.localeCompare(a.label);
      }
      const valA = Number(a[sortField] ?? -Infinity);
      const valB = Number(b[sortField] ?? -Infinity);
      return sortAsc ? valA - valB : valB - valA;
    };

    const portfolioRows = rows
      .filter((r) => r.type === 'stock' || r.type === 'portfolio')
      .sort(compareRows);
    const benchmarkRows = rows
      .filter((r) => r.type === 'benchmark')
      .sort(compareRows);

    return { portfolioRows, benchmarkRows };
  }, [rows, sortField, sortAsc]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 inline ml-1" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 text-sky-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-sky-600 inline ml-1" />
    );
  };

  const formatSignedPct = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const formatMoney = (val: number) => {
    return `$${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const renderRow = (row: PerformanceRow) => {
    const isPosReturn = row.totalReturnPct >= 0;
    const isPosCagr = row.cagrPct >= 0;
    const isPosAlpha = row.alphaVsSp500Pct >= 0;

    return (
      <tr
        key={row.symbol}
        className={clsx(
          'transition-colors hover:bg-sky-50/70',
          row.type === 'portfolio' && 'bg-sky-50/90 border-y-2 border-sky-300',
          row.type === 'benchmark' && 'bg-emerald-50/40'
        )}
      >
        {/* Asset Name + Badge */}
        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: row.color }}
            />
            <span>{row.label}</span>
            {row.type === 'portfolio' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500 text-white font-bold shadow-sm">
                TOTAL PORTFOLIO
              </span>
            )}
            {row.type === 'benchmark' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                BENCHMARK
              </span>
            )}
          </div>
        </td>

        {/* Portfolio Weight % */}
        <td className="py-3.5 px-4 text-right whitespace-nowrap">
          {row.weightPct !== undefined ? (
            <span
              className={clsx(
                'px-2.5 py-0.5 rounded-full text-xs font-bold',
                row.type === 'portfolio'
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-100 border border-slate-300 text-slate-800'
              )}
            >
              {row.weightPct.toFixed(1)}%
            </span>
          ) : (
            <span className="text-slate-500 text-xs font-semibold">100% Ref</span>
          )}
        </td>

        {/* Initial Dollar -> Final Dollar */}
        <td className="py-3.5 px-4 text-right text-slate-700 whitespace-nowrap">
          {row.initialDollar !== undefined && row.finalDollar !== undefined ? (
            <>
              <span className="text-slate-500">{formatMoney(row.initialDollar)}</span>
              <span className="text-slate-400 mx-1.5 font-bold">→</span>
              <span
                className={clsx(
                  'font-bold',
                  row.finalDollar >= row.initialDollar
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                )}
              >
                {formatMoney(row.finalDollar)}
              </span>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>

        {/* Start Price / End Price */}
        <td className="py-3.5 px-4 text-right text-slate-700 whitespace-nowrap">
          {row.type === 'portfolio' ? (
            <span className="text-sky-700 font-semibold text-xs">Weighted Basket</span>
          ) : row.symbol === COMBINED_BENCH_KEY ? (
            <span className="text-slate-700 font-semibold text-xs">Blended Benchmarks</span>
          ) : (
            <>
              <span className="text-slate-500">${row.startPrice.toFixed(2)}</span>
              <span className="text-slate-400 mx-1.5 font-bold">→</span>
              <span className="text-slate-900 font-bold">
                ${row.endPrice.toFixed(2)}
              </span>
            </>
          )}
        </td>

        {/* Total Cumulative Return (%) */}
        <td
          className={clsx(
            'py-3.5 px-4 text-right font-bold whitespace-nowrap',
            isPosReturn ? 'text-emerald-600' : 'text-rose-600'
          )}
        >
          {formatSignedPct(row.totalReturnPct)}
        </td>

        {/* Annualized Return (CAGR %) */}
        <td
          className={clsx(
            'py-3.5 px-4 text-right font-bold whitespace-nowrap',
            isPosCagr ? 'text-emerald-600' : 'text-rose-600'
          )}
        >
          {formatSignedPct(row.cagrPct)}
        </td>

        {/* Max Drawdown (%) */}
        <td className="py-3.5 px-4 text-right text-rose-600 font-bold whitespace-nowrap">
          {row.maxDrawdownPct.toFixed(2)}%
        </td>

        {/* Annualized Volatility (%) */}
        <td className="py-3.5 px-4 text-right text-slate-700 font-semibold whitespace-nowrap">
          {row.volatilityPct.toFixed(2)}%
        </td>

        {/* Vs. S&P 500 (Alpha %) */}
        <td
          className={clsx(
            'py-3.5 px-4 text-right font-bold whitespace-nowrap',
            Math.abs(row.alphaVsSp500Pct) < 0.005
              ? 'text-slate-500'
              : isPosAlpha
              ? 'text-emerald-600'
              : 'text-rose-600'
          )}
        >
          {Math.abs(row.alphaVsSp500Pct) < 0.005
            ? '0.00%'
            : formatSignedPct(row.alphaVsSp500Pct)}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white/95 border-2 border-amber-400 rounded-2xl overflow-hidden shadow-lg shadow-amber-100/80">
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/80 via-white to-sky-50/80 border-b-2 border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-700">
            <TrendingUp className="w-4 h-4" />
          </span>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Performance &amp; Portfolio Allocation Breakdown Table
          </h2>
        </div>
        <div className="text-xs font-mono text-slate-600">
          Window: <span className="text-slate-900 font-bold">{effectiveStartDate}</span> →{' '}
          <span className="text-slate-900 font-bold">{effectiveEndDate}</span> | Total Capital:{' '}
          <span className="text-emerald-600 font-bold">
            ${initialCapital.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/90 border-b-2 border-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 select-none">
              <th
                onClick={() => handleSort('label')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
              >
                Asset / Benchmark {renderSortIcon('label')}
              </th>
              <th
                onClick={() => handleSort('weightPct')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Weight % {renderSortIcon('weightPct')}
              </th>
              <th
                onClick={() => handleSort('finalDollar')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Initial → Ending Value ($) {renderSortIcon('finalDollar')}
              </th>
              <th
                onClick={() => handleSort('startPrice')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Start / End Price {renderSortIcon('startPrice')}
              </th>
              <th
                onClick={() => handleSort('totalReturnPct')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Cumulative Return {renderSortIcon('totalReturnPct')}
              </th>
              <th
                onClick={() => handleSort('cagrPct')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Annualized (CAGR) {renderSortIcon('cagrPct')}
              </th>
              <th
                onClick={() => handleSort('maxDrawdownPct')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Max Drawdown {renderSortIcon('maxDrawdownPct')}
              </th>
              <th
                onClick={() => handleSort('volatilityPct')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Annual Volatility {renderSortIcon('volatilityPct')}
              </th>
              <th
                onClick={() => handleSort('alphaVsSp500Pct')}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
              >
                Vs. S&amp;P 500 (Alpha) {renderSortIcon('alphaVsSp500Pct')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-mono">
            {/* Section 1 Header: Portfolio & Holdings */}
            {sortGroup.portfolioRows.length > 0 && (
              <tr className="bg-sky-100/90 border-y-2 border-sky-300">
                <td
                  colSpan={9}
                  className="py-2 px-4 text-[11px] font-mono font-bold uppercase tracking-wider text-sky-900"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-sky-600" />
                    <span>Your Portfolio &amp; Selected Equities</span>
                  </div>
                </td>
              </tr>
            )}
            {sortGroup.portfolioRows.map(renderRow)}

            {/* Section 2 Header: Market Benchmarks */}
            {sortGroup.benchmarkRows.length > 0 && (
              <tr className="bg-emerald-100/90 border-y-2 border-emerald-300">
                <td
                  colSpan={9}
                  className="py-2 px-4 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-900"
                >
                  <div className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Market Benchmarks (If Entire ${initialCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })} Was Invested in Index)
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {sortGroup.benchmarkRows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
