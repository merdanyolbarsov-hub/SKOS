/* === SKOS Finance 3.0 — patch4.js (Часть 1: Ядро, хранилище и кэш моделей) === */
(function () {
  'use strict';

  if (window.__skosPatch4V2) return;
  window.__skosPatch4V2 = true;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(v) {
    const n = parseFloat(String(v == null ? 0 : v).replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function pSave() {
    try {
      if (typeof window.save === 'function') window.save();
      else if (window.db) localStorage.setItem('skos_v3_prod', JSON.stringify(window.db));
    } catch (e) {
      console.error('SKOS save error:', e);
    }
  }

  function rateNow() {
    if (typeof window.getRate === 'function') return num(window.getRate()) || 96.5;
    return 96.5;
  }

  function ensureStore() {
    if (!window.db || typeof window.db !== 'object') window.db = {};
    if (!window.db.erp || typeof window.db.erp !== 'object') window.db.erp = {};
    const e = window.db.erp;

    const lists = [
      'materials', 'matIn', 'orders', 'bom', 'fgStocks', 'defects',
      'unitEcon', 'osList', 'contractors', 'contractorOps',
      'staffList', 'payrollOps', 'taxDebts'
    ];
    for (let i = 0; i < lists.length; i++) {
      if (!Array.isArray(e[lists[i]])) e[lists[i]] = [];
    }

    if (!Array.isArray(e.dictMatCats) || !e.dictMatCats.length) {
      e.dictMatCats = [
        { name: 'Ткань', arch: false },
        { name: 'Фурнитура', arch: false },
        { name: 'Упаковка и бирки', arch: false },
        { name: 'Нитки и клеевые', arch: false }
      ];
    }
    if (!Array.isArray(e.dictUnits) || !e.dictUnits.length) {
      e.dictUnits = [
        { name: 'м2', arch: false },
        { name: 'кг', arch: false },
        { name: 'м', arch: false },
        { name: 'шт', arch: false },
        { name: 'рулон', arch: false }
      ];
    }
    if (!Array.isArray(e.dictSuppliers) || !e.dictSuppliers.length) {
      e.dictSuppliers = [
        { name: 'Турция', arch: false },
        { name: 'Китай', arch: false },
        { name: 'РФ', arch: false },
        { name: 'Туркменистан', arch: false }
      ];
    }
    if (!Array.isArray(e.dictTaxTypes) || !e.dictTaxTypes.length) {
      e.dictTaxTypes = [
        { name: 'АУСН', arch: false },
        { name: 'УСН', arch: false },
        { name: 'НДС', arch: false },
        { name: 'ЕНП', arch: false },
        { name: 'Взносы ИП', arch: false },
        { name: 'Патент', arch: false }
      ];
    }
    if (!Array.isArray(e.ddsArticles) || !e.ddsArticles.length) {
      e.ddsArticles = [
        { name: 'Поступление от ВБ', dir: 'in', opiu: 'Учёт сделок (не дубл.)', arch: false },
        { name: 'Поступление от Озон', dir: 'in', opiu: 'Учёт сделок (не дубл.)', arch: false },
        { name: 'Закуп товара / сырья USD', dir: 'out', opiu: 'Учёт запасов (не дубл.)', arch: false },
        { name: 'Аренда склада', dir: 'out', opiu: 'Аренда и склад', arch: false },
        { name: '1С и сервисы', dir: 'out', opiu: 'Административные', arch: false },
        { name: 'Таможня и сборы', dir: 'out', opiu: 'Общепроизводственные', arch: false },
        { name: 'Налоги и взносы', dir: 'out', opiu: 'Учёт налогов (не дубл.)', arch: false },
        { name: 'Перевод / Конвертация валют', dir: 'move', opiu: 'Нет в ОПиУ', arch: false }
      ];
    }
    if (!e.stkSub) e.stkSub = 'sum';
    if (!e.ueView) e.ueView = 'fact';
    if (!e.ueFilter) e.ueFilter = { mp: 'ALL', org: 'ALL', mo: 'ALL', q: '' };
    if (!e.dictSub) e.dictSub = 'cats';
    return e;
  }

  let _mCache = null;
  let _mKey = '';

  function getModelsList(force) {
    const e = ensureStore();
    const skLen = (window.db && Array.isArray(window.db.skus)) ? window.db.skus.length : 0;
    const slLen = (window.db && Array.isArray(window.db.itemSales)) ? window.db.itemSales.length : 0;
    const key = skLen + '_' + e.bom.length + '_' + slLen;
    if (!force && _mCache && _mKey === key) return _mCache;

    let fNames = {};
    try { fNames = JSON.parse(localStorage.getItem('skos_v3_folder_names') || '{}'); } catch (err) {}

    const map = new Map();
    const put = function (rawName, usdVal, hasBom) {
      const nm = String(rawName || '').trim();
      if (!nm || nm.length < 2) return;
      const k = nm.toLowerCase();
      const prev = map.get(k) || { name: nm, usd: 0, hasBom: false };
      map.set(k, {
        name: prev.name,
        usd: num(usdVal) > 0 ? num(usdVal) : prev.usd,
        hasBom: Boolean(hasBom || prev.hasBom)
      });
    };

    Object.keys(fNames).forEach(function (art) {
      put(fNames[art] || art, 0, false);
    });

    const skus = (window.db && Array.isArray(window.db.skus)) ? window.db.skus : [];
    for (let i = 0; i < skus.length; i++) {
      const s = skus[i];
      if (!s) continue;
      const art = String(s.art || '').trim();
      const title = fNames[art] || s.folder || s.name || art;
      put(title, s.usd, false);
    }

    for (let i = 0; i < e.bom.length; i++) {
      const b = e.bom[i];
      if (!b || !b.product) continue;
      let u = 0;
      const items = Array.isArray(b.items) ? b.items : [];
      for (let j = 0; j < items.length; j++) {
        u += num(items[j].norm) * num(items[j].priceUsd);
      }
      put(b.product, u, true);
    }

    const sales = (window.db && Array.isArray(window.db.itemSales)) ? window.db.itemSales : [];
    for (let i = 0; i < sales.length; i++) {
      const sl = sales[i];
      if (!sl) continue;
      put(sl.model || sl.name, sl.usd, false);
    }

    _mCache = Array.from(map.values()).sort(function (a, b) {
      return a.name.localeCompare(b.name, 'ru');
    });
    _mKey = key;
    return _mCache;
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 2: Списки, быстрое добавление и стартовая база SKOS) === */
  function getActiveOrgs() {
    const out = [];
    const seen = new Set();
    const orgs = (window.db && Array.isArray(window.db.orgs)) ? window.db.orgs : [];
    for (let i = 0; i < orgs.length; i++) {
      const o = orgs[i];
      if (!o || !o.name || o.archived || o.hidden) continue;
      const nm = String(o.name).trim();
      if (!seen.has(nm)) {
        seen.add(nm);
        out.push(nm);
      }
    }
    if (out.length) return out;
    return [
      'ИП Каримов Артем',
      'ИП Джуманиязова Мавлюда',
      'ИП Джуманиязова Эльмира',
      'ИП Тыррыков Курбан',
      'ИП Керимов Сахет',
      'ООО «Скос»'
    ];
  }

  function optList(arr, sel, emptyLabel) {
    let h = emptyLabel ? '<option value="">' + esc(emptyLabel) + '</option>' : '';
    for (let i = 0; i < arr.length; i++) {
      const v = String(arr[i]);
      h += '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>';
    }
    return h;
  }

  function optDict(dictArr, sel, emptyLabel) {
    const active = (Array.isArray(dictArr) ? dictArr : [])
      .filter(function (x) { return x && !x.arch; })
      .map(function (x) { return x.name; });
    return optList(active, sel, emptyLabel);
  }

  function optModels(sel, emptyLabel) {
    const models = getModelsList(false).map(function (m) { return m.name; });
    return optList(models, sel, emptyLabel || '— Выберите модель —');
  }

  window.p4QuickAdd = function (dictKey, title, targetSelId) {
    const val = prompt('Добавить в справочник «' + title + '»:');
    if (!val || !val.trim()) return;
    const e = ensureStore();
    const nm = val.trim();
    if (!Array.isArray(e[dictKey])) e[dictKey] = [];
    const exists = e[dictKey].find(function (x) { return x.name.toLowerCase() === nm.toLowerCase(); });
    if (exists) {
      exists.arch = false;
    } else {
      e[dictKey].unshift({ name: nm, arch: false });
    }
    pSave();
    if (typeof window.render === 'function') window.render();
    if (targetSelId) {
      setTimeout(function () {
        const el = document.getElementById(targetSelId);
        if (el) el.value = nm;
      }, 30);
    }
  };

  window.p4SeedSkos = function () {
    if (!confirm('Загрузить стартовую базу SKOS (материалы, техкарты, 25 ОС, 11 контрагентов, 12 сотрудников, налоговые долги)?\nВаши текущие данные не затрутся.')) return;
    const e = ensureStore();

    const mats = [
      ['Ткань лён', 'м2', 'Ткань', 120, 240], ['Ткань флис', 'кг', 'Ткань', 180, 720],
      ['Ткань жаты', 'м2', 'Ткань', 250, 250], ['Ткань брюк', 'м2', 'Ткань', 150, 397.5],
      ['Ткань габардин', 'м2', 'Ткань', 90, 177.3], ['Пуговица для брюк', 'шт', 'Фурнитура', 5000, 50],
      ['Пуговица рубашек', 'шт', 'Фурнитура', 8000, 32], ['Замок для брюк', 'шт', 'Фурнитура', 2000, 40],
      ['Крючок', 'шт', 'Фурнитура', 2000, 40], ['Карсаж', 'м', 'Фурнитура', 500, 100],
      ['Ичлик', 'м', 'Фурнитура', 400, 156], ['Клеевой дублерин', 'м', 'Фурнитура', 600, 60],
      ['Резинка 5см', 'м', 'Фурнитура', 800, 64], ['Тканевая этикетка', 'шт', 'Упаковка и бирки', 5000, 50],
      ['Боковая этикетка', 'шт', 'Упаковка и бирки', 5000, 400], ['Висячая этикетка', 'шт', 'Упаковка и бирки', 5000, 50],
      ['Размерная этикетка', 'шт', 'Упаковка и бирки', 5000, 15], ['Пакет БОПП 5', 'шт', 'Упаковка и бирки', 4000, 240],
      ['Пакет БОПП 10', 'шт', 'Упаковка и бирки', 3000, 210], ['Нитки швейные', 'рулон', 'Нитки и клеевые', 150, 90]
    ];
    mats.forEach(function (m) {
      if (!e.materials.some(function (x) { return x.name === m[0]; })) {
        e.materials.push({ name: m[0], unit: m[1], cat: m[2], initQty: m[3], initUsd: m[4] });
      }
    });

    if (!e.bom.some(function (b) { return b.product === 'Брюки мужские зауженные'; })) {
      e.bom.push({
        product: 'Брюки мужские зауженные',
        items: [
          { matName: 'Ткань брюк', norm: 1.25, priceUsd: 2.65 },
          { matName: 'Карсаж', norm: 1.1, priceUsd: 0.20 },
          { matName: 'Ичлик', norm: 0.35, priceUsd: 0.39 },
          { matName: 'Боковая этикетка', norm: 1, priceUsd: 0.08 },
          { matName: 'Пакет БОПП 10', norm: 1, priceUsd: 0.07 }
        ]
      });
    }

    for (let i = 1; i <= 25; i++) {
      const osName = i <= 15 ? 'Швейная машина прямострочная #' + i : (i <= 20 ? 'Оверлок 4-ниточный #' + (i - 15) : 'Раскройный стол / Парогенератор #' + (i - 20));
      if (!e.osList.some(function (x) { return x.name === osName; })) {
        e.osList.push({ name: osName, qty: 1, price: i <= 20 ? 45000 : 65000, months: 36, passed: 6, resp: 'Касым', room: 'Цех ТМ' });
      }
    }

    const ctrs = [
      ['Ткани Стамбул (Турция)', 'Закуп товара / сырья USD', 'USD', 0],
      ['Фурнитура Гуанчжоу (Китай)', 'Закуп товара / сырья USD', 'USD', 0],
      ['Карго ТМ — Москва', 'Таможня и сборы', 'USD', 0],
      ['Склад Москва (Аренда)', 'Аренда склада', 'RUB', 0],
      ['Упаковка и полиграфия РФ', 'Закуп товара / сырья USD', 'RUB', 0],
      ['Фулфилмент Москва', 'Аренда склада', 'RUB', 0],
      ['Бухгалтерия и налоги', '1С и сервисы', 'RUB', 0],
      ['Сертификация и Честный Знак', 'Таможня и сборы', 'RUB', 0],
      ['Цех Пошив ТМ №1', 'Закуп товара / сырья USD', 'USD', 0],
      ['Цех Пошив ТМ №2', 'Закуп товара / сырья USD', 'USD', 0],
      ['Логистика ТК РФ', 'Таможня и сборы', 'RUB', 0]
    ];
    ctrs.forEach(function (c) {
      if (!e.contractors.some(function (x) { return x.name === c[0]; })) {
        e.contractors.push({ name: c[0], art: c[1], status: 'Активен', cur: c[2], initDebt: c[3], arch: false });
      }
    });

    const staff = [
      ['Курбан', 'Руководитель склада', 'ФОТ склад', 'RUB', 125000],
      ['Сайид', 'Старший кладовщик', 'ФОТ склад', 'RUB', 100000],
      ['Касым', 'Производство ТМ', 'ФОТ менеджеры', 'USD', 500],
      ['Мердан', 'Менеджер МП', 'ФОТ менеджеры', 'USD', 500],
      ['Саша', 'Контент / Офис', 'ФОТ офис', 'USD', 500],
      ['Айгуль', 'Технолог ОТК', 'ФОТ склад', 'USD', 400],
      ['Рустам', 'Логист склад РФ', 'ФОТ склад', 'RUB', 85000],
      ['Динара', 'Оператор 1С / ШК', 'ФОТ офис', 'RUB', 75000],
      ['Байрам', 'Закройщик старший', 'ФОТ склад', 'USD', 450],
      ['Марал', 'Мастер цеха', 'ФОТ склад', 'USD', 420],
      ['Тимур', 'Водитель-экспедитор', 'ФОТ склад', 'RUB', 80000],
      ['Алина', 'Ассистент МП', 'ФОТ менеджеры', 'RUB', 65000]
    ];
    staff.forEach(function (s) {
      if (!e.staffList.some(function (x) { return x.name === s[0]; })) {
        e.staffList.push({ name: s[0], role: s[1], art: s[2], status: 'Работает', cur: s[3], initDebt: s[4], arch: false });
      }
    });

    pSave();
    if (typeof window.render === 'function') window.render();
    alert('Стартовая база SKOS успешно загружена!');
  };
  function renderDictTab() {
    const sec = document.getElementById('tab-dict');
    if (!sec) return;
    const e = ensureStore();
    const folders = [
      { id: 'cats', key: 'dictMatCats', title: '🧵 Категории сырья' },
      { id: 'units', key: 'dictUnits', title: '📏 Ед. измерения' },
      { id: 'sups', key: 'dictSuppliers', title: '🌍 Поставщики сырья' },
      { id: 'taxes', key: 'dictTaxTypes', title: '🏛️ Виды налогов' },
      { id: 'dds', key: 'ddsArticles', title: '💳 Статьи ДДС' },
      { id: 'staff', key: 'staffList', title: '👥 Сотрудники' },
      { id: 'ctrs', key: 'contractors', title: '🤝 Контрагенты' }
    ];
    const cur = folders.find(function (f) { return f.id === e.dictSub; }) || folders;
    const list = e[cur.key] || [];

    const tabsHtml = folders.map(function (f) {
      const cls = f.id === cur.id ? 'btn btn-primary' : 'btn';
      return '<button class="' + cls + '" onclick="p4DictSub(\'' + f.id + '\')">' + f.title + ' (' + (e[f.key] || []).length + ')</button>';
    }).join('');

    let extraFields = '';
    if (cur.key === 'ddsArticles') {
      extraFields = '<div><label>Направление</label><select id="dict-new-dir" class="select"><option value="in">+ Приход</option><option value="out">− Расход</option><option value="move">↔ Перевод</option></select></div>' +
        '<div><label>Статья ОПиУ</label><select id="dict-new-opiu" class="select"><option>Административные</option><option>Общепроизводственные</option><option>Аренда и склад</option><option>Учёт поставщиков</option><option>Учёт сделок (не дубл.)</option><option>Учёт запасов (не дубл.)</option><option>Учёт налогов (не дубл.)</option><option>Нет в ОПиУ</option></select></div>';
    } else if (cur.key === 'staffList') {
      extraFields = '<div><label>Должность</label><input id="dict-new-role" class="input" placeholder="Менеджер"></div>' +
        '<div><label>Статья ФОТ</label><select id="dict-new-art" class="select"><option>ФОТ склад</option><option>ФОТ менеджеры</option><option>ФОТ офис</option><option>ФОТ собственник</option></select></div>' +
        '<div><label>Валюта</label><select id="dict-new-cur" class="select"><option>RUB</option><option>USD</option></select></div>';
    } else if (cur.key === 'contractors') {
      extraFields = '<div><label>Статья ОПиУ</label><select id="dict-new-art" class="select"><option>Закуп товара / сырья USD</option><option>Аренда склада</option><option>Таможня и сборы</option><option>1С и сервисы</option></select></div>' +
        '<div><label>Валюта</label><select id="dict-new-cur" class="select"><option>USD</option><option>RUB</option></select></div>';
    }

    const rowsHtml = list.map(function (it, idx) {
      let info = 'Справочник';
      if (cur.key === 'ddsArticles') info = esc(it.dir) + ' • ' + esc(it.opiu || '');
      if (cur.key === 'staffList') info = esc(it.role || '') + ' • ' + esc(it.art || '') + ' [' + esc(it.cur || 'RUB') + ']';
      if (cur.key === 'contractors') info = esc(it.art || '') + ' [' + esc(it.cur || 'USD') + ']';
      const st = it.arch ? 'opacity:0.55;background:#f8fafc;' : '';
      const badge = it.arch ? ' <span class="badge badge-amber">Архив</span>' : '';
      return '<tr style="' + st + '"><td class="bold">' + esc(it.name) + badge + '</td><td>' + info + '</td>' +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="btn" onclick="p4DictEdit(\'' + cur.key + '\',' + idx + ')">✏️</button> ' +
          '<button class="btn" onclick="p4DictArch(\'' + cur.key + '\',' + idx + ')">' + (it.arch ? '📤' : '📦') + '</button> ' +
          '<button class="btn btn-danger" onclick="p4DictDel(\'' + cur.key + '\',' + idx + ')">✕</button>' +
        '</td></tr>';
    }).join('');

    sec.innerHTML =
      '<div class="card"><div class="card-header"><div><div class="card-title">📚 Единые справочники SKOS</div><div style="font-size:11.5px;color:#64748b">Архивные записи скрываются из выпадающих списков</div></div>' +
      '<button class="btn btn-success" onclick="p4SeedSkos()">📥 Загрузить стартовые данные SKOS</button></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + tabsHtml + '</div>' +
      '<div class="form-grid" style="margin-bottom:14px"><div><label>Название</label><input id="dict-new-name" class="input" placeholder="Название..."></div>' + extraFields +
      '<div><button class="btn btn-primary" style="width:100%" onclick="p4DictAdd(\'' + cur.key + '\')">+ Добавить</button></div></div>' +
      '<div style="overflow-x:auto"><table><thead><tr><th>Название</th><th>Параметры</th><th class="num">Действия</th></tr></thead><tbody>' +
      (rowsHtml || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table></div></div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 3: Навигация, защита вкладок и раздел «Справочники») === */
  function ensureExtraTabs() {
    const navSku = document.getElementById('nav-sku');
    if (navSku && !document.getElementById('nav-ue')) {
      const btnUe = document.createElement('button');
      btnUe.className = 'nav-btn';
      btnUe.id = 'nav-ue';
      btnUe.textContent = '📈 Юнит-экономика';
      btnUe.onclick = function () { window.tab('ue'); };
      navSku.insertAdjacentElement('afterend', btnUe);
    }

    const navSet = document.getElementById('nav-set');
    if (navSet && !document.getElementById('nav-dict')) {
      const btnDict = document.createElement('button');
      btnDict.className = 'nav-btn';
      btnDict.id = 'nav-dict';
      btnDict.textContent = '📚 Справочники';
      btnDict.onclick = function () { window.tab('dict'); };
      navSet.insertAdjacentElement('afterend', btnDict);
    }

    const content = document.querySelector('main.content');
    if (!content) return;

    if (!document.getElementById('tab-ue')) {
      const secUe = document.createElement('section');
      secUe.id = 'tab-ue';
      secUe.className = 'hidden';
      content.appendChild(secUe);
    }

    if (!document.getElementById('tab-dict')) {
      const secDict = document.createElement('section');
      secDict.id = 'tab-dict';
      secDict.className = 'hidden';
      content.appendChild(secDict);
    }
  }

  function applyTabVisibility(activeId) {
    ensureExtraTabs();
    const allTabs = ['dash', 'abc', 'rep', 'sku', 'ue', 'stk', 'dds', 'exp', 'sup', 'set', 'dict'];
    for (let i = 0; i < allTabs.length; i++) {
      const t = allTabs[i];
      const sec = document.getElementById('tab-' + t);
      const nav = document.getElementById('nav-' + t);
      const isAct = (t === activeId);
      if (sec) {
        sec.classList.toggle('hidden', !isAct);
        sec.style.display = isAct ? 'block' : 'none';
      }
      if (nav) {
        nav.classList.toggle('active', isAct);
      }
    }
    const crumb = document.getElementById('crumb');
    if (crumb) {
      if (activeId === 'ue') crumb.textContent = 'SKOS / Юнит-экономика (Факт и План)';
      if (activeId === 'dict') crumb.textContent = 'SKOS / Единые справочники и архив';
    }
  }

  const _origTab = window.tab;
  window.tab = function (id) {
    ensureExtraTabs();
    if (id === 'ue' || id === 'dict') {
      if (window.db) window.db.tab = id;
      applyTabVisibility(id);
      if (typeof window.render === 'function') window.render();
      return;
    }
    if (typeof _origTab === 'function') _origTab(id);
    applyTabVisibility(id);
  };

  let _obsLock = false;
  function initTabGuardObserver() {
    const content = document.querySelector('main.content');
    if (!content || content.dataset.p4Obs === '1') return;
    content.dataset.p4Obs = '1';
    const obs = new MutationObserver(function () {
      if (_obsLock) return;
      const cur = window.db && window.db.tab;
      if (cur === 'ue' || cur === 'dict') {
        const sec = document.getElementById('tab-' + cur);
        if (sec && (sec.classList.contains('hidden') || sec.style.display === 'none')) {
          _obsLock = true;
          applyTabVisibility(cur);
          _obsLock = false;
        }
      }
    });
    obs.observe(content, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }

  window.p4DictSub = function (sub) {
    const e = ensureStore();
    e.dictSub = sub;
    pSave();
    renderDictTab();
  };

  window.p4DictAdd = function (key) {
    const e = ensureStore();
    const inp = document.getElementById('dict-new-name');
    if (!inp || !inp.value.trim()) return alert('Введите название!');
    const nm = inp.value.trim();

    if (key === 'ddsArticles') {
      const dir = document.getElementById('dict-new-dir').value;
      const opiu = document.getElementById('dict-new-opiu').value;
      e.ddsArticles.unshift({ name: nm, dir: dir, opiu: opiu, arch: false });
    } else if (key === 'staffList') {
      const role = document.getElementById('dict-new-role').value.trim() || 'Сотрудник';
      const art = document.getElementById('dict-new-art').value;
      const cur = document.getElementById('dict-new-cur').value;
      e.staffList.unshift({ name: nm, role: role, art: art, status: 'Работает', cur: cur, initDebt: 0, arch: false });
    } else if (key === 'contractors') {
      const art = document.getElementById('dict-new-art').value;
      const cur = document.getElementById('dict-new-cur').value;
      e.contractors.unshift({ name: nm, art: art, status: 'Активен', cur: cur, initDebt: 0, arch: false });
    } else {
      e[key].unshift({ name: nm, arch: false });
    }
    pSave();
    renderDictTab();
  };

  window.p4DictEdit = function (key, idx) {
    const e = ensureStore();
    const item = e[key] && e[key][idx];
    if (!item) return;
    const nw = prompt('Новое название:', item.name);
    if (nw === null || !nw.trim()) return;
    item.name = nw.trim();
    if (key === 'staffList') {
      const nr = prompt('Должность:', item.role || '');
      if (nr !== null) item.role = nr.trim();
    }
    pSave();
    renderDictTab();
  };

  window.p4DictArch = function (key, idx) {
    const e = ensureStore();
    if (!e[key] || !e[key][idx]) return;
    e[key][idx].arch = !e[key][idx].arch;
    pSave();
    renderDictTab();
  };

  window.p4DictDel = function (key, idx) {
    const e = ensureStore();
    if (!e[key] || !e[key][idx]) return;
    if (!confirm('Удалить запись «' + e[key][idx].name + '» навсегда?')) return;
    e[key].splice(idx, 1);
    pSave();
    renderDictTab();
  };
    function renderDictTab() {
    const sec = document.getElementById('tab-dict');
    if (!sec) return;
    const e = ensureStore();
    const folders = [
      { id: 'cats', key: 'dictMatCats', title: '🧵 Категории сырья' },
      { id: 'units', key: 'dictUnits', title: '📏 Ед. измерения' },
      { id: 'sups', key: 'dictSuppliers', title: '🌍 Поставщики сырья' },
      { id: 'taxes', key: 'dictTaxTypes', title: '🏛️ Виды налогов' },
      { id: 'dds', key: 'ddsArticles', title: '💳 Статьи ДДС' },
      { id: 'staff', key: 'staffList', title: '👥 Сотрудники' },
      { id: 'ctrs', key: 'contractors', title: '🤝 Контрагенты' }
    ];
    const cur = folders.find(function (f) { return f.id === e.dictSub; }) || folders;
    const list = e[cur.key] || [];

    const tabsHtml = folders.map(function (f) {
      const cls = f.id === cur.id ? 'btn btn-primary' : 'btn';
      return '<button class="' + cls + '" onclick="p4DictSub(\'' + f.id + '\')">' + f.title + ' (' + (e[f.key] || []).length + ')</button>';
    }).join('');

    let extraFields = '';
    if (cur.key === 'ddsArticles') {
      extraFields = '<div><label>Направление</label><select id="dict-new-dir" class="select"><option value="in">+ Приход</option><option value="out">− Расход</option><option value="move">↔ Перевод</option></select></div>' +
        '<div><label>Статья ОПиУ</label><select id="dict-new-opiu" class="select"><option>Административные</option><option>Общепроизводственные</option><option>Аренда и склад</option><option>Учёт поставщиков</option><option>Учёт сделок (не дубл.)</option><option>Учёт запасов (не дубл.)</option><option>Учёт налогов (не дубл.)</option><option>Нет в ОПиУ</option></select></div>';
    } else if (cur.key === 'staffList') {
      extraFields = '<div><label>Должность</label><input id="dict-new-role" class="input" placeholder="Менеджер"></div>' +
        '<div><label>Статья ФОТ</label><select id="dict-new-art" class="select"><option>ФОТ склад</option><option>ФОТ менеджеры</option><option>ФОТ офис</option><option>ФОТ собственник</option></select></div>' +
        '<div><label>Валюта</label><select id="dict-new-cur" class="select"><option>RUB</option><option>USD</option></select></div>';
    } else if (cur.key === 'contractors') {
      extraFields = '<div><label>Статья ОПиУ</label><select id="dict-new-art" class="select"><option>Закуп товара / сырья USD</option><option>Аренда склада</option><option>Таможня и сборы</option><option>1С и сервисы</option></select></div>' +
        '<div><label>Валюта</label><select id="dict-new-cur" class="select"><option>USD</option><option>RUB</option></select></div>';
    }

    const rowsHtml = list.map(function (it, idx) {
      let info = 'Справочник';
      if (cur.key === 'ddsArticles') info = esc(it.dir) + ' • ' + esc(it.opiu || '');
      if (cur.key === 'staffList') info = esc(it.role || '') + ' • ' + esc(it.art || '') + ' [' + esc(it.cur || 'RUB') + ']';
      if (cur.key === 'contractors') info = esc(it.art || '') + ' [' + esc(it.cur || 'USD') + ']';
      const st = it.arch ? 'opacity:0.55;background:#f8fafc;' : '';
      const badge = it.arch ? ' <span class="badge badge-amber">Архив</span>' : '';
      return '<tr style="' + st + '"><td class="bold">' + esc(it.name) + badge + '</td><td>' + info + '</td>' +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="btn" onclick="p4DictEdit(\'' + cur.key + '\',' + idx + ')">✏️</button> ' +
          '<button class="btn" onclick="p4DictArch(\'' + cur.key + '\',' + idx + ')">' + (it.arch ? '📤' : '📦') + '</button> ' +
          '<button class="btn btn-danger" onclick="p4DictDel(\'' + cur.key + '\',' + idx + ')">✕</button>' +
        '</td></tr>';
    }).join('');

    sec.innerHTML =
      '<div class="card"><div class="card-header"><div><div class="card-title">📚 Единые справочники SKOS</div><div style="font-size:11.5px;color:#64748b">Архивные записи скрываются из выпадающих списков</div></div>' +
      '<button class="btn btn-success" onclick="p4SeedSkos()">📥 Загрузить стартовые данные SKOS</button></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + tabsHtml + '</div>' +
      '<div class="form-grid" style="margin-bottom:14px"><div><label>Название</label><input id="dict-new-name" class="input" placeholder="Название..."></div>' + extraFields +
      '<div><button class="btn btn-primary" style="width:100%" onclick="p4DictAdd(\'' + cur.key + '\')">+ Добавить</button></div></div>' +
      '<div style="overflow-x:auto"><table><thead><tr><th>Название</th><th>Параметры</th><th class="num">Действия</th></tr></thead><tbody>' +
      (rowsHtml || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table></div></div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 4А: Юнит-экономика — логика и Факт по МП) === */
  window.p4UeMode = function (m) {
    const e = ensureStore();
    e.ueView = m;
    pSave();
    renderUeTab();
  };

  window.p4UeFlt = function (k, v) {
    const e = ensureStore();
    e.ueFilter[k] = v;
    renderUeTab();
  };

  function buildUeFactHtml(e) {
    const f = e.ueFilter || { mp: 'ALL', org: 'ALL', mo: 'ALL', q: '' };
    const sales = (window.db && Array.isArray(window.db.itemSales)) ? window.db.itemSales : [];
    const rate = rateNow();
    const map = new Map();

    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      if (!s) continue;
      const org = String(s.org || 'Без юрлица');
      const mp = String(s.mp || 'WB');
      const per = String(s.per || s.date || '').slice(0, 7) || '—';
      const mo = per.length >= 7 ? per.slice(5, 7) : 'ALL';
      const model = String(s.model || s.name || s.art || 'Товар');

      if (f.mp !== 'ALL' && mp !== f.mp) continue;
      if (f.org !== 'ALL' && org !== f.org) continue;
      if (f.mo !== 'ALL' && mo !== f.mo) continue;
      if (f.q && model.toLowerCase().indexOf(f.q.toLowerCase()) < 0) continue;

      const key = org + '|' + mp + '|' + per + '|' + model;
      const cur = map.get(key) || { org: org, mp: mp, per: per, model: model, qty: 0, rev: 0, fee: 0, cogs: 0 };
      const q = num(s.qty || s.sQty || 1);
      const rev = num(s.rev);
      const fee = num(s.com) + num(s.log) + num(s.ads) + num(s.fee);
      const cogs = num(s.cogs) > 0 ? num(s.cogs) : (num(s.usd) * rate * q);

      if (s.isRet) {
        cur.qty -= q;
        cur.rev -= rev;
        cur.cogs -= cogs;
      } else {
        cur.qty += q;
        cur.rev += rev;
        cur.cogs += cogs;
      }
      cur.fee += fee;
      map.set(key, cur);
    }

    const rows = Array.from(map.values()).sort(function (a, b) {
      return (b.rev - b.fee - b.cogs) - (a.rev - a.fee - a.cogs);
    });

    let tQty = 0, tRev = 0, tFee = 0, tCogs = 0, tProf = 0;
    const body = rows.map(function (r) {
      const prof = r.rev - r.fee - r.cogs;
      const unitP = r.qty > 0 ? (prof / r.qty) : 0;
      const mar = r.rev > 0 ? (prof / r.rev * 100) : 0;
      tQty += r.qty; tRev += r.rev; tFee += r.fee; tCogs += r.cogs; tProf += prof;
      return '<tr><td>' + esc(r.per) + '</td><td>' + esc(r.org) + '</td><td><span class="badge badge-blue">' + esc(r.mp) + '</span></td>' +
        '<td class="bold">' + esc(r.model) + '</td><td class="num">' + Math.round(r.qty) + '</td>' +
        '<td class="num">' + fmtR(r.rev) + '</td><td class="num">' + fmtR(r.fee) + '</td><td class="num">' + fmtR(r.cogs) + '</td>' +
        '<td class="num bold ' + (prof >= 0 ? 'text-green' : 'text-red') + '">' + fmtR(prof) + '</td>' +
        '<td class="num">' + fmtR(unitP) + '</td><td class="num">' + mar.toFixed(1) + '%</td></tr>';
    }).join('');

    const totMar = tRev > 0 ? (tProf / tRev * 100) : 0;
    const totRow = '<tr style="background:#eff6ff;font-weight:800"><td colspan="4">ИТОГО ПО ФИЛЬТРУ</td>' +
      '<td class="num">' + Math.round(tQty) + '</td><td class="num">' + fmtR(tRev) + '</td><td class="num">' + fmtR(tFee) + '</td>' +
      '<td class="num">' + fmtR(tCogs) + '</td><td class="num ' + (tProf >= 0 ? 'text-green' : 'text-red') + '">' + fmtR(tProf) + '</td>' +
      '<td class="num">' + fmtR(tQty > 0 ? tProf / tQty : 0) + '</td><td class="num">' + totMar.toFixed(1) + '%</td></tr>';

    const orgOpts = '<option value="ALL">Все юрлица</option>' + optList(getActiveOrgs(), f.org, '');
    return '<div class="form-grid" style="margin-bottom:12px">' +
      '<div><label>Площадка</label><select class="select" onchange="p4UeFlt(\'mp\',this.value)"><option value="ALL">Все МП</option><option value="WB"' + (f.mp === 'WB' ? ' selected' : '') + '>WB</option><option value="OZON"' + (f.mp === 'OZON' ? ' selected' : '') + '>Ozon</option><option value="YM"' + (f.mp === 'YM' ? ' selected' : '') + '>ЯМ</option></select></div>' +
      '<div><label>Юрлицо</label><select class="select" onchange="p4UeFlt(\'org\',this.value)">' + orgOpts + '</select></div>' +
      '<div><label>Месяц</label><select class="select" onchange="p4UeFlt(\'mo\',this.value)"><option value="ALL">Все</option>' +
        ['01','02','03','04','05','06','07','08','09','10','11','12'].map(function (m) { return '<option value="' + m + '"' + (f.mo === m ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label>Поиск модели</label><input class="input" value="' + esc(f.q) + '" placeholder="Название..." oninput="p4UeFlt(\'q\',this.value)"></div></div>' +
      '<div style="overflow-x:auto"><table><thead><tr><th>Период</th><th>Юрлицо</th><th>МП</th><th>Модель</th><th class="num">Шт</th><th class="num">Выручка</th><th class="num">Услуги МП</th><th class="num">Себест.</th><th class="num">Прибыль</th><th class="num">На 1 шт</th><th class="num">Маржа</th></tr></thead>' +
      '<tbody>' + totRow + (body || '<tr><td colspan="11" style="text-align:center;color:#94a3b8">Нет загруженных продаж по фильтру</td></tr>') + '</tbody></table></div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 4Б: План-калькулятор Юнит-экономики и renderUeTab) === */
  window.p4UePlanAdd = function () {
    const e = ensureStore();
    const model = document.getElementById('uep-model').value;
    if (!model) return alert('Выберите модель!');
    e.unitEcon.unshift({
      model: model,
      mp: document.getElementById('uep-mp').value,
      price: num(document.getElementById('uep-price').value),
      comm: num(document.getElementById('uep-comm').value),
      log: num(document.getElementById('uep-log').value),
      bo: num(document.getElementById('uep-bo').value) || 85,
      ads: num(document.getElementById('uep-ads').value),
      tax: num(document.getElementById('uep-tax').value) || 6
    });
    pSave();
    renderUeTab();
  };

  window.p4UePlanDel = function (idx) {
    const e = ensureStore();
    e.unitEcon.splice(idx, 1);
    pSave();
    renderUeTab();
  };

  function buildUePlanHtml(e) {
    const rate = rateNow();
    const models = getModelsList(false);
    const usdMap = new Map(models.map(function (m) { return [m.name.toLowerCase(), m.usd]; }));

    const rows = (e.unitEcon || []).map(function (u, idx) {
      const cogsUsd = usdMap.get(String(u.model || '').toLowerCase()) || 0;
      const cogsRub = cogsUsd * rate;
      const bo = (num(u.bo) || 85) / 100;
      const effLog = bo > 0 ? (num(u.log) / bo) : num(u.log);
      const commRub = num(u.price) * (num(u.comm) / 100);
      const adsRub = num(u.price) * (num(u.ads) / 100);
      const taxRub = num(u.price) * (num(u.tax) / 100);
      const prof = num(u.price) - commRub - effLog - adsRub - taxRub - cogsRub;
      const mar = num(u.price) > 0 ? (prof / num(u.price) * 100) : 0;

      return '<tr><td class="bold">' + esc(u.model) + '</td><td>' + esc(u.mp) + '</td>' +
        '<td class="num">' + fmtR(u.price) + '</td><td class="num">' + fmtU(cogsUsd) + ' (' + fmtR(cogsRub) + ')</td>' +
        '<td class="num">' + u.comm + '%</td><td class="num">' + fmtR(effLog) + ' (' + u.bo + '%)</td>' +
        '<td class="num">' + u.ads + '%</td><td class="num">' + u.tax + '%</td>' +
        '<td class="num bold ' + (prof >= 0 ? 'text-green' : 'text-red') + '">' + fmtR(prof) + '</td>' +
        '<td class="num">' + mar.toFixed(1) + '%</td>' +
        '<td class="num"><button class="btn btn-danger" onclick="p4UePlanDel(' + idx + ')">✕</button></td></tr>';
    }).join('');

    return '<div class="form-grid" style="margin-bottom:14px">' +
      '<div><label>Модель</label><select id="uep-model" class="select">' + optModels('', '— Модель —') + '</select></div>' +
      '<div><label>МП</label><select id="uep-mp" class="select"><option>WB</option><option>OZON</option><option>YM</option></select></div>' +
      '<div><label>Цена продажи ₽</label><input id="uep-price" type="number" class="input" placeholder="2500"></div>' +
      '<div><label>Комиссия %</label><input id="uep-comm" type="number" class="input" value="25"></div>' +
      '<div><label>Логистика ₽</label><input id="uep-log" type="number" class="input" value="95"></div>' +
      '<div><label>Выкуп %</label><input id="uep-bo" type="number" class="input" value="85"></div>' +
      '<div><label>ДРР %</label><input id="uep-ads" type="number" class="input" value="10"></div>' +
      '<div><label>Налог %</label><input id="uep-tax" type="number" class="input" value="7"></div>' +
      '<div><button class="btn btn-primary" style="width:100%" onclick="p4UePlanAdd()">+ Расчёт</button></div>' +
    '</div>' +
    '<div style="overflow-x:auto"><table><thead><tr><th>Модель</th><th>МП</th><th class="num">Цена</th><th class="num">Себест.</th><th class="num">Ком.%</th><th class="num">Лог. с уч. выкупа</th><th class="num">ДРР%</th><th class="num">Налог%</th><th class="num">Прибыль/шт</th><th class="num">Маржа</th><th></th></tr></thead>' +
    '<tbody>' + (rows || '<tr><td colspan="11" style="text-align:center;color:#94a3b8">Добавьте модель для расчёта плановой юнит-экономики</td></tr>') + '</tbody></table></div>';
  }

  function renderUeTab() {
    const sec = document.getElementById('tab-ue');
    if (!sec) return;
    const e = ensureStore();
    const isFact = e.ueView !== 'plan';
    sec.innerHTML =
      '<div class="card">' +
        '<div class="card-header">' +
          '<div><div class="card-title">📈 Юнит-экономика SKOS</div><div style="font-size:11.5px;color:#64748b">Фактическая прибыльность по отчётам МП и плановый калькулятор</div></div>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn ' + (isFact ? 'btn-primary' : '') + '" onclick="p4UeMode(\'fact\')">📊 Факт по отчётам МП</button>' +
            '<button class="btn ' + (!isFact ? 'btn-primary' : '') + '" onclick="p4UeMode(\'plan\')">🧮 План-калькулятор</button>' +
          '</div>' +
        '</div>' +
        (isFact ? buildUeFactHtml(e) : buildUePlanHtml(e)) +
      '</div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 5А: Склад — расчёт остатков сырья, НЗП, ГП и замороженного капитала) === */
  function calcStockBalances(e) {
    const matMap = new Map();
    for (let i = 0; i < e.materials.length; i++) {
      const m = e.materials[i];
      if (!m || !m.name) continue;
      matMap.set(m.name, {
        name: m.name,
        unit: m.unit || 'шт',
        cat: m.cat || 'Ткань',
        qty: num(m.initQty),
        usd: num(m.initUsd)
      });
    }

    for (let i = 0; i < e.matIn.length; i++) {
      const inc = e.matIn[i];
      if (!inc || !inc.matName) continue;
      const cur = matMap.get(inc.matName) || { name: inc.matName, unit: 'шт', cat: 'Сырьё', qty: 0, usd: 0 };
      cur.qty += num(inc.qty);
      cur.usd += num(inc.totalUsd) || (num(inc.qty) * num(inc.priceUsd));
      matMap.set(inc.matName, cur);
    }

    for (let i = 0; i < e.orders.length; i++) {
      const ord = e.orders[i];
      if (!ord || ord.status !== 'DONE') continue;
      const lines = Array.isArray(ord.lines) ? ord.lines : [];
      for (let j = 0; j < lines.length; j++) {
        const ln = lines[j];
        const cur = matMap.get(ln.matName);
        if (!cur) continue;
        const avgP = cur.qty > 0 ? (cur.usd / cur.qty) : num(ln.priceUsd);
        const usedQty = num(ln.usedQty);
        cur.qty -= usedQty;
        cur.usd -= usedQty * avgP;
      }
    }

    let rawUsd = 0;
    const matRows = Array.from(matMap.values()).map(function (m) {
      if (m.usd < 0 && Math.abs(m.usd) < 0.01) m.usd = 0;
      if (m.qty > 0 && m.usd > 0) rawUsd += m.usd;
      m.avgPrice = m.qty > 0 ? (m.usd / m.qty) : 0;
      return m;
    });

    let wipUsd = 0;
    for (let i = 0; i < e.orders.length; i++) {
      if (e.orders[i] && e.orders[i].status === 'WIP') {
        wipUsd += num(e.orders[i].totalUsd);
      }
    }

    let fgUsd = 0;
    for (let i = 0; i < e.fgStocks.length; i++) {
      const fg = e.fgStocks[i];
      if (!fg) continue;
      const totQ = num(fg.ruQty) + num(fg.tmQty) + num(fg.wayQty);
      fgUsd += num(fg.lockedUsd) > 0 ? num(fg.lockedUsd) : (totQ * num(fg.unitUsd));
    }

    let defUsd = 0;
    for (let i = 0; i < e.defects.length; i++) {
      const df = e.defects[i];
      if (df) defUsd += num(df.qty) * num(df.unitUsd);
    }

    return {
      matRows: matRows,
      rawUsd: rawUsd,
      wipUsd: wipUsd,
      fgUsd: fgUsd,
      defUsd: defUsd,
      totalUsd: rawUsd + wipUsd + fgUsd
    };
  }

  function updateDashFrozenCard(st) {
    const rate = rateNow();
    const elRub = document.getElementById('k-frz');
    const elSub = document.getElementById('k-frz-u');
    if (elRub) elRub.textContent = fmtR(st.totalUsd * rate);
    if (elSub) {
      elSub.textContent = fmtU(st.totalUsd) + ' (Сырьё ' + Math.round(st.rawUsd) + '$ • НЗП ' + Math.round(st.wipUsd) + '$ • ГП ' + Math.round(st.fgUsd) + '$)';
    }
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 5Б: Действия склада — сырьё, пошив/НЗП, техкарты, ГП и брак) === */
  window.p4StkSub = function (sub) {
    const e = ensureStore();
    e.stkSub = sub;
    pSave();
    renderStkTab();
  };

  window.p4MatAdd = function () {
    const e = ensureStore();
    const nm = document.getElementById('stk-m-name').value.trim();
    if (!nm) return alert('Введите название сырья!');
    e.materials.unshift({
      name: nm,
      unit: document.getElementById('stk-m-unit').value,
      cat: document.getElementById('stk-m-cat').value,
      initQty: num(document.getElementById('stk-m-qty').value),
      initUsd: num(document.getElementById('stk-m-usd').value)
    });
    pSave();
    renderStkTab();
  };

  window.p4MatInAdd = function () {
    const e = ensureStore();
    const matName = document.getElementById('stk-in-mat').value;
    const qty = num(document.getElementById('stk-in-qty').value);
    const pr = num(document.getElementById('stk-in-pr').value);
    if (!matName || qty <= 0) return alert('Выберите сырьё и укажите количество!');
    e.matIn.unshift({
      date: document.getElementById('stk-in-dt').value || today(),
      matName: matName,
      qty: qty,
      priceUsd: pr,
      totalUsd: qty * pr,
      supplier: document.getElementById('stk-in-sup').value
    });
    pSave();
    renderStkTab();
  };

  window.p4BomAddRow = function () {
    const e = ensureStore();
    const prod = document.getElementById('bom-prod').value;
    const mat = document.getElementById('bom-mat').value;
    const norm = num(document.getElementById('bom-norm').value);
    const pr = num(document.getElementById('bom-pr').value);
    if (!prod || !mat || norm <= 0) return alert('Укажите модель, материал и норму расхода!');
    let rec = e.bom.find(function (b) { return b.product === prod; });
    if (!rec) {
      rec = { product: prod, items: [] };
      e.bom.unshift(rec);
    }
    rec.items.push({ matName: mat, norm: norm, priceUsd: pr });
    getModelsList(true);
    pSave();
    renderStkTab();
  };

  window.p4OrderPreview = function () {
    const e = ensureStore();
    const prod = document.getElementById('ord-prod').value;
    const qty = num(document.getElementById('ord-qty').value);
    const box = document.getElementById('ord-preview');
    if (!box) return;
    const rec = e.bom.find(function (b) { return b.product === prod; });
    if (!rec || qty <= 0) {
      box.innerHTML = '<span style="color:#64748b">Выберите модель с техкартой и количество для расчёта списания сырья.</span>';
      return;
    }
    let tot = 0;
    const lines = rec.items.map(function (it) {
      const need = num(it.norm) * qty;
      const sum = need * num(it.priceUsd);
      tot += sum;
      return esc(it.matName) + ': <b>' + need.toFixed(2) + '</b> (' + fmtU(sum) + ')';
    });
    box.innerHTML = 'Предпросмотр списания на ' + qty + ' шт: ' + lines.join(' • ') + ' | <b>Итого: ' + fmtU(tot) + '</b>';
  };

  window.p4OrderAdd = function () {
    const e = ensureStore();
    const prod = document.getElementById('ord-prod').value;
    const qty = num(document.getElementById('ord-qty').value);
    if (!prod || qty <= 0) return alert('Выберите модель и количество!');
    const rec = e.bom.find(function (b) { return b.product === prod; });
    let totUsd = 0;
    const lines = [];
    if (rec && Array.isArray(rec.items)) {
      for (let i = 0; i < rec.items.length; i++) {
        const it = rec.items[i];
        const used = num(it.norm) * qty;
        totUsd += used * num(it.priceUsd);
        lines.push({ matName: it.matName, usedQty: used, priceUsd: num(it.priceUsd) });
      }
    }
    e.orders.unshift({
      date: document.getElementById('ord-dt').value || today(),
      doneDate: '',
      status: 'WIP',
      product: prod,
      qty: qty,
      totalUsd: totUsd,
      comment: document.getElementById('ord-cmt').value.trim(),
      lines: lines
    });
    pSave();
    renderStkTab();
  };

  window.p4OrderDone = function (idx) {
    const e = ensureStore();
    const ord = e.orders[idx];
    if (!ord || ord.status === 'DONE') return;
    if (!confirm('Закрыть партию пошива «' + ord.product + '» (' + ord.qty + ' шт) и списать сырьё со склада?')) return;
    ord.status = 'DONE';
    ord.doneDate = today();
    pSave();
    renderStkTab();
  };

  window.p4FgAdd = function () {
    const e = ensureStore();
    const prod = document.getElementById('fg-prod').value;
    if (!prod) return alert('Выберите модель!');
    const ru = num(document.getElementById('fg-ru').value);
    const tm = num(document.getElementById('fg-tm').value);
    const way = num(document.getElementById('fg-way').value);
    const u = num(document.getElementById('fg-usd').value);
    e.fgStocks.unshift({
      month: document.getElementById('fg-mo').value || today().slice(0, 7),
      product: prod,
      ruQty: ru,
      tmQty: tm,
      wayQty: way,
      unitUsd: u,
      lockedUsd: (ru + tm + way) * u
    });
    pSave();
    renderStkTab();
  };

  window.p4DefAdd = function () {
    const e = ensureStore();
    const prod = document.getElementById('def-prod').value;
    const qty = num(document.getElementById('def-qty').value);
    if (!prod || qty <= 0) return alert('Выберите модель и количество брака!');
    e.defects.unshift({
      date: document.getElementById('def-dt').value || today(),
      product: prod,
      qty: qty,
      unitUsd: num(document.getElementById('def-usd').value),
      reason: document.getElementById('def-rsn').value.trim() || 'Производственный брак'
    });
    pSave();
    renderStkTab();
  };
/* === SKOS Finance 3.0 — patch4.js (Часть 5В-1: Склад — Свод, Материалы, Приход) === */
  window.p4DelRow = function (arrKey, idx) {
    const e = ensureStore();
    if (!Array.isArray(e[arrKey]) || !e[arrKey][idx]) return;
    if (!confirm('Удалить запись?')) return;
    e[arrKey].splice(idx, 1);
    pSave();
    if (typeof window.render === 'function') window.render();
  };

  function renderStkTab() {
    const sec = document.getElementById('tab-stk');
    if (!sec) return;
    const e = ensureStore();
    const st = calcStockBalances(e);
    updateDashFrozenCard(st);
    const rate = rateNow();
    const sub = e.stkSub || 'sum';

    const tabs = [
      { id: 'sum', title: '📊 Свод запасов' },
      { id: 'mat', title: '🧵 Материалы (' + st.matRows.length + ')' },
      { id: 'inc', title: '📥 Приход сырья (' + e.matIn.length + ')' },
      { id: 'ord', title: '✂️ Пошив / Техкарты (' + e.orders.length + ')' },
      { id: 'fg', title: '📦 ГП и Брак' }
    ];
    const navHtml = tabs.map(function (t) {
      return '<button class="btn ' + (t.id === sub ? 'btn-primary' : '') + '" onclick="p4StkSub(\'' + t.id + '\')">' + t.title + '</button>';
    }).join('');

    let bodyHtml = '';
    const matNames = st.matRows.map(function (m) { return m.name; });

    if (sub === 'sum') {
      const low = st.matRows.filter(function (m) { return m.qty < 15; });
      const lowRows = low.map(function (m) {
        return '<tr style="background:#fff1f2"><td class="bold">' + esc(m.name) + '</td><td>' + esc(m.cat) + '</td>' +
          '<td class="num bold text-red">' + m.qty.toFixed(2) + ' ' + esc(m.unit) + '</td><td class="num">' + fmtU(m.usd) + '</td></tr>';
      }).join('');
      bodyHtml =
        '<div class="kpi-grid">' +
          '<div class="kpi-card"><div style="font-size:11px;color:#64748b">Сырьё и фурнитура</div><div class="kpi-val">' + fmtU(st.rawUsd) + '</div><div class="kpi-sub">' + fmtR(st.rawUsd * rate) + '</div></div>' +
          '<div class="kpi-card"><div style="font-size:11px;color:#64748b">В пошиве (НЗП)</div><div class="kpi-val">' + fmtU(st.wipUsd) + '</div><div class="kpi-sub">' + fmtR(st.wipUsd * rate) + '</div></div>' +
          '<div class="kpi-card"><div style="font-size:11px;color:#64748b">Готовый товар (РФ+ТМ+Путь)</div><div class="kpi-val">' + fmtU(st.fgUsd) + '</div><div class="kpi-sub">' + fmtR(st.fgUsd * rate) + '</div></div>' +
          '<div class="kpi-card highlight"><div style="font-size:11px;color:#1d4ed8;font-weight:700">ИТОГО ЗАМОРОЖЕНО</div><div class="kpi-val text-green">' + fmtR(st.totalUsd * rate) + '</div><div class="kpi-sub">' + fmtU(st.totalUsd) + '</div></div>' +
        '</div>' +
        '<div style="font-weight:700;margin-bottom:8px;color:#be123c">⚠️ Критические остатки (&lt; 15 ед.): ' + low.length + ' поз.</div>' +
        '<table><thead><tr><th>Материал</th><th>Категория</th><th class="num">Остаток</th><th class="num">Сумма $</th></tr></thead><tbody>' +
        (lowRows || '<tr><td colspan="4" style="text-align:center;color:#059669">Все остатки сырья в норме (≥ 15 ед.)</td></tr>') + '</tbody></table>';
    } else if (sub === 'mat') {
      const rows = st.matRows.map(function (m, i) {
        return '<tr' + (m.qty < 15 ? ' style="background:#fff1f2"' : '') + '><td class="bold">' + esc(m.name) + '</td><td>' + esc(m.cat) + '</td>' +
          '<td class="num bold ' + (m.qty < 15 ? 'text-red' : '') + '">' + m.qty.toFixed(2) + ' ' + esc(m.unit) + '</td>' +
          '<td class="num">' + fmtU(m.avgPrice) + '</td><td class="num">' + fmtU(m.usd) + '</td>' +
          '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'materials\',' + i + ')">✕</button></td></tr>';
      }).join('');
      bodyHtml =
        '<div class="form-grid" style="margin-bottom:12px">' +
          '<div><label>Наименование</label><input id="stk-m-name" class="input" placeholder="Ткань..."></div>' +
          '<div><label>Категория <button type="button" class="btn" style="padding:0 5px" onclick="p4QuickAdd(\'dictMatCats\',\'Категория\',\'stk-m-cat\')">➕</button></label><select id="stk-m-cat" class="select">' + optDict(e.dictMatCats, '', '') + '</select></div>' +
          '<div><label>Ед. изм. <button type="button" class="btn" style="padding:0 5px" onclick="p4QuickAdd(\'dictUnits\',\'Ед. изм.\',\'stk-m-unit\')">➕</button></label><select id="stk-m-unit" class="select">' + optDict(e.dictUnits, '', '') + '</select></div>' +
          '<div><label>Нач. ост.</label><input id="stk-m-qty" type="number" step="0.01" class="input" value="0"></div>' +
          '<div><label>Сумма $</label><input id="stk-m-usd" type="number" step="0.01" class="input" value="0"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4MatAdd()">+ Сырьё</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Сырьё</th><th>Категория</th><th class="num">Остаток</th><th class="num">Ср. цена</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table>';
    } else if (sub === 'inc') {
      const rows = e.matIn.map(function (x, i) {
        return '<tr><td>' + esc(x.date) + '</td><td class="bold">' + esc(x.matName) + '</td><td>' + esc(x.supplier) + '</td>' +
          '<td class="num">' + num(x.qty).toFixed(2) + '</td><td class="num">' + fmtU(x.priceUsd) + '</td><td class="num bold">' + fmtU(x.totalUsd) + '</td>' +
          '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'matIn\',' + i + ')">✕</button></td></tr>';
      }).join('');
      bodyHtml =
        '<div class="form-grid" style="margin-bottom:12px">' +
          '<div><label>Дата</label><input id="stk-in-dt" type="date" class="input" value="' + today() + '"></div>' +
          '<div><label>Сырьё</label><select id="stk-in-mat" class="select">' + optList(matNames, '', '— Сырьё —') + '</select></div>' +
          '<div><label>Поставщик <button type="button" class="btn" style="padding:0 5px" onclick="p4QuickAdd(\'dictSuppliers\',\'Поставщик\',\'stk-in-sup\')">➕</button></label><select id="stk-in-sup" class="select">' + optDict(e.dictSuppliers, '', '') + '</select></div>' +
          '<div><label>Кол-во</label><input id="stk-in-qty" type="number" step="0.01" class="input" placeholder="100"></div>' +
          '<div><label>Цена $</label><input id="stk-in-pr" type="number" step="0.01" class="input" placeholder="2.50"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4MatInAdd()">+ Приход</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Дата</th><th>Сырьё</th><th>Поставщик</th><th class="num">Кол-во</th><th class="num">Цена $</th><th class="num">Итого $</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table>';
    }
/* === SKOS Finance 3.0 — patch4.js (Часть 5В-2: Склад — Пошив/Техкарты и ГП/Брак) === */
    else if (sub === 'ord') {
      const ordRows = e.orders.map(function (o, i) {
        const stBadge = o.status === 'DONE'
          ? '<span class="badge badge-green">Готово (' + esc(o.doneDate) + ')</span>'
          : '<button class="btn btn-success" onclick="p4OrderDone(' + i + ')">✅ Завершить</button>';
        return '<tr><td>' + esc(o.date) + '</td><td class="bold">' + esc(o.product) + '</td><td class="num">' + o.qty + '</td>' +
          '<td class="num">' + fmtU(o.totalUsd) + '</td><td>' + esc(o.comment) + '</td><td class="num">' + stBadge + '</td>' +
          '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'orders\',' + i + ')">✕</button></td></tr>';
      }).join('');
      const bomRows = e.bom.map(function (b, i) {
        const tot = (b.items || []).reduce(function (s, it) { return s + num(it.norm) * num(it.priceUsd); }, 0);
        const det = (b.items || []).map(function (it) { return esc(it.matName) + ' (' + it.norm + '×' + it.priceUsd + '$)'; }).join(', ');
        return '<tr><td class="bold">' + esc(b.product) + '</td><td>' + det + '</td><td class="num bold">' + fmtU(tot) + '</td>' +
          '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'bom\',' + i + ')">✕</button></td></tr>';
      }).join('');
      bodyHtml =
        '<div style="font-weight:700;margin-bottom:6px">1. Новая партия пошива (НЗП)</div>' +
        '<div class="form-grid" style="margin-bottom:8px">' +
          '<div><label>Дата</label><input id="ord-dt" type="date" class="input" value="' + today() + '"></div>' +
          '<div><label>Модель</label><select id="ord-prod" class="select" onchange="p4OrderPreview()">' + optModels('', '— Модель —') + '</select></div>' +
          '<div><label>Кол-во шт</label><input id="ord-qty" type="number" class="input" placeholder="100" oninput="p4OrderPreview()"></div>' +
          '<div><label>Комментарий</label><input id="ord-cmt" class="input" placeholder="Цех"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4OrderAdd()">+ В пошив</button></div>' +
        '</div>' +
        '<div id="ord-preview" style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;margin-bottom:12px">Выберите модель и кол-во.</div>' +
        '<table style="margin-bottom:14px"><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт</th><th class="num">Сумма $</th><th>Коммент</th><th class="num">Статус</th><th></th></tr></thead><tbody>' +
        (ordRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table>' +
        '<div style="font-weight:700;margin-bottom:6px">2. Техкарты моделей</div>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
          '<div><label>Модель</label><select id="bom-prod" class="select">' + optModels('', '— Модель —') + '</select></div>' +
          '<div><label>Материал</label><select id="bom-mat" class="select">' + optList(matNames, '', '— Материал —') + '</select></div>' +
          '<div><label>Норма</label><input id="bom-norm" type="number" step="0.01" class="input" placeholder="1.25"></div>' +
          '<div><label>Цена $</label><input id="bom-pr" type="number" step="0.01" class="input" placeholder="2.65"></div>' +
          '<div><button class="btn btn-success" style="width:100%" onclick="p4BomAddRow()">+ В техкарту</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Модель</th><th>Состав</th><th class="num">Себест. $</th><th></th></tr></thead><tbody>' +
        (bomRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table>';
    } else {
      const fgRows = e.fgStocks.map(function (f, i) {
        const tot = num(f.ruQty) + num(f.tmQty) + num(f.wayQty);
        return '<tr><td>' + esc(f.month) + '</td><td class="bold">' + esc(f.product) + '</td><td class="num">' + f.ruQty + '</td>' +
          '<td class="num">' + f.tmQty + '</td><td class="num">' + f.wayQty + '</td><td class="num bold">' + tot + '</td>' +
          '<td class="num">' + fmtU(f.unitUsd) + '</td><td class="num bold">' + fmtU(f.lockedUsd) + '</td>' +
          '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'fgStocks\',' + i + ')">✕</button></td></tr>';
      }).join('');
      const defRows = e.defects.map(function (d, i) {
        return '<tr><td>' + esc(d.date) + '</td><td class="bold">' + esc(d.product) + '</td><td class="num">' + d.qty + '</td>' +
          '<td class="num">' + fmtU(d.unitUsd) + '</td><td class="num text-red bold">' + fmtU(num(d.qty) * num(d.unitUsd)) + '</td><td>' + esc(d.reason) + '</td>' +
          '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'defects\',' + i + ')">✕</button></td></tr>';
      }).join('');
      bodyHtml =
        '<div style="font-weight:700;margin-bottom:6px">1. Остатки готового товара (РФ / ТМ / В пути)</div>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
          '<div><label>Месяц</label><input id="fg-mo" type="month" class="input" value="' + today().slice(0, 7) + '"></div>' +
          '<div><label>Модель</label><select id="fg-prod" class="select">' + optModels('', '— Модель —') + '</select></div>' +
          '<div><label>РФ шт</label><input id="fg-ru" type="number" class="input" value="0"></div>' +
          '<div><label>ТМ шт</label><input id="fg-tm" type="number" class="input" value="0"></div>' +
          '<div><label>Путь шт</label><input id="fg-way" type="number" class="input" value="0"></div>' +
          '<div><label>Цена $</label><input id="fg-usd" type="number" step="0.01" class="input" value="0"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4FgAdd()">+ Остаток</button></div>' +
        '</div>' +
        '<table style="margin-bottom:14px"><thead><tr><th>Месяц</th><th>Модель</th><th class="num">РФ</th><th class="num">ТМ</th><th class="num">Путь</th><th class="num">Всего</th><th class="num">Цена $</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>' +
        (fgRows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table>' +
        '<div style="font-weight:700;margin-bottom:6px">2. Журнал брака</div>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
          '<div><label>Дата</label><input id="def-dt" type="date" class="input" value="' + today() + '"></div>' +
          '<div><label>Модель</label><select id="def-prod" class="select">' + optModels('', '— Модель —') + '</select></div>' +
          '<div><label>Брак шт</label><input id="def-qty" type="number" class="input" placeholder="5"></div>' +
          '<div><label>Цена $</label><input id="def-usd" type="number" step="0.01" class="input" placeholder="6.50"></div>' +
          '<div><label>Причина</label><input id="def-rsn" class="input" placeholder="Брак"></div>' +
          '<div><button class="btn btn-danger" style="width:100%;padding:7px" onclick="p4DefAdd()">+ Списать брак</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт</th><th class="num">Цена $</th><th class="num">Убыток $</th><th>Причина</th><th></th></tr></thead><tbody>' +
        (defRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">Пусто</td></tr>') + '</tbody></table>';
    }

    sec.innerHTML =
      '<div class="card"><div class="card-header"><div class="card-title">🏭 Склад, Сырьё, Пошив (НЗП) и Готовый товар</div></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' + navHtml + '</div>' + bodyHtml + '</div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 6А: Расходы/Налоги, Долги 1 янв, ЗПВ и Контрагенты) === */
  window.p4TaxFullMonth = function () {
    const orgEl = document.getElementById('tx-org');
    const typEl = document.getElementById('tx-typ');
    const yrEl = document.getElementById('tx-yr');
    const amtEl = document.getElementById('tx-amt');
    if (!amtEl) return;
    const sum = num(amtEl.value);
    if (sum <= 0) return alert('Введите сумму налога!');
    const moStr = prompt('Введите номер месяца (от 1 до 12), куда записать всю сумму целиком:', '11');
    if (!moStr) return;
    const mNum = parseInt(moStr, 10);
    if (!(mNum >= 1 && mNum <= 12)) return alert('Месяц должен быть числом от 1 до 12!');
    const mo = (mNum < 10 ? '0' : '') + mNum;
    const yr = yrEl ? yrEl.value : '2026';
    const per = yr + '-' + mo;
    if (window.db && window.db.locked && window.db.locked[per]) return alert('Месяц ' + per + ' закрыт!');
    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    window.db.taxes.unshift({
      id: 'tx_' + Date.now(),
      per: per,
      yr: yr,
      q: 'Мес.' + mo,
      org: orgEl ? orgEl.value : getActiveOrgs(),
      typ: typEl ? typEl.value : 'УСН',
      qSum: sum,
      mSum: sum
    });
    amtEl.value = '';
    pSave();
    if (typeof window.render === 'function') window.render();
    alert('Налог записан целиком в ' + per + ': ' + fmtR(sum));
  };

  window.p4TaxDebtAdd = function () {
    const e = ensureStore();
    e.taxDebts.unshift({
      org: document.getElementById('td-org').value,
      tax: document.getElementById('td-tax').value,
      debt: num(document.getElementById('td-amt').value)
    });
    pSave();
    renderExpAddons();
  };

  window.p4PayOpAdd = function () {
    const e = ensureStore();
    const emp = document.getElementById('zp-emp').value;
    const amt = num(document.getElementById('zp-amt').value);
    if (!emp || amt <= 0) return alert('Выберите сотрудника и сумму!');
    const st = e.staffList.find(function (x) { return x.name === emp; });
    e.payrollOps.unshift({
      date: document.getElementById('zp-dt').value || today(),
      emp: emp,
      kind: document.getElementById('zp-kind').value,
      amt: amt,
      cur: st ? st.cur : 'RUB',
      art: st ? st.art : 'ФОТ склад'
    });
    pSave();
    renderExpAddons();
  };

  function renderExpAddons() {
    const sec = document.getElementById('tab-exp');
    if (!sec) return;
    const e = ensureStore();

    const txTyp = document.getElementById('tx-typ');
    if (txTyp && txTyp.dataset.p4 !== '1') {
      txTyp.innerHTML = optDict(e.dictTaxTypes, txTyp.value, '');
      txTyp.dataset.p4 = '1';
    }
    const txAmt = document.getElementById('tx-amt');
    if (txAmt && !document.getElementById('p4-tx-full-btn')) {
      const btn = document.createElement('button');
      btn.id = 'p4-tx-full-btn';
      btn.type = 'button';
      btn.className = 'btn btn-success';
      btn.style.marginTop = '6px';
      btn.textContent = '✅ Целиком за месяц';
      btn.onclick = window.p4TaxFullMonth;
      txAmt.parentNode.appendChild(btn);
    }

    let box = document.getElementById('p4-exp-addons');
    if (!box) {
      box = document.createElement('div');
      box.id = 'p4-exp-addons';
      sec.appendChild(box);
    }

    const tdRows = e.taxDebts.map(function (t, i) {
      return '<tr><td>' + esc(t.org) + '</td><td>' + esc(t.tax) + '</td>' +
        '<td class="num bold ' + (t.debt > 0 ? 'text-red' : 'text-green') + '">' + fmtR(t.debt) + '</td>' +
        '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'taxDebts\',' + i + ')">✕</button></td></tr>';
    }).join('');

    const staffActive = e.staffList.filter(function (s) { return !s.arch; }).map(function (s) { return s.name; });
    const zpBalances = e.staffList.filter(function (s) { return !s.arch; }).map(function (s) {
      let bal = num(s.initDebt);
      e.payrollOps.forEach(function (op) {
        if (op.emp === s.name) bal += (op.kind === 'Начислено' ? num(op.amt) : -num(op.amt));
      });
      return '<tr><td class="bold">' + esc(s.name) + '</td><td>' + esc(s.role) + '</td><td>' + esc(s.art) + '</td>' +
        '<td class="num">' + num(s.initDebt).toLocaleString('ru-RU') + ' ' + esc(s.cur) + '</td>' +
        '<td class="num bold ' + (bal > 0 ? 'text-red' : 'text-green') + '">' + bal.toLocaleString('ru-RU') + ' ' + esc(s.cur) + '</td></tr>';
    }).join('');

    box.innerHTML =
      '<div class="card"><div class="card-header"><div class="card-title">🏛️ Входящие налоговые долги / переплаты на 1 января</div></div>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
          '<div><label>Юрлицо</label><select id="td-org" class="select">' + optList(getActiveOrgs(), '', '') + '</select></div>' +
          '<div><label>Налог</label><select id="td-tax" class="select">' + optDict(e.dictTaxTypes, '', '') + '</select></div>' +
          '<div><label>Долг (+ ₽) / Переплата (− ₽)</label><input id="td-amt" type="number" class="input" placeholder="50000"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4TaxDebtAdd()">+ Записать</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Юрлицо</th><th>Налог</th><th class="num">Сальдо на 01.01</th><th></th></tr></thead><tbody>' +
        (tdRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Входящих налоговых долгов нет</td></tr>') + '</tbody></table>' +
      '</div>' +
      '<div class="card"><div class="card-header"><div class="card-title">👥 Зарплатная ведомость SKOS (RUB / USD)</div></div>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
          '<div><label>Дата</label><input id="zp-dt" type="date" class="input" value="' + today() + '"></div>' +
          '<div><label>Сотрудник</label><select id="zp-emp" class="select">' + optList(staffActive, '', '— Сотрудник —') + '</select></div>' +
          '<div><label>Операция</label><select id="zp-kind" class="select"><option>Начислено</option><option>Выплачено</option></select></div>' +
          '<div><label>Сумма (в валюте сотр.)</label><input id="zp-amt" type="number" class="input" placeholder="50000"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4PayOpAdd()">+ Провести</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Сотрудник</th><th>Должность</th><th>Статья</th><th class="num">Долг на 01.01</th><th class="num">Текущий остаток</th></tr></thead><tbody>' +
        (zpBalances || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Добавьте сотрудников в Справочниках</td></tr>') + '</tbody></table>' +
      '</div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 6Б: Контрагенты, ОС, ДДС CSV, Баланс и запуск) === */
  window.p4CtrOpAdd = function () {
    const e = ensureStore();
    const ctr = document.getElementById('ctr-sel').value;
    const amt = num(document.getElementById('ctr-amt').value);
    if (!ctr || amt <= 0) return alert('Выберите контрагента и сумму!');
    const info = e.contractors.find(function (c) { return c.name === ctr; });
    e.contractorOps.unshift({
      date: document.getElementById('ctr-dt').value || today(),
      ctr: ctr,
      kind: document.getElementById('ctr-kind').value,
      amt: amt,
      cur: info ? info.cur : 'USD',
      art: info ? info.art : 'Закуп товара / сырья USD'
    });
    pSave();
    renderSupAddons();
  };

  window.p4OsAdd = function () {
    const e = ensureStore();
    const nm = document.getElementById('os-nm').value.trim();
    const pr = num(document.getElementById('os-pr').value);
    if (!nm || pr <= 0) return alert('Введите название ОС и стоимость!');
    e.osList.unshift({
      name: nm,
      qty: num(document.getElementById('os-qty').value) || 1,
      price: pr,
      months: num(document.getElementById('os-mo').value) || 36,
      passed: num(document.getElementById('os-pas').value) || 0,
      resp: document.getElementById('os-rsp').value.trim() || 'Склад',
      room: document.getElementById('os-rm').value.trim() || 'Цех'
    });
    pSave();
    renderSupAddons();
  };

  function calcOsTotals(e) {
    let initSum = 0, remSum = 0, moDep = 0;
    (e.osList || []).forEach(function (o) {
      const full = num(o.qty || 1) * num(o.price);
      const m = Math.max(1, num(o.months) || 24);
      const dep = full / m;
      const pas = Math.min(m, Math.max(0, num(o.passed)));
      initSum += full;
      remSum += Math.max(0, full - dep * pas);
      moDep += pas < m ? dep : 0;
    });
    return { initSum: initSum, remSum: remSum, moDep: moDep };
  }

  function renderSupAddons() {
    const sec = document.getElementById('tab-sup');
    if (!sec) return;
    const e = ensureStore();
    let box = document.getElementById('p4-sup-addons');
    if (!box) {
      box = document.createElement('div');
      box.id = 'p4-sup-addons';
      sec.insertBefore(box, sec.firstChild);
    }

    const activeCtrs = e.contractors.filter(function (c) { return !c.arch; });
    const ctrRows = activeCtrs.map(function (c) {
      let bal = num(c.initDebt);
      e.contractorOps.forEach(function (op) {
        if (op.ctr === c.name) bal += (op.kind === 'Акт / Начислено' ? num(op.amt) : -num(op.amt));
      });
      return '<tr><td class="bold">' + esc(c.name) + '</td><td>' + esc(c.art) + '</td>' +
        '<td class="num">' + num(c.initDebt).toLocaleString('ru-RU') + ' ' + esc(c.cur) + '</td>' +
        '<td class="num bold ' + (bal > 0 ? 'text-red' : 'text-green') + '">' + bal.toLocaleString('ru-RU') + ' ' + esc(c.cur) + '</td></tr>';
    }).join('');

    const osTot = calcOsTotals(e);
    const osRows = e.osList.map(function (o, i) {
      const full = num(o.qty || 1) * num(o.price);
      const m = Math.max(1, num(o.months) || 24);
      const dep = full / m;
      const rem = Math.max(0, full - dep * Math.min(m, num(o.passed)));
      return '<tr><td class="bold">' + esc(o.name) + '</td><td class="num">' + (o.qty || 1) + '</td>' +
        '<td class="num">' + fmtR(full) + '</td><td class="num">' + o.passed + '/' + m + ' мес</td>' +
        '<td class="num">' + fmtR(dep) + '</td><td class="num bold">' + fmtR(rem) + '</td><td>' + esc(o.room) + '</td>' +
        '<td class="num"><button class="btn btn-danger" onclick="p4DelRow(\'osList\',' + i + ')">✕</button></td></tr>';
    }).join('');

    box.innerHTML =
      '<div class="card"><div class="card-header"><div class="card-title">🤝 Контрагенты SKOS (RUB / USD)</div></div>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
          '<div><label>Дата</label><input id="ctr-dt" type="date" class="input" value="' + today() + '"></div>' +
          '<div><label>Контрагент</label><select id="ctr-sel" class="select">' + optList(activeCtrs.map(function (x) { return x.name; }), '', '— Контрагент —') + '</select></div>' +
          '<div><label>Операция</label><select id="ctr-kind" class="select"><option>Акт / Начислено</option><option>Оплачено</option></select></div>' +
          '<div><label>Сумма</label><input id="ctr-amt" type="number" step="0.01" class="input" placeholder="1000"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4CtrOpAdd()">+ Записать</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Контрагент</th><th>Статья</th><th class="num">Нач. долг</th><th class="num">Текущее сальдо (+ долг / − аванс)</th></tr></thead><tbody>' +
        (ctrRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Добавьте контрагентов в Справочниках</td></tr>') + '</tbody></table>' +
      '</div>' +
      '<div class="card"><div class="card-header"><div class="card-title">🖥️ Основные средства (ОС) и Амортизация</div>' +
        '<span class="badge badge-blue">Остаточная: ' + fmtR(osTot.remSum) + ' • Износ/мес: ' + fmtR(osTot.moDep) + '</span></div>' +
        '<div class="form-grid" style="margin-bottom:10px">' +
          '<div><label>Наименование ОС</label><input id="os-nm" class="input" placeholder="Швейная машина"></div>' +
          '<div><label>Кол-во</label><input id="os-qty" type="number" class="input" value="1"></div>' +
          '<div><label>Цена ед. ₽</label><input id="os-pr" type="number" class="input" placeholder="45000"></div>' +
          '<div><label>Срок (мес)</label><input id="os-mo" type="number" class="input" value="36"></div>' +
          '<div><label>Прошло мес</label><input id="os-pas" type="number" class="input" value="0"></div>' +
          '<div><label>Локация</label><input id="os-rm" class="input" value="Цех ТМ"></div>' +
          '<div><label>Ответств.</label><input id="os-rsp" class="input" value="Касым"></div>' +
          '<div><button class="btn btn-primary" style="width:100%" onclick="p4OsAdd()">+ ОС</button></div>' +
        '</div>' +
        '<table><thead><tr><th>Объект</th><th class="num">Шт</th><th class="num">Баланс. ₽</th><th class="num">Срок</th><th class="num">Износ/мес</th><th class="num">Остаточная ₽</th><th>Где</th><th></th></tr></thead><tbody>' +
        (osRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8">Список ОС пуст</td></tr>') + '</tbody></table>' +
      '</div>';
  }
/* === SKOS Finance 3.0 — patch4.js (Часть 7: ДДС CSV, Баланс SKOS и запуск) === */
  window.p4DdsCsvImport = function (ev) {
    const file = ev && ev.target && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const txt = String(e.target.result || '').replace(/^\uFEFF/, '');
      const lines = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
      if (lines.length < 2) return alert('CSV файл пуст.');
      const sep = lines.indexOf(';') >= 0 ? ';' : ',';
      const hdr = lines.split(sep).map(function (h) { return h.replace(/^"|"$/g, '').trim().toLowerCase(); });
      const idx = function (rx) { return hdr.findIndex(function (h) { return rx.test(h); }); };
      const iDt = idx(/дата/);
      const iWal = idx(/сч[её]т|банк|касс|орг/);
      const iSum = idx(/сумм|приход|расход/);
      const iDesc = idx(/назначен|коммент|описан|стать/);
      const iDoc = idx(/номер|док|п\/п|id/);

      if (!Array.isArray(window.db.dds)) window.db.dds = [];
      if (!window.db.ddsHashes || typeof window.db.ddsHashes !== 'object') window.db.ddsHashes = {};
      const defWal = (window.db.orgs && window.db.orgs) ? window.db.orgs.id : 'o1';
      let added = 0, skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(function (c) { return c.replace(/^"|"$/g, '').trim(); });
        const dt = iDt >= 0 ? cols[iDt] : today();
        const wal = iWal >= 0 && cols[iWal] ? cols[iWal] : defWal;
        const rawAmt = iSum >= 0 ? num(cols[iSum]) : 0;
        const desc = iDesc >= 0 ? cols[iDesc] : 'Выписка CSV';
        const docNo = iDoc >= 0 ? cols[iDoc] : String(i);
        if (rawAmt === 0) continue;

        const uniqKey = [dt, wal, rawAmt.toFixed(2), desc, docNo].join('|');
        if (window.db.ddsHashes[uniqKey]) {
          skipped++;
          continue;
        }
        window.db.ddsHashes[uniqKey] = true;
        window.db.dds.unshift({
          id: 'dds_' + Date.now() + '_' + i,
          date: dt,
          wal: wal,
          type: rawAmt >= 0 ? 'IN' : 'OUT',
          cat: desc,
          amt: Math.abs(rawAmt),
          cur: 'RUB',
          comment: (docNo ? '№' + docNo + ' ' : '') + desc
        });
        added++;
      }
      pSave();
      if (typeof window.render === 'function') window.render();
      alert('Импорт ДДС завершён!\nДобавлено операций: ' + added + '\nПропущено дублей: ' + skipped);
    };
    reader.readAsText(file, 'UTF-8');
  };

  function renderDdsAddons() {
    const sec = document.getElementById('tab-dds');
    if (!sec) return;
    if (document.getElementById('p4-dds-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'p4-dds-bar';
    bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;';
    bar.innerHTML =
      '<label class="btn btn-primary" style="cursor:pointer">📥 Загрузить CSV (без пропусков в один день)' +
        '<input type="file" accept=".csv" style="display:none" onchange="p4DdsCsvImport(event)">' +
      '</label>' +
      '<button type="button" class="btn" onclick="tab(\'dict\');p4DictSub(\'dds\')">📚 Справочник статей ДДС</button>';
    sec.insertBefore(bar, sec.firstChild);
  }

  function renderDashBalance() {
    const sec = document.getElementById('tab-dash');
    if (!sec) return;
    const e = ensureStore();
    const rate = rateNow();
    const st = calcStockBalances(e);
    updateDashFrozenCard(st);
    const osTot = calcOsTotals(e);

    let cashRub = 0;
    const initB = (window.db && window.db.initBalances) || {};
    Object.keys(initB).forEach(function (k) {
      const isUsd = String(k).indexOf('c3') >= 0 || String(k).indexOf('c4') >= 0 || String(k).indexOf('c5') >= 0 || String(k).indexOf('c6') >= 0;
      cashRub += num(initB[k]) * (isUsd ? rate : 1);
    });
    ((window.db && window.db.dds) || []).forEach(function (d) {
      const sign = (d.type === 'OUT' || d.dir === 'out') ? -1 : 1;
      const mult = (d.cur === 'USD') ? rate : 1;
      cashRub += sign * num(d.amt) * mult;
    });

    const stocksRub = st.totalUsd * rate;
    const osRub = osTot.remSum;
    const taxDebtRub = (e.taxDebts || []).reduce(function (s, t) { return s + num(t.debt); }, 0);
    const equityRub = cashRub + stocksRub + osRub - taxDebtRub;

    let card = document.getElementById('p4-dash-balance');
    if (!card) {
      card = document.createElement('div');
      card.id = 'p4-dash-balance';
      card.className = 'card';
      sec.appendChild(card);
    }
    card.innerHTML =
      '<div class="card-header"><div class="card-title">⚖️ Управленческий БАЛАНС SKOS (в реальном времени)</div>' +
      '<span class="badge badge-blue">Курс: ' + rate + ' ₽/$</span></div>' +
      '<div class="kpi-grid">' +
        '<div class="kpi-card"><div style="font-size:11px;color:#64748b">💰 Деньги (ДДС + кассы)</div><div class="kpi-val">' + fmtR(cashRub) + '</div></div>' +
        '<div class="kpi-card"><div style="font-size:11px;color:#64748b">🏭 Запасы (Сырьё+НЗП+ГП)</div><div class="kpi-val">' + fmtR(stocksRub) + '</div><div class="kpi-sub">' + fmtU(st.totalUsd) + '</div></div>' +
        '<div class="kpi-card"><div style="font-size:11px;color:#64748b">🖥️ Остаточная ст-ть ОС</div><div class="kpi-val">' + fmtR(osRub) + '</div></div>' +
        '<div class="kpi-card"><div style="font-size:11px;color:#64748b">🏛️ Налоговые долги</div><div class="kpi-val text-red">− ' + fmtR(taxDebtRub) + '</div></div>' +
        '<div class="kpi-card highlight"><div style="font-size:11px;color:#1d4ed8;font-weight:700">💎 СОБСТВЕННЫЙ КАПИТАЛ</div><div class="kpi-val ' + (equityRub >= 0 ? 'text-green' : 'text-red') + '">' + fmtR(equityRub) + '</div></div>' +
      '</div>';
  }

  function runAllP4Renders() {
    ensureStore();
    ensureExtraTabs();
    initTabGuardObserver();
    renderDashBalance();
    renderUeTab();
    renderStkTab();
    renderDdsAddons();
    renderExpAddons();
    renderSupAddons();
    renderDictTab();
    if (window.db && window.db.tab) applyTabVisibility(window.db.tab);
  }

  const _origRender = window.render;
  window.render = function () {
    if (typeof _origRender === 'function') _origRender.apply(this, arguments);
    runAllP4Renders();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllP4Renders);
  } else {
    setTimeout(runAllP4Renders, 60);
  }
})();
