/* === SKOS Finance 3.0 — patch4.js (Модуль 1: Ядро и навигация) === */
(function () {
  'use strict';
  if (window.__skosP4Final) return;
  window.__skosP4Final = true;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v) {
    const n = parseFloat(String(v == null ? 0 : v).replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function pSave() {
    try {
      if (typeof window.save === 'function') window.save();
      else if (window.db) localStorage.setItem('skos_v3_prod', JSON.stringify(window.db));
    } catch (e) {}
  }

  function rateNow() {
    return (typeof window.getRate === 'function' ? num(window.getRate()) : 0) || 96.5;
  }

  function ensureStore() {
    if (!window.db || typeof window.db !== 'object') window.db = {};
    if (!window.db.erp || typeof window.db.erp !== 'object') window.db.erp = {};
    const e = window.db.erp;
    ['materials', 'matIn', 'orders', 'bom', 'fgStocks', 'defects', 'osList', 'contractors', 'contractorOps', 'staffList', 'payrollOps', 'taxDebts'].forEach(function (k) {
      if (!Array.isArray(e[k])) e[k] = [];
    });
    if (!Array.isArray(e.dictMatCats)) e.dictMatCats = [{ name: 'Ткань', arch: false }, { name: 'Фурнитура', arch: false }, { name: 'Упаковка и бирки', arch: false }, { name: 'Услуги пошива', arch: false }];
    if (!Array.isArray(e.dictUnits)) e.dictUnits = [{ name: 'м2', arch: false }, { name: 'кг', arch: false }, { name: 'м', arch: false }, { name: 'шт', arch: false }, { name: 'усл', arch: false }];
    if (!Array.isArray(e.dictSuppliers)) e.dictSuppliers = [{ name: 'Турция', arch: false }, { name: 'Китай', arch: false }, { name: 'РФ', arch: false }, { name: 'Туркменистан', arch: false }];
    if (!Array.isArray(e.dictTaxTypes)) e.dictTaxTypes = [{ name: 'АУСН', arch: false }, { name: 'УСН', arch: false }, { name: 'НДС', arch: false }, { name: 'ЕНП', arch: false }, { name: 'Взносы ИП', arch: false }, { name: 'Патент', arch: false }];
    if (!Array.isArray(e.ddsArticles)) e.ddsArticles = [{ name: 'Поступление от ВБ/Озон', dir: 'in', opiu: 'Нет (из отчётов МП)', arch: false }, { name: 'Оплата поставщику', dir: 'out', opiu: 'Нет (по актам)', arch: false }, { name: 'Уплата налога', dir: 'out', opiu: 'Нет (раздел Налоги)', arch: false }, { name: 'РКО / Прочий расход', dir: 'out', opiu: 'Да (в ОПиУ)', arch: false }];
    if (!e.dictSub) e.dictSub = 'ctrs';
    if (!e.stkSub) e.stkSub = 'sum';
    return e;
  }

  function ensureDictNav() {
    const navSet = document.getElementById('nav-set');
    if (navSet && !document.getElementById('nav-dict')) {
      const b = document.createElement('button');
      b.className = 'nav-btn'; b.id = 'nav-dict'; b.textContent = '📚 Справочники';
      b.onclick = function () { window.tab('dict'); };
      navSet.insertAdjacentElement('afterend', b);
    }
    const main = document.querySelector('main.content');
    if (main && !document.getElementById('tab-dict')) {
      const s = document.createElement('section');
      s.id = 'tab-dict'; s.className = 'hidden';
      main.appendChild(s);
    }
  }

  function syncTabState(active) {
    ensureDictNav();
    ['dash', 'abc', 'rep', 'sku', 'stk', 'dds', 'exp', 'sup', 'set', 'dict'].forEach(function (t) {
      const sec = document.getElementById('tab-' + t);
      const nav = document.getElementById('nav-' + t);
      const on = (t === active);
      if (sec) { sec.classList.toggle('hidden', !on); sec.style.display = on ? 'block' : 'none'; }
      if (nav) nav.classList.toggle('active', on);
    });
  }

  const _origTab = window.tab;
  window.tab = function (id) {
    ensureDictNav();
    if (id === 'dict') {
      if (window.db) window.db.tab = 'dict';
      syncTabState('dict');
      if (typeof window.render === 'function') window.render();
      return;
    }
    if (typeof _origTab === 'function') _origTab(id);
    syncTabState(id);
  };
/* === SKOS Finance 3.0 — patch4.js (Модуль 2: Кэш 32 папок, списки и действия Справочников) === */
  let _mCache = null, _mKey = '';
  function getModelsList() {
    const e = ensureStore();
    const skLen = (window.db && Array.isArray(window.db.skus)) ? window.db.skus.length : 0;
    const key = skLen + '_' + e.bom.length;
    if (_mCache && _mKey === key) return _mCache;
    let fNames = {};
    try { fNames = JSON.parse(localStorage.getItem('skos_v3_folder_names') || '{}'); } catch (err) {}
    const map = new Map();
    const put = function (nm, usd) {
      const s = String(nm || '').trim();
      if (!s || s.length < 2) return;
      const k = s.toLowerCase();
      const prev = map.get(k) || { name: s, usd: 0 };
      map.set(k, { name: prev.name, usd: num(usd) > 0 ? num(usd) : prev.usd });
    };
    Object.keys(fNames).forEach(function (a) { put(fNames[a] || a, 0); });
    (window.db && window.db.skus || []).forEach(function (s) {
      if (!s) return;
      const a = String(s.art || '').trim();
      put(fNames[a] || s.folder || s.name || a, s.usd);
    });
    e.bom.forEach(function (b) { if (b && b.product) put(b.product, 0); });
    _mCache = Array.from(map.values()).sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    _mKey = key;
    return _mCache;
  }

  function getActiveOrgs() {
    const out = [], seen = new Set();
    (window.db && window.db.orgs || []).forEach(function (o) {
      if (o && o.name && !o.archived && !o.hidden && !seen.has(o.name)) { seen.add(o.name); out.push(o.name); }
    });
    return out.length ? out : ['ИП Каримов Артем', 'ИП Джуманиязова Мавлюда', 'ИП Джуманиязова Эльмира', 'ИП Тыррыков Курбан', 'ИП Керимов Сахет', 'ООО «Скос»'];
  }

  function optList(arr, sel, empty) {
    let h = empty ? '<option value="">' + esc(empty) + '</option>' : '';
    for (let i = 0; i < arr.length; i++) {
      const v = String(arr[i]);
      h += '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>';
    }
    return h;
  }

  function optDict(arr, sel, empty) {
    return optList((arr || []).filter(function (x) { return x && !x.arch; }).map(function (x) { return x.name; }), sel, empty);
  }

  function optModels(sel, empty) {
    return optList(getModelsList().map(function (m) { return m.name; }), sel, empty || '— Модель —');
  }

  window.p4QuickAdd = function (key, title, selId) {
    const val = prompt('Добавить в справочник «' + title + '»:');
    if (!val || !val.trim()) return;
    const e = ensureStore(), nm = val.trim();
    const ex = e[key].find(function (x) { return x.name.toLowerCase() === nm.toLowerCase(); });
    if (ex) ex.arch = false;
    else e[key].unshift({ name: nm, arch: false });
    pSave();
    if (typeof window.render === 'function') window.render();
    if (selId) setTimeout(function () { const el = document.getElementById(selId); if (el) el.value = nm; }, 20);
  };

  window.p4DictSub = function (sub) { ensureStore().dictSub = sub; pSave(); renderDictTab(); };

  window.p4DictAdd = function (key) {
    const e = ensureStore(), nm = (document.getElementById('d-nm') || {}).value;
    if (!nm || !nm.trim()) return alert('Введите название!');
    const name = nm.trim();
    if (key === 'ddsArticles') {
      e.ddsArticles.unshift({ name: name, dir: document.getElementById('d-dir').value, opiu: document.getElementById('d-opiu').value, arch: false });
    } else if (key === 'staffList') {
      e.staffList.unshift({ name: name, role: document.getElementById('d-role').value.trim(), art: document.getElementById('d-art').value, cur: document.getElementById('d-cur').value, initDebt: num(document.getElementById('d-debt').value), arch: false });
    } else if (key === 'contractors') {
      e.contractors.unshift({ name: name, art: document.getElementById('d-art').value, cur: document.getElementById('d-cur').value, initDebt: num(document.getElementById('d-debt').value), arch: false });
    } else {
      e[key].unshift({ name: name, arch: false });
    }
    pSave(); renderDictTab();
  };

  window.p4DictEdit = function (key, idx) {
    const e = ensureStore(), it = e[key] && e[key][idx];
    if (!it) return;
    const nw = prompt('Название:', it.name);
    if (nw && nw.trim()) it.name = nw.trim();
    if (key === 'staffList' || key === 'contractors') {
      const nd = prompt('Начальный долг (+ долг / − аванс):', it.initDebt || 0);
      if (nd !== null) it.initDebt = num(nd);
    }
    pSave(); renderDictTab();
  };

  window.p4DictArch = function (key, idx) {
    const e = ensureStore();
    if (e[key] && e[key][idx]) { e[key][idx].arch = !e[key][idx].arch; pSave(); renderDictTab(); }
  };

  window.p4DictDel = function (key, idx) {
    const e = ensureStore();
    if (e[key] && e[key][idx] && confirm('Удалить «' + e[key][idx].name + '»?')) { e[key].splice(idx, 1); pSave(); renderDictTab(); }
  };
/* === SKOS Finance 3.0 — patch4.js (Модуль 3: Рендер Справочников и Юнит-показатели на 1 шт в ABC) === */
  function renderDictTab() {
    const sec = document.getElementById('tab-dict');
    if (!sec) return;
    const e = ensureStore();
    const folders = [
      { id: 'ctrs', key: 'contractors', title: '🤝 Контрагенты' },
      { id: 'staff', key: 'staffList', title: '👥 Сотрудники' },
      { id: 'dds', key: 'ddsArticles', title: '💳 Статьи ДДС' },
      { id: 'taxes', key: 'dictTaxTypes', title: '🏛️ Виды налогов' },
      { id: 'cats', key: 'dictMatCats', title: '🧵 Категории сырья' },
      { id: 'units', key: 'dictUnits', title: '📏 Ед. измерения' },
      { id: 'sups', key: 'dictSuppliers', title: '🌍 Поставщики сырья' }
    ];
    const cur = folders.find(function (f) { return f.id === e.dictSub; }) || folders;
    const list = e[cur.key] || [];

    const tabsHtml = folders.map(function (f) {
      return '<button class="btn ' + (f.id === cur.id ? 'btn-primary' : '') + '" onclick="p4DictSub(\'' + f.id + '\')">' + f.title + ' (' + (e[f.key] || []).length + ')</button>';
    }).join('');

    let extra = '';
    if (cur.key === 'ddsArticles') {
      extra = '<div><label>Тип</label><select id="d-dir" class="select"><option value="in">+ Приход</option><option value="out">− Расход</option><option value="move">↔ Перевод</option></select></div>' +
        '<div><label>Учёт в ОПиУ</label><select id="d-opiu" class="select"><option>Нет (из отчётов МП)</option><option>Нет (по актам)</option><option>Нет (раздел Налоги)</option><option>Нет (перевод)</option><option>Да (в ОПиУ)</option></select></div>';
    } else if (cur.key === 'staffList') {
      extra = '<div><label>Должность</label><input id="d-role" class="input" placeholder="Кладовщик"></div>' +
        '<div><label>Статья ФОТ</label><select id="d-art" class="select"><option>ФОТ склад</option><option>ФОТ менеджеры</option><option>ФОТ офис</option><option>ФОТ собственник</option></select></div>' +
        '<div><label>Валюта</label><select id="d-cur" class="select"><option>RUB</option><option>USD</option></select></div>' +
        '<div><label>Долг 01.01</label><input id="d-debt" type="number" class="input" value="0"></div>';
    } else if (cur.key === 'contractors') {
      extra = '<div><label>Статья ОПиУ</label><select id="d-art" class="select"><option>Аренда склада</option><option>Программное обеспечение</option><option>Административные и юридические услуги</option><option>Федеральная таможенная служба</option><option>Закуп товара / сырья USD</option></select></div>' +
        '<div><label>Валюта</label><select id="d-cur" class="select"><option>RUB</option><option>USD</option></select></div>' +
        '<div><label>Сальдо 01.01 (+долг/−аванс)</label><input id="d-debt" type="number" class="input" value="0"></div>';
    }

    const rows = list.map(function (it, i) {
      let info = 'Справочник';
      if (cur.key === 'ddsArticles') info = esc(it.dir) + ' • ' + esc(it.opiu || '');
      if (cur.key === 'staffList') info = esc(it.role || '') + ' • ' + esc(it.art || '') + ' • 01.01: ' + num(it.initDebt) + ' ' + esc(it.cur || 'RUB');
      if (cur.key === 'contractors') info = esc(it.art || '') + ' • 01.01: ' + num(it.initDebt) + ' ' + esc(it.cur || 'RUB');
      return '<tr style="' + (it.arch ? 'opacity:0.55;background:#f8fafc;' : '') + '">' +
        '<td class="bold">' + esc(it.name) + (it.arch ? ' <span class="badge badge-amber">Архив</span>' : '') + '</td>' +
        '<td>' + info + '</td>' +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="btn" onclick="p4DictEdit(\'' + cur.key + '\',' + i + ')">✏️</button> ' +
          '<button class="btn" onclick="p4DictArch(\'' + cur.key + '\',' + i + ')">' + (it.arch ? '📤' : '📦') + '</button> ' +
          '<button class="btn btn-danger" onclick="p4DictDel(\'' + cur.key + '\',' + i + ')">✕</button>' +
        '</td></tr>';
    }).join('');

    sec.innerHTML =
      '<div class="card"><div class="card-header"><div class="card-title">📚 Единые справочники SKOS по папкам</div></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + tabsHtml + '</div>' +
      '<div class="form-grid" style="margin-bottom:12px"><div><label>Название</label><input id="d-nm" class="input" placeholder="Введите название..."></div>' + extra +
      '<div><button class="btn btn-primary" style="width:100%" onclick="p4DictAdd(\'' + cur.key + '\')">+ Добавить</button></div></div>' +
      '<div style="overflow-x:auto"><table><thead><tr><th>Название</th><th>Параметры</th><th class="num">Действия</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">В этой папке пока пусто</td></tr>') + '</tbody></table></div></div>';
  }

  function enhanceAbcPerUnit() {
    const sec = document.getElementById('tab-abc');
    if (!sec) return;
    const tbl = sec.querySelector('table');
    if (!tbl) return;
    const hdrRow = tbl.querySelector('thead tr');
    if (hdrRow && !hdrRow.dataset.p4Unit) {
      hdrRow.dataset.p4Unit = '1';
      ['Цена/шт', 'Прибыль/шт'].forEach(function (lbl) {
        const th = document.createElement('th');
        th.className = 'num'; th.textContent = lbl;
        hdrRow.appendChild(th);
      });
    }
    const trs = tbl.querySelectorAll('tbody tr');
    for (let i = 0; i < trs.length; i++) {
      const tds = trs[i].querySelectorAll('td');
      if (tds.length < 8 || trs[i].dataset.p4Unit === '1') continue;
      trs[i].dataset.p4Unit = '1';
      const qty = num(tds.textContent);
      const rev = num(tds.textContent);
      const prof = num(tds.textContent);
      const pUnit = qty > 0 ? (rev / qty) : 0;
      const mUnit = qty > 0 ? (prof / qty) : 0;
      const td1 = document.createElement('td'); td1.className = 'num'; td1.textContent = fmtR(pUnit);
      const td2 = document.createElement('td'); td2.className = 'num bold ' + (mUnit >= 0 ? 'text-green' : 'text-red'); td2.textContent = fmtR(mUnit);
      trs[i].appendChild(td1); trs[i].appendChild(td2);
    }
  }
/* === SKOS Finance 3.0 — patch4.js (Модуль 4А: Склад — расчёты и операции) === */
  function calcStockStats(e) {
    const map = new Map();
    e.materials.forEach(function (m, idx) {
      if (m && m.name) map.set(m.name, { idx: idx, name: m.name, unit: m.unit || 'шт', cat: m.cat || 'Ткань', qty: num(m.initQty), usd: num(m.initUsd) });
    });
    e.matIn.forEach(function (inc) {
      const c = map.get(inc.matName);
      if (c) { c.qty += num(inc.qty); c.usd += num(inc.totalUsd) || (num(inc.qty) * num(inc.priceUsd)); }
    });
    e.orders.forEach(function (o) {
      if (o && o.status === 'DONE') (o.lines || []).forEach(function (ln) {
        const c = map.get(ln.matName);
        if (c) { const ap = c.qty > 0 ? c.usd / c.qty : num(ln.priceUsd); c.qty -= num(ln.usedQty); c.usd -= num(ln.usedQty) * ap; }
      });
    });
    let rawUsd = 0, wipUsd = 0, fgUsd = 0;
    const matRows = Array.from(map.values()).map(function (m) {
      if (m.usd > 0) rawUsd += m.usd;
      m.avg = m.qty > 0 ? m.usd / m.qty : 0;
      return m;
    });
    e.orders.forEach(function (o) { if (o && o.status === 'WIP') wipUsd += num(o.totalUsd); });
    e.fgStocks.forEach(function (f) { fgUsd += num(f.lockedUsd) || ((num(f.ruQty) + num(f.tmQty) + num(f.wayQty)) * num(f.unitUsd)); });
    return { matRows: matRows, rawUsd: rawUsd, wipUsd: wipUsd, fgUsd: fgUsd, totalUsd: rawUsd + wipUsd + fgUsd };
  }

  window.p4StkSub = function (s) { ensureStore().stkSub = s; pSave(); renderStkTab(); };
  window.p4DelRow = function (key, idx) {
    const e = ensureStore();
    if (e[key] && e[key][idx] && confirm('Удалить запись?')) { e[key].splice(idx, 1); pSave(); if (typeof window.render === 'function') window.render(); }
  };

  window.p4EditMat = function (idx) {
    const m = ensureStore().materials[idx];
    if (!m) return;
    const q = prompt('Начальный остаток (' + m.name + '):', m.initQty); if (q !== null) m.initQty = num(q);
    const u = prompt('Начальная сумма $:', m.initUsd); if (u !== null) m.initUsd = num(u);
    pSave(); renderStkTab();
  };

  window.p4EditFg = function (idx) {
    const f = ensureStore().fgStocks[idx];
    if (!f) return;
    const ru = prompt('Склад РФ шт:', f.ruQty); if (ru !== null) f.ruQty = num(ru);
    const tm = prompt('Склад ТМ шт:', f.tmQty); if (tm !== null) f.tmQty = num(tm);
    const way = prompt('В пути шт:', f.wayQty); if (way !== null) f.wayQty = num(way);
    f.lockedUsd = (num(f.ruQty) + num(f.tmQty) + num(f.wayQty)) * num(f.unitUsd);
    pSave(); renderStkTab();
  };

  window.p4MatAdd = function () {
    const e = ensureStore(), nm = document.getElementById('sm-nm').value.trim();
    if (!nm) return alert('Введите название!');
    e.materials.unshift({ name: nm, cat: document.getElementById('sm-cat').value, unit: document.getElementById('sm-un').value, initQty: num(document.getElementById('sm-q').value), initUsd: num(document.getElementById('sm-u').value) });
    pSave(); renderStkTab();
  };

  window.p4MatInAdd = function () {
    const e = ensureStore(), mat = document.getElementById('si-m').value, q = num(document.getElementById('si-q').value), pr = num(document.getElementById('si-p').value);
    if (!mat || q <= 0) return alert('Выберите сырьё и количество!');
    e.matIn.unshift({ date: document.getElementById('si-d').value || today(), matName: mat, supplier: document.getElementById('si-s').value, qty: q, priceUsd: pr, totalUsd: q * pr });
    pSave(); renderStkTab();
  };

  window.p4OrderAdd = function () {
    const e = ensureStore(), prod = document.getElementById('so-p').value, qty = num(document.getElementById('so-q').value);
    if (!prod || qty <= 0) return alert('Выберите модель и количество!');
    const rec = e.bom.find(function (b) { return b.product === prod; });
    let tot = 0; const lines = [];
    (rec && rec.items || []).forEach(function (it) { const u = num(it.norm) * qty; tot += u * num(it.priceUsd); lines.push({ matName: it.matName, usedQty: u, priceUsd: num(it.priceUsd) }); });
    e.orders.unshift({ date: document.getElementById('so-d').value || today(), doneDate: '', status: 'WIP', product: prod, qty: qty, totalUsd: tot, comment: document.getElementById('so-c').value.trim(), lines: lines });
    pSave(); renderStkTab();
  };

  window.p4OrderDone = function (i) {
    const o = ensureStore().orders[i];
    if (o && confirm('Завершить пошив и списать сырьё?')) { o.status = 'DONE'; o.doneDate = today(); pSave(); renderStkTab(); }
  };

  window.p4BomAdd = function () {
    const e = ensureStore(), prod = document.getElementById('sb-p').value, mat = document.getElementById('sb-m').value, norm = num(document.getElementById('sb-n').value), pr = num(document.getElementById('sb-pr').value);
    if (!prod || !mat || norm <= 0) return alert('Заполните модель, материал и норму!');
    let rec = e.bom.find(function (b) { return b.product === prod; });
    if (!rec) { rec = { product: prod, items: [] }; e.bom.unshift(rec); }
    rec.items.push({ matName: mat, norm: norm, priceUsd: pr });
    pSave(); renderStkTab();
  };

  window.p4FgAdd = function () {
    const e = ensureStore(), prod = document.getElementById('sf-p').value;
    if (!prod) return alert('Выберите модель!');
    const ru = num(document.getElementById('sf-ru').value), tm = num(document.getElementById('sf-tm').value), way = num(document.getElementById('sf-way').value), u = num(document.getElementById('sf-u').value);
    e.fgStocks.unshift({ month: document.getElementById('sf-m').value || today().slice(0, 7), product: prod, ruQty: ru, tmQty: tm, wayQty: way, unitUsd: u, lockedUsd: (ru + tm + way) * u });
    pSave(); renderStkTab();
  };

  window.p4DefAdd = function () {
    const e = ensureStore(), prod = document.getElementById('sd-p').value, q = num(document.getElementById('sd-q').value);
    if (!prod || q <= 0) return alert('Выберите модель и количество!');
    e.defects.unshift({ date: document.getElementById('sd-d').value || today(), product: prod, qty: q, unitUsd: num(document.getElementById('sd-u').value), reason: document.getElementById('sd-r').value.trim() || 'Брак' });
    pSave(); renderStkTab();
  };
/* === SKOS Finance 3.0 — patch4.js (Модуль 4Б: Рендер склада #tab-stk) === */
  function renderStkTab() {
    const sec = document.getElementById('tab-stk');
    if (!sec) return;
    const e = ensureStore(), st = calcStockStats(e), rate = rateNow(), sub = e.stkSub || 'sum';
    const matNames = st.matRows.map(function (m) { return m.name; });
    const nav = [['sum', '📊 Свод'], ['mat', '🧵 Материалы'], ['inc', '📥 Приход'], ['ord', '✂️ Пошив/Техкарты'], ['fg', '📦 ГП и Брак']]
      .map(function (t) { return '<button class="btn ' + (t === sub ? 'btn-primary' : '') + '" onclick="p4StkSub(\'' + t + '\')">' + t + '</button>'; }).join('');

    let body = '';
    if (sub === 'sum') {
      const low = st.matRows.filter(function (m) { return m.qty < 15; }).map(function (m) {
        return '<tr style="background:#fff1f2"><td class="bold">' + esc(m.name) + '</td><td class="num text-red bold">' + m.qty.toFixed(2) + ' ' + esc(m.unit) + '</td><td class="num">' + fmtU(m.usd) + '</td></tr>';
      }).join('');
      body = '<div class="kpi-grid"><div class="kpi-card"><div>Сырьё</div><div class="kpi-val">' + fmtU(st.rawUsd) + '</div></div><div class="kpi-card"><div>НЗП</div><div class="kpi-val">' + fmtU(st.wipUsd) + '</div></div><div class="kpi-card"><div>ГП</div><div class="kpi-val">' + fmtU(st.fgUsd) + '</div></div><div class="kpi-card highlight"><div>ИТОГО</div><div class="kpi-val text-green">' + fmtR(st.totalUsd * rate) + '</div></div></div>' +
        '<table><thead><tr><th>Критичные (&lt;15)</th><th class="num">Остаток</th><th class="num">Сумма $</th></tr></thead><tbody>' + (low || '<tr><td colspan="3">Норма</td></tr>') + '</tbody></table>';
    } else if (sub === 'mat') {
      const rows = st.matRows.map(function (m) {
        return '<tr><td class="bold">' + esc(m.name) + '</td><td>' + esc(m.cat) + '</td><td class="num bold">' + m.qty.toFixed(2) + ' ' + esc(m.unit) + '</td><td class="num">' + fmtU(m.usd) + '</td><td class="num"><button class="btn" onclick="p4EditMat(' + m.idx + ')">✏️</button> <button class="btn btn-danger" onclick="p4DelRow(\'materials\',' + m.idx + ')">✕</button></td></tr>';
      }).join('');
      body = '<div class="form-grid" style="margin-bottom:10px"><div><label>Название</label><input id="sm-nm" class="input"></div><div><label>Кат. <button type="button" class="btn" style="padding:0 4px" onclick="p4QuickAdd(\'dictMatCats\',\'Категория\',\'sm-cat\')">➕</button></label><select id="sm-cat" class="select">' + optDict(e.dictMatCats, '', '') + '</select></div><div><label>Ед. <button type="button" class="btn" style="padding:0 4px" onclick="p4QuickAdd(\'dictUnits\',\'Ед. изм.\',\'sm-un\')">➕</button></label><select id="sm-un" class="select">' + optDict(e.dictUnits, '', '') + '</select></div><div><label>Ост.</label><input id="sm-q" type="number" class="input" value="0"></div><div><label>Сумма $</label><input id="sm-u" type="number" step="0.01" class="input" value="0"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4MatAdd()">+ Сырьё</button></div></div>' +
        '<table><thead><tr><th>Материал</th><th>Кат.</th><th class="num">Остаток</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    } else if (sub === 'inc') {
      const rows = e.matIn.map(function (x, i) {
        return '<tr><td>' + esc(x.date) + '</td><td class="bold">' + esc(x.matName) + '</td><td>' + esc(x.supplier) + '</td><td class="num">' + x.qty + '</td><td class="num bold">' + fmtU(x.totalUsd) + '</td><td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'matIn\',' + i + ')">✕</button></td></tr>';
      }).join('');
      body = '<div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="si-d" type="date" class="input" value="' + today() + '"></div><div><label>Сырьё</label><select id="si-m" class="select">' + optList(matNames, '', '— Сырьё —') + '</select></div><div><label>Поставщик <button type="button" class="btn" style="padding:0 4px" onclick="p4QuickAdd(\'dictSuppliers\',\'Поставщик\',\'si-s\')">➕</button></label><select id="si-s" class="select">' + optDict(e.dictSuppliers, '', '') + '</select></div><div><label>Шт</label><input id="si-q" type="number" class="input"></div><div><label>Цена $</label><input id="si-p" type="number" step="0.01" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4MatInAdd()">+ Приход</button></div></div>' +
        '<table><thead><tr><th>Дата</th><th>Сырьё</th><th>Поставщик</th><th class="num">Шт</th><th class="num">Итого $</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    } else if (sub === 'ord') {
      const oRows = e.orders.map(function (o, i) {
        const b = o.status === 'DONE' ? '<span class="badge badge-green">Готово</span>' : '<button class="btn btn-success" onclick="p4OrderDone(' + i + ')">✅</button>';
        return '<tr><td>' + esc(o.date) + '</td><td class="bold">' + esc(o.product) + '</td><td class="num">' + o.qty + '</td><td class="num">' + fmtU(o.totalUsd) + '</td><td class="num">' + b + ' <button class="btn btn-danger" onclick="p4DelRow(\'orders\',' + i + ')">✕</button></td></tr>';
      }).join('');
      const bRows = e.bom.map(function (b, i) {
        const tot = (b.items || []).reduce(function (s, it) { return s + num(it.norm) * num(it.priceUsd); }, 0);
        return '<tr><td class="bold">' + esc(b.product) + '</td><td>' + (b.items || []).map(function (it) { return esc(it.matName) + ' (' + it.norm + ')'; }).join(', ') + '</td><td class="num bold">' + fmtU(tot) + '</td><td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'bom\',' + i + ')">✕</button></td></tr>';
      }).join('');
      body = '<div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="so-d" type="date" class="input" value="' + today() + '"></div><div><label>Модель</label><select id="so-p" class="select">' + optModels('', '') + '</select></div><div><label>Шт</label><input id="so-q" type="number" class="input"></div><div><label>Коммент</label><input id="so-c" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4OrderAdd()">+ В пошив</button></div></div>' +
        '<table style="margin-bottom:12px"><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>' + oRows + '</tbody></table>' +
        '<div class="form-grid" style="margin-bottom:10px"><div><label>Модель</label><select id="sb-p" class="select">' + optModels('', '') + '</select></div><div><label>Материал</label><select id="sb-m" class="select">' + optList(matNames, '', '— Материал —') + '</select></div><div><label>Норма</label><input id="sb-n" type="number" step="0.01" class="input"></div><div><label>Цена $</label><input id="sb-pr" type="number" step="0.01" class="input"></div><div><button class="btn btn-success" style="width:100%" onclick="p4BomAdd()">+ В техкарту</button></div></div>' +
        '<table><thead><tr><th>Модель</th><th>Состав</th><th class="num">Себест. $</th><th></th></tr></thead><tbody>' + bRows + '</tbody></table>';
    } else {
      const fRows = e.fgStocks.map(function (f, i) {
        return '<tr><td>' + esc(f.month) + '</td><td class="bold">' + esc(f.product) + '</td><td class="num">' + f.ruQty + '/' + f.tmQty + '/' + f.wayQty + '</td><td class="num bold">' + fmtU(f.lockedUsd) + '</td><td class="num"><button class="btn" onclick="p4EditFg(' + i + ')">✏️</button> <button class="btn btn-danger" onclick="p4DelRow(\'fgStocks\',' + i + ')">✕</button></td></tr>';
      }).join('');
      const dRows = e.defects.map(function (d, i) {
        return '<tr><td>' + esc(d.date) + '</td><td class="bold">' + esc(d.product) + '</td><td class="num">' + d.qty + '</td><td class="num text-red">' + fmtU(num(d.qty) * num(d.unitUsd)) + '</td><td>' + esc(d.reason) + '</td><td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'defects\',' + i + ')">✕</button></td></tr>';
      }).join('');
      body = '<div class="form-grid" style="margin-bottom:10px"><div><label>Мес</label><input id="sf-m" type="month" class="input" value="' + today().slice(0, 7) + '"></div><div><label>Модель</label><select id="sf-p" class="select">' + optModels('', '') + '</select></div><div><label>РФ</label><input id="sf-ru" type="number" class="input" value="0"></div><div><label>ТМ</label><input id="sf-tm" type="number" class="input" value="0"></div><div><label>Путь</label><input id="sf-way" type="number" class="input" value="0"></div><div><label>Цена $</label><input id="sf-u" type="number" step="0.01" class="input" value="0"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4FgAdd()">+ Остаток</button></div></div>' +
        '<table style="margin-bottom:12px"><thead><tr><th>Мес</th><th>Модель</th><th class="num">РФ/ТМ/Путь</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>' + fRows + '</tbody></table>' +
        '<div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="sd-d" type="date" class="input" value="' + today() + '"></div><div><label>Модель</label><select id="sd-p" class="select">' + optModels('', '') + '</select></div><div><label>Брак</label><input id="sd-q" type="number" class="input"></div><div><label>Цена $</label><input id="sd-u" type="number" step="0.01" class="input"></div><div><label>Причина</label><input id="sd-r" class="input"></div><div><button class="btn btn-danger" style="width:100%;padding:7px" onclick="p4DefAdd()">+ Брак</button></div></div>' +
        '<table><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт</th><th class="num">Убыток $</th><th>Причина</th><th></th></tr></thead><tbody>' + dRows + '</tbody></table>';
    }
    sec.innerHTML = '<div class="card"><div class="card-header"><div class="card-title">🏭 Запасы, Брак и Фурнитура</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + nav + '</div>' + body + '</div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Модуль 5А: Налоги целиком за месяц, Долги 01.01 и ЗПВ) === */
  window.p4TaxFullMonth = function () {
    const amtEl = document.getElementById('tx-amt');
    if (!amtEl) return;
    const sum = num(amtEl.value);
    if (sum <= 0) return alert('Введите сумму налога!');
    const m = parseInt(prompt('Месяц (1–12), куда записать налог целиком:', '11'), 10);
    if (!(m >= 1 && m <= 12)) return alert('Укажите число от 1 до 12!');
    const mo = (m < 10 ? '0' : '') + m, yr = (document.getElementById('tx-yr') || {}).value || '2026', per = yr + '-' + mo;
    if (window.db && window.db.locked && window.db.locked[per]) return alert('Месяц закрыт!');
    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    window.db.taxes.unshift({ id: 'tx_' + Date.now(), per: per, yr: yr, q: 'Мес.' + mo, org: (document.getElementById('tx-org') || {}).value || getActiveOrgs(), typ: (document.getElementById('tx-typ') || {}).value || 'УСН', qSum: sum, mSum: sum });
    amtEl.value = ''; pSave(); if (typeof window.render === 'function') window.render();
  };

  window.p4TdAdd = function () { ensureStore().taxDebts.unshift({ org: document.getElementById('td-o').value, tax: document.getElementById('td-t').value, debt: num(document.getElementById('td-a').value) }); pSave(); enhanceExpTab(); };
  window.p4TdEdit = function (i) { const t = ensureStore().taxDebts[i]; if (!t) return; const v = prompt('Новое сальдо 01.01:', t.debt); if (v !== null) { t.debt = num(v); pSave(); enhanceExpTab(); } };

  window.p4ZpAdd = function () {
    const e = ensureStore(), emp = document.getElementById('zp-e').value, amt = num(document.getElementById('zp-a').value);
    if (!emp || amt <= 0) return alert('Выберите сотрудника и сумму!');
    const st = e.staffList.find(function (x) { return x.name === emp; });
    e.payrollOps.unshift({ date: document.getElementById('zp-d').value || today(), emp: emp, kind: document.getElementById('zp-k').value, amt: amt, cur: st ? st.cur : 'RUB' });
    pSave(); enhanceExpTab();
  };

  function enhanceExpTab() {
    const sec = document.getElementById('tab-exp');
    if (!sec) return;
    const e = ensureStore(), txTyp = document.getElementById('tx-typ'), txAmt = document.getElementById('tx-amt');
    if (txTyp && txTyp.dataset.p4 !== '1') { txTyp.innerHTML = optDict(e.dictTaxTypes, txTyp.value, ''); txTyp.dataset.p4 = '1'; }
    if (txAmt && !document.getElementById('p4-tx-btn')) {
      const b = document.createElement('button'); b.id = 'p4-tx-btn'; b.type = 'button'; b.className = 'btn btn-success'; b.style.marginTop = '6px';
      b.textContent = '✅ Целиком за месяц'; b.onclick = window.p4TaxFullMonth; txAmt.parentNode.appendChild(b);
    }
    let box = document.getElementById('p4-exp-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-exp-box'; sec.appendChild(box); }
    const tdRows = e.taxDebts.map(function (t, i) {
      return '<tr><td>' + esc(t.org) + '</td><td>' + esc(t.tax) + '</td><td class="num bold">' + fmtR(t.debt) + '</td><td class="num"><button class="btn" onclick="p4TdEdit(' + i + ')">✏️</button> <button class="btn btn-danger" onclick="p4DelRow(\'taxDebts\',' + i + ')">✕</button></td></tr>';
    }).join('');
    const stAct = e.staffList.filter(function (s) { return !s.arch; });
    const zpRows = stAct.map(function (s) {
      let bal = num(s.initDebt);
      e.payrollOps.forEach(function (op) { if (op.emp === s.name) bal += (op.kind === 'Начислено' ? num(op.amt) : -num(op.amt)); });
      return '<tr><td class="bold">' + esc(s.name) + '</td><td>' + esc(s.role) + '</td><td class="num">' + num(s.initDebt) + ' ' + esc(s.cur) + '</td><td class="num bold">' + bal + ' ' + esc(s.cur) + '</td></tr>';
    }).join('');
    box.innerHTML = '<div class="card"><div class="card-header"><div class="card-title">🏛️ Входящие налоговые долги / переплаты на 01.01</div></div>' +
      '<div class="form-grid" style="margin-bottom:10px"><div><label>Юрлицо</label><select id="td-o" class="select">' + optList(getActiveOrgs(), '', '') + '</select></div><div><label>Налог</label><select id="td-t" class="select">' + optDict(e.dictTaxTypes, '', '') + '</select></div><div><label>Сальдо ₽</label><input id="td-a" type="number" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4TdAdd()">+ Записать</button></div></div>' +
      '<table><thead><tr><th>Юрлицо</th><th>Налог</th><th class="num">Сальдо 01.01</th><th></th></tr></thead><tbody>' + tdRows + '</tbody></table></div>' +
      '<div class="card"><div class="card-header"><div class="card-title">👥 Зарплатная ведомость SKOS (ЗПВ)</div></div>' +
      '<div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="zp-d" type="date" class="input" value="' + today() + '"></div><div><label>Сотрудник</label><select id="zp-e" class="select">' + optList(stAct.map(function (x) { return x.name; }), '', '— Сотрудник —') + '</select></div><div><label>Операция</label><select id="zp-k" class="select"><option>Начислено</option><option>Выплачено</option></select></div><div><label>Сумма</label><input id="zp-a" type="number" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4ZpAdd()">+ Провести</button></div></div>' +
      '<table><thead><tr><th>Сотрудник</th><th>Должность</th><th class="num">Долг 01.01</th><th class="num">Остаток</th></tr></thead><tbody>' + zpRows + '</tbody></table></div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Модуль 5Б: Контрагенты/ОС, Баланс и запуск) === */
  window.p4CtrAdd = function () {
    const e = ensureStore(), ctr = document.getElementById('ct-s').value, amt = num(document.getElementById('ct-a').value);
    if (!ctr || amt <= 0) return alert('Выберите контрагента и сумму!');
    const info = e.contractors.find(function (c) { return c.name === ctr; });
    e.contractorOps.unshift({ date: document.getElementById('ct-d').value || today(), ctr: ctr, kind: document.getElementById('ct-k').value, amt: amt, cur: info ? info.cur : 'RUB' });
    pSave(); enhanceSupTab();
  };

  window.p4OsAdd = function () {
    const e = ensureStore(), nm = document.getElementById('os-n').value.trim(), pr = num(document.getElementById('os-p').value);
    if (!nm || pr <= 0) return alert('Введите название и цену ОС!');
    e.osList.unshift({ name: nm, qty: num(document.getElementById('os-q').value) || 1, price: pr, months: num(document.getElementById('os-m').value) || 36, passed: num(document.getElementById('os-ps').value) || 0, room: document.getElementById('os-r').value.trim() });
    pSave(); enhanceSupTab();
  };

  window.p4OsEdit = function (i) { const o = ensureStore().osList[i]; if (!o) return; const p = prompt('Прошло месяцев амортизации:', o.passed || 0); if (p !== null) { o.passed = num(p); pSave(); enhanceSupTab(); } };

  function enhanceSupTab() {
    const sec = document.getElementById('tab-sup');
    if (!sec) return;
    const e = ensureStore();
    let box = document.getElementById('p4-sup-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-sup-box'; sec.insertBefore(box, sec.firstChild); }
    const cAct = e.contractors.filter(function (c) { return !c.arch; });
    const cRows = cAct.map(function (c) {
      let acc = 0, pay = 0;
      e.contractorOps.forEach(function (op) { if (op.ctr === c.name) { if (op.kind === 'Начислено') acc += num(op.amt); else pay += num(op.amt); } });
      const end = num(c.initDebt) + acc - pay;
      return '<tr><td class="bold">' + esc(c.name) + '</td><td>' + esc(c.art) + '</td><td class="num">' + num(c.initDebt) + '</td><td class="num">' + acc + '</td><td class="num">' + pay + '</td><td class="num bold ' + (end > 0 ? 'text-red' : 'text-green') + '">' + end + ' ' + esc(c.cur) + '</td></tr>';
    }).join('');
    const oRows = e.osList.map(function (o, i) {
      const full = num(o.qty || 1) * num(o.price), m = Math.max(1, num(o.months) || 24), rem = Math.max(0, full - (full / m) * Math.min(m, num(o.passed)));
      return '<tr><td class="bold">' + esc(o.name) + '</td><td class="num">' + fmtR(full) + '</td><td class="num">' + o.passed + '/' + m + '</td><td class="num bold">' + fmtR(rem) + '</td><td class="num"><button class="btn" onclick="p4OsEdit(' + i + ')">✏️</button> <button class="btn btn-danger" onclick="p4DelRow(\'osList\',' + i + ')">✕</button></td></tr>';
    }).join('');
    box.innerHTML = '<div class="card"><div class="card-header"><div class="card-title">🤝 Контрагенты SKOS (Сальдо 01.01 + Начислено − Выплачено)</div></div>' +
      '<div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="ct-d" type="date" class="input" value="' + today() + '"></div><div><label>Контрагент</label><select id="ct-s" class="select">' + optList(cAct.map(function (x) { return x.name; }), '', '— Контрагент —') + '</select></div><div><label>Тип</label><select id="ct-k" class="select"><option>Начислено</option><option>Выплачено</option></select></div><div><label>Сумма</label><input id="ct-a" type="number" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4CtrAdd()">+ Записать</button></div></div>' +
      '<table><thead><tr><th>Контрагент</th><th>Статья</th><th class="num">Нач.</th><th class="num">Начисл.</th><th class="num">Выплач.</th><th class="num">Остаток</th></tr></thead><tbody>' + cRows + '</tbody></table></div>' +
      '<div class="card"><div class="card-header"><div class="card-title">🖥️ Основные средства (ОС) и Амортизация</div></div>' +
      '<div class="form-grid" style="margin-bottom:10px"><div><label>Название</label><input id="os-n" class="input"></div><div><label>Шт</label><input id="os-q" type="number" class="input" value="1"></div><div><label>Цена ₽</label><input id="os-p" type="number" class="input"></div><div><label>Срок мес</label><input id="os-m" type="number" class="input" value="36"></div><div><label>Прошло</label><input id="os-ps" type="number" class="input" value="0"></div><div><label>Где</label><input id="os-r" class="input" value="Цех"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4OsAdd()">+ ОС</button></div></div>' +
      '<table><thead><tr><th>Объект</th><th class="num">Сумма ₽</th><th class="num">Срок</th><th class="num">Остаточная ₽</th><th></th></tr></thead><tbody>' + oRows + '</tbody></table></div>';
  }

  function renderDashBalance() {
    const sec = document.getElementById('tab-dash');
    if (!sec) return;
    const e = ensureStore(), rate = rateNow(), st = calcStockStats(e);
    const elF = document.getElementById('k-frz'); if (elF) elF.textContent = fmtR(st.totalUsd * rate);
    let cash = 0, osRem = 0;
    const ib = (window.db && window.db.initBalances) || {};
    Object.keys(ib).forEach(function (k) { cash += num(ib[k]) * (/c[3-6]/.test(k) ? rate : 1); });
    (window.db && window.db.dds || []).forEach(function (d) { cash += (d.type === 'OUT' ? -1 : 1) * num(d.amt) * (d.cur === 'USD' ? rate : 1); });
    e.osList.forEach(function (o) { const full = num(o.qty || 1) * num(o.price), m = Math.max(1, num(o.months) || 24); osRem += Math.max(0, full - (full / m) * Math.min(m, num(o.passed))); });
    const taxD = e.taxDebts.reduce(function (s, t) { return s + num(t.debt); }, 0);
    const eq = cash + st.totalUsd * rate + osRem - taxD;
    let card = document.getElementById('p4-bal');
    if (!card) { card = document.createElement('div'); card.id = 'p4-bal'; card.className = 'card'; sec.appendChild(card); }
    card.innerHTML = '<div class="card-header"><div class="card-title">⚖️ Управленческий БАЛАНС SKOS</div></div><div class="kpi-grid">' +
      '<div class="kpi-card"><div>💰 Деньги</div><div class="kpi-val">' + fmtR(cash) + '</div></div>' +
      '<div class="kpi-card"><div>🏭 Запасы</div><div class="kpi-val">' + fmtR(st.totalUsd * rate) + '</div></div>' +
      '<div class="kpi-card"><div>🖥️ ОС ост.</div><div class="kpi-val">' + fmtR(osRem) + '</div></div>' +
      '<div class="kpi-card"><div>🏛️ Налог. долг</div><div class="kpi-val text-red">− ' + fmtR(taxD) + '</div></div>' +
      '<div class="kpi-card highlight"><div>💎 КАПИТАЛ</div><div class="kpi-val ' + (eq >= 0 ? 'text-green' : 'text-red') + '">' + fmtR(eq) + '</div></div></div>';
  }

  function renderActiveOnly() {
    ensureStore(); ensureDictNav();
    const cur = (window.db && window.db.tab) || 'dash';
    if (cur === 'dash') renderDashBalance();
    else if (cur === 'abc') enhanceAbcPerUnit();
    else if (cur === 'stk') renderStkTab();
    else if (cur === 'exp') enhanceExpTab();
    else if (cur === 'sup') enhanceSupTab();
    else if (cur === 'dict') renderDictTab();
    if (cur === 'dict') syncTabState('dict');
  }

  const _origRender = window.render;
  window.render = function () {
    if (typeof _origRender === 'function') _origRender.apply(this, arguments);
    renderActiveOnly();
  };

  setTimeout(renderActiveOnly, 80);
  /* === SKOS Finance 3.0 — patch4.js (Модуль 6: Статьи ОПиУ в справочнике и мгновенный отклик вкладок) === */
  function ensureOpiuDict(e) {
    if (!Array.isArray(e.dictOpiuArticles) || !e.dictOpiuArticles.length) {
      e.dictOpiuArticles = [
        { name: 'Аренда склада', arch: false },
        { name: 'Программное обеспечение', arch: false },
        { name: 'Административные и юридические услуги', arch: false },
        { name: 'Федеральная таможенная служба', arch: false },
        { name: 'Закуп товара / сырья USD', arch: false },
        { name: 'Общепроизводственные расходы', arch: false },
        { name: 'ФОТ и персонал', arch: false }
      ];
    }
    return e.dictOpiuArticles;
  }

  const _prevDictTab = renderDictTab;
  renderDictTab = function () {
    const e = ensureStore();
    ensureOpiuDict(e);
    _prevDictTab();
    const sec = document.getElementById('tab-dict');
    if (!sec) return;
    const bar = sec.querySelector('div[style*="flex-wrap:wrap"]');
    if (bar && !document.getElementById('p4-btn-opiu')) {
      const b = document.createElement('button');
      b.id = 'p4-btn-opiu';
      b.className = 'btn ' + (e.dictSub === 'opiu' ? 'btn-primary' : '');
      b.textContent = '📊 Статьи ОПиУ (' + e.dictOpiuArticles.length + ')';
      b.onclick = function () { window.p4DictSub('opiu'); };
      bar.insertBefore(b, bar.firstChild);
    }
    if (e.dictSub === 'opiu') {
      const rows = e.dictOpiuArticles.map(function (it, i) {
        return '<tr style="' + (it.arch ? 'opacity:0.55;' : '') + '"><td class="bold">' + esc(it.name) + '</td><td>Статья ОПиУ</td>' +
          '<td class="num"><button class="btn" onclick="p4DictEdit(\'dictOpiuArticles\',' + i + ')">✏️</button> ' +
          '<button class="btn" onclick="p4DictArch(\'dictOpiuArticles\',' + i + ')">' + (it.arch ? '📤' : '📦') + '</button> ' +
          '<button class="btn btn-danger" onclick="p4DictDel(\'dictOpiuArticles\',' + i + ')">✕</button></td></tr>';
      }).join('');
      const card = sec.querySelector('.card');
      if (card) {
        const oldG = card.querySelector('.form-grid');
        const oldT = card.querySelector('table');
        if (oldG) oldG.innerHTML = '<div><label>Новая статья ОПиУ</label><input id="d-nm" class="input" placeholder="Например: Логистика РФ"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4DictAdd(\'dictOpiuArticles\')">+ Добавить</button></div>';
        if (oldT) oldT.querySelector('tbody').innerHTML = rows || '<tr><td colspan="3">Пусто</td></tr>';
      }
    } else if (e.dictSub === 'ctrs') {
      const artSel = document.getElementById('d-art');
      if (artSel) {
        artSel.innerHTML = optDict(e.dictOpiuArticles, artSel.value, '');
        const lbl = artSel.parentNode.querySelector('label');
        if (lbl && !lbl.querySelector('button')) {
          lbl.innerHTML = 'Статья ОПиУ <button type="button" class="btn" style="padding:0 5px" onclick="p4QuickAdd(\'dictOpiuArticles\',\'Статья ОПиУ\',\'d-art\')">➕</button>';
        }
      }
    }
  };

  document.addEventListener('click', function (ev) {
    const btn = ev.target && ev.target.closest('.nav-btn');
    if (btn && btn.id && btn.id.indexOf('nav-') === 0) {
      const id = btn.id.slice(4);
      if (window.db) window.db.tab = id;
      setTimeout(renderActiveOnly, 25);
    }
  });
  /* === SKOS Finance 3.0 — patch4.js (Модуль 7: Фикс подвкладок Запасов и видимости ДДС) === */
  const _origStkSub = window.p4StkSub;
  window.p4StkSub = function (sub) {
    const clean = String(sub || 'sum').split(',')[0].trim();
    if (typeof _origStkSub === 'function') _origStkSub(clean);
  };

  const _origStkRender = renderStkTab;
  renderStkTab = function () {
    _origStkRender();
    const sec = document.getElementById('tab-stk');
    if (!sec) return;
    const sub = ensureStore().stkSub || 'sum';
    const btns = sec.querySelectorAll('div[style*="flex-wrap:wrap"] button');
    const labels = [
      ['sum', '📊 Свод'],
      ['mat', '🧵 Материалы'],
      ['inc', '📥 Приход'],
      ['ord', '✂️ Пошив/Техкарты'],
      ['fg', '📦 ГП и Брак']
    ];
    for (let i = 0; i < btns.length && i < labels.length; i++) {
      const key = labels[i][0];
      const title = labels[i][1];
      btns[i].textContent = title;
      btns[i].className = 'btn ' + (key === sub ? 'btn-primary' : '');
      btns[i].onclick = function () { window.p4StkSub(key); };
    }
  };

  document.addEventListener('click', function (ev) {
    const btn = ev.target && ev.target.closest('.nav-btn');
    if (!btn || !btn.id || btn.id.indexOf('nav-') !== 0) return;
    const id = btn.id.slice(4);
    if (id !== 'dict') {
      const dSec = document.getElementById('tab-dict');
      if (dSec) { dSec.classList.add('hidden'); dSec.style.display = 'none'; }
      const dNav = document.getElementById('nav-dict');
      if (dNav) dNav.classList.remove('active');
      const curSec = document.getElementById('tab-' + id);
      if (curSec) { curSec.classList.remove('hidden'); curSec.style.display = ''; }
    }
  }, true);
  /* === Защита заголовком x-skos-pin для Supabase === */
  const _origFetch = window.fetch;
  window.fetch = function (url, opts) {
    if (typeof url === 'string' && url.indexOf('supabase.co') >= 0) {
      opts = opts || {};
      const h = new Headers(opts.headers || {});
      const pin = (window.db && window.db.cloud && window.db.cloud.pin) || 'Skos#9482!Tm';
      h.set('x-skos-pin', pin);
      opts.headers = h;
    }
    return _origFetch.call(this, url, opts);
  };
  /* === Проверка и уведомление при синхронизации с Supabase === */
  const _origSyncCloud = window.syncCloud;
  window.syncCloud = async function (showAlert) {
    const uEl = document.getElementById('sb-url');
    const kEl = document.getElementById('sb-key');
    const pEl = document.getElementById('sb-pin');
    if (window.db && window.db.cloud) {
      if (uEl && uEl.value.trim()) window.db.cloud.url = uEl.value.trim();
      if (kEl && kEl.value.trim()) window.db.cloud.key = kEl.value.trim();
      if (pEl && pEl.value.trim()) window.db.cloud.pin = pEl.value.trim();
      pSave();
    }
    if (typeof _origSyncCloud === 'function') {
      try {
        await _origSyncCloud(true);
      } catch (err) {
        alert('Ошибка облака: ' + (err && err.message ? err.message : err));
      }
    }
  };
  /* === Масштабируемая синхронизация: финансы (main) + ШК пачками по 10 000 (skus_0, skus_1...) === */
  window.p4ForceCloudSync = async function (withSkus) {
    const url = ((document.getElementById('sb-url') || {}).value || (window.db && window.db.cloud && window.db.cloud.url) || '').trim().replace(/\/$/, '');
    const key = ((document.getElementById('sb-key') || {}).value || (window.db && window.db.cloud && window.db.cloud.key) || '').trim();
    const pin = ((document.getElementById('sb-pin') || {}).value || (window.db && window.db.cloud && window.db.cloud.pin) || '').trim();
    if (!url || !key) return alert('Вставьте Project URL и Anon Public Key!');
    if (window.db) { window.db.cloud = { url: url, key: key, pin: pin }; pSave(); }

    const hdrs = {
      'apikey': key, 'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal,resolution=merge-duplicates',
      'x-skos-pin': pin
    };
    const allSkus = Array.isArray(window.db.skus) ? window.db.skus : [];
    const chunks = Math.max(1, Math.ceil(allSkus.length / 10000));
    const finDb = Object.assign({}, window.db, { skus: [], skusChunks: chunks, skusTotal: allSkus.length });

    try {
      const rMain = await fetch(url + '/rest/v1/skos_cloud?on_conflict=id', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify([{ id: 'main', payload: finDb, updated_at: new Date().toISOString() }])
      });
      if (!rMain.ok) return alert('Ошибка сохранения финансов (' + rMain.status + ')');

      if (withSkus) {
        for (let c = 0; c < chunks; c++) {
          const part = allSkus.slice(c * 10000, (c + 1) * 10000).map(function (s) {
            return { n: s.name, a: s.art, c: s.col, z: s.siz, b: s.bc, u: s.usd };
          });
          const rSku = await fetch(url + '/rest/v1/skos_cloud?on_conflict=id', {
            method: 'POST', headers: hdrs,
            body: JSON.stringify([{ id: 'skus_' + c, payload: part, updated_at: new Date().toISOString() }])
          });
          if (!rSku.ok) return alert('Ошибка пачки ШК #' + c + ' (' + rSku.status + ')');
        }
        alert('✅ Финансы и база ШК (' + allSkus.length + ' шт, пачек: ' + chunks + ') сохранены в облако!');
      } else {
        alert('✅ Финансы, отчёты и справочники мгновенно сохранены в облако!');
      }
    } catch (e) {
      alert('❌ Ошибка сети: ' + e.message);
    }
  };

  setTimeout(function () {
    const btn = Array.from(document.querySelectorAll('button')).find(function (b) {
      return b.textContent.indexOf('Сохранить и синхронизировать') >= 0;
    });
    if (btn && !document.getElementById('p4-sync-skus-btn')) {
      btn.onclick = function () { window.p4ForceCloudSync(false); };
      const b2 = document.createElement('button');
      b2.id = 'p4-sync-skus-btn'; b2.type = 'button'; b2.className = 'btn btn-primary'; b2.style.marginLeft = '6px';
      b2.textContent = '🏷️ Синхр. базу ШК (пачками)';
      b2.onclick = function () { window.p4ForceCloudSync(true); };
      btn.insertAdjacentElement('afterend', b2);
          const topCloudBtn = Array.from(document.querySelectorAll('.topbar button')).find(function (b) {
      return b.textContent.indexOf('Облако') >= 0;
    });
    if (topCloudBtn) topCloudBtn.onclick = function () { window.p4ForceCloudSync(false); };
    }
  }, 400);
})();
