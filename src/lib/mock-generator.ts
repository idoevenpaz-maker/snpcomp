/**
 * Deterministic fallback stock price generator using a seeded PRNG (Mulberry32)
 * and Geometric Brownian Motion (GBM) calibrated to realistic market profiles,
 * including real IPO dates for late-IPO stocks to support dynamic t0 shifting.
 */

interface TickerProfile {
  name: string;
  basePrice2015: number;
  annualDrift: number;
  annualVol: number;
  ipoDate: string; // YYYY-MM-DD
}

const KNOWN_PROFILES: Record<string, TickerProfile> = {
  SPY: {
    name: 'S&P 500 ETF',
    basePrice2015: 180.0,
    annualDrift: 0.118,
    annualVol: 0.165,
    ipoDate: '1993-01-29',
  },
  '^GSPC': {
    name: 'S&P 500 Index',
    basePrice2015: 2050.0,
    annualDrift: 0.115,
    annualVol: 0.165,
    ipoDate: '1957-03-04',
  },
  QQQ: {
    name: 'Invesco QQQ (Nasdaq-100)',
    basePrice2015: 98.0,
    annualDrift: 0.165,
    annualVol: 0.215,
    ipoDate: '1999-03-10',
  },
  '^IXIC': {
    name: 'Nasdaq Composite',
    basePrice2015: 4700.0,
    annualDrift: 0.155,
    annualVol: 0.215,
    ipoDate: '1971-02-05',
  },
  VXUS: {
    name: 'Vanguard Total International Stock ETF',
    basePrice2015: 48.0,
    annualDrift: 0.065,
    annualVol: 0.155,
    ipoDate: '2011-01-26',
  },
  AAPL: {
    name: 'Apple Inc.',
    basePrice2015: 25.0,
    annualDrift: 0.235,
    annualVol: 0.275,
    ipoDate: '1980-12-12',
  },
  MSFT: {
    name: 'Microsoft Corp.',
    basePrice2015: 41.0,
    annualDrift: 0.245,
    annualVol: 0.255,
    ipoDate: '1986-03-13',
  },
  NVDA: {
    name: 'NVIDIA Corp.',
    basePrice2015: 0.52,
    annualDrift: 0.56,
    annualVol: 0.44,
    ipoDate: '1999-01-22',
  },
  GOOGL: {
    name: 'Alphabet Inc.',
    basePrice2015: 26.5,
    annualDrift: 0.195,
    annualVol: 0.27,
    ipoDate: '2004-08-19',
  },
  AMZN: {
    name: 'Amazon.com Inc.',
    basePrice2015: 15.5,
    annualDrift: 0.255,
    annualVol: 0.31,
    ipoDate: '1997-05-15',
  },
  META: {
    name: 'Meta Platforms Inc.',
    basePrice2015: 78.0,
    annualDrift: 0.21,
    annualVol: 0.36,
    ipoDate: '2012-05-18',
  },
  TSLA: {
    name: 'Tesla Inc.',
    basePrice2015: 14.0,
    annualDrift: 0.34,
    annualVol: 0.54,
    ipoDate: '2010-06-29',
  },
  PLTR: {
    name: 'Palantir Technologies',
    basePrice2015: 9.5,
    annualDrift: 0.38,
    annualVol: 0.58,
    ipoDate: '2020-09-30',
  },
  COIN: {
    name: 'Coinbase Global',
    basePrice2015: 250.0,
    annualDrift: 0.14,
    annualVol: 0.68,
    ipoDate: '2021-04-14',
  },
  ARM: {
    name: 'Arm Holdings plc',
    basePrice2015: 63.0,
    annualDrift: 0.42,
    annualVol: 0.52,
    ipoDate: '2023-09-14',
  },
  RDDT: {
    name: 'Reddit Inc.',
    basePrice2015: 50.0,
    annualDrift: 0.55,
    annualVol: 0.62,
    ipoDate: '2024-03-21',
  },
};

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMullerNormal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function isKnownFallbackSymbol(symbol: string): boolean {
  return Boolean(KNOWN_PROFILES[symbol.toUpperCase()]);
}

export function getTickerProfile(symbol: string): TickerProfile {
  const upper = symbol.toUpperCase();
  if (KNOWN_PROFILES[upper]) {
    return KNOWN_PROFILES[upper];
  }
  const seed = hashString(upper);
  const rng = mulberry32(seed);
  return {
    name: upper,
    basePrice2015: 30 + Math.round(rng() * 150),
    annualDrift: 0.06 + rng() * 0.22,
    annualVol: 0.18 + rng() * 0.28,
    ipoDate: '2010-01-04',
  };
}

/**
 * Generates trading days (Monday-Friday, skipping major fixed US holidays) between two YYYY-MM-DD dates.
 */
export function generateTradingDays(startDateStr: string, endDateStr: string): string[] {
  const start = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);
  const dates: string[] = [];

  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      const iso = cur.toISOString().slice(0, 10);
      const monthDay = iso.slice(5);
      // Skip New Year's Day, Independence Day, Christmas
      if (monthDay !== '01-01' && monthDay !== '07-04' && monthDay !== '12-25') {
        dates.push(iso);
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Generates a deterministic daily adjusted close history for a given symbol from anchor date 2015-01-02
 * (or its IPO date if later) through endDateStr, returning points within [startDateStr, endDateStr].
 */
export function generateDeterministicSeries(
  symbol: string,
  startDateStr: string,
  endDateStr: string
): { date: string; adjClose: number }[] {
  const upper = symbol.toUpperCase();
  const profile = getTickerProfile(upper);

  const anchorStart = profile.ipoDate > '2015-01-02' ? profile.ipoDate : '2015-01-02';
  const simStart = startDateStr < anchorStart ? startDateStr : anchorStart;

  const allTradingDays = generateTradingDays(simStart, endDateStr);
  const rng = mulberry32(hashString(`SERIES_${upper}_V1`));
  const marketRng = mulberry32(hashString('GLOBAL_MARKET_FACTOR_V1'));

  const dt = 1 / 252;
  const mu = profile.annualDrift;
  const sigma = profile.annualVol;

  let price = profile.basePrice2015;
  const result: { date: string; adjClose: number }[] = [];

  for (const date of allTradingDays) {
    // Do not emit data prior to the ticker's IPO date
    if (date < profile.ipoDate) {
      marketRng(); // advance global market factor in lockstep
      continue;
    }

    const marketShock = boxMullerNormal(marketRng);
    const idioShock = boxMullerNormal(rng);
    // Blend 65% market correlation + 35% idiosyncratic shock for realistic co-movement
    const z = 0.65 * marketShock + Math.sqrt(1 - 0.65 * 0.65) * idioShock;

    const dailyReturn = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
    price = Math.max(0.05, price * dailyReturn);

    if (date >= startDateStr && date <= endDateStr) {
      result.push({
        date,
        adjClose: Number(price.toFixed(4)),
      });
    }
  }

  return result;
}
