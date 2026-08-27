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

### Recurring — per month (N = number of accounts)

Account list, balances and transactions each run on their **own independent cadence**:

| Sync | Calls per run | Cadence options |
|------|---------------|-----------------|
| Account list | 1 | Daily · Weekly · Monthly |
| Balances | N (one per account) | Daily (× syncs/day) · Weekly |
| Transactions | N (one call fetches all new TXs) | Daily (× syncs/day) · Weekly |

Runs per month come from the **calendar basis**: a daily cadence = `syncs/day × days/month`,
weekly = `weeks/month`, monthly = 1. So, e.g., balances 4×/day with 30 days/month = 120
balance-syncs/month, while transactions can be weekly at the same time — fully decoupled.
This also covers the no-pagination balance case: set balances to daily and transactions to
weekly to capture a daily balance point without daily TX fetches.

### Initial load — one-time

| Item                    | Calls |
|-------------------------|-------|
| Account list            | 1 |
| Balance history         | 1 per point per account over the window, at the **balance-sync cadence** (daily → 1/day, weekly → 1/week, monthly → 1/month; no pagination) — optional |
| Transaction backfill    | ⌈expected TX ÷ page size⌉ per account |
| Customer registration   | the bank's one-time registration fee |

The backfill respects the config: the balance history granularity follows the balance-sync
cadence, and the TX backfill follows the page size. Balance history is the biggest one-time
cost driver and can be toggled off.

## Configurable inputs

- **Calendar basis** (top of the form) — three independent fields: **days/month** (daily
  counts + balance history), **weeks/month** (weekly cadence), **days/year** (annual
  projection, `months/year = days-year ÷ days-month`). Defaults are plain round numbers
  (30 / 4 / 365); each label shows the accurate calendar value (30.44 / 4.35 / 365.25).
- **Price per API call** and **Registration** (under the bank) — pre-filled from the price
  list for the selected bank, editable to model negotiated / volume rates.
- Plus users, sync cadence + intraday count, account-list refresh, accounts & expected TX,
  TX page size, history depth, and the balance-history toggles.

## Pricing source

Default bank prices come from the **SIX bLink Platform Price List, Annex 4** (D0554.EN.13):

- Per-call price = the bank's **AIS** rate (§8.3)
- Registration fee = §8.2

Banks not listed in the price list charge CHF 0 for API calls and registration; they are
represented by the *"Other bLink bank"* option. SIX retains 20% of these prices from the
provider, but the Service User still pays the full list price shown here.

> SIX platform **participation** (CHF 200/month) and **onboarding** (one-time) fees are
> fixed and independent of the number of users, so they are intentionally excluded from
> this per-user estimate.

## Reference figures

Set **Days per month = 31**, **account list refresh = Daily**, and **page size = 25** for a
CHF 0.10/call bank with 3 accounts (120 / 40 / 20 expected TX) and a 3-month history load:

| Cadence | Recurring / month |
|---------|-------------------|
| Daily, 3 intraday (4/day) | CHF 77.50 |
| Daily, 0 intraday (1/day) | CHF 21.70 |
| Weekly | CHF 2.80 |

These reproduce the recurring figures from the discussion. (The discussion's 285-call
initial load mixed 31 days/month for recurring with ~30.5 for history; with one consistent
31-day basis it is 288. This calculator uses a single basis by design.)

With the app defaults (30.44 days/month, weekly account list, 100 TX/page) the 4/day case
is **CHF 73.49** — the same model, on a calendar-accurate basis.

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
