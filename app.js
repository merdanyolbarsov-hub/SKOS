/* === SKOS Finance 3.0 — Чистое турбо-ядро (Часть 1/10) === */
(function () {
  'use strict';
  if (window.__SKOS_TURBO_CORE__) return;
  window.__SKOS_TURBO_CORE__ = true;

  window._CFG = {
    KEY: 'skos_v3_prod',
    FMAP: 'skos_v3_folder_names',
    URL: 'https://supabase.co',
    KEY_API: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdWR2bnp5cXJ4eGFsaWtjbWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NTEwNzYsImV4cCI6MjExMDMyNzA3Nn0.cgCy3KoqjKuJaI4gzG8_nIlv20JttvAg7UgwTVQ-qwE',
    OWNER: 'Skos#9482!Tm',
    VIEW: 'SkosView2026'
  };

  window.esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  window.num = v => { if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const n = parseFloat(String(v == null ? 0 : v).replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  window.normStr = v => String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim();
  window.normKey = v => window.normStr(v).toLowerCase().replace(/[\s\-_]+/g, '');
  window.fmtR = n => Math.round(window.num(n)).toLocaleString('ru-RU') + ' ₽';
  window.fmtU = n => window.num(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
  window.today = () => new Date().toISOString().slice(0, 10);
  window.getFolderNames = () => { try { return JSON.parse(localStorage.getItem(window._CFG.FMAP) || '{}'); } catch (e) { return {}; } };
  window.setFolderName = (a, t) => { const m = window.getFolderNames(); m[a] = t; try { localStorage.setItem(window._CFG.FMAP, JSON.stringify(m)); } catch (e) {} };

  window.db = {
    tab: 'dash', mode: 'FULL', rates: { '2026-11': 80 }, locked: {}, initBalances: {},
    orgs: [
      { id: 'o1', name: 'ИП Каримов Артем', bank: 'ВТБ' }, { id: 'o2', name: 'ИП Джуманиязова Мавлюда', bank: 'Альфа-Банк' },
      { id: 'o3', name: 'ИП Джуманиязова Мавлюда', bank: 'Точка' }, { id: 'o4', name: 'ИП Джуманиязова Эльмира', bank: 'Альфа-Банк' },
      { id: 'o5', name: 'ИП Тыррыков Курбан', bank: 'ВТБ' }, { id: 'o6', name: 'ИП Керимов Сахет', bank: 'ВТБ' },
      { id: 'o7', name: 'ООО «Скос»', bank: 'Расчётный счёт ООО' }
    ],
    cashWallets: [
      { id: 'c1', name: 'Наличные RUB (Главный)', cur: 'RUB' }, { id: 'c2', name: 'Склад Москва RUB', cur: 'RUB' },
      { id: 'c3', name: 'Наличные USD Главный', cur: 'USD' }, { id: 'c4', name: 'Наличные USD Китай', cur: 'USD' },
      { id: 'c5', name: 'Наличные USD Туркменистан', cur: 'USD' }, { id: 'c6', name: 'Касым Туркменистан USD', cur: 'USD' }
    ],
    skus: [], reports: [], itemSales: [], dds: [], ddsHashes: {}, ddsCats: [], taxes: [], expenses: [],
    cloud: { url: window._CFG.URL, key: window._CFG.KEY_API, pin: window._CFG.OWNER }, erp: {}
  };
  /* === Часть 2/10: Турбо-ускоритель файлов, Индекс-поиск товаров и Справочники === */
  const DEFAULT_CATS = [
    { id: 'c_1', grp: 'Поступления', name: 'Поступление от ВБ' }, { id: 'c_2', grp: 'Поступления', name: 'Поступление от Озон' },
    { id: 'c_3', grp: 'Поступления', name: 'Поступление от ЯМ' }, { id: 'c_4', grp: 'Поступления', name: 'Оптовые продажи / Безнал' },
    { id: 'c_5', grp: 'Поступления', name: 'Вклады от собственников RUB' }, { id: 'c_6', grp: 'Поступления', name: 'Прочие поступления' },
    { id: 'c_10', grp: 'Закуп и логистика', name: 'Закуп товара RUB' }, { id: 'c_11', grp: 'Закуп и логистика', name: 'Закуп товара USD' },
    { id: 'c_12', grp: 'Закуп и логистика', name: 'Сертификация товара' }, { id: 'c_13', grp: 'Закуп и логистика', name: 'Доставка по РФ до склада' },
    { id: 'c_14', grp: 'Закуп и логистика', name: 'Доставка из Китая' }, { id: 'c_15', grp: 'Закуп и логистика', name: 'Доставка из Турции' },
    { id: 'c_16', grp: 'Закуп и логистика', name: 'Федеральная таможенная служба' },
    { id: 'c_20', grp: 'Зарплата (ФОТ)', name: 'ФОТ склад' }, { id: 'c_21', grp: 'Зарплата (ФОТ)', name: 'ФОТ менеджеры' },
    { id: 'c_22', grp: 'Зарплата (ФОТ)', name: 'ФОТ офис' }, { id: 'c_23', grp: 'Зарплата (ФОТ)', name: 'ФОТ собственник' },
    { id: 'c_30', grp: 'Авто, командировки, офис', name: 'Авто расходы компании' }, { id: 'c_31', grp: 'Авто, командировки, офис', name: 'Командировки RUB' },
    { id: 'c_32', grp: 'Авто, командировки, офис', name: 'Аренда склада' }, { id: 'c_33', grp: 'Авто, командировки, офис', name: 'Содержание офиса' },
    { id: 'c_34', grp: 'Авто, командировки, офис', name: 'Программное обеспечение (1С / сервисы)' }, { id: 'c_35', grp: 'Авто, командировки, офис', name: 'Прочие расходы' },
    { id: 'c_40', grp: 'Налоги и банк', name: 'Комиссия РКО' }, { id: 'c_41', grp: 'Налоги и банк', name: 'АУСН' },
    { id: 'c_42', grp: 'Налоги и банк', name: 'УСН' }, { id: 'c_43', grp: 'Налоги и банк', name: 'НДС' }, { id: 'c_44', grp: 'Налоги и банк', name: 'ЕНП' },
    { id: 'c_50', grp: 'Переводы, валюта, ОС', name: 'Поступление — Перевод между счетами' }, { id: 'c_51', grp: 'Переводы, валюта, ОС', name: 'Выбытие — Перевод между счетами' }
  ];

  window.ensureStore = function () {
    if (!window.db || typeof window.db !== 'object') window.db = {};
    if (!window.db.erp || typeof window.db.erp !== 'object') window.db.erp = {};
    const e = window.db.erp;
    ['materials', 'matIn', 'orders', 'bom', 'fgStocks', 'defects', 'osList', 'contractors', 'contractorOps', 'staffList', 'payrollOps', 'taxDebts', 'customDictFolders'].forEach(k => { if (!Array.isArray(e[k])) e[k] = []; });
    if (!Array.isArray(e.dictMatCats) || !e.dictMatCats.length) e.dictMatCats = [{ name: 'Ткань', arch: false }, { name: 'Фурнитура', arch: false }, { name: 'Упаковка и бирки', arch: false }, { name: 'Услуги пошива', arch: false }];
    if (!Array.isArray(e.dictUnits) || !e.dictUnits.length) e.dictUnits = [{ name: 'м2', arch: false }, { name: 'кг', arch: false }, { name: 'м', arch: false }, { name: 'шт', arch: false }, { name: 'усл', arch: false }];
    if (!Array.isArray(e.dictSuppliers) || !e.dictSuppliers.length) e.dictSuppliers = [{ name: 'Турция', arch: false }, { name: 'Китай', arch: false }, { name: 'РФ', arch: false }, { name: 'Туркменистан', arch: false }];
    if (!Array.isArray(e.dictTaxTypes) || !e.dictTaxTypes.length) e.dictTaxTypes = [{ name: 'АУСН', arch: false }, { name: 'УСН', arch: false }, { name: 'НДС', arch: false }, { name: 'ЕНП', arch: false }, { name: 'Взносы ИП', arch: false }, { name: 'Патент', arch: false }];
    if (!Array.isArray(e.dictOpiuArticles) || !e.dictOpiuArticles.length) e.dictOpiuArticles = [{ name: 'Аренда склада', arch: false }, { name: 'Программное обеспечение', arch: false }, { name: 'Административные и юридические услуги', arch: false }, { name: 'Федеральная таможенная служба', arch: false }, { name: 'Закуп товара / сырья USD', arch: false }, { name: 'Общепроизводственные расходы', arch: false }, { name: 'ФОТ и персонал', arch: false }];
    if (!Array.isArray(window.db.ddsCats) || !window.db.ddsCats.length) window.db.ddsCats = JSON.parse(JSON.stringify(DEFAULT_CATS));
    if (!e.dictSub) e.dictSub = 'opiu';
    if (!e.stkSub) e.stkSub = 'sum';
    return e;
  };

  // Индикатор прогресса для больших файлов (без заморозки браузера)
  window.showToastProgress = function (text, autoHideMs) {
    let el = document.getElementById('skos-turbo-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'skos-turbo-toast';
      el.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999;background:#0f172a;color:#fff;padding:11px 16px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,.3);border:1px solid #334155;';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.textContent = text;
    if (autoHideMs) setTimeout(() => { if (el) el.style.display = 'none'; }, autoHideMs);
  };

  // Мгновенный индекс 11 000+ ШК в памяти (Map)
  window.buildSkuIndex = function () {
    const byExact = new Map(), byClean = new Map(), byArt = new Map();
    const fNames = window.getFolderNames();
    (window.db.skus || []).forEach(s => {
      if (!s) return;
      const bc = window.normStr(s.bc), art = window.normStr(s.art);
      const kBc = window.normKey(bc).replace(/^0+/, '').replace(/^ozn/, '');
      const kArt = window.normKey(art);
      if (bc && (!byExact.has(bc) || window.num(s.usd) > 0)) byExact.set(bc, s);
      if (kBc && (!byClean.has(kBc) || window.num(s.usd) > 0)) byClean.set(kBc, s);
      if (kArt && (!byArt.has(kArt) || window.num(s.usd) > 0)) byArt.set(kArt, s);
    });
    return { byExact, byClean, byArt, fNames };
  };
  /* === Часть 3/10: Сохранение, Облако Supabase, Кнопка «+» и Быстрый рендер === */
  window.cleanSkus = function () {
    if (!window.db || !Array.isArray(window.db.skus)) return false;
    const seen = new Set();
    window.db.skus = window.db.skus.filter(s => {
      if (!s) return false;
      const bc = window.normStr(s.bc || s.barcode);
      if (!bc || seen.has(bc)) return false;
      seen.add(bc); s.bc = bc;
      const v = window.num(s.usd !== undefined ? s.usd : s.costUsd);
      if (v < 0 || v > 5000) { s.usd = 0; s.isNew = true; } else { s.usd = v; }
      return true;
    });
    return true;
  };

  let saveT = null;
  window.flushLocalSave = () => {
    if (!window.db) return;
    window.cleanSkus();
    try { localStorage.setItem(window._CFG.KEY, JSON.stringify(window.db)); } catch (e) {}
  };
  window.save = immediate => {
    if (window.__skosReadOnly) return;
    if (immediate) { clearTimeout(saveT); window.flushLocalSave(); return; }
    clearTimeout(saveT);
    saveT = setTimeout(window.flushLocalSave, 400);
  };
  window.addEventListener('beforeunload', window.flushLocalSave);

  window.curPer = () => (document.getElementById('f-yr')?.value || '2026') + '-' + (document.getElementById('f-mo')?.value || '11');
  window.getRate = per => { const p = per || window.curPer(); return (p && window.db?.rates && window.num(window.db.rates[p]) > 0) ? window.num(window.db.rates[p]) : (window.num(localStorage.getItem('skos_manual_default_rate')) || 80); };
  window.setRate = v => { if (window.__skosReadOnly) return; const p = window.curPer(); if (window.db.locked?.[p]) return alert('Месяц закрыт!'); const n = window.num(v); if (n > 0) { if (!window.db.rates) window.db.rates = {}; window.db.rates[p] = n; localStorage.setItem('skos_manual_default_rate', String(n)); window.save(); window.render(); } };
  window.onPerChange = () => { const p = window.curPer(); const r = document.getElementById('usd-rate'), b = document.getElementById('lock-btn'); if (r) r.value = window.getRate(p); if (b) b.textContent = window.db.locked?.[p] ? '🔒 Закрыт' : '🔓 Открыт'; window.render(); };
  window.toggleLock = () => { if (!window.__skosReadOnly) { const p = window.curPer(); if (!window.db.locked) window.db.locked = {}; window.db.locked[p] = !window.db.locked[p]; window.save(true); window.onPerChange(); } };
  window.setMode = m => { window.db.mode = m; document.getElementById('m-full').className = m === 'FULL' ? 'btn btn-primary' : 'btn'; document.getElementById('m-mp').className = m === 'MP' ? 'btn btn-primary' : 'btn'; window.render(); };
  window.openMan = () => document.getElementById('m-man')?.classList.remove('hidden');
  window.openTransferModal = () => { document.getElementById('m-trf')?.classList.remove('hidden'); if (window.calcTrf) window.calcTrf(); };
  window.closeModals = () => { document.getElementById('m-man')?.classList.add('hidden'); document.getElementById('m-trf')?.classList.add('hidden'); };

  window.quickAdd = function (type, title, selectId) {
    if (window.__skosReadOnly) return;
    const val = prompt('Добавить новое в «' + title + '»:');
    if (!val || !val.trim()) return;
    const nm = val.trim(), e = window.ensureStore();
    if (type === 'orgs') { const b = prompt('Банк / счёт:', 'ВТБ') || 'Расчётный счёт'; window.db.orgs.push({ id: 'o_' + Date.now(), name: nm, bank: b.trim() }); }
    else if (type === 'ddsCats') { const g = prompt('Папка (Поступления / Закуп и логистика / Зарплата (ФОТ) / Налоги и банк / Авто, командировки, офис):', 'Авто, командировки, офис') || 'Прочее'; window.db.ddsCats.push({ id: 'cat_' + Date.now(), grp: g.trim(), name: nm }); }
    else if (type === 'models') { const art = prompt('Код артикула (например SKOS-NEW):', nm) || nm; window.setFolderName(art.trim(), nm); if (!window.db.skus.some(s => window.normStr(s.art) === art.trim())) window.db.skus.unshift({ id: 's_' + Date.now(), name: nm, art: art.trim(), col: '—', siz: '—', bc: art.trim(), usd: 0, src: 'Вручную', isNew: true }); }
    else if (type === 'materials') { const u = prompt('Ед. измерения (шт, м, м2, кг):', 'шт') || 'шт'; e.materials.unshift({ name: nm, cat: 'Ткань', unit: u.trim(), initQty: 0, initUsd: 0 }); }
    else if (type === 'staffList') { const r = prompt('Должность:', 'Менеджер') || ''; e.staffList.unshift({ name: nm, role: r.trim(), art: 'ФОТ менеджеры', cur: 'RUB', initDebt: 0, arch: false }); }
    else if (type === 'contractors') { e.contractors.unshift({ name: nm, art: 'Аренда склада', cur: 'RUB', initDebt: 0, arch: false }); }
    else if (Array.isArray(e[type])) { const ex = e[type].find(x => x.name.toLowerCase() === nm.toLowerCase()); if (ex) ex.arch = false; else e[type].unshift({ name: nm, arch: false }); }
    window.save(true); window.render();
    if (selectId) setTimeout(() => { const el = document.getElementById(selectId); if (el) el.value = nm; }, 30);
  };

  window.withPlusBtn = (lbl, type, title, selId) => window.__skosReadOnly
    ? '<label>' + lbl + '</label>'
    : `<label style="display:flex;justify-content:space-between;align-items:center"><span>${lbl}</span><button type="button" class="btn" style="padding:0 6px;font-size:11px;line-height:1.3;background:#eff6ff;color:#1d4ed8;border-color:#93c5fd" onclick="quickAdd('${type}','${title}','${selId}')">+</button></label>`;

  window.pushCloud = async function (manual) {
    if (window.__skosReadOnly) return;
    window.flushLocalSave();
    const { URL: U, KEY_API: K, OWNER: P } = window._CFG;
    const url = ((window.db.cloud?.url) || U).trim().replace(/\/$/, ''), key = ((window.db.cloud?.key) || K).trim(), pin = ((window.db.cloud?.pin) || P).trim();
    window.showToastProgress('⏳ Сохранение в облако Supabase...');
    try {
      const skus = window.db.skus || [], sales = window.db.itemSales || [], sz = 4000;
      const sc = Math.max(1, Math.ceil(skus.length / sz)), salc = Math.ceil(sales.length / sz);
      const mainPayload = Object.assign({}, window.db, { skus: [], itemSales: [], ddsHashes: {}, skusChunks: sc, salesChunks: salc });
      const hdrs = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates', 'x-skos-pin': pin };
      const sendRow = async (id, payload) => { const r = await fetch(url + '/rest/v1/skos_cloud?on_conflict=id', { method: 'POST', headers: hdrs, body: JSON.stringify([{ id, payload, updated_at: new Date().toISOString() }]) }); if (!r.ok) throw new Error(id + ' (' + r.status + ')'); };
      await sendRow('main', mainPayload);
      for (let c = 0; c < sc; c++) { window.showToastProgress(`⏳ Выгрузка товаров: ${c + 1}/${sc}...`); await sendRow('skus_' + c, skus.slice(c * sz, (c + 1) * sz).map(s => ({ n: s.name, a: s.art, c: s.col, z: s.siz, b: s.bc, u: s.usd }))); }
      for (let s = 0; s < salc; s++) { window.showToastProgress(`⏳ Выгрузка продаж: ${s + 1}/${salc}...`); await sendRow('sales_' + s, sales.slice(s * sz, (s + 1) * sz)); }
      window.showToastProgress('✅ Облако синхронизировано!', 2500);
      if (manual) alert('✅ Сохранено в облако!\n• ШК: ' + skus.length + ' шт.\n• Отчётов: ' + (window.db.reports || []).length);
    } catch (e) { window.showToastProgress('❌ Ошибка облака', 3000); if (manual) alert('❌ Ошибка облака: ' + e.message); }
  };
  /* === Часть 4/10: Загрузка из Облака при F5, Бэкап и Навигация === */
  window.pullCloud = async function (silent) {
    const { URL: U, KEY_API: K, OWNER: P } = window._CFG;
    const url = ((window.db.cloud?.url) || U).trim().replace(/\/$/, ''), key = ((window.db.cloud?.key) || K).trim(), pin = ((window.db.cloud?.pin) || P).trim();
    const hdrs = { apikey: key, Authorization: 'Bearer ' + key, 'x-skos-pin': pin };
    try {
      const rMain = await fetch(url + '/rest/v1/skos_cloud?id=eq.main&select=payload', { headers: hdrs });
      if (!rMain.ok) return;
      const rows = await rMain.json();
      if (!Array.isArray(rows) || !rows.length || !rows[0].payload) return;
      const data = rows[0].payload;

      const sc = Number(data.skusChunks || 0);
      if (sc > 0 && (!Array.isArray(data.skus) || !data.skus.length)) {
        const allSkus = [];
        for (let c = 0; c < sc; c++) {
          const rSku = await fetch(url + '/rest/v1/skos_cloud?id=eq.skus_' + c + '&select=payload', { headers: hdrs });
          if (rSku.ok) {
            const sRows = await rSku.json();
            if (Array.isArray(sRows) && sRows[0] && Array.isArray(sRows[0].payload)) {
              sRows[0].payload.forEach((it, i) => allSkus.push({
                id: 's_' + c + '_' + i, name: it.n || it.name || it.a || 'Товар',
                art: it.a || it.art || '', col: it.c || it.col || '—', siz: it.z || it.s || it.siz || '—',
                bc: it.b || it.bc || it.barcode || '', usd: window.num(it.u !== undefined ? it.u : (it.usd || 0))
              }));
            }
          }
        }
        if (allSkus.length) data.skus = allSkus;
      }

      const salc = Number(data.salesChunks || 0);
      if (salc > 0 && (!Array.isArray(data.itemSales) || !data.itemSales.length)) {
        const allSales = [];
        for (let s = 0; s < salc; s++) {
          const rSal = await fetch(url + '/rest/v1/skos_cloud?id=eq.sales_' + s + '&select=payload', { headers: hdrs });
          if (rSal.ok) {
            const slRows = await rSal.json();
            if (Array.isArray(slRows) && slRows[0] && Array.isArray(slRows[0].payload)) allSales.push(...slRows[0].payload);
          }
        }
        if (allSales.length) data.itemSales = allSales;
      }

      Object.assign(window.db, data);
      window.db.cloud = { url, key, pin };
      window.ensureStore();
      window.flushLocalSave();
      window.onPerChange();
      if (!silent) alert('✅ База успешно загружена из облака!');
    } catch (e) { if (!silent) alert('❌ Ошибка чтения из облака: ' + e.message); }
  };

  window.syncCloud = manual => manual ? window.pushCloud(true) : window.pullCloud(true);
  window.saveCloudCfg = () => {
    const { URL: U, KEY_API: K, OWNER: P } = window._CFG;
    window.db.cloud = {
      url: (document.getElementById('sb-url')?.value || U).trim(),
      key: (document.getElementById('sb-key')?.value || K).trim(),
      pin: (document.getElementById('sb-pin')?.value || P).trim()
    };
    window.save(true); window.pushCloud(true);
  };

  window.exportJson = () => {
    window.flushLocalSave();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(window.db)], { type: 'application/json;charset=utf-8' }));
    a.download = 'SKOS_3_Backup_' + window.today() + '.json';
    a.click();
  };

  window.importJson = ev => {
    const f = ev?.target?.files?.[0]; if (!f) return;
    window.showToastProgress('⏳ Загрузка резервной копии...');
    const r = new FileReader();
    r.onload = e => {
      try {
        Object.assign(window.db, JSON.parse(e.target.result));
        window.db.cloud = { url: window._CFG.URL, key: window._CFG.KEY_API, pin: window._CFG.OWNER };
        window.ensureStore(); window.flushLocalSave(); window.onPerChange();
        window.showToastProgress('✅ Бэкап загружен!', 2500);
        alert('✅ Бэкап загружен! Нажмите «☁️ Облако», чтобы сохранить его на сервере.');
      } catch (err) { alert('❌ Ошибка файла: ' + err.message); }
    };
    r.readAsText(f, 'UTF-8'); ev.target.value = '';
  };

  window.ensureDictNav = () => {
    const navSet = document.getElementById('nav-set');
    if (navSet && !document.getElementById('nav-dict')) {
      const b = document.createElement('button');
      b.className = 'nav-btn'; b.id = 'nav-dict'; b.textContent = '📚 Справочники';
      b.onclick = () => window.tab('dict');
      navSet.insertAdjacentElement('afterend', b);
    }
    const main = document.querySelector('main.content');
    if (main && !document.getElementById('tab-dict')) {
      const s = document.createElement('section'); s.id = 'tab-dict'; s.className = 'hidden'; main.appendChild(s);
    }
  };

  const CRUMBS = {
    dash: 'SKOS / Сводка и 5 ИП + 1 ООО', abc: 'SKOS / Двойной ABC-анализ', rep: 'SKOS / Отчёты WB, Ozon и Яндекс Маркет',
    sku: 'SKOS / Товары, ШК и Себестоимость (32 папки)', stk: 'SKOS / Запасы, Брак и Фурнитура', dds: 'SKOS / ДДС, Выписки и Кассы',
    exp: 'SKOS / Расходы, Налоги и ЗПВ', sup: 'SKOS / Контрагенты и Основные средства', set: 'SKOS / Юрлица, Банки и Облако', dict: 'SKOS / Единые справочники'
  };

  window.tab = id => {
    window.ensureDictNav();
    window.db.tab = id;
    ['dash', 'abc', 'rep', 'sku', 'stk', 'dds', 'exp', 'sup', 'set', 'dict'].forEach(t => {
      document.getElementById('tab-' + t)?.classList.toggle('hidden', t !== id);
      document.getElementById('nav-' + t)?.classList.toggle('active', t === id);
    });
    const c = document.getElementById('crumb');
    if (c) c.textContent = (CRUMBS[id] || 'SKOS Finance 3.0') + (window.__skosReadOnly ? ' [👁️ ТОЛЬКО ПРОСМОТР]' : '');
    window.render();
  };

  let rafQueued = false;
  window.render = () => {
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(() => {
      rafQueued = false;
      window.ensureStore(); window.ensureDictNav();
      if (window.fillAllSelects) window.fillAllSelects();
      const act = window.db.tab || 'dash';
      const map = { dash: 'renderDashTab', abc: 'renderAbcTab', rep: 'renderRepTab', sku: 'renderSkuTab', stk: 'renderStkTab', dds: 'renderDdsTab', exp: 'renderExpTab', sup: 'renderSupTab', set: 'renderSetTab', dict: 'renderDictTab' };
      if (map[act] && typeof window[map[act]] === 'function') window[map[act]]();
      if (window.__skosReadOnly && window.applyGuestRestrictions) window.applyGuestRestrictions();
    });
  };
  /* === Часть 5/10: Сводка руководителя (KPI, ИП/ООО, МП и Лесенка прибыли) === */
  let dynMode = 'MONTH';
  let compareYears = ['2024', '2025', '2026'];
  window.setSkosDynMode = m => { dynMode = m; window.renderDashTab(); };
  window.toggleSkosYr = y => { const i = compareYears.indexOf(y); if (i >= 0) { if (compareYears.length > 1) compareYears.splice(i, 1); } else { compareYears.push(y); compareYears.sort(); } window.renderDashTab(); };
  window.addSkosYr = sel => { if (sel.value && !compareYears.includes(sel.value)) { compareYears.push(sel.value); compareYears.sort(); window.renderDashTab(); } sel.value = ''; };

  window.calcStockStats = function () {
    const e = window.ensureStore(), map = new Map();
    e.materials.forEach((m, idx) => { if (m && m.name) map.set(m.name, { idx, name: m.name, unit: m.unit || 'шт', cat: m.cat || 'Ткань', qty: window.num(m.initQty), usd: window.num(m.initUsd) }); });
    e.matIn.forEach(inc => { const c = map.get(inc.matName); if (c) { c.qty += window.num(inc.qty); c.usd += window.num(inc.totalUsd) || (window.num(inc.qty) * window.num(inc.priceUsd)); } });
    e.orders.forEach(o => { if (o && o.status === 'DONE') (o.lines || []).forEach(ln => { const c = map.get(ln.matName); if (c) { const ap = c.qty > 0 ? c.usd / c.qty : window.num(ln.priceUsd); c.qty -= window.num(ln.usedQty); c.usd -= window.num(ln.usedQty) * ap; } }); });
    let rawUsd = 0, wipUsd = 0, fgUsd = 0;
    const matRows = Array.from(map.values()).map(m => { if (m.usd > 0) rawUsd += m.usd; m.avg = m.qty > 0 ? m.usd / m.qty : 0; return m; });
    e.orders.forEach(o => { if (o && o.status === 'WIP') wipUsd += window.num(o.totalUsd); });
    e.fgStocks.forEach(f => { fgUsd += window.num(f.lockedUsd) || ((window.num(f.ruQty) + window.num(f.tmQty) + window.num(f.wayQty)) * window.num(f.unitUsd)); });
    return { matRows, rawUsd, wipUsd, fgUsd, totalUsd: rawUsd + wipUsd + fgUsd };
  };

  window.calcPeriodStats = function (yr, mo, orgF) {
    const rate = window.getRate((yr === 'ALL' ? '2026' : yr) + '-' + (mo === 'ALL' ? '11' : mo));
    const reps = (window.db.reports || []).filter(r => (yr === 'ALL' || String(r.yr) === String(yr)) && (mo === 'ALL' || String(r.mo) === String(mo)) && (orgF === 'ALL' || r.org === orgF));
    let rev = 0, ret = 0, ads = 0, log = 0, com = 0, cogs = 0, boSum = 0;
    reps.forEach(r => { rev += window.num(r.rev); ret += window.num(r.ret); ads += window.num(r.ads); log += window.num(r.log); com += window.num(r.com); cogs += window.num(r.cogs); boSum += window.num(r.bo); });
    const mpFee = ads + log + com, afterMp = rev - mpFee, mpProf = afterMp - cogs;

    let taxMonth = 0, expRub = 0, depMonth = 0, defectRub = 0;
    if (window.db.mode === 'FULL') {
      const kvMap = { 1: ['01', '02', '03'], 2: ['04', '05', '06'], 3: ['07', '08', '09'], 4: ['10', '11', '12'] };
      (window.db.taxes || []).forEach(t => {
        if ((yr === 'ALL' || String(t.yr) === String(yr)) && (orgF === 'ALL' || t.org === orgF)) {
          if (t.per) { if (mo === 'ALL' || t.per === yr + '-' + mo) taxMonth += window.num(t.mSum || t.amt); }
          else { const kvM = kvMap[t.kv] || []; if (mo === 'ALL') taxMonth += window.num(t.amt); else if (kvM.includes(mo)) taxMonth += window.num(t.amt) / 3; }
        }
      });
      (window.db.expenses || []).forEach(ex => { if ((yr === 'ALL' || String(ex.yr) === String(yr)) && (mo === 'ALL' || String(ex.mo) === String(mo)) && (orgF === 'ALL' || ex.org === orgF)) expRub += ex.cur === 'USD' ? window.num(ex.amt) * rate : window.num(ex.amt); });
      const e = window.ensureStore();
      depMonth = e.osList.reduce((s, o) => s + ((window.num(o.qty || 1) * window.num(o.price)) / Math.max(1, window.num(o.months) || 24)), 0) * (mo === 'ALL' ? 12 : 1);
      defectRub = e.defects.filter(d => (yr === 'ALL' || String(d.date).startsWith(yr)) && (mo === 'ALL' || String(d.date).slice(5, 7) === mo)).reduce((s, d) => s + window.num(d.qty) * window.num(d.unitUsd) * rate, 0);
    }
    const net = window.db.mode === 'FULL' ? (mpProf - taxMonth - expRub - depMonth - defectRub) : mpProf;
    return { rev, ret, ads, log, com, mpFee, afterMp, cogs, mpProf, taxMonth, expRub, depMonth, defectRub, net, bo: reps.length ? Math.round(boSum / reps.length) : 0 };
  };

  window.renderDashTab = function () {
    const yr = document.getElementById('f-yr')?.value || '2026', mo = document.getElementById('f-mo')?.value || '11', orgF = document.getElementById('f-org')?.value || 'ALL', cmp = document.getElementById('f-cmp')?.value || 'MOM';
    const rate = window.getRate(yr + '-' + mo);
    document.getElementById('h-rate').textContent = rate + ' ₽/$';
    const st = window.calcPeriodStats(yr, mo, orgF);
    let pYr = yr, pMo = mo;
    if (cmp === 'YOY' && yr !== 'ALL') pYr = String(Number(yr) - 1);
    else if (cmp === 'MOM' && mo !== 'ALL') { const mN = Number(mo); if (mN === 1) { pMo = '12'; if (yr !== 'ALL') pYr = String(Number(yr) - 1); } else pMo = String(mN - 1).padStart(2, '0'); }
    const prev = window.calcPeriodStats(pYr, pMo, orgF);
    const diffPct = prev.net !== 0 ? (((st.net - prev.net) / Math.abs(prev.net)) * 100).toFixed(1) : '0.0';

    document.getElementById('k-rev').textContent = window.fmtR(st.rev);
    document.getElementById('k-ret').textContent = 'Возвраты: ' + window.fmtR(st.ret);
    document.getElementById('k-bo').textContent = 'Выкуп ' + st.bo + '%';
    const kp = document.getElementById('k-prof'); kp.textContent = window.fmtR(st.net); kp.className = 'kpi-val ' + (st.net >= 0 ? 'text-green' : 'text-red');
    document.getElementById('k-mar').textContent = 'Маржа ' + (st.rev > 0 ? ((st.net / st.rev) * 100).toFixed(1) : '0.0') + '%';
    document.getElementById('k-cmp').textContent = (cmp === 'MOM' ? 'К прошл. мес.: ' : 'К прошл. году: ') + (Number(diffPct) >= 0 ? '+' : '') + diffPct + '%';
    document.getElementById('k-ads').textContent = window.fmtR(st.ads);
    document.getElementById('k-drr').textContent = 'ДРР ' + (st.rev > 0 ? ((st.ads / st.rev) * 100).toFixed(1) : '0.0') + '%';
    document.getElementById('k-fee').textContent = window.fmtR(st.log + st.com);

    const stk = window.calcStockStats();
    document.getElementById('k-frz').textContent = window.fmtR(stk.totalUsd * rate);
    document.getElementById('k-frz-u').textContent = 'В валюте: ' + window.fmtU(stk.totalUsd);
        /* === Часть 6А: Таблицы ИП/МП и Каскад прибыли === */
    const initB = window.db.initBalances || {};
    const yNum = yr === 'ALL' ? 2026 : parseInt(yr, 10);
    const visNames = [...new Set((window.db.orgs || []).filter(o => !o.closedYear || o.closedYear >= yNum).map(o => o.name))];
    document.getElementById('tb-orgs').innerHTML = visNames.map(on => {
      const os = window.calcPeriodStats(yr, mo, on);
      const bIds = window.db.orgs.filter(o => o.name === on).map(o => o.id);
      const bBal = bIds.reduce((s, id) => s + window.num(initB[id]), 0) + (window.db.dds || []).filter(d => bIds.includes(d.wal)).reduce((s, d) => s + window.num(d.amt), 0);
      return `<tr><td class="bold">${window.esc(on)}</td><td class="num bold">${window.fmtR(os.rev)}</td><td class="num text-red">${window.fmtR(os.ret)}</td><td class="num">${window.fmtR(os.mpFee)}</td><td class="num">${window.fmtR(os.cogs)}</td><td class="num">${window.fmtR(os.taxMonth)}</td><td class="num">${window.fmtR(os.expRub)}</td><td class="num bold ${os.net >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(os.net)}</td><td class="num bold">${window.fmtR(bBal)}</td></tr>`;
    }).join('');

    document.getElementById('tb-mps').innerHTML = ['WB', 'OZON', 'YM'].map(m => {
      const sub = (window.db.reports || []).filter(r => (yr === 'ALL' || String(r.yr) === yr) && (mo === 'ALL' || String(r.mo) === mo) && (orgF === 'ALL' || r.org === orgF) && r.mp === m);
      const r = sub.reduce((a, b) => a + window.num(b.rev), 0), rt = sub.reduce((a, b) => a + window.num(b.ret), 0), ad = sub.reduce((a, b) => a + window.num(b.ads), 0), lg = sub.reduce((a, b) => a + window.num(b.log), 0), cm = sub.reduce((a, b) => a + window.num(b.com), 0), cg = sub.reduce((a, b) => a + window.num(b.cogs), 0);
      const pr = r - ad - lg - cm - cg, bo = sub.length ? Math.round(sub.reduce((a, b) => a + window.num(b.bo), 0) / sub.length) + '%' : '—';
      return `<tr><td class="bold">${m}</td><td class="num bold">${window.fmtR(r)}</td><td class="num text-red">${window.fmtR(rt)}</td><td class="num">${window.fmtR(ad)}</td><td class="num">${window.fmtR(lg)}</td><td class="num">${window.fmtR(cm)}</td><td class="num">${window.fmtR(cg)}</td><td class="num">${bo}</td><td class="num bold ${pr >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(pr)}</td></tr>`;
    }).join('');

    let wf = `<div class="wf-row"><span>1. Чистая выручка маркетплейсов</span><span class="bold">${window.fmtR(st.rev)}</span></div>
      <div class="wf-row"><span>− Комиссия, логистика и услуги</span><span class="text-red">−${window.fmtR(st.com + st.log)}</span></div>
      <div class="wf-row"><span>− Реклама и выкупы</span><span class="text-red">−${window.fmtR(st.ads)}</span></div>
      <div class="wf-row"><span>− Себестоимость товаров</span><span class="text-red">−${window.fmtR(st.cogs)}</span></div>
      <div class="wf-row wf-sub"><span>= Маржинальная прибыль площадок</span><span>${window.fmtR(st.mpProf)}</span></div>`;
    if (window.db.mode === 'FULL') {
      wf += `<div class="wf-row"><span>− Налоги (1/3 кв. / мес.)</span><span class="text-red">−${window.fmtR(st.taxMonth)}</span></div>
        <div class="wf-row"><span>− Операционные расходы</span><span class="text-red">−${window.fmtR(st.expRub)}</span></div>
        <div class="wf-row"><span>− Амортизация и Брак</span><span class="text-red">−${window.fmtR(st.depMonth + st.defectRub)}</span></div>
        <div class="wf-row wf-tot ${st.net < 0 ? 'neg' : ''}"><span>= ЧИСТАЯ ПРИБЫЛЬ КОМПАНИИ</span><span>${window.fmtR(st.net)}</span></div>`;
    }
    document.getElementById('wf-box').innerHTML = wf;
    /* === Часть 6Б: Лесенка прибыли, Динамика и Баланс SKOS === */
    const dash = document.getElementById('tab-dash'), pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';
    let ladderBox = document.getElementById('skos-boss-ladder-box');
    if (!ladderBox) { ladderBox = document.createElement('div'); ladderBox.id = 'skos-boss-ladder-box'; dash.querySelector('.kpi-grid')?.insertAdjacentElement('afterend', ladderBox); }
    const ovh = st.taxMonth + st.expRub + st.depMonth + st.defectRub;
    ladderBox.innerHTML = `<div class="card" style="border:1.5px solid #bfdbfe;background:linear-gradient(180deg,#f8faff 0%,#ffffff 100%)">
      <div class="card-header"><div class="card-title">🪜 Лесенка прибыли для руководителя</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">
        <div style="background:#fff;border:1px solid #cbd5e1;border-left:4px solid #2563eb;border-radius:10px;padding:10px"><div style="font-size:11px;font-weight:700;color:#1d4ed8">1. ОСТАТОК ОТ МП (БЕЗ СЕБЕСТ.)</div><div style="font-size:19px;font-weight:800;margin:4px 0">${window.fmtR(st.afterMp)}</div><div style="font-size:11px;color:#475569">Нагрузка МП: <b class="text-red">${window.fmtR(st.mpFee)} (${pct(st.mpFee, st.rev)}%)</b></div></div>
        <div style="background:#fff;border:1px solid #cbd5e1;border-left:4px solid #d97706;border-radius:10px;padding:10px"><div style="font-size:11px;font-weight:700;color:#b45309">2. ЗАРАБОТОК НА ТОВАРЕ</div><div style="font-size:19px;font-weight:800;margin:4px 0">${window.fmtR(st.mpProf)}</div><div style="font-size:11px;color:#475569">Себестоимость: <b>${window.fmtR(st.cogs)} (${pct(st.cogs, st.rev)}%)</b></div></div>
        <div style="background:#fff;border:1px solid #cbd5e1;border-left:4px solid ${st.net >= 0 ? '#059669' : '#e11d48'};border-radius:10px;padding:10px"><div style="font-size:11px;font-weight:700;color:#047857">3. ЧИСТАЯ ПРИБЫЛЬ В КАРМАН</div><div style="font-size:19px;font-weight:800;margin:4px 0" class="${st.net >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(st.net)}</div><div style="font-size:11px;color:#475569">Налоги, ЗП и офис: <b>${window.fmtR(ovh)} (${pct(ovh, st.rev)}%)</b></div></div>
      </div></div>`;

    let dynBox = document.getElementById('skos-dyn-card');
    if (!dynBox) { dynBox = document.createElement('div'); dynBox.id = 'skos-dyn-card'; ladderBox.insertAdjacentElement('afterend', dynBox); }
    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const tYr = yr === 'ALL' ? '2026' : yr;
    let rowsData = [];
    if (dynMode === 'MONTH') rowsData = monthsRu.map((lb, i) => { const m = window.calcPeriodStats(tYr, String(i + 1).padStart(2, '0'), orgF); return { label: lb, rev: m.rev, fee: m.mpFee, cogs: m.cogs, prof: m.net }; });
    else if (dynMode === 'YEAR') rowsData = compareYears.map(y => { const m = window.calcPeriodStats(y, 'ALL', orgF); return { label: y + ' год', rev: m.rev, fee: m.mpFee, cogs: m.cogs, prof: m.net }; });
    else rowsData = (window.db.reports || []).filter(r => String(r.yr) === tYr && (mo === 'ALL' || String(r.mo) === mo) && (orgF === 'ALL' || r.org === orgF)).map((r, i) => ({ label: `Отчёт #${i + 1} (${r.mp} ${r.mo}.${r.yr})`, rev: window.num(r.rev), fee: window.num(r.com) + window.num(r.log) + window.num(r.ads), cogs: window.num(r.cogs), prof: window.num(r.rev) - window.num(r.com) - window.num(r.log) - window.num(r.ads) - window.num(r.cogs) }));
    const totR = rowsData.reduce((a, x) => a + Math.max(0, x.rev), 0);
    const yrChips = dynMode === 'YEAR' ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;font-size:12px"><b>Сравнить годы:</b> ${Array.from(new Set(['2024', '2025', '2026', ...compareYears])).sort().map(y => `<label style="padding:2px 7px;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer"><input type="checkbox" ${compareYears.includes(y) ? 'checked' : ''} onchange="toggleSkosYr('${y}')"> ${y}</label>`).join('')} <select class="select" style="width:auto;padding:2px 6px" onchange="addSkosYr(this)"><option value="">+ Год...</option>${Array.from({ length: 31 }, (_, i) => 2020 + i).map(y => `<option value="${y}">${y}</option>`).join('')}</select></div>` : '';
    dynBox.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📈 Динамика продаж и прибыли</div><div style="display:flex;gap:6px"><button class="btn ${dynMode === 'WEEK' ? 'btn-primary' : ''}" onclick="setSkosDynMode('WEEK')">📅 По отчётам</button><button class="btn ${dynMode === 'MONTH' ? 'btn-primary' : ''}" onclick="setSkosDynMode('MONTH')">🗓️ По месяцам</button><button class="btn ${dynMode === 'YEAR' ? 'btn-primary' : ''}" onclick="setSkosDynMode('YEAR')">📊 По годам</button></div></div>${yrChips}<div style="overflow-x:auto"><table><thead><tr><th>Период</th><th class="num">Выручка</th><th class="num">Доля %</th><th class="num">Нагрузка МП</th><th class="num">Себестоимость</th><th class="num">Прибыль</th></tr></thead><tbody>${rowsData.map(rw => `<tr><td class="bold">${rw.label}</td><td class="num bold">${window.fmtR(rw.rev)}</td><td class="num"><span class="badge badge-blue">${totR > 0 ? ((Math.max(0, rw.rev) / totR) * 100).toFixed(1) : '0.0'}%</span></td><td class="num">${window.fmtR(rw.fee)}</td><td class="num">${window.fmtR(rw.cogs)}</td><td class="num bold ${rw.prof >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(rw.prof)}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">Нет данных</td></tr>'}</tbody></table></div></div>`;

    const e = window.ensureStore();
    let cash = 0, osRem = 0;
    Object.keys(initB).forEach(k => { cash += window.num(initB[k]) * (/c[3-6]/.test(k) ? rate : 1); });
    (window.db.dds || []).forEach(d => { cash += window.num(d.amt) * (/c[3-6]/.test(d.wal) ? rate : 1); });
    e.osList.forEach(o => { const full = window.num(o.qty || 1) * window.num(o.price), m = Math.max(1, window.num(o.months) || 24); osRem += Math.max(0, full - (full / m) * Math.min(m, window.num(o.passed))); });
    const taxD = e.taxDebts.reduce((s, t) => s + window.num(t.debt), 0);
    const eq = cash + stk.totalUsd * rate + osRem - taxD;
    let balCard = document.getElementById('p4-bal');
    if (!balCard) { balCard = document.createElement('div'); balCard.id = 'p4-bal'; balCard.className = 'card'; dash.appendChild(balCard); }
    balCard.innerHTML = `<div class="card-header"><div class="card-title">⚖️ Управленческий БАЛАНС SKOS</div></div><div class="kpi-grid"><div class="kpi-card"><div>💰 Деньги</div><div class="kpi-val">${window.fmtR(cash)}</div></div><div class="kpi-card"><div>🏭 Запасы</div><div class="kpi-val">${window.fmtR(stk.totalUsd * rate)}</div></div><div class="kpi-card"><div>🖥️ ОС ост.</div><div class="kpi-val">${window.fmtR(osRem)}</div></div><div class="kpi-card"><div>🏛️ Налог. долг</div><div class="kpi-val text-red">− ${window.fmtR(taxD)}</div></div><div class="kpi-card highlight"><div>💎 КАПИТАЛ</div><div class="kpi-val ${eq >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(eq)}</div></div></div>`;
  };
  /* === Часть 7А: Индексный поиск товаров (Map) и фильтры Двойного ABC === */
  window.resolveMetaFast = function (idx, bcRaw, artRaw, nameRaw) {
    const bc = window.normStr(bcRaw), art = window.normStr(artRaw), name = window.normStr(nameRaw);
    const kBc = window.normKey(bc).replace(/^0+/, '').replace(/^ozn/, ''), kArt = window.normKey(art);
    let found = (bc && idx.byExact.get(bc)) || (kBc && idx.byClean.get(kBc)) || (kArt && idx.byArt.get(kArt)) || null;
    if (!found) {
      const m = (art + ' ' + name + ' ' + bc).toUpperCase().match(/\b(SKOS-[A-ZА-Я0-9]+)\b/);
      if (m) found = idx.byArt.get(window.normKey(m[1]));
    }
    const src = (name + ' ' + art + ' ' + bc).trim();
    const cm = src.match(/(черн[а-я]*|бел[а-я]*|бежев[а-я]*|сер[а-я\-]*|молочн[а-я]*|син[а-я]*|голуб[а-я]*|зелен[а-я]*|хаки|коричнев[а-я]*|бордов[а-я]*|красн[а-я]*|графит[а-я]*|шоколад[а-я]*)/i);
    const sm = src.match(/(?:^|[\sа-яА-Я\-_])(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|28|29|30|31|32|33|34|35|36|38|40|42|44|46|48|50|52|54|56|58|60)$/i);
    const pCol = cm ? cm[1].charAt(0).toUpperCase() + cm[1].slice(1).toLowerCase() : '—';
    const pSiz = sm ? sm[1].toUpperCase() : '—';

    if (found) {
      const fCode = window.normStr(found.art) || 'Без артикула';
      return { bc: bc || found.bc, art: fCode, modelTitle: idx.fNames[fCode] || found.name || fCode, usd: window.num(found.usd), col: (found.col && found.col !== '—' && found.col !== 'Базовый') ? found.col : pCol, siz: (found.siz && found.siz !== '—') ? found.siz : pSiz };
    }
    return { bc: bc || art || 'Неизвестный ШК', art: art || 'Без папки', modelTitle: name || art || bc || 'Товар', usd: 0, col: pCol, siz: pSiz };
  };

  window.clearAbcData = function () {
    if (window.__skosReadOnly || !window.db || !Array.isArray(window.db.itemSales)) return;
    const yr = document.getElementById('abc-f-yr')?.value || 'ALL', mo = document.getElementById('abc-f-mo')?.value || 'ALL', mp = document.getElementById('abc-f-mp')?.value || 'ALL', org = document.getElementById('abc-f-org')?.value || 'ALL';
    const isF = (yr !== 'ALL' || mo !== 'ALL' || mp !== 'ALL' || org !== 'ALL');
    if (!confirm(isF ? 'Очистить записи ABC ТОЛЬКО по выбранному фильтру?' : 'Очистить ВСЮ историю продаж для ABC-анализа?')) return;
    if (!isF) window.db.itemSales = [];
    else window.db.itemSales = window.db.itemSales.filter(it => !((yr === 'ALL' || String(it.yr) === yr) && (mo === 'ALL' || String(it.mo) === mo) && (mp === 'ALL' || String(it.mp) === mp) && (org === 'ALL' || String(it.org) === org)));
    window.save(true); window.renderAbcTab();
  };

  window.renderAbcTab = window.renderAbc = function () {
    const sec = document.getElementById('tab-abc');
    if (!sec || !window.db) return;
    const card = sec.querySelector('.card'), header = card?.querySelector('.card-header');
    if (header && !document.getElementById('abc-clear-btn') && !window.__skosReadOnly) {
      const b = document.createElement('button'); b.id = 'abc-clear-btn'; b.type = 'button'; b.className = 'btn btn-danger'; b.textContent = '🧹 Очистить ABC'; b.onclick = window.clearAbcData;
      header.children[1]?.appendChild(b);
    }
    if (header && !document.getElementById('skos-abc-filters')) {
      const fp = document.createElement('div'); fp.id = 'skos-abc-filters';
      fp.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:12px;';
      fp.innerHTML = `<div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">
        <div><label>Год</label><select id="abc-f-yr" class="select" onchange="renderAbcTab()"><option value="ALL">Все годы</option>${Array.from({ length: 31 }, (_, i) => 2020 + i).map(y => `<option value="${y}">${y}</option>`).join('')}</select></div>
        <div><label>Месяц</label><select id="abc-f-mo" class="select" onchange="renderAbcTab()"><option value="ALL">Все месяцы</option>${['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'].map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('')}</select></div>
        <div><label>Юрлицо</label><select id="abc-f-org" class="select" onchange="renderAbcTab()"></select></div>
        <div><label>Маркетплейс</label><select id="abc-f-mp" class="select" onchange="renderAbcTab()"><option value="ALL">Все МП</option><option value="WB">Wildberries</option><option value="OZON">Ozon</option><option value="YM">Яндекс Маркет</option></select></div>
        <div><label>Артикул / Папка</label><select id="abc-f-art" class="select" onchange="renderAbcTab()"></select></div>
        <div><label>Цвет</label><select id="abc-f-col" class="select" onchange="renderAbcTab()"></select></div>
        <div><label>Размер</label><select id="abc-f-siz" class="select" onchange="renderAbcTab()"></select></div>
      </div><div id="skos-abc-summary" style="margin-top:8px"></div>`;
      header.insertAdjacentElement('afterend', fp);
    }
    /* === Часть 7Б: Расчёт и таблица Двойного ABC-анализа === */
    const orgSel = document.getElementById('abc-f-org');
    if (orgSel) { const c = orgSel.value || 'ALL'; orgSel.innerHTML = '<option value="ALL">Все юрлица</option>' + [...new Set((window.db.orgs || []).map(o => o.name))].map(n => `<option value="${window.esc(n)}">${window.esc(n)}</option>`).join(''); orgSel.value = c; }

    const fYr = document.getElementById('abc-f-yr')?.value || 'ALL', fMo = document.getElementById('abc-f-mo')?.value || 'ALL', fOrg = document.getElementById('abc-f-org')?.value || 'ALL', fMp = document.getElementById('abc-f-mp')?.value || 'ALL';
    const fArt = document.getElementById('abc-f-art')?.value || 'ALL', fCol = document.getElementById('abc-f-col')?.value || 'ALL', fSiz = document.getElementById('abc-f-siz')?.value || 'ALL', mode = document.getElementById('abc-mode')?.value || 'MODEL';

    const skuIdx = window.buildSkuIndex();
    const groups = {}, artsSet = new Set(), colsSet = new Set(), sizsSet = new Set();
    let tS = 0, tR = 0, tRev = 0, tCog = 0, tFee = 0, tPr = 0;

    (window.db.itemSales || []).forEach(it => {
      const meta = window.resolveMetaFast(skuIdx, it.bc, it.art, it.name);
      if (meta.art) artsSet.add(meta.art);
      if (meta.col && meta.col !== '—') colsSet.add(meta.col);
      if (meta.siz && meta.siz !== '—') sizsSet.add(meta.siz);

      if (fYr !== 'ALL' && String(it.yr) !== fYr) return;
      if (fMo !== 'ALL' && String(it.mo) !== fMo) return;
      if (fOrg !== 'ALL' && String(it.org) !== fOrg) return;
      if (fMp !== 'ALL' && String(it.mp) !== fMp) return;
      if (fArt !== 'ALL' && meta.art !== fArt) return;
      if (fCol !== 'ALL' && meta.col !== fCol) return;
      if (fSiz !== 'ALL' && meta.siz !== fSiz) return;

      const rate = window.getRate(it.yr + '-' + it.mo);
      const sq = window.num(it.sQty), rq = window.num(it.rQty), rev = window.num(it.rev), fee = window.num(it.fee);
      const cog = Math.max(0, meta.usd * rate * (sq - rq)), pr = rev - fee - cog;
      tS += sq; tR += rq; tRev += rev; tCog += cog; tFee += fee; tPr += pr;

      let gk = meta.art, gTit = `${meta.art} — ${meta.modelTitle}`, gSub = `Папка: ${meta.art}`;
      if (mode === 'COLOR') { gk = meta.art + '||' + meta.col; gTit = `${meta.modelTitle} (${meta.col})`; gSub = `Арт: ${meta.art} • Цвет: ${meta.col}`; }
      else if (mode === 'SIZE') { gk = meta.art + '||' + meta.siz; gTit = `${meta.modelTitle} • Разм. ${meta.siz}`; gSub = `Арт: ${meta.art} • Размер: ${meta.siz}`; }
      else if (mode === 'SKU') { gk = meta.bc; gTit = `${meta.modelTitle} (${meta.bc})`; gSub = `${meta.art} • ${meta.col} • ${meta.siz}`; }

      if (!groups[gk]) groups[gk] = { tit: gTit, sub: gSub, sq: 0, rq: 0, rev: 0, cog: 0, pr: 0 };
      const g = groups[gk]; g.sq += sq; g.rq += rq; g.rev += rev; g.cog += cog; g.pr += pr;
    });

    const fillSel = (id, all, set) => { const el = document.getElementById(id); if (!el) return; const p = el.value || 'ALL'; el.innerHTML = `<option value="ALL">${all}</option>` + Array.from(set).sort().map(v => `<option value="${window.esc(v)}">${window.esc(v)}</option>`).join(''); if (set.has(p)) el.value = p; };
    fillSel('abc-f-art', 'Все артикулы', artsSet); fillSel('abc-f-col', 'Все цвета', colsSet); fillSel('abc-f-siz', 'Все размеры', sizsSet);

    const list = Object.values(groups).sort((a, b) => b.pr - a.pr);
    const posP = list.reduce((a, x) => a + Math.max(0, x.pr), 0);
    let cP = 0;

    const sumBox = document.getElementById('skos-abc-summary');
    if (sumBox) sumBox.innerHTML = `<div style="font-size:12px;padding:6px;background:#fff;border:1px solid #e2e8f0;border-radius:7px">Выкуплено: <b>${tS} шт.</b> | Возвраты: <b class="text-red">${tR} шт.</b> | Выручка: <b>${window.fmtR(tRev)}</b> | Себест.: <b>${window.fmtR(tCog)}</b> | Чистая прибыль: <b class="${tPr >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(tPr)}</b></div>`;

    const tbl = sec.querySelector('table');
    const hdrRow = tbl?.querySelector('thead tr');
    if (hdrRow && !hdrRow.dataset.unitCols) { hdrRow.dataset.unitCols = '1'; hdrRow.innerHTML += '<th class="num">Цена/шт</th><th class="num">Прибыль/шт</th>'; }
    const tbody = tbl?.querySelector('tbody');
    if (tbody) tbody.innerHTML = list.length ? list.map(x => {
      cP += Math.max(0, x.pr);
      const cls = (x.pr <= 0 || posP <= 0) ? 'C' : ((cP / posP) * 100 <= 80 ? 'A' : ((cP / posP) * 100 <= 95 ? 'B' : 'C'));
      const sh = posP > 0 ? ((Math.max(0, x.pr) / posP) * 100).toFixed(1) : '0.0';
      const nq = Math.max(1, x.sq - x.rq);
      return `<tr><td><span class="badge ${cls === 'A' ? 'badge-green' : (cls === 'B' ? 'badge-amber' : 'badge-red')}">${cls}</span></td><td class="bold">${window.esc(x.tit)}</td><td>${window.esc(x.sub)}</td><td class="num bold">${x.sq}</td><td class="num text-red">${x.rq}</td><td class="num">${window.fmtR(x.rev)}</td><td class="num">${window.fmtR(x.cog)}</td><td class="num bold ${x.pr >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(x.pr)}</td><td class="num">${sh}%</td><td class="num">${x.sq > 0 ? window.fmtR(x.rev / nq) : '0 ₽'}</td><td class="num bold ${x.pr >= 0 ? 'text-green' : 'text-red'}">${x.sq > 0 ? window.fmtR(x.pr / nq) : '0 ₽'}</td></tr>`;
    }).join('') : '<tr><td colspan="11" style="text-align:center;padding:16px;color:#94a3b8">Нет данных за выбранный фильтр</td></tr>';
  };
  /* === Часть 8А: Потоковый ускоритель отчётов WB / Ozon / Яндекс Маркет === */
  window.recalcReportsCogs = function () {
    const skuIdx = window.buildSkuIndex();
    (window.db.reports || []).forEach(r => {
      const rate = window.getRate(r.yr + '-' + r.mo);
      const its = (window.db.itemSales || []).filter(i => i.org === r.org && i.mp === r.mp && String(i.yr) === String(r.yr) && String(i.mo) === String(r.mo));
      if (its.length) {
        r.cogs = Math.max(0, its.reduce((sum, it) => {
          const m = window.resolveMetaFast(skuIdx, it.bc, it.art, it.name);
          return sum + (window.num(it.sQty) - window.num(it.rQty)) * (m.usd * rate);
        }, 0));
      }
    });
  };

  function splitCsvLine(line, sep) {
    const out = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line.charAt(i);
      if (ch === '"') { if (inQ && line.charAt(i + 1) === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === sep && !inQ) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    out.push(cur.trim()); return out;
  }

  let mpBatch = null;
  async function streamParseMpFile(file, rate, skuIdx) {
    const buf = await file.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(buf);
    const lines = txt.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return null;

    const sample = lines.slice(0, 25).join('\n').toLowerCase();
    let det = document.getElementById('up-mp')?.value || 'WB', hIdx = 0;
    if (sample.includes('обоснование для оплаты') || sample.includes('вайлдберриз реализовал')) { det = 'WB'; hIdx = lines.findIndex(l => l.toLowerCase().includes('обоснование для оплаты')); }
    else if (sample.includes('группа услуг') && sample.includes('тип начисления')) { det = 'OZON'; hIdx = lines.findIndex(l => l.toLowerCase().includes('группа услуг')); }
    else if (sample.includes('ваш sku') && sample.includes('доставка покупателю')) { det = 'YM_ORDERS'; hIdx = lines.findIndex(l => l.toLowerCase().includes('ваш sku')); }
    else if (sample.includes('все услуги маркета за заказы') || sample.includes('id бизнес-аккаунта')) { det = 'YM_SERVICES'; hIdx = lines.findIndex(l => l.toLowerCase().includes('статус заказа')); }
    else { const foundIdx = lines.slice(0, 30).findIndex(l => l.toLowerCase().match(/баркод|штрих|sku|артикул|реализовал|доставлено|выручка|сумма/)); if (foundIdx >= 0) hIdx = foundIdx; }
    if (hIdx < 0) hIdx = 0;

    const hLine = lines[hIdx];
    const sep = hLine.includes('\t') ? '\t' : ((hLine.split(';').length >= hLine.split(',').length) ? ';' : ',');
    const hdr = splitCsvLine(hLine, sep);
    const col = rxs => { for (const rx of rxs) { const i = hdr.findIndex(h => rx.test(h.toLowerCase())); if (i >= 0) return i; } return -1; };

    let grossRev = 0, ret = 0, com = 0, log = 0, ads = 0, cogs = 0, sQty = 0, rQty = 0;
    const items = [];
    const addCost = (bc, art, name, q, isRet) => {
      const m = window.resolveMetaFast(skuIdx, bc, art, name);
      if (m.usd > 0) { const rub = m.usd * rate * q; if (isRet) cogs -= rub; else cogs += rub; }
    };

    const iArt = col([/^артикул поставщика$/i, /^артикул$/i, /артикул/i]), iSiz = col([/^размер$/i]), iBc = col([/^баркод$/i, /^sku$/i, /^ваш sku$/i, /штрих|баркод|sku/i]);
    const iDoc = col([/^тип документа$/i]), iOb = col([/^обоснование для оплаты$/i]), iGrp = col([/^группа услуг$/i]), iTyp = col([/^тип начисления$/i, /^статус/i]);
    const iQty = col([/^кол-во$/i, /^количество/i, /доставлено/i]), iPr = col([/вайлдберриз реализовал товар/i, /^сумма итого/i, /цена продажи|выручка|сумма платежа/i]);
    const iPay = col([/к перечислению продавцу/i]), iLog = col([/услуги по доставке/i, /доставка покупателю/i, /логистик/i]), iCom = col([/^хранение$/i, /вознагражден|комисси|все услуги/i]), iAds = col([/штраф|удержан|буст|продвиж|реклам/i]);

    const total = lines.length, chunk = 2500;
    for (let start = hIdx + 1; start < total; start += chunk) {
      const end = Math.min(total, start + chunk);
      for (let r = start; r < end; r++) {
        const rw = splitCsvLine(lines[r], sep);
        if (rw.length < 3) continue;
        const bc = iBc >= 0 ? (rw[iBc] || '') : '', art = iArt >= 0 ? (rw[iArt] || '') : bc, siz = iSiz >= 0 ? (rw[iSiz] || '') : '';
        const artF = (art + (siz && siz !== '0' ? siz : '')).trim(), q = iQty >= 0 ? (Math.abs(window.num(rw[iQty])) || 1) : 1;

        if (det === 'WB') {
          const doc = (rw[iDoc] || '').toLowerCase(), ob = (rw[iOb] || '').toLowerCase();
          const vPr = window.num(rw[iPr]), vPay = window.num(rw[iPay]), vLog = Math.abs(window.num(rw[iLog])), vAds = Math.abs(window.num(rw[iAds])), vStor = Math.abs(window.num(rw[iCom]));
          log += vLog; ads += vAds; com += vStor;
          if (doc === 'продажа' && ob === 'продажа') { const vc = Math.max(0, vPr - vPay); grossRev += vPr; com += vc; sQty += q; addCost(bc, artF, art, q, false); items.push({ bc: bc || artF, art: artF, sQty: q, rQty: 0, rev: vPr, fee: vc + vLog + vAds }); }
          else if (doc === 'возврат' || ob === 'возврат') { const vc = Math.max(0, vPr - vPay); ret += vPr; com -= vc; rQty += q; addCost(bc, artF, art, q, true); items.push({ bc: bc || artF, art: artF, sQty: 0, rQty: q, rev: -vPr, fee: vLog - vc }); }
        } else if (det === 'OZON') {
          const grp = (rw[iGrp] || '').toLowerCase(), typ = (rw[iTyp] || '').toLowerCase(), tot = window.num(rw[iPr]), bcK = bc ? ('OZN' + bc) : art;
          if (grp === 'продажи' && typ === 'выручка') { grossRev += tot; sQty += q; addCost(bcK, art, art, q, false); items.push({ bc: bcK || art, art, sQty: q, rQty: 0, rev: tot, fee: 0 }); }
          else if (grp === 'возвраты' && typ === 'возврат выручки') { ret += Math.abs(tot); rQty += q; addCost(bcK, art, art, q, true); items.push({ bc: bcK || art, art, sQty: 0, rQty: q, rev: -Math.abs(tot), fee: 0 }); }
          else if (grp.includes('доставк') || grp.includes('агент')) log += (-tot);
          else if (grp.includes('продвиж') || grp.includes('реклам')) ads += (-tot);
          else com += (-tot);
        } else {
          const st = (rw[iTyp] || '').toLowerCase(), vRev = window.num(rw[iPr]), vLog = Math.abs(window.num(rw[iLog])), vCom = Math.abs(window.num(rw[iCom])), vAds = Math.abs(window.num(rw[iAds]));
          const isRet = st.includes('возврат') || vRev < 0;
          if (isRet) { ret += Math.abs(vRev); rQty += q; addCost(bc, art, art, q, true); } else if (vRev !== 0) { grossRev += Math.abs(vRev); sQty += q; addCost(bc, art, art, q, false); }
          log += vLog; ads += vAds; com += Math.max(0, vCom - (det === 'YM_SERVICES' ? (vLog + vAds) : 0));
          if (bc && vRev !== 0) items.push({ bc, art, sQty: isRet ? 0 : q, rQty: isRet ? q : 0, rev: isRet ? -Math.abs(vRev) : Math.abs(vRev), fee: vCom + vLog + vAds });
        }
      }
      window.showToastProgress(`⏳ ${file.name}: ${Math.round((end / total) * 100)}%`);
      await new Promise(res => setTimeout(res, 0));
    }
    return { fileName: file.name, mp: det.startsWith('YM') ? 'YM' : det, rev: Math.max(0, grossRev - ret), ret, com: Math.max(0, com), log: Math.max(0, log), ads: Math.max(0, ads), cogs: Math.max(0, cogs), sQty, rQty, items };
  }
  /* === Часть 8Б: Черновик отчётов, реестр (✏️/✕) и Каталог по 32 папкам === */
  window.onRepFile = async function (ev) {
    if (window.__skosReadOnly) return;
    const files = Array.from(ev?.target?.files || []);
    if (!files.length) return;
    ev.target.value = '';
    const org = document.getElementById('up-org').value, yr = document.getElementById('up-yr').value, mo = document.getElementById('up-mo').value;
    const rate = window.getRate(yr + '-' + mo), skuIdx = window.buildSkuIndex();
    if (!mpBatch || mpBatch.org !== org || mpBatch.yr !== yr || mpBatch.mo !== mo) mpBatch = { org, yr, mo, files: [] };
    for (const f of files) { const p = await streamParseMpFile(f, rate, skuIdx); if (p) mpBatch.files.push(p); }
    window.showToastProgress('✅ Файлы обработаны!', 1500);
    if (!mpBatch.files.length) { mpBatch = null; return alert('Не удалось распознать строки в файле.'); }
    window.renderMpDraft();
  };

  window.renderMpDraft = function () {
    const box = document.getElementById('map-box'); if (!box) return;
    if (!mpBatch || !mpBatch.files.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const grp = {};
    mpBatch.files.forEach(f => {
      if (!grp[f.mp]) grp[f.mp] = { mp: f.mp, cnt: 0, rev: 0, ret: 0, com: 0, log: 0, ads: 0, cogs: 0, sQty: 0, rQty: 0, items: [] };
      const g = grp[f.mp]; g.cnt++; g.rev += f.rev; g.ret += f.ret; g.com += f.com; g.log += f.log; g.ads += f.ads; g.cogs += f.cogs; g.sQty += f.sQty; g.rQty += f.rQty; g.items.push(...f.items);
    });
    box.classList.remove('hidden');
    box.innerHTML = `<div style="font-weight:700;margin-bottom:8px">📝 Черновик (${mpBatch.files.length} ф.) • ${window.esc(mpBatch.org)} • ${mpBatch.mo}.${mpBatch.yr}</div>` +
      Object.values(grp).map(g => `<div style="padding:8px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:6px;font-size:12px"><b>${g.mp}</b> (${g.cnt} ф.): Выручка <b>${window.fmtR(g.rev)}</b> | Возвраты <b class="text-red">${window.fmtR(g.ret)}</b> | Услуги МП <b>${window.fmtR(g.com + g.log + g.ads)}</b> | Себест. <b>${window.fmtR(g.cogs)}</b></div>`).join('') +
      `<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn btn-primary" id="btn-ok-mp">✅ Сохранить в учёт</button><button type="button" class="btn btn-danger" onclick="mpBatch=null;renderMpDraft()">🗑️ Очистить</button></div>`;
    document.getElementById('btn-ok-mp').onclick = () => {
      if (window.db.locked?.[mpBatch.yr + '-' + mpBatch.mo]) return alert('Месяц закрыт!');
      Object.values(grp).forEach(g => {
        const bo = (g.sQty + g.rQty) > 0 ? Math.round((g.sQty / (g.sQty + g.rQty)) * 100) : 89;
        window.db.reports.unshift({ id: 'r_' + Date.now() + '_' + g.mp, org: mpBatch.org, mp: g.mp, yr: mpBatch.yr, mo: mpBatch.mo, rev: g.rev, ret: g.ret, ads: g.ads, log: g.log, com: g.com, cogs: g.cogs, bo });
        g.items.forEach(it => window.db.itemSales.push({ org: mpBatch.org, mp: g.mp, yr: mpBatch.yr, mo: mpBatch.mo, bc: it.bc, art: it.art, sQty: it.sQty, rQty: it.rQty, rev: it.rev, fee: it.fee }));
      });
      mpBatch = null; window.renderMpDraft(); window.save(true); window.render();
      alert('✅ Отчёты сохранены!');
    };
  };

  window.editReportRow = id => { const r = (window.db.reports || []).find(x => x.id === id); if (!r) return; const rev = prompt('Выручка (₽):', r.rev); if (rev === null) return; const ret = prompt('Возвраты (₽):', r.ret); if (ret === null) return; const ads = prompt('Реклама (₽):', r.ads); if (ads === null) return; const log = prompt('Логистика (₽):', r.log); if (log === null) return; const com = prompt('Комиссия (₽):', r.com); if (com === null) return; const cog = prompt('Себестоимость (₽):', r.cogs); if (cog === null) return; r.rev = window.num(rev); r.ret = window.num(ret); r.ads = window.num(ads); r.log = window.num(log); r.com = window.num(com); r.cogs = window.num(cog); window.save(true); window.renderRepTab(); };
  window.saveMan = e => { e.preventDefault(); if (window.__skosReadOnly) return; window.db.reports.unshift({ id: 'r_' + Date.now(), org: document.getElementById('mn-org').value, mp: document.getElementById('mn-mp').value, yr: document.getElementById('mn-yr').value, mo: document.getElementById('mn-mo').value, rev: window.num(document.getElementById('mn-rev').value), ret: window.num(document.getElementById('mn-ret').value), ads: window.num(document.getElementById('mn-ads').value), log: window.num(document.getElementById('mn-log').value), com: window.num(document.getElementById('mn-com').value), cogs: window.num(document.getElementById('mn-cog').value), bo: window.num(document.getElementById('mn-bo').value) || 88 }); window.save(true); window.closeModals(); window.render(); };
  window.renderRepTab = () => {
    const reps = window.db.reports || [], cnt = document.getElementById('rep-cnt'), tb = document.getElementById('tb-reps');
    if (cnt) cnt.textContent = reps.length + ' отчётов';
    if (tb) tb.innerHTML = reps.length ? reps.map(r => { const p = window.num(r.rev) - window.num(r.ads) - window.num(r.log) - window.num(r.com) - window.num(r.cogs); return `<tr><td>${r.yr}-${r.mo}</td><td class="bold">${window.esc(r.org)}</td><td><span class="badge badge-blue">${window.esc(r.mp)}</span></td><td class="num">${window.fmtR(r.rev)}</td><td class="num text-red">${window.fmtR(r.ret)}</td><td class="num">${window.fmtR(r.ads)}</td><td class="num">${window.fmtR(r.log)}</td><td class="num">${window.fmtR(r.com)}</td><td class="num">${window.fmtR(r.cogs)}</td><td class="num bold ${p >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(p)}</td><td style="white-space:nowrap"><button class="btn" style="padding:3px 7px" onclick="editReportRow('${r.id}')">✏️</button> <button class="btn btn-danger" onclick="db.reports=db.reports.filter(x=>x.id!=='${r.id}');save(true);renderRepTab()">✕</button></td></tr>`; }).join('') : '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:16px">Отчётов пока нет</td></tr>';
  };
  /* === Часть 9А: Каталог товаров по 32 папкам и поиск === */
  window.renderSkuTab = function (filterQ) {
    const tabSku = document.getElementById('tab-sku'); if (!tabSku || !window.db) return;
    Array.from(tabSku.children).forEach(ch => { if (ch !== tabSku.firstElementChild && ch.id !== 'skos-folders-wrap') ch.classList.add('hidden'); });
    let wrap = document.getElementById('skos-folders-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'skos-folders-wrap'; wrap.className = 'card'; tabSku.appendChild(wrap); }

    const q = (filterQ !== undefined ? filterQ : (document.getElementById('sku-q')?.value || '')).trim().toLowerCase();
    const rate = window.getRate(), fNames = window.getFolderNames(), folders = {};
    (window.db.skus || []).forEach(s => {
      const fKey = window.normStr(s.art) || 'Без артикула';
      if (!folders[fKey]) folders[fKey] = { key: fKey, title: fNames[fKey] || s.name || fKey, items: [] };
      if (!q || s.bc.toLowerCase().includes(q) || fKey.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)) folders[fKey].items.push(s);
    });

    const keys = Object.keys(folders).filter(k => folders[k].items.length > 0).sort();
    const totalShown = keys.reduce((a, k) => a + folders[k].items.length, 0);
    const newCnt = (window.db.skus || []).filter(s => !(s.usd > 0)).length;
    const al = document.getElementById('new-sku-alert');
    if (al) { al.classList.toggle('hidden', newCnt === 0); al.textContent = '⚠️ Новых ШК без себестоимости: ' + newCnt; }

    wrap.innerHTML = `<div class="card-header"><div class="card-title">📂 Каталог по папкам (${keys.length} папок • ${totalShown} ШК)</div>${window.__skosReadOnly ? '' : '<button type="button" class="btn btn-primary" onclick="openAddSingleSkuModal()">+ Добавить ШК</button>'}</div>` +
      (keys.length ? keys.map(k => {
        const f = folders[k], prices = f.items.map(x => window.num(x.usd)).filter(x => x > 0), pBadge = prices.length ? window.fmtU(prices[0]) : '0,00 $';
        const rows = f.items.slice(0, 200).map(s => `<tr class="${!(s.usd > 0) ? 'row-new-sku' : ''}"><td style="font-family:monospace;font-weight:700">${window.esc(s.bc)}</td><td>${window.esc(s.name || '—')}</td><td class="num bold">${window.fmtU(s.usd)}</td><td class="num" style="color:#64748b">${window.fmtR(s.usd * rate)}</td><td style="text-align:right;white-space:nowrap">${window.__skosReadOnly ? '' : `<button class="btn" style="padding:3px 7px" onclick="openEditSkuModal('${s.id}')">✏️</button> <button class="btn btn-danger" onclick="deleteSingleSku('${s.id}')">✕</button>`}</td></tr>`).join('');
        return `<details ${q ? 'open' : ''} style="border:1px solid #cbd5e1;border-radius:10px;margin-bottom:8px;background:#fff"><summary style="cursor:pointer;padding:9px 12px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div style="display:flex;align-items:center;gap:8px"><span>📁</span><b>${window.esc(f.key)}</b><span style="color:#475569">— ${window.esc(f.title)}</span><span class="badge badge-blue">${f.items.length} ШК</span></div><div style="display:flex;align-items:center;gap:6px" onclick="event.preventDefault()"><span class="badge badge-green">${pBadge}</span>${window.__skosReadOnly ? '' : `<button class="btn" style="padding:3px 8px;font-size:11.5px" onclick="openEditFolderModal('${encodeURIComponent(f.key)}')">✏️ Папка</button><button class="btn btn-danger" onclick="deleteWholeFolder('${encodeURIComponent(f.key)}')">✕</button>`}</div></summary><div style="padding:8px 12px;overflow-x:auto"><table><thead><tr><th>ШК</th><th>Название</th><th class="num">Себест. $</th><th class="num">Себест. ₽</th><th style="text-align:right">Действия</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
      }).join('') : '<div style="padding:16px;text-align:center;color:#64748b">Ничего не найдено</div>');
  };

  let skuSearchT = null;
  window.searchSku = q => { clearTimeout(skuSearchT); skuSearchT = setTimeout(() => { const v = (q || '').trim().toLowerCase(), box = document.getElementById('sku-q-res'); if (box) { if (!v) box.innerHTML = ''; else { const c = (window.db.skus || []).filter(s => s.bc.toLowerCase().includes(v) || (s.art || '').toLowerCase().includes(v) || (s.name || '').toLowerCase().includes(v)).length; box.innerHTML = c > 0 ? `<span class="badge badge-green">Найдено: ${c}</span>` : '<span class="badge badge-red">Не найдено</span>'; } } window.renderSkuTab(q); }, 200); };
  /* === Часть 9Б: Редактирование папок и ШК, потоковый импорт CSV и дубли === */
  window.openEditFolderModal = enc => {
    const fKey = decodeURIComponent(enc), items = (window.db.skus || []).filter(s => (window.normStr(s.art) || 'Без артикула') === fKey); if (!items.length) return;
    const fNames = window.getFolderNames(), curTit = fNames[fKey] || items[0].name || fKey, vp = items.map(x => window.num(x.usd)).filter(x => x > 0), curUsd = vp.length ? vp[0] : 0;
    const m = document.createElement('div'); m.className = 'modal-bg';
    m.innerHTML = `<div class="modal-box"><h3 style="font-size:16px;font-weight:800">✏️ Папка (${items.length} ШК)</h3><div style="display:grid;gap:8px;margin-top:10px"><div><label>Код папки</label><input id="p-fa" class="input" value="${window.esc(fKey)}"></div><div><label>Название модели</label><input id="p-fn" class="input" value="${window.esc(curTit)}"></div><div><label>Себест. ($)</label><input id="p-fu" type="number" step="0.01" class="input" value="${curUsd}"></div></div><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px"><button class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button><button class="btn btn-primary" id="p-fs">💾 Сохранить</button></div></div>`;
    document.body.appendChild(m);
    document.getElementById('p-fs').onclick = () => { const na = window.normStr(document.getElementById('p-fa').value) || fKey, nn = window.normStr(document.getElementById('p-fn').value) || curTit, nu = window.num(document.getElementById('p-fu').value); window.setFolderName(na, nn); items.forEach(s => { s.art = na; s.name = nn; s.usd = nu; s.isNew = nu === 0; }); window.recalcReportsCogs(); m.remove(); window.save(true); window.renderSkuTab(); };
  };
  window.deleteWholeFolder = enc => { const fKey = decodeURIComponent(enc), cnt = (window.db.skus || []).filter(s => (window.normStr(s.art) || 'Без артикула') === fKey).length; if (cnt && confirm('Удалить папку «' + fKey + '» (' + cnt + ' ШК)?')) { window.db.skus = window.db.skus.filter(s => (window.normStr(s.art) || 'Без артикула') !== fKey); window.save(true); window.renderSkuTab(); } };
  window.openEditSkuModal = id => { const s = (window.db.skus || []).find(x => x.id === id); if (!s) return; const m = document.createElement('div'); m.className = 'modal-bg'; m.innerHTML = `<div class="modal-box"><h3 style="font-size:16px;font-weight:800">✏️ Редактировать ШК</h3><div style="display:grid;gap:8px;margin-top:10px"><div><label>ШК</label><input id="e-bc" class="input" value="${window.esc(s.bc)}"></div><div><label>Артикул (папка)</label><input id="e-ar" class="input" value="${window.esc(s.art)}"></div><div><label>Название</label><input id="e-nm" class="input" value="${window.esc(s.name)}"></div><div><label>Себест. ($)</label><input id="e-us" type="number" step="0.01" class="input" value="${s.usd || 0}"></div></div><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px"><button class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button><button class="btn btn-primary" id="e-sv">💾 Сохранить</button></div></div>`; document.body.appendChild(m); document.getElementById('e-sv').onclick = () => { const nb = window.normStr(document.getElementById('e-bc').value); if (!nb) return alert('Введите ШК!'); s.bc = nb; s.art = window.normStr(document.getElementById('e-ar').value) || 'Без артикула'; s.name = window.normStr(document.getElementById('e-nm').value) || s.art; s.usd = window.num(document.getElementById('e-us').value); s.isNew = s.usd === 0; window.recalcReportsCogs(); m.remove(); window.save(true); window.renderSkuTab(); }; };
  window.deleteSingleSku = id => { if (confirm('Удалить ШК?')) { window.db.skus = window.db.skus.filter(x => x.id !== id); window.save(true); window.renderSkuTab(); } };
  window.openAddSingleSkuModal = () => { const m = document.createElement('div'); m.className = 'modal-bg'; m.innerHTML = `<div class="modal-box"><h3 style="font-size:16px;font-weight:800">+ Новый ШК</h3><div style="display:grid;gap:8px;margin-top:10px"><div><label>ШК *</label><input id="a-bc" class="input"></div><div><label>Артикул (папка) *</label><input id="a-ar" class="input"></div><div><label>Название</label><input id="a-nm" class="input"></div><div><label>Себест. ($)</label><input id="a-us" type="number" step="0.01" class="input" value="0"></div></div><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px"><button class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button><button class="btn btn-primary" id="a-sv">✅ Добавить</button></div></div>`; document.body.appendChild(m); document.getElementById('a-sv').onclick = () => { const bc = window.normStr(document.getElementById('a-bc').value); if (!bc || window.db.skus.some(x => window.normStr(x.bc) === bc)) return alert('Пустой или дублирующий ШК!'); const art = window.normStr(document.getElementById('a-ar').value) || 'Без артикула', name = window.normStr(document.getElementById('a-nm').value) || art, usd = window.num(document.getElementById('a-us').value); window.db.skus.unshift({ id: 's_' + Date.now(), bc, art, name, col: '—', siz: '—', usd, src: 'Вручную', isNew: usd === 0 }); m.remove(); window.save(true); window.renderSkuTab(); }; };

  window.importCostCsv = async function (ev) {
    const f = ev?.target?.files?.[0]; if (!f) return; ev.target.value = '';
    window.showToastProgress('⏳ Импорт себестоимости...');
    const buf = await f.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(buf); if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(buf);
    const lines = txt.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    const sep = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    const skuMap = new Map(); (window.db.skus || []).forEach(s => skuMap.set(window.normStr(s.bc), s));
    let added = 0, upd = 0;
    for (let i = 1; i < lines.length; i++) {
      const c = splitCsvLine(lines[i], sep); if (c.length < 2) continue;
      const art = window.normStr(c[0]), bc = window.normStr(c.length >= 4 ? c[1] : c[0]), name = window.normStr(c.length >= 4 ? c[2] : c[1]), usd = window.num(c[c.length - 1]);
      if (!bc || /e\+/i.test(bc)) continue;
      const ex = skuMap.get(bc);
      if (ex) { if (usd > 0) ex.usd = usd; if (name) ex.name = name; upd++; }
      else { const ns = { id: 's_' + Date.now() + '_' + i, art: art || 'Без артикула', bc, name: name || art || 'Товар', col: '—', siz: '—', usd, src: 'CSV', isNew: usd === 0 }; window.db.skus.push(ns); skuMap.set(bc, ns); added++; }
    }
    window.save(true); window.renderSkuTab(); window.showToastProgress('✅ Импорт готов!', 2000);
    alert('✅ Импорт завершён! Новых: ' + added + ', обновлено: ' + upd);
  };
  window.dedupSkus = () => { const b = window.db.skus.length; window.cleanSkus(); window.save(true); window.renderSkuTab(); alert('Удалено дублей: ' + (b - window.db.skus.length)); };
  /* === Часть 10А: Склад и производство (операции с +, ✏️, ✕) === */
  window.getModelsOptions = sel => {
    const fNames = window.getFolderNames(), map = new Map();
    Object.keys(fNames).forEach(k => { if (fNames[k]) map.set(fNames[k], fNames[k]); });
    (window.db.skus || []).forEach(s => { const nm = fNames[s.art] || s.name || s.art; if (nm) map.set(nm, nm); });
    window.ensureStore().bom.forEach(b => { if (b.product) map.set(b.product, b.product); });
    return '<option value="">— Модель —</option>' + Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ru')).map(n => `<option value="${window.esc(n)}"${n === sel ? ' selected' : ''}>${window.esc(n)}</option>`).join('');
  };
  window.getDictOptions = (arr, sel) => (arr || []).filter(x => x && !x.arch).map(x => `<option value="${window.esc(x.name)}"${x.name === sel ? ' selected' : ''}>${window.esc(x.name)}</option>`).join('');

  window.p4StkSub = s => { window.ensureStore().stkSub = s; window.save(); window.renderStkTab(); };
  window.p4DelRow = (key, idx) => { const e = window.ensureStore(); if (!window.__skosReadOnly && e[key]?.[idx] && confirm('Удалить запись?')) { e[key].splice(idx, 1); window.save(true); window.render(); } };

  window.p4EditMat = idx => { const m = window.ensureStore().materials[idx]; if (!m) return; const nm = prompt('Название:', m.name); if (nm) m.name = nm.trim(); const q = prompt('Начальный остаток:', m.initQty); if (q !== null) m.initQty = window.num(q); const u = prompt('Начальная сумма $:', m.initUsd); if (u !== null) m.initUsd = window.num(u); window.save(true); window.renderStkTab(); };
  window.p4EditMatIn = idx => { const x = window.ensureStore().matIn[idx]; if (!x) return; const q = prompt('Количество:', x.qty); if (q !== null) x.qty = window.num(q); const p = prompt('Цена $:', x.priceUsd); if (p !== null) x.priceUsd = window.num(p); x.totalUsd = x.qty * x.priceUsd; window.save(true); window.renderStkTab(); };
  window.p4EditOrder = idx => { const o = window.ensureStore().orders[idx]; if (!o) return; const q = prompt('Количество шт:', o.qty); if (q !== null) o.qty = window.num(q); const u = prompt('Сумма $:', o.totalUsd); if (u !== null) o.totalUsd = window.num(u); window.save(true); window.renderStkTab(); };
  window.p4EditBom = idx => { const b = window.ensureStore().bom[idx]; if (!b) return; const str = (b.items || []).map(it => it.matName + ':' + it.norm + ':' + it.priceUsd).join('; '); const res = prompt('Состав (Материал:Норма:Цена$ через ;):', str); if (res !== null) { b.items = res.split(';').map(p => p.trim()).filter(Boolean).map(p => { const [mn, nr, pr] = p.split(':'); return { matName: (mn || '').trim(), norm: window.num(nr), priceUsd: window.num(pr) }; }); window.save(true); window.renderStkTab(); } };
  window.p4EditFg = idx => { const f = window.ensureStore().fgStocks[idx]; if (!f) return; const ru = prompt('Склад РФ шт:', f.ruQty); if (ru !== null) f.ruQty = window.num(ru); const tm = prompt('Склад ТМ шт:', f.tmQty); if (tm !== null) f.tmQty = window.num(tm); const way = prompt('В пути шт:', f.wayQty); if (way !== null) f.wayQty = window.num(way); const u = prompt('Цена $:', f.unitUsd); if (u !== null) f.unitUsd = window.num(u); f.lockedUsd = (f.ruQty + f.tmQty + f.wayQty) * f.unitUsd; window.save(true); window.renderStkTab(); };
  window.p4EditDef = idx => { const d = window.ensureStore().defects[idx]; if (!d) return; const q = prompt('Количество брака:', d.qty); if (q !== null) d.qty = window.num(q); const u = prompt('Цена $:', d.unitUsd); if (u !== null) d.unitUsd = window.num(u); const r = prompt('Причина:', d.reason); if (r !== null) d.reason = r.trim(); window.save(true); window.renderStkTab(); };

  window.p4MatAdd = () => { const e = window.ensureStore(), nm = document.getElementById('sm-nm').value.trim(); if (!nm) return alert('Введите название!'); e.materials.unshift({ name: nm, cat: document.getElementById('sm-cat').value, unit: document.getElementById('sm-un').value, initQty: window.num(document.getElementById('sm-q').value), initUsd: window.num(document.getElementById('sm-u').value) }); window.save(true); window.renderStkTab(); };
  window.p4MatInAdd = () => { const e = window.ensureStore(), m = document.getElementById('si-m').value, q = window.num(document.getElementById('si-q').value), p = window.num(document.getElementById('si-p').value); if (!m || q <= 0) return alert('Выберите сырьё и кол-во!'); e.matIn.unshift({ date: document.getElementById('si-d').value || window.today(), matName: m, supplier: document.getElementById('si-s').value, qty: q, priceUsd: p, totalUsd: q * p }); window.save(true); window.renderStkTab(); };
  window.p4OrderAdd = () => { const e = window.ensureStore(), pr = document.getElementById('so-p').value, q = window.num(document.getElementById('so-q').value); if (!pr || q <= 0) return alert('Выберите модель и кол-во!'); const rec = e.bom.find(b => b.product === pr); let tot = 0; const lines = (rec?.items || []).map(it => { const u = window.num(it.norm) * q; tot += u * window.num(it.priceUsd); return { matName: it.matName, usedQty: u, priceUsd: window.num(it.priceUsd) }; }); e.orders.unshift({ date: document.getElementById('so-d').value || window.today(), doneDate: '', status: 'WIP', product: pr, qty: q, totalUsd: tot, comment: document.getElementById('so-c').value.trim(), lines }); window.save(true); window.renderStkTab(); };
  window.p4OrderDone = i => { const o = window.ensureStore().orders[i]; if (o && confirm('Завершить пошив и списать сырьё?')) { o.status = 'DONE'; o.doneDate = window.today(); window.save(true); window.renderStkTab(); } };
  window.p4BomAdd = () => { const e = window.ensureStore(), pr = document.getElementById('sb-p').value, m = document.getElementById('sb-m').value, n = window.num(document.getElementById('sb-n').value), p = window.num(document.getElementById('sb-pr').value); if (!pr || !m || n <= 0) return alert('Заполните модель, материал и норму!'); let rec = e.bom.find(b => b.product === pr); if (!rec) { rec = { product: pr, items: [] }; e.bom.unshift(rec); } rec.items.push({ matName: m, norm: n, priceUsd: p }); window.save(true); window.renderStkTab(); };
  window.p4FgAdd = () => { const e = window.ensureStore(), pr = document.getElementById('sf-p').value; if (!pr) return alert('Выберите модель!'); const ru = window.num(document.getElementById('sf-ru').value), tm = window.num(document.getElementById('sf-tm').value), way = window.num(document.getElementById('sf-way').value), u = window.num(document.getElementById('sf-u').value); e.fgStocks.unshift({ month: document.getElementById('sf-m').value || window.today().slice(0, 7), product: pr, ruQty: ru, tmQty: tm, wayQty: way, unitUsd: u, lockedUsd: (ru + tm + way) * u }); window.save(true); window.renderStkTab(); };
  window.p4DefAdd = () => { const e = window.ensureStore(), pr = document.getElementById('sd-p').value, q = window.num(document.getElementById('sd-q').value); if (!pr || q <= 0) return alert('Выберите модель и кол-во!'); e.defects.unshift({ date: document.getElementById('sd-d').value || window.today(), product: pr, qty: q, unitUsd: window.num(document.getElementById('sd-u').value), reason: document.getElementById('sd-r').value.trim() || 'Брак' }); window.save(true); window.renderStkTab(); };
  /* === Часть 10Б-1: Рендер склада (Свод, Материалы, Приход) === */
  window.renderStkTab = function () {
    const sec = document.getElementById('tab-stk'); if (!sec) return;
    const e = window.ensureStore(), st = window.calcStockStats(), rate = window.getRate(), sub = e.stkSub || 'sum';
    const matNames = st.matRows.map(m => m.name);
    const matOpts = '<option value="">— Материал —</option>' + matNames.map(n => `<option value="${window.esc(n)}">${window.esc(n)}</option>`).join('');
    const nav = [['sum', '📊 Свод'], ['mat', '🧵 Материалы'], ['inc', '📥 Приход'], ['ord', '✂️ Пошив/Техкарты'], ['fg', '📦 ГП и Брак']]
      .map(([k, t]) => `<button type="button" class="btn ${k === sub ? 'btn-primary' : ''}" onclick="p4StkSub('${k}')">${t}</button>`).join('');

    let body = '';
    if (sub === 'sum') {
      const low = st.matRows.filter(m => m.qty < 15).map(m => `<tr style="background:#fff1f2"><td class="bold">${window.esc(m.name)}</td><td class="num text-red bold">${m.qty.toFixed(2)} ${window.esc(m.unit)}</td><td class="num">${window.fmtU(m.usd)}</td></tr>`).join('');
      body = `<div class="kpi-grid"><div class="kpi-card"><div>Сырьё</div><div class="kpi-val">${window.fmtU(st.rawUsd)}</div></div><div class="kpi-card"><div>НЗП</div><div class="kpi-val">${window.fmtU(st.wipUsd)}</div></div><div class="kpi-card"><div>ГП</div><div class="kpi-val">${window.fmtU(st.fgUsd)}</div></div><div class="kpi-card highlight"><div>ИТОГО</div><div class="kpi-val text-green">${window.fmtR(st.totalUsd * rate)}</div></div></div>
        <table><thead><tr><th>Критичные (&lt;15)</th><th class="num">Остаток</th><th class="num">Сумма $</th></tr></thead><tbody>${low || '<tr><td colspan="3" style="text-align:center;color:#64748b">Дефицита нет</td></tr>'}</tbody></table>`;
    } else if (sub === 'mat') {
      const rows = st.matRows.map(m => `<tr><td class="bold">${window.esc(m.name)}</td><td>${window.esc(m.cat)}</td><td class="num bold">${m.qty.toFixed(2)} ${window.esc(m.unit)}</td><td class="num">${window.fmtU(m.usd)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4EditMat(${m.idx})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('materials',${m.idx})">✕</button></td></tr>`).join('');
      body = `<div class="form-grid" style="margin-bottom:10px"><div><label>Название</label><input id="sm-nm" class="input"></div><div>${window.withPlusBtn('Категория', 'dictMatCats', 'Категория сырья', 'sm-cat')}<select id="sm-cat" class="select">${window.getDictOptions(e.dictMatCats)}</select></div><div>${window.withPlusBtn('Ед. изм.', 'dictUnits', 'Ед. измерения', 'sm-un')}<select id="sm-un" class="select">${window.getDictOptions(e.dictUnits)}</select></div><div><label>Нач. ост.</label><input id="sm-q" type="number" class="input" value="0"></div><div><label>Сумма $</label><input id="sm-u" type="number" step="0.01" class="input" value="0"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4MatAdd()">+ Сырьё</button></div></div>
        <table><thead><tr><th>Материал</th><th>Кат.</th><th class="num">Остаток</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    } else if (sub === 'inc') {
      const rows = e.matIn.map((x, i) => `<tr><td>${window.esc(x.date)}</td><td class="bold">${window.esc(x.matName)}</td><td>${window.esc(x.supplier)}</td><td class="num">${x.qty}</td><td class="num bold">${window.fmtU(x.totalUsd)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4EditMatIn(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('matIn',${i})">✕</button></td></tr>`).join('');
      body = `<div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="si-d" type="date" class="input" value="${window.today()}"></div><div>${window.withPlusBtn('Сырьё', 'materials', 'Материал', 'si-m')}<select id="si-m" class="select">${matOpts}</select></div><div>${window.withPlusBtn('Поставщик', 'dictSuppliers', 'Поставщик сырья', 'si-s')}<select id="si-s" class="select">${window.getDictOptions(e.dictSuppliers)}</select></div><div><label>Шт</label><input id="si-q" type="number" class="input"></div><div><label>Цена $</label><input id="si-p" type="number" step="0.01" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4MatInAdd()">+ Приход</button></div></div>
        <table><thead><tr><th>Дата</th><th>Сырьё</th><th>Поставщик</th><th class="num">Шт</th><th class="num">Итого $</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    /* === Часть 10Б-2: Пошив/Техкарты, ГП и Брак === */
    else if (sub === 'ord') {
      const oRows = e.orders.map((o, i) => `<tr><td>${window.esc(o.date)}</td><td class="bold">${window.esc(o.product)}</td><td class="num">${o.qty}</td><td class="num">${window.fmtU(o.totalUsd)}</td><td class="num" style="white-space:nowrap">${o.status === 'DONE' ? '<span class="badge badge-green">Готово</span>' : `<button class="btn btn-success" onclick="p4OrderDone(${i})">✅</button>`} <button class="btn" onclick="p4EditOrder(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('orders',${i})">✕</button></td></tr>`).join('');
      const bRows = e.bom.map((b, i) => { const tot = (b.items || []).reduce((s, it) => s + window.num(it.norm) * window.num(it.priceUsd), 0); return `<tr><td class="bold">${window.esc(b.product)}</td><td>${(b.items || []).map(it => window.esc(it.matName) + ' (' + it.norm + ')').join(', ')}</td><td class="num bold">${window.fmtU(tot)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4EditBom(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('bom',${i})">✕</button></td></tr>`; }).join('');
      body = `<div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="so-d" type="date" class="input" value="${window.today()}"></div><div>${window.withPlusBtn('Модель', 'models', 'Модель', 'so-p')}<select id="so-p" class="select">${window.getModelsOptions()}</select></div><div><label>Шт</label><input id="so-q" type="number" class="input"></div><div><label>Коммент</label><input id="so-c" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4OrderAdd()">+ В пошив</button></div></div>
        <table style="margin-bottom:12px"><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>${oRows}</tbody></table>
        <div class="form-grid" style="margin-bottom:10px"><div>${window.withPlusBtn('Модель', 'models', 'Модель', 'sb-p')}<select id="sb-p" class="select">${window.getModelsOptions()}</select></div><div>${window.withPlusBtn('Материал', 'materials', 'Материал', 'sb-m')}<select id="sb-m" class="select">${matOpts}</select></div><div><label>Норма</label><input id="sb-n" type="number" step="0.01" class="input"></div><div><label>Цена $</label><input id="sb-pr" type="number" step="0.01" class="input"></div><div><button class="btn btn-success" style="width:100%" onclick="p4BomAdd()">+ В техкарту</button></div></div>
        <table><thead><tr><th>Модель</th><th>Состав</th><th class="num">Себест. $</th><th></th></tr></thead><tbody>${bRows}</tbody></table>`;
    } else {
      const fRows = e.fgStocks.map((f, i) => `<tr><td>${window.esc(f.month)}</td><td class="bold">${window.esc(f.product)}</td><td class="num">${f.ruQty}/${f.tmQty}/${f.wayQty}</td><td class="num bold">${window.fmtU(f.lockedUsd)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4EditFg(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('fgStocks',${i})">✕</button></td></tr>`).join('');
      const dRows = e.defects.map((d, i) => `<tr><td>${window.esc(d.date)}</td><td class="bold">${window.esc(d.product)}</td><td class="num">${d.qty}</td><td class="num text-red">${window.fmtU(window.num(d.qty) * window.num(d.unitUsd))}</td><td>${window.esc(d.reason)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4EditDef(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('defects',${i})">✕</button></td></tr>`).join('');
      body = `<div class="form-grid" style="margin-bottom:10px"><div><label>Мес</label><input id="sf-m" type="month" class="input" value="${window.today().slice(0, 7)}"></div><div>${window.withPlusBtn('Модель', 'models', 'Модель', 'sf-p')}<select id="sf-p" class="select">${window.getModelsOptions()}</select></div><div><label>РФ</label><input id="sf-ru" type="number" class="input" value="0"></div><div><label>ТМ</label><input id="sf-tm" type="number" class="input" value="0"></div><div><label>Путь</label><input id="sf-way" type="number" class="input" value="0"></div><div><label>Цена $</label><input id="sf-u" type="number" step="0.01" class="input" value="0"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4FgAdd()">+ Остаток</button></div></div>
        <table style="margin-bottom:12px"><thead><tr><th>Мес</th><th>Модель</th><th class="num">РФ/ТМ/Путь</th><th class="num">Сумма $</th><th></th></tr></thead><tbody>${fRows}</tbody></table>
        <div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="sd-d" type="date" class="input" value="${window.today()}"></div><div>${window.withPlusBtn('Модель', 'models', 'Модель', 'sd-p')}<select id="sd-p" class="select">${window.getModelsOptions()}</select></div><div><label>Брак</label><input id="sd-q" type="number" class="input"></div><div><label>Цена $</label><input id="sd-u" type="number" step="0.01" class="input"></div><div><label>Причина</label><input id="sd-r" class="input"></div><div><button class="btn btn-danger" style="width:100%;padding:7px" onclick="p4DefAdd()">+ Брак</button></div></div>
        <table><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт</th><th class="num">Убыток $</th><th>Причина</th><th></th></tr></thead><tbody>${dRows}</tbody></table>`;
    }
    sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🏭 Запасы, Брак и Фурнитура</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${nav}</div>${body}</div>`;
  };
  /* === Часть 10В-1: ДДС, входящие остатки 01.01 и конвертация === */
  window.buildDdsCatOptions = sel => {
    const cats = window.db.ddsCats || [], groups = {};
    cats.forEach(c => { (groups[c.grp] = groups[c.grp] || []).push(c.name); });
    return Object.keys(groups).map(g => `<optgroup label="${window.esc(g)}">${groups[g].map(n => `<option value="${window.esc(n)}"${n === sel ? ' selected' : ''}>${window.esc(n)}</option>`).join('')}</optgroup>`).join('');
  };

  window.saveInitBalances = () => {
    if (!window.db.initBalances) window.db.initBalances = {};
    document.querySelectorAll('.skos-init-inp').forEach(inp => { window.db.initBalances[inp.dataset.wal] = window.num(inp.value); });
    window.save(true); window.render(); alert('✅ Начальные остатки на 01.01 сохранены!');
  };

  window.addManualDds = e => {
    e.preventDefault(); if (window.__skosReadOnly) return;
    const t = document.getElementById('d-type').value, a = window.num(document.getElementById('d-amt').value);
    window.db.dds.unshift({ id: 'd_' + Date.now(), date: document.getElementById('d-date').value, wal: document.getElementById('d-wal').value, cat: document.getElementById('d-cat').value, amt: t === 'IN' ? a : -a });
    e.target.reset(); window.save(true); window.renderDdsTab();
  };

  window.editDdsRow = id => {
    if (window.__skosReadOnly) return;
    const d = (window.db.dds || []).find(x => x.id === id); if (!d) return;
    const nd = prompt('Дата:', d.date); if (nd === null) return;
    const nc = prompt('Статья:', d.cat); if (nc === null) return;
    const na = prompt('Сумма (с минусом если расход):', d.amt); if (na === null) return;
    d.date = nd.trim() || d.date; d.cat = nc.trim() || d.cat; d.amt = window.num(na);
    window.save(true); window.renderDdsTab();
  };

  window.calcTrf = () => {
    const a = window.num(document.getElementById('tr-amt')?.value), f = window.num(document.getElementById('tr-fee')?.value), r = window.num(document.getElementById('tr-rate')?.value) || 1;
    const from = document.getElementById('tr-from')?.value, to = document.getElementById('tr-to')?.value;
    const isF = ['c3', 'c4', 'c5', 'c6'].includes(from), isT = ['c3', 'c4', 'c5', 'c6'].includes(to);
    let res = Math.max(0, a - f);
    if (!isF && isT && r > 1) res = (a - f) / r; else if (isF && !isT && r > 1) res = (a - f) * r;
    const el = document.getElementById('tr-res'); if (el) el.value = res.toFixed(2) + (isT ? ' $' : ' ₽');
  };

  window.saveTransfer = e => {
    e.preventDefault(); if (window.__skosReadOnly) return;
    const dt = document.getElementById('tr-date').value, from = document.getElementById('tr-from').value, to = document.getElementById('tr-to').value;
    const a = window.num(document.getElementById('tr-amt').value), f = window.num(document.getElementById('tr-fee').value), r = window.num(document.getElementById('tr-rate').value) || 1;
    const isF = ['c3', 'c4', 'c5', 'c6'].includes(from), isT = ['c3', 'c4', 'c5', 'c6'].includes(to);
    let res = Math.max(0, a - f);
    if (!isF && isT && r > 1) res = (a - f) / r; else if (isF && !isT && r > 1) res = (a - f) * r;
    window.db.dds.unshift({ id: 'd_' + Date.now() + 1, date: dt, wal: from, cat: 'Выбытие — Перевод между счетами', amt: -a });
    window.db.dds.unshift({ id: 'd_' + Date.now() + 2, date: dt, wal: to, cat: 'Поступление — Перевод между счетами', amt: res });
    window.save(true); window.closeModals(); window.render();
  };
  /* === Часть 10В-2: Импорт банковских выписок CSV и рендер ДДС === */
  window.importBankCsv = async function (ev) {
    if (window.__skosReadOnly) return;
    const f = ev?.target?.files?.item(0); if (!f) return; ev.target.value = '';
    const walId = document.getElementById('dds-wal').value, batchId = 'b_' + Date.now();
    window.showToastProgress('⏳ Загрузка банковской выписки...');
    const buf = await f.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(buf); if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(buf);
    const lines = txt.split(/\r?\n/).filter(l => l.trim());
    const sep = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    let added = 0, skip = 0;
    for (let idx = 1; idx < lines.length; idx++) {
      const c = splitCsvLine(lines[idx], sep); if (c.length < 3) continue;
      const rawDt = c.find(x => /^(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$/.test(x));
      if (!rawDt) continue;
      const dt = /^\d{4}-\d{2}-\d{2}$/.test(rawDt) ? rawDt.split('-').reverse().join('.') : rawDt;
      const low = c.join(' ').toLowerCase();
      if (low.includes('входящий остаток') || low.includes('исходящий остаток')) continue;
      let amt = 0;
      for (let i = 1; i < c.length; i++) { const n = window.num(c[i]); if (n !== 0 && !/^\d{2}\.\d{2}\.\d{4}$/.test(c[i])) { amt = n; break; } }
      if (!amt) continue;
      const hash = walId + '_' + dt + '_' + amt + '_' + low.slice(0, 30) + '_' + idx;
      if (window.db.ddsHashes[hash]) { skip++; continue; }
      window.db.ddsHashes[hash] = true;
      let cat = amt >= 0 ? 'Прочие поступления' : 'Прочие расходы';
      if (low.match(/вайлдберриз|wildberries|рвб/)) cat = 'Поступление от ВБ';
      else if (low.match(/озон|интернет решения/) && amt > 0) cat = 'Поступление от Озон';
      else if (low.match(/яндекс|спичкин/) && amt > 0) cat = 'Поступление от ЯМ';
      else if (low.match(/комисс|рко|обслуживан/)) cat = 'Комиссия РКО';
      else if (low.match(/уфнс|енс|енп|налог|взнос/)) cat = 'ЕНП';
      else if (low.match(/снятие налич|выдача налич|перевод собствен/)) {
        cat = amt >= 0 ? 'Поступление — Перевод между счетами' : 'Выбытие — Перевод между счетами';
        if (amt < 0) window.db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dt, wal: 'c1', cat: 'Поступление — Перевод между счетами', amt: Math.abs(amt), batchId });
      }
      window.db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dt, wal: walId, cat, amt, note: c.join(' ').slice(0, 120), batchId });
      added++;
    }
    window.save(true); window.renderDdsTab(); window.showToastProgress('✅ Выписка загружена!', 2000);
    alert('✅ Загружено: ' + added + ' (дублей пропущено: ' + skip + ')');
  };

  window.renderDdsTab = function () {
    const rate = window.getRate(), initB = window.db.initBalances || {};
    const allWals = (window.db.orgs || []).map(o => ({ id: o.id, name: o.name + ' (' + o.bank + ')', cur: 'RUB' })).concat(window.db.cashWallets || []);
    const kpiEl = document.getElementById('dds-kpis');
    if (kpiEl) kpiEl.innerHTML = allWals.map(w => { const bal = window.num(initB[w.id]) + (window.db.dds || []).filter(d => d.wal === w.id).reduce((s, d) => s + window.num(d.amt), 0); return `<div class="kpi-card"><div style="font-size:11px;color:#64748b;font-weight:700">${window.esc(w.name)}</div><div class="kpi-val ${w.cur === 'USD' ? 'text-green' : ''}" style="font-size:16px">${w.cur === 'USD' ? window.fmtU(bal) : window.fmtR(bal)}</div></div>`; }).join('');

    if (kpiEl && !document.getElementById('skos-init-bal-box')) {
      const box = document.createElement('div'); box.id = 'skos-init-bal-box';
      box.style.cssText = 'margin:10px 0;padding:10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;';
      box.innerHTML = `<details><summary style="cursor:pointer;font-weight:700;font-size:13px">🏦 Входящее сальдо на 01.01 (нажмите, чтобы открыть)</summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:8px;margin-top:8px">${allWals.map(w => `<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px"><span style="font-size:12px">${window.esc(w.name)} [${w.cur}]</span><input type="number" step="0.01" class="input skos-init-inp" data-wal="${w.id}" value="${initB[w.id] || ''}" style="width:110px;text-align:right"></div>`).join('')}</div>
        <div style="margin-top:8px;text-align:right"><button type="button" class="btn btn-primary" onclick="saveInitBalances()">💾 Сохранить остатки</button></div></details>`;
      kpiEl.insertAdjacentElement('afterend', box);
    }

    const catEl = document.getElementById('d-cat');
    if (catEl) {
      if (catEl.tagName === 'INPUT') { const s = document.createElement('select'); s.id = 'd-cat'; s.className = 'select'; catEl.replaceWith(s); }
      const sel = document.getElementById('d-cat'), lbl = sel.parentElement?.querySelector('label');
      if (lbl && !lbl.querySelector('button')) lbl.outerHTML = window.withPlusBtn('Статья ДДС', 'ddsCats', 'Статья ДДС', 'd-cat');
      const cur = sel.value; sel.innerHTML = window.buildDdsCatOptions(cur);
    }

    const tb = document.getElementById('tb-dds');
    if (tb) tb.innerHTML = (window.db.dds || []).slice(0, 150).map(d => {
      const w = allWals.find(x => x.id === d.wal) || { name: d.wal, cur: 'RUB' };
      const rs = window.fmtR(w.cur === 'USD' ? d.amt * rate : d.amt);
      return `<tr><td>${window.esc(d.date)}</td><td class="bold">${window.esc(w.name)}</td><td><select class="select" style="padding:2px 6px;font-size:12px" onchange="const x=db.dds.find(i=>i.id==='${d.id}');if(x){x.cat=this.value;save(true);}">${window.buildDdsCatOptions(d.cat)}</select></td>
        <td class="num bold ${d.amt >= 0 ? 'text-green' : 'text-red'}">${w.cur === 'USD' ? window.fmtU(d.amt) : window.fmtR(d.amt)}</td><td class="num">${rs}</td>
        <td style="white-space:nowrap"><button class="btn" style="padding:3px 7px" onclick="editDdsRow('${d.id}')">✏️</button> <button class="btn btn-danger" onclick="db.dds=db.dds.filter(x=>x.id!=='${d.id}');save(true);renderDdsTab()">✕</button></td></tr>`;
    }).join('');
  };
  /* === Часть 10Г: Расходы, Налоги, Долги 01.01 и ЗПВ === */
  window.addTax = e => { e.preventDefault(); if (window.__skosReadOnly) return; window.db.taxes.unshift({ id: 't_' + Date.now(), org: document.getElementById('tx-org').value, type: document.getElementById('tx-type').value, yr: document.getElementById('tx-yr').value, kv: Number(document.getElementById('tx-kv').value), amt: window.num(document.getElementById('tx-amt').value) }); e.target.reset(); window.save(true); window.renderExpTab(); };
  window.p4TaxFullMonth = () => { if (window.__skosReadOnly) return; const sum = window.num(document.getElementById('tx-amt')?.value); if (sum <= 0) return alert('Введите сумму налога!'); const m = parseInt(prompt('Месяц (1–12), куда записать налог целиком:', '11'), 10); if (!(m >= 1 && m <= 12)) return alert('Укажите число от 1 до 12!'); const mo = String(m).padStart(2, '0'), yr = document.getElementById('tx-yr')?.value || '2026', per = yr + '-' + mo; if (window.db.locked?.[per]) return alert('Месяц закрыт!'); window.db.taxes.unshift({ id: 'tx_' + Date.now(), per, yr, q: 'Мес.' + mo, org: document.getElementById('tx-org')?.value || 'ИП Каримов Артем', type: document.getElementById('tx-type')?.value || 'УСН', amt: sum, mSum: sum }); document.getElementById('tx-amt').value = ''; window.save(true); window.renderExpTab(); };
  window.editTaxRow = id => { const t = (window.db.taxes || []).find(x => x.id === id); if (!t) return; const a = prompt('Сумма налога (₽):', t.amt); if (a !== null) { t.amt = window.num(a); if (t.mSum) t.mSum = t.amt; window.save(true); window.renderExpTab(); } };

  window.addExp = e => { e.preventDefault(); if (window.__skosReadOnly) return; window.db.expenses.unshift({ id: 'e_' + Date.now(), org: document.getElementById('ex-org').value, cat: document.getElementById('ex-cat').value, tit: document.getElementById('ex-tit').value, amt: window.num(document.getElementById('ex-amt').value), cur: document.getElementById('ex-cur').value, yr: document.getElementById('ex-yr').value, mo: document.getElementById('ex-mo').value }); e.target.reset(); window.save(true); window.renderExpTab(); };
  window.editExpRow = id => { const x = (window.db.expenses || []).find(i => i.id === id); if (!x) return; const t = prompt('Комментарий:', x.tit); if (t !== null) x.tit = t.trim(); const a = prompt('Сумма:', x.amt); if (a !== null) x.amt = window.num(a); window.save(true); window.renderExpTab(); };

  window.p4TdAdd = () => { window.ensureStore().taxDebts.unshift({ org: document.getElementById('td-o').value, tax: document.getElementById('td-t').value, debt: window.num(document.getElementById('td-a').value) }); window.save(true); window.renderExpTab(); };
  window.p4TdEdit = i => { const t = window.ensureStore().taxDebts[i]; if (!t) return; const v = prompt('Новое сальдо 01.01 (₽):', t.debt); if (v !== null) { t.debt = window.num(v); window.save(true); window.renderExpTab(); } };
  window.p4ZpAdd = () => { const e = window.ensureStore(), emp = document.getElementById('zp-e').value, amt = window.num(document.getElementById('zp-a').value); if (!emp || amt <= 0) return alert('Выберите сотрудника и сумму!'); const st = e.staffList.find(x => x.name === emp); e.payrollOps.unshift({ date: document.getElementById('zp-d').value || window.today(), emp, kind: document.getElementById('zp-k').value, amt, cur: st ? st.cur : 'RUB' }); window.save(true); window.renderExpTab(); };
  window.p4ZpEdit = i => { const op = window.ensureStore().payrollOps[i]; if (!op) return; const a = prompt('Сумма (' + op.emp + '):', op.amt); if (a !== null) { op.amt = window.num(a); window.save(true); window.renderExpTab(); } };

  window.renderExpTab = function () {
    const sec = document.getElementById('tab-exp'); if (!sec) return;
    const e = window.ensureStore(), rate = window.getRate();
    const orgOpts = [...new Set((window.db.orgs || []).map(o => o.name))].map(n => `<option value="${window.esc(n)}">${window.esc(n)}</option>`).join('');

    const txType = document.getElementById('tx-type');
    if (txType) { const c = txType.value; txType.innerHTML = window.getDictOptions(e.dictTaxTypes, c); const lbl = txType.parentElement?.querySelector('label'); if (lbl && !lbl.querySelector('button')) lbl.outerHTML = window.withPlusBtn('Вид налога', 'dictTaxTypes', 'Вид налога', 'tx-type'); }
    const txAmt = document.getElementById('tx-amt');
    if (txAmt && !document.getElementById('p4-tx-btn')) { const b = document.createElement('button'); b.id = 'p4-tx-btn'; b.type = 'button'; b.className = 'btn btn-success'; b.style.marginTop = '5px'; b.textContent = '✅ Целиком за месяц'; b.onclick = window.p4TaxFullMonth; txAmt.parentNode.appendChild(b); }

    const exCat = document.getElementById('ex-cat');
    if (exCat) { const c = exCat.value; exCat.innerHTML = window.getDictOptions(e.dictOpiuArticles, c); const lbl = exCat.parentElement?.querySelector('label'); if (lbl && !lbl.querySelector('button')) lbl.outerHTML = window.withPlusBtn('Статья ОПиУ', 'dictOpiuArticles', 'Статья ОПиУ', 'ex-cat'); }

    document.getElementById('tb-tax').innerHTML = (window.db.taxes || []).map(t => `<tr><td>${t.per || (t.yr + ' • ' + t.kv + ' кв.')}</td><td class="bold">${window.esc(t.org)}</td><td>${window.esc(t.type)}</td><td class="num">${window.fmtR(t.amt)}</td><td class="num bold text-red">${window.fmtR(t.mSum || (t.amt / 3))} / мес.</td><td style="white-space:nowrap"><button class="btn" style="padding:3px 7px" onclick="editTaxRow('${t.id}')">✏️</button> <button class="btn btn-danger" onclick="db.taxes=db.taxes.filter(x=>x.id!=='${t.id}');save(true);renderExpTab()">✕</button></td></tr>`).join('');
    document.getElementById('tb-exp').innerHTML = (window.db.expenses || []).map(x => `<tr><td>${x.yr}-${x.mo}</td><td class="bold">${window.esc(x.org)}</td><td>${window.esc(x.cat)}</td><td>${window.esc(x.tit)}</td><td class="num">${x.cur === 'USD' ? window.fmtU(x.amt) : window.fmtR(x.amt)}</td><td class="num bold text-red">${window.fmtR(x.cur === 'USD' ? x.amt * rate : x.amt)}</td><td style="white-space:nowrap"><button class="btn" style="padding:3px 7px" onclick="editExpRow('${x.id}')">✏️</button> <button class="btn btn-danger" onclick="db.expenses=db.expenses.filter(i=>i.id!=='${x.id}');save(true);renderExpTab()">✕</button></td></tr>`).join('');

    let box = document.getElementById('p4-exp-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-exp-box'; sec.appendChild(box); }
    const stAct = e.staffList.filter(s => !s.arch);
    const tdRows = e.taxDebts.map((t, i) => `<tr><td>${window.esc(t.org)}</td><td>${window.esc(t.tax)}</td><td class="num bold">${window.fmtR(t.debt)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4TdEdit(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('taxDebts',${i})">✕</button></td></tr>`).join('');
    const zpRows = stAct.map(s => { let bal = window.num(s.initDebt); e.payrollOps.forEach(op => { if (op.emp === s.name) bal += (op.kind === 'Начислено' ? window.num(op.amt) : -window.num(op.amt)); }); return `<tr><td class="bold">${window.esc(s.name)}</td><td>${window.esc(s.role)}</td><td class="num">${window.num(s.initDebt)} ${window.esc(s.cur)}</td><td class="num bold">${bal} ${window.esc(s.cur)}</td></tr>`; }).join('');
    const zpOpsRows = e.payrollOps.slice(0, 40).map((op, i) => `<tr><td>${window.esc(op.date)}</td><td class="bold">${window.esc(op.emp)}</td><td>${window.esc(op.kind)}</td><td class="num bold">${op.amt} ${window.esc(op.cur)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4ZpEdit(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('payrollOps',${i})">✕</button></td></tr>`).join('');

    box.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🏛️ Входящие налоговые долги / переплаты на 01.01</div></div><div class="form-grid" style="margin-bottom:10px"><div>${window.withPlusBtn('Юрлицо', 'orgs', 'Юрлицо', 'td-o')}<select id="td-o" class="select">${orgOpts}</select></div><div>${window.withPlusBtn('Налог', 'dictTaxTypes', 'Вид налога', 'td-t')}<select id="td-t" class="select">${window.getDictOptions(e.dictTaxTypes)}</select></div><div><label>Сальдо ₽</label><input id="td-a" type="number" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4TdAdd()">+ Записать</button></div></div><table><thead><tr><th>Юрлицо</th><th>Налог</th><th class="num">Сальдо 01.01</th><th></th></tr></thead><tbody>${tdRows}</tbody></table></div>
      <div class="card"><div class="card-header"><div class="card-title">👥 Зарплатная ведомость SKOS (ЗПВ)</div></div><div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="zp-d" type="date" class="input" value="${window.today()}"></div><div>${window.withPlusBtn('Сотрудник', 'staffList', 'Сотрудник', 'zp-e')}<select id="zp-e" class="select"><option value="">— Сотрудник —</option>${stAct.map(x => `<option value="${window.esc(x.name)}">${window.esc(x.name)}</option>`).join('')}</select></div><div><label>Операция</label><select id="zp-k" class="select"><option>Начислено</option><option>Выплачено</option></select></div><div><label>Сумма</label><input id="zp-a" type="number" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4ZpAdd()">+ Провести</button></div></div><table style="margin-bottom:10px"><thead><tr><th>Сотрудник</th><th>Должность</th><th class="num">Долг 01.01</th><th class="num">Остаток</th></tr></thead><tbody>${zpRows}</tbody></table><table><thead><tr><th>Дата</th><th>Сотрудник</th><th>Операция</th><th class="num">Сумма</th><th></th></tr></thead><tbody>${zpOpsRows}</tbody></table></div>`;
  };
  /* === Часть 10Д-1: Контрагенты и Основные средства (ОС) === */
  window.p4CtrAdd = () => { const e = window.ensureStore(), ctr = document.getElementById('ct-s').value, amt = window.num(document.getElementById('ct-a').value); if (!ctr || amt <= 0) return alert('Выберите контрагента и сумму!'); const info = e.contractors.find(c => c.name === ctr); e.contractorOps.unshift({ date: document.getElementById('ct-d').value || window.today(), ctr, kind: document.getElementById('ct-k').value, amt, cur: info ? info.cur : 'RUB' }); window.save(true); window.renderSupTab(); };
  window.p4CtrOpEdit = i => { const op = window.ensureStore().contractorOps[i]; if (!op) return; const a = prompt('Сумма (' + op.ctr + '):', op.amt); if (a !== null) { op.amt = window.num(a); window.save(true); window.renderSupTab(); } };

  window.p4OsAdd = () => { const e = window.ensureStore(), nm = document.getElementById('os-n').value.trim(), pr = window.num(document.getElementById('os-p').value); if (!nm || pr <= 0) return alert('Введите название и цену ОС!'); e.osList.unshift({ name: nm, qty: window.num(document.getElementById('os-q').value) || 1, price: pr, months: window.num(document.getElementById('os-m').value) || 36, passed: window.num(document.getElementById('os-ps').value) || 0, room: document.getElementById('os-r').value.trim() }); window.save(true); window.renderSupTab(); };
  window.p4OsEdit = i => { const o = window.ensureStore().osList[i]; if (!o) return; const nm = prompt('Название ОС:', o.name); if (nm) o.name = nm.trim(); const pr = prompt('Цена ₽:', o.price); if (pr !== null) o.price = window.num(pr); const p = prompt('Прошло месяцев износа:', o.passed || 0); if (p !== null) o.passed = window.num(p); window.save(true); window.renderSupTab(); };

  window.renderSupTab = function () {
    const sec = document.getElementById('tab-sup'); if (!sec) return;
    Array.from(sec.children).forEach(ch => { if (ch.id !== 'p4-sup-box') ch.classList.add('hidden'); });
    const e = window.ensureStore();
    let box = document.getElementById('p4-sup-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-sup-box'; sec.insertBefore(box, sec.firstChild); }

    const cAct = e.contractors.filter(c => !c.arch);
    const cRows = cAct.map(c => { let acc = 0, pay = 0; e.contractorOps.forEach(op => { if (op.ctr === c.name) { if (op.kind === 'Начислено') acc += window.num(op.amt); else pay += window.num(op.amt); } }); const end = window.num(c.initDebt) + acc - pay; return `<tr><td class="bold">${window.esc(c.name)}</td><td>${window.esc(c.art)}</td><td class="num">${window.num(c.initDebt)}</td><td class="num">${acc}</td><td class="num">${pay}</td><td class="num bold ${end > 0 ? 'text-red' : 'text-green'}">${end} ${window.esc(c.cur)}</td></tr>`; }).join('');
    const cOpsRows = e.contractorOps.slice(0, 40).map((op, i) => `<tr><td>${window.esc(op.date)}</td><td class="bold">${window.esc(op.ctr)}</td><td>${window.esc(op.kind)}</td><td class="num bold">${op.amt} ${window.esc(op.cur)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4CtrOpEdit(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('contractorOps',${i})">✕</button></td></tr>`).join('');
    const oRows = e.osList.map((o, i) => { const full = window.num(o.qty || 1) * window.num(o.price), m = Math.max(1, window.num(o.months) || 24), rem = Math.max(0, full - (full / m) * Math.min(m, window.num(o.passed))); return `<tr><td class="bold">${window.esc(o.name)} (${window.esc(o.room || 'Цех')})</td><td class="num">${window.fmtR(full)}</td><td class="num">${o.passed}/${m}</td><td class="num bold">${window.fmtR(rem)}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4OsEdit(${i})">✏️</button> <button class="btn btn-danger" onclick="p4DelRow('osList',${i})">✕</button></td></tr>`; }).join('');

    box.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🤝 Контрагенты SKOS (Сальдо 01.01 + Начислено − Выплачено)</div></div><div class="form-grid" style="margin-bottom:10px"><div><label>Дата</label><input id="ct-d" type="date" class="input" value="${window.today()}"></div><div>${window.withPlusBtn('Контрагент', 'contractors', 'Контрагент', 'ct-s')}<select id="ct-s" class="select"><option value="">— Контрагент —</option>${cAct.map(x => `<option value="${window.esc(x.name)}">${window.esc(x.name)}</option>`).join('')}</select></div><div><label>Тип</label><select id="ct-k" class="select"><option>Начислено</option><option>Выплачено</option></select></div><div><label>Сумма</label><input id="ct-a" type="number" class="input"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4CtrAdd()">+ Записать</button></div></div><table style="margin-bottom:10px"><thead><tr><th>Контрагент</th><th>Статья</th><th class="num">Нач.</th><th class="num">Начисл.</th><th class="num">Выплач.</th><th class="num">Остаток</th></tr></thead><tbody>${cRows}</tbody></table><table><thead><tr><th>Дата</th><th>Контрагент</th><th>Операция</th><th class="num">Сумма</th><th></th></tr></thead><tbody>${cOpsRows}</tbody></table></div>
      <div class="card"><div class="card-header"><div class="card-title">🖥️ Основные средства (ОС) и Амортизация</div></div><div class="form-grid" style="margin-bottom:10px"><div><label>Название</label><input id="os-n" class="input"></div><div><label>Шт</label><input id="os-q" type="number" class="input" value="1"></div><div><label>Цена ₽</label><input id="os-p" type="number" class="input"></div><div><label>Срок мес</label><input id="os-m" type="number" class="input" value="36"></div><div><label>Прошло</label><input id="os-ps" type="number" class="input" value="0"></div><div><label>Где</label><input id="os-r" class="input" value="Цех"></div><div><button class="btn btn-primary" style="width:100%" onclick="p4OsAdd()">+ ОС</button></div></div><table><thead><tr><th>Объект</th><th class="num">Сумма ₽</th><th class="num">Срок</th><th class="num">Остаточная ₽</th><th></th></tr></thead><tbody>${oRows}</tbody></table></div>`;
  };
  /* === Часть 10Д-2: Справочники, Настройки юрлиц, Вход и Запуск === */
  window.p4DictSub = sub => { window.ensureStore().dictSub = sub; window.save(); window.renderDictTab(); };
  window.p4DictAdd = key => {
    const e = window.ensureStore(), nm = (document.getElementById('d-nm')?.value || '').trim(); if (!nm) return alert('Введите название!');
    if (key === 'staffList') e.staffList.unshift({ name: nm, role: (document.getElementById('d-role')?.value || '').trim(), art: document.getElementById('d-art')?.value || 'ФОТ офис', cur: document.getElementById('d-cur')?.value || 'RUB', initDebt: window.num(document.getElementById('d-debt')?.value), arch: false });
    else if (key === 'contractors') e.contractors.unshift({ name: nm, art: document.getElementById('d-art')?.value || 'Аренда склада', cur: document.getElementById('d-cur')?.value || 'RUB', initDebt: window.num(document.getElementById('d-debt')?.value), arch: false });
    else e[key].unshift({ name: nm, arch: false });
    window.save(true); window.renderDictTab();
  };
  window.p4DictEdit = (key, i) => { const it = window.ensureStore()[key]?.[i]; if (!it) return; const nw = prompt('Название:', it.name); if (nw) it.name = nw.trim(); if (key === 'staffList' || key === 'contractors') { const nd = prompt('Сальдо 01.01:', it.initDebt || 0); if (nd !== null) it.initDebt = window.num(nd); } window.save(true); window.renderDictTab(); };
  window.p4DictArch = (key, i) => { const it = window.ensureStore()[key]?.[i]; if (it) { it.arch = !it.arch; window.save(true); window.renderDictTab(); } };
  window.p4DictDel = (key, i) => { const e = window.ensureStore(); if (e[key]?.[i] && confirm('Удалить?')) { e[key].splice(i, 1); window.save(true); window.renderDictTab(); } };
  window.p4AddCustomDictFolder = () => { const t = prompt('Название новой папки:'); if (!t || !t.trim()) return; const e = window.ensureStore(), id = 'cust_' + Date.now(); e[id] = []; e.customDictFolders.push({ id, key: id, title: '📁 ' + t.trim() }); e.dictSub = id; window.save(true); window.renderDictTab(); };

  window.renderDictTab = function () {
    const sec = document.getElementById('tab-dict'); if (!sec) return;
    const e = window.ensureStore();
    const baseFolders = [
      { id: 'opiu', key: 'dictOpiuArticles', title: '📊 Статьи ОПиУ' }, { id: 'ctrs', key: 'contractors', title: '🤝 Контрагенты' },
      { id: 'staff', key: 'staffList', title: '👥 Сотрудники' }, { id: 'taxes', key: 'dictTaxTypes', title: '🏛️ Виды налогов' },
      { id: 'cats', key: 'dictMatCats', title: '🧵 Категории сырья' }, { id: 'units', key: 'dictUnits', title: '📏 Ед. измерения' }, { id: 'sups', key: 'dictSuppliers', title: '🌍 Поставщики' }
    ].concat(e.customDictFolders || []);
    const cur = baseFolders.find(f => f.id === e.dictSub) || baseFolders;
    const list = e[cur.key] || [];
    let extra = '';
    if (cur.key === 'staffList') extra = '<div><label>Должность</label><input id="d-role" class="input"></div><div><label>Валюта</label><select id="d-cur" class="select"><option>RUB</option><option>USD</option></select></div><div><label>Долг 01.01</label><input id="d-debt" type="number" class="input" value="0"></div>';
    else if (cur.key === 'contractors') extra = `<div><label>Статья ОПиУ</label><select id="d-art" class="select">${window.getDictOptions(e.dictOpiuArticles)}</select></div><div><label>Валюта</label><select id="d-cur" class="select"><option>RUB</option><option>USD</option></select></div><div><label>Сальдо 01.01</label><input id="d-debt" type="number" class="input" value="0"></div>`;
    const rows = list.map((it, i) => `<tr style="${it.arch ? 'opacity:0.5' : ''}"><td class="bold">${window.esc(it.name)}</td><td>${it.initDebt ? '01.01: ' + it.initDebt + ' ' + (it.cur || 'RUB') : 'Активен'}</td><td class="num" style="white-space:nowrap"><button class="btn" onclick="p4DictEdit('${cur.key}',${i})">✏️</button> <button class="btn" onclick="p4DictArch('${cur.key}',${i})">📦</button> <button class="btn btn-danger" onclick="p4DictDel('${cur.key}',${i})">✕</button></td></tr>`).join('');
    sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📚 Единые справочники SKOS</div><button class="btn btn-success" onclick="p4AddCustomDictFolder()">+ Новая папка</button></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${baseFolders.map(f => `<button class="btn ${f.id === cur.id ? 'btn-primary' : ''}" onclick="p4DictSub('${f.id}')">${f.title} (${(e[f.key] || []).length})</button>`).join('')}</div><div class="form-grid" style="margin-bottom:10px"><div><label>Название</label><input id="d-nm" class="input"></div>${extra}<div><button class="btn btn-primary" style="width:100%" onclick="p4DictAdd('${cur.key}')">+ Добавить</button></div></div><table><thead><tr><th>Название</th><th>Параметры</th><th class="num">Действия</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Пусто</td></tr>'}</tbody></table></div>`;
  };

  window.addOrg = e => { e.preventDefault(); if (window.__skosReadOnly) return; window.db.orgs.push({ id: 'o_' + Date.now(), name: document.getElementById('og-name').value.trim(), bank: document.getElementById('og-bank').value.trim() }); e.target.reset(); window.save(true); window.renderSetTab(); };
  window.toggleOrgArch = id => { const o = (window.db.orgs || []).find(x => x.id === id); if (!o) return; if (!o.archived) { const y = prompt('Год закрытия ИП:', '2026'); if (y === null) return; o.archived = true; o.closedYear = parseInt(y, 10) || 2026; } else { o.archived = false; delete o.closedYear; } window.save(true); window.renderSetTab(); };
  window.renderSetTab = () => { const tb = document.getElementById('tb-orgs-set'); if (tb) tb.innerHTML = (window.db.orgs || []).map(o => `<tr><td class="bold">${window.esc(o.name)} ${o.archived ? `<span class="badge badge-amber">Закрыто (${o.closedYear})</span>` : ''}</td><td>${window.esc(o.bank)}</td><td style="white-space:nowrap"><button class="btn" onclick="toggleOrgArch('${o.id}')">${o.archived ? 'Вернуть' : 'В архив'}</button> <button class="btn btn-danger" onclick="db.orgs=db.orgs.filter(x=>x.id!=='${o.id}');save(true);renderSetTab()">✕</button></td></tr>`).join(''); };

  window.fillAllSelects = () => {
    const orgNames = [...new Set((window.db.orgs || []).map(o => o.name))];
    ['f-org', 'up-org', 'tx-org', 'ex-org', 'mn-org'].forEach(id => { const el = document.getElementById(id); if (!el) return; const cur = el.value; el.innerHTML = (id === 'f-org' ? '<option value="ALL">Все юрлица (5 ИП + ООО)</option>' : '') + orgNames.map(n => `<option value="${window.esc(n)}">${window.esc(n)}</option>`).join(''); if (cur) el.value = cur; });
    const allWals = (window.db.orgs || []).map(o => ({ id: o.id, name: o.name + ' (' + o.bank + ')', cur: 'RUB' })).concat(window.db.cashWallets || []);
    ['dds-wal', 'd-wal', 'tr-from', 'tr-to'].forEach(id => { const el = document.getElementById(id); if (!el) return; const cur = el.value; el.innerHTML = allWals.map(w => `<option value="${w.id}">${window.esc(w.name)} [${w.cur}]</option>`).join(''); if (cur) el.value = cur; });
  };

  window.applyGuestRestrictions = () => { window.__skosReadOnly = true; if (!document.getElementById('ro-css')) { const st = document.createElement('style'); st.id = 'ro-css'; st.textContent = '#tab-set,#nav-set,input[type="file"],.btn-danger,.btn-success,form,.form-grid:has(input:not([type="checkbox"])){display:none!important}td .btn{display:none!important}'; document.head.appendChild(st); } };

  function showLoginGate() {
    const { OWNER, VIEW } = window._CFG, role = sessionStorage.getItem('skos_auth_role');
    if (role === 'owner') return; if (role === 'viewer') { window.applyGuestRestrictions(); return; }
    const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.92);z-index:99999;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = '<div style="background:#fff;padding:24px;border-radius:14px;width:320px"><h3 style="margin-bottom:10px">🔐 SKOS Finance 3.0</h3><input id="lg-p" type="password" class="input" placeholder="Пароль доступа" style="margin-bottom:12px"><button id="lg-b" class="btn btn-primary" style="width:100%">Войти</button><div id="lg-e" style="color:#dc2626;font-size:12px;margin-top:6px;display:none">⛔ Неверный пароль</div></div>';
    document.body.appendChild(ov);
    const go = () => { const p = (document.getElementById('lg-p').value || '').trim(); if (p === OWNER) { sessionStorage.setItem('skos_auth_role', 'owner'); ov.remove(); } else if (p === VIEW) { sessionStorage.setItem('skos_auth_role', 'viewer'); ov.remove(); window.applyGuestRestrictions(); } else document.getElementById('lg-e').style.display = 'block'; };
    document.getElementById('lg-b').onclick = go; document.getElementById('lg-p').onkeydown = e => { if (e.key === 'Enter') go(); };
  }

  window.addEventListener('DOMContentLoaded', () => {
    const s = localStorage.getItem(window._CFG.KEY); if (s) { try { Object.assign(window.db, JSON.parse(s)); } catch (e) {} }
    window.ensureStore();
    ['f-yr', 'up-yr', 'tx-yr', 'ex-yr', 'mn-yr'].forEach(id => { const el = document.getElementById(id); if (!el) return; let h = id === 'f-yr' ? '<option value="ALL">Все года (2020–2050)</option>' : ''; for (let y = 2020; y <= 2050; y++) h += `<option value="${y}"${y === 2026 ? ' selected' : ''}>${y}</option>`; el.innerHTML = h; });
    const { URL: U, KEY_API: K, OWNER: P } = window._CFG;
    if (document.getElementById('sb-url')) document.getElementById('sb-url').value = window.db.cloud?.url || U;
    if (document.getElementById('sb-key')) document.getElementById('sb-key').value = window.db.cloud?.key || K;
    if (document.getElementById('sb-pin')) document.getElementById('sb-pin').value = window.db.cloud?.pin || P;
    showLoginGate(); window.onPerChange(); window.pullCloud(true);
  });
    /* === Фикс-блок: Железный URL Облака + Кнопка «Очистить» + Защита ДДС === */
  // 1. Принудительно исправляем старый обрезанный URL из бэкапов на правильный адрес проекта
  window.fixCloudUrlNow = function () {
    const REAL_URL = 'https://supabase.co';
    const REAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdWR2bnp5cXJ4eGFsaWtjbWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NTEwNzYsImV4cCI6MjExMDMyNzA3Nn0.cgCy3KoqjKuJaI4gzG8_nIlv20JttvAg7UgwTVQ-qwE';
    if (!window.db.cloud) window.db.cloud = {};
    if (!window.db.cloud.url || window.db.cloud.url === 'https://supabase.co' || !window.db.cloud.url.includes('pkudvnzyqrxxalikcmag')) {
      window.db.cloud.url = REAL_URL;
    }
    if (!window.db.cloud.key) window.db.cloud.key = REAL_KEY;
    const uEl = document.getElementById('sb-url');
    const kEl = document.getElementById('sb-key');
    if (uEl) uEl.value = window.db.cloud.url;
    if (kEl && !kEl.value) kEl.value = window.db.cloud.key;
  };
  window.fixCloudUrlNow();

  const _origPush = window.pushCloud;
  window.pushCloud = async function (manual) {
    window.fixCloudUrlNow();
    return await _origPush.call(this, manual);
  };
  const _origPull = window.pullCloud;
  window.pullCloud = async function (silent) {
    window.fixCloudUrlNow();
    return await _origPull.call(this, silent);
  };
  const _origImportJson = window.importJson;
  window.importJson = function (ev) {
    _origImportJson.call(this, ev);
    setTimeout(window.fixCloudUrlNow, 300);
  };

  // 2. Рабочая кнопка «🗑️ Очистить» для черновика отчётов
  window.clearMpDraft = function () {
    mpBatch = null;
    window.renderMpDraft();
  };
  const _origRenderDraft = window.renderMpDraft;
  window.renderMpDraft = function () {
    _origRenderDraft.call(this);
    const box = document.getElementById('map-box');
    if (box) {
      const clr = box.querySelector('.btn-danger');
      if (clr) clr.onclick = window.clearMpDraft;
    }
  };

  // 3. Потоковый импорт выписок ДДС без ошибки lines.split
  window.importBankCsv = async function (ev) {
    if (window.__skosReadOnly) return;
    const f = ev?.target?.files?.[0]; if (!f) return; ev.target.value = '';
    const walId = document.getElementById('dds-wal').value, batchId = 'b_' + Date.now();
    window.showToastProgress('⏳ Загрузка банковской выписки...');
    const buf = await f.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(buf); if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(buf);
    const lines = txt.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return;
    const sep = lines[0].includes('\t') ? '\t' : ((lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',');
    let added = 0, skip = 0;
    for (let idx = 1; idx < lines.length; idx++) {
      const c = splitCsvLine(lines[idx], sep); if (c.length < 3) continue;
      const rawDt = c.find(x => /^(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$/.test(x));
      if (!rawDt) continue;
      const dt = /^\d{4}-\d{2}-\d{2}$/.test(rawDt) ? rawDt.split('-').reverse().join('.') : rawDt;
      const low = c.join(' ').toLowerCase();
      if (low.includes('входящий остаток') || low.includes('исходящий остаток')) continue;
      let amt = 0;
      for (let i = 1; i < c.length; i++) { const n = window.num(c[i]); if (n !== 0 && !/^\d{2}\.\d{2}\.\d{4}$/.test(c[i])) { amt = n; break; } }
      if (!amt) continue;
      const hash = walId + '_' + dt + '_' + amt + '_' + low.slice(0, 30) + '_' + idx;
      if (window.db.ddsHashes[hash]) { skip++; continue; }
      window.db.ddsHashes[hash] = true;
      let cat = amt >= 0 ? 'Прочие поступления' : 'Прочие расходы';
      if (low.match(/вайлдберриз|wildberries|рвб/)) cat = 'Поступление от ВБ';
      else if (low.match(/озон|интернет решения/) && amt > 0) cat = 'Поступление от Озон';
      else if (low.match(/яндекс|спичкин/) && amt > 0) cat = 'Поступление от ЯМ';
      else if (low.match(/комисс|рко|обслуживан/)) cat = 'Комиссия РКО';
      else if (low.match(/уфнс|енс|енп|налог|взнос/)) cat = 'ЕНП';
      else if (low.match(/снятие налич|выдача налич|перевод собствен/)) {
        cat = amt >= 0 ? 'Поступление — Перевод между счетами' : 'Выбытие — Перевод между счетами';
        if (amt < 0) window.db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dt, wal: 'c1', cat: 'Поступление — Перевод между счетами', amt: Math.abs(amt), batchId });
      }
      window.db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dt, wal: walId, cat, amt, note: c.join(' ').slice(0, 120), batchId });
      added++;
    }
    window.save(true); window.renderDdsTab(); window.showToastProgress('✅ Выписка загружена!', 2000);
    alert('✅ Загружено операций: ' + added + ' (дублей пропущено: ' + skip + ')');
  };
})();

