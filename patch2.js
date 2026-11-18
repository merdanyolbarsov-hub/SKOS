/* === SKOS Finance 3.0 — patch2.js === */
(function () {
  if (window.__skosPatch2Loaded) return;
  window.__skosPatch2Loaded = true;

  function ensureCollections() {
    if (!window.db) return;
    db.sku = Array.isArray(db.sku) ? db.sku : [];
    db.reports = Array.isArray(db.reports) ? db.reports : [];
    db.itemSales = Array.isArray(db.itemSales) ? db.itemSales : [];
    db.expenses = Array.isArray(db.expenses) ? db.expenses : [];
    db.stockMoves = Array.isArray(db.stockMoves) ? db.stockMoves : [];
    db.supOps = Array.isArray(db.supOps) ? db.supOps : [];
  }

  function normBarcode(val) {
    return String(val || '').trim().replace(/^['"]+|['"]+$/g, '').replace(/\s+/g, '');
  }

  window.getMissingCostBarcodes = function () {
    ensureCollections();
    const skuMap = new Map();
    db.sku.forEach(s => {
      const bc = normBarcode(s.barcode || s.shk || s.id);
      if (bc) skuMap.set(bc, Number(s.costUsd || s.cost || 0));
    });
    const missing = new Map();
    db.itemSales.forEach(it => {
      const bc = normBarcode(it.barcode || it.shk || it.sku);
      if (!bc) return;
      const cost = skuMap.get(bc);
      if (cost === undefined || cost <= 0) {
        const cur = missing.get(bc) || { barcode: bc, name: it.name || it.title || 'Без названия', qty: 0 };
        cur.qty += Number(it.qty || it.count || 1);
        if (it.name && cur.name === 'Без названия') cur.name = it.name;
        missing.set(bc, cur);
      }
    });
    return Array.from(missing.values()).sort((a, b) => b.qty - a.qty);
  };
})();
  window.quickSaveSkuCost = function (barcode, costUsd, name, skipRender) {
    ensureCollections();
    const bc = normBarcode(barcode);
    const val = parseFloat(String(costUsd || '').replace(/\s/g, '').replace(',', '.'));
    if (!bc || isNaN(val) || val < 0) return false;
    let item = db.sku.find(s => normBarcode(s.barcode || s.shk || s.id) === bc);
    if (item) {
      item.costUsd = val;
      if ('cost' in item) item.cost = val;
      if (name && !item.name) item.name = name;
    } else {
      db.sku.push({
        id: 'sku_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        barcode: bc,
        name: name || ('Товар ' + bc),
        costUsd: val
      });
    }
    if (!skipRender) {
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function') syncCloud();
      if (typeof render === 'function') render();
    }
    return true;
  };

  window.importSkuCostCsv = function (file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      let text = new TextDecoder('utf-8').decode(e.target.result);
      if (text.includes('')) text = new TextDecoder('windows-1251').decode(e.target.result);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const iBc = headers.findIndex(h => /шк|штрих|barcode|ean|sku|арт/.test(h));
      const iCost = headers.findIndex(h => /себест|cost|usd|цена|\$/.test(h));
      const iName = headers.findIndex(h => /наим|назв|товар|name|title/.test(h));
      let updated = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const bc = normBarcode(cols[iBc >= 0 ? iBc : 0]);
        if (window.quickSaveSkuCost(bc, cols[iCost >= 0 ? iCost : 1], iName >= 0 ? cols[iName] : '', true)) updated++;
      }
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function') syncCloud();
      if (typeof render === 'function') render();
      if (typeof callback === 'function') callback(updated);
    };
    reader.readAsArrayBuffer(file);
  };
  window.renderSkuHelperPanel = function () {
    const skuTable = document.querySelector('#tb-sku, #sku-table, [data-tab="sku"] table');
    if (!skuTable) return;
    const host = skuTable.parentElement;
    let box = document.getElementById('skos-sku-panel');
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-sku-panel';
      box.style.cssText = 'margin:10px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;';
      host.insertBefore(box, skuTable);
    }
    const missing = window.getMissingCostBarcodes();
    const rowsHtml = missing.slice(0, 15).map(m => `
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px;">
        <span style="font-family:monospace;background:#fff;padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;">${m.barcode}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.name} <b>(${m.qty} шт.)</b></span>
        <input type="number" step="0.01" placeholder="USD" id="qcost_${m.barcode}" style="width:85px;padding:4px 6px;border:1px solid #94a3b8;border-radius:4px;">
        <button type="button" onclick="window.quickSaveSkuCost('${m.barcode}', document.getElementById('qcost_${m.barcode}').value, '${String(m.name).replace(/'/g, '')}')" style="padding:4px 10px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;">ОК</button>
      </div>`).join('');
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div><b>Контроль себестоимости (USD):</b> ${missing.length ? `<span style="color:#dc2626;">новых ШК без цены: ${missing.length}</span>` : '<span style="color:#16a34a;">все ШК из отчётов заполнены</span>'}</div>
        <label style="padding:5px 10px;background:#0f172a;color:#fff;border-radius:5px;cursor:pointer;font-size:12px;">
          Загрузить CSV себест. (USD)
          <input type="file" accept=".csv,.txt" style="display:none" onchange="window.importSkuCostCsv(this.files[0], n => alert('Обновлено ШК: ' + n))">
        </label>
      </div>
      ${missing.length ? `<div style="margin-top:8px;border-top:1px dashed #cbd5e1;padding-top:6px;">${rowsHtml}</div>` : ''}`;
  };
  window.parseMarketplaceReportCsv = function (file, meta, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      let text = new TextDecoder('utf-8').decode(e.target.result);
      if (text.includes('')) text = new TextDecoder('windows-1251').decode(e.target.result);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
      const h = lines[0].split(sep).map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''));
      const mp = h.some(x => /вайлдберриз|wb|баркод|к перечислению за товар/.test(x)) ? 'WB'
        : (h.some(x => /ozon|озон|начисления за доставку|схема доставки/.test(x)) ? 'Ozon' : 'ЯМ');
      const idx = rx => h.findIndex(x => rx.test(x));
      const cBc = idx(/баркод|шк|штрихкод|barcode|sku|ean/);
      const cName = idx(/название|наименование|товар|предмет|name/);
      const cType = idx(/обоснование|тип начисления|тип операции|событие|вид/);
      const cQty = idx(/кол-во|количество|шт|qty/);
      const cRev = idx(/цена розничная|сумма продаж|продано на сумму|реализация|выручка/);
      const cPay = idx(/к перечислению|итого к начислению|перечислению за товар|итого/);
      const cLog = idx(/логистик|доставк|обратная/);
      const cAds = idx(/реклам|продвижен|удержан|штраф|хранен/);
      const rate = Number((meta && meta.rate) || (typeof getRate === 'function' ? getRate() : 90));
      const skuMap = new Map(db.sku.map(s => [normBarcode(s.barcode || s.shk || s.id), Number(s.costUsd || s.cost || 0)]));
      const items = [];
      let totRev = 0, totPay = 0, totLog = 0, totAds = 0, totCogs = 0, totRet = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const num = k => k >= 0 ? (parseFloat(String(cols[k] || '').replace(/\s/g, '').replace(',', '.')) || 0) : 0;
        const bc = normBarcode(cols[cBc >= 0 ? cBc : 0]);
        const tp = String(cols[cType] || '').toLowerCase();
        const isRet = /возврат|return|отмена/.test(tp) || num(cPay) < 0;
        const qty = Math.abs(num(cQty)) || (bc ? 1 : 0);
        const rev = num(cRev), pay = num(cPay), log = Math.abs(num(cLog)), ads = Math.abs(num(cAds));
        const cogsRub = (skuMap.get(bc) || 0) * rate * (isRet ? -qty : qty);
        if (isRet) totRet += Math.abs(rev || pay); else totRev += rev;
        totPay += pay; totLog += log; totAds += ads; totCogs += cogsRub;
        if (bc) items.push({ barcode: bc, name: cols[cName] || '', qty: isRet ? -qty : qty, rev, pay, log, ads, cogsRub, isRet });
      }
      if (typeof callback === 'function') callback({ mp, rate, totRev, totRet, totPay, totLog, totAds, totCogs, items });
    };
    reader.readAsArrayBuffer(file);
  };
  window.importMarketplaceFile = function (file, orgId, monthStr, rateVal) {
    ensureCollections();
    window.parseMarketplaceReportCsv(file, { rate: rateVal }, function (res) {
      const repId = 'rep_' + Date.now();
      const comm = Math.max(0, res.totRev - res.totRet - res.totPay - res.totLog - res.totAds);
      db.reports.push({
        id: repId, mp: res.mp, org: orgId || '', month: monthStr || '', fileName: file.name,
        rate: res.rate, rev: res.totRev, returns: res.totRet, payout: res.totPay,
        comm: comm, log: res.totLog, ads: res.totAds, cogs: res.totCogs
      });
      res.items.forEach(it => db.itemSales.push(Object.assign({ repId, mp: res.mp, org: orgId || '', month: monthStr || '' }, it)));
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function') syncCloud();
      if (typeof render === 'function') render();
      alert(`Загружен отчёт ${res.mp} (${file.name}):\nВыручка: ${Math.round(res.totRev)} ₽ | Возвраты: ${Math.round(res.totRet)} ₽\nК перечислению: ${Math.round(res.totPay)} ₽ | Себест.: ${Math.round(res.totCogs)} ₽`);
    });
  };

  window.renderMpHelperPanel = function () {
    const repTable = document.querySelector('#tb-rep, #tb-reports, [data-tab="reports"] table');
    if (!repTable || document.getElementById('skos-mp-panel')) return;
    const box = document.createElement('div');
    box.id = 'skos-mp-panel';
    box.style.cssText = 'margin:10px 0;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f1f5f9;display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
    const orgOpts = (db.orgs || []).filter(o => !o.archived).map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    const defRate = typeof getRate === 'function' ? getRate() : 90;
    box.innerHTML = `
      <b>Импорт отчёта МП (WB/Ozon/ЯМ):</b>
      <select id="smp-org" style="padding:4px 6px;border-radius:4px;border:1px solid #94a3b8;">${orgOpts}</select>
      <input type="month" id="smp-mo" value="2026-01" style="padding:4px 6px;border-radius:4px;border:1px solid #94a3b8;">
      <input type="number" id="smp-rate" step="0.1" value="${defRate}" title="Курс USD" style="width:75px;padding:4px 6px;border-radius:4px;border:1px solid #94a3b8;">
      <label style="padding:5px 10px;background:#16a34a;color:#fff;border-radius:5px;cursor:pointer;font-size:12px;">
        Выбрать CSV отчёт
        <input type="file" accept=".csv,.txt" style="display:none" onchange="window.importMarketplaceFile(this.files, document.getElementById('smp-org').value, document.getElementById('smp-mo').value, document.getElementById('smp-rate').value)">
      </label>`;
    repTable.parentElement.insertBefore(box, repTable);
  };
  window.addSpreadExpense = function (dateStr, orgId, catId, totalAmt, monthsCount, note) {
    ensureCollections();
    const n = Math.max(1, Math.min(36, parseInt(monthsCount, 10) || 1));
    const total = parseFloat(String(totalAmt || '').replace(/\s/g, '').replace(',', '.'));
    if (!total || total <= 0) return false;
    const parts = String(dateStr || '01.01.2026').split('.');
    let day = parseInt(parts, 10) || 1, mo = parseInt(parts, 10) || 1, yr = parseInt(parts, 10) || 2026;
    const partAmt = Math.round((total / n) * 100) / 100;
    const batchId = 'spr_' + Date.now();
    for (let i = 0; i < n; i++) {
      const m = ((mo - 1 + i) % 12) + 1;
      const y = yr + Math.floor((mo - 1 + i) / 12);
      const dt = `${String(day).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
      const amt = i === n - 1 ? Math.round((total - partAmt * (n - 1)) * 100) / 100 : partAmt;
      db.expenses.push({
        id: batchId + '_' + i, date: dt, org: orgId || '', cat: catId || '',
        amt: amt, note: `${note || 'Распределённый расход'} (${i + 1}/${n})`, batchId: batchId
      });
    }
    if (typeof save === 'function') save();
    if (typeof syncCloud === 'function') syncCloud();
    if (typeof render === 'function') render();
    return true;
  };

  window.renderSpreadExpensePanel = function () {
    const catEl = document.getElementById('ex-cat');
    if (!catEl || document.getElementById('skos-spread-exp-panel')) return;
    const host = catEl.closest('.card, .box, section, div') || catEl.parentElement;
    const box = document.createElement('div');
    box.id = 'skos-spread-exp-panel';
    box.style.cssText = 'margin:10px 0;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fefce8;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px;';
    const orgOpts = (db.orgs || []).filter(o => !o.archived).map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    box.innerHTML = `
      <b>РБП (разбить на N мес.):</b>
      <input type="text" id="spr-dt" value="01.01.2026" placeholder="ДД.ММ.ГГГГ" style="width:92px;padding:4px 6px;border:1px solid #94a3b8;border-radius:4px;">
      <select id="spr-org" style="padding:4px 6px;border:1px solid #94a3b8;border-radius:4px;">${orgOpts}</select>
      <input type="number" id="spr-amt" placeholder="Сумма ₽" style="width:95px;padding:4px 6px;border:1px solid #94a3b8;border-radius:4px;">
      <input type="number" id="spr-mo" value="12" min="2" max="36" title="Кол-во месяцев" style="width:55px;padding:4px 6px;border:1px solid #94a3b8;border-radius:4px;">
      <input type="text" id="spr-note" placeholder="Назначение (1С, сервис)" style="width:150px;padding:4px 6px;border:1px solid #94a3b8;border-radius:4px;">
      <button type="button" onclick="if(window.addSpreadExpense(document.getElementById('spr-dt').value, document.getElementById('spr-org').value, document.getElementById('ex-cat').value, document.getElementById('spr-amt').value, document.getElementById('spr-mo').value, document.getElementById('spr-note').value)) alert('Расход распределён!')" style="padding:4px 10px;background:#ca8a04;color:#fff;border:none;border-radius:4px;cursor:pointer;">Разбить</button>`;
    host.parentElement.insertBefore(box, host);
  };
  window.calcDoubleAbc = function () {
    ensureCollections();
    const map = new Map();
    db.itemSales.forEach(it => {
      const bc = normBarcode(it.barcode || it.shk || it.sku);
      if (!bc) return;
      const cur = map.get(bc) || { barcode: bc, name: it.name || bc, qty: 0, rev: 0, profit: 0 };
      const rev = Number(it.rev || 0), pay = Number(it.pay || 0);
      const profit = pay - Number(it.log || 0) - Number(it.ads || 0) - Number(it.cogsRub || 0);
      cur.qty += Number(it.qty || 0);
      cur.rev += rev;
      cur.profit += profit;
      map.set(bc, cur);
    });
    const list = Array.from(map.values());
    const assignAbc = (arr, field) => {
      const sorted = [...arr].sort((a, b) => b[field] - a[field]);
      const sum = sorted.reduce((s, x) => s + Math.max(0, x[field]), 0) || 1;
      let acc = 0;
      sorted.forEach(x => {
        acc += Math.max(0, x[field]);
        const share = acc / sum;
        x['abc_' + field] = share <= 0.80 ? 'A' : (share <= 0.95 ? 'B' : 'C');
      });
    };
    assignAbc(list, 'rev');
    assignAbc(list, 'profit');
    return list.map(x => Object.assign(x, { group: (x.abc_rev || 'C') + (x.abc_profit || 'C') }))
      .sort((a, b) => b.profit - a.profit);
  };

  window.renderAbcAndStockPanel = function () {
    const abcHost = document.querySelector('#tb-abc, #abc-table, [data-tab="abc"] table');
    if (abcHost && !document.getElementById('skos-abc-panel')) {
      const box = document.createElement('div');
      box.id = 'skos-abc-panel';
      box.style.cssText = 'margin:10px 0;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;';
      const rows = window.calcDoubleAbc().slice(0, 30);
      box.innerHTML = `<b>Двойной ABC-анализ (Выручка × Маржа, ТОП-30):</b>` + (rows.length
        ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;">
            <tr style="background:#f1f5f9;text-align:left;"><th style="padding:4px;">ШК</th><th>Товар</th><th>Шт</th><th>Выручка</th><th>Маржа</th><th>Класс</th></tr>
            ${rows.map(r => `<tr style="border-top:1px solid #e2e8f0;"><td style="padding:4px;">${r.barcode}</td><td>${r.name}</td><td>${r.qty}</td><td>${Math.round(r.rev)} ₽</td><td>${Math.round(r.profit)} ₽</td><td><b>${r.group}</b></td></tr>`).join('')}
           </table>`
        : '<div style="margin-top:6px;color:#64748b;font-size:13px;">Загрузите отчёты продаж МП для расчёта классов AA–CC.</div>');
      abcHost.parentElement.insertBefore(box, abcHost);
    }
  };

  const prevRender = window.render;
  window.render = function () {
    if (typeof prevRender === 'function') prevRender.apply(this, arguments);
    try {
      if (typeof window.renderSkuHelperPanel === 'function') window.renderSkuHelperPanel();
      if (typeof window.renderMpHelperPanel === 'function') window.renderMpHelperPanel();
      if (typeof window.renderSpreadExpensePanel === 'function') window.renderSpreadExpensePanel();
      if (typeof window.renderAbcAndStockPanel === 'function') window.renderAbcAndStockPanel();
    } catch (err) {
      console.error('SKOS patch2 render error:', err);
    }
  };

