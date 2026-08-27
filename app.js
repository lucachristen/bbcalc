/* UI wiring for the bLink sync cost calculator. Vanilla JS, no build step. */
(function () {
  'use strict';

  var CHF = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });
  var NUM = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 });
  var money = function (n) { return CHF.format(n); };
  var num = function (n) { return NUM.format(n); };

  // ── State ──────────────────────────────────────────────────────────────
  var DEFAULT_BANK = BLINK_BANKS.filter(function (b) { return b.id === 'ubs'; })[0] || BLINK_BANKS[0];

  var state = {
    // calendar basis
    daysPerMonth: DEFAULTS.daysPerMonth,
    weeksPerMonth: DEFAULTS.weeksPerMonth,
    daysPerYear: DEFAULTS.daysPerYear,
    // bank pricing
    bankId: DEFAULT_BANK.id,
    pricePerCall: DEFAULT_BANK.aisPerCall,    // editable; bank selection pre-fills it
    registration: DEFAULT_BANK.registration,  // editable; bank selection pre-fills it
    users: 1,
    // account assumptions
    accounts: DEFAULTS.accounts.slice(),
    // account list syncs
    accountListRefresh: DEFAULTS.accountListRefresh,  // 'daily' | 'weekly' | 'monthly'
    // balance syncs (independent)
    balanceCadence: 'daily',       // 'daily' | 'weekly'
    balanceSyncsPerDay: 4,
    // transaction syncs (independent)
    txCadence: 'daily',            // 'daily' | 'weekly'
    txSyncsPerDay: 4,
    // initial load config
    historyMonths: DEFAULTS.historyMonths,
    loadBalanceHistory: true,
    txPageSize: DEFAULTS.txPageSize,
  };

  var $ = function (id) { return document.getElementById(id); };
  var round2 = function (n) { return Math.round(n * 100) / 100; };

  // ── Build static controls ──────────────────────────────────────────────
  function buildBanks() {
    var sel = $('bank');
    BLINK_BANKS.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name;
      sel.appendChild(o);
    });
    sel.value = state.bankId;
  }

  // A daily/weekly cadence selector for a sync type (balances, transactions).
  // Each has its own per-day count when daily, fully independent of the others.
  function buildSyncCadence(segId, cadenceKey, syncUiFn) {
    var box = $(segId);
    CADENCES.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.dataset.id = c.id;
      btn.innerHTML =
        '<span class="seg-title">' + c.label + '</span>' +
        '<span class="seg-hint">' + (c.id === 'daily' ? 'syncs per day' : 'once per week') + '</span>';
      btn.addEventListener('click', function () {
        state[cadenceKey] = c.id;
        syncUiFn();
        render();
      });
      box.appendChild(btn);
    });
    syncUiFn();
  }

  function markSeg(segId, selectedId) {
    Array.prototype.forEach.call($(segId).children, function (btn) {
      btn.setAttribute('aria-checked', btn.dataset.id === selectedId ? 'true' : 'false');
    });
  }

  function syncCalcText(cadence, perDay) {
    if (cadence === 'daily') {
      return perDay + '×/day × ' + round2(state.daysPerMonth) + ' days = ' +
        round2(perDay * state.daysPerMonth) + ' syncs/month.';
    }
    return round2(state.weeksPerMonth) + ' syncs/month.';
  }

  function syncBalanceUI() {
    markSeg('balance-freq', state.balanceCadence);
    $('balance-perday-wrap').style.display = state.balanceCadence === 'daily' ? '' : 'none';
    $('balance-sync-calc').textContent = syncCalcText(state.balanceCadence, state.balanceSyncsPerDay);
  }
  function syncTxUI() {
    markSeg('tx-freq', state.txCadence);
    $('tx-perday-wrap').style.display = state.txCadence === 'daily' ? '' : 'none';
    $('tx-sync-calc').textContent = syncCalcText(state.txCadence, state.txSyncsPerDay);
  }

  function buildAccountListRefresh() {
    var box = $('account-list-refresh');
    ACCOUNT_LIST_REFRESH.forEach(function (o) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.dataset.id = o.id;
      btn.innerHTML =
        '<span class="seg-title">' + o.label + '</span>' +
        '<span class="seg-hint">' + o.hint + '</span>';
      btn.addEventListener('click', function () {
        state.accountListRefresh = o.id;
        syncAccountListUI();
        render();
      });
      box.appendChild(btn);
    });
    syncAccountListUI();
  }

  function syncAccountListUI() {
    Array.prototype.forEach.call($('account-list-refresh').children, function (btn) {
      btn.setAttribute('aria-checked', btn.dataset.id === state.accountListRefresh ? 'true' : 'false');
    });
  }

  // Make the single per-month basis explicit: show what daily/weekly/monthly and
  // a year work out to for the current value.
  function updateBasisNote() {
    var dpm = state.daysPerMonth, dpy = state.daysPerYear;
    $('basis-note').innerHTML =
      'Annual projection: ' + dpy + ' ÷ ' + dpm + ' = ' + round2(dpy / dpm) + ' months/year. Actual&nbsp;≈&nbsp;365.28.';
  }

  // ── Accounts (dynamic) ─────────────────────────────────────────────────
  function renderAccounts() {
    var box = $('accounts');
    box.innerHTML = '';
    state.accounts.forEach(function (tx, i) {
      var row = document.createElement('div');
      row.className = 'account-row';

      var label = document.createElement('span');
      label.className = 'acc-label';
      label.textContent = 'Account ' + (i + 1);

      var input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.inputMode = 'numeric';
      input.value = tx;
      input.setAttribute('aria-label', 'Expected transactions for account ' + (i + 1));
      input.addEventListener('input', function () {
        state.accounts[i] = input.value === '' ? 0 : Math.max(0, parseInt(input.value, 10) || 0);
        render();
      });

      var unit = document.createElement('span');
      unit.className = 'acc-unit';
      unit.textContent = 'TX';

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-remove';
      remove.textContent = '×';
      remove.title = 'Remove account';
      remove.disabled = state.accounts.length <= 1;
      remove.addEventListener('click', function () {
        state.accounts.splice(i, 1);
        renderAccounts();
        render();
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(unit);
      row.appendChild(remove);
      box.appendChild(row);
    });
  }

  // ── Read helpers ───────────────────────────────────────────────────────
  function currentBank() {
    var b = BLINK_BANKS.filter(function (x) { return x.id === state.bankId; })[0];
    return b || BLINK_BANKS[0];
  }
  // Runs per month for a given refresh cadence, derived from the live days/month
  // basis so daily / weekly / monthly are always mutually consistent.
  function runsPerMonth(cadenceId) {
    if (cadenceId === 'daily') return state.daysPerMonth;
    if (cadenceId === 'monthly') return 1;
    return state.weeksPerMonth;   // weekly
  }

  function syncRunsFor(cadence, perDay) {
    return cadence === 'daily' ? Math.max(0, perDay) * state.daysPerMonth : state.weeksPerMonth;
  }

  // Account-list, balance and transaction syncs each run on their own cadence.
  function currentFrequency() {
    return {
      accountListRunsPerMonth: runsPerMonth(state.accountListRefresh),
      balanceRunsPerMonth: syncRunsFor(state.balanceCadence, state.balanceSyncsPerDay),
      transactionRunsPerMonth: syncRunsFor(state.txCadence, state.txSyncsPerDay),
    };
  }

  // ── Render results ─────────────────────────────────────────────────────
  function rowHTML(label, calls, cost) {
    return '<tr><td>' + label + '</td>' +
      '<td class="muted-cell">' + num(calls) + '</td>' +
      '<td>' + money(cost) + '</td></tr>';
  }

  function render() {
    var bank = currentBank();
    var freq = currentFrequency();

    var r = computePricing({
      bank: bank,
      frequency: freq,
      pricePerCall: state.pricePerCall,
      registration: state.registration,
      accounts: state.accounts,
      historyMonths: state.historyMonths,
      loadBalanceHistory: state.loadBalanceHistory,
      txPageSize: state.txPageSize,
      users: state.users,
      daysPerMonth: state.daysPerMonth,
      daysPerYear: state.daysPerYear,
    });

    // Live per-section sync math notes.
    $('balance-sync-calc').textContent = syncCalcText(state.balanceCadence, state.balanceSyncsPerDay);
    $('tx-sync-calc').textContent = syncCalcText(state.txCadence, state.txSyncsPerDay);

    var p = r.pricePerCall;
    var users = r.totals.users;
    var fleet = r.totals.fleet;
    var perUser = r.totals.perUser;

    // Scope caption + headline (fleet totals, with per-user sub-lines).
    $('results-scope').textContent = users > 1
      ? 'Total across ' + num(users) + ' users'
      : 'Estimate for 1 user';
    $('out-monthly').textContent = money(fleet.monthlyOngoing);
    $('out-onetime').textContent = money(fleet.oneTime);
    $('out-year').textContent = money(fleet.firstYear);

    var perUserNote = function (v) { return users > 1 ? money(v) + ' / user' : ''; };
    $('out-monthly-sub').textContent = perUserNote(perUser.monthlyOngoing);
    $('out-onetime-sub').textContent = perUserNote(perUser.oneTime);
    $('out-year-sub').textContent = perUserNote(perUser.firstYear);

    // Recurring breakdown
    $('bd-recurring').innerHTML =
      rowHTML('Account list', r.recurring.accountListCalls, r.recurring.accountListCalls * p) +
      rowHTML('Balances (' + r.accounts + ' acct)', r.recurring.balanceCalls, r.recurring.balanceCalls * p) +
      rowHTML('Transactions (' + r.accounts + ' acct)', r.recurring.transactionCalls, r.recurring.transactionCalls * p);
    $('bd-recurring-calls').textContent = num(r.recurring.totalCalls);
    $('bd-recurring-cost').textContent = money(r.recurring.cost);

    // Initial breakdown
    var initRows =
      rowHTML('Account list', r.initial.accountListCalls, r.initial.accountListCalls * p) +
      rowHTML('Balance history (' + r.historyDays + ' d × ' + r.accounts + ' acct)', r.initial.balanceCalls, r.initial.balanceCalls * p) +
      rowHTML('Transaction backfill', r.initial.transactionCalls, r.initial.transactionCalls * p);
    if (r.initial.registrationCost > 0) {
      initRows += '<tr><td>Customer registration</td><td class="muted-cell">—</td><td>' +
        money(r.initial.registrationCost) + '</td></tr>';
    }
    $('bd-initial').innerHTML = initRows;
    $('bd-initial-calls').textContent = num(r.initial.totalCalls);
    $('bd-initial-cost').textContent = money(r.initial.cost);
  }

  // ── Bind inputs ────────────────────────────────────────────────────────
  function bind() {
    $('users').addEventListener('input', function (e) {
      state.users = e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1);
      render();
    });
    $('bank').addEventListener('change', function (e) {
      state.bankId = e.target.value;
      // Pre-fill the editable price fields from the selected bank's list price.
      var bank = currentBank();
      state.pricePerCall = bank.aisPerCall;
      state.registration = bank.registration;
      $('price-per-call').value = bank.aisPerCall;
      $('registration').value = bank.registration;
      render();
    });
    var numInput = function (id, key, min) {
      $(id).addEventListener('input', function (e) {
        state[key] = e.target.value === '' ? min : Math.max(min, parseFloat(e.target.value));
        if (isNaN(state[key])) state[key] = min;
        render();
      });
    };
    numInput('price-per-call', 'pricePerCall', 0);
    numInput('registration', 'registration', 0);
    $('history').addEventListener('input', function (e) {
      state.historyMonths = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
      render();
    });
    $('balance-history').addEventListener('change', function (e) { state.loadBalanceHistory = e.target.checked; render(); });
    $('balance-perday').addEventListener('input', function (e) {
      state.balanceSyncsPerDay = e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1);
      syncBalanceUI();
      render();
    });
    $('tx-perday').addEventListener('input', function (e) {
      state.txSyncsPerDay = e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1);
      syncTxUI();
      render();
    });
    $('page-size').addEventListener('input', function (e) {
      state.txPageSize = Math.max(1, parseInt(e.target.value, 10) || 1); render();
    });
    var basisInput = function (id, key, min) {
      $(id).addEventListener('input', function (e) {
        state[key] = Math.max(min, parseFloat(e.target.value) || min);
        updateBasisNote();
        render();
      });
    };
    basisInput('days-per-month', 'daysPerMonth', 1);
    basisInput('weeks-per-month', 'weeksPerMonth', 0.1);
    basisInput('days-per-year', 'daysPerYear', 1);
    $('add-account').addEventListener('click', function () {
      state.accounts.push(20);
      renderAccounts();
      render();
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────
  buildBanks();
  buildAccountListRefresh();
  buildSyncCadence('balance-freq', 'balanceCadence', syncBalanceUI);
  buildSyncCadence('tx-freq', 'txCadence', syncTxUI);
  updateBasisNote();
  renderAccounts();
  bind();
  render();
})();
