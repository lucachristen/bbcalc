/*
 * Pure pricing engine for the bLink bank-sync cost calculator.
 *
 * Cost model (derived from the SIX bLink price list, Annex 4, and the internal
 * pricing discussion). Every call below is an AIS (Account Information Service) call
 * and is billed at the bank's per-call price.
 *
 * ── One-time (initial load) ──────────────────────────────────────────────
 *   registration   : the bank's one-time customer registration fee (once per user)
 *   account list    : 1 call
 *   balance history : 1 call per day per account over the load window
 *                     (no list API, no pagination) — optional, big cost driver
 *   transaction     : ceil(expectedTx / pageSize) calls per account (backfill)
 *   backfill
 *
 * ── Recurring (monthly) ──────────────────────────────────────────────────
 *   account list : 1 call per account-list run
 *   balances     : N calls per sync run          (N = number of accounts)
 *   transactions : N calls per sync run          (1 call fetches all new TXs)
 *
 * Reference check (bank @ CHF 0.10, 3 accounts of 120/40/20 TX, 3-month history,
 * balance history on):
 *   initial load  = 1 + 92*3 + (5+2+1)          = 285 calls
 *   4x/day monthly = (31 + 124*3 + 124*3) * 0.10 = CHF 77.50
 *   1x/day monthly = (31 +  31*3 +  31*3) * 0.10 = CHF 21.70
 *   1x/week monthly = (4 +   4*3 +   4*3) * 0.10 = CHF  2.80
 */

function computePricing(input) {
  const {
    bank,                 // { aisPerCall, registration }
    frequency,            // { accountListRunsPerMonth, balanceRunsPerMonth, transactionRunsPerMonth }
    accounts,             // number[]  expected TX per account over the load window
    historyMonths,        // how far back to load data initially
    loadBalanceHistory,   // boolean
    txPageSize,           // TXs per call during backfill
  } = input;

  // Single per-month basis for every conversion (recurring balances + history).
  const daysPerMonth = input.daysPerMonth || 30.44;
  const N = accounts.length;

  // Prices default to the selected bank's list price but can be overridden.
  const val = function (v, d) { return (v === undefined || v === null || v === '') ? d : Number(v); };
  const price = val(input.pricePerCall, bank.aisPerCall);
  const registrationCost = val(input.registration, bank.registration);

  // ── Recurring (per month) ──────────────────────────────────────────────
  // Account list, balances and transactions each run on their own cadence.
  const rAccountList  = frequency.accountListRunsPerMonth;          // 1 call per refresh
  const rBalances     = frequency.balanceRunsPerMonth * N;          // N calls per balance sync
  const rTransactions = frequency.transactionRunsPerMonth * N;      // N calls per transaction sync
  const recurringCalls = rAccountList + rBalances + rTransactions;
  const recurringCost = recurringCalls * price;

  // ── One-time (initial load) ────────────────────────────────────────────
  // Historical balance points are loaded at the ongoing balance-sync cadence
  // (daily/weekly/monthly), so the backfill respects the config, not just days.
  const backfillPointsPerMonth = input.balanceBackfillPointsPerMonth || daysPerMonth;
  const historyPoints = Math.round(historyMonths * backfillPointsPerMonth);
  const iAccountList = 1;
  const iBalances = loadBalanceHistory ? historyPoints * N : 0;
  const iTransactions = accounts.reduce(
    (sum, tx) => sum + Math.max(1, Math.ceil((Number(tx) || 0) / txPageSize)),
    0
  );
  const initialCalls = iAccountList + iBalances + iTransactions;
  const initialApiCost = initialCalls * price;
  const oneTimeCost = initialApiCost + registrationCost;

  // ── Totals ─────────────────────────────────────────────────────────────
  // A year is days-per-year worth of months (days/year ÷ days/month), so the
  // annual projection stays consistent with the daily rate.
  const daysPerYear = input.daysPerYear || (daysPerMonth * 12);
  const monthsPerYear = daysPerYear / daysPerMonth;
  const monthlyOngoing = recurringCost;
  const firstMonth = oneTimeCost + recurringCost;
  const firstYear = oneTimeCost + recurringCost * monthsPerYear;

  // Fleet totals: per-user costs scaled by the number of users.
  const users = Math.max(1, Math.floor(Number(input.users) || 1));

  return {
    accounts: N,
    pricePerCall: price,
    historyPoints,
    recurring: {
      accountListCalls: rAccountList,
      balanceCalls: rBalances,
      transactionCalls: rTransactions,
      totalCalls: recurringCalls,
      cost: recurringCost,
    },
    initial: {
      registrationCost,
      accountListCalls: iAccountList,
      balanceCalls: iBalances,
      transactionCalls: iTransactions,
      totalCalls: initialCalls,
      apiCost: initialApiCost,
      cost: oneTimeCost,
    },
    totals: {
      users,
      // Per single user.
      perUser: {
        oneTime: oneTimeCost,
        monthlyOngoing,
        firstMonth,
        firstYear,
      },
      // Across all users (the fleet estimate).
      fleet: {
        oneTime: oneTimeCost * users,
        monthlyOngoing: monthlyOngoing * users,
        firstMonth: firstMonth * users,
        firstYear: firstYear * users,
      },
      // Backward-compatible flat fields (per user).
      oneTime: oneTimeCost,
      monthlyOngoing,
      firstMonth,
      firstYear,
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computePricing };
}
