/*
 * bLink pricing data — sourced from:
 * "Annex 4 – Price List for the bLink Platform" (D0554.EN.13), operated by SIX BBS Ltd.
 *
 * We only model the numbers that matter for a bank-sync (Account Information Service /
 * AIS) use case:
 *   - price per API call (section 8.3, AIS column)
 *   - one-time customer registration price (section 8.2)
 *
 * All amounts in CHF, excl. VAT. Banks not listed in the price list do not charge for
 * API calls or registration (they appear here as the "no-charge banks" option).
 */

const BLINK_BANKS = [
  { id: 'acrevis',   name: 'Acrevis Bank AG',            aisPerCall: 0.10, registration: 0 },
  { id: 'avera',     name: 'Bank Avera',                 aisPerCall: 0.10, registration: 20 },
  { id: 'bcju',      name: 'Banque Cantonale du Jura SA', aisPerCall: 0.10, registration: 0 },
  { id: 'bcv',       name: 'Banque Cantonale Vaudoise',  aisPerCall: 0.10, registration: 0 },
  { id: 'hbl',       name: 'Hypothekarbank Lenzburg AG', aisPerCall: 0.10, registration: 0 },
  { id: 'lukb',      name: 'Luzerner Kantonalbank AG',   aisPerCall: 0.10, registration: 0 },
  { id: 'sgkb',      name: 'St.Galler Kantonalbank AG',  aisPerCall: 0.10, registration: 0 },
  { id: 'tkb',       name: 'Thurgauer Kantonalbank',     aisPerCall: 0.10, registration: 20 },
  { id: 'ubs',       name: 'UBS Switzerland AG',         aisPerCall: 0.10, registration: 20 },
  { id: 'valiant',   name: 'Valiant Bank AG',            aisPerCall: 0.10, registration: 0 },
  { id: 'zkb',       name: 'Zürcher Kantonalbank',       aisPerCall: 0.15, registration: 0 },
  { id: 'other',     name: 'Other bLink bank (no API charges)', aisPerCall: 0.00, registration: 0 },
];

/*
 * Sync-frequency presets.
 *
 * Recurring call pattern per sync run (N = number of accounts):
 *   - 1 call for the account list  (queried once per run, not per account)
 *   - N calls for balances         (1 per account)
 *   - N calls for transactions     (assumption: 1 call fetches all new TXs per account)
 *
 * The monthly multipliers below reproduce the reference figures from the pricing
 * discussion (N = 3, CHF 0.10/call): 77.50 / 21.70 / 2.80 CHF per month.
 */
const DAYS_PER_MONTH = 31;   // matches the reference calculation
const WEEKS_PER_MONTH = 4;   // matches the reference calculation

// Two base cadences. For "daily" the number of syncs per day is configurable
// (1 end-of-day close + N intraday). For "weekly" it's one sync per week.
const CADENCES = [
  { id: 'daily',  label: 'Daily',  hint: 'configurable syncs per day' },
  { id: 'weekly', label: 'Weekly', hint: 'one update per week' },
];

// Default assumptions (overridable in the "Advanced" section of the UI).
const DEFAULTS = {
  cadence: 'daily',
  // Intraday syncs, on top of the 1 daily end-of-day close.
  // 3 intraday + 1 close = 4 syncs/day (the reference scenario).
  intradaySyncs: 3,
  // Balance history has no list API and no pagination: 1 call per day per account.
  // ~30.5 days/month -> 3 months = 92 balance calls per account (matches reference).
  balanceDaysPerMonth: 30.5,
  // Transactions returned per API call during the initial backfill.
  // 100 is supported by most banks (the API default is lower).
  txPageSize: 100,
  historyMonths: 3,
  // Reference scenario: 3 accounts with 120 / 40 / 20 expected transactions.
  accounts: [120, 40, 20],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BLINK_BANKS, CADENCES, DEFAULTS, DAYS_PER_MONTH, WEEKS_PER_MONTH };
}
