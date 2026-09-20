# bbcalc — bLink Sync Cost Calculator

A dependency-free web app for estimating the recurring and initial cost of syncing customer
bank accounts over [SIX bLink](https://blink.six-group.com). Choose a bank, sync cadences,
accounts, transaction volumes, and history depth to get an itemised estimate.

## Run

Open `index.html` in a browser.

## Cost model

The calculator prices modeled API calls at the selected bank's AIS rate.

### Recurring per month

Account-list, balance, and transaction calls have independent cadences. Here, `N` is the
number of accounts.

| Sync         | Calls per run                    | Cadence options                        |
| ------------ | -------------------------------- | -------------------------------------- |
| Account list | 1                                | Daily · Weekly · Monthly               |
| Balances     | N (one per account)              | Daily (× syncs/day) · Weekly · Monthly |
| Transactions | N (one call fetches all new TXs) | Daily (× syncs/day) · Weekly · Monthly |

Daily runs use `syncs/day × days/month`; weekly runs use `weeks/month`; monthly runs use 1.

### Initial load

| Item                  | Calls                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Account list          | 1                                                                 |
| Balance history       | 1 per account and cadence point over the history window; optional |
| Transaction backfill  | At least 1 per account, otherwise `ceil(expected TX / page size)` |
| Customer registration | The bank's one-time fee                                           |

Balance-history points follow the balance cadence: daily means one point/day, weekly one
point/week, and monthly one point/month. Intraday balance syncs do not add historical points.

## Defaults

- Calendar basis: **30 days/month, 4 weeks/month, 365 days/year**
- Bank: **UBS Switzerland AG** — CHF 0.10/call and CHF 20 registration
- Users: **1**
- Accounts: **3**, with **120 / 40 / 20** expected transactions
- Account-list refresh: **weekly**
- Balance and transaction syncs: **daily, 4×/day**
- Initial history: **3 months**, including balance history
- Transaction page size: **100**

At CHF 0.10/call, these defaults produce a recurring cost of **CHF 72.40/month per user**.
All assumptions and prices are editable in the app.

## Pricing source

Bank defaults come from the
[**SIX bLink Platform Price List, Annex 4**](https://www.six-group.com/dam/download/sites/blink/annex4-pricelist-six-en.pdf)
(D0554.EN.13): the AIS rate in §8.3 and customer-registration fee in §8.2.

Banks absent from the price list are represented by **Other bLink bank** at CHF 0. SIX
retains 20% of provider prices, while the Service User pays the full listed price.

SIX participation (CHF 200/month) and onboarding fees are excluded because they are fixed
platform costs rather than per-user costs. All amounts are CHF, excluding VAT.
