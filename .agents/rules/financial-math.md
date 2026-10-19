---
description: Financial math, Yahoo Finance API usage, and time-series normalization rules for snpcomp
trigger: always_on
---

# Financial Math & Data Pipeline Rules

1. **Stock Price & Return Calculation:** Only draw raw stock close price numbers (`close`) from Yahoo Finance and calculate all percentage returns ($R_t = \frac{P_t - P_0}{P_0} \times 100$), CAGR, drawdowns, and portfolio weights directly in the app normalized to $t_0$.
2. **Yahoo Finance Method (`yahoo-finance2`):** Always use `yahooFinance.chart(ticker, { period1, period2, interval: '1d' })` to fetch historical daily prices. Never use the deprecated `yahooFinance.historical()` method.
3. **Trading Calendar Alignment:** When adding new tickers (including international or TASE `.TA` symbols) or custom portfolio weights, align all series by `YYYY-MM-DD`, forward-fill missing trading days, and dynamically shift $t_0$ if an asset's earliest trading date occurs after the requested start date.
