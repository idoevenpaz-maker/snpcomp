# AlphaBench (`snpcomp`)

**Bright Portfolio & Equity Benchmark Comparison Studio** built with Next.js 15 (App Router), TypeScript, Tailwind CSS, Recharts, and `yahoo-finance2`.

## Deploy Online in 1 Click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fidoevenpaz-maker%2Fsnpcomp)

1. Click the **Deploy with Vercel** button above (or visit [vercel.com/new](https://vercel.com/new) and import `idoevenpaz-maker/snpcomp`).
2. Click **Deploy** — no environment variables or API keys are required.
3. Your live `.vercel.app` website URL will be ready in ~45 seconds!

## Features
- **Live Yahoo Finance Raw Close Prices**: Draws raw `close` prices via `yahooFinance.chart()` and computes cumulative percentage returns ($R_t = \frac{P_t - P_0}{P_0} \times 100$), CAGR, Max Drawdown, Annualized Volatility, and S&P 500 Alpha directly in the app.
- **Dual Position Sizing (`$` & `%`)**: Edit either the **Dollar Amount (`$`)** or **Percentage Weight (`%`)** invested in each stock out of an editable **Total Portfolio Sum (`$`)**.
- **Built-in Market Benchmarks**: Compare against **S&P 500 (`SPY`)**, **Nasdaq-100 (`QQQ`)**, and **Total International (`VXUS`)**.
- **Dynamic IPO Start Date Shift ($t_0$)**: Automatically shifts the comparison start date when comparing late-IPO equities (e.g., `ALAB`, `PLTR`, `ARM`, `RDDT`).
