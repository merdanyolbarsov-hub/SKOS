(function () {
  if (window.__skosMasterErpLoaded) return;
  window.__skosMasterErpLoaded = true;

  function pSave() {
    if (typeof save === 'function') save();
    else if (window.db) localStorage.setItem('skos_v3_prod', JSON.stringify(window.db));
  }

  function ensureStore() {
    if (!window.db) window.db = {};
    if (!window.db.erp) window.db.erp = {};
    const e = window.db.erp;
    if (!Array.isArray(e.materials)) e.materials = [];
    if (!Array.isArray(e.matIn)) e.matIn = [];
    if (!Array.isArray(e.orders)) e.orders = [];
    if (!Array.isArray(e.bom)) e.bom = [];
    if (!Array.isArray(e.fgStocks)) e.fgStocks = [];
    if (!Array.isArray(e.fgLockedMonths)) e.fgLockedMonths = [];
    if (!Array.isArray(e.defects)) e.defects = [];
    if (!Array.isArray(e.unitEcon)) e.unitEcon = [];
    if (!Array.isArray(e.osList)) e.osList = [];
    if (!Array.isArray(e.contractors)) e.contractors = [];
    if (!Array.isArray(e.contractorOps)) e.contractorOps = [];
    if (!Array.isArray(e.staffList)) e.staffList = [];
    if (!Array.isArray(e.payrollOps)) e.payrollOps = [];
    if (!Array.isArray(e.taxDebts)) e.taxDebts = [];
    if (!Array.isArray(e.ddsArticles)) {
      e.ddsArticles = [
        { name: 'Поступление от ВБ', dir: 'in', opiu: 'Учёт сделок (не дубл.)' },
        { name: 'Поступление от Озон', dir: 'in', opiu: 'Учёт сделок (не дубл.)' },
        { name: 'Поступление от Яндекс Маркет', dir: 'in', opiu: 'Учёт сделок (не дубл.)' },
        { name: 'Закуп товара / сырья USD', dir: 'out', opiu: 'Учёт запасов (не дубл.)' },
        { name: 'Закуп товара / сырья RUB', dir: 'out', opiu: 'Учёт запасов (не дубл.)' },
        { name: 'Упаковочные материалы', dir: 'out', opiu: 'Общепроизводственные' },
        { name: 'Доставка из Китая / Турции', dir: 'out', opiu: 'Общепроизводственные' },
        { name: 'Доставка по РФ до склада', dir: 'out', opiu: 'Общепроизводственные' },
        { name: 'Таможенное оформление / ФТС', dir: 'out', opiu: 'Общепроизводственные' },
        { name: 'Сертификация товара', dir: 'out', opiu: 'Общепроизводственные' },
        { name: 'Авто расходы компании', dir: 'out', opiu: 'Общепроизводственные' },
        { name: 'Аренда склада', dir: 'out', opiu: 'Учёт поставщиков' },
        { name: 'ФОТ склад / менеджеры', dir: 'out', opiu: 'ЗПВ (не дубл.)' },
        { name: 'ФОТ офис / собственник', dir: 'out', opiu: 'ЗПВ (не дубл.)' },
        { name: 'Программное обеспечение', dir: 'out', opiu: 'Административные' },
        { name: 'Бухгалтерия / Юрист / НФ', dir: 'out', opiu: 'Административные' },
        { name: 'Командировки / Офис / Прочее', dir: 'out', opiu: 'Административные' },
        { name: 'УСН / АУСН / НДС / ЕНП / Взносы', dir: 'out', opiu: 'Учёт налогов (не дубл.)' },
        { name: 'Перевод между счетами', dir: 'move', opiu: 'Нет в ОПиУ' },
        { name: 'Конвертация валют RUB ↔ USD', dir: 'move', opiu: 'Нет в ОПиУ' },
        { name: 'Вклады собственников / Дивиденды', dir: 'fin', opiu: 'Нет в ОПиУ' }
      ];
    }
    if (!e.stkSub) e.stkSub = 'sum';
    if (!e.ueView) e.ueView = 'fact';
    if (!e.ueFilter) e.ueFilter = { mp: 'ALL', org: 'ALL', mo: 'ALL', q: '' };
    if (!e.expSub) e.expSub = 'taxes';
    if (!e.supSub) e.supSub = 'contractors';
    return e;
  }

    // --- ЖИВЫЕ СПРАВОЧНИКИ ДЛЯ ВСЕХ ВЫПАДАЮЩИХ СПИСКОВ ---
  function getModelsList() {
    const e = ensureStore();
    const map = new Map();
    (window.db?.skus || []).forEach(s => {
      if (s && s.name) {
        const k = String(s.name).trim();
        map.set(k.toLowerCase(), { name: k, usd: Number(s.usd) || 0 });
      }
    });
    (e.bom || []).forEach(b => {
      if (b && b.product) {
        const k = String(b.product).trim();
        const u = (b.items || []).reduce((s, it) => s + (Number(it.norm) || 0) * (Number(it.priceUsd) || 0), 0);
        const prev = map.get(k.toLowerCase()) || { name: k, usd: 0 };
        map.set(k.toLowerCase(), { name: k, usd: u || prev.usd, hasBom: true });
      }
    });
    (window.db?.itemSales || []).forEach(s => {
      const nm = String(s?.name || s?.model || '').trim();
      if (nm && !map.has(nm.toLowerCase())) {
        map.set(nm.toLowerCase(), { name: nm, usd: Number(s.usd) || 0 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  function getModelUsd(name) {
    const k = String(name || '').trim().toLowerCase();
    const m = getModelsList().find(x => x.name.toLowerCase() === k);
    return m ? m.usd : 0;
  }

  function getLiveOrgsList() {
    const set = new Set();
    (window.db?.orgs || []).forEach(o => { if (o && o.name && !o.archived && !o.hidden) set.add(String(o.name).trim()); });
    if (!set.size) {
      ['ИП Каримов Артем', 'ИП Джуманиязова Мавлюда', 'ИП Джуманиязова Эльмира', 'ИП Триков Курбан', 'ИП Керимов Сахет', 'ООО Скос'].forEach(n => set.add(n));
    }
    return Array.from(set);
  }

  // --- ПОЛНАЯ ЗАГРУЗКА СТАРТОВЫХ ДАННЫХ SKOS В 1 КЛИК ---
  window.seedAllSkosData = function () {
    if (!confirm('Загрузить стартовые справочники SKOS (материалы, техкарты, ОС, контрагенты, сотрудники и налоговые долги)?\nВаши уже введённые записи не удалятся.')) return;
    const e = ensureStore();
    const mats = [
      ['Ткань лён', 'м2', 'Ткань', 120, 240], ['Ткань флис', 'кг', 'Ткань', 180, 720],
      ['Ткань жаты', 'м2', 'Ткань', 250, 250], ['Ткань брюк', 'м2', 'Ткань', 150, 397.5],
      ['Ткань габардин', 'м2', 'Ткань', 90, 177.3], ['Пуговица для брюк', 'шт', 'Фурнитура', 5000, 50],
      ['Пуговица рубашек', 'шт', 'Фурнитура', 8000, 32], ['Замок для брюк', 'шт', 'Фурнитура', 2000, 40],
      ['Крючок', 'шт', 'Фурнитура', 2000, 40], ['Карсаж', 'м', 'Фурнитура', 500, 100],
      ['Ичлик', 'м', 'Фурнитура', 400, 156], ['Клейвой', 'м', 'Фурнитура', 600, 60],
      ['Резинка 5см', 'м', 'Фурнитура', 800, 64], ['Тканевая этикетка', 'шт', 'Упаковка', 5000, 50],
      ['Боковая этикетка', 'шт', 'Упаковка', 5000, 400], ['Висячая этикетка', 'шт', 'Упаковка', 5000, 50],
      ['Размерная этикетка', 'шт', 'Упаковка', 5000, 15], ['Веревка для этикеток', 'шт', 'Упаковка', 5000, 15],
      ['Пакет 5', 'шт', 'Упаковка', 4000, 240], ['Пакет 10', 'шт', 'Упаковка', 3000, 210]
    ];
    mats.forEach(([name, unit, cat, initQty, initUsd]) => {
      if (!e.materials.some(m => m.name === name)) e.materials.push({ name, unit, cat, initQty, initUsd });
    });
    if (!e.bom.some(b => b.product === 'Брюки мужские зауженные')) {
      e.bom.push({ product: 'Брюки мужские зауженные', items: [
        { matName: 'Пошив одежды', norm: 1, priceUsd: 2.0 }, { matName: 'Ткань брюк', norm: 1.25, priceUsd: 2.65 },
        { matName: 'Карсаж', norm: 1.1, priceUsd: 0.20 }, { matName: 'Ичлик', norm: 0.35, priceUsd: 0.39 },
        { matName: 'Боковая этикетка', norm: 1, priceUsd: 0.08 }, { matName: 'Пакет 10', norm: 10, priceUsd: 0.07 }
      ]});
    }
    if (!e.bom.some(b => b.product === 'Костюм оверсайз')) {
      e.bom.push({ product: 'Костюм оверсайз', items: [
        { matName: 'Пошив одежды', norm: 1, priceUsd: 2.8 }, { matName: 'Ткань жаты', norm: 3.5, priceUsd: 1.0 },
        { matName: 'Резинка 5см', norm: 0.75, priceUsd: 0.08 }, { matName: 'Боковая этикетка', norm: 1, priceUsd: 0.08 }
      ]});
    }
    [
      ['Курбан', 'Руководитель склада', 'ФОТ склад', 'RUB', 125000], ['Сайид', 'Старший кладовщик', 'ФОТ склад', 'RUB', 100000],
      ['Касым', 'Производство ТМ', 'ФОТ менеджеры', 'USD', 500], ['Мердан', 'Менеджер МП', 'ФОТ менеджеры', 'USD', 500],
      ['Саша', 'Контент / Офис', 'ФОТ офис', 'USD', 500]
    ].forEach(([name, role, art, cur, initDebt]) => {
      if (!e.staffList.some(s => s.name === name)) e.staffList.push({ name, role, art, status: 'Работает', cur, initDebt });
    });
    [
      ['ООО Сопровождение 1с', 'Программное обеспечение', 'RUB', 0], ['МойСклад', 'Программное обеспечение', 'RUB', 0],
      ['ИП Спичак Е.Ю.', 'Аренда склада', 'RUB', 0], ['Наталья Николаевна Бухгалтер', 'Бухгалтерия', 'RUB', 0],
      ['Федеральная таможенная служба', 'Таможенное оформление', 'RUB', 0]
    ].forEach(([name, art, cur, initDebt]) => {
      if (!e.contractors.some(c => c.name === name)) e.contractors.push({ name, art, status: 'Работаем', cur, initDebt });
    });
    if (!e.osList.length) {
      e.osList.push(
        { name: 'Ноутбуки Lenovo / HP (5 шт.)', qty: 5, price: 65000, months: 60, passed: 10, resp: 'Мердан', room: 'Россия' },
        { name: 'Стеллажи и мебель склада', qty: 12, price: 28000, months: 60, passed: 10, resp: 'Курбан', room: 'Россия' },
        { name: 'Швейное и раскройное оборудование', qty: 8, price: 95000, months: 60, passed: 8, resp: 'Касым', room: 'Туркменистан' }
      );
    }
    pSave();
    if (typeof render === 'function') render();
    alert('✅ Стартовые данные SKOS загружены во все разделы!');
  };
  // --- РАСЧЁТ ЗАПАСОВ С УЧЁТОМ НАЧАЛЬНЫХ ОСТАТКОВ ---
  function calcStocks() {
    const e = ensureStore();
    const map = {};
    (e.materials || []).forEach(m => {
      const initQ = Number(m.initQty) || 0, initU = Number(m.initUsd) || 0;
      map[m.name] = { name: m.name, unit: m.unit || 'шт', cat: m.cat || 'Ткань', initQty: initQ, initUsd: initU, inQty: 0, inUsd: 0, outQty: 0, avgUsd: initQ > 0 ? initU / initQ : 0, balQty: 0, balUsd: 0 };
    });
    (e.matIn || []).forEach(r => {
      if (r.matName === 'Пошив одежды') return;
      if (!map[r.matName]) map[r.matName] = { name: r.matName, unit: 'шт', cat: 'Сырьё', initQty: 0, initUsd: 0, inQty: 0, inUsd: 0, outQty: 0, avgUsd: 0, balQty: 0, balUsd: 0 };
      map[r.matName].inQty += Number(r.qty) || 0;
      map[r.matName].inUsd += Number(r.totalUsd) || 0;
    });
    Object.values(map).forEach(x => { const q = x.initQty + x.inQty, u = x.initUsd + x.inUsd; if (q > 0) x.avgUsd = u / q; });
    (e.orders || []).forEach(o => {
      (o.lines || []).forEach(l => {
        if (l.matName === 'Пошив одежды') return;
        if (!map[l.matName]) map[l.matName] = { name: l.matName, unit: 'шт', cat: 'Сырьё', initQty: 0, initUsd: 0, inQty: 0, inUsd: 0, outQty: 0, avgUsd: Number(l.priceUsd) || 0, balQty: 0, balUsd: 0 };
        map[l.matName].outQty += Number(l.qty) || 0;
      });
    });
    let rawUsd = 0;
    Object.values(map).forEach(x => { x.balQty = Math.max(0, x.initQty + x.inQty - x.outQty); x.balUsd = x.balQty * x.avgUsd; rawUsd += x.balUsd; });
    const wipUsd = (e.orders || []).filter(o => o.status === 'WIP').reduce((s, o) => s + (Number(o.totalUsd) || 0), 0);
    const fgUsd = (e.fgStocks || []).reduce((s, r) => s + (r.lockedUsd != null ? Number(r.lockedUsd) : (((Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0)) * (Number(r.unitUsd) || 0))), 0);
    return { map, rawUsd, wipUsd, fgUsd, totalUsd: rawUsd + wipUsd + fgUsd };
  }

  // --- ПОЛНАЯ РАБОЧАЯ ЛОГИКА ВСЕХ КНОПОК В «ЗАПАСАХ, ПОШИВЕ, ТЕХКАРТАХ И БРАКЕ» ---
  window.stkAction = function (act, a, b) {
    const e = ensureStore();
    if (act === 'tab') { e.stkSub = a; pSave(); renderStkSection(); return; }
    if (act === 'addMat') {
      const name = document.getElementById('p4-m-n').value.trim(), unit = document.getElementById('p4-m-u').value.trim() || 'шт', cat = document.getElementById('p4-m-c').value;
      const initQty = Number(document.getElementById('p4-m-iq').value) || 0, initUsd = Number(document.getElementById('p4-m-iu').value) || 0;
      if (name) e.materials.unshift({ name, unit, cat, initQty, initUsd });
    }
    if (act === 'editMat') {
      const m = e.materials.at(a); if (!m) return;
      const n = prompt('Название:', m.name); if (n) m.name = n.trim();
      const iq = Number(prompt('Начальный остаток:', m.initQty || 0)); if (!isNaN(iq)) m.initQty = iq;
      const iu = Number(prompt('Начальная сумма ($):', m.initUsd || 0)); if (!isNaN(iu)) m.initUsd = iu;
    }
    if (act === 'delMat' && confirm('Удалить материал?')) e.materials.splice(a, 1);
    if (act === 'addIn') {
      const date = document.getElementById('p4-in-d').value, matName = document.getElementById('p4-in-m').value;
      const qty = Number(document.getElementById('p4-in-q').value) || 0, priceUsd = Number(document.getElementById('p4-in-p').value) || 0;
      const supplier = document.getElementById('p4-in-s').value.trim();
      if (matName && qty > 0) e.matIn.unshift({ date, matName, qty, priceUsd, totalUsd: qty * priceUsd, supplier });
    }
    if (act === 'editIn') {
      const r = e.matIn.at(a); if (!r) return;
      const q = Number(prompt('Кол-во:', r.qty)); if (q > 0) { r.qty = q; r.totalUsd = q * r.priceUsd; }
      const p = Number(prompt('Цена ($):', r.priceUsd)); if (p >= 0) { r.priceUsd = p; r.totalUsd = r.qty * p; }
    }
    if (act === 'delIn' && confirm('Удалить приход?')) e.matIn.splice(a, 1);
    if (act === 'addBom') {
      const product = document.getElementById('p4-bm-p').value.trim(), matName = document.getElementById('p4-bm-m').value;
      const norm = Number(document.getElementById('p4-bm-n').value) || 0, priceUsd = Number(document.getElementById('p4-bm-pr').value) || 0;
      if (!product || norm <= 0) return;
      let bom = e.bom.find(x => x.product.toLowerCase() === product.toLowerCase());
      if (!bom) { bom = { product, items: [] }; e.bom.push(bom); }
      const ex = bom.items.find(x => x.matName === matName);
      if (ex) { ex.norm = norm; ex.priceUsd = priceUsd; } else bom.items.push({ matName, norm, priceUsd });
    }
    if (act === 'editBomLine') {
      const it = e.bom.at(a)?.items?.at(b); if (!it) return;
      const n = Number(prompt('Норма на 1 шт.:', it.norm)); if (n > 0) it.norm = n;
      const p = Number(prompt('Цена ($):', it.priceUsd)); if (p >= 0) it.priceUsd = p;
    }
    if (act === 'delBomLine' && confirm('Удалить позицию?')) { e.bom.at(a)?.items?.splice(b, 1); }
    if (act === 'delBom' && confirm('Удалить всю техкарту?')) { e.bom.splice(a, 1); }
    if (act === 'addOrd') {
      const date = document.getElementById('p4-ord-d').value, product = document.getElementById('p4-ord-prod').value;
      const qty = Number(document.getElementById('p4-ord-qty').value) || 0, comment = document.getElementById('p4-ord-c').value.trim();
      const bom = e.bom.find(x => x.product.toLowerCase() === product.toLowerCase());
      if (!bom) return alert('Сначала заполните техкарту для этой модели ниже!');
      const { map } = calcStocks(); let totalUsd = 0;
      const lines = bom.items.map(bi => {
        const q = bi.norm * qty, u = (map[bi.matName]?.avgUsd > 0) ? map[bi.matName].avgUsd : bi.priceUsd;
        totalUsd += q * u; return { matName: bi.matName, qty: q, priceUsd: u, totalUsd: q * u };
      });
      e.orders.unshift({ date, doneDate: '', status: 'WIP', product, qty, totalUsd, comment, lines });
    }
    if (act === 'doneOrd') {
      const o = e.orders.at(a); if (!o) return;
      o.status = 'DONE'; o.doneDate = new Date().toISOString().slice(0, 10);
      const u = o.qty > 0 ? o.totalUsd / o.qty : getModelUsd(o.product);
      e.fgStocks.unshift({ month: o.doneDate.slice(0, 7), product: o.product, ruQty: 0, tmQty: o.qty, wayQty: 0, unitUsd: u });
    }
    if (act === 'editOrd') {
      const o = e.orders.at(a); if (!o) return;
      const q = Number(prompt('Кол-во штук:', o.qty)); if (q > 0) { const k = q / o.qty; o.qty = q; o.totalUsd *= k; }
    }
    if (act === 'delOrd' && confirm('Удалить заказ?')) e.orders.splice(a, 1);
    if (act === 'saveFg') {
      const month = document.getElementById('p4-fg-mo').value, product = document.getElementById('p4-fg-p').value.trim();
      const ruQty = Number(document.getElementById('p4-fg-ru').value) || 0, tmQty = Number(document.getElementById('p4-fg-tm').value) || 0;
      const wayQty = Number(document.getElementById('p4-fg-way').value) || 0, unitUsd = Number(document.getElementById('p4-fg-u').value) || getModelUsd(product);
      if (product) e.fgStocks.unshift({ month, product, ruQty, tmQty, wayQty, unitUsd });
    }
    if (act === 'lockFg') {
      e.fgStocks.forEach(r => { if (r.lockedUsd == null) r.lockedUsd = ((Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0)) * (Number(r.unitUsd) || 0); });
      alert('🔒 Суммы готового товара зафиксированы!');
    }
    if (act === 'editFg') {
      const r = e.fgStocks.at(a); if (!r) return;
      r.ruQty = Number(prompt('РФ (шт.):', r.ruQty)) || 0; r.tmQty = Number(prompt('ТМ (шт.):', r.tmQty)) || 0; r.wayQty = Number(prompt('Путь (шт.):', r.wayQty)) || 0;
    }
    if (act === 'delFg' && confirm('Удалить остаток?')) e.fgStocks.splice(a, 1);
    if (act === 'addDef') {
      const date = document.getElementById('p4-df-d').value, product = document.getElementById('p4-df-p').value.trim();
      const qty = Number(document.getElementById('p4-df-q').value) || 0, reason = document.getElementById('p4-df-r').value.trim();
      if (product && qty > 0) e.defects.unshift({ date, product, qty, unitUsd: getModelUsd(product), reason });
    }
    if (act === 'editDef') {
      const d = e.defects.at(a); if (!d) return;
      const q = Number(prompt('Шт. брака:', d.qty)); if (q > 0) d.qty = q;
    }
    if (act === 'delDef' && confirm('Удалить брак?')) e.defects.splice(a, 1);
    pSave();
    renderStkSection();
  };

  window.previewSewOrder = function () {
    const box = document.getElementById('p4-sew-preview'); if (!box) return;
    const prod = document.getElementById('p4-ord-prod')?.value;
    const qty = Number(document.getElementById('p4-ord-qty')?.value) || 0;
    const bom = ensureStore().bom.find(b => b.product.toLowerCase() === String(prod || '').toLowerCase());
    if (!bom || qty <= 0) { box.innerHTML = ''; return; }
    const { map } = calcStocks();
    let tot = 0;
    const rows = bom.items.map(it => {
      const need = (Number(it.norm) || 0) * qty;
      const u = (map[it.matName]?.avgUsd > 0) ? map[it.matName].avgUsd : (Number(it.priceUsd) || 0);
      tot += need * u;
      const ost = it.matName === 'Пошив одежды' ? 'Работа' : `${(map[it.matName]?.balQty || 0).toFixed(1)} (остаток)`;
      return `<span><b>${it.matName}</b>: ${need.toFixed(2)} (${fmtU(need * u)}) • <i>${ost}</i></span>`;
    }).join(' | ');
    box.innerHTML = `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:6px 10px;margin-top:6px;font-size:11.5px">📋 <b>Предпросмотр списания (${fmtU(tot)}):</b> ${rows}</div>`;
  };
  function renderStkSection() {
    const sec = document.getElementById('tab-stk');
    if (!sec) return;
    const e = ensureStore();
    const st = e.stkSub || 'sum';
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const bal = calcStocks();
    const models = getModelsList();

    const kFrz = document.getElementById('k-frz');
    const kFrzU = document.getElementById('k-frz-u');
    if (kFrz) kFrz.textContent = fmtR(bal.totalUsd * rate);
    if (kFrzU) kFrzU.textContent = `${fmtU(bal.totalUsd)} (Сырьё: ${fmtU(bal.rawUsd)} • НЗП: ${fmtU(bal.wipUsd)} • Товар: ${fmtU(bal.fgUsd)})`;

    const dl = `<datalist id="p4-mdl-dl">${models.map(m => `<option value="${m.name}">`).join('')}</datalist>`;
    const mOpts = models.map(m => `<option value="${m.name}">${m.name} (${fmtU(m.usd)})</option>`).join('');
    const matOpts = e.materials.map(m => `<option value="${m.name}">${m.name} (${m.unit})</option>`).join('');
    const bomOpts = ['<option value="Пошив одежды">Пошив одежды (работа)</option>'].concat(matOpts);

    const nav = [
      ['sum', '📊 Свод запасов'], ['mat', '🧵 Материалы и фурнитура'],
      ['in', '📥 Приход сырья'], ['sew', '✂️ Пошив / НЗП и Техкарты'],
      ['fg', '📦 Готовый товар и ⚠️ Брак']
    ].map(([id, lbl]) => `<button type="button" class="btn ${st === id ? 'btn-primary' : ''}" onclick="stkAction('tab','${id}')">${lbl}</button>`).join('');

    let body = '';
    if (st === 'sum') {
      body = `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-size:12px;color:#1e40af">ℹ️ <b>Свод запасов SKOS:</b> Все остатки сырья, НЗП и готового товара автоматически попадают на Сводку и в Баланс.</div>
          <button type="button" class="btn btn-success" onclick="seedAllSkosData()">📥 Загрузить стартовые данные SKOS</button>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Сырьё и фурнитура</div><div class="kpi-val">${fmtU(bal.rawUsd)}</div><div class="kpi-sub">${fmtR(bal.rawUsd * rate)}</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">В пошиве (НЗП)</div><div class="kpi-val" style="color:#d97706">${fmtU(bal.wipUsd)}</div><div class="kpi-sub">${fmtR(bal.wipUsd * rate)}</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Готовый товар</div><div class="kpi-val" style="color:#0284c7">${fmtU(bal.fgUsd)}</div><div class="kpi-sub">${fmtR(bal.fgUsd * rate)}</div></div>
          <div class="kpi-card highlight"><div style="font-size:11px;color:#1d4ed8;font-weight:700">ИТОГО ЗАМОРОЖЕНО</div><div class="kpi-val text-green">${fmtU(bal.totalUsd)}</div><div class="kpi-sub">${fmtR(bal.totalUsd * rate)}</div></div>
        </div>`;
    } else if (st === 'mat') {
      body = `
        <form onsubmit="event.preventDefault();stkAction('addMat')" class="form-grid" style="grid-template-columns:2fr 0.8fr 1.2fr 1fr 1fr auto;gap:7px;margin-bottom:10px">
          <div><label>Название ткани / фурнитуры</label><input id="p4-m-n" class="input" required placeholder="Напр: Футер 3-нитка"></div>
          <div><label>Ед.</label><input id="p4-m-u" class="input" value="м2" required></div>
          <div><label>Категория</label><select id="p4-m-c" class="select"><option>Ткань</option><option>Фурнитура</option><option>Упаковка</option></select></div>
          <div><label>Нач. остаток</label><input id="p4-m-iq" type="number" step="0.01" class="input" value="0"></div>
          <div><label>Нач. сумма ($)</label><input id="p4-m-iu" type="number" step="0.01" class="input" value="0"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Добавить</button></div>
        </form>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Материал</th><th>Категория</th><th>Ед.</th><th class="num">Нач. ост.</th><th class="num">Приход</th><th class="num">Расход</th><th class="num">Остаток</th><th class="num">Ср. цена ($)</th><th class="num">Сумма ($)</th><th>Действия</th></tr></thead>
          <tbody>${e.materials.map((m, i) => {
            const b = bal.map[m.name] || { initQty: 0, inQty: 0, outQty: 0, balQty: 0, avgUsd: 0, balUsd: 0 };
            return `<tr><td class="bold">${m.name}</td><td>${m.cat}</td><td>${m.unit}</td><td class="num">${b.initQty.toFixed(1)}</td><td class="num">${b.inQty.toFixed(1)}</td><td class="num">${b.outQty.toFixed(1)}</td><td class="num bold">${b.balQty.toFixed(1)}</td><td class="num">${fmtU(b.avgUsd)}</td><td class="num bold">${fmtU(b.balUsd)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editMat',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delMat',${i})">✕</button></td></tr>`;
          }).join('')}</tbody>
        </table></div>`;
    } else if (st === 'in') {
      body = `
        <form onsubmit="event.preventDefault();stkAction('addIn')" class="form-grid" style="grid-template-columns:1fr 2fr 1fr 1fr 1.5fr auto;gap:7px;margin-bottom:10px">
          <div><label>Дата</label><input id="p4-in-d" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Материал</label><select id="p4-in-m" class="select" required>${matOpts}</select></div>
          <div><label>Кол-во</label><input id="p4-in-q" type="number" step="0.01" class="input" required></div>
          <div><label>Цена ($)</label><input id="p4-in-p" type="number" step="0.001" class="input" required></div>
          <div><label>Поставщик</label><input id="p4-in-s" class="input" placeholder="Турция / Китай"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Приход</button></div>
        </form>
        <table><thead><tr><th>Дата</th><th>Материал</th><th class="num">Кол-во</th><th class="num">Цена ($)</th><th class="num">Итого ($)</th><th>Поставщик</th><th>Действия</th></tr></thead>
        <tbody>${e.matIn.map((r, i) => `<tr><td>${r.date}</td><td class="bold">${r.matName}</td><td class="num">${r.qty}</td><td class="num">${fmtU(r.priceUsd)}</td><td class="num bold">${fmtU(r.totalUsd)}</td><td>${r.supplier || ''}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editIn',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delIn',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:10px">Приходов пока нет</td></tr>'}</tbody></table>`;
    }
     else if (st === 'sew') {
      const boms = e.bom.map((b, bi) => {
        const u = (b.items || []).reduce((s, x) => s + (Number(x.norm) || 0) * (Number(x.priceUsd) || 0), 0);
        return `<details style="border:1px solid #cbd5e1;border-radius:7px;background:#fff;margin-bottom:6px;padding:7px 10px"><summary style="cursor:pointer;font-weight:700;font-size:12.5px;display:flex;justify-content:space-between"><span>▶ ${b.product} — <span style="color:#0369a1">${fmtU(u)} / шт.</span></span><span><button type="button" class="btn" style="padding:1px 7px;font-size:11px" onclick="event.preventDefault();document.getElementById('p4-bm-p').value='${b.product.replace(/'/g, "\\'")}'">+ Позиция</button> <button type="button" class="btn btn-danger" style="padding:1px 7px;font-size:11px" onclick="event.preventDefault();stkAction('delBom',${bi})">🗑️</button></span></summary>
        <table style="margin-top:6px;font-size:11.5px"><thead><tr><th>Материал</th><th class="num">Норма</th><th class="num">Цена ($)</th><th class="num">Сумма ($)</th><th>Действия</th></tr></thead><tbody>${(b.items || []).map((it, ii) => `<tr><td>${it.matName}</td><td class="num">${it.norm}</td><td class="num">${fmtU(it.priceUsd)}</td><td class="num bold">${fmtU(it.norm * it.priceUsd)}</td><td><button type="button" class="btn" style="padding:1px 5px" onclick="stkAction('editBomLine',${bi},${ii})">✏️</button><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="stkAction('delBomLine',${bi},${ii})">✕</button></td></tr>`).join('')}</tbody></table></details>`;
      }).join('');
      body = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="font-weight:800;font-size:12.5px;color:#92400e;margin-bottom:6px">✂️ Запуск заказа в пошив (с авто-списанием по техкарте)</div>
          <form onsubmit="event.preventDefault();stkAction('addOrd')" class="form-grid" style="grid-template-columns:1fr 2fr 1fr 2fr auto;gap:7px">
            <div><label>Дата</label><input id="p4-ord-d" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
            <div><label>Модель</label><select id="p4-ord-prod" class="select" onchange="previewSewOrder()">${mOpts}</select></div>
            <div><label>Шт.</label><input id="p4-ord-qty" type="number" class="input" oninput="previewSewOrder()" required placeholder="1000"></div>
            <div><label>Комментарий</label><input id="p4-ord-c" class="input" placeholder="Цех Туркменистан"></div>
            <div style="align-self:end"><button type="submit" class="btn btn-primary">⚙️ Запустить</button></div>
          </form>
          <div id="p4-sew-preview"></div>
        </div>
        <table style="margin-bottom:14px"><thead><tr><th>Дата</th><th>Статус</th><th>Модель</th><th class="num">Шт.</th><th class="num">Итого ($)</th><th>Комментарий</th><th>Действия</th></tr></thead>
        <tbody>${e.orders.map((o, i) => `<tr><td>${o.date}</td><td>${o.status === 'WIP' ? '<span class="badge badge-amber">⏳ НЗП</span>' : `<span class="badge badge-green">✅ ${o.doneDate}</span>`}</td><td class="bold">${o.product}</td><td class="num bold">${o.qty}</td><td class="num bold">${fmtU(o.totalUsd)}</td><td>${o.comment || ''}</td><td style="white-space:nowrap">${o.status === 'WIP' ? `<button type="button" class="btn btn-success" style="padding:2px 6px" onclick="stkAction('doneOrd',${i})">✅</button>` : ''}<button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editOrd',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delOrd',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:8px">Заказов нет</td></tr>'}</tbody></table>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;background:#f8fafc">
          <div style="font-weight:800;font-size:12.5px;margin-bottom:6px">📐 Конструктор техкарт моделей</div>
          <form onsubmit="event.preventDefault();stkAction('addBom')" class="form-grid" style="grid-template-columns:2fr 2fr 1fr 1fr auto;gap:7px;margin-bottom:8px">
            <div><label>Модель</label><input id="p4-bm-p" class="input" list="p4-mdl-dl" required placeholder="Выберите или введите..."></div>
            <div><label>Материал / Работа</label><select id="p4-bm-m" class="select">${bomOpts}</select></div>
            <div><label>Норма на 1 шт.</label><input id="p4-bm-n" type="number" step="0.0001" class="input" required></div>
            <div><label>Цена ($)</label><input id="p4-bm-pr" type="number" step="0.0001" class="input" required></div>
            <div style="align-self:end"><button type="submit" class="btn btn-primary">+ В техкарту</button></div>
          </form>${boms}
        </div>`;
    } else if (st === 'fg') {
      body = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-weight:800;font-size:13px">📦 Готовая продукция (РФ / Туркменистан / В пути)</span><button type="button" class="btn btn-amber" onclick="stkAction('lockFg')">🔒 Зафиксировать суммы месяца</button></div>
        <form onsubmit="event.preventDefault();stkAction('saveFg')" class="form-grid" style="grid-template-columns:1fr 2fr 0.9fr 0.9fr 0.9fr 1fr auto;gap:7px;margin-bottom:10px">
          <div><label>Месяц</label><input id="p4-fg-mo" type="month" class="input" value="2026-11"></div>
          <div><label>Модель</label><input id="p4-fg-p" class="input" list="p4-mdl-dl" required></div>
          <div><label>РФ</label><input id="p4-fg-ru" type="number" class="input" value="0"></div>
          <div><label>ТМ</label><input id="p4-fg-tm" type="number" class="input" value="0"></div>
          <div><label>Путь</label><input id="p4-fg-way" type="number" class="input" value="0"></div>
          <div><label>С/С ($)</label><input id="p4-fg-u" type="number" step="0.01" class="input" placeholder="Авто"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">💾</button></div>
        </form>
        <table style="margin-bottom:14px"><thead><tr><th>Месяц</th><th>Модель</th><th class="num">РФ</th><th class="num">ТМ</th><th class="num">Путь</th><th class="num">Всего</th><th class="num">Сумма ($)</th><th>Статус</th><th>Действия</th></tr></thead>
        <tbody>${e.fgStocks.map((r, i) => {
          const tot = (Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0);
          const usd = r.lockedUsd != null ? Number(r.lockedUsd) : tot * (Number(r.unitUsd) || 0);
          return `<tr><td>${r.month || '2026-11'}</td><td class="bold">${r.product}</td><td class="num">${r.ruQty}</td><td class="num">${r.tmQty}</td><td class="num">${r.wayQty}</td><td class="num bold">${tot}</td><td class="num bold">${fmtU(usd)}</td><td>${r.lockedUsd != null ? '<span class="badge badge-blue">🔒 Фикс.</span>' : 'Расчёт'}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editFg',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delFg',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:8px">Остатков нет</td></tr>'}</tbody></table>
        <div style="font-weight:800;font-size:13px;color:#b91c1c;margin-bottom:6px">⚠️ Журнал брака</div>
        <form onsubmit="event.preventDefault();stkAction('addDef')" class="form-grid" style="grid-template-columns:1fr 2fr 1fr 2fr auto;gap:7px;margin-bottom:8px">
          <div><label>Дата</label><input id="p4-df-d" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Модель</label><input id="p4-df-p" class="input" list="p4-mdl-dl" required></div>
          <div><label>Шт.</label><input id="p4-df-q" type="number" class="input" required></div>
          <div><label>Причина</label><input id="p4-df-r" class="input" placeholder="Брак ткани"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-danger">+ Брак</button></div>
        </form>
        <table><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт.</th><th class="num">Убыток ($)</th><th>Причина</th><th>Действия</th></tr></thead>
        <tbody>${e.defects.map((d, i) => `<tr><td>${d.date}</td><td class="bold">${d.product}</td><td class="num">${d.qty}</td><td class="num bold text-red">${fmtU(d.qty * d.unitUsd)}</td><td>${d.reason || ''}</td><td><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editDef',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delDef',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:8px">Брака нет</td></tr>'}</tbody></table>`;
    }
    sec.innerHTML = `${dl}<div class="card"><div class="card-header"><div class="card-title">🏭 Запасы, Пошив (НЗП), Техкарты и Брак</div><div style="display:flex;gap:5px;flex-wrap:wrap">${nav}</div></div>${body}</div>`;
  }
  // --- ЮНИТ-ЭКОНОМИКА: ФАКТ ПО ОТЧЁТАМ МП + ПЛАН-КАЛЬКУЛЯТОР ---
  window.ueAction = function (act, val, sub) {
    const e = ensureStore();
    if (act === 'view') e.ueView = val;
    if (act === 'flt') e.ueFilter[val] = sub;
    if (act === 'addPlan') {
      const model = document.getElementById('p4-ue-m').value.trim();
      const mp = document.getElementById('p4-ue-mp').value;
      const price = Number(document.getElementById('p4-ue-pr').value) || 0;
      const comm = Number(document.getElementById('p4-ue-cm').value) || 0;
      const log = Number(document.getElementById('p4-ue-lg').value) || 0;
      const bo = Number(document.getElementById('p4-ue-bo').value) || 85;
      const ads = Number(document.getElementById('p4-ue-ad').value) || 0;
      const tax = Number(document.getElementById('p4-ue-tx').value) || 8;
      if (!model || price <= 0) return;
      const ex = e.unitEcon.find(x => x.model.toLowerCase() === model.toLowerCase() && x.mp === mp);
      const row = { model, mp, price, comm, log, bo, ads, tax };
      if (ex) Object.assign(ex, row); else e.unitEcon.unshift(row);
    }
    if (act === 'editPlan') {
      const r = e.unitEcon[val]; if (!r) return;
      const pr = Number(prompt('Цена продажи (₽):', r.price)); if (!pr) return;
      const cm = Number(prompt('Комиссия МП (%):', r.comm)); if (isNaN(cm)) return;
      const lg = Number(prompt('Логистика (₽):', r.log)); if (isNaN(lg)) return;
      r.price = pr; r.comm = cm; r.log = lg;
    }
    if (act === 'delPlan' && confirm('Удалить расчёт?')) e.unitEcon.splice(val, 1);
    pSave();
    renderUeSection();
  };

  function renderUeSection() {
    let sec = document.getElementById('tab-ue');
    if (!sec) {
      const main = document.querySelector('main.content'); if (!main) return;
      sec = document.createElement('section'); sec.id = 'tab-ue'; sec.className = 'hidden';
      main.appendChild(sec);
    }
    const e = ensureStore();
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const flt = e.ueFilter;
    const models = getModelsList();
    const mOpts = models.map(m => `<option value="${m.name}">${m.name} (${fmtU(m.usd)})</option>`).join('');

    let body = '';
    if (e.ueView === 'fact') {
      const sales = Array.isArray(window.db?.itemSales) ? window.db.itemSales : [];
      const orgs = new Set(['ИП Каримов Артем', 'ИП Джуманиязова Мавлюда', 'ИП Джуманиязова Эльмира', 'ИП Триков Курбан', 'ИП Керимов Сахет', 'ООО Скос']);
      sales.forEach(s => { if (s.org) orgs.add(s.org); });

      const map = new Map();
      sales.forEach(s => {
        const mp = s.mp || 'Wildberries';
        const org = s.org || 'ИП Каримов Артем';
        const per = String(s.per || s.date || '2026-11');
        const mo = per.length >= 7 ? per.slice(5, 7) : String(s.mo || '11').padStart(2, '0');
        const model = String(s.name || s.model || s.art || 'Товар').trim();
        if (flt.mp !== 'ALL' && mp !== flt.mp) return;
        if (flt.org !== 'ALL' && org !== flt.org) return;
        if (flt.mo !== 'ALL' && mo !== flt.mo) return;
        if (flt.q && !model.toLowerCase().includes(flt.q.toLowerCase())) return;

        const k = `${org}|${mp}|${mo}|${model}`;
        if (!map.has(k)) map.set(k, { org, mp, mo, model, sQ: 0, rQ: 0, sR: 0, rR: 0, sC: 0, rC: 0, log: 0, sM: 0, rM: 0, ads: 0 });
        const g = map.get(k);
        const isRet = s.isRet || s.type === 'ret' || String(s.typ || '').toLowerCase().includes('возврат') || (Number(s.rev) || 0) < 0;
        const q = Math.abs(Number(s.qty || s.q || 1));
        const rev = Math.abs(Number(s.rev || 0));
        const cogs = Number(s.cogs) ? Math.abs(Number(s.cogs)) : (q * (Number(s.usd) || getModelUsd(model)) * rate);
        const com = Math.abs(Number(s.com || 0));
        if (isRet) { g.rQ += q; g.rR += rev; g.rC += cogs; g.rM += com; }
        else { g.sQ += q; g.sR += rev; g.sC += cogs; g.sM += com; }
        g.log += Math.abs(Number(s.log || 0));
        g.ads += Math.abs(Number(s.ads || 0));
      });

      const rows = Array.from(map.values()).sort((a, b) => (b.sR - b.rR) - (a.sR - a.rR));
      const t = rows.reduce((a, r) => { a.sQ += r.sQ; a.rQ += r.rQ; a.sR += r.sR; a.rR += r.rR; a.sC += r.sC; a.rC += r.rC; a.log += r.log; a.sM += r.sM; a.rM += r.rM; a.ads += r.ads; return a; }, { sQ: 0, rQ: 0, sR: 0, rR: 0, sC: 0, rC: 0, log: 0, sM: 0, rM: 0, ads: 0 });
      const calc = r => {
        const nQ = r.sQ - r.rQ, retP = r.sQ > 0 ? (r.rQ / r.sQ) * 100 : 0, nR = r.sR - r.rR, avg = nQ > 0 ? nR / nQ : 0;
        const nC = r.sC - r.rC, cP = nR > 0 ? (nC / nR) * 100 : 0, lP = nR > 0 ? (r.log / nR) * 100 : 0, l1 = nQ > 0 ? r.log / nQ : 0;
        const nM = r.sM - r.rM, mP = nR > 0 ? (nM / nR) * 100 : 0, prof = nR - nC - r.log - nM - r.ads, rent = nR > 0 ? (prof / nR) * 100 : 0;
        return { nQ, retP, nR, avg, nC, cP, lP, l1, nM, mP, prof, rent };
      };
      const tm = calc(t);
      body = `
        <div class="form-grid" style="grid-template-columns:1fr 1.3fr 1fr 1.5fr;gap:7px;margin-bottom:10px">
          <div><label>Площадка</label><select class="select" onchange="ueAction('flt','mp',this.value)"><option value="ALL">Все МП</option>${['Wildberries', 'Ozon', 'Яндекс Маркет'].map(m => `<option value="${m}" ${flt.mp === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div><label>Юрлицо</label><select class="select" onchange="ueAction('flt','org',this.value)"><option value="ALL">Все ИП и ООО</option>${Array.from(orgs).map(o => `<option value="${o}" ${flt.org === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
          <div><label>Месяц</label><select class="select" onchange="ueAction('flt','mo',this.value)"><option value="ALL">Все месяцы</option>${['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => `<option value="${m}" ${flt.mo === m ? 'selected' : ''}>Мес. ${Number(m)}</option>`).join('')}</select></div>
          <div><label>Модель товара</label><input class="input" value="${flt.q || ''}" oninput="ueAction('flt','q',this.value)" placeholder="Поиск модели..."></div>
        </div>
        <div style="overflow-x:auto"><table style="font-size:11.5px">
          <thead><tr><th>Юрлицо</th><th>МП</th><th>Мес</th><th>Модель</th><th class="num">Прод.</th><th class="num">Возвр.</th><th class="num">Чист.</th><th class="num">% возвр.</th><th class="num">Выручка</th><th class="num">Ср. чек</th><th class="num">Себест.</th><th class="num">С/С %</th><th class="num">Логист.</th><th class="num">Лог. 1шт</th><th class="num">Комис.</th><th class="num">Маржа (₽)</th><th class="num">Рентаб. %</th></tr>
          <tr style="background:#eff6ff;font-weight:800;color:#1e3a8a"><td colspan="4">ИТОГО (${rows.length})</td><td class="num">${t.sQ}</td><td class="num">${t.rQ}</td><td class="num">${tm.nQ}</td><td class="num">${tm.retP.toFixed(1)}%</td><td class="num">${fmtR(tm.nR)}</td><td class="num">${fmtR(tm.avg)}</td><td class="num">${fmtR(tm.nC)}</td><td class="num">${tm.cP.toFixed(1)}%</td><td class="num">${fmtR(t.log)}</td><td class="num">${fmtR(tm.l1)}</td><td class="num">${fmtR(tm.nM)}</td><td class="num ${tm.prof >= 0 ? 'text-green' : 'text-red'}">${fmtR(tm.prof)}</td><td class="num ${tm.rent >= 0 ? 'text-green' : 'text-red'}">${tm.rent.toFixed(1)}%</td></tr></thead>
          <tbody>${rows.map(r => { const m = calc(r), c = m.prof >= 0 ? 'text-green' : 'text-red'; return `<tr><td>${r.org}</td><td>${r.mp}</td><td>${Number(r.mo)}</td><td class="bold">${r.model}</td><td class="num">${r.sQ}</td><td class="num">${r.rQ}</td><td class="num bold">${m.nQ}</td><td class="num">${m.retP.toFixed(1)}%</td><td class="num bold">${fmtR(m.nR)}</td><td class="num">${fmtR(m.avg)}</td><td class="num">${fmtR(m.nC)}</td><td class="num">${m.cP.toFixed(1)}%</td><td class="num">${fmtR(r.log)}</td><td class="num">${fmtR(m.l1)}</td><td class="num">${fmtR(m.nM)}</td><td class="num bold ${c}">${fmtR(m.prof)}</td><td class="num bold ${c}">${m.rent.toFixed(1)}%</td></tr>`; }).join('') || '<tr><td colspan="17" style="text-align:center;color:#64748b;padding:12px">Загрузите отчёты WB / Ozon / ЯМ — таблица заполнится сама</td></tr>'}</tbody>
        </table></div>`;
    }
     else {
      body = `
        <form onsubmit="event.preventDefault();ueAction('addPlan')" class="form-grid" style="grid-template-columns:2fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.8fr 0.8fr auto;gap:6px;margin-bottom:10px">
          <div><label>Модель</label><select id="p4-ue-m" class="select">${mOpts}</select></div>
          <div><label>МП</label><select id="p4-ue-mp" class="select"><option>Wildberries</option><option>Ozon</option><option>Яндекс Маркет</option></select></div>
          <div><label>Цена (₽)</label><input id="p4-ue-pr" type="number" class="input" required placeholder="2490"></div>
          <div><label>Ком. %</label><input id="p4-ue-cm" type="number" step="0.1" class="input" value="22"></div>
          <div><label>Лог. ₽</label><input id="p4-ue-lg" type="number" class="input" value="110"></div>
          <div><label>Выкуп %</label><input id="p4-ue-bo" type="number" class="input" value="85"></div>
          <div><label>Рекл. %</label><input id="p4-ue-ad" type="number" step="0.1" class="input" value="8"></div>
          <div><label>Налог %</label><input id="p4-ue-tx" type="number" step="0.1" class="input" value="8"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+</button></div>
        </form>
        <table><thead><tr><th>Модель</th><th>МП</th><th class="num">Цена</th><th class="num">Себест. ($ / ₽)</th><th class="num">Комиссия</th><th class="num">Логист. (с вык.)</th><th class="num">Рекл.+Налог</th><th class="num">Прибыль / шт.</th><th class="num">Маржа %</th><th>Действия</th></tr></thead>
        <tbody>${e.unitEcon.map((r, i) => {
          const uUsd = getModelUsd(r.model), uRub = uUsd * rate, effL = r.log / (Math.max(10, r.bo) / 100);
          const cmR = r.price * (r.comm / 100), adTx = r.price * ((r.ads + r.tax) / 100), prof = r.price - uRub - cmR - effL - adTx, mg = r.price > 0 ? (prof / r.price) * 100 : 0;
          return `<tr><td class="bold">${r.model}</td><td>${r.mp}</td><td class="num bold">${fmtR(r.price)}</td><td class="num">${fmtU(uUsd)} / <b>${fmtR(uRub)}</b></td><td class="num">${fmtR(cmR)}</td><td class="num">${fmtR(effL)}</td><td class="num">${fmtR(adTx)}</td><td class="num bold ${prof >= 0 ? 'text-green' : 'text-red'}">${fmtR(prof)}</td><td class="num bold">${mg.toFixed(1)}%</td><td><button type="button" class="btn" style="padding:2px 6px" onclick="ueAction('editPlan',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="ueAction('delPlan',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="10" style="text-align:center;color:#64748b;padding:10px">Добавьте расчёт модели выше</td></tr>'}</tbody></table>`;
    }
    sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📈 Юнит-экономика (Факт по отчётам МП + План-калькулятор)</div><div style="display:flex;gap:6px"><button type="button" class="btn ${e.ueView === 'fact' ? 'btn-primary' : ''}" onclick="ueAction('view','fact')">📊 Факт по отчётам МП</button><button type="button" class="btn ${e.ueView === 'plan' ? 'btn-primary' : ''}" onclick="ueAction('view','plan')">🧮 План-калькулятор</button></div></div>${body}</div>`;
  }
  // --- ЗАРПЛАТНАЯ ВЕДОМОСТЬ (ЗПВ): ШТАТ RUB/USD, НАЧИСЛЕНИЯ, ВЫПЛАТЫ, СВЕРКА ДОЛГА ---
  window.zpvAction = function (act, idx) {
    const e = ensureStore();
    if (act === 'addStaff') {
      const name = document.getElementById('p4-st-n').value.trim();
      const role = document.getElementById('p4-st-r').value.trim();
      const art = document.getElementById('p4-st-a').value;
      const cur = document.getElementById('p4-st-c').value;
      const initDebt = Number(document.getElementById('p4-st-d').value) || 0;
      if (!name) return;
      e.staffList.push({ name, role, art, status: 'Работает', cur, initDebt });
    }
    if (act === 'editStaff') {
      const s = e.staffList[idx]; if (!s) return;
      const st = prompt('Статус (Работает / Уволен):', s.status); if (st) s.status = st.trim();
      const d = Number(prompt(`Долг на 1 января (${s.cur}):`, s.initDebt)); if (!isNaN(d)) s.initDebt = d;
    }
    if (act === 'delStaff' && confirm('Удалить сотрудника?')) e.staffList.splice(idx, 1);
    if (act === 'addOp') {
      const date = document.getElementById('p4-zp-d').value;
      const emp = document.getElementById('p4-zp-e').value;
      const kind = document.getElementById('p4-zp-k').value;
      const amt = Number(document.getElementById('p4-zp-a').value) || 0;
      const st = e.staffList.find(x => x.name === emp);
      if (!emp || amt <= 0) return;
      e.payrollOps.unshift({ date, emp, kind, amt, cur: st ? st.cur : 'RUB', art: st ? st.art : 'ФОТ склад' });
    }
    if (act === 'delOp' && confirm('Удалить запись ЗПВ?')) e.payrollOps.splice(idx, 1);
    pSave();
    enhanceExpSection();
  };

  function buildZpvHtml() {
    const e = ensureStore();
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const empOpts = e.staffList.map(s => `<option value="${s.name}">${s.name} (${s.art}, ${s.cur})</option>`).join('');

    const summary = e.staffList.map((s, i) => {
      const acc = e.payrollOps.filter(o => o.emp === s.name && (o.kind === 'Оклад' || o.kind === 'Премия')).reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const pen = e.payrollOps.filter(o => o.emp === s.name && o.kind === 'Штраф / Удержание').reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const pay = e.payrollOps.filter(o => o.emp === s.name && (o.kind === 'Выплата ЗП' || o.kind === 'Выплата аванса')).reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const bal = (Number(s.initDebt) || 0) + acc - pen - pay;
      const fmtVal = v => s.cur === 'USD' ? fmtU(v) : fmtR(v);
      return `<tr><td class="bold">${s.name}</td><td>${s.role || ''}</td><td>${s.art}</td><td><span class="badge ${s.status === 'Работает' ? 'badge-green' : 'badge-amber'}">${s.status}</span></td><td class="num">${fmtVal(s.initDebt)}</td><td class="num">${fmtVal(acc - pen)}</td><td class="num">${fmtVal(pay)}</td><td class="num bold ${bal > 0 ? 'text-red' : 'text-green'}">${fmtVal(bal)}</td><td><button type="button" class="btn" style="padding:1px 5px" onclick="zpvAction('editStaff',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="zpvAction('delStaff',${i})">✕</button></td></tr>`;
    }).join('');

    const totRubDebt = e.staffList.reduce((sum, s) => {
      const acc = e.payrollOps.filter(o => o.emp === s.name && (o.kind === 'Оклад' || o.kind === 'Премия')).reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const pen = e.payrollOps.filter(o => o.emp === s.name && o.kind === 'Штраф / Удержание').reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const pay = e.payrollOps.filter(o => o.emp === s.name && (o.kind === 'Выплата ЗП' || o.kind === 'Выплата аванса')).reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const bal = (Number(s.initDebt) || 0) + acc - pen - pay;
      return sum + (s.cur === 'USD' ? bal * rate : bal);
    }, 0);

    return `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header"><div class="card-title">👷 Зарплатная ведомость SKOS (Штат RUB/USD, Начисления для ОПиУ и Сверка долгов)</div><span class="badge badge-amber">Общий долг по ЗП: ${fmtR(totRubDebt)}</span></div>
        <form onsubmit="event.preventDefault();zpvAction('addStaff')" class="form-grid" style="grid-template-columns:1.5fr 1.2fr 1.3fr 0.8fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Сотрудник</label><input id="p4-st-n" class="input" required placeholder="ФИО"></div>
          <div><label>Должность</label><input id="p4-st-r" class="input" placeholder="Упаковщик / Менеджер"></div>
          <div><label>Статья ОПиУ</label><select id="p4-st-a" class="select"><option>ФОТ склад</option><option>ФОТ менеджеры</option><option>ФОТ офис</option><option>ФОТ собственик</option></select></div>
          <div><label>Валюта</label><select id="p4-st-c" class="select"><option>RUB</option><option>USD</option></select></div>
          <div><label>Долг на 1 янв.</label><input id="p4-st-d" type="number" class="input" value="0"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Сотрудник</button></div>
        </form>
        <div style="overflow-x:auto;margin-bottom:12px"><table><thead><tr><th>Сотрудник</th><th>Должность</th><th>Статья ОПиУ</th><th>Статус</th><th class="num">Долг на нач.</th><th class="num">Начислено</th><th class="num">Выплачено</th><th class="num">Остаток долга</th><th>Действия</th></tr></thead><tbody>${summary || '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:8px">Нажмите «📥 Загрузить стартовые данные SKOS» в Запасах или добавьте сотрудника выше</td></tr>'}</tbody></table></div>
        <form onsubmit="event.preventDefault();zpvAction('addOp')" class="form-grid" style="grid-template-columns:1fr 1.5fr 1.3fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Дата</label><input id="p4-zp-d" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Сотрудник</label><select id="p4-zp-e" class="select">${empOpts}</select></div>
          <div><label>Вид операции</label><select id="p4-zp-k" class="select"><option>Оклад</option><option>Премия</option><option>Штраф / Удержание</option><option>Выплата ЗП</option><option>Выплата аванса</option></select></div>
          <div><label>Сумма</label><input id="p4-zp-a" type="number" step="0.01" class="input" required></div>
          <div style="align-self:end"><button type="submit" class="btn btn-success">+ Провести</button></div>
        </form>
        <table><thead><tr><th>Дата</th><th>Сотрудник</th><th>Статья</th><th>Операция</th><th class="num">Сумма</th><th>Действия</th></tr></thead>
        <tbody>${e.payrollOps.slice(0, 25).map((o, i) => `<tr><td>${o.date}</td><td class="bold">${o.emp}</td><td>${o.art}</td><td>${o.kind}</td><td class="num bold">${o.cur === 'USD' ? fmtU(o.amt) : fmtR(o.amt)}</td><td><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="zpvAction('delOp',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:6px">Операций ЗПВ пока нет</td></tr>'}</tbody></table>
      </div>`;
  }
  // --- УЧЁТ ОС И КОНТРАГЕНТОВ (RUB / USD) ---
  window.supOsAction = function (act, idx) {
    const e = ensureStore();
    if (act === 'addOs') {
      const name = document.getElementById('p4-os-n').value.trim();
      const qty = Number(document.getElementById('p4-os-q').value) || 1;
      const price = Number(document.getElementById('p4-os-p').value) || 0;
      const months = Number(document.getElementById('p4-os-m').value) || 60;
      const resp = document.getElementById('p4-os-r').value.trim() || 'Мердан';
      const room = document.getElementById('p4-os-l').value;
      if (!name || price <= 0) return;
      e.osList.unshift({ name, qty, price, startDate: '01.01.2026', months, passed: 0, resp, room });
    }
    if (act === 'editOs') {
      const o = e.osList[idx]; if (!o) return;
      const q = Number(prompt('Кол-во:', o.qty)); if (q > 0) o.qty = q;
      const p = Number(prompt('Цена ед. (₽):', o.price)); if (p > 0) o.price = p;
      const ps = Number(prompt('Прошло месяцев амортизации:', o.passed || 0)); if (!isNaN(ps) && ps >= 0) o.passed = ps;
    }
    if (act === 'delOs' && confirm('Удалить ОС?')) e.osList.splice(idx, 1);

    if (act === 'addCtr') {
      const name = document.getElementById('p4-ct-n').value.trim();
      const art = document.getElementById('p4-ct-a').value.trim();
      const cur = document.getElementById('p4-ct-c').value;
      const initDebt = Number(document.getElementById('p4-ct-d').value) || 0;
      if (!name) return;
      e.contractors.push({ name, art, status: 'Работаем', cur, initDebt });
    }
    if (act === 'editCtr') {
      const c = e.contractors[idx]; if (!c) return;
      const d = Number(prompt(`Начальный долг (${c.cur}, "-" переплата / "+" наш долг):`, c.initDebt));
      if (!isNaN(d)) c.initDebt = d;
    }
    if (act === 'delCtr' && confirm('Удалить контрагента?')) e.contractors.splice(idx, 1);

    if (act === 'addCtrOp') {
      const date = document.getElementById('p4-co-d').value;
      const ctr = document.getElementById('p4-co-c').value;
      const kind = document.getElementById('p4-co-k').value;
      const amt = Number(document.getElementById('p4-co-a').value) || 0;
      const f = e.contractors.find(x => x.name === ctr);
      if (!ctr || amt <= 0) return;
      e.contractorOps.unshift({ date, ctr, kind, amt, cur: f ? f.cur : 'RUB', art: f ? f.art : '' });
    }
    if (act === 'delCtrOp' && confirm('Удалить операцию?')) e.contractorOps.splice(idx, 1);

    pSave();
    enhanceSupSection();
  };

  function enhanceSupSection() {
    const sec = document.getElementById('tab-sup');
    if (!sec) return;
    let box = document.getElementById('p4-sup-os-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-sup-os-box'; sec.insertBefore(box, sec.firstChild); }
    const e = ensureStore();
    const rate = typeof getRate === 'function' ? getRate() : 96.5;

    const totAmort = e.osList.reduce((s, o) => s + ((Number(o.qty) || 1) * (Number(o.price) || 0)) / (Number(o.months) || 60), 0);
    const totRemOs = e.osList.reduce((s, o) => {
      const full = (Number(o.qty) || 1) * (Number(o.price) || 0);
      const am = full / (Number(o.months) || 60);
      return s + Math.max(0, full - am * (Number(o.passed) || 0));
    }, 0);

    const ctrOpts = e.contractors.map(c => `<option value="${c.name}">${c.name} (${c.art}, ${c.cur})</option>`).join('');

    box.innerHTML = `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header"><div class="card-title">🏢 Контрагенты SKOS (Аренда, 1С, ФТС, Бухгалтерия — RUB/USD)</div><button type="button" class="btn btn-success" onclick="seedAllSkosData()">📥 Загрузить базу SKOS</button></div>
        <form onsubmit="event.preventDefault();supOsAction('addCtr')" class="form-grid" style="grid-template-columns:1.6fr 1.5fr 0.7fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Контрагент</label><input id="p4-ct-n" class="input" required placeholder="Название контрагента"></div>
          <div><label>Статья ОПиУ</label><input id="p4-ct-a" class="input" placeholder="Аренда склада / ПО"></div>
          <div><label>Валюта</label><select id="p4-ct-c" class="select"><option>RUB</option><option>USD</option></select></div>
          <div><label>Долг нач. (-/+)</label><input id="p4-ct-d" type="number" class="input" value="0"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Контрагент</button></div>
        </form>
        <div style="overflow-x:auto;margin-bottom:10px"><table><thead><tr><th>Контрагент</th><th>Статья ОПиУ</th><th>Валюта</th><th class="num">Долг нач.</th><th class="num">Начислено</th><th class="num">Оплачено</th><th class="num">Сальдо</th><th>Действия</th></tr></thead>
        <tbody>${e.contractors.map((c, i) => {
          const acc = e.contractorOps.filter(x => x.ctr === c.name && x.kind === 'Начисление (Акт)').reduce((a, b) => a + b.amt, 0);
          const pay = e.contractorOps.filter(x => x.ctr === c.name && x.kind === 'Оплата').reduce((a, b) => a + b.amt, 0);
          const bal = (Number(c.initDebt) || 0) + acc - pay;
          const fv = v => c.cur === 'USD' ? fmtU(v) : fmtR(v);
          return `<tr><td class="bold">${c.name}</td><td>${c.art}</td><td>${c.cur}</td><td class="num">${fv(c.initDebt)}</td><td class="num">${fv(acc)}</td><td class="num">${fv(pay)}</td><td class="num bold ${bal > 0 ? 'text-red' : 'text-green'}">${fv(bal)}</td><td><button type="button" class="btn" style="padding:1px 5px" onclick="supOsAction('editCtr',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="supOsAction('delCtr',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:8px">Нажмите «📥 Загрузить базу SKOS» сверху</td></tr>'}</tbody></table></div>
        <form onsubmit="event.preventDefault();supOsAction('addCtrOp')" class="form-grid" style="grid-template-columns:1fr 1.6fr 1.2fr 1fr auto;gap:6px">
          <div><label>Дата</label><input id="p4-co-d" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Контрагент</label><select id="p4-co-c" class="select">${ctrOpts}</select></div>
          <div><label>Операция</label><select id="p4-co-k" class="select"><option>Начисление (Акт)</option><option>Оплата</option></select></div>
          <div><label>Сумма</label><input id="p4-co-a" type="number" step="0.01" class="input" required></div>
          <div style="align-self:end"><button type="submit" class="btn btn-success">+ Провести</button></div>
        </form>
      </div>
      <div class="card" style="margin-bottom:12px">
        <div class="card-header"><div class="card-title">🖥️ Основные средства (ОС) и Амортизация</div><div><span class="badge badge-amber">Амортизация: ${fmtR(totAmort)}/мес.</span> <span class="badge badge-blue">Остаточная ст-ть: ${fmtR(totRemOs)}</span></div></div>
        <form onsubmit="event.preventDefault();supOsAction('addOs')" class="form-grid" style="grid-template-columns:1.5fr 0.6fr 1fr 0.7fr 1fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Наименование ОС</label><input id="p4-os-n" class="input" required placeholder="Ноутбук / Стеллажи"></div>
          <div><label>Кол-во</label><input id="p4-os-q" type="number" class="input" value="1"></div>
          <div><label>Цена ед. (₽)</label><input id="p4-os-p" type="number" class="input" required></div>
          <div><label>Срок мес.</label><input id="p4-os-m" type="number" class="input" value="60"></div>
          <div><label>Ответств.</label><input id="p4-os-r" class="input" value="Мердан"></div>
          <div><label>Локация</label><select id="p4-os-l" class="select"><option>Россия</option><option>Туркменистан</option></select></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ ОС</button></div>
        </form>
        <div style="overflow-x:auto"><table><thead><tr><th>Наименование</th><th class="num">Кол-во</th><th class="num">Ст-ть (₽)</th><th class="num">Аморт./мес.</th><th class="num">Остат. ст-ть</th><th>Ответств.</th><th>Локация</th><th>Действия</th></tr></thead>
        <tbody>${e.osList.map((o, i) => {
          const full = (Number(o.qty) || 1) * (Number(o.price) || 0);
          const am = full / (Number(o.months) || 60);
          const rem = Math.max(0, full - am * (Number(o.passed) || 0));
          return `<tr><td class="bold">${o.name}</td><td class="num">${o.qty}</td><td class="num">${fmtR(full)}</td><td class="num">${fmtR(am)}</td><td class="num bold">${fmtR(rem)}</td><td>${o.resp || ''}</td><td>${o.room || ''}</td><td><button type="button" class="btn" style="padding:1px 5px" onclick="supOsAction('editOs',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="supOsAction('delOs',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:8px">Нажмите «📥 Загрузить базу SKOS» сверху</td></tr>'}</tbody></table></div>
      </div>`;
  }
  // --- УМНЫЙ ИМПОРТ ДДС + РЕДАКТИРУЕМЫЙ СПРАВОЧНИК СТАТЕЙ ДДС ---
  window.ddsArtAction = function (act, idx) {
    const e = ensureStore();
    if (act === 'add') {
      const name = document.getElementById('p4-da-n').value.trim();
      const dir = document.getElementById('p4-da-d').value;
      const opiu = document.getElementById('p4-da-o').value;
      if (!name) return;
      e.ddsArticles.unshift({ name, dir, opiu });
    }
    if (act === 'del' && confirm('Удалить статью ДДС?')) e.ddsArticles.splice(idx, 1);
    pSave();
    enhanceDdsSection();
  };

   window.importDdsCsvP4 = function (ev) {
    const f = ev.target.files && ev.target.files.item(0);
    if (!f) return;
    const sec = document.getElementById('tab-dds');
    const wSel = sec ? sec.querySelector('select') : null;
    const wallet = wSel ? wSel.value : 'Банк / Касса';
    const reader = new FileReader();
    reader.onload = function (e) {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return alert('Файл пустой.');
      const firstLine = lines.at(0) || '';
      const sep = firstLine.includes(';') ? ';' : ',';
      const hdr = firstLine.split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
      const iD = hdr.findIndex(h => /дата|date/.test(h)), iIn = hdr.findIndex(h => /приход|поступ|кредит/.test(h));
      const iOut = hdr.findIndex(h => /расход|списан|дебет/.test(h)), iS = hdr.findIndex(h => /сумма|amount/.test(h));
      const iDesc = hdr.findIndex(h => /назначен|коммент|описан|контрагент/.test(h)), iDoc = hdr.findIndex(h => /номер|док/.test(h));
      if (!Array.isArray(window.db.dds)) window.db.dds = [];
      const seen = new Set(window.db.dds.map(r => `${r.date}|${r.wallet || r.acc || ''}|${Number(r.amount || r.sum || 0)}|${String(r.desc || '').trim()}|${r.docNum || ''}`));
      let add = 0, skp = 0;
      lines.slice(1).forEach(line => {
        const c = line.split(sep).map(x => x.replace(/^"|"$/g, '').trim());
        const dt = iD >= 0 ? (c.at(iD) || '') : '';
        if (!dt) return;
        const num = v => parseFloat(String(v || '0').replace(/\s+/g, '').replace(',', '.')) || 0;
        let amt = 0, dir = 'out';
        if (iIn >= 0 && num(c.at(iIn)) > 0) { amt = num(c.at(iIn)); dir = 'in'; }
        else if (iOut >= 0 && num(c.at(iOut)) > 0) { amt = num(c.at(iOut)); dir = 'out'; }
        else if (iS >= 0 && num(c.at(iS)) !== 0) { const r = num(c.at(iS)); dir = r > 0 ? 'in' : 'out'; amt = Math.abs(r); }
        if (!amt) return;
        const desc = iDesc >= 0 ? (c.at(iDesc) || '') : '';
        const docNum = iDoc >= 0 ? (c.at(iDoc) || '') : '';
        const key = `${dt}|${wallet}|${amt}|${desc}|${docNum}`;
        if (seen.has(key)) { skp++; return; }
        seen.add(key);
        let iso = dt;
        const m = dt.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (m) iso = `${m.at(3)}-${m.at(2)}-${m.at(1)}`;
        window.db.dds.unshift({ id: 'dds_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), date: iso, wallet, acc: wallet, type: dir, dir, cat: dir === 'in' ? 'Поступление' : 'Расход', amount: amt, sum: amt, desc, comment: desc, docNum });
        add++;
      });
      pSave();
      if (typeof render === 'function') render();
      alert(`✅ Импорт ДДС: добавлено ${add} операций (включая разные суммы/назначения в 1 день), пропущено дублей: ${skp}.`);
    };
    reader.readAsText(f, 'UTF-8');
  };

  function enhanceDdsSection() {
    const sec = document.getElementById('tab-dds'); if (!sec) return;
    let box = document.getElementById('p4-dds-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-dds-box'; sec.insertBefore(box, sec.firstChild); }
    const e = ensureStore();
    box.innerHTML = `
      <div class="card" style="margin-bottom:10px;background:#f8fafc">
        <div class="card-header">
          <div class="card-title">💳 Умный импорт ДДС и Справочник статей (редактируемый)</div>
          <label class="btn btn-success" style="cursor:pointer;margin:0">📥 Загрузить CSV (без потери разных сумм за 1 день)<input type="file" accept=".csv" style="display:none" onchange="importDdsCsvP4(event)"></label>
        </div>
        <details>
          <summary style="cursor:pointer;font-size:12px;font-weight:700;color:#0369a1">📂 Открыть справочник статей ДДС (${e.ddsArticles.length} шт.) — можно добавлять и удалять</summary>
          <form onsubmit="event.preventDefault();ddsArtAction('add')" class="form-grid" style="grid-template-columns:2fr 1fr 1.5fr auto;gap:6px;margin:8px 0">
            <div><input id="p4-da-n" class="input" required placeholder="Новая статья ДДС..."></div>
            <div><select id="p4-da-d" class="select"><option value="out">Выбытие (-)</option><option value="in">Поступление (+)</option><option value="move">Перевод / Конвертация</option></select></div>
            <div><select id="p4-da-o" class="select"><option>Общепроизводственные</option><option>Административные</option><option>Коммерческие</option><option>Нет в ОПиУ</option><option>Учёт сделок (не дубл.)</option><option>Учёт налогов (не дубл.)</option><option>ЗПВ (не дубл.)</option></select></div>
            <div><button type="submit" class="btn btn-primary">+ Статья</button></div>
          </form>
          <div style="max-height:180px;overflow-y:auto"><table><thead><tr><th>Статья ДДС</th><th>Тип</th><th>Правило для ОПиУ</th><th></th></tr></thead>
          <tbody>${e.ddsArticles.map((a, i) => `<tr><td class="bold">${a.name}</td><td>${a.dir}</td><td>${a.opiu}</td><td><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="ddsArtAction('del',${i})">✕</button></td></tr>`).join('')}</tbody></table></div>
        </details>
      </div>`;
  }
    // --- РАСХОДЫ, НАЛОГИ (ДОЛГИ НА 1 ЯНВАРЯ + КВ/3 + ЦЕЛИКОМ) И ЗПВ ---
  window.addCustomTaxTypeP4 = function () {
    const inp = document.getElementById('p4-new-tax-type');
    const name = (inp?.value || '').trim();
    if (!name) return;
    const sec = document.getElementById('tab-exp');
    const taxSel = sec ? sec.querySelectorAll('select').item(1) : null;
    if (taxSel && !Array.from(taxSel.options).some(o => o.value === name)) {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      taxSel.appendChild(opt);
      taxSel.value = name;
    }
    if (inp) inp.value = '';
    alert(`✅ Новый вид налога «${name}» добавлен в список!`);
  };

  window.addTaxDebtRowP4 = function () {
    const e = ensureStore();
    const org = document.getElementById('p4-td-org')?.value.trim();
    const tax = document.getElementById('p4-td-tax')?.value.trim();
    const debt = Number(document.getElementById('p4-td-val')?.value) || 0;
    if (!org || !tax) return;
    e.taxDebts.push({ org, tax, debt });
    pSave(); enhanceExpSection();
  };

  window.editTaxDebtRowP4 = function (i) {
    const d = ensureStore().taxDebts.at(i); if (!d) return;
    const nTax = prompt('Вид налога:', d.tax); if (nTax) d.tax = nTax.trim();
    const nVal = Number(prompt('Сумма долга на 1 января (₽):', d.debt)); if (!isNaN(nVal)) d.debt = nVal;
    pSave(); enhanceExpSection();
  };

  window.addTaxWholeP4 = function () {
    const sec = document.getElementById('tab-exp'); if (!sec) return;
    const sels = sec.querySelectorAll('select');
    const org = sels.item(0)?.value || 'ИП Каримов Артем';
    const type = sels.item(1)?.value || 'АУСН';
    const yr = sels.item(2)?.value || '2026';
    const inp = sec.querySelector('input[type="number"]');
    const amt = Number(inp?.value || 0);
    if (amt <= 0) return alert('Введите сумму налога.');
    const mo = prompt(`За какой месяц ${yr} провести «${type}» (${fmtR(amt)}) ЦЕЛИКОМ? (1–12):`, '11');
    const mNum = Number(mo); if (!mNum || mNum < 1 || mNum > 12) return;
    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    window.db.taxes.unshift({ id: 'tx_' + Date.now(), yr, mo: String(mNum).padStart(2, '0'), q: Math.ceil(mNum / 3), org, type, name: type, amount: amt, monthAmount: amt, comment: `Целиком за ${mNum}.${yr}` });
    if (inp) inp.value = ''; pSave(); if (typeof render === 'function') render();
  };

  function enhanceExpSection() {
    const sec = document.getElementById('tab-exp'); if (!sec) return;
    const qBtn = Array.from(sec.querySelectorAll('button')).find(b => (b.textContent || '').includes('1/3'));
    if (qBtn && !document.getElementById('p4-tx-whole')) {
      const b = document.createElement('button'); b.id = 'p4-tx-whole'; b.type = 'button'; b.className = 'btn btn-success'; b.style.marginLeft = '6px';
      b.textContent = '✅ Целиком за месяц'; b.onclick = window.addTaxWholeP4;
      qBtn.parentNode.insertBefore(b, qBtn.nextSibling);
    }
    let extra = document.getElementById('p4-exp-extra');
    if (!extra) { extra = document.createElement('div'); extra.id = 'p4-exp-extra'; sec.appendChild(extra); }
    const e = ensureStore();
    const orgOpts = getLiveOrgsList().map(o => `<option value="${o}">`).join('');
    const debtRows = e.taxDebts.map((d, i) => `<tr><td class="bold">${d.org}</td><td>${d.tax}</td><td class="num bold ${d.debt > 0 ? 'text-red' : 'text-green'}">${fmtR(d.debt)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:1px 5px" onclick="editTaxDebtRowP4(${i})">✏️</button> <button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="ensureStore().taxDebts.splice(${i},1);pSave();enhanceExpSection()">✕</button></td></tr>`).join('');
    extra.innerHTML = `
      <datalist id="p4-orgs-dl">${orgOpts}</datalist>
      <div class="card" style="margin-top:12px">
        <div class="card-header"><div class="card-title">🧾 Виды налогов и Входящие долги / переплаты на 1 января</div><button type="button" class="btn btn-success" onclick="seedAllSkosData()">📥 Загрузить базу SKOS</button></div>
        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
          <input id="p4-new-tax-type" class="input" style="max-width:260px" placeholder="Новый вид налога (напр. Патент)...">
          <button type="button" class="btn btn-primary" onclick="addCustomTaxTypeP4()">+ Добавить вид налога</button>
        </div>
        <form onsubmit="event.preventDefault();addTaxDebtRowP4()" class="form-grid" style="grid-template-columns:1.5fr 1.5fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><input id="p4-td-org" class="input" list="p4-orgs-dl" required placeholder="Юрлицо (выберите или введите)"></div>
          <div><input id="p4-td-tax" class="input" required placeholder="Налог (УСН / НДС / АУСН)"></div>
          <div><input id="p4-td-val" type="number" class="input" required placeholder="Долг на 1 янв. (₽)"></div>
          <div><button type="submit" class="btn btn-primary">+ Долг</button></div>
        </form>
        <table><thead><tr><th>Юридическое лицо</th><th>Налог</th><th class="num">Долг на 1 января (₽)</th><th>Действия</th></tr></thead><tbody>${debtRows || '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:8px">Добавьте строку выше или нажмите «📥 Загрузить базу SKOS»</td></tr>'}</tbody></table>
      </div>
      ${buildZpvHtml()}`;
  }
  // --- УПРАВЛЕНЧЕСКИЙ БАЛАНС НА ГЛАВНОЙ СВОДКЕ ---
  function enhanceDashBalance() {
    const dash = document.getElementById('tab-dash'); if (!dash) return;
    let box = document.getElementById('p4-dash-bal');
    if (!box) { box = document.createElement('div'); box.id = 'p4-dash-bal'; dash.appendChild(box); }
    const e = ensureStore();
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const st = calcStocks();
    const stocksRub = st.totalUsd * rate;
    const osRub = e.osList.reduce((s, o) => {
      const full = (Number(o.qty) || 1) * (Number(o.price) || 0);
      return s + Math.max(0, full - (full / (Number(o.months) || 60)) * (Number(o.passed) || 0));
    }, 0);
    const ddsRub = (window.db?.dds || []).reduce((s, r) => s + ((r.type === 'in' || r.dir === 'in') ? 1 : -1) * Math.abs(Number(r.amount || r.sum || 0)), 0);
    const taxDebt = e.taxDebts.reduce((s, d) => s + (Number(d.debt) || 0), 0);
    const assets = Math.max(0, ddsRub) + stocksRub + osRub;
    const cap = assets - taxDebt;

    box.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="card-header"><div class="card-title">⚖️ Управленческий БАЛАНС SKOS (Активы и Пассивы)</div><span class="badge badge-blue">Курс: ${rate} ₽/$</span></div>
        <div class="kpi-grid">
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Деньги (Счета и кассы)</div><div class="kpi-val">${fmtR(Math.max(0, ddsRub))}</div><div class="kpi-sub">По данным ДДС</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Запасы (Сырьё + НЗП + Товар)</div><div class="kpi-val text-green">${fmtR(stocksRub)}</div><div class="kpi-sub">${fmtU(st.totalUsd)}</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Основные средства (ОС)</div><div class="kpi-val">${fmtR(osRub)}</div><div class="kpi-sub">Остаточная стоимость</div></div>
          <div class="kpi-card highlight"><div style="font-size:11px;color:#1d4ed8;font-weight:700">СОБСТВЕННЫЙ КАПИТАЛ</div><div class="kpi-val">${fmtR(cap)}</div><div class="kpi-sub">Активы ${fmtR(assets)} − Налоги ${fmtR(taxDebt)}</div></div>
        </div>
      </div>`;
  }

  // --- ПОДКЛЮЧЕНИЕ К МЕНЮ, СБРОС БЕЛОГО ЭКРАНА И ОБНОВЛЕНИЕ ЗАГОЛОВКОВ ---
  function injectUeButton() {
    if (document.getElementById('nav-ue')) return;
    const sku = document.getElementById('nav-sku');
    if (!sku || !sku.parentNode) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn'; btn.id = 'nav-ue'; btn.textContent = '📈 Юнит-экономика';
    btn.onclick = function () { window.tab('ue'); };
    sku.parentNode.insertBefore(btn, sku.nextSibling);
  }

  const crumbNames = {
    dash: 'SKOS / Сводка и 5 ИП + 1 ООО',
    abc: 'SKOS / Двойной ABC-анализ',
    rep: 'SKOS / Отчёты WB / Ozon / ЯМ',
    sku: 'SKOS / Товары, ШК и Себест.',
    ue: 'SKOS / Юнит-экономика (Факт МП + План)',
    stk: 'SKOS / Запасы, Пошив (НЗП), Техкарты и Брак',
    dds: 'SKOS / ДДС, Выписки и Кассы',
    exp: 'SKOS / Расходы, Налоги и Зарплатная ведомость',
    sup: 'SKOS / Контрагенты и Основные средства',
    set: 'SKOS / Юрлица, Банки и Облако'
  };

  function syncActiveTabUi() {
    injectUeButton();
    const cur = window.db?.tab || 'dash';
    document.querySelectorAll('main.content > section').forEach(s => {
      const isAct = s.id === 'tab-' + cur;
      s.classList.toggle('hidden', !isAct);
      s.style.display = isAct ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.id === 'nav-' + cur));
    const cr = document.getElementById('crumb');
    if (cr && crumbNames[cur] && cr.textContent !== crumbNames[cur]) cr.textContent = crumbNames[cur];

    if (cur === 'dash' && !document.getElementById('p4-dash-bal')) enhanceDashBalance();
    if (cur === 'ue') {
      const ue = document.getElementById('tab-ue');
      if (!ue || !ue.innerHTML.trim()) renderUeSection();
    }
    if (cur === 'stk') {
      const stk = document.getElementById('tab-stk');
      if (stk && !stk.querySelector('.card-header')) renderStkSection();
    }
    if (cur === 'dds' && !document.getElementById('p4-dds-box')) enhanceDdsSection();
    if (cur === 'exp' && !document.getElementById('p4-exp-extra')) enhanceExpSection();
    if (cur === 'sup' && !document.getElementById('p4-sup-os-box')) enhanceSupSection();
  }

  const origTab = window.tab;
  window.tab = function (id) {
    if (window.db) window.db.tab = id;
    if (id !== 'ue' && typeof origTab === 'function') origTab(id);
    if (id === 'ue') renderUeSection();
    if (id === 'stk') renderStkSection();
    if (id === 'dds') enhanceDdsSection();
    if (id === 'exp') enhanceExpSection();
    if (id === 'sup') enhanceSupSection();
    if (id === 'dash') enhanceDashBalance();
    syncActiveTabUi();
  };

  const origRender = window.render;
  window.render = function () {
    if (typeof origRender === 'function') origRender();
    syncActiveTabUi();
  };

  setInterval(syncActiveTabUi, 250);
  setTimeout(function () {
    injectUeButton();
    if (window.db?.tab) window.tab(window.db.tab);
  }, 200);
})();
