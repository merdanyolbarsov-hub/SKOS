/* === SKOS Finance 3.0 — patch2.js (Полная чистая сборка) === */
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

  function detectCategory(name) {
    const n = String(name || '').toLowerCase();
    if (/брюк|штан/.test(n)) return '👖 Брюки и штаны';
    if (/рубаш|поло/.test(n)) return '👔 Рубашки';
    if (/костюм|флис/.test(n)) return '🧥 Костюмы';
    if (/свитер|худи|футболк|топик/.test(n)) return '👕 Свитеры, худи и футболки';
    if (/шапк/.test(n)) return '🧢 Шапки и аксессуары';
    return '📦 Прочие товары';
  }

  window.cleanBrokenSkuImport = function () {
    ensureCollections();
    db.sku = db.sku.filter(s => Number(s.cost || s.costUsd || 0) < 500 && s.src !== 'Импорт Свода');
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
      if (lines.length < 2) return alert('Файл пустой');
      const firstLine = lines.at(0);
      const sep = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      const splitCsv = l => {
        const out = []; let cur = '', q = false;
        for (let ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; }
      const head = splitCsv(firstLine);
      const wideCostIdx = head.findIndex(h => /итого себестоимость/i.test(h));
      ensureCollections();
      window.cleanBrokenSkuImport();
      const map = new Map(db.sku.map(s => [normBarcode(s.barcode || s.shk || s.id), s]));
      let added = 0, updated = 0;

      const upsert = (rawBc, art, name, cost) => {
        const codes = String(rawBc || '').split(/[,;\s]+/).map(normBarcode).filter(x => x.length >= 2);
        const mCode = extractModelCode(art) || extractModelCode(name) || String(art || '').trim().toUpperCase();
        const cleanName = String(name || '').trim() || mCode || 'Без названия';
        const cat = detectCategory(cleanName);
        if (!cost || isNaN(cost) || cost > 500) return;
        codes.forEach(bc => {
          const ex = map.get(bc);
          if (ex) { ex.cost = cost; ex.costUsd = cost; ex.art = mCode; ex.name = cleanName; ex.cat = cat; updated++; }
          else {
            const item = { id: 'sku_' + bc, barcode: bc, shk: bc, art: mCode, name: cleanName, cat: cat, cost: cost, costUsd: cost, src: 'CSV' };
            db.sku.push(item); map.set(bc, item); added++;
          }
        });
      };

      if (wideCostIdx >= 2) {
        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsv(lines.at(i));
          const cost = parseFloat(String(cols.at(wideCostIdx) || '').replace(/\s/g, '').replace(',', '.'));
          const mCode = extractModelCode(cols.at(0)) || extractModelCode(cols.at(1));
          const cleanName = cols.at(1) || cols.at(0) || '';
          for (let c = 2; c < wideCostIdx; c++) upsert(cols.at(c), mCode, cleanName, cost);
        }
      } else {
        const iArt = head.findIndex(h => /артикул|art|модел/i.test(h));
        const iBc = head.findIndex(h => /шк|баркод|barcode|sku|код/i.test(h));
        const iNm = head.findIndex(h => /назв|наим|товар|name/i.test(h));
        const iCost = head.findIndex(h => /себест|cost|usd|цена|\$/i.test(h));
        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsv(lines.at(i));
          const cost = iCost >= 0 ? parseFloat(String(cols.at(iCost) || '').replace(/\s/g, '').replace(',', '.')) : 0;
          upsert(cols.at(iBc >= 0 ? iBc : 1), cols.at(iArt >= 0 ? iArt : 0), cols.at(iNm >= 0 ? iNm : 2), cost);
        }
      }
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function') syncCloud();
      if (typeof render === 'function') render();
      alert(`Готово! Добавлено ШК: ${added}, обновлено: ${updated}.\nВсего уникальных ШК в базе: ${db.sku.length}`);
    };
    reader.readAsArrayBuffer(file);
  };
  window.updateModelCostUsd = function (modelKey, newVal) {
    const val = parseFloat(String(newVal || '').replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    db.sku.forEach(s => {
      const key = (s.art || s.name || '').trim().toUpperCase();
      if (key === modelKey) { s.cost = val; s.costUsd = val; }
    });
    if (typeof save === 'function') save();
    if (typeof syncCloud === 'function') syncCloud();
    if (typeof render === 'function') render();
  };

  window.exportSkuTemplateCsv = function () {
    ensureCollections();
    const rows = ['Артикул продавца;ШК;Название;Себестоимость USD'];
    if (db.sku.length) {
      db.sku.forEach(s => rows.push(`${s.art || ''};${s.barcode || s.shk || ''};${String(s.name || '').replace(/;/g, ' ')};${String(s.costUsd || s.cost || 0).replace('.', ',')}`));
    } else {
      rows.push('SKOS-B;2043192743629, OZN861358069;Брюки мужские зауженные;6,60');
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'SKOS_shablon_sebestoimost.csv'; a.click();
  };

  window.renderSkuFoldersTree = function () {
    const skuTable = document.querySelector('#tb-sku, #sku-table, [data-tab="sku"] table');
    if (!skuTable) return;
    skuTable.style.display = 'none';
    let box = document.getElementById('skos-sku-folders');
    if (!box) { box = document.createElement('div'); box.id = 'skos-sku-folders'; box.style.marginTop = '12px'; skuTable.parentElement.insertBefore(box, skuTable); }
    const rate = typeof getRate === 'function' ? getRate() : 88;
    const cats = new Map();
    db.sku.forEach(s => {
      const cat = s.cat || detectCategory(s.name);
      if (!cats.has(cat)) cats.set(cat, new Map());
      const mKey = (s.art || s.name || 'БЕЗ АРТИКУЛА').trim().toUpperCase();
      const mMap = cats.get(cat);
      if (!mMap.has(mKey)) mMap.set(mKey, { key: mKey, art: s.art || '', name: s.name || mKey, cost: Number(s.costUsd || s.cost || 0), list: [] });
      mMap.get(mKey).list.push(s);
    });
    if (!cats.size) { box.innerHTML = '<div style="padding:14px;color:#64748b;">Справочник пуст — нажмите «Импорт Свод себестоимости (CSV)».</div>'; return; }
    let html = '';
    cats.forEach((mMap, catName) => {
      let totalBc = 0; mMap.forEach(m => totalBc += m.list.length);
      html += `<details open style="margin-bottom:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;overflow:hidden;">
        <summary style="padding:10px 14px;background:#f1f5f9;font-weight:700;cursor:pointer;display:flex;justify-content:space-between;">
          <span>${catName} (${mMap.size} мод.)</span><span style="color:#475569;font-weight:500;">${totalBc} ШК</span>
        </summary><div style="padding:6px 12px;">`;
      mMap.forEach(m => {
        const rub = Math.round(m.cost * rate);
        const bcPreview = m.list.slice(0, 60).map(x => `<span style="display:inline-block;margin:2px;padding:2px 6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;font-family:monospace;font-size:11px;">${x.barcode || x.shk}</span>`).join('');
        html += `<details style="border-bottom:1px solid #f1f5f9;padding:6px 0;">
          <summary style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;">
            <b style="min-width:95px;color:#1e293b;">${m.art || '—'}</b>
            <span style="flex:1;">${m.name}</span>
            <span style="color:#64748b;font-size:12px;">${m.list.length} ШК</span>
            <input type="number" step="0.01" value="${m.cost}" onclick="event.stopPropagation()" onchange="window.updateModelCostUsd('${m.key.replace(/'/g, '')}', this.value)" style="width:72px;padding:3px 6px;border:1px solid #94a3b8;border-radius:4px;text-align:right;font-weight:600;"> $
            <span style="min-width:75px;text-align:right;color:#0f172a;font-weight:600;">${rub} ₽</span>
          </summary><div style="padding:8px 0 4px 12px;">${bcPreview}${m.list.length > 60 ? `<span style="font-size:11px;color:#64748b;"> ...и ещё ${m.list.length - 60} ШК</span>` : ''}</div>
        </details>`;
      });
      html += '</div></details>';
    });
    box.innerHTML = html;
  };

  window.addSpreadExpense = function (dateStr, orgId, catId, totalAmt, monthsCount, note) {
    ensureCollections();
    const n = Math.max(1, Math.min(36, parseInt(monthsCount, 10) || 1));
    const total = parseFloat(String(totalAmt || '').replace(/\s/g, '').replace(',', '.'));
    if (!total || total <= 0) return false;
    const p = String(dateStr || '01.01.2026').split('.');
    let day = parseInt(p.at(0), 10) || 1, mo = parseInt(p.at(1), 10) || 1, yr = parseInt(p.at(2), 10) || 2026;
    const partAmt = Math.round((total / n) * 100) / 100, batchId = 'spr_' + Date.now();
    for (let i = 0; i < n; i++) {
      const m = ((mo - 1 + i) % 12) + 1, y = yr + Math.floor((mo - 1 + i) / 12);
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
    if (impBtn && !impBtn.dataset.skosReplaced) {
      const cleanBtn = document.createElement('button');
      cleanBtn.type = 'button'; cleanBtn.dataset.skosReplaced = '1'; cleanBtn.className = impBtn.className;
      cleanBtn.style.cssText = impBtn.style.cssText + ';cursor:pointer;';
      cleanBtn.textContent = '📥 Импорт «Свод себестоимости» (CSV)';
      cleanBtn.onclick = function () {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.txt';
        inp.onchange = function () { const f = this.files && this.files.item(0); if (f) window.parseAnyCostCsv(f); };
        inp.click();
      };
      impBtn.replaceWith(cleanBtn);
      if (!document.getElementById('skos-tpl-dl-btn')) {
        const dl = document.createElement('button'); dl.id = 'skos-tpl-dl-btn'; dl.type = 'button'; dl.textContent = '⬇ Шаблон CSV';
        dl.style.cssText = 'margin-left:6px;padding:6px 10px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;';
        dl.onclick = window.exportSkuTemplateCsv; cleanBtn.parentElement.insertBefore(dl, cleanBtn.nextSibling);
      }
    }
    const catEl = document.getElementById('ex-cat');
    if (catEl && !document.getElementById('skos-spread-exp-panel')) {
      const formRow = catEl.closest('div[style*="grid"], div[style*="flex"], .grid, .row') || catEl.parentElement.parentElement;
      const box = document.createElement('div'); box.id = 'skos-spread-exp-panel';
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
    try {
      if (typeof window.hookSkuAndExpenseUi === 'function') window.hookSkuAndExpenseUi();
      if (typeof window.renderSkuFoldersTree === 'function') window.renderSkuFoldersTree();
    } catch (err) { console.error('SKOS patch2 error:', err); }
  };
})();
