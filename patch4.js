(function () {
  if (window.__skosErpV5Ready) return;
  window.__skosErpV5Ready = true;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pSave() {
    try {
      if (typeof save === 'function') save();
      else if (window.db) localStorage.setItem('skos_v3_prod', JSON.stringify(window.db));
    } catch (err) { console.error(err); }
  }

  function ensureStore() {
    if (!window.db) window.db = {};
    if (!window.db.erp) window.db.erp = {};
    const e = window.db.erp;
    const arrKeys = ['materials', 'matIn', 'orders', 'bom', 'fgStocks', 'defects', 'unitEcon', 'osList', 'contractors', 'contractorOps', 'staffList', 'payrollOps', 'taxDebts'];
    arrKeys.forEach(k => { if (!Array.isArray(e[k])) e[k] = []; });

    if (!Array.isArray(e.dictMatCats)) {
      e.dictMatCats = [{ name: 'Ткань', arch: false }, { name: 'Фурнитура', arch: false }, { name: 'Упаковка и бирки', arch: false }, { name: 'Нитки и клеевые', arch: false }];
    }
    if (!Array.isArray(e.dictUnits)) {
      e.dictUnits = [{ name: 'м2', arch: false }, { name: 'кг', arch: false }, { name: 'м', arch: false }, { name: 'шт', arch: false }, { name: 'рулон', arch: false }];
    }
    if (!Array.isArray(e.dictSuppliers)) {
      e.dictSuppliers = [{ name: 'Турция (ткани)', arch: false }, { name: 'Китай (фурнитура)', arch: false }, { name: 'РФ (упаковка)', arch: false }, { name: 'Туркменистан (цех)', arch: false }];
    }
    if (!Array.isArray(e.dictTaxTypes)) {
      e.dictTaxTypes = [{ name: 'АУСН', arch: false }, { name: 'УСН', arch: false }, { name: 'НДС', arch: false }, { name: 'ЕНП', arch: false }, { name: 'Взносы ИП', arch: false }, { name: 'Патент', arch: false }];
    }
    if (!Array.isArray(e.ddsArticles)) {
      e.ddsArticles = [
        { name: 'Поступление от ВБ', dir: 'in', opiu: 'Учёт сделок (не дубл.)', arch: false },
        { name: 'Поступление от Озон', dir: 'in', opiu: 'Учёт сделок (не дубл.)', arch: false },
        { name: 'Закуп товара / сырья USD', dir: 'out', opiu: 'Учёт запасов (не дубл.)', arch: false },
        { name: 'Аренда склада', dir: 'out', opiu: 'Учёт поставщиков', arch: false },
        { name: 'Программное обеспечение / 1С', dir: 'out', opiu: 'Административные', arch: false },
        { name: 'Бухгалтерия / Юрист', dir: 'out', opiu: 'Административные', arch: false },
        { name: 'Таможенное оформление / ФТС', dir: 'out', opiu: 'Общепроизводственные', arch: false },
        { name: 'УСН / АУСН / НДС / ЕНП', dir: 'out', opiu: 'Учёт налогов (не дубл.)', arch: false },
        { name: 'Перевод / Конвертация валют', dir: 'move', opiu: 'Нет в ОПиУ', arch: false }
      ];
    }
    if (!e.stkSub) e.stkSub = 'sum';
    if (!e.ueView) e.ueView = 'fact';
    if (!e.ueFilter) e.ueFilter = { mp: 'ALL', org: 'ALL', mo: 'ALL', q: '' };
    if (!e.dictSub) e.dictSub = 'cats';
    return e;
  }
  let _mdlCache = null, _mdlKey = '';
  function getModelsList() {
    const e = ensureStore();
    const key = `${window.db?.skus?.length || 0}_${e.bom.length}_${window.db?.itemSales?.length || 0}`;
    if (_mdlCache && _mdlKey === key) return _mdlCache;

    const map = new Map();
    const add = (nm, usd, hasBom) => {
      const k = String(nm || '').trim();
      if (!k || k.length < 2) return;
      const prev = map.get(k.toLowerCase()) || { name: k, usd: 0, hasBom: false };
      map.set(k.toLowerCase(), { name: k, usd: Number(usd) || prev.usd, hasBom: hasBom || prev.hasBom });
    };

    ['skuFolders', 'folders', 'costFolders', 'models'].forEach(prop => {
      const arr = window.db && window.db[prop];
      if (Array.isArray(arr)) arr.forEach(f => add(typeof f === 'string' ? f : (f?.name || f?.title || f?.folder), f?.usd));
    });
    (window.db?.skus || []).forEach(s => {
      if (s?.folder) add(s.folder, s.usd);
      if (s?.name) add(s.name, s.usd);
    });
    (e.bom || []).forEach(b => {
      const u = (b.items || []).reduce((s, it) => s + (Number(it.norm) || 0) * (Number(it.priceUsd) || 0), 0);
      add(b.product, u, true);
    });
    (window.db?.itemSales || []).forEach(s => add(s?.name || s?.model, s?.usd));

    _mdlCache = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    _mdlKey = key;
    return _mdlCache;
  }

  function getModelUsd(name) {
    const k = String(name || '').trim().toLowerCase();
    const m = getModelsList().find(x => x.name.toLowerCase() === k);
    return m ? m.usd : 0;
  }

  function getActiveOrgs() {
    const list = [];
    (window.db?.orgs || []).forEach(o => {
      if (o && o.name && !o.archived && !o.hidden) list.push(String(o.name).trim());
    });
    return list.length ? list : ['ИП Каримов Артем', 'ИП Джуманиязова Мавлюда', 'ИП Джуманиязова Эльмира', 'ИП Триков Курбан', 'ИП Керимов Сахет', 'ООО Скос'];
  }

  window.quickAddToDict = function (dictKey, labelText) {
    const val = prompt(`Введите новое значение для справочника «${labelText}»:`);
    if (!val || !val.trim()) return;
    const e = ensureStore();
    const name = val.trim();
    if (!e[dictKey].some(x => x.name.toLowerCase() === name.toLowerCase())) {
      e[dictKey].unshift({ name, arch: false });
      pSave();
      if (typeof render === 'function') render();
    }
  };
  window.seedAllSkosData = function () {
    if (!confirm('Загрузить стартовые справочники SKOS (материалы, техкарты, ОС, контрагенты, сотрудники и налоговые долги)?\nВаши текущие данные не затрутся.')) return;
    const e = ensureStore();
    const mats = [
      ['Ткань лён', 'м2', 'Ткань', 120, 240], ['Ткань флис', 'кг', 'Ткань', 180, 720],
      ['Ткань жаты', 'м2', 'Ткань', 250, 250], ['Ткань брюк', 'м2', 'Ткань', 150, 397.5],
      ['Ткань габардин', 'м2', 'Ткань', 90, 177.3], ['Пуговица для брюк', 'шт', 'Фурнитура', 5000, 50],
      ['Пуговица рубашек', 'шт', 'Фурнитура', 8000, 32], ['Замок для брюк', 'шт', 'Фурнитура', 2000, 40],
      ['Крючок', 'шт', 'Фурнитура', 2000, 40], ['Карсаж', 'м', 'Фурнитура', 500, 100],
      ['Ичлик', 'м', 'Фурнитура', 400, 156], ['Клейвой', 'м', 'Фурнитура', 600, 60],
      ['Резинка 5см', 'м', 'Фурнитура', 800, 64], ['Тканевая этикетка', 'шт', 'Упаковка и бирки', 5000, 50],
      ['Боковая этикетка', 'шт', 'Упаковка и бирки', 5000, 400], ['Висячая этикетка', 'шт', 'Упаковка и бирки', 5000, 50],
      ['Размерная этикетка', 'шт', 'Упаковка и бирки', 5000, 15], ['Веревка для этикеток', 'шт', 'Упаковка и бирки', 5000, 15],
      ['Пакет 5', 'шт', 'Упаковка и бирки', 4000, 240], ['Пакет 10', 'шт', 'Упаковка и бирки', 3000, 210]
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
      if (!e.staffList.some(s => s.name === name)) e.staffList.push({ name, role, art, status: 'Работает', cur, initDebt, arch: false });
    });
    [
      ['ООО Сопровождение 1с', 'Программное обеспечение / 1С', 'RUB', 0], ['МойСклад', 'Программное обеспечение / 1С', 'RUB', 0],
      ['ИП Спичак Е.Ю.', 'Аренда склада', 'RUB', 0], ['Наталья Николаевна Бухгалтер', 'Бухгалтерия / Юрист', 'RUB', 0],
      ['Федеральная таможенная служба', 'Таможенное оформление / ФТС', 'RUB', 0]
    ].forEach(([name, art, cur, initDebt]) => {
      if (!e.contractors.some(c => c.name === name)) e.contractors.push({ name, art, status: 'Работаем', cur, initDebt, arch: false });
    });
    if (!e.osList.length) {
      e.osList.push(
        { name: 'Ноутбуки Lenovo / HP (5 шт.)', qty: 5, price: 65000, months: 60, passed: 10, resp: 'Мердан', room: 'Россия' },
        { name: 'Стеллажи и мебель склада', qty: 12, price: 28000, months: 60, passed: 10, resp: 'Курбан', room: 'Россия' },
        { name: 'Швейное и раскройное оборудование', qty: 8, price: 95000, months: 60, passed: 8, resp: 'Касым', room: 'Туркменистан' }
      );
    }
    _mdlCache = null;
    pSave();
    if (typeof render === 'function') render();
    alert('✅ Стартовые справочники и данные SKOS загружены!');
  };

  window.dictAction = function (act, key, idx) {
    const e = ensureStore();
    if (act === 'sub') { e.dictSub = key; pSave(); renderDictSection(); return; }
    if (act === 'addSimple') {
      const inp = document.getElementById('p4-d-new');
      const name = (inp?.value || '').trim();
      if (!name) return;
      if (!e[key].some(x => x.name.toLowerCase() === name.toLowerCase())) e[key].unshift({ name, arch: false });
      if (inp) inp.value = '';
    }
    if (act === 'editSimple') {
      const item = e[key]?.at(idx); if (!item) return;
      const nn = prompt('Новое название:', item.name);
      if (nn && nn.trim()) item.name = nn.trim();
    }
    if (act === 'toggleArch') {
      const item = e[key]?.at(idx); if (!item) return;
      item.arch = !item.arch;
    }
    if (act === 'delSimple') {
      if (!confirm('Удалить запись из справочника навсегда?')) return;
      e[key]?.splice(idx, 1);
    }
    if (act === 'addDdsArt') {
      const name = document.getElementById('p4-da-name')?.value.trim();
      const dir = document.getElementById('p4-da-dir')?.value || 'out';
      const opiu = document.getElementById('p4-da-opiu')?.value || 'Общепроизводственные';
      if (name) e.ddsArticles.unshift({ name, dir, opiu, arch: false });
    }
    if (act === 'editDdsArt') {
      const a = e.ddsArticles.at(idx); if (!a) return;
      const nn = prompt('Название статьи:', a.name); if (nn) a.name = nn.trim();
      const no = prompt('Правило ОПиУ:', a.opiu); if (no) a.opiu = no.trim();
    }
    pSave();
    renderDictSection();
  };
  function renderDictSection() {
    let sec = document.getElementById('tab-dict');
    if (!sec) {
      const main = document.querySelector('main.content'); if (!main) return;
      sec = document.createElement('section'); sec.id = 'tab-dict'; sec.className = 'hidden';
      main.appendChild(sec);
    }
    const e = ensureStore();
    const sub = e.dictSub || 'cats';
    const tabs = [
      ['cats', '🧵 Категории сырья'], ['units', '📏 Ед. измерения'],
      ['sups', '🚚 Поставщики сырья'], ['taxes', '🧾 Виды налогов'],
      ['dds', '💳 Статьи ДДС'], ['staff', '👷 Сотрудники и Контрагенты']
    ].map(([id, lbl]) => `<button type="button" class="btn ${sub === id ? 'btn-primary' : ''}" onclick="dictAction('sub','${id}')">${lbl}</button>`).join('');

    const renderSimpleDict = (dictKey, placeholder) => {
      const rows = (e[dictKey] || []).map((item, i) => `
        <tr style="${item.arch ? 'opacity:0.55;background:#f8fafc' : ''}">
          <td class="bold">${esc(item.name)}</td>
          <td>${item.arch ? '<span class="badge badge-amber">📦 В архиве</span>' : '<span class="badge badge-green">Активен</span>'}</td>
          <td style="white-space:nowrap">
            <button type="button" class="btn" style="padding:2px 6px" onclick="dictAction('editSimple','${dictKey}',${i})">✏️</button>
            <button type="button" class="btn" style="padding:2px 6px" onclick="dictAction('toggleArch','${dictKey}',${i})">${item.arch ? '📤' : '📦'}</button>
            <button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="dictAction('delSimple','${dictKey}',${i})">✕</button>
          </td>
        </tr>`).join('');
      return `
        <form onsubmit="event.preventDefault();dictAction('addSimple','${dictKey}')" style="display:flex;gap:8px;margin-bottom:12px">
          <input id="p4-d-new" class="input" style="max-width:340px" required placeholder="${esc(placeholder)}">
          <button type="submit" class="btn btn-primary">+ Добавить</button>
        </form>
        <table><thead><tr><th>Название</th><th>Статус</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table>`;
    };

    let body = '';
    if (sub === 'cats') body = renderSimpleDict('dictMatCats', 'Новая категория (напр. Трикотаж)...');
    else if (sub === 'units') body = renderSimpleDict('dictUnits', 'Новая ед. изм. (напр. упаковка)...');
    else if (sub === 'sups') body = renderSimpleDict('dictSuppliers', 'Новый поставщик сырья...');
    else if (sub === 'taxes') body = renderSimpleDict('dictTaxTypes', 'Новый вид налога...');
    else if (sub === 'dds') {
      body = `
        <form onsubmit="event.preventDefault();dictAction('addDdsArt')" class="form-grid" style="grid-template-columns:2fr 1fr 1.5fr auto;gap:8px;margin-bottom:12px">
          <div><input id="p4-da-name" class="input" required placeholder="Название статьи ДДС..."></div>
          <div><select id="p4-da-dir" class="select"><option value="out">Выбытие (-)</option><option value="in">Поступление (+)</option><option value="move">Перевод / Конверт.</option></select></div>
          <div><select id="p4-da-opiu" class="select"><option>Общепроизводственные</option><option>Административные</option><option>Коммерческие</option><option>Нет в ОПиУ</option><option>Учёт сделок (не дубл.)</option><option>Учёт налогов (не дубл.)</option><option>ЗПВ (не дубл.)</option></select></div>
          <div><button type="submit" class="btn btn-primary">+ Статья</button></div>
        </form>
        <table><thead><tr><th>Статья ДДС</th><th>Направление</th><th>Правило ОПиУ</th><th>Статус</th><th>Действия</th></tr></thead>
        <tbody>${e.ddsArticles.map((a, i) => `<tr style="${a.arch ? 'opacity:0.55' : ''}"><td class="bold">${esc(a.name)}</td><td>${esc(a.dir)}</td><td>${esc(a.opiu)}</td><td>${a.arch ? '📦 Архив' : 'Активна'}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:2px 6px" onclick="dictAction('editDdsArt','ddsArticles',${i})">✏️</button><button type="button" class="btn" style="padding:2px 6px" onclick="dictAction('toggleArch','ddsArticles',${i})">${a.arch ? '📤' : '📦'}</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="dictAction('delSimple','ddsArticles',${i})">✕</button></td></tr>`).join('')}</tbody></table>`;
    } else if (sub === 'staff') {
      body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-weight:800;margin-bottom:6px">👷 Сотрудники (ЗПВ) — правятся в «Расходы и Налоги»</div>
            <table><thead><tr><th>ФИО</th><th>Статья</th><th>Валюта</th><th>Статус</th></tr></thead>
            <tbody>${e.staffList.map(s => `<tr><td class="bold">${esc(s.name)}</td><td>${esc(s.art)}</td><td>${esc(s.cur)}</td><td>${esc(s.status)}</td></tr>`).join('') || '<tr><td colspan="4">Пусто</td></tr>'}</tbody></table>
          </div>
          <div>
            <div style="font-weight:800;margin-bottom:6px">🏢 Контрагенты — правятся в «Поставщики и ОС»</div>
            <table><thead><tr><th>Контрагент</th><th>Статья</th><th>Валюта</th></tr></thead>
            <tbody>${e.contractors.map(c => `<tr><td class="bold">${esc(c.name)}</td><td>${esc(c.art)}</td><td>${esc(c.cur)}</td></tr>`).join('') || '<tr><td colspan="3">Пусто</td></tr>'}</tbody></table>
          </div>
        </div>`;
    }

    sec.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div><div class="card-title">📚 Единые справочники и Архив SKOS</div><div style="font-size:11.5px;color:#64748b">Все выпадающие списки строятся строго из этих справочников.</div></div>
          <button type="button" class="btn btn-success" onclick="seedAllSkosData()">📥 Загрузить стартовые данные SKOS</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${tabs}</div>
        ${body}
      </div>`;
  }
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
    let rawUsd = 0, lowCount = 0;
    Object.values(map).forEach(x => {
      x.balQty = Math.max(0, x.initQty + x.inQty - x.outQty);
      x.balUsd = x.balQty * x.avgUsd;
      rawUsd += x.balUsd;
      if (x.balQty > 0 && x.balQty < 15) lowCount++;
    });
    const wipUsd = (e.orders || []).filter(o => o.status === 'WIP').reduce((s, o) => s + (Number(o.totalUsd) || 0), 0);
    const fgUsd = (e.fgStocks || []).reduce((s, r) => s + (r.lockedUsd != null ? Number(r.lockedUsd) : (((Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0)) * (Number(r.unitUsd) || 0))), 0);
    return { map, rawUsd, wipUsd, fgUsd, totalUsd: rawUsd + wipUsd + fgUsd, lowCount };
  }

  window.stkAction = function (act, a, b) {
    const e = ensureStore();
    if (act === 'tab') { e.stkSub = a; pSave(); renderStkSection(); return; }
    if (act === 'addMat') {
      const name = document.getElementById('p4-m-n').value.trim(), unit = document.getElementById('p4-m-u').value || 'шт', cat = document.getElementById('p4-m-c').value || 'Ткань';
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
      const supplier = document.getElementById('p4-in-s').value || '';
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
      _mdlCache = null;
    }
    if (act === 'editBomLine') {
      const it = e.bom.at(a)?.items?.at(b); if (!it) return;
      const n = Number(prompt('Норма на 1 шт.:', it.norm)); if (n > 0) it.norm = n;
      const p = Number(prompt('Цена ($):', it.priceUsd)); if (p >= 0) it.priceUsd = p;
      _mdlCache = null;
    }
    if (act === 'delBomLine' && confirm('Удалить позицию?')) { e.bom.at(a)?.items?.splice(b, 1); _mdlCache = null; }
    if (act === 'delBom' && confirm('Удалить всю техкарту?')) { e.bom.splice(a, 1); _mdlCache = null; }
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
      const month = document.getElementById('p4-fg-mo').value, product = document.getElementById('p4-fg-p').value;
      const ruQty = Number(document.getElementById('p4-fg-ru').value) || 0, tmQty = Number(document.getElementById('p4-fg-tm').value) || 0;
      const wayQty = Number(document.getElementById('p4-fg-way').value) || 0, unitUsd = Number(document.getElementById('p4-fg-u').value) || getModelUsd(product);
      if (product) e.fgStocks.unshift({ month, product, ruQty, tmQty, wayQty, unitUsd });
    }
    if (act === 'lockFg') {
      e.fgStocks.forEach(r => { if (r.lockedUsd == null) r.lockedUsd = ((Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0)) * (Number(r.unitUsd) || 0); });
      alert('🔒 Суммы готового товара зафиксированы за месяц!');
    }
    if (act === 'editFg') {
      const r = e.fgStocks.at(a); if (!r) return;
      r.ruQty = Number(prompt('РФ (шт.):', r.ruQty)) || 0; r.tmQty = Number(prompt('ТМ (шт.):', r.tmQty)) || 0; r.wayQty = Number(prompt('Путь (шт.):', r.wayQty)) || 0;
    }
    if (act === 'delFg' && confirm('Удалить остаток?')) e.fgStocks.splice(a, 1);
    if (act === 'addDef') {
      const date = document.getElementById('p4-df-d').value, product = document.getElementById('p4-df-p').value;
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
      return `<span><b>${esc(it.matName)}</b>: ${need.toFixed(2)} (${fmtU(need * u)})</span>`;
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

    const kFrz = document.getElementById('k-frz'), kFrzU = document.getElementById('k-frz-u');
    if (kFrz) kFrz.textContent = fmtR(bal.totalUsd * rate);
    if (kFrzU) kFrzU.textContent = `${fmtU(bal.totalUsd)} (Сырьё: ${fmtU(bal.rawUsd)} • НЗП: ${fmtU(bal.wipUsd)} • Товар: ${fmtU(bal.fgUsd)})`;

    const mOpts = models.map(m => `<option value="${esc(m.name)}">${esc(m.name)} (${fmtU(m.usd)})</option>`).join('');
    const catOpts = (e.dictMatCats || []).filter(x => !x.arch).map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('');
    const unitOpts = (e.dictUnits || []).filter(x => !x.arch).map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('');
    const supOpts = (e.dictSuppliers || []).filter(x => !x.arch).map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('');
    const matOpts = e.materials.map(m => `<option value="${esc(m.name)}">${esc(m.name)} (${esc(m.unit)})</option>`).join('');
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
          <div style="font-size:12px;color:#1e40af">ℹ️ <b>Контроль остатков:</b> Позиций с малым остатком (&lt;15 ед.): <b>${bal.lowCount}</b>. Категории, единицы и поставщики управляются в «📚 Справочники».</div>
          <div style="display:flex;gap:6px"><button type="button" class="btn" onclick="window.tab('dict')">📚 Открыть Справочники</button><button type="button" class="btn btn-success" onclick="seedAllSkosData()">📥 Загрузить базу SKOS</button></div>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Сырьё и фурнитура</div><div class="kpi-val">${fmtU(bal.rawUsd)}</div><div class="kpi-sub">${fmtR(bal.rawUsd * rate)}</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">В пошиве (НЗП)</div><div class="kpi-val" style="color:#d97706">${fmtU(bal.wipUsd)}</div><div class="kpi-sub">${fmtR(bal.wipUsd * rate)}</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Готовый товар</div><div class="kpi-val" style="color:#0284c7">${fmtU(bal.fgUsd)}</div><div class="kpi-sub">${fmtR(bal.fgUsd * rate)}</div></div>
          <div class="kpi-card highlight"><div style="font-size:11px;color:#1d4ed8;font-weight:700">ИТОГО ЗАМОРОЖЕНО</div><div class="kpi-val text-green">${fmtU(bal.totalUsd)}</div><div class="kpi-sub">${fmtR(bal.totalUsd * rate)}</div></div>
        </div>`;
    } else if (st === 'mat') {
      body = `
        <form onsubmit="event.preventDefault();stkAction('addMat')" class="form-grid" style="grid-template-columns:1.8fr 1fr 1.3fr 0.9fr 0.9fr auto;gap:7px;margin-bottom:10px">
          <div><label>Название ткани / фурнитуры</label><input id="p4-m-n" class="input" required placeholder="Напр: Футер 3-нитка"></div>
          <div><label>Ед. изм. <a href="#" onclick="event.preventDefault();quickAddToDict('dictUnits','Единицы измерения')">➕</a></label><select id="p4-m-u" class="select">${unitOpts}</select></div>
          <div><label>Категория <a href="#" onclick="event.preventDefault();quickAddToDict('dictMatCats','Категории сырья')">➕</a></label><select id="p4-m-c" class="select">${catOpts}</select></div>
          <div><label>Нач. ост.</label><input id="p4-m-iq" type="number" step="0.01" class="input" value="0"></div>
          <div><label>Нач. ($)</label><input id="p4-m-iu" type="number" step="0.01" class="input" value="0"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Добавить</button></div>
        </form>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Материал</th><th>Категория</th><th>Ед.</th><th class="num">Нач. ост.</th><th class="num">Приход</th><th class="num">Расход</th><th class="num">Остаток</th><th class="num">Цена ($)</th><th class="num">Сумма ($)</th><th>Действия</th></tr></thead>
          <tbody>${e.materials.map((m, i) => {
            const b = bal.map[m.name] || { initQty: 0, inQty: 0, outQty: 0, balQty: 0, avgUsd: 0, balUsd: 0 };
            const low = b.balQty > 0 && b.balQty < 15 ? 'color:#dc2626' : '';
            return `<tr><td class="bold">${esc(m.name)}</td><td>${esc(m.cat)}</td><td>${esc(m.unit)}</td><td class="num">${b.initQty.toFixed(1)}</td><td class="num">${b.inQty.toFixed(1)}</td><td class="num">${b.outQty.toFixed(1)}</td><td class="num bold" style="${low}">${b.balQty.toFixed(1)}</td><td class="num">${fmtU(b.avgUsd)}</td><td class="num bold">${fmtU(b.balUsd)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editMat',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delMat',${i})">✕</button></td></tr>`;
          }).join('')}</tbody>
        </table></div>`;
    } else if (st === 'in') {
      body = `
        <form onsubmit="event.preventDefault();stkAction('addIn')" class="form-grid" style="grid-template-columns:1fr 2fr 0.9fr 0.9fr 1.6fr auto;gap:7px;margin-bottom:10px">
          <div><label>Дата</label><input id="p4-in-d" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Материал (из справочника)</label><select id="p4-in-m" class="select" required>${matOpts}</select></div>
          <div><label>Кол-во</label><input id="p4-in-q" type="number" step="0.01" class="input" required></div>
          <div><label>Цена ($)</label><input id="p4-in-p" type="number" step="0.001" class="input" required></div>
          <div><label>Поставщик <a href="#" onclick="event.preventDefault();quickAddToDict('dictSuppliers','Поставщики сырья')">➕</a></label><select id="p4-in-s" class="select">${supOpts}</select></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Приход</button></div>
        </form>
        <table><thead><tr><th>Дата</th><th>Материал</th><th class="num">Кол-во</th><th class="num">Цена ($)</th><th class="num">Итого ($)</th><th>Поставщик</th><th>Действия</th></tr></thead>
        <tbody>${e.matIn.map((r, i) => `<tr><td>${esc(r.date)}</td><td class="bold">${esc(r.matName)}</td><td class="num">${r.qty}</td><td class="num">${fmtU(r.priceUsd)}</td><td class="num bold">${fmtU(r.totalUsd)}</td><td>${esc(r.supplier || '')}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editIn',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delIn',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:10px">Приходов пока нет</td></tr>'}</tbody></table>`;
    }
    } else if (st === 'sew') {
      const boms = e.bom.map((b, bi) => {
        const u = (b.items || []).reduce((s, x) => s + (Number(x.norm) || 0) * (Number(x.priceUsd) || 0), 0);
        return `<details style="border:1px solid #cbd5e1;border-radius:7px;background:#fff;margin-bottom:6px;padding:7px 10px"><summary style="cursor:pointer;font-weight:700;font-size:12.5px;display:flex;justify-content:space-between"><span>▶ ${esc(b.product)} — <span style="color:#0369a1">${fmtU(u)} / шт.</span></span><span><button type="button" class="btn" style="padding:1px 7px;font-size:11px" onclick="event.preventDefault();document.getElementById('p4-bm-p').value='${esc(b.product)}'">+ Позиция</button> <button type="button" class="btn btn-danger" style="padding:1px 7px;font-size:11px" onclick="event.preventDefault();stkAction('delBom',${bi})">🗑️</button></span></summary>
        <table style="margin-top:6px;font-size:11.5px"><thead><tr><th>Материал</th><th class="num">Норма</th><th class="num">Цена ($)</th><th class="num">Сумма ($)</th><th>Действия</th></tr></thead><tbody>${(b.items || []).map((it, ii) => `<tr><td>${esc(it.matName)}</td><td class="num">${it.norm}</td><td class="num">${fmtU(it.priceUsd)}</td><td class="num bold">${fmtU(it.norm * it.priceUsd)}</td><td><button type="button" class="btn" style="padding:1px 5px" onclick="stkAction('editBomLine',${bi},${ii})">✏️</button><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="stkAction('delBomLine',${bi},${ii})">✕</button></td></tr>`).join('')}</tbody></table></details>`;
      }).join('');
      body = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="font-weight:800;font-size:12.5px;color:#92400e;margin-bottom:6px">✂️ Запуск заказа в пошив (строго из справочника моделей и техкарт)</div>
          <form onsubmit="event.preventDefault();stkAction('addOrd')" class="form-grid" style="grid-template-columns:1fr 2fr 0.9fr 2fr auto;gap:7px">
            <div><label>Дата</label><input id="p4-ord-d" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
            <div><label>Модель (из 32 папок / SKU)</label><select id="p4-ord-prod" class="select" onchange="previewSewOrder()" required>${mOpts}</select></div>
            <div><label>Шт.</label><input id="p4-ord-qty" type="number" class="input" oninput="previewSewOrder()" required placeholder="1000"></div>
            <div><label>Комментарий</label><input id="p4-ord-c" class="input" placeholder="Цех Туркменистан"></div>
            <div style="align-self:end"><button type="submit" class="btn btn-primary">⚙️ Запустить</button></div>
          </form>
          <div id="p4-sew-preview"></div>
        </div>
        <table style="margin-bottom:14px"><thead><tr><th>Дата</th><th>Статус</th><th>Модель</th><th class="num">Шт.</th><th class="num">Итого ($)</th><th>Комментарий</th><th>Действия</th></tr></thead>
        <tbody>${e.orders.map((o, i) => `<tr><td>${esc(o.date)}</td><td>${o.status === 'WIP' ? '<span class="badge badge-amber">⏳ НЗП</span>' : `<span class="badge badge-green">✅ ${esc(o.doneDate)}</span>`}</td><td class="bold">${esc(o.product)}</td><td class="num bold">${o.qty}</td><td class="num bold">${fmtU(o.totalUsd)}</td><td>${esc(o.comment || '')}</td><td style="white-space:nowrap">${o.status === 'WIP' ? `<button type="button" class="btn btn-success" style="padding:2px 6px" onclick="stkAction('doneOrd',${i})">✅</button>` : ''}<button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editOrd',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delOrd',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:8px">Заказов нет</td></tr>'}</tbody></table>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;background:#f8fafc">
          <div style="font-weight:800;font-size:12.5px;margin-bottom:6px">📐 Конструктор техкарт моделей</div>
          <form onsubmit="event.preventDefault();stkAction('addBom')" class="form-grid" style="grid-template-columns:2fr 2fr 0.9fr 0.9fr auto;gap:7px;margin-bottom:8px">
            <div><label>Модель (выберите из списка)</label><select id="p4-bm-p" class="select" required>${mOpts}</select></div>
            <div><label>Материал / Работа</label><select id="p4-bm-m" class="select">${bomOpts}</select></div>
            <div><label>Норма на 1 шт.</label><input id="p4-bm-n" type="number" step="0.0001" class="input" required></div>
            <div><label>Цена ($)</label><input id="p4-bm-pr" type="number" step="0.0001" class="input" required></div>
            <div style="align-self:end"><button type="submit" class="btn btn-primary">+ В техкарту</button></div>
          </form>${boms}
        </div>`;
    } else if (st === 'fg') {
      body = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-weight:800;font-size:13px">📦 Готовая продукция (РФ / Туркменистан / В пути)</span><button type="button" class="btn btn-amber" onclick="stkAction('lockFg')">🔒 Зафиксировать суммы месяца</button></div>
        <form onsubmit="event.preventDefault();stkAction('saveFg')" class="form-grid" style="grid-template-columns:1fr 2fr 0.8fr 0.8fr 0.8fr 0.9fr auto;gap:7px;margin-bottom:10px">
          <div><label>Месяц</label><input id="p4-fg-mo" type="month" class="input" value="2026-11"></div>
          <div><label>Модель (из справочника)</label><select id="p4-fg-p" class="select" required>${mOpts}</select></div>
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
          return `<tr><td>${esc(r.month || '2026-11')}</td><td class="bold">${esc(r.product)}</td><td class="num">${r.ruQty}</td><td class="num">${r.tmQty}</td><td class="num">${r.wayQty}</td><td class="num bold">${tot}</td><td class="num bold">${fmtU(usd)}</td><td>${r.lockedUsd != null ? '<span class="badge badge-blue">🔒 Фикс.</span>' : 'Расчёт'}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editFg',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delFg',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:8px">Остатков нет</td></tr>'}</tbody></table>
        <div style="font-weight:800;font-size:13px;color:#b91c1c;margin-bottom:6px">⚠️ Журнал брака</div>
        <form onsubmit="event.preventDefault();stkAction('addDef')" class="form-grid" style="grid-template-columns:1fr 2fr 0.9fr 2fr auto;gap:7px;margin-bottom:8px">
          <div><label>Дата</label><input id="p4-df-d" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Модель (из справочника)</label><select id="p4-df-p" class="select" required>${mOpts}</select></div>
          <div><label>Шт.</label><input id="p4-df-q" type="number" class="input" required></div>
          <div><label>Причина</label><input id="p4-df-r" class="input" placeholder="Брак ткани"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-danger">+ Брак</button></div>
        </form>
        <table><thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт.</th><th class="num">Убыток ($)</th><th>Причина</th><th>Действия</th></tr></thead>
        <tbody>${e.defects.map((d, i) => `<tr><td>${esc(d.date)}</td><td class="bold">${esc(d.product)}</td><td class="num">${d.qty}</td><td class="num bold text-red">${fmtU(d.qty * d.unitUsd)}</td><td>${esc(d.reason || '')}</td><td><button type="button" class="btn" style="padding:2px 6px" onclick="stkAction('editDef',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="stkAction('delDef',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:8px">Брака нет</td></tr>'}</tbody></table>`;
    }
    sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🏭 Запасы, Пошив (НЗП), Техкарты и Брак</div><div style="display:flex;gap:5px;flex-wrap:wrap">${nav}</div></div>${body}</div>`;
  }
  window.ueAction = function (act, val, sub) {
    const e = ensureStore();
    if (act === 'view') e.ueView = val;
    if (act === 'flt') e.ueFilter[val] = sub;
    if (act === 'addPlan') {
      const model = document.getElementById('p4-ue-m')?.value || '';
      const mp = document.getElementById('p4-ue-mp')?.value || 'Wildberries';
      const price = Number(document.getElementById('p4-ue-pr')?.value) || 0;
      const comm = Number(document.getElementById('p4-ue-cm')?.value) || 0;
      const log = Number(document.getElementById('p4-ue-lg')?.value) || 0;
      const bo = Number(document.getElementById('p4-ue-bo')?.value) || 85;
      const ads = Number(document.getElementById('p4-ue-ad')?.value) || 0;
      const tax = Number(document.getElementById('p4-ue-tx')?.value) || 8;
      if (!model || price <= 0) return;
      const ex = e.unitEcon.find(x => x.model.toLowerCase() === model.toLowerCase() && x.mp === mp);
      const row = { model, mp, price, comm, log, bo, ads, tax };
      if (ex) Object.assign(ex, row); else e.unitEcon.unshift(row);
    }
    if (act === 'editPlan') {
      const r = e.unitEcon.at(val); if (!r) return;
      const pr = Number(prompt('Цена продажи (₽):', r.price)); if (!pr) return;
      const cm = Number(prompt('Комиссия МП (%):', r.comm)); if (!isNaN(cm)) r.comm = cm;
      const lg = Number(prompt('Логистика (₽):', r.log)); if (!isNaN(lg)) r.log = lg;
      r.price = pr;
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
    const mOpts = models.map(m => `<option value="${esc(m.name)}">${esc(m.name)} (${fmtU(m.usd)})</option>`).join('');

    let body = '';
    if (e.ueView === 'fact') {
      const sales = Array.isArray(window.db?.itemSales) ? window.db.itemSales : [];
      const orgs = getActiveOrgs();
      const map = new Map();
      sales.forEach(s => {
        const mp = s.mp || 'Wildberries';
        const org = s.org || orgs.at(0) || 'ИП Каримов Артем';
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
        const nC = r.sC - r.rC, cP = nR > 0 ? (nC / nR) * 100 : 0, l1 = nQ > 0 ? r.log / nQ : 0;
        const nM = r.sM - r.rM, prof = nR - nC - r.log - nM - r.ads, rent = nR > 0 ? (prof / nR) * 100 : 0;
        return { nQ, retP, nR, avg, nC, cP, l1, nM, prof, rent };
      };
      const tm = calc(t);
      body = `
        <div class="form-grid" style="grid-template-columns:1fr 1.3fr 1fr 1.5fr;gap:7px;margin-bottom:10px">
          <div><label>Площадка</label><select class="select" onchange="ueAction('flt','mp',this.value)"><option value="ALL">Все МП</option>${['Wildberries', 'Ozon', 'Яндекс Маркет'].map(m => `<option value="${m}" ${flt.mp === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div><label>Юрлицо</label><select class="select" onchange="ueAction('flt','org',this.value)"><option value="ALL">Все ИП и ООО</option>${orgs.map(o => `<option value="${esc(o)}" ${flt.org === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
          <div><label>Месяц</label><select class="select" onchange="ueAction('flt','mo',this.value)"><option value="ALL">Все месяцы</option>${['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => `<option value="${m}" ${flt.mo === m ? 'selected' : ''}>Мес. ${Number(m)}</option>`).join('')}</select></div>
          <div><label>Поиск по модели</label><input class="input" value="${esc(flt.q || '')}" oninput="ueAction('flt','q',this.value)" placeholder="Введите модель..."></div>
        </div>
        <div style="overflow-x:auto"><table style="font-size:11.5px">
          <thead><tr><th>Юрлицо</th><th>МП</th><th>Мес</th><th>Модель</th><th class="num">Прод.</th><th class="num">Возвр.</th><th class="num">Чист.</th><th class="num">% возвр.</th><th class="num">Выручка</th><th class="num">Ср. чек</th><th class="num">Себест.</th><th class="num">С/С %</th><th class="num">Логист.</th><th class="num">Лог. 1шт</th><th class="num">Комис.</th><th class="num">Маржа (₽)</th><th class="num">Рентаб. %</th></tr>
          <tr style="background:#eff6ff;font-weight:800;color:#1e3a8a"><td colspan="4">ИТОГО (${rows.length})</td><td class="num">${t.sQ}</td><td class="num">${t.rQ}</td><td class="num">${tm.nQ}</td><td class="num">${tm.retP.toFixed(1)}%</td><td class="num">${fmtR(tm.nR)}</td><td class="num">${fmtR(tm.avg)}</td><td class="num">${fmtR(tm.nC)}</td><td class="num">${tm.cP.toFixed(1)}%</td><td class="num">${fmtR(t.log)}</td><td class="num">${fmtR(tm.l1)}</td><td class="num">${fmtR(tm.nM)}</td><td class="num ${tm.prof >= 0 ? 'text-green' : 'text-red'}">${fmtR(tm.prof)}</td><td class="num ${tm.rent >= 0 ? 'text-green' : 'text-red'}">${tm.rent.toFixed(1)}%</td></tr></thead>
          <tbody>${rows.map(r => { const m = calc(r), c = m.prof >= 0 ? 'text-green' : 'text-red'; return `<tr><td>${esc(r.org)}</td><td>${esc(r.mp)}</td><td>${Number(r.mo)}</td><td class="bold">${esc(r.model)}</td><td class="num">${r.sQ}</td><td class="num">${r.rQ}</td><td class="num bold">${m.nQ}</td><td class="num">${m.retP.toFixed(1)}%</td><td class="num bold">${fmtR(m.nR)}</td><td class="num">${fmtR(m.avg)}</td><td class="num">${fmtR(m.nC)}</td><td class="num">${m.cP.toFixed(1)}%</td><td class="num">${fmtR(r.log)}</td><td class="num">${fmtR(m.l1)}</td><td class="num">${fmtR(m.nM)}</td><td class="num bold ${c}">${fmtR(m.prof)}</td><td class="num bold ${c}">${m.rent.toFixed(1)}%</td></tr>`; }).join('') || '<tr><td colspan="17" style="text-align:center;color:#64748b;padding:12px">Загрузите отчёты WB / Ozon / ЯМ — таблица заполнится сама</td></tr>'}</tbody>
        </table></div>`;
    } else {
      body = `
        <form onsubmit="event.preventDefault();ueAction('addPlan')" class="form-grid" style="grid-template-columns:2fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.8fr 0.8fr auto;gap:6px;margin-bottom:10px">
          <div><label>Модель (из справочника)</label><select id="p4-ue-m" class="select">${mOpts}</select></div>
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
          return `<tr><td class="bold">${esc(r.model)}</td><td>${esc(r.mp)}</td><td class="num bold">${fmtR(r.price)}</td><td class="num">${fmtU(uUsd)} / <b>${fmtR(uRub)}</b></td><td class="num">${fmtR(cmR)}</td><td class="num">${fmtR(effL)}</td><td class="num">${fmtR(adTx)}</td><td class="num bold ${prof >= 0 ? 'text-green' : 'text-red'}">${fmtR(prof)}</td><td class="num bold">${mg.toFixed(1)}%</td><td><button type="button" class="btn" style="padding:2px 6px" onclick="ueAction('editPlan',${i})">✏️</button><button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="ueAction('delPlan',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="10" style="text-align:center;color:#64748b;padding:10px">Добавьте расчёт модели выше</td></tr>'}</tbody></table>`;
    }
    sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📈 Юнит-экономика (Факт по отчётам МП + План-калькулятор)</div><div style="display:flex;gap:6px"><button type="button" class="btn ${e.ueView === 'fact' ? 'btn-primary' : ''}" onclick="ueAction('view','fact')">📊 Факт по отчётам МП</button><button type="button" class="btn ${e.ueView === 'plan' ? 'btn-primary' : ''}" onclick="ueAction('view','plan')">🧮 План-калькулятор</button></div></div>${body}</div>`;
  }
  window.addTaxWholeP4 = function () {
    const sec = document.getElementById('tab-exp'); if (!sec) return;
    const sels = sec.querySelectorAll('select');
    const org = sels.item(0)?.value || getActiveOrgs().at(0) || 'ИП Каримов Артем';
    const type = sels.item(1)?.value || 'АУСН';
    const yr = sels.item(2)?.value || '2026';
    const inp = sec.querySelector('input[type="number"]');
    const amt = Number(inp?.value || 0);
    if (amt <= 0) return alert('Сначала введите сумму налога в поле сверху.');
    const mo = prompt(`За какой месяц ${yr} провести «${type}» (${fmtR(amt)}) ЦЕЛИКОМ? (1–12):`, '11');
    const mNum = Number(mo); if (!mNum || mNum < 1 || mNum > 12) return;
    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    window.db.taxes.unshift({ id: 'tx_' + Date.now(), yr, mo: String(mNum).padStart(2, '0'), q: Math.ceil(mNum / 3), org, type, name: type, amount: amt, monthAmount: amt, comment: `Целиком за ${mNum}.${yr}` });
    if (inp) inp.value = '';
    pSave();
    if (typeof render === 'function') render();
  };

  window.taxDebtAction = function (act, i) {
    const e = ensureStore();
    if (act === 'add') {
      const org = document.getElementById('p4-td-org')?.value || '';
      const tax = document.getElementById('p4-td-tax')?.value || '';
      const debt = Number(document.getElementById('p4-td-val')?.value) || 0;
      if (!org || !tax) return;
      e.taxDebts.push({ org, tax, debt });
    }
    if (act === 'edit') {
      const d = e.taxDebts.at(i); if (!d) return;
      const v = Number(prompt(`Долг на 1 января для ${d.org} (${d.tax}), ₽:`, d.debt));
      if (!isNaN(v)) d.debt = v;
    }
    if (act === 'del' && confirm('Удалить строку долга?')) e.taxDebts.splice(i, 1);
    pSave();
    enhanceExpSection();
  };

  window.zpvAction = function (act, idx) {
    const e = ensureStore();
    if (act === 'addStaff') {
      const name = document.getElementById('p4-st-n')?.value.trim();
      const role = document.getElementById('p4-st-r')?.value.trim();
      const art = document.getElementById('p4-st-a')?.value || 'ФОТ склад';
      const cur = document.getElementById('p4-st-c')?.value || 'RUB';
      const initDebt = Number(document.getElementById('p4-st-d')?.value) || 0;
      if (!name) return;
      e.staffList.push({ name, role, art, status: 'Работает', cur, initDebt, arch: false });
    }
    if (act === 'editStaff') {
      const s = e.staffList.at(idx); if (!s) return;
      const st = prompt('Статус (Работает / Уволен):', s.status); if (st) s.status = st.trim();
      const d = Number(prompt(`Долг на 1 января (${s.cur}):`, s.initDebt)); if (!isNaN(d)) s.initDebt = d;
    }
    if (act === 'delStaff' && confirm('Удалить сотрудника?')) e.staffList.splice(idx, 1);
    if (act === 'addOp') {
      const date = document.getElementById('p4-zp-d')?.value;
      const emp = document.getElementById('p4-zp-e')?.value;
      const kind = document.getElementById('p4-zp-k')?.value;
      const amt = Number(document.getElementById('p4-zp-a')?.value) || 0;
      const st = e.staffList.find(x => x.name === emp);
      if (!emp || amt <= 0) return;
      e.payrollOps.unshift({ date, emp, kind, amt, cur: st ? st.cur : 'RUB', art: st ? st.art : 'ФОТ склад' });
    }
    if (act === 'editOp') {
      const o = e.payrollOps.at(idx); if (!o) return;
      const na = Number(prompt(`Сумма (${o.cur}):`, o.amt)); if (na > 0) o.amt = na;
    }
    if (act === 'delOp' && confirm('Удалить запись ЗПВ?')) e.payrollOps.splice(idx, 1);
    pSave();
    enhanceExpSection();
  };
  function enhanceExpSection() {
    const sec = document.getElementById('tab-exp'); if (!sec) return;
    const e = ensureStore();

    const taxSel = sec.querySelectorAll('select').item(1);
    if (taxSel) {
      const curVal = taxSel.value;
      (e.dictTaxTypes || []).filter(t => !t.arch).map(t => t.name).forEach(tName => {
        if (!Array.from(taxSel.options).some(o => o.value === tName)) {
          const opt = document.createElement('option'); opt.value = tName; opt.textContent = tName;
          taxSel.appendChild(opt);
        }
      });
      if (curVal) taxSel.value = curVal;
    }

    const qBtn = Array.from(sec.querySelectorAll('button')).find(b => (b.textContent || '').includes('Разнести'));
    if (qBtn && !document.getElementById('p4-tx-whole')) {
      const b = document.createElement('button');
      b.id = 'p4-tx-whole'; b.type = 'button'; b.className = 'btn btn-success'; b.style.marginLeft = '6px';
      b.textContent = '✅ Целиком за месяц'; b.onclick = window.addTaxWholeP4;
      qBtn.parentNode.insertBefore(b, qBtn.nextSibling);
    }

    let extra = document.getElementById('p4-exp-extra');
    if (!extra) { extra = document.createElement('div'); extra.id = 'p4-exp-extra'; sec.appendChild(extra); }

    const orgOpts = getActiveOrgs().map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    const taxOpts = (e.dictTaxTypes || []).filter(t => !t.arch).map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');
    const empOpts = e.staffList.filter(s => s.status !== 'Уволен').map(s => `<option value="${esc(s.name)}">${esc(s.name)} (${esc(s.art)}, ${s.cur})</option>`).join('');

    const debtRows = e.taxDebts.map((d, i) => `<tr><td class="bold">${esc(d.org)}</td><td>${esc(d.tax)}</td><td class="num bold ${d.debt > 0 ? 'text-red' : 'text-green'}">${fmtR(d.debt)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:1px 5px" onclick="taxDebtAction('edit',${i})">✏️</button> <button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="taxDebtAction('del',${i})">✕</button></td></tr>`).join('');

    const zpvSummary = e.staffList.map((s, i) => {
      const acc = e.payrollOps.filter(o => o.emp === s.name && (o.kind === 'Оклад' || o.kind === 'Премия')).reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const pen = e.payrollOps.filter(o => o.emp === s.name && o.kind === 'Штраф / Удержание').reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const pay = e.payrollOps.filter(o => o.emp === s.name && (o.kind === 'Выплата ЗП' || o.kind === 'Выплата аванса')).reduce((a, b) => a + (Number(b.amt) || 0), 0);
      const bal = (Number(s.initDebt) || 0) + acc - pen - pay;
      const fv = v => s.cur === 'USD' ? fmtU(v) : fmtR(v);
      return `<tr><td class="bold">${esc(s.name)}</td><td>${esc(s.role || '')}</td><td>${esc(s.art)}</td><td><span class="badge ${s.status === 'Работает' ? 'badge-green' : 'badge-amber'}">${esc(s.status)}</span></td><td class="num">${fv(s.initDebt)}</td><td class="num">${fv(acc - pen)}</td><td class="num">${fv(pay)}</td><td class="num bold ${bal > 0 ? 'text-red' : 'text-green'}">${fv(bal)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:1px 5px" onclick="zpvAction('editStaff',${i})">✏️</button> <button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="zpvAction('delStaff',${i})">✕</button></td></tr>`;
    }).join('');

    extra.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="card-header"><div class="card-title">🧾 Входящие налоговые долги / переплаты на 1 января</div><div style="display:flex;gap:6px"><button type="button" class="btn" onclick="window.tab('dict')">📚 Справочник налогов</button><button type="button" class="btn btn-success" onclick="seedAllSkosData()">📥 База SKOS</button></div></div>
        <form onsubmit="event.preventDefault();taxDebtAction('add')" class="form-grid" style="grid-template-columns:1.5fr 1.5fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Юрлицо</label><select id="p4-td-org" class="select">${orgOpts}</select></div>
          <div><label>Вид налога <a href="#" onclick="event.preventDefault();quickAddToDict('dictTaxTypes','Виды налогов')">➕</a></label><select id="p4-td-tax" class="select">${taxOpts}</select></div>
          <div><label>Долг на 1 янв. (₽)</label><input id="p4-td-val" type="number" class="input" required placeholder="0"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Долг</button></div>
        </form>
        <table><thead><tr><th>Юридическое лицо</th><th>Налог</th><th class="num">Долг на 1 января (₽)</th><th>Действия</th></tr></thead><tbody>${debtRows || '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:8px">Добавьте строку выше или нажмите «📥 База SKOS»</td></tr>'}</tbody></table>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="card-header"><div class="card-title">👷 Зарплатная ведомость SKOS (Штат RUB/USD, Начисления и Выплаты)</div></div>
        <form onsubmit="event.preventDefault();zpvAction('addStaff')" class="form-grid" style="grid-template-columns:1.5fr 1.2fr 1.3fr 0.8fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Сотрудник</label><input id="p4-st-n" class="input" required placeholder="ФИО"></div>
          <div><label>Должность</label><input id="p4-st-r" class="input" placeholder="Упаковщик / Менеджер"></div>
          <div><label>Статья ОПиУ</label><select id="p4-st-a" class="select"><option>ФОТ склад</option><option>ФОТ менеджеры</option><option>ФОТ офис</option><option>ФОТ собственик</option></select></div>
          <div><label>Валюта</label><select id="p4-st-c" class="select"><option>RUB</option><option>USD</option></select></div>
          <div><label>Долг на 1 янв.</label><input id="p4-st-d" type="number" class="input" value="0"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Сотрудник</button></div>
        </form>
        <div style="overflow-x:auto;margin-bottom:10px"><table><thead><tr><th>Сотрудник</th><th>Должность</th><th>Статья</th><th>Статус</th><th class="num">Нач. долг</th><th class="num">Начислено</th><th class="num">Выплачено</th><th class="num">Остаток долга</th><th>Действия</th></tr></thead><tbody>${zpvSummary || '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:8px">Нажмите «📥 База SKOS» или добавьте сотрудника</td></tr>'}</tbody></table></div>
        <form onsubmit="event.preventDefault();zpvAction('addOp')" class="form-grid" style="grid-template-columns:1fr 1.6fr 1.3fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Дата</label><input id="p4-zp-d" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Сотрудник (из штата)</label><select id="p4-zp-e" class="select" required>${empOpts}</select></div>
          <div><label>Вид операции</label><select id="p4-zp-k" class="select"><option>Оклад</option><option>Премия</option><option>Штраф / Удержание</option><option>Выплата ЗП</option><option>Выплата аванса</option></select></div>
          <div><label>Сумма</label><input id="p4-zp-a" type="number" step="0.01" class="input" required></div>
          <div style="align-self:end"><button type="submit" class="btn btn-success">+ Провести</button></div>
        </form>
        <table><thead><tr><th>Дата</th><th>Сотрудник</th><th>Статья</th><th>Операция</th><th class="num">Сумма</th><th>Действия</th></tr></thead>
        <tbody>${e.payrollOps.slice(0, 25).map((o, i) => `<tr><td>${esc(o.date)}</td><td class="bold">${esc(o.emp)}</td><td>${esc(o.art)}</td><td>${esc(o.kind)}</td><td class="num bold">${o.cur === 'USD' ? fmtU(o.amt) : fmtR(o.amt)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:1px 5px" onclick="zpvAction('editOp',${i})">✏️</button> <button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="zpvAction('delOp',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:6px">Операций ЗПВ пока нет</td></tr>'}</tbody></table>
      </div>`;
  }
  window.supOsAction = function (act, idx) {
    const e = ensureStore();
    if (act === 'addOs') {
      const name = document.getElementById('p4-os-n')?.value.trim();
      const qty = Number(document.getElementById('p4-os-q')?.value) || 1;
      const price = Number(document.getElementById('p4-os-p')?.value) || 0;
      const months = Number(document.getElementById('p4-os-m')?.value) || 60;
      const resp = document.getElementById('p4-os-r')?.value.trim() || 'Мердан';
      const room = document.getElementById('p4-os-l')?.value || 'Россия';
      if (!name || price <= 0) return;
      e.osList.unshift({ name, qty, price, months, passed: 0, resp, room });
    }
    if (act === 'editOs') {
      const o = e.osList.at(idx); if (!o) return;
      const q = Number(prompt('Кол-во:', o.qty)); if (q > 0) o.qty = q;
      const p = Number(prompt('Цена ед. (₽):', o.price)); if (p > 0) o.price = p;
      const ps = Number(prompt('Прошло мес. амортизации:', o.passed || 0)); if (!isNaN(ps) && ps >= 0) o.passed = ps;
    }
    if (act === 'delOs' && confirm('Удалить ОС?')) e.osList.splice(idx, 1);

    if (act === 'addCtr') {
      const name = document.getElementById('p4-ct-n')?.value.trim();
      const art = document.getElementById('p4-ct-a')?.value || 'Аренда склада';
      const cur = document.getElementById('p4-ct-c')?.value || 'RUB';
      const initDebt = Number(document.getElementById('p4-ct-d')?.value) || 0;
      if (!name) return;
      e.contractors.push({ name, art, status: 'Работаем', cur, initDebt, arch: false });
    }
    if (act === 'editCtr') {
      const c = e.contractors.at(idx); if (!c) return;
      const d = Number(prompt(`Начальный долг (${c.cur}):`, c.initDebt)); if (!isNaN(d)) c.initDebt = d;
    }
    if (act === 'delCtr' && confirm('Удалить контрагента?')) e.contractors.splice(idx, 1);

    if (act === 'addCtrOp') {
      const date = document.getElementById('p4-co-d')?.value;
      const ctr = document.getElementById('p4-co-c')?.value;
      const kind = document.getElementById('p4-co-k')?.value;
      const amt = Number(document.getElementById('p4-co-a')?.value) || 0;
      const f = e.contractors.find(x => x.name === ctr);
      if (!ctr || amt <= 0) return;
      e.contractorOps.unshift({ date, ctr, kind, amt, cur: f ? f.cur : 'RUB', art: f ? f.art : '' });
    }
    if (act === 'editCtrOp') {
      const op = e.contractorOps.at(idx); if (!op) return;
      const na = Number(prompt(`Сумма (${op.cur}):`, op.amt)); if (na > 0) op.amt = na;
    }
    if (act === 'delCtrOp' && confirm('Удалить операцию?')) e.contractorOps.splice(idx, 1);

    pSave();
    enhanceSupSection();
  };
  function enhanceSupSection() {
    const sec = document.getElementById('tab-sup'); if (!sec) return;
    let box = document.getElementById('p4-sup-os-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-sup-os-box'; sec.insertBefore(box, sec.firstChild); }
    const e = ensureStore();

    const totAmort = e.osList.reduce((s, o) => s + ((Number(o.qty) || 1) * (Number(o.price) || 0)) / (Number(o.months) || 60), 0);
    const totRemOs = e.osList.reduce((s, o) => {
      const full = (Number(o.qty) || 1) * (Number(o.price) || 0);
      return s + Math.max(0, full - (full / (Number(o.months) || 60)) * (Number(o.passed) || 0));
    }, 0);

    const artOpts = (e.ddsArticles || []).filter(a => !a.arch).map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('');
    const ctrOpts = e.contractors.map(c => `<option value="${esc(c.name)}">${esc(c.name)} (${esc(c.art)}, ${c.cur})</option>`).join('');

    box.innerHTML = `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header"><div class="card-title">🏢 Контрагенты SKOS (Аренда, 1С, ФТС, Бухгалтерия — RUB/USD)</div><button type="button" class="btn btn-success" onclick="seedAllSkosData()">📥 Загрузить базу SKOS</button></div>
        <form onsubmit="event.preventDefault();supOsAction('addCtr')" class="form-grid" style="grid-template-columns:1.6fr 1.6fr 0.7fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Контрагент</label><input id="p4-ct-n" class="input" required placeholder="Название контрагента"></div>
          <div><label>Статья (из справочника ДДС)</label><select id="p4-ct-a" class="select">${artOpts}</select></div>
          <div><label>Валюта</label><select id="p4-ct-c" class="select"><option>RUB</option><option>USD</option></select></div>
          <div><label>Долг нач. (-/+)</label><input id="p4-ct-d" type="number" class="input" value="0"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Контрагент</button></div>
        </form>
        <div style="overflow-x:auto;margin-bottom:10px"><table><thead><tr><th>Контрагент</th><th>Статья</th><th>Валюта</th><th class="num">Долг нач.</th><th class="num">Начислено</th><th class="num">Оплачено</th><th class="num">Сальдо</th><th>Действия</th></tr></thead>
        <tbody>${e.contractors.map((c, i) => {
          const acc = e.contractorOps.filter(x => x.ctr === c.name && x.kind === 'Начисление (Акт)').reduce((a, b) => a + b.amt, 0);
          const pay = e.contractorOps.filter(x => x.ctr === c.name && x.kind === 'Оплата').reduce((a, b) => a + b.amt, 0);
          const bal = (Number(c.initDebt) || 0) + acc - pay;
          const fv = v => c.cur === 'USD' ? fmtU(v) : fmtR(v);
          return `<tr><td class="bold">${esc(c.name)}</td><td>${esc(c.art)}</td><td>${esc(c.cur)}</td><td class="num">${fv(c.initDebt)}</td><td class="num">${fv(acc)}</td><td class="num">${fv(pay)}</td><td class="num bold ${bal > 0 ? 'text-red' : 'text-green'}">${fv(bal)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:1px 5px" onclick="supOsAction('editCtr',${i})">✏️</button> <button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="supOsAction('delCtr',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:8px">Нажмите «📥 Загрузить базу SKOS» сверху</td></tr>'}</tbody></table></div>
        <form onsubmit="event.preventDefault();supOsAction('addCtrOp')" class="form-grid" style="grid-template-columns:1fr 1.6fr 1.2fr 1fr auto;gap:6px;margin-bottom:8px">
          <div><label>Дата</label><input id="p4-co-d" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Контрагент (из справочника)</label><select id="p4-co-c" class="select" required>${ctrOpts}</select></div>
          <div><label>Операция</label><select id="p4-co-k" class="select"><option>Начисление (Акт)</option><option>Оплата</option></select></div>
          <div><label>Сумма</label><input id="p4-co-a" type="number" step="0.01" class="input" required></div>
          <div style="align-self:end"><button type="submit" class="btn btn-success">+ Провести</button></div>
        </form>
        <table><thead><tr><th>Дата</th><th>Контрагент</th><th>Операция</th><th class="num">Сумма</th><th>Действия</th></tr></thead>
        <tbody>${e.contractorOps.slice(0, 15).map((op, i) => `<tr><td>${esc(op.date)}</td><td class="bold">${esc(op.ctr)}</td><td>${esc(op.kind)}</td><td class="num bold">${op.cur === 'USD' ? fmtU(op.amt) : fmtR(op.amt)}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:1px 5px" onclick="supOsAction('editCtrOp',${i})">✏️</button> <button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="supOsAction('delCtrOp',${i})">✕</button></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:6px">Операций по контрагентам пока нет</td></tr>'}</tbody></table>
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
          return `<tr><td class="bold">${esc(o.name)}</td><td class="num">${o.qty}</td><td class="num">${fmtR(full)}</td><td class="num">${fmtR(am)}</td><td class="num bold">${fmtR(rem)}</td><td>${esc(o.resp || '')}</td><td>${esc(o.room || '')}</td><td style="white-space:nowrap"><button type="button" class="btn" style="padding:1px 5px" onclick="supOsAction('editOs',${i})">✏️</button> <button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="supOsAction('delOs',${i})">✕</button></td></tr>`;
        }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:8px">Нажмите «📥 Загрузить базу SKOS» сверху</td></tr>'}</tbody></table></div>
      </div>`;
  }
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
        const desc = iDesc >= 0 ? (c.at(iDesc) || '') : '', docNum = iDoc >= 0 ? (c.at(iDoc) || '') : '';
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
      alert(`✅ Импорт ДДС: добавлено ${add} операций, пропущено дублей: ${skp}.`);
    };
    reader.readAsText(f, 'UTF-8');
  };

  function enhanceDdsSection() {
    const sec = document.getElementById('tab-dds'); if (!sec) return;
    let box = document.getElementById('p4-dds-box');
    if (!box) { box = document.createElement('div'); box.id = 'p4-dds-box'; sec.insertBefore(box, sec.firstChild); }
    box.innerHTML = `
      <div class="card" style="margin-bottom:10px;background:#f8fafc">
        <div class="card-header">
          <div class="card-title">💳 Умный импорт ДДС и Справочник статей</div>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn" onclick="ensureStore().dictSub='dds';window.tab('dict')">📚 Статьи ДДС</button>
            <label class="btn btn-success" style="cursor:pointer;margin:0">📥 Загрузить CSV<input type="file" accept=".csv" style="display:none" onchange="importDdsCsvP4(event)"></label>
          </div>
        </div>
      </div>`;
  }

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

  function injectNavButtons() {
    const sku = document.getElementById('nav-sku');
    if (sku && sku.parentNode && !document.getElementById('nav-ue')) {
      const b1 = document.createElement('button');
      b1.className = 'nav-btn'; b1.id = 'nav-ue'; b1.textContent = '📈 Юнит-экономика';
      b1.onclick = function () { window.tab('ue'); };
      sku.parentNode.insertBefore(b1, sku.nextSibling);
    }
    const setBtn = document.getElementById('nav-set');
    if (setBtn && setBtn.parentNode && !document.getElementById('nav-dict')) {
      const b2 = document.createElement('button');
      b2.className = 'nav-btn'; b2.id = 'nav-dict'; b2.textContent = '📚 Справочники';
      b2.onclick = function () { window.tab('dict'); };
      setBtn.parentNode.insertBefore(b2, setBtn.nextSibling);
    }
  }

  const crumbMap = {
    dash: 'SKOS / Сводка и 5 ИП + 1 ООО', abc: 'SKOS / Двойной ABC-анализ',
    rep: 'SKOS / Отчёты WB / Ozon / ЯМ', sku: 'SKOS / Товары, ШК и Себест.',
    ue: 'SKOS / Юнит-экономика (Факт МП + План)', stk: 'SKOS / Запасы, Пошив (НЗП), Техкарты и Брак',
    dds: 'SKOS / ДДС, Выписки и Кассы', exp: 'SKOS / Расходы, Налоги и Зарплатная ведомость',
    sup: 'SKOS / Контрагенты и Основные средства', set: 'SKOS / Юрлица, Банки и Облако',
    dict: 'SKOS / Единые справочники и Архив'
  };

  function applyActiveTab(id) {
    injectNavButtons();
    const cur = id || window.db?.tab || 'dash';
    document.querySelectorAll('main.content > section').forEach(s => {
      const show = s.id === 'tab-' + cur;
      s.classList.toggle('hidden', !show);
      s.style.display = show ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.id === 'nav-' + cur));
    const cr = document.getElementById('crumb');
    if (cr && crumbMap[cur]) cr.textContent = crumbMap[cur];

    if (cur === 'dash') enhanceDashBalance();
    if (cur === 'ue') renderUeSection();
    if (cur === 'dict') renderDictSection();
    if (cur === 'stk') renderStkSection();
    if (cur === 'dds') enhanceDdsSection();
    if (cur === 'exp') enhanceExpSection();
    if (cur === 'sup') enhanceSupSection();
  }

  const origTab = window.tab;
  window.tab = function (id) {
    if (window.db) window.db.tab = id;
    if (id !== 'ue' && id !== 'dict' && typeof origTab === 'function') origTab(id);
    applyActiveTab(id);
  };

  const origRender = window.render;
  window.render = function () {
    if (typeof origRender === 'function') origRender();
    applyActiveTab(window.db?.tab || 'dash');
  };

  const mainEl = document.querySelector('main.content');
  if (mainEl && window.MutationObserver) {
    let lockObs = false;
    new MutationObserver(function () {
      if (lockObs) return;
      lockObs = true;
      requestAnimationFrame(function () {
        applyActiveTab(window.db?.tab || 'dash');
        lockObs = false;
      });
    }).observe(mainEl, { childList: true });
  }

  setTimeout(function () { applyActiveTab(window.db?.tab || 'dash'); }, 150);
})();
