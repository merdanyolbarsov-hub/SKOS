/* === SKOS Finance 3.0 — patch2.js (Чистая финальная сборка) === */
(function () {
  if (window.__skosPatch2Loaded) return;
  window.__skosPatch2Loaded = true;

  function ensureCollections() {
    if (!window.db) return;
    db.sku = Array.isArray(db.sku) ? db.sku : [];
    db.reports = Array.isArray(db.reports) ? db.reports : [];
    db.itemSales = Array.isArray(db.itemSales) ? db.itemSales : [];
    db.expenses = Array.isArray(db.expenses) ? db.expenses : [];
  }

  function normBarcode(val) {
    return String(val || '').trim().replace(/^['"]+|['"]+$/g, '').replace(/\s+/g, '');
  }

  function extractModelCode(str) {
    const m = String(str || '').match(/SKOS-[A-ZА-Я0-9]+/i);
    return m ? m.toUpperCase() : '';
  }

  window.cleanBrokenSkuImport = function () {
    ensureCollections();
    const before = db.sku.length;
    db.sku = db.sku.filter(s => Number(s.cost || s.costUsd || 0) < 500);
    return before - db.sku.length;
  };

  window.findSkuCost = function (barcode, artOrName) {
    ensureCollections();
    const bc = normBarcode(barcode);
    let hit = bc ? db.sku.find(s => normBarcode(s.barcode || s.shk || s.id) === bc) : null;
    if (hit && Number(hit.costUsd || hit.cost) > 0) return Number(hit.costUsd || hit.cost);
    const code = extractModelCode(artOrName) || String(artOrName || '').trim().toUpperCase();
    if (code) {
      hit = db.sku.find(s => (extractModelCode(s.art || s.name) === code || String(s.art || '').trim().toUpperCase() === code) && Number(s.costUsd || s.cost) > 0);
      if (hit) return Number(hit.costUsd || hit.cost);
    }
    return 0;
  };
  window.parseAnyCostCsv = function (file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      let text = new TextDecoder('utf-8').decode(e.target.result);
      if (text.includes('')) text = new TextDecoder('windows-1251').decode(e.target.result);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines.includes(';') && !lines.includes(',') ? ';' : ',';
      const splitCsv = l => {
        const out = []; let cur = '', q = false;
        for (let ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; }
        out.push(cur.trim()); return out;
      };
      const head = splitCsv(lines);
      const wideCostIdx = head.findIndex(h => /итого себестоимость/i.test(h));
      ensureCollections();
      window.cleanBrokenSkuImport();
      const map = new Map(db.sku.map(s => [normBarcode(s.barcode || s.shk || s.id), s]));
      const artPrice = new Map();
      db.sku.forEach(s => { const c = extractModelCode(s.art || s.name); if (c && Number(s.costUsd || s.cost) > 0) artPrice.set(c, Number(s.costUsd || s.cost)); });
      let added = 0, updated = 0;

      const upsert = (rawBc, art, name, cost) => {
        const codes = String(rawBc || '').split(/[,;\s]+/).map(normBarcode).filter(x => x.length >= 2);
        const mCode = extractModelCode(art) || extractModelCode(name) || String(art || '').trim().toUpperCase();
        if (mCode && cost > 0) artPrice.set(mCode, cost);
        if ((!cost || isNaN(cost)) && mCode && artPrice.has(mCode)) cost = artPrice.get(mCode);
        if (!cost || isNaN(cost) || cost > 500) return;
        codes.forEach(bc => {
          const ex = map.get(bc);
          if (ex) { ex.cost = cost; ex.costUsd = cost; if (mCode) ex.art = mCode; if (name) ex.name = name; updated++; }
          else {
            const item = { id: 'sku_' + bc, barcode: bc, shk: bc, art: mCode, name: name || mCode || bc, cost: cost, costUsd: cost, src: 'Импорт CSV' };
            db.sku.push(item); map.set(bc, item); added++;
          }
        });
      };

      if (wideCostIdx >= 2) {
        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsv(lines[i]);
          const cost = parseFloat(String(cols[wideCostIdx] || '').replace(/\s/g, '').replace(',', '.'));
          for (let c = 2; c < wideCostIdx; c++) upsert(cols[c], cols, cols || cols, cost);
        }
      } else {
        const iArt = head.findIndex(h => /артикул|art|модел/i.test(h));
        const iBc = head.findIndex(h => /шк|баркод|barcode|sku|код/i.test(h));
        const iNm = head.findIndex(h => /назв|наим|товар|name/i.test(h));
        const iCost = head.findIndex(h => /себест|cost|usd|цена|\$/i.test(h));
        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsv(lines[i]);
          const cost = iCost >= 0 ? parseFloat(String(cols[iCost] || '').replace(/\s/g, '').replace(',', '.')) : 0;
          upsert(cols[iBc >= 0 ? iBc : 1], cols[iArt >= 0 ? iArt : 0], cols[iNm >= 0 ? iNm : 2], cost);
        }
      }
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function') syncCloud();
      if (typeof render === 'function') render();
      alert(`Готово!\nДобавлено новых ШК: ${added}, обновлено: ${updated}.\nВсего уникальных ШК в справочнике: ${db.sku.length}`);
    };
    reader.readAsArrayBuffer(file);
  };
  window.exportSkuTemplateCsv = function () {
    ensureCollections();
    const rows = ['Артикул продавца;ШК;Название;Себестоимость USD'];
    if (db.sku.length) {
      db.sku.forEach(s => {
        const cost = String(s.costUsd || s.cost || 0).replace('.', ',');
        rows.push(`${s.art || ''};${s.barcode || s.shk || ''};${String(s.name || '').replace(/;/g, ' ')};${cost}`);
      });
    } else {
      rows.push('SKOS-B;2043192743629, OZN861358069, 980377954;Брюки мужские зауженные;6,60');
      rows.push('SKOS-FK;2011159255010;Костюм флисовый;9,80');
    }
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKOS_shablon_sebestoimost.csv';
    a.click();
  };

  window.addSpreadExpense = function (dateStr, orgId, catId, totalAmt, monthsCount, note) {
    ensureCollections();
    const n = Math.max(1, Math.min(36, parseInt(monthsCount, 10) || 1));
    const total = parseFloat(String(totalAmt || '').replace(/\s/g, '').replace(',', '.'));
    if (!total || total <= 0) return false;
    const p = String(dateStr || '01.01.2026').split('.');
    let day = parseInt(p[0], 10) || 1, mo = parseInt(p[1], 10) || 1, yr = parseInt(p[2], 10) || 2026;
    const partAmt = Math.round((total / n) * 100) / 100;
    const batchId = 'spr_' + Date.now();
    for (let i = 0; i < n; i++) {
      const m = ((mo - 1 + i) % 12) + 1;
      const y = yr + Math.floor((mo - 1 + i) / 12);
      const dt = `${String(day).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
      const amt = i === n - 1 ? Math.round((total - partAmt * (n - 1)) * 100) / 100 : partAmt;
      db.expenses.push({ id: batchId + '_' + i, date: dt, org: orgId || '', cat: catId || '', amt: amt, note: `${note || 'РБП'} (${i + 1}/${n})`, batchId: batchId });
    }
    if (typeof save === 'function') save();
    if (typeof syncCloud === 'function') syncCloud();
    if (typeof render === 'function') render();
    return true;
  };

  window.hookSkuAndExpenseUi = function () {
    const impBtn = Array.from(document.querySelectorAll('button, label')).find(b => /импорт.*свод.*себест/i.test(b.textContent || ''));
    if (impBtn && !impBtn.dataset.skosHooked) {
      impBtn.dataset.skosHooked = '1';
      impBtn.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.csv,.txt';
        inp.onchange = () => { if (inp.files[0]) window.parseAnyCostCsv(inp.files[0]); };
        inp.click();
      }, true);
      if (!document.getElementById('skos-tpl-dl-btn')) {
        const dl = document.createElement('button');
        dl.id = 'skos-tpl-dl-btn'; dl.type = 'button'; dl.textContent = '⬇ Шаблон CSV';
        dl.style.cssText = 'margin-left:6px;padding:6px 10px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;';
        dl.onclick = window.exportSkuTemplateCsv;
        impBtn.parentElement.insertBefore(dl, impBtn.nextSibling);
      }
    }
    const catEl = document.getElementById('ex-cat');
    if (catEl && !document.getElementById('skos-spread-exp-panel')) {
      const formRow = catEl.closest('div[style*="grid"], div[style*="flex"], .grid, .row') || catEl.parentElement.parentElement;
      const box = document.createElement('div');
      box.id = 'skos-spread-exp-panel';
      box.style.cssText = 'width:100%;margin:0 0 12px 0;padding:10px 14px;border:1px solid #fde047;border-radius:8px;background:#fefce8;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;box-sizing:border-box;';
      const orgOpts = (db.orgs || []).filter(o => !o.archived).map(o => `<option value="${o.id}">${o.name}</option>`).join('');
      box.innerHTML = `<span style="font-weight:600;color:#854d0e;">📅 Разбить годовой расход (1С / сервисы) на N мес.:</span>
        <input type="text" id="spr-dt" value="01.01.2026" style="width:95px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
        <select id="spr-org" style="padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">${orgOpts}</select>
        <input type="number" id="spr-amt" placeholder="Сумма ₽" style="width:105px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
        <input type="number" id="spr-mo" value="12" min="2" max="36" style="width:60px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
        <input type="text" id="spr-note" placeholder="Комментарий (напр. 1С за год)" style="flex:1;min-width:150px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;">
        <button type="button" onclick="if(window.addSpreadExpense(document.getElementById('spr-dt').value, document.getElementById('spr-org').value, document.getElementById('ex-cat').value, document.getElementById('spr-amt').value, document.getElementById('spr-mo').value, document.getElementById('spr-note').value)) alert('Расход разбит!')" style="padding:6px 14px;background:#ca8a04;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Разбить</button>`;
      formRow.parentElement.insertBefore(box, formRow);
    }
  };

  const prevRender = window.render;
  window.render = function () {
    if (typeof prevRender === 'function') prevRender.apply(this, arguments);
    try { if (typeof window.hookSkuAndExpenseUi === 'function') window.hookSkuAndExpenseUi(); }
    catch (err) { console.error('SKOS patch2 error:', err); }
  };
})();
