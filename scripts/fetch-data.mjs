/**
 * Pre-fetches raw daily close prices from Yahoo Finance for every ticker in tickers.txt
 * and writes them to public/data/<TICKER>.json for the static GitHub Pages build.
 *
 * Uses yahooFinance.chart() (never .historical()), with the direct v8 chart endpoint as a
 * fallback if the library call is rate-limited.
 *
 * Output format: { "symbol": "TSM", "updatedAt": "...", "points": [["2015-01-02", 22.61], ...] }
 */
import fs from 'node:fs';
import path from 'node:path';
import YahooFinance from 'yahoo-finance2';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'data');
const START_DATE = '2015-01-01';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const tickers = Array.from(
  new Set(
    fs
      .readFileSync(path.join(ROOT, 'tickers.txt'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim().toUpperCase())
      .filter((l) => l && !l.startsWith('#'))
  )
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toPoints(entries) {
  const map = new Map();
  for (const [date, close] of entries) {
    if (typeof close === 'number' && !isNaN(close) && close > 0) {
      map.set(date, Number(close.toFixed(4)));
    }
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

async function viaLibrary(symbol) {
  const res = await yahooFinance.chart(
    symbol,
    { period1: new Date(`${START_DATE}T00:00:00Z`), period2: new Date(), interval: '1d' },
    { validateResult: false }
  );
  const quotes = res?.quotes ?? [];
  return toPoints(
    quotes
      .filter((q) => q && q.date)
      .map((q) => [new Date(q.date).toISOString().slice(0, 10), q.close])
  );
}

async function viaDirect(symbol) {
  const p1 = Math.floor(new Date(`${START_DATE}T00:00:00Z`).getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${p1}&period2=${p2}&interval=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  return toPoints(ts.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), closes[i]]));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const available = [];
const failed = [];

for (const symbol of tickers) {
  let points = [];
  for (let attempt = 1; attempt <= 3 && points.length < 2; attempt++) {
    try {
      points = await viaLibrary(symbol);
    } catch (e1) {
      try {
        points = await viaDirect(symbol);
      } catch (e2) {
        console.warn(`  ${symbol} attempt ${attempt} failed: ${e1?.message} / ${e2?.message}`);
        await sleep(1500 * attempt);
      }
    }
  }

  if (points.length >= 2) {
    fs.writeFileSync(
      path.join(OUT_DIR, `${symbol}.json`),
      JSON.stringify({ symbol, updatedAt: new Date().toISOString(), points })
    );
    available.push(symbol);
    console.log(`✓ ${symbol}: ${points.length} days (${points[0][0]} → ${points[points.length - 1][0]})`);
  } else {
    failed.push(symbol);
    console.warn(`✗ ${symbol}: no data`);
  }
  await sleep(250);
}

fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  JSON.stringify({ updatedAt: new Date().toISOString(), tickers: available.sort() })
);

console.log(`\nDone: ${available.length} tickers saved, ${failed.length} failed${failed.length ? ` (${failed.join(', ')})` : ''}.`);
if (!['SPY', 'QQQ', 'VXUS'].every((b) => available.includes(b))) {
  console.error('Benchmark data missing — failing the build.');
  process.exit(1);
}
