/* === SKOS Finance 3.0 — patch2.js (Полная чистая версия) === */
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
        barcode: bc, name: name || ('Товар ' + bc), costUsd: val
      });
    }
    if (!skipRender) {
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function') syncCloud();
      if (typeof render === 'function') render();
    }
    return true;
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
        amt: amt, note: `${note || 'РБП'} (${i + 1}/${n})`, batchId: batchId
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
    const formRow = catEl.closest('div[style*="grid"], div[style*="flex"], .grid, .row') || catEl.parentElement.parentElement;
    const box = document.createElement('div');
    box.id = 'skos-spread-exp-panel';
    box.style.cssText = 'width:100%;margin:0 0 12px 0;padding:10px 14px;border:1px solid #fde047;border-radius:8px;background:#fefce8;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;box-sizing:border-box;';
    const orgOpts = (db.orgs || []).filter(o => !o.archived).map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    box.innerHTML = `
      <span style="font-weight:600;color:#854d0e;">📅 Разбить годовой расход (1С / сервисы) на N мес.:</span>
      <input type="text" id="spr-dt" value="01.01.2026" placeholder="ДД.ММ.ГГГГ" style="width:95px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
      <select id="spr-org" style="padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">${orgOpts}</select>
      <input type="number" id="spr-amt" placeholder="Сумма ₽" style="width:105px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
      <input type="number" id="spr-mo" value="12" min="2" max="36" title="Месяцев" style="width:60px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
      <input type="text" id="spr-note" placeholder="Комментарий (напр. 1С за год)" style="flex:1;min-width:160px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
      <button type="button" onclick="if(window.addSpreadExpense(document.getElementById('spr-dt').value, document.getElementById('spr-org').value, document.getElementById('ex-cat').value, document.getElementById('spr-amt').value, document.getElementById('spr-mo').value, document.getElementById('spr-note').value)) alert('Расход разбит на ' + document.getElementById('spr-mo').value + ' мес.!')" style="padding:6px 14px;background:#ca8a04;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Разбить</button>`;
    formRow.parentElement.insertBefore(box, formRow);
  };

  window.renderSkuMissingBanner = function () {
    const inp = document.querySelector('input[placeholder*="Введите ШК"], input[placeholder*="Ваш SKU"]');
    if (!inp) return;
    const card = inp.closest('div[style*="background"], section, .card') || inp.parentElement;
    let box = document.getElementById('skos-sku-missing-box');
    const missing = window.getMissingCostBarcodes();
    if (!missing.length) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-sku-missing-box';
      box.style.cssText = 'margin-top:10px;padding:10px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fef2f2;font-size:13px;';
      card.appendChild(box);
    }
    box.innerHTML = `<b style="color:#b91c1c;">⚠️ Новые ШК из отчётов без себестоимости (${missing.length}):</b>` +
      missing.slice(0, 10).map(m => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
        <span style="font-family:monospace;background:#fff;padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;">${m.barcode}</span>
        <span style="flex:1;">${m.name} (${m.qty} шт.)</span>
        <input type="number" step="0.01" placeholder="USD" id="qcost_${m.barcode}" style="width:80px;padding:4px 6px;border:1px solid #94a3b8;border-radius:4px;">
        <button type="button" onclick="window.quickSaveSkuCost('${m.barcode}', document.getElementById('qcost_${m.barcode}').value, '${String(m.name).replace(/'/g, '')}')" style="padding:4px 10px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;">ОК</button>
      </div>`).join('');
  };

  const prevRender = window.render;
  window.render = function () {
    if (typeof prevRender === 'function') prevRender.apply(this, arguments);
    try {
      if (typeof window.renderSpreadExpensePanel === 'function') window.renderSpreadExpensePanel();
      if (typeof window.renderSkuMissingBanner === 'function') window.renderSkuMissingBanner();
    } catch (err) { console.error('SKOS patch2 error:', err); }
  };
})();
