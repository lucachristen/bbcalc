/* UI wiring for the bLink sync cost calculator. Vanilla JS, no build step. */
(function () {
  'use strict';

  var CHF = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });
  var NUM = new Intl.NumberFormat('de-CH');
  var money = function (n) { return CHF.format(n); };
  var num = function (n) { return NUM.format(n); };
  // Compact form for large fleet totals so they never overflow the headline tile.
  // Full precision stays available via the tile's title (hover) and the per-user line.
  var moneyCompact = function (n) {
    var a = Math.abs(n);
    if (a >= 1e6) return 'CHF ' + Number((n / 1e6).toFixed(2)) + 'M';
    if (a >= 1e4) return 'CHF ' + Number((n / 1e3).toFixed(1)) + 'k';
    return money(n);
  };

  // ── State ──────────────────────────────────────────────────────────────
  var state = {
    users: 1,
    bankId: 'ubs',
    frequencyId: '4d',
    accounts: DEFAULTS.accounts.slice(),
    historyMonths: DEFAULTS.historyMonths,
    loadBalanceHistory: true,
    txPageSize: DEFAULTS.txPageSize,
    balanceDaysPerMonth: DEFAULTS.balanceDaysPerMonth,
  };

  var $ = function (id) { return document.getElementById(id); };

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

  function buildFrequencies() {
    var box = $('frequency');
    FREQUENCIES.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.dataset.id = f.id;
      btn.innerHTML =
        '<span class="seg-title">' + f.label + '</span>' +
        '<span class="seg-hint">' + f.hint + '</span>';
      btn.addEventListener('click', function () {
        state.frequencyId = f.id;
        syncFrequencyUI();
        render();
      });
      box.appendChild(btn);
    });
    syncFrequencyUI();
  }

  function syncFrequencyUI() {
    Array.prototype.forEach.call($('frequency').children, function (btn) {
      btn.setAttribute('aria-checked', btn.dataset.id === state.frequencyId ? 'true' : 'false');
    });
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
  function currentFrequency() {
    var f = FREQUENCIES.filter(function (x) { return x.id === state.frequencyId; })[0];
    return f || FREQUENCIES[0];
  }

  // ── Render results ─────────────────────────────────────────────────────
  function bankNote(bank) {
    var parts = [];
    parts.push(bank.aisPerCall > 0 ? money(bank.aisPerCall) + ' per API call' : 'no per-call charge');
    parts.push(bank.registration > 0 ? money(bank.registration) + ' registration' : 'no registration fee');
    return parts.join(' · ');
  }

  function rowHTML(label, calls, cost) {
    return '<tr><td>' + label + '</td>' +
      '<td class="muted-cell">' + num(calls) + '</td>' +
      '<td>' + money(cost) + '</td></tr>';
  }

  function render() {
    var bank = currentBank();
    var freq = currentFrequency();
    $('bank-note').textContent = bankNote(bank);

    var r = computePricing({
      bank: bank,
      frequency: freq,
      accounts: state.accounts,
      historyMonths: state.historyMonths,
      loadBalanceHistory: state.loadBalanceHistory,
      balanceDaysPerMonth: state.balanceDaysPerMonth,
      txPageSize: state.txPageSize,
      users: state.users,
    });

    var p = r.pricePerCall;
    var users = r.totals.users;
    var fleet = r.totals.fleet;
    var perUser = r.totals.perUser;

    // Scope caption + headline (fleet totals, with per-user sub-lines).
    $('results-scope').textContent = users > 1
      ? 'Total across ' + num(users) + ' users'
      : 'Estimate for 1 user';
    var setHeadline = function (id, value) {
      var el = $(id);
      el.textContent = moneyCompact(value);
      el.title = money(value); // exact figure on hover
    };
    setHeadline('out-monthly', fleet.monthlyOngoing);
    setHeadline('out-onetime', fleet.oneTime);
    setHeadline('out-year', fleet.firstYear);

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
    $('bank').addEventListener('change', function (e) { state.bankId = e.target.value; render(); });
    $('history').addEventListener('input', function (e) {
      state.historyMonths = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
      render();
    });
    $('balance-history').addEventListener('change', function (e) { state.loadBalanceHistory = e.target.checked; render(); });
    $('page-size').addEventListener('input', function (e) {
      state.txPageSize = Math.max(1, parseInt(e.target.value, 10) || 1); render();
    });
    $('balance-days').addEventListener('input', function (e) {
      state.balanceDaysPerMonth = Math.max(1, parseFloat(e.target.value) || 1); render();
    });
    $('add-account').addEventListener('click', function () {
      state.accounts.push(20);
      renderAccounts();
      render();
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────
  buildBanks();
  buildFrequencies();
  renderAccounts();
  bind();
  render();
})();
