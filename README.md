# bbcalc — bLink Sync Cost Calculator

A small, dependency-free web app that estimates the cost of keeping a customer's bank
accounts in sync over the [SIX bLink](https://www.blink.ch/) platform.

Pick a bank, a sync frequency, add the customer's accounts with their expected
transaction volume, choose how far back to load data initially — and get a transparent,
itemised cost estimate (recurring monthly + one-time initial load).

## Run it

No build step. Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The layout is responsive and works on mobile.

## Deploy

The site is served by nginx via the included `Dockerfile` (SPA fallback in `nginx.conf`).
It's a plain static site with no build step — files live at the repository root and are
copied straight into nginx's web root.

**Dokploy:** set **Build Type = Dockerfile**, Build Path `/`, branch `main`. No other
configuration is needed — nginx listens on port 80 and Dokploy proxies to it.

**Locally:**

```bash
docker build -t bbcalc . && docker run -p 8080:80 bbcalc   # → http://localhost:8080
```

Or, with no Docker at all, just open `index.html` or run `python3 -m http.server`.

## What it models

Every request over bLink is an **AIS (Account Information Service)** call, billed at the
bank's per-call price. The calculator breaks costs into two parts.

### Recurring — per sync run (N = number of accounts)

| Item          | Calls |
|---------------|-------|
| Account list  | 1 (once per run) |
| Balances      | N (one per account) |
| Transactions  | N (assumes one call fetches all new TXs) |

Sync frequency has two cadences — monthly figures use **31 days / 4 weeks**:

- **Daily** — `1 + N` syncs per day, where **N intraday syncs** is configurable
  (1 end-of-day close + N intraday). So `N = 3` → 4 syncs/day, `N = 0` → 1/day.
- **Weekly** — one sync per week.

The account list is queried once per sync day (or once per week for the weekly cadence).

On the **weekly** cadence, a **"capture a balance for every day"** toggle switches the
recurring balance calls from once per week (~4/mo per account) to one per day (~31/mo) —
because balances have no pagination, each day is a separate call. It has no effect on the
daily cadence, which already fetches at least daily, so the toggle is shown only for weekly.

### Initial load — one-time

| Item                    | Calls |
|-------------------------|-------|
| Account list            | 1 |
| Balance history         | 1 per day per account over the load window (no pagination) — optional |
| Transaction backfill    | ⌈expected TX ÷ page size⌉ per account |
| Customer registration   | the bank's one-time registration fee |

Balance history is the single biggest cost driver and can be toggled off.

## Pricing source

Bank prices come from the **SIX bLink Platform Price List, Annex 4** (D0554.EN.13):

- Per-call price = the bank's **AIS** rate (§8.3)
- Registration fee = §8.2

Banks not listed in the price list charge CHF 0 for API calls and registration; they are
represented by the *"Other bLink bank"* option. SIX retains 20% of these prices from the
provider, but the Service User still pays the full list price shown here.

> SIX platform **participation** (CHF 200/month) and **onboarding** (one-time) fees are
> fixed and independent of the number of users, so they are intentionally excluded from
> this per-user estimate.

## Reference figures

The model reproduces the numbers from the internal pricing discussion. For a CHF 0.10/call
bank with 3 accounts (120 / 40 / 20 expected TX) and a 3-month history load:

| Frequency  | Recurring / month |
|------------|-------------------|
| 4× per day | CHF 77.50 |
| 1× per day | CHF 21.70 |
| 1× per week | CHF 2.80 |

Initial load = **285 API calls** (1 account list + 92×3 balance-history + 8 TX backfill).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup |
| `styles.css` | Responsive styling (light + dark) |
| `data.js`    | Bank prices, frequency presets, default assumptions |
| `calc.js`    | Pure pricing engine (`computePricing`) |
| `app.js`     | UI wiring |

`calc.js` and `data.js` also export via CommonJS, so the engine can be unit-tested with
Node (`node -e "..."`).
