/* Мои финансы — интерфейс */
(function () {
  "use strict";
  var F = window.Fin;
  var KEY = "moi-finansy.v1";
  var MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  var MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var COLORS = ["#C47A3A", "#4E9A7A", "#D9A441", "#7FA7C9", "#B5655B", "#8C7AB8", "#6FB0A0", "#C99A6B", "#A3B86C", "#D07F9E", "#5E8C61", "#B08850", "#7A8C99"];

  var state = load();
  var ui = { tab: "home", month: F.monthKey(F.today()), sheet: null, ob: 0, toast: "" };

  function load() {
    try { var raw = localStorage.getItem(KEY); return F.normalize(raw ? JSON.parse(raw) : null); }
    catch (e) { return F.defaultState(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("Не удалось сохранить: память переполнена"); } }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n, sign) {
    var v = Math.round((n || 0) * 100) / 100;
    var s = Math.abs(v).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " ₸";
    if (v < 0) return "−" + s;
    return (sign && v > 0 ? "+" : "") + s;
  }
  function monthTitle(mk) { return MONTHS[+mk.slice(5, 7) - 1] + " " + mk.slice(0, 4); }
  function dayTitle(d) { var t = F.today(), y = F.today(new Date(Date.now() - 864e5)); if (d === t) return "Сегодня"; if (d === y) return "Вчера"; return +d.slice(8, 10) + " " + MONTHS_GEN[+d.slice(5, 7) - 1]; }
  function bar(pct, cls) { var p = Math.max(0, Math.min(1, pct || 0)) * 100; return '<div class="bar ' + (cls || "") + '"><span style="width:' + p.toFixed(1) + '%"></span></div>'; }
  function cur() { return F.monthKey(F.today()); }
  function amountInput(name, val, ph, autofocus) {
    return '<input class="amount" name="' + name + '" inputmode="decimal" autocomplete="off" placeholder="' + (ph || "0") + '" value="' + (val ? esc(val) : "") + '"' + (autofocus ? " autofocus" : "") + ">";
  }

  /* ---------- рендер ---------- */
  var app = document.getElementById("app");
  function render() {
    if (!state.onboarded) { app.innerHTML = onboarding(); focusFirst(); return; }
    var body = { home: home, debts: debts, fund: fund, stats: stats, more: more }[ui.tab]();
    app.innerHTML = '<main class="shell">' + body + "</main>" + nav() + (ui.sheet ? sheet() : "") + (ui.toast ? '<div class="toast">' + esc(ui.toast) + "</div>" : "");
    if (ui.sheet) focusFirst();
  }
  function focusFirst() { var el = app.querySelector("[autofocus]"); if (el) setTimeout(function () { try { el.focus(); } catch (e) {} }, 60); }
  function toast(msg) { ui.toast = msg; render(); clearTimeout(toast.t); toast.t = setTimeout(function () { ui.toast = ""; render(); }, 2200); }

  function nav() {
    var items = [["home", "🏠", "Главная"], ["stats", "📊", "Статистика"], ["debts", "💳", "Долги"], ["fund", "🛟", "Подушка"], ["more", "⚙️", "Ещё"]];
    return '<nav class="nav">' + items.map(function (i) {
      return '<button class="nav-btn' + (ui.tab === i[0] ? " active" : "") + '" data-a="tab" data-v="' + i[0] + '"><span class="ico">' + i[1] + "</span><span>" + i[2] + "</span></button>";
    }).join("") + "</nav>";
  }

  /* ---------- онбординг ---------- */
  function onboarding() {
    var s = ui.ob, steps = 3, h = "";
    h += '<main class="shell onb"><div class="brand"><img src="icons/icon-192.png" alt=""><div><div class="brand-name">Мои финансы</div><div class="muted">Шаг ' + (s + 1) + " из " + steps + "</div></div></div>";
    h += '<div class="dots">' + [0, 1, 2].map(function (i) { return '<span class="' + (i <= s ? "on" : "") + '"></span>'; }).join("") + "</div>";
    if (s === 0) {
      h += '<form data-form="ob0" class="card"><h1 class="title">Сколько вы получаете в месяц?</h1><p class="sub">Примерный доход. Он станет бюджетом на месяц — потом можно изменить.</p>' +
        amountInput("income", state.settings.monthlyIncome || "", "Например, 300 000", true) +
        '<button class="btn primary big" type="submit">Дальше</button></form>';
    } else if (s === 1) {
      h += '<div class="card"><h1 class="title">Обязательные расходы</h1><p class="sub">То, что платите каждый месяц: коммуналка, садик, кредит. Каждый месяц будете отмечать «оплачено».</p>';
      h += state.fixed.length ? '<ul class="list">' + state.fixed.map(function (f) {
        return '<li class="row"><div class="grow"><div>' + esc(f.name) + '</div><div class="muted">' + money(f.amount) + '</div></div><button class="icon-btn" data-a="delFixed" data-id="' + f.id + '" aria-label="Удалить">✕</button></li>';
      }).join("") + '</ul><div class="total">Итого: <b>' + money(F.fixedTotal(state)) + "</b></div>" : "";
      h += fixedForm(true) + '<button class="btn primary big" data-a="obNext">Дальше</button></div>';
    } else {
      var sug = F.fundSuggestion(state);
      h += '<form data-form="ob2" class="card"><h1 class="title">Цель подушки безопасности</h1><p class="sub">Запас на случай потери дохода или болезни. Обычно это 3–6 месяцев расходов.</p>' +
        (sug.monthly > 0 ? '<div class="chips">' + chipSet("goal", sug.min, "3 мес · " + money(sug.min)) + chipSet("goal", sug.max, "6 мес · " + money(sug.max)) + "</div>" : "") +
        amountInput("goal", state.fund.goal || "", "Сумма цели", true) +
        '<button class="btn primary big" type="submit">Готово</button></form>';
    }
    h += '<div class="onb-foot">' + (s > 0 ? '<button class="btn ghost" data-a="obBack">Назад</button>' : "<span></span>") + '<button class="btn ghost" data-a="obSkip">Пропустить</button></div></main>';
    return h;
  }
  function chipSet(field, val, label) { return '<button type="button" class="chip" data-a="setField" data-f="' + field + '" data-v="' + val + '">' + esc(label) + "</button>"; }
  function catOptions(sel) {
    return '<option value="">— категория —</option>' + state.categories.expense.map(function (c) { return '<option value="' + c.id + '"' + (c.id === sel ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("");
  }
  function fixedForm(compact) {
    return '<form data-form="addFixed" class="inline-form"><input name="name" placeholder="Название, напр. Коммуналка" autocomplete="off" required>' +
      '<div class="two">' + amountInput("amount", "", "Сумма") + '<select name="cat">' + catOptions("") + "</select></div>" +
      '<button class="btn ' + (compact ? "soft" : "soft") + '" type="submit">+ Добавить</button></form>';
  }

  /* ---------- главная ---------- */
  function home() {
    var mk = cur(), t = F.monthTotals(state, mk), b = F.budgetStatus(state, mk), h = "";
    h += '<header class="top"><div><div class="muted">' + monthTitle(mk) + '</div><div class="h-label">Баланс месяца</div></div></header>';
    h += '<section class="card hero"><div class="balance ' + (t.balance < 0 ? "neg" : "") + '">' + money(t.balance) + "</div>" +
      '<div class="split"><div><span class="dot inc"></span>Доходы<br><b>' + money(t.income) + '</b></div><div><span class="dot exp"></span>Расходы<br><b>' + money(t.expense) + "</b></div></div>";
    if (b.total > 0) {
      h += '<div class="budget-line"><span>Бюджет: ' + money(b.spent) + " из " + money(b.total) + "</span><span>" + Math.round(b.pct * 100) + "%</span></div>" + bar(b.pct, b.over ? "over" : b.pct > 0.85 ? "warn" : "") +
        '<div class="muted small">' + (b.over ? "⚠️ Бюджет превышен на " + money(-b.left) : "Осталось " + money(b.left)) + "</div>";
    } else h += '<button class="link" data-a="tab" data-v="more">Задать бюджет на месяц →</button>';
    h += "</section>";
    h += '<div class="actions"><button class="btn big exp-btn" data-a="add" data-v="exp">− Расход</button><button class="btn big inc-btn" data-a="add" data-v="inc">+ Доход</button></div>';

    var ol = F.overLimits(state, mk);
    if (ol.length) h += '<section class="card warn-card">' + ol.map(function (o) {
      return '<div class="warn-row">' + (o.over ? "⚠️ " : "⏳ ") + "<b>" + esc(o.name) + "</b>: " + money(o.spent) + " из " + money(o.limit) + (o.over ? " — лимит превышен" : " — почти лимит") + "</div>";
    }).join("") + "</section>";

    if (state.fixed.length) {
      var paidN = state.fixed.filter(function (f) { return F.isPaid(state, mk, f.id); }).length;
      h += '<section class="card"><div class="sec-h"><h2>Обязательные</h2><span class="muted">' + paidN + " из " + state.fixed.length + "</span></div>" +
        '<ul class="list">' + state.fixed.map(function (f) {
          var p = F.isPaid(state, mk, f.id);
          return '<li><button class="check-row' + (p ? " done" : "") + '" data-a="togglePaid" data-id="' + f.id + '"><span class="box">' + (p ? "✓" : "") + '</span><span class="grow">' + esc(f.name) + '</span><span class="muted">' + money(f.amount) + "</span></button></li>";
        }).join("") + "</ul></section>";
    }
    h += txList(F.txForMonth(state, mk), "Последние записи", 15);
    return h;
  }
  function txList(list, title, limit) {
    list = list.slice().sort(function (a, b) { return a.date === b.date ? b.ts - a.ts : a.date < b.date ? 1 : -1; });
    var h = '<section class="card"><div class="sec-h"><h2>' + title + "</h2>" + (list.length ? '<span class="muted">' + list.length + "</span>" : "") + "</div>";
    if (!list.length) return h + '<p class="muted empty">Пока нет записей. Нажмите «− Расход» или «+ Доход».</p></section>';
    var shown = limit ? list.slice(0, limit) : list, last = "";
    h += '<ul class="list tx">';
    shown.forEach(function (t) {
      if (t.date !== last) { h += '<li class="day">' + dayTitle(t.date) + "</li>"; last = t.date; }
      h += '<li><button class="tx-row" data-a="txMenu" data-id="' + t.id + '"><span class="grow"><span>' + esc(F.catName(state, t.cat)) + "</span>" + (t.note ? '<span class="muted small note">' + esc(t.note) + "</span>" : "") +
        '</span><b class="' + (t.type === "inc" ? "pos" : "") + '">' + (t.type === "inc" ? "+" : "−") + money(t.amount) + "</b></button></li>";
    });
    h += "</ul>";
    if (limit && list.length > limit) h += '<button class="link" data-a="tab" data-v="stats">Все записи →</button>';
    return h + "</section>";
  }

  /* ---------- статистика ---------- */
  function stats() {
    var mk = ui.month, prev = F.shiftMonth(mk, -1), t = F.monthTotals(state, mk), p = F.monthTotals(state, prev);
    var cats = F.byCategory(state, mk, "exp"), prevCats = {};
    F.byCategory(state, prev, "exp").forEach(function (x) { prevCats[x.cat] = x.amount; });
    var h = '<header class="month-sw"><button class="icon-btn big" data-a="month" data-v="-1" aria-label="Предыдущий">‹</button><div class="h-label">' + monthTitle(mk) + '</div><button class="icon-btn big" data-a="month" data-v="1" aria-label="Следующий">›</button></header>';
    h += '<section class="card"><div class="grid3"><div><div class="muted small">Доходы</div><b>' + money(t.income) + '</b></div><div><div class="muted small">Расходы</div><b>' + money(t.expense) + '</b></div><div><div class="muted small">Итог</div><b class="' + (t.balance < 0 ? "neg" : "pos") + '">' + money(t.balance) + "</b></div></div>";
    h += '<div class="cmp">По сравнению с прошлым месяцем: ' + diff(t.expense, p.expense, "расходы", true) + ", " + diff(t.income, p.income, "доходы", false) + "</div></section>";
    h += '<section class="card"><div class="sec-h"><h2>Расходы по категориям</h2></div>';
    if (!cats.length) h += '<p class="muted empty">В этом месяце расходов нет.</p>';
    else {
      h += donut(cats, t.expense);
      var max = cats[0].amount;
      h += '<ul class="list cats">' + cats.map(function (c, i) {
        var pv = prevCats[c.cat] || 0;
        return '<li><div class="cat-line"><span><span class="sw" style="background:' + COLORS[i % COLORS.length] + '"></span>' + esc(F.catName(state, c.cat)) + "</span><b>" + money(c.amount) + "</b></div>" +
          '<div class="bar thin"><span style="width:' + (c.amount / max * 100).toFixed(1) + "%;background:" + COLORS[i % COLORS.length] + '"></span></div>' +
          '<div class="muted small">' + Math.round(c.amount / t.expense * 100) + "% · прошлый месяц: " + money(pv) + "</div></li>";
      }).join("") + "</ul>";
    }
    h += "</section>";
    var inc = F.byCategory(state, mk, "inc");
    if (inc.length) h += '<section class="card"><div class="sec-h"><h2>Доходы</h2></div><ul class="list">' + inc.map(function (c) { return '<li class="row"><span class="grow">' + esc(F.catName(state, c.cat)) + '</span><b class="pos">' + money(c.amount) + "</b></li>"; }).join("") + "</ul></section>";
    h += txList(F.txForMonth(state, mk), "Все записи месяца", 0);
    return h;
  }
  function diff(a, b, label, lowerBetter) {
    if (!b) return label + " — нет данных";
    var d = a - b, pct = Math.round(Math.abs(d) / b * 100), good = lowerBetter ? d <= 0 : d >= 0;
    if (d === 0) return label + " без изменений";
    return '<span class="' + (good ? "pos" : "neg") + '">' + label + " " + (d > 0 ? "▲ " : "▼ ") + pct + "%</span>";
  }
  function donut(cats, total) {
    var r = 60, c = 2 * Math.PI * r, off = 0, segs = "";
    cats.forEach(function (x, i) {
      var len = x.amount / total * c;
      segs += '<circle r="' + r + '" cx="80" cy="80" fill="none" stroke="' + COLORS[i % COLORS.length] + '" stroke-width="26" stroke-dasharray="' + len.toFixed(2) + " " + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 80 80)"/>';
      off += len;
    });
    return '<div class="donut"><svg viewBox="0 0 160 160" width="180" height="180" role="img" aria-label="Диаграмма расходов">' + segs +
      '<text x="80" y="76" text-anchor="middle" class="d-l">Всего</text><text x="80" y="96" text-anchor="middle" class="d-v">' + esc(money(total)) + "</text></svg></div>";
  }

  /* ---------- долги ---------- */
  function debts() {
    var h = '<header class="top"><div class="h-label">Долги и кредиты</div></header>';
    var totalRem = state.debts.reduce(function (s, d) { return s + F.debtRemaining(d); }, 0), totalM = state.debts.reduce(function (s, d) { return s + (F.debtRemaining(d) > 0 ? d.monthly || 0 : 0); }, 0);
    if (state.debts.length) h += '<section class="card hero"><div class="muted">Всего осталось</div><div class="balance">' + money(totalRem) + '</div><div class="muted">Платежи в месяц: ' + money(totalM) + "</div></section>";
    state.debts.forEach(function (d) {
      var rem = F.debtRemaining(d), ml = F.debtMonthsLeft(d), done = rem <= 0;
      h += '<section class="card debt"><div class="sec-h"><h2>' + esc(d.name) + (done ? " ✅" : "") + '</h2><button class="icon-btn" data-a="editDebt" data-id="' + d.id + '" aria-label="Изменить">✎</button></div>' +
        '<div class="split"><div>Осталось<br><b>' + money(rem) + "</b></div><div>Платёж<br><b>" + (d.monthly ? money(d.monthly) : "—") + "</b></div></div>" +
        bar(F.debtProgress(d), "good") + '<div class="muted small">Выплачено ' + Math.round(F.debtProgress(d) * 100) + "% из " + money(d.balance) +
        (done ? " · закрыт!" : ml != null ? " · примерно " + ml + " " + plural(ml, "месяц", "месяца", "месяцев") + (ml > 0 ? " (до " + untilDate(ml) + ")" : "") : " · укажите платёж, чтобы видеть срок") + "</div>" +
        (done ? "" : '<button class="btn soft wide" data-a="payDebt" data-id="' + d.id + '">Внести платёж</button>') +
        (d.payments.length ? '<details><summary>История платежей (' + d.payments.length + ")</summary><ul class=\"list\">" + d.payments.slice().reverse().map(function (p) {
          return '<li class="row"><span class="grow">' + dayTitle(p.date) + "</span><b>" + money(p.amount) + '</b><button class="icon-btn" data-a="delPay" data-id="' + d.id + '" data-p="' + p.id + '" aria-label="Удалить">✕</button></li>';
        }).join("") + "</ul></details>" : "") + "</section>";
    });
    if (!state.debts.length) h += '<section class="card"><p class="muted empty">Долгов нет — отлично! Если есть кредит или долг, добавьте его, чтобы видеть, сколько осталось до нуля.</p></section>';
    h += '<button class="btn primary big wide" data-a="newDebt">+ Добавить долг</button>';
    return h;
  }
  function plural(n, a, b, c) { n = Math.abs(n) % 100; var n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }
  function untilDate(m) { var mk = F.shiftMonth(cur(), m); return MONTHS_GEN[+mk.slice(5, 7) - 1] + " " + mk.slice(0, 4); }

  /* ---------- подушка ---------- */
  function fund() {
    var saved = F.fundSaved(state), goal = state.fund.goal || 0, sug = F.fundSuggestion(state);
    var h = '<header class="top"><div class="h-label">Подушка безопасности</div></header>';
    h += '<section class="card hero"><div class="muted">Накоплено</div><div class="balance">' + money(saved) + "</div>";
    if (goal > 0) {
      h += '<div class="budget-line"><span>Цель: ' + money(goal) + "</span><span>" + Math.round(saved / goal * 100) + "%</span></div>" + bar(saved / goal, "good") +
        '<div class="muted small">' + (saved >= goal ? "🎉 Цель достигнута!" : "Осталось " + money(goal - saved)) + (sug.monthly > 0 ? " · хватит на ~" + (saved / sug.monthly).toFixed(1).replace(".", ",") + " мес. расходов" : "") + "</div>";
    } else h += '<p class="muted">Цель не задана.</p>';
    h += "</section>";
    h += '<div class="actions"><button class="btn big inc-btn" data-a="fundAdd" data-v="1">+ Отложить</button><button class="btn big ghost-btn" data-a="fundAdd" data-v="-1">Снять</button></div>';
    h += '<form data-form="fundGoal" class="card"><h2>Цель</h2>' +
      (sug.monthly > 0 ? '<p class="sub small">Ваши расходы в среднем ~' + money(sug.monthly) + " в месяц. Рекомендуется 3–6 месяцев:</p><div class=\"chips\">" + chipSet("goal", sug.min, "3 мес · " + money(sug.min)) + chipSet("goal", sug.max, "6 мес · " + money(sug.max)) + "</div>" : '<p class="sub small">Когда появятся записи о расходах, здесь будет подсказка: 3–6 месяцев расходов.</p>') +
      amountInput("goal", goal || "", "Сумма цели") + '<button class="btn soft wide" type="submit">Сохранить цель</button></form>';
    if (state.fund.deposits.length) h += '<section class="card"><div class="sec-h"><h2>История</h2></div><ul class="list">' + state.fund.deposits.slice().reverse().map(function (x) {
      return '<li class="row"><span class="grow">' + dayTitle(x.date) + (x.note ? ' <span class="muted small">' + esc(x.note) + "</span>" : "") + '</span><b class="' + (x.amount > 0 ? "pos" : "neg") + '">' + money(x.amount, true) + '</b><button class="icon-btn" data-a="delDep" data-id="' + x.id + '" aria-label="Удалить">✕</button></li>';
    }).join("") + "</ul></section>";
    return h;
  }

  /* ---------- ещё / настройки ---------- */
  function more() {
    var h = '<header class="top"><div class="h-label">Настройки</div></header>';
    h += '<form data-form="settings" class="card"><h2>Бюджет на месяц</h2><label class="lbl">Месячный доход (ориентир)</label>' + amountInput("income", state.settings.monthlyIncome || "", "0") +
      '<label class="lbl">Общий лимит расходов в месяц</label>' + amountInput("budget", state.settings.budget || "", "Если пусто — равен доходу") +
      '<button class="btn soft wide" type="submit">Сохранить</button></form>';
    h += '<section class="card"><div class="sec-h"><h2>Обязательные расходы</h2><span class="muted">' + money(F.fixedTotal(state)) + '</span></div><ul class="list">' + state.fixed.map(function (f) {
      return '<li class="row"><div class="grow"><div>' + esc(f.name) + '</div><div class="muted small">' + money(f.amount) + " · " + esc(f.cat ? F.catName(state, f.cat) : "без категории") + '</div></div><button class="icon-btn" data-a="delFixed" data-id="' + f.id + '" aria-label="Удалить">✕</button></li>';
    }).join("") + "</ul>" + fixedForm(false) + "</section>";
    h += '<section class="card"><div class="sec-h"><h2>Категории расходов</h2></div><p class="sub small">Нажмите на категорию, чтобы переименовать или задать лимит на месяц.</p><ul class="list">' + state.categories.expense.map(function (c) {
      return '<li><button class="tx-row" data-a="editCat" data-t="expense" data-id="' + c.id + '"><span class="grow">' + esc(c.name) + '</span><span class="muted small">' + (c.limit > 0 ? "лимит " + money(c.limit) : "без лимита") + "</span></button></li>";
    }).join("") + '</ul><button class="btn soft wide" data-a="newCat" data-t="expense">+ Категория расходов</button></section>';
    h += '<section class="card"><div class="sec-h"><h2>Категории доходов</h2></div><ul class="list">' + state.categories.income.map(function (c) {
      return '<li><button class="tx-row" data-a="editCat" data-t="income" data-id="' + c.id + '"><span class="grow">' + esc(c.name) + "</span></button></li>";
    }).join("") + '</ul><button class="btn soft wide" data-a="newCat" data-t="income">+ Категория доходов</button></section>';
    h += '<section class="card"><h2>Резервная копия</h2><p class="sub small">Данные хранятся только на этом телефоне. Время от времени сохраняйте копию.</p>' +
      '<button class="btn soft wide" data-a="exportJson">⬇️ Скачать копию (JSON)</button><button class="btn soft wide" data-a="exportCsv">📄 Выгрузить в Excel (CSV)</button>' +
      '<label class="btn soft wide file-btn">⬆️ Восстановить из копии<input type="file" accept=".json,application/json" data-a="importJson" hidden></label></section>';
    h += '<section class="card"><h2>На экран «Домой»</h2><p class="sub small"><b>iPhone (Safari):</b> «Поделиться» → «На экран Домой».<br><b>Android (Chrome):</b> меню ⋮ → «Добавить на главный экран».</p></section>';
    h += '<section class="card"><button class="btn ghost wide" data-a="rerunOb">Пройти настройку заново</button><button class="btn danger wide" data-a="reset">Удалить все данные</button></section>';
    h += '<p class="muted small center">Мои финансы · данные не покидают ваше устройство</p>';
    return h;
  }

  /* ---------- шторки ---------- */
  function sheet() {
    var s = ui.sheet, h = '<div class="overlay" data-a="closeSheet"></div><div class="sheet" role="dialog">';
    if (s.kind === "tx") {
      var isInc = s.type === "inc", cats = isInc ? state.categories.income : state.categories.expense;
      h += '<form data-form="tx"><div class="sheet-h"><h2>' + (isInc ? "Доход" : "Расход") + '</h2><button type="button" class="icon-btn" data-a="closeSheet" aria-label="Закрыть">✕</button></div>' +
        amountInput("amount", "", "Сумма, ₸", true) +
        '<div class="chips cats-chips">' + cats.map(function (c, i) {
          return '<label class="chip"><input type="radio" name="cat" value="' + c.id + '"' + ((s.cat ? s.cat === c.id : i === 0) ? " checked" : "") + "><span>" + esc(c.name) + "</span></label>";
        }).join("") + "</div>" +
        '<input name="note" placeholder="Заметка (необязательно)" autocomplete="off"><input type="date" name="date" value="' + F.today() + '">' +
        '<button class="btn big wide ' + (isInc ? "inc-btn" : "exp-btn") + '" type="submit">Сохранить</button></form>';
    } else if (s.kind === "txMenu") {
      var t = state.tx.find(function (x) { return x.id === s.id; });
      if (!t) { ui.sheet = null; return ""; }
      h += '<div class="sheet-h"><h2>' + esc(F.catName(state, t.cat)) + '</h2><button type="button" class="icon-btn" data-a="closeSheet">✕</button></div>' +
        '<p class="balance small-bal ' + (t.type === "inc" ? "pos" : "") + '">' + (t.type === "inc" ? "+" : "−") + money(t.amount) + '</p><p class="muted">' + dayTitle(t.date) + (t.note ? " · " + esc(t.note) : "") + "</p>" +
        (t.ref ? '<p class="muted small">Связано с ' + (t.ref.indexOf("fixed") === 0 ? "обязательным платежом" : "платежом по долгу") + " — отметка тоже снимется.</p>" : "") +
        '<button class="btn danger big wide" data-a="delTx" data-id="' + t.id + '">Удалить запись</button>';
    } else if (s.kind === "debt") {
      var d = s.id ? state.debts.find(function (x) { return x.id === s.id; }) : null;
      h += '<form data-form="debt"><div class="sheet-h"><h2>' + (d ? "Изменить долг" : "Новый долг") + '</h2><button type="button" class="icon-btn" data-a="closeSheet">✕</button></div>' +
        '<label class="lbl">Название</label><input name="name" required placeholder="Например, Автокредит" value="' + (d ? esc(d.name) : "") + '"' + (d ? "" : " autofocus") + ">" +
        '<label class="lbl">' + (d ? "Сумма долга на старте" : "Сколько осталось выплатить") + "</label>" + amountInput("balance", d ? d.balance : "", "0") +
        '<label class="lbl">Ежемесячный платёж</label>' + amountInput("monthly", d ? d.monthly : "", "0") +
        '<button class="btn primary big wide" type="submit">Сохранить</button>' + (d ? '<button type="button" class="btn danger wide" data-a="delDebt" data-id="' + d.id + '">Удалить долг</button>' : "") + "</form>";
    } else if (s.kind === "pay") {
      var dd = state.debts.find(function (x) { return x.id === s.id; });
      h += '<form data-form="pay"><div class="sheet-h"><h2>Платёж: ' + esc(dd.name) + '</h2><button type="button" class="icon-btn" data-a="closeSheet">✕</button></div>' +
        amountInput("amount", dd.monthly || "", "Сумма", true) + '<input type="date" name="date" value="' + F.today() + '">' +
        '<label class="check"><input type="checkbox" name="asExp" checked> Записать как расход «Кредит»</label>' +
        '<button class="btn primary big wide" type="submit">Внести</button></form>';
    } else if (s.kind === "fund") {
      h += '<form data-form="fundDep"><div class="sheet-h"><h2>' + (s.sign > 0 ? "Отложить в подушку" : "Снять из подушки") + '</h2><button type="button" class="icon-btn" data-a="closeSheet">✕</button></div>' +
        amountInput("amount", "", "Сумма, ₸", true) + '<input name="note" placeholder="Заметка (необязательно)"><input type="date" name="date" value="' + F.today() + '">' +
        '<button class="btn big wide ' + (s.sign > 0 ? "inc-btn" : "exp-btn") + '" type="submit">Сохранить</button></form>';
    } else if (s.kind === "cat") {
      var list = state.categories[s.t], c = s.id ? list.find(function (x) { return x.id === s.id; }) : null;
      h += '<form data-form="cat"><div class="sheet-h"><h2>' + (c ? "Категория" : "Новая категория") + '</h2><button type="button" class="icon-btn" data-a="closeSheet">✕</button></div>' +
        '<label class="lbl">Название</label><input name="name" required value="' + (c ? esc(c.name) : "") + '" autofocus>' +
        (s.t === "expense" ? '<label class="lbl">Лимит в месяц (необязательно)</label>' + amountInput("limit", c && c.limit ? c.limit : "", "Без лимита") : "") +
        '<button class="btn primary big wide" type="submit">Сохранить</button>' + (c ? '<button type="button" class="btn danger wide" data-a="delCat">Удалить категорию</button>' : "") + "</form>";
    }
    return h + "</div>";
  }

  /* ---------- действия ---------- */
  function setTab(t) { ui.tab = t; ui.sheet = null; render(); window.scrollTo(0, 0); }
  function closeSheet() { ui.sheet = null; render(); }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  var actions = {
    tab: function (el) { setTab(el.dataset.v); },
    add: function (el) { ui.sheet = { kind: "tx", type: el.dataset.v }; render(); },
    closeSheet: closeSheet,
    txMenu: function (el) { ui.sheet = { kind: "txMenu", id: el.dataset.id }; render(); },
    delTx: function (el) { F.deleteTx(state, el.dataset.id); save(); ui.sheet = null; toast("Запись удалена"); },
    togglePaid: function (el) { var on = F.togglePaid(state, cur(), el.dataset.id); save(); toast(on ? "Отмечено как оплачено" : "Отметка снята"); },
    delFixed: function (el) { if (!confirm("Удалить обязательный расход?")) return; state.fixed = state.fixed.filter(function (f) { return f.id !== el.dataset.id; }); save(); render(); },
    month: function (el) { ui.month = F.shiftMonth(ui.month, +el.dataset.v); render(); },
    newDebt: function () { ui.sheet = { kind: "debt" }; render(); },
    editDebt: function (el) { ui.sheet = { kind: "debt", id: el.dataset.id }; render(); },
    delDebt: function (el) { if (!confirm("Удалить долг и его историю?")) return; state.debts = state.debts.filter(function (d) { return d.id !== el.dataset.id; }); save(); ui.sheet = null; render(); },
    payDebt: function (el) { ui.sheet = { kind: "pay", id: el.dataset.id }; render(); },
    delPay: function (el) {
      if (!confirm("Удалить этот платёж?")) return;
      var d = state.debts.find(function (x) { return x.id === el.dataset.id; }), pid = el.dataset.p;
      d.payments = d.payments.filter(function (p) { return p.id !== pid; });
      state.tx = state.tx.filter(function (t) { return t.ref !== "debt:" + pid; });
      save(); render();
    },
    fundAdd: function (el) { ui.sheet = { kind: "fund", sign: +el.dataset.v }; render(); },
    delDep: function (el) { if (!confirm("Удалить запись?")) return; state.fund.deposits = state.fund.deposits.filter(function (x) { return x.id !== el.dataset.id; }); save(); render(); },
    setField: function (el) { var f = el.closest("form") || app; var inp = f.querySelector('[name="' + el.dataset.f + '"]'); if (inp) inp.value = el.dataset.v; },
    editCat: function (el) { ui.sheet = { kind: "cat", t: el.dataset.t, id: el.dataset.id }; render(); },
    newCat: function (el) { ui.sheet = { kind: "cat", t: el.dataset.t }; render(); },
    delCat: function () {
      var s = ui.sheet, list = state.categories[s.t];
      if (list.length <= 1) return alert("Должна остаться хотя бы одна категория");
      var used = state.tx.some(function (t) { return t.cat === s.id; });
      if (!confirm(used ? "В этой категории есть записи — они останутся, но будут «Без категории». Удалить?" : "Удалить категорию?")) return;
      state.categories[s.t] = list.filter(function (c) { return c.id !== s.id; }); save(); ui.sheet = null; render();
    },
    exportJson: function () { download("moi-finansy-" + F.today() + ".json", JSON.stringify(state, null, 1), "application/json"); },
    exportCsv: function () { download("moi-finansy-" + F.today() + ".csv", F.toCSV(state), "text/csv;charset=utf-8"); },
    reset: function () {
      if (!confirm("Удалить ВСЕ данные? Это нельзя отменить.")) return;
      if (!confirm("Точно удалить? Сначала можно скачать копию.")) return;
      state = F.defaultState(); save(); ui = { tab: "home", month: cur(), sheet: null, ob: 0, toast: "" }; render();
    },
    rerunOb: function () { state.onboarded = false; ui.ob = 0; save(); render(); },
    obNext: function () { ui.ob = Math.min(2, ui.ob + 1); render(); },
    obBack: function () { ui.ob = Math.max(0, ui.ob - 1); render(); },
    obSkip: function () { state.onboarded = true; save(); ui.tab = "home"; render(); }
  };

  var forms = {
    ob0: function (fd) { state.settings.monthlyIncome = F.parseAmount(fd.get("income")); save(); ui.ob = 1; render(); },
    ob2: function (fd) { state.fund.goal = F.parseAmount(fd.get("goal")); state.onboarded = true; save(); ui.tab = "home"; render(); },
    addFixed: function (fd) {
      var name = String(fd.get("name") || "").trim(); if (!name) return;
      var cat = fd.get("cat") || "";
      if (!cat) { var m = state.categories.expense.find(function (c) { return c.name.toLowerCase() === name.toLowerCase(); }); if (m) cat = m.id; }
      state.fixed.push({ id: F.uid(), name: name, amount: F.parseAmount(fd.get("amount")), cat: cat }); save(); render();
    },
    tx: function (fd) {
      var amt = F.parseAmount(fd.get("amount"));
      if (!(amt > 0)) return toast("Введите сумму");
      var type = ui.sheet.type;
      F.addTx(state, { type: type, amount: amt, cat: fd.get("cat"), note: fd.get("note"), date: fd.get("date") || F.today() });
      save(); ui.sheet = null; toast((type === "inc" ? "Доход " : "Расход ") + money(amt) + " записан");
    },
    debt: function (fd) {
      var name = String(fd.get("name") || "").trim(), bal = F.parseAmount(fd.get("balance"));
      if (!name || !(bal > 0)) return toast("Укажите название и сумму");
      var id = ui.sheet.id, d = id && state.debts.find(function (x) { return x.id === id; });
      if (d) { d.name = name; d.balance = bal; d.monthly = F.parseAmount(fd.get("monthly")); }
      else state.debts.push({ id: F.uid(), name: name, balance: bal, monthly: F.parseAmount(fd.get("monthly")), payments: [], created: F.today() });
      save(); ui.sheet = null; render();
    },
    pay: function (fd) {
      var amt = F.parseAmount(fd.get("amount")); if (!(amt > 0)) return toast("Введите сумму");
      F.addDebtPayment(state, ui.sheet.id, amt, fd.get("date") || F.today(), !!fd.get("asExp")); save(); ui.sheet = null; toast("Платёж внесён");
    },
    fundDep: function (fd) {
      var amt = F.parseAmount(fd.get("amount")); if (!(amt > 0)) return toast("Введите сумму");
      state.fund.deposits.push({ id: F.uid(), amount: amt * ui.sheet.sign, date: fd.get("date") || F.today(), note: String(fd.get("note") || "").trim() });
      save(); ui.sheet = null; toast("Сохранено");
    },
    fundGoal: function (fd) { state.fund.goal = F.parseAmount(fd.get("goal")); save(); toast("Цель сохранена"); },
    settings: function (fd) { state.settings.monthlyIncome = F.parseAmount(fd.get("income")); state.settings.budget = F.parseAmount(fd.get("budget")); save(); toast("Сохранено"); },
    cat: function (fd) {
      var s = ui.sheet, name = String(fd.get("name") || "").trim(); if (!name) return;
      var list = state.categories[s.t], c = s.id && list.find(function (x) { return x.id === s.id; });
      if (!c) { c = { id: F.uid(), name: name }; list.push(c); }
      c.name = name; if (s.t === "expense") c.limit = F.parseAmount(fd.get("limit"));
      save(); ui.sheet = null; render();
    }
  };

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-a]");
    if (!el || el.tagName === "INPUT") return;
    var fn = actions[el.dataset.a];
    if (fn) { e.preventDefault(); fn(el); }
  });
  document.addEventListener("submit", function (e) {
    var f = e.target, fn = forms[f.dataset.form];
    if (fn) { e.preventDefault(); try { fn(new FormData(f)); } catch (err) { toast(err.message || "Ошибка"); } }
  });
  document.addEventListener("change", function (e) {
    if (e.target.dataset && e.target.dataset.a === "importJson") {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var data = JSON.parse(r.result);
          if (!data || !Array.isArray(data.tx)) throw new Error("bad");
          if (!confirm("Заменить текущие данные данными из копии?")) return;
          state = F.normalize(data); state.onboarded = true; save(); toast("Данные восстановлены");
        } catch (err) { alert("Не удалось прочитать файл копии"); }
      };
      r.readAsText(file);
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ui.sheet) closeSheet(); });

  render();
  window.__fin = { get state() { return state; }, ui: ui, render: render, actions: actions, forms: forms };

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
