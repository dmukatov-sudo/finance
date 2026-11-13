/* Мои финансы — чистая логика (без DOM), тестируется в Node */
(function (root) {
  "use strict";
  var DEFAULT_EXP = ["Продукты", "Коммуналка и интернет", "Детский сад", "Жене", "Садака/благотворительность", "Кредит", "Транспорт", "Кафе", "Здоровье", "Одежда", "Дети", "Подарки", "Прочее"];
  var DEFAULT_INC = ["Зарплата", "Прочее"];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function monthKey(dateStr) { return String(dateStr).slice(0, 7); }
  function shiftMonth(mk, delta) {
    var y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1 + delta;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + pad(m + 1);
  }
  function parseAmount(v) {
    if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) / 100 : 0;
    var s = String(v == null ? "" : v).replace(/[\s\u00a0₸]/g, "").replace(",", ".");
    var n = parseFloat(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function defaultState() {
    return {
      version: 1,
      onboarded: false,
      settings: { monthlyIncome: 0, budget: 0 },
      categories: {
        expense: DEFAULT_EXP.map(function (n) { return { id: uid(), name: n, limit: 0 }; }),
        income: DEFAULT_INC.map(function (n) { return { id: uid(), name: n }; })
      },
      tx: [],
      fixed: [],
      paid: {},
      debts: [],
      fund: { goal: 0, deposits: [] }
    };
  }

  function normalize(s) {
    var d = defaultState();
    if (!s || typeof s !== "object") return d;
    var out = {
      version: 1,
      onboarded: !!s.onboarded,
      settings: Object.assign({}, d.settings, s.settings || {}),
      categories: {
        expense: Array.isArray(s.categories && s.categories.expense) ? s.categories.expense : d.categories.expense,
        income: Array.isArray(s.categories && s.categories.income) ? s.categories.income : d.categories.income
      },
      tx: Array.isArray(s.tx) ? s.tx : [],
      fixed: Array.isArray(s.fixed) ? s.fixed : [],
      paid: s.paid && typeof s.paid === "object" ? s.paid : {},
      debts: Array.isArray(s.debts) ? s.debts : [],
      fund: Object.assign({ goal: 0, deposits: [] }, s.fund || {})
    };
    out.debts.forEach(function (x) { if (!Array.isArray(x.payments)) x.payments = []; });
    if (!Array.isArray(out.fund.deposits)) out.fund.deposits = [];
    return out;
  }

  function addTx(st, t) {
    var amount = parseAmount(t.amount);
    if (!(amount > 0)) throw new Error("Сумма должна быть больше нуля");
    var tx = { id: uid(), type: t.type === "inc" ? "inc" : "exp", amount: amount, cat: t.cat || "", note: (t.note || "").trim(), date: t.date || today(), ts: Date.now() };
    if (t.ref) tx.ref = t.ref;
    st.tx.push(tx);
    return tx;
  }
  function deleteTx(st, id) {
    var tx = st.tx.find(function (t) { return t.id === id; });
    st.tx = st.tx.filter(function (t) { return t.id !== id; });
    if (tx && tx.ref) {
      var r = tx.ref.split(":");
      if (r[0] === "fixed") { var mk = monthKey(tx.date); if (st.paid[mk]) delete st.paid[mk][r[1]]; }
      if (r[0] === "debt") { st.debts.forEach(function (d) { d.payments = d.payments.filter(function (p) { return p.id !== r[1]; }); }); }
    }
    return !!tx;
  }
  function txForMonth(st, mk) { return st.tx.filter(function (t) { return monthKey(t.date) === mk; }); }
  function monthTotals(st, mk) {
    var inc = 0, exp = 0;
    txForMonth(st, mk).forEach(function (t) { if (t.type === "inc") inc += t.amount; else exp += t.amount; });
    return { income: r2(inc), expense: r2(exp), balance: r2(inc - exp) };
  }
  function byCategory(st, mk, type) {
    var m = {};
    txForMonth(st, mk).forEach(function (t) { if (t.type === (type || "exp")) m[t.cat] = (m[t.cat] || 0) + t.amount; });
    return Object.keys(m).map(function (k) { return { cat: k, amount: r2(m[k]) }; }).sort(function (a, b) { return b.amount - a.amount; });
  }
  function catName(st, id) {
    var all = st.categories.expense.concat(st.categories.income);
    var c = all.find(function (x) { return x.id === id; });
    return c ? c.name : "Без категории";
  }
  function budgetTotal(st) {
    if (st.settings.budget > 0) return st.settings.budget;
    if (st.settings.monthlyIncome > 0) return st.settings.monthlyIncome;
    var lim = st.categories.expense.reduce(function (s, c) { return s + (c.limit > 0 ? c.limit : 0); }, 0);
    return lim > 0 ? lim : 0;
  }
  function budgetStatus(st, mk) {
    var spent = monthTotals(st, mk).expense, total = budgetTotal(st);
    return { spent: spent, total: total, left: r2(total - spent), pct: total > 0 ? spent / total : 0, over: total > 0 && spent > total };
  }
  function overLimits(st, mk) {
    var sums = {};
    byCategory(st, mk, "exp").forEach(function (x) { sums[x.cat] = x.amount; });
    return st.categories.expense.filter(function (c) { return c.limit > 0 && (sums[c.id] || 0) > c.limit * 0.9; })
      .map(function (c) { var s = sums[c.id] || 0; return { id: c.id, name: c.name, limit: c.limit, spent: s, over: s > c.limit }; });
  }

  /* обязательные */
  function fixedTotal(st) { return r2(st.fixed.reduce(function (s, f) { return s + (f.amount || 0); }, 0)); }
  function isPaid(st, mk, fid) { return !!(st.paid[mk] && st.paid[mk][fid]); }
  function togglePaid(st, mk, fid, date) {
    var f = st.fixed.find(function (x) { return x.id === fid; });
    if (!f) return false;
    st.paid[mk] = st.paid[mk] || {};
    if (st.paid[mk][fid]) {
      var txid = st.paid[mk][fid];
      st.tx = st.tx.filter(function (t) { return t.id !== txid; });
      delete st.paid[mk][fid];
      return false;
    }
    var d = date || (monthKey(today()) === mk ? today() : mk + "-01");
    if (f.amount > 0) {
      var tx = addTx(st, { type: "exp", amount: f.amount, cat: f.cat || "", note: f.name, date: d, ref: "fixed:" + fid });
      st.paid[mk][fid] = tx.id;
    } else st.paid[mk][fid] = "manual";
    return true;
  }

  /* долги */
  function debtPaid(d) { return r2(d.payments.reduce(function (s, p) { return s + p.amount; }, 0)); }
  function debtRemaining(d) { return Math.max(0, r2((d.balance || 0) - debtPaid(d))); }
  function debtMonthsLeft(d) { var rem = debtRemaining(d); if (rem <= 0) return 0; return d.monthly > 0 ? Math.ceil(rem / d.monthly) : null; }
  function debtProgress(d) { return d.balance > 0 ? Math.min(1, debtPaid(d) / d.balance) : 0; }
  function addDebtPayment(st, debtId, amount, date, asExpense) {
    var d = st.debts.find(function (x) { return x.id === debtId; });
    amount = parseAmount(amount);
    if (!d || !(amount > 0)) throw new Error("Неверный платёж");
    var p = { id: uid(), amount: amount, date: date || today() };
    d.payments.push(p);
    if (asExpense) {
      var kr = st.categories.expense.find(function (c) { return c.name === "Кредит"; });
      addTx(st, { type: "exp", amount: amount, cat: kr ? kr.id : "", note: d.name, date: p.date, ref: "debt:" + p.id });
    }
    return p;
  }

  /* подушка */
  function fundSaved(st) { return r2(st.fund.deposits.reduce(function (s, x) { return s + x.amount; }, 0)); }
  function avgMonthlyExpense(st, mk) {
    mk = mk || monthKey(today());
    var vals = [];
    for (var i = 1; i <= 3; i++) { var e = monthTotals(st, shiftMonth(mk, -i)).expense; if (e > 0) vals.push(e); }
    if (!vals.length) { var cur = monthTotals(st, mk).expense; if (cur > 0) vals.push(cur); }
    var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
    return r2(Math.max(avg, fixedTotal(st)));
  }
  function fundSuggestion(st, mk) { var a = avgMonthlyExpense(st, mk); return { monthly: a, min: r2(a * 3), max: r2(a * 6) }; }

  /* экспорт */
  function toCSV(st) {
    var rows = [["Дата", "Тип", "Категория", "Сумма", "Заметка"]];
    st.tx.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (t) {
      rows.push([t.date, t.type === "inc" ? "Доход" : "Расход", catName(st, t.cat), String(t.amount).replace(".", ","), t.note || ""]);
    });
    return "\ufeff" + rows.map(function (r) { return r.map(function (c) { c = String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\r\n");
  }

  function r2(n) { return Math.round(n * 100) / 100; }

  var api = { DEFAULT_EXP: DEFAULT_EXP, DEFAULT_INC: DEFAULT_INC, uid: uid, today: today, monthKey: monthKey, shiftMonth: shiftMonth, parseAmount: parseAmount,
    defaultState: defaultState, normalize: normalize, addTx: addTx, deleteTx: deleteTx, txForMonth: txForMonth, monthTotals: monthTotals, byCategory: byCategory,
    catName: catName, budgetTotal: budgetTotal, budgetStatus: budgetStatus, overLimits: overLimits, fixedTotal: fixedTotal, isPaid: isPaid, togglePaid: togglePaid,
    debtPaid: debtPaid, debtRemaining: debtRemaining, debtMonthsLeft: debtMonthsLeft, debtProgress: debtProgress, addDebtPayment: addDebtPayment,
    fundSaved: fundSaved, avgMonthlyExpense: avgMonthlyExpense, fundSuggestion: fundSuggestion, toCSV: toCSV };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Fin = api;
})(this);
