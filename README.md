# AlphaBench (`snpcomp`)

**Bright Portfolio & Equity Benchmark Comparison Studio** built with Next.js 15, TypeScript, Tailwind CSS, Recharts, and `yahoo-finance2`.

## Live site

**https://idoevenpaz-maker.github.io/snpcomp/**

Hosted free on GitHub Pages. A GitHub Actions workflow ([deploy.yml](.github/workflows/deploy.yml)):
1. Runs [`scripts/fetch-data.mjs`](scripts/fetch-data.mjs), which downloads raw daily **close** prices with `yahooFinance.chart()` for every ticker in [`tickers.txt`](tickers.txt).
2. Builds the site as static files and publishes it to GitHub Pages.
3. Re-runs automatically every weekday after the US market close so prices stay fresh.

All returns ($R_t = \frac{P_t - P_0}{P_0} \times 100$), CAGR, drawdowns, volatility and alpha are calculated in the browser from those raw close prices.

## Adding stocks

Edit [`tickers.txt`](tickers.txt) on GitHub, add one symbol per line, and commit. The site rebuilds in ~2 minutes with the new ticker available.

## Features
- **Dual Position Sizing (`$` & `%`)** out of an editable Total Portfolio Sum.
- **Benchmarks:** S&P 500 (`SPY`), Nasdaq-100 (`QQQ`), Total International (`VXUS`).
- **Dynamic IPO start-date shift ($t_0$)** for late-IPO stocks (e.g. `ALAB`, `ARM`, `RDDT`).
