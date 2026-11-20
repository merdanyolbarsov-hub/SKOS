(function () {
  if (window.__skosPatch4CleanLoaded) return;
  window.__skosPatch4CleanLoaded = true;

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  function persistAll() {
    if (typeof save === 'function') save();
    else if (window.db) localStorage.setItem('skos_v3_prod', JSON.stringify(window.db));
  }

  function ensureErp() {
    if (!window.db) window.db = {};
    if (!window.db.erp) window.db.erp = {};
    const e = window.db.erp;
    if (!Array.isArray(e.materials)) {
      e.materials = [
        { id: 'm1', name: 'Двунитка 240 гр', unit: 'кг', cat: 'Ткань' },
        { id: 'm2', name: 'Кашкорсе', unit: 'кг', cat: 'Ткань' },
        { id: 'm3', name: 'Нитки 40/2', unit: 'кат', cat: 'Фурнитура' },
        { id: 'm4', name: 'Резинка 4 см', unit: 'м', cat: 'Фурнитура' },
        { id: 'm5', name: 'Шнурок с наконечником', unit: 'шт', cat: 'Фурнитура' },
        { id: 'm6', name: 'Замок тракторный', unit: 'шт', cat: 'Фурнитура' },
        { id: 'm7', name: 'Бирка размерник + составник', unit: 'шт', cat: 'Упаковка и бирки' },
        { id: 'm8', name: 'Пакет зип-лок с лого', unit: 'шт', cat: 'Упаковка и бирки' }
      ];
    }
    if (!Array.isArray(e.matIn)) e.matIn = [];
    if (!Array.isArray(e.orders)) e.orders = [];
    if (!Array.isArray(e.bom)) e.bom = [];
    if (!Array.isArray(e.fgStocks)) e.fgStocks = [];
    if (!Array.isArray(e.defects)) e.defects = [];
    if (!Array.isArray(e.suppliers)) e.suppliers = [];
    if (!Array.isArray(e.unitEcon)) e.unitEcon = [];
    if (!e.subTab) e.subTab = 'sum';
    return e;
  }

  // Единый справочник моделей: объединяет db.skus (Каталог товаров) и Техкарты (db.erp.bom)
  function getUnifiedModels() {
    const e = ensureErp();
    const map = new Map();
    if (window.db && Array.isArray(window.db.skus)) {
      window.db.skus.forEach(s => {
        if (s && s.name) {
          const k = String(s.name).trim();
          map.set(k.toLowerCase(), { name: k, art: s.art || '', skuUsd: Number(s.usd) || 0 });
        }
      });
    }
    (e.bom || []).forEach(b => {
      if (b && b.product) {
        const k = String(b.product).trim();
        const bomUsd = (b.items || []).reduce((acc, it) => acc + (Number(it.norm) || 0) * (Number(it.priceUsd) || 0), 0);
        const prev = map.get(k.toLowerCase()) || { name: k, art: '', skuUsd: 0 };
        map.set(k.toLowerCase(), { name: k, art: prev.art, skuUsd: bomUsd || prev.skuUsd, hasBom: true });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  function getModelCostUsd(modelName) {
    const e = ensureErp();
    const bom = (e.bom || []).find(b => b.product.toLowerCase() === String(modelName || '').trim().toLowerCase());
    if (bom && Array.isArray(bom.items) && bom.items.length) {
      return bom.items.reduce((s, it) => s + (Number(it.norm) || 0) * (Number(it.priceUsd) || 0), 0);
    }
    const sku = (window.db?.skus || []).find(s => String(s.name || '').trim().toLowerCase() === String(modelName || '').trim().toLowerCase());
    return sku ? (Number(sku.usd) || 0) : 0;
  }

  // Кнопка «📤 Вытащить из архива» в разделе «Юрлица, Банки и Облако» (tab-set)
  window.unarchiveEntityItem = function () {
    if (!window.db) return;
    const archivedOrgs = (window.db.orgs || []).filter(o => o.archived || o.isArchived || o.hidden);
    const archivedWallets = (window.db.cashWallets || []).filter(c => c.archived || c.isArchived || c.hidden);
    const allArchived = [
      ...archivedOrgs.map((o, i) => ({ kind: 'org', obj: o, label: `Юрлицо: ${o.name} (${o.bank || ''})` })),
      ...archivedWallets.map((c, i) => ({ kind: 'wal', obj: c, label: `Касса/счёт: ${c.name} (${c.cur || 'RUB'})` }))
    ];
    if (!allArchived.length) {
      alert('В архиве сейчас нет скрытых юрлиц или счетов.');
      return;
    }
    const listStr = allArchived.map((it, idx) => `${idx + 1}. ${it.label}`).join('\n');
    const ans = prompt(`Выберите номер записи, которую нужно ВЫТАЩИТЬ ИЗ АРХИВА:\n\n${listStr}`, '1');
    if (!ans) return;
    const pick = allArchived[Number(ans) - 1];
    if (!pick) return alert('Неверный номер.');
    delete pick.obj.archived;
    delete pick.obj.isArchived;
    delete pick.obj.hidden;
    persistAll();
    if (typeof render === 'function') render();
    alert(`✅ Восстановлено из архива: ${pick.label}`);
  };

  function injectUnarchiveButton() {
    const setSec = document.getElementById('tab-set');
    if (!setSec || document.getElementById('p4-unarchive-btn')) return;
    const archBtn = Array.from(setSec.querySelectorAll('button')).find(b => (b.textContent || '').toLowerCase().includes('архив'));
    const btn = document.createElement('button');
    btn.id = 'p4-unarchive-btn';
    btn.type = 'button';
    btn.className = 'btn';
    btn.style.marginLeft = '6px';
    btn.textContent = '📤 Вытащить из архива';
    btn.onclick = window.unarchiveEntityItem;
    if (archBtn && archBtn.parentNode) archBtn.parentNode.insertBefore(btn, archBtn.nextSibling);
    else {
      const hdr = setSec.querySelector('.card-header, .card');
      if (hdr) hdr.appendChild(btn);
    }
  }
  // --- РАСЧЁТ ОСТАТКОВ СЫРЬЯ, НЗП И ГОТОВОГО ТОВАРА ---
  function calcStockBalances() {
    const e = ensureErp();
    const map = {};
    (e.materials || []).forEach(m => {
      map[m.name] = { name: m.name, unit: m.unit || 'шт', cat: m.cat || 'Сырьё', inQty: 0, inUsd: 0, outQty: 0, avgUsd: 0, balQty: 0, balUsd: 0 };
    });
    (e.matIn || []).forEach(r => {
      if (r.matName === 'Пошив одежды') return;
      if (!map[r.matName]) map[r.matName] = { name: r.matName, unit: 'шт', cat: 'Сырьё', inQty: 0, inUsd: 0, outQty: 0, avgUsd: 0, balQty: 0, balUsd: 0 };
      map[r.matName].inQty += Number(r.qty) || 0;
      map[r.matName].inUsd += Number(r.totalUsd) || 0;
    });
    Object.values(map).forEach(x => { x.avgUsd = x.inQty > 0 ? x.inUsd / x.inQty : 0; });
    (e.orders || []).forEach(o => {
      (o.lines || []).forEach(l => {
        if (l.matName === 'Пошив одежды') return;
        if (!map[l.matName]) map[l.matName] = { name: l.matName, unit: 'шт', cat: 'Сырьё', inQty: 0, inUsd: 0, outQty: 0, avgUsd: Number(l.priceUsd) || 0, balQty: 0, balUsd: 0 };
        map[l.matName].outQty += Number(l.qty) || 0;
      });
    });
    let rawUsd = 0;
    Object.values(map).forEach(x => {
      x.balQty = Math.max(0, x.inQty - x.outQty);
      x.balUsd = x.balQty * x.avgUsd;
      rawUsd += x.balUsd;
    });
    const wipUsd = (e.orders || []).filter(o => o.status === 'WIP').reduce((s, o) => s + (Number(o.totalUsd) || 0), 0);
    const fgUsd = (e.fgStocks || []).reduce((s, r) => s + ((Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0)) * (Number(r.unitUsd) || 0), 0);
    const defUsd = (e.defects || []).reduce((s, d) => s + (Number(d.qty) || 0) * (Number(d.unitUsd) || 0), 0);
    return { map, rawUsd, wipUsd, fgUsd, defUsd, totalUsd: rawUsd + wipUsd + fgUsd };
  }

  window.setStkSubTab = function (st) { ensureErp().subTab = st; persistAll(); renderStkTab(); };

  window.addMaterialRow = function (ev) {
    ev.preventDefault();
    const e = ensureErp();
    const name = document.getElementById('p4-mat-name').value.trim();
    const unit = document.getElementById('p4-mat-unit').value.trim() || 'шт';
    const cat = document.getElementById('p4-mat-cat').value;
    if (!name) return;
    if (e.materials.some(m => m.name.toLowerCase() === name.toLowerCase())) return alert('Такой материал уже есть.');
    e.materials.push({ id: 'm_' + Date.now(), name, unit, cat });
    persistAll(); renderStkTab();
  };
  window.editMaterialRow = function (idx) {
    const m = ensureErp().materials[idx]; if (!m) return;
    const n = prompt('Название материала / фурнитуры:', m.name); if (!n) return;
    const u = prompt('Ед. измерения (кг, м, шт, кат):', m.unit); if (u === null) return;
    const c = prompt('Категория (Ткань, Фурнитура, Упаковка и бирки):', m.cat); if (c === null) return;
    m.name = n.trim(); m.unit = u.trim() || 'шт'; m.cat = c.trim() || 'Сырьё';
    persistAll(); renderStkTab();
  };
  window.delMaterialRow = function (idx) {
    if (!confirm('Удалить этот материал?')) return;
    ensureErp().materials.splice(idx, 1); persistAll(); renderStkTab();
  };

  window.addMatInRow = function (ev) {
    ev.preventDefault();
    const e = ensureErp();
    const date = document.getElementById('p4-in-date').value;
    const matName = document.getElementById('p4-in-mat').value;
    const qty = Number(document.getElementById('p4-in-qty').value) || 0;
    const priceUsd = Number(document.getElementById('p4-in-price').value) || 0;
    const supplier = document.getElementById('p4-in-sup').value.trim() || 'Поставщик / ДДС';
    if (!matName || qty <= 0) return;
    e.matIn.unshift({ id: 'in_' + Date.now(), date, matName, qty, priceUsd, totalUsd: qty * priceUsd, supplier });
    persistAll(); renderStkTab();
  };
  window.editMatInRow = function (idx) {
    const r = ensureErp().matIn[idx]; if (!r) return;
    const qty = Number(prompt('Количество:', r.qty)); if (!qty || qty <= 0) return;
    const pr = Number(prompt('Цена за 1 ед. ($):', r.priceUsd)); if (isNaN(pr) || pr < 0) return;
    const sup = prompt('Поставщик / Примечание:', r.supplier || ''); if (sup === null) return;
    r.qty = qty; r.priceUsd = pr; r.totalUsd = qty * pr; r.supplier = sup.trim();
    persistAll(); renderStkTab();
  };
  window.delMatInRow = function (idx) {
    if (!confirm('Удалить запись прихода?')) return;
    ensureErp().matIn.splice(idx, 1); persistAll(); renderStkTab();
  };
  window.addBomLine = function (ev) {
    ev.preventDefault();
    const e = ensureErp();
    const prod = document.getElementById('p4-bom-prod').value.trim();
    const matName = document.getElementById('p4-bom-mat').value;
    const norm = Number(document.getElementById('p4-bom-norm').value) || 0;
    const priceUsd = Number(document.getElementById('p4-bom-price').value) || 0;
    if (!prod || !matName || norm <= 0) return;
    let bom = e.bom.find(b => b.product.toLowerCase() === prod.toLowerCase());
    if (!bom) { bom = { product: prod, items: [] }; e.bom.push(bom); }
    const ex = bom.items.find(x => x.matName === matName);
    if (ex) { ex.norm = norm; ex.priceUsd = priceUsd; }
    else bom.items.push({ matName, norm, priceUsd });
    persistAll(); renderStkTab();
  };
  window.editBomLine = function (bIdx, iIdx) {
    const it = ensureErp().bom[bIdx]?.items[iIdx]; if (!it) return;
    const n = Number(prompt(`Норма расхода для «${it.matName}» на 1 шт.:`, it.norm)); if (!n || n <= 0) return;
    const p = Number(prompt(`Цена за 1 ед. ($) для «${it.matName}»:`, it.priceUsd)); if (isNaN(p) || p < 0) return;
    it.norm = n; it.priceUsd = p; persistAll(); renderStkTab();
  };
  window.delBomLine = function (bIdx, iIdx) {
    if (!confirm('Удалить позицию из техкарты?')) return;
    const e = ensureErp();
    e.bom[bIdx].items.splice(iIdx, 1);
    if (!e.bom[bIdx].items.length) e.bom.splice(bIdx, 1);
    persistAll(); renderStkTab();
  };
  window.delWholeBom = function (bIdx) {
    const b = ensureErp().bom[bIdx];
    if (!b || !confirm(`Удалить всю техкарту модели «${b.product}»?`)) return;
    ensureErp().bom.splice(bIdx, 1); persistAll(); renderStkTab();
  };

  window.startSewOrder = function (ev) {
    ev.preventDefault();
    const e = ensureErp();
    const date = document.getElementById('p4-ord-date').value;
    const product = document.getElementById('p4-ord-prod').value;
    const qty = Number(document.getElementById('p4-ord-qty').value) || 0;
    const comment = document.getElementById('p4-ord-com').value.trim();
    if (!product || qty <= 0) return;
    const bom = e.bom.find(b => b.product.toLowerCase() === product.toLowerCase());
    if (!bom || !bom.items.length) {
      alert(`Для модели «${product}» ещё не создана техкарта! Заполните её ниже в конструкторе техкарт.`);
      document.getElementById('p4-bom-prod').value = product;
      return;
    }
    const { map } = calcStockBalances();
    let totalUsd = 0;
    const lines = bom.items.map(bi => {
      const mQty = (Number(bi.norm) || 0) * qty;
      const uUsd = (map[bi.matName] && map[bi.matName].avgUsd > 0) ? map[bi.matName].avgUsd : (Number(bi.priceUsd) || 0);
      totalUsd += mQty * uUsd;
      return { matName: bi.matName, qty: mQty, priceUsd: uUsd, totalUsd: mQty * uUsd };
    });
    e.orders.unshift({ id: 'ord_' + Date.now(), date, doneDate: '', status: 'WIP', product, qty, totalUsd, comment: comment || `Пошив ${product} (${qty} шт.)`, lines });
    persistAll(); renderStkTab();
  };
  window.editSewOrder = function (idx) {
    const o = ensureErp().orders[idx]; if (!o) return;
    const q = Number(prompt('Изменить количество штук в партии:', o.qty)); if (!q || q <= 0) return;
    const ratio = q / (o.qty || 1);
    o.qty = q; o.totalUsd = o.totalUsd * ratio;
    (o.lines || []).forEach(l => { l.qty *= ratio; l.totalUsd *= ratio; });
    const c = prompt('Комментарий к заказу:', o.comment || ''); if (c !== null) o.comment = c;
    persistAll(); renderStkTab();
  };
  window.finishSewOrder = function (idx) {
    const e = ensureErp();
    const o = e.orders[idx]; if (!o) return;
    const d = prompt('Дата готовности партии (ГГГГ-ММ-ДД):', new Date().toISOString().slice(0, 10)); if (!d) return;
    o.status = 'DONE'; o.doneDate = d;
    const uUsd = o.qty > 0 ? o.totalUsd / o.qty : getModelCostUsd(o.product);
    let fg = e.fgStocks.find(x => x.product.toLowerCase() === o.product.toLowerCase());
    if (!fg) { fg = { id: 'fg_' + Date.now(), product: o.product, ruQty: 0, tmQty: 0, wayQty: 0, unitUsd: uUsd }; e.fgStocks.push(fg); }
    fg.tmQty = (Number(fg.tmQty) || 0) + Number(o.qty);
    fg.unitUsd = uUsd || fg.unitUsd;
    persistAll(); renderStkTab();
    alert(`✅ Партия ${o.qty} шт. «${o.product}» переведена из НЗП на склад готовой продукции (Туркменистан).`);
  };
  window.delSewOrder = function (idx) {
    if (!confirm('Удалить заказ? Списанные по нему материалы вернутся на остаток склада.')) return;
    ensureErp().orders.splice(idx, 1); persistAll(); renderStkTab();
  };

  window.saveFgStockRow = function (ev) {
    ev.preventDefault();
    const e = ensureErp();
    const product = document.getElementById('p4-fg-prod').value.trim();
    const ruQty = Number(document.getElementById('p4-fg-ru').value) || 0;
    const tmQty = Number(document.getElementById('p4-fg-tm').value) || 0;
    const wayQty = Number(document.getElementById('p4-fg-way').value) || 0;
    const unitUsd = Number(document.getElementById('p4-fg-usd').value) || getModelCostUsd(product);
    if (!product) return;
    let row = e.fgStocks.find(x => x.product.toLowerCase() === product.toLowerCase());
    if (row) { row.ruQty = ruQty; row.tmQty = tmQty; row.wayQty = wayQty; row.unitUsd = unitUsd; }
    else e.fgStocks.push({ id: 'fg_' + Date.now(), product, ruQty, tmQty, wayQty, unitUsd });
    persistAll(); renderStkTab();
  };
  window.editFgStockRow = function (idx) {
    const r = ensureErp().fgStocks[idx]; if (!r) return;
    const ru = Number(prompt('Остаток РФ (шт.):', r.ruQty)); if (isNaN(ru) || ru < 0) return;
    const tm = Number(prompt('Остаток Туркменистан (шт.):', r.tmQty)); if (isNaN(tm) || tm < 0) return;
    const way = Number(prompt('В пути (шт.):', r.wayQty)); if (isNaN(way) || way < 0) return;
    const usd = Number(prompt('Себестоимость 1 шт. ($):', r.unitUsd)); if (isNaN(usd) || usd < 0) return;
    r.ruQty = ru; r.tmQty = tm; r.wayQty = way; r.unitUsd = usd;
    persistAll(); renderStkTab();
  };
  window.delFgStockRow = function (idx) {
    if (!confirm('Удалить остаток этой модели?')) return;
    ensureErp().fgStocks.splice(idx, 1); persistAll(); renderStkTab();
  };

  window.addDefectRow = function (ev) {
    ev.preventDefault();
    const e = ensureErp();
    const date = document.getElementById('p4-def-date').value;
    const product = document.getElementById('p4-def-prod').value.trim();
    const qty = Number(document.getElementById('p4-def-qty').value) || 0;
    const reason = document.getElementById('p4-def-rsn').value.trim() || 'Производственный брак';
    if (!product || qty <= 0) return;
    const unitUsd = getModelCostUsd(product);
    e.defects.unshift({ id: 'def_' + Date.now(), date, product, qty, unitUsd, reason });
    persistAll(); renderStkTab();
  };
  window.editDefectRow = function (idx) {
    const d = ensureErp().defects[idx]; if (!d) return;
    const q = Number(prompt('Количество брака (шт.):', d.qty)); if (!q || q <= 0) return;
    const r = prompt('Причина брака:', d.reason || ''); if (r === null) return;
    d.qty = q; d.reason = r.trim();
    persistAll(); renderStkTab();
  };
  window.delDefectRow = function (idx) {
    if (!confirm('Удалить запись о браке?')) return;
    ensureErp().defects.splice(idx, 1); persistAll(); renderStkTab();
  };
  // --- ОТРИСОВКА ВКЛАДКИ «ЗАПАСЫ, БРАК И ФУРНИТУРА» (tab-stk) ---
  function renderStkTab() {
    const sec = document.getElementById('tab-stk');
    if (!sec) return;
    const e = ensureErp();
    const st = e.subTab || 'sum';
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const bal = calcStockBalances();
    const models = getUnifiedModels();

    const kFrz = document.getElementById('k-frz');
    const kFrzU = document.getElementById('k-frz-u');
    if (kFrz) kFrz.textContent = fmtR(bal.totalUsd * rate);
    if (kFrzU) kFrzU.textContent = `${fmtU(bal.totalUsd)} (Сырьё: ${fmtU(bal.rawUsd)} • НЗП: ${fmtU(bal.wipUsd)} • Товар: ${fmtU(bal.fgUsd)})`;

    const modelDatalist = `<datalist id="p4-models-dl">${models.map(m => `<option value="${m.name}">`).join('')}</datalist>`;
    const modelSelectOpts = models.map(m => `<option value="${m.name}">${m.name}${m.hasBom ? ' ✅' : ' (нет техкарты)'}</option>`).join('');
    const matSelectOpts = (e.materials || []).map(m => `<option value="${m.name}">${m.name} (${m.unit})</option>`).join('');
    const bomMatOpts = ['<option value="Пошив одежды">Пошив одежды (работа фабрики)</option>'].concat(matSelectOpts);

    const tabsNav = [
      { id: 'sum', lbl: '📊 Свод запасов' },
      { id: 'mat', lbl: '🧵 Материалы и фурнитура' },
      { id: 'in',  lbl: '📥 Приход сырья' },
      { id: 'sew', lbl: '✂️ Пошив / НЗП и Техкарты' },
      { id: 'fg',  lbl: '📦 Готовый товар и ⚠️ Брак' }
    ].map(t => `<button type="button" class="btn ${st === t.id ? 'btn-primary' : ''}" onclick="setStkSubTab('${t.id}')">${t.lbl}</button>`).join('');

    let bodyHtml = '';
    if (st === 'sum') {
      bodyHtml = `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#1e40af">
          ℹ️ <b>Как работает раздел:</b> Суммируются остатки сырья/фурнитуры, заказы в пошиве (НЗП) и готовый товар (РФ/ТМ/путь). Итог сам передаётся в карточку «Заморожено в запасах» на Сводке.
        </div>
        <div class="kpi-grid" style="margin-bottom:12px">
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Сырьё и фурнитура</div><div class="kpi-val">${fmtU(bal.rawUsd)}</div><div class="kpi-sub">${fmtR(bal.rawUsd * rate)}</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">В пошиве (НЗП)</div><div class="kpi-val" style="color:#d97706">${fmtU(bal.wipUsd)}</div><div class="kpi-sub">${fmtR(bal.wipUsd * rate)}</div></div>
          <div class="kpi-card"><div style="font-size:11px;color:#64748b">Готовый товар (РФ+ТМ+Путь)</div><div class="kpi-val" style="color:#0284c7">${fmtU(bal.fgUsd)}</div><div class="kpi-sub">${fmtR(bal.fgUsd * rate)}</div></div>
          <div class="kpi-card highlight"><div style="font-size:11px;color:#1d4ed8;font-weight:700">ИТОГО ЗАМОРОЖЕНО</div><div class="kpi-val text-green">${fmtU(bal.totalUsd)}</div><div class="kpi-sub">${fmtR(bal.totalUsd * rate)}</div></div>
        </div>
      `;
    } else if (st === 'mat') {
      bodyHtml = `
        <form onsubmit="addMaterialRow(event)" class="form-grid" style="grid-template-columns:2fr 1fr 1.5fr auto;gap:8px;margin-bottom:12px">
          <div><label>Название материала / фурнитуры</label><input id="p4-mat-name" class="input" required placeholder="Напр: Футер 3-нитка"></div>
          <div><label>Ед. изм.</label><input id="p4-mat-unit" class="input" value="кг" required></div>
          <div><label>Категория</label><select id="p4-mat-cat" class="select"><option>Ткань</option><option>Фурнитура</option><option>Упаковка и бирки</option></select></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Добавить</button></div>
        </form>
        <table>
          <thead><tr><th>Материал / Фурнитура</th><th>Категория</th><th>Ед.</th><th class="num">Приход</th><th class="num">Расход</th><th class="num">Остаток</th><th class="num">Ср. цена ($)</th><th class="num">Сумма ($)</th><th>Действия</th></tr></thead>
          <tbody>
            ${(e.materials || []).map((m, idx) => {
              const b = bal.map[m.name] || { inQty: 0, outQty: 0, balQty: 0, avgUsd: 0, balUsd: 0 };
              return `<tr>
                <td class="bold">${m.name}</td><td>${m.cat}</td><td>${m.unit}</td>
                <td class="num">${b.inQty.toFixed(2)}</td><td class="num">${b.outQty.toFixed(2)}</td>
                <td class="num bold">${b.balQty.toFixed(2)}</td><td class="num">${fmtU(b.avgUsd)}</td><td class="num bold">${fmtU(b.balUsd)}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="btn" style="padding:2px 6px" onclick="editMaterialRow(${idx})">✏️</button>
                  <button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="delMaterialRow(${idx})">✕</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    } else if (st === 'in') {
      bodyHtml = `
        <form onsubmit="addMatInRow(event)" class="form-grid" style="grid-template-columns:1fr 2fr 1fr 1fr 1.5fr auto;gap:8px;margin-bottom:12px">
          <div><label>Дата</label><input id="p4-in-date" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Материал</label><select id="p4-in-mat" class="select" required>${matSelectOpts}</select></div>
          <div><label>Кол-во</label><input id="p4-in-qty" type="number" step="0.01" class="input" required placeholder="500"></div>
          <div><label>Цена ($)</label><input id="p4-in-price" type="number" step="0.001" class="input" required placeholder="4.20"></div>
          <div><label>Поставщик / Примечание</label><input id="p4-in-sup" class="input" placeholder="Турция / ДДС"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Оприходовать</button></div>
        </form>
        <table>
          <thead><tr><th>Дата</th><th>Материал</th><th class="num">Кол-во</th><th class="num">Цена ($)</th><th class="num">Итого ($)</th><th>Поставщик</th><th>Действия</th></tr></thead>
          <tbody>
            ${(e.matIn || []).map((r, idx) => `<tr>
              <td>${r.date}</td><td class="bold">${r.matName}</td><td class="num">${r.qty}</td>
              <td class="num">${fmtU(r.priceUsd)}</td><td class="num bold">${fmtU(r.totalUsd)}</td><td>${r.supplier || ''}</td>
              <td style="white-space:nowrap">
                <button type="button" class="btn" style="padding:2px 6px" onclick="editMatInRow(${idx})">✏️</button>
                <button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="delMatInRow(${idx})">✕</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:12px">Приходов пока нет</td></tr>'}
          </tbody>
        </table>
      `;
    } else if (st === 'sew') {
      const bomListHtml = (e.bom || []).map((b, bIdx) => {
        const uCost = (b.items || []).reduce((s, it) => s + (Number(it.norm) || 0) * (Number(it.priceUsd) || 0), 0);
        return `
          <details open style="border:1px solid #cbd5e1;border-radius:8px;background:#fff;margin-bottom:8px;padding:8px 10px">
            <summary style="cursor:pointer;font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center">
              <span>▶ ${b.product} — <span style="color:#0369a1">Себестоимость: ${fmtU(uCost)}</span> (${(b.items || []).length} поз.)</span>
              <span style="display:flex;gap:6px">
                <button type="button" class="btn" style="padding:2px 8px;font-size:11.5px" onclick="event.preventDefault();document.getElementById('p4-bom-prod').value='${b.product.replace(/'/g, "\\'")}'">➕ Позицию</button>
                <button type="button" class="btn btn-danger" style="padding:2px 8px;font-size:11.5px" onclick="event.preventDefault();delWholeBom(${bIdx})">🗑️ Удалить техкарту</button>
              </span>
            </summary>
            <table style="margin-top:8px;font-size:12px">
              <thead><tr><th>Материал / Работа</th><th class="num">Норма на 1 шт.</th><th class="num">Цена ед. ($)</th><th class="num">Итого на 1 шт. ($)</th><th>Действия</th></tr></thead>
              <tbody>
                ${(b.items || []).map((it, iIdx) => `<tr>
                  <td class="bold">${it.matName}</td>
                  <td class="num">${it.norm}</td>
                  <td class="num">${fmtU(it.priceUsd)}</td>
                  <td class="num bold">${fmtU((Number(it.norm) || 0) * (Number(it.priceUsd) || 0))}</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="btn" style="padding:2px 6px" title="Изменить" onclick="editBomLine(${bIdx},${iIdx})">✏️</button>
                    <button type="button" class="btn btn-danger" style="padding:2px 6px" title="Удалить" onclick="delBomLine(${bIdx},${iIdx})">✕</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </details>
        `;
      }).join('') || '<div style="color:#64748b;font-size:12px">Техкарт пока нет. Выберите модель выше и добавьте материалы.</div>';

      bodyHtml = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-bottom:12px">
          <div style="font-weight:800;font-size:13px;color:#92400e;margin-bottom:6px">✂️ Запустить заказ в пошив (авто-списание материалов по техкарте)</div>
          <form onsubmit="startSewOrder(event)" class="form-grid" style="grid-template-columns:1fr 2fr 1fr 2fr auto;gap:8px">
            <div><label>Дата запуска</label><input id="p4-ord-date" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
            <div><label>Модель (все товары и техкарты)</label><select id="p4-ord-prod" class="select" required>${modelSelectOpts}</select></div>
            <div><label>Кол-во (шт.)</label><input id="p4-ord-qty" type="number" class="input" required placeholder="1000"></div>
            <div><label>Комментарий</label><input id="p4-ord-com" class="input" placeholder="Цех Туркменистан"></div>
            <div style="align-self:end"><button type="submit" class="btn btn-primary">⚙️ Запустить</button></div>
          </form>
        </div>
        <table style="margin-bottom:16px">
          <thead><tr><th>Дата</th><th>Статус</th><th>Модель</th><th class="num">Шт.</th><th class="num">Себест. 1 шт.</th><th class="num">Итого ($)</th><th>Комментарий</th><th>Действия</th></tr></thead>
          <tbody>
            ${(e.orders || []).map((o, idx) => `<tr>
              <td>${o.date}</td>
              <td>${o.status === 'WIP' ? '<span class="badge badge-amber">⏳ В пошиве (НЗП)</span>' : `<span class="badge badge-green">✅ Готов (${o.doneDate})</span>`}</td>
              <td class="bold">${o.product}</td><td class="num bold">${o.qty}</td>
              <td class="num">${fmtU(o.qty > 0 ? o.totalUsd / o.qty : 0)}</td><td class="num bold">${fmtU(o.totalUsd)}</td>
              <td style="font-size:11.5px">${o.comment || ''}</td>
              <td style="white-space:nowrap">
                ${o.status === 'WIP' ? `<button type="button" class="btn btn-success" style="padding:2px 7px" onclick="finishSewOrder(${idx})">✅ Выполнен</button>` : ''}
                <button type="button" class="btn" style="padding:2px 6px" onclick="editSewOrder(${idx})">✏️</button>
                <button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="delSewOrder(${idx})">✕</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:10px">Заказов пока нет</td></tr>'}
          </tbody>
        </table>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;background:#f8fafc">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px">📐 Конструктор техкарт (Нормы расхода на 1 изделие)</div>
          <form onsubmit="addBomLine(event)" class="form-grid" style="grid-template-columns:2fr 2fr 1fr 1fr auto;gap:8px;margin-bottom:10px">
            <div><label>Модель (выберите из списка или впишите)</label><input id="p4-bom-prod" class="input" list="p4-models-dl" required placeholder="Выберите или введите модель..."></div>
            <div><label>Материал / Работа</label><select id="p4-bom-mat" class="select" required>${bomMatOpts}</select></div>
            <div><label>Норма на 1 шт.</label><input id="p4-bom-norm" type="number" step="0.0001" class="input" required placeholder="0.45"></div>
            <div><label>Цена ед. ($)</label><input id="p4-bom-price" type="number" step="0.0001" class="input" required placeholder="4.50"></div>
            <div style="align-self:end"><button type="submit" class="btn btn-primary">+ В техкарту</button></div>
          </form>
          ${bomListHtml}
        </div>
      `;
    } else if (st === 'fg') {
      bodyHtml = `
        <div style="font-weight:800;font-size:13px;margin-bottom:6px">📦 Остатки готовой продукции по складам (РФ / Туркменистан / В пути)</div>
        <form onsubmit="saveFgStockRow(event)" class="form-grid" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:12px">
          <div><label>Модель товара</label><input id="p4-fg-prod" class="input" list="p4-models-dl" required placeholder="Выберите модель..."></div>
          <div><label>Склад РФ (шт.)</label><input id="p4-fg-ru" type="number" class="input" value="0"></div>
          <div><label>Склад ТМ (шт.)</label><input id="p4-fg-tm" type="number" class="input" value="0"></div>
          <div><label>В пути (шт.)</label><input id="p4-fg-way" type="number" class="input" value="0"></div>
          <div><label>Себест. ($/шт.)</label><input id="p4-fg-usd" type="number" step="0.01" class="input" placeholder="Авто из техкарты"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">💾 Сохранить</button></div>
        </form>
        <table style="margin-bottom:16px">
          <thead><tr><th>Модель</th><th class="num">РФ</th><th class="num">Туркменистан</th><th class="num">В пути</th><th class="num">Всего шт.</th><th class="num">Себест. ($)</th><th class="num">Сумма ($)</th><th>Действия</th></tr></thead>
          <tbody>
            ${(e.fgStocks || []).map((r, idx) => {
              const tot = (Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0);
              return `<tr>
                <td class="bold">${r.product}</td><td class="num">${r.ruQty}</td><td class="num">${r.tmQty}</td><td class="num">${r.wayQty}</td>
                <td class="num bold">${tot}</td><td class="num">${fmtU(r.unitUsd)}</td><td class="num bold">${fmtU(tot * (Number(r.unitUsd) || 0))}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="btn" style="padding:2px 6px" onclick="editFgStockRow(${idx})">✏️</button>
                  <button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="delFgStockRow(${idx})">✕</button>
                </td>
              </tr>`;
            }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:10px">Остатков готового товара пока нет</td></tr>'}
          </tbody>
        </table>
        <div style="font-weight:800;font-size:13px;color:#b91c1c;margin-bottom:6px">⚠️ Журнал производственного и складского брака</div>
        <form onsubmit="addDefectRow(event)" class="form-grid" style="grid-template-columns:1fr 2fr 1fr 2fr auto;gap:8px;margin-bottom:10px">
          <div><label>Дата</label><input id="p4-def-date" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Модель товара</label><input id="p4-def-prod" class="input" list="p4-models-dl" required placeholder="Выберите модель..."></div>
          <div><label>Кол-во брака</label><input id="p4-def-qty" type="number" class="input" required placeholder="5"></div>
          <div><label>Причина</label><input id="p4-def-rsn" class="input" placeholder="Брак ткани / фурнитуры"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-danger">+ Списать брак</button></div>
        </form>
        <table>
          <thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт.</th><th class="num">Убыток ($)</th><th>Причина</th><th>Действия</th></tr></thead>
          <tbody>
            ${(e.defects || []).map((d, idx) => `<tr>
              <td>${d.date}</td><td class="bold">${d.product}</td><td class="num">${d.qty}</td>
              <td class="num bold text-red">${fmtU((Number(d.qty) || 0) * (Number(d.unitUsd) || 0))}</td><td>${d.reason || ''}</td>
              <td style="white-space:nowrap">
                <button type="button" class="btn" style="padding:2px 6px" onclick="editDefectRow(${idx})">✏️</button>
                <button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="delDefectRow(${idx})">✕</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:10px">Записей брака нет</td></tr>'}
          </tbody>
        </table>
      `;
    }

    sec.innerHTML = `${modelDatalist}<div class="card"><div class="card-header"><div class="card-title">🏭 Управление запасами, пошивом (НЗП), техкартами и браком</div><div style="display:flex;gap:6px;flex-wrap:wrap">${tabsNav}</div></div>${bodyHtml}</div>`;
  }
  // --- 4. ДДС: ДОЗАГРУЗКА ВЫПИСОК БЕЗ ПОТЕРИ РАЗНЫХ СУММ В ОДИН ДЕНЬ ---
  window.importDdsSmartCsv = function (ev) {
    const f = ev.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines[0].includes(';') ? ';' : ',';
      const hdr = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
      const iDate = hdr.findIndex(h => /дата|date/.test(h));
      const iAmt = hdr.findIndex(h => /сумма|sum|amount|итог/.test(h));
      const iDesc = hdr.findIndex(h => /назначен|описан|коммент|контрагент|desc|purpose/.test(h));
      const iType = hdr.findIndex(h => /тип|приход|расход|вид|dir/.test(h));

      const ddsSec = document.getElementById('tab-dds');
      const walSel = ddsSec ? ddsSec.querySelector('select') : null;
      const wallet = walSel ? walSel.value : 'Банк';
      if (!Array.isArray(window.db.dds)) window.db.dds = [];
      if (!window.db.ddsHashes) window.db.ddsHashes = {};

      let added = 0, skipped = 0;
      lines.slice(1).forEach((line, idx) => {
        const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
        const rawDate = iDate >= 0 ? cols[iDate] : cols[0];
        const rawAmt = iAmt >= 0 ? cols[iAmt] : cols[1];
        const desc = iDesc >= 0 ? cols[iDesc] : (cols[2] || '');
        const amt = parseFloat(String(rawAmt || '0').replace(/\s+/g, '').replace(',', '.')) || 0;
        if (!rawDate || !amt) return;

        // Уникальный ключ: Кошелёк + Дата + Сумма + Назначение (чтобы разные суммы в один день НЕ пропускались!)
        const hash = `${wallet}|${rawDate}|${amt}|${desc.slice(0, 60)}`;
        if (window.db.ddsHashes[hash]) { skipped++; return; }
        window.db.ddsHashes[hash] = true;

        const isOut = amt < 0 || (iType >= 0 && /расход|списан|out/i.test(cols[iType]));
        window.db.dds.unshift({
          id: 'dds_' + Date.now() + '_' + idx,
          date: rawDate,
          wallet: wallet,
          type: isOut ? 'out' : 'in',
          cat: /налог|фнс|енп|усн|аусн|взнос/i.test(desc) ? 'Налоги и взносы' : (isOut ? 'Оплата по статье' : 'Поступление'),
          amount: Math.abs(amt),
          comment: desc
        });
        added++;
      });
      persistAll();
      if (typeof render === 'function') render();
      alert(`✅ Умный импорт ДДС завершён!\nДобавлено уникальных операций: ${added}\nПропущено полных дублей: ${skipped}`);
    };
    reader.readAsText(f, 'UTF-8');
  };

  function enhanceDdsTab() {
    const sec = document.getElementById('tab-dds');
    if (!sec || document.getElementById('p4-dds-smart-box')) return;
    const target = sec.querySelector('.card:last-child .card-header') || sec.querySelector('.card:last-child');
    if (!target) return;
    const box = document.createElement('div');
    box.id = 'p4-dds-smart-box';
    box.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:8px';
    box.innerHTML = `<label class="btn btn-success" style="cursor:pointer;margin:0" title="Загружает даже несколько платежей одному получателю за одну дату, если у них разные суммы или назначение">📥 Дозагрузить CSV (разные суммы в 1 день)<input type="file" accept=".csv" style="display:none" onchange="importDdsSmartCsv(event)"></label>`;
    target.appendChild(box);
  }

  // --- 5. РАСХОДЫ И НАЛОГИ (КВ/3 + ЦЕЛИКОМ ЗА МЕСЯЦ + ПОДТЯНУТЬ ИЗ ДДС) ---
  window.addTaxWholeMonth = function () {
    if (!window.db) return;
    const sec = document.getElementById('tab-exp');
    if (!sec) return;
    const selects = sec.querySelectorAll('select');
    const org = selects[0] ? selects[0].value : 'ИП';
    const taxType = selects[1] ? selects[1].value : 'Налог';
    const yr = document.getElementById('tx-yr')?.value || document.getElementById('f-yr')?.value || '2026';
    const amtInput = sec.querySelector('input[type="number"]');
    const amount = Number(amtInput ? amtInput.value : 0) || 0;
    if (amount <= 0) { alert('Введите сумму налога.'); if (amtInput) amtInput.focus(); return; }

    const curMo = document.getElementById('f-mo')?.value || '11';
    const moAns = prompt(`За какой месяц ${yr} г. провести налог «${taxType}» (${fmtR(amount)}) ЦЕЛИКОМ (без деления на 3)?\nВведите номер месяца (1–12):`, curMo);
    if (!moAns) return;
    const moNum = Number(moAns);
    if (!moNum || moNum < 1 || moNum > 12) return alert('Неверный номер месяца.');
    const mo = String(moNum).padStart(2, '0');

    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    window.db.taxes.unshift({
      id: 'tax_' + Date.now(), yr: String(yr), mo, q: Math.ceil(moNum / 3),
      org, type: taxType, name: taxType, amount, monthAmount: amount, isMonthly: true,
      comment: `Целиком за ${mo}.${yr}`
    });
    if (amtInput) amtInput.value = '';
    persistAll();
    if (typeof render === 'function') render();
    alert(`✅ Налог «${taxType}» (${fmtR(amount)}) записан целиком на ${mo}.${yr}.`);
  };

  window.pullTaxesFromDds = function () {
    if (!window.db) return;
    const ddsList = window.db.dds || [];
    if (!ddsList.length) return alert('В ДДС пока нет операций.');
    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    const usedIds = new Set(window.db.taxes.map(t => t.ddsId).filter(Boolean));

    const found = ddsList.filter(r => {
      if (usedIds.has(r.id)) return false;
      const txt = `${r.cat || ''} ${r.comment || ''}`.toLowerCase();
      return /налог|фнс|енп|усн|аусн|ндфл|патент|взнос|пфр|фомс|фсс/.test(txt);
    });
    if (!found.length) return alert('Новых налоговых платежей в ДДС не найдено (все уже подтянуты).');

    let cnt = 0;
    for (const r of found) {
      const fullAmt = Math.abs(Number(r.amount) || 0);
      if (!fullAmt) continue;
      const dateStr = String(r.date || '2026-11-01');
      const yr = dateStr.slice(0, 4) || '2026';
      const moNum = Number(dateStr.slice(5, 7)) || 11;
      const org = r.org || r.wallet || 'ИП';
      const label = r.cat || 'Налог из ДДС';

      const split3 = confirm(
        `Найден платёж в ДДС:\n• Счёт/Юрлицо: ${org}\n• Дата: ${dateStr} | Сумма: ${fmtR(fullAmt)}\n• Назначение: ${r.comment || label}\n\n` +
        `ОК — РАЗБИТЬ на 3 месяца квартала (по ${fmtR(fullAmt / 3)}/мес. для ОПиУ).\n` +
        `ОТМЕНА — записать ЦЕЛИКОМ (${fmtR(fullAmt)}) в ${String(moNum).padStart(2, '0')}.${yr}.`
      );
      if (split3) {
        const q = Math.ceil(moNum / 3), startMo = (q - 1) * 3 + 1, part = Math.round((fullAmt / 3) * 100) / 100;
        for (let i = 0; i < 3; i++) {
          window.db.taxes.unshift({
            id: `tax_${Date.now()}_${cnt}_${i}`, ddsId: r.id, yr, mo: String(startMo + i).padStart(2, '0'), q,
            org, type: label, name: label, amount: part, monthAmount: part, comment: `1/3 из ДДС от ${dateStr}`
          });
        }
      } else {
        window.db.taxes.unshift({
          id: `tax_${Date.now()}_${cnt}`, ddsId: r.id, yr, mo: String(moNum).padStart(2, '0'), q: Math.ceil(moNum / 3),
          org, type: label, name: label, amount: fullAmt, monthAmount: fullAmt, isMonthly: true, comment: `Целиком из ДДС от ${dateStr}`
        });
      }
      cnt++;
    }
    persistAll();
    if (typeof render === 'function') render();
    alert(`✅ Подтянуто налогов из ДДС: ${cnt} шт.`);
  };
  // --- УМНЫЙ ДОЗАГРУЗЧИК ДДС (НЕ ТЕРЯЕТ РАЗНЫЕ СУММЫ/НАЗНАЧЕНИЯ В ОДИН ДЕНЬ) ---
  window.importDdsSmartCsv = function (ev) {
    const f = ev.target.files[0]; if (!f) return;
    const sec = document.getElementById('tab-dds');
    const walletSel = sec ? sec.querySelector('select') : null;
    const walletName = walletSel ? walletSel.value : 'Банк / Касса';

    const reader = new FileReader();
    reader.onload = function (e) {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return alert('Файл пустой.');
      const sep = lines[0].includes(';') ? ';' : ',';
      const hdr = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

      const iDate = hdr.findIndex(h => /дата|date/.test(h));
      const iIn = hdr.findIndex(h => /приход|поступ|кредит|зачисл/.test(h));
      const iOut = hdr.findIndex(h => /расход|списан|дебет/.test(h));
      const iSum = hdr.findIndex(h => /сумма|amount/.test(h));
      const iDesc = hdr.findIndex(h => /назначен|коммент|описан|контрагент|получател/.test(h));
      const iDoc = hdr.findIndex(h => /номер|док/.test(h));

      if (!Array.isArray(window.db.dds)) window.db.dds = [];
      const seen = new Set(window.db.dds.map(r => `${r.date}|${r.wallet || r.acc || ''}|${Number(r.amount || r.sum || 0)}|${String(r.desc || r.comment || '').trim()}|${r.docNum || ''}`));

      let added = 0, skipped = 0;
      lines.slice(1).forEach(line => {
        const c = line.split(sep).map(x => x.replace(/^"|"$/g, '').trim());
        const dt = iDate >= 0 ? c[iDate] : '';
        if (!dt) return;
        const num = v => parseFloat(String(v || '0').replace(/\s+/g, '').replace(',', '.')) || 0;
        let amt = 0, dir = 'out';
        if (iIn >= 0 && num(c[iIn]) > 0) { amt = num(c[iIn]); dir = 'in'; }
        else if (iOut >= 0 && num(c[iOut]) > 0) { amt = num(c[iOut]); dir = 'out'; }
        else if (iSum >= 0 && num(c[iSum]) !== 0) {
          const raw = num(c[iSum]);
          dir = raw > 0 ? 'in' : 'out';
          amt = Math.abs(raw);
        }
        if (!amt) return;

        const desc = iDesc >= 0 ? c[iDesc] : '';
        const docNum = iDoc >= 0 ? c[iDoc] : '';
        const key = `${dt}|${walletName}|${amt}|${desc}|${docNum}`;
        if (seen.has(key)) { skipped++; return; }
        seen.add(key);

        let isoDate = dt;
        const m = dt.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (m) isoDate = `${m[3]}-${m[2]}-${m[1]}`;

        const low = desc.toLowerCase();
        const cat = /налог|фнс|енп|усн|аусн|ндфл|патент|взнос/.test(low) ? 'Налоги и взносы'
          : (/ткань|фурнитур|пошив|швейн|сырь/.test(low) ? 'Закуп сырья и пошив'
          : (dir === 'in' ? 'Поступление от МП / Прочее' : 'Операционный расход'));

        window.db.dds.unshift({
          id: 'dds_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          date: isoDate, wallet: walletName, acc: walletName,
          type: dir, dir: dir, cat: cat, amount: amt, sum: amt,
          desc: desc, comment: desc, docNum: docNum
        });
        added++;
      });

      persistAll();
      if (typeof render === 'function') render();
      alert(`✅ Умный импорт завершён!\nДобавлено новых операций: ${added} (включая разные суммы/назначения в один день).\nПропущено точных дублей: ${skipped}.`);
    };
    reader.readAsText(f, 'UTF-8');
  };

  function enhanceDdsTopBar() {
    const sec = document.getElementById('tab-dds');
    if (!sec || document.getElementById('p4-dds-smart-box')) return;
    const box = document.createElement('div');
    box.id = 'p4-dds-smart-box';
    box.style.cssText = 'background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:9px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap';
    box.innerHTML = `
      <div style="font-size:12px;color:#065f46">
        ℹ️ <b>Умный дозагрузчик выписок:</b> Не пропускает платежи в один день одному получателю, если у них <b>разная сумма</b> или <b>разное назначение</b>.
      </div>
      <label class="btn btn-success" style="cursor:pointer;margin:0">
        📥 Загрузить CSV (без потери разных сумм за 1 день)
        <input type="file" accept=".csv" style="display:none" onchange="importDdsSmartCsv(event)">
      </label>
    `;
    sec.insertBefore(box, sec.firstChild);
  }

  // --- НАЛОГИ: КНОПКА «ЦЕЛИКОМ ЗА МЕСЯЦ» И ПОДТЯГИВАНИЕ ВСЕХ НАЛОГОВ ИЗ ДДС ---
  window.addTaxWholeMonth = function () {
    const sec = document.getElementById('tab-exp'); if (!sec) return;
    const sels = sec.querySelectorAll('select');
    const org = sels.item(0) ? sels.item(0).value : 'ИП';
    const taxType = sels.item(1) ? sels.item(1).value : 'Налог';
    const yr = sels.item(2) ? sels.item(2).value : (document.getElementById('f-yr')?.value || '2026');
    const inp = sec.querySelector('input[type="number"]');
    const amount = Number(inp ? inp.value : 0) || 0;
    if (amount <= 0) { alert('Введите сумму налога.'); if (inp) inp.focus(); return; }

    const curMo = document.getElementById('f-mo')?.value || '11';
    const moAns = prompt(`За какой месяц ${yr} года провести налог «${taxType}» (${fmtR(amount)}) ЦЕЛИКОМ?\nВведите номер месяца (1–12):`, curMo);
    if (!moAns) return;
    const moNum = Number(moAns);
    if (!moNum || moNum < 1 || moNum > 12) return alert('Укажите месяц от 1 до 12.');
    const mo = String(moNum).padStart(2, '0');

    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    window.db.taxes.unshift({
      id: 'tax_' + Date.now(), yr: String(yr), mo, q: Math.ceil(moNum / 3),
      org, type: taxType, name: taxType, amount, monthAmount: amount, isMonthly: true,
      comment: `Целиком за ${mo}.${yr}`
    });
    if (inp) inp.value = '';
    persistAll();
    if (typeof render === 'function') render();
    alert(`✅ Налог «${taxType}» (${fmtR(amount)}) записан целиком на ${mo}.${yr}.`);
  };

  window.pullAllTaxesFromDds = function () {
    const dds = window.db?.dds || [];
    if (!dds.length) return alert('В ДДС пока нет операций.');
    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    const used = new Set(window.db.taxes.map(t => t.ddsId).filter(Boolean));

    const found = dds.filter(r => {
      if (used.has(r.id)) return false;
      if (r.type === 'in' || r.dir === 'in') return false;
      const txt = `${r.cat || ''} ${r.desc || ''} ${r.comment || ''}`.toLowerCase();
      return /налог|фнс|енп|усн|аусн|ндфл|патент|взнос|пфр|фомс|фсс/.test(txt);
    });
    if (!found.length) return alert('Новых налоговых платежей в ДДС не найдено.');

    let cnt = 0;
    for (const r of found) {
      const amt = Math.abs(Number(r.amount || r.sum || 0));
      if (!amt) continue;
      const dt = String(r.date || '2026-11-01');
      const yr = dt.slice(0, 4);
      const moNum = Number(dt.slice(5, 7)) || 11;
      const org = r.org || r.wallet || 'ИП';
      const desc = r.desc || r.comment || r.cat || 'Налог из ДДС';

      const split3 = confirm(
        `Платёж в ДДС от ${dt} на сумму ${fmtR(amt)} (${org})\nНазначение: ${desc}\n\n` +
        `ОК — РАЗБИТЬ на 3 месяца квартала (по ${fmtR(amt / 3)}/мес. для ОПиУ).\n` +
        `ОТМЕНА — записать ЦЕЛИКОМ (${fmtR(amt)}) в ${String(moNum).padStart(2, '0')}.${yr}.`
      );
      if (split3) {
        const q = Math.ceil(moNum / 3), sMo = (q - 1) * 3 + 1, part = Math.round((amt / 3) * 100) / 100;
        for (let i = 0; i < 3; i++) {
          window.db.taxes.unshift({
            id: `tax_${Date.now()}_${cnt}_${i}`, ddsId: r.id, yr, mo: String(sMo + i).padStart(2, '0'), q,
            org, type: r.cat || 'Налог', name: desc, amount: part, monthAmount: part,
            comment: `1/3 из ДДС (${dt})`
          });
        }
      } else {
        window.db.taxes.unshift({
          id: `tax_${Date.now()}_${cnt}`, ddsId: r.id, yr, mo: String(moNum).padStart(2, '0'), q: Math.ceil(moNum / 3),
          org, type: r.cat || 'Налог', name: desc, amount: amt, monthAmount: amt, isMonthly: true,
          comment: `Целиком из ДДС (${dt})`
        });
      }
      cnt++;
    }
    persistAll();
    if (typeof render === 'function') render();
    alert(`✅ Обработано налоговых платежей из ДДС: ${cnt} шт.`);
  };

  function enhanceExpTab() {
    const sec = document.getElementById('tab-exp');
    if (!sec) return;
    const hdr = sec.querySelector('.card-header');
    if (hdr && !document.getElementById('p4-pull-dds-tax')) {
      const b = document.createElement('button');
      b.id = 'p4-pull-dds-tax'; b.type = 'button'; b.className = 'btn';
      b.textContent = '🔄 Подтянуть налоги из ДДС';
      b.onclick = window.pullAllTaxesFromDds;
      hdr.appendChild(b);
    }
    const qBtn = Array.from(sec.querySelectorAll('button')).find(b => (b.textContent || '').includes('1/3'));
    if (qBtn && !document.getElementById('p4-whole-tax-btn')) {
      const b2 = document.createElement('button');
      b2.id = 'p4-whole-tax-btn'; b2.type = 'button'; b2.className = 'btn btn-success';
      b2.style.marginLeft = '6px';
      b2.textContent = '✅ Целиком за месяц';
      b2.onclick = window.addTaxWholeMonth;
      qBtn.parentNode.insertBefore(b2, qBtn.nextSibling);
    }
  }
  // --- ПОСТАВЩИКИ: ПОДТЯГИВАНИЕ ОПЛАТ ИЗ ДДС ПО СТАТЬЯМ ---
  function enhanceSupTab() {
    const sec = document.getElementById('tab-sup');
    if (!sec || document.getElementById('p4-sup-dds-box')) return;
    const dds = window.db?.dds || [];
    const supPays = dds.filter(r => {
      if (r.type === 'in' || r.dir === 'in') return false;
      const txt = `${r.cat || ''} ${r.desc || ''} ${r.comment || ''}`.toLowerCase();
      return /закуп|ткань|фурнитур|пошив|сырь|поставщик|фабрик/.test(txt);
    });
    const totRub = supPays.reduce((s, r) => s + Math.abs(Number(r.amount || r.sum || 0)), 0);

    const box = document.createElement('div');
    box.id = 'p4-sup-dds-box';
    box.className = 'card';
    box.style.marginBottom = '12px';
    box.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">💳 Прямые оплаты поставщикам и фабрике из ДДС (по статьям)</div>
          <div style="font-size:11.5px;color:#64748b">Собирает из ДДС все платежи за ткань, фурнитуру и пошив, даже без заведения поставщика</div>
        </div>
        <div class="badge badge-blue" style="font-size:13px">Итого оплачено: ${fmtR(totRub)}</div>
      </div>
      <table>
        <thead><tr><th>Дата</th><th>Статья</th><th>Назначение / Контрагент</th><th>Кошелёк / Банк</th><th class="num">Сумма (₽)</th></tr></thead>
        <tbody>
          ${supPays.slice(0, 30).map(r => `<tr>
            <td>${r.date || ''}</td><td>${r.cat || 'Закуп / Пошив'}</td><td>${r.desc || r.comment || '—'}</td><td>${r.wallet || r.acc || ''}</td>
            <td class="num bold">${fmtR(Math.abs(Number(r.amount || r.sum || 0)))}</td>
          </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:10px">В ДДС пока нет платежей по статьям закупки сырья и пошива</td></tr>'}
        </tbody>
      </table>
    `;
    sec.insertBefore(box, sec.firstChild);
  }

  // --- НОВЫЙ МОДУЛЬ: 📈 ЮНИТ-ЭКОНОМИКА ПО КАЖДОМУ SKU / МОДЕЛИ ---
  window.saveUnitEconRow = function (ev) {
    ev.preventDefault();
    const e = ensureErp();
    const model = document.getElementById('p4-ue-model').value.trim();
    const mp = document.getElementById('p4-ue-mp').value;
    const price = Number(document.getElementById('p4-ue-price').value) || 0;
    const commPct = Number(document.getElementById('p4-ue-comm').value) || 0;
    const logRub = Number(document.getElementById('p4-ue-log').value) || 0;
    const buyoutPct = Number(document.getElementById('p4-ue-bo').value) || 85;
    const adsPct = Number(document.getElementById('p4-ue-ads').value) || 0;
    const taxPct = Number(document.getElementById('p4-ue-tax').value) || 8;
    if (!model || price <= 0) return;

    const ex = e.unitEcon.find(x => x.model.toLowerCase() === model.toLowerCase() && x.mp === mp);
    const row = { id: ex ? ex.id : 'ue_' + Date.now(), model, mp, price, commPct, logRub, buyoutPct, adsPct, taxPct };
    if (ex) Object.assign(ex, row);
    else e.unitEcon.unshift(row);
    persistAll();
    renderUnitEconTab();
  };

  window.editUnitEconRow = function (idx) {
    const r = ensureErp().unitEcon[idx]; if (!r) return;
    const pr = Number(prompt(`Цена продажи на ${r.mp} (₽):`, r.price)); if (!pr || pr <= 0) return;
    const cm = Number(prompt('Комиссия МП (%):', r.commPct)); if (isNaN(cm)) return;
    const lg = Number(prompt('Логистика (₽):', r.logRub)); if (isNaN(lg)) return;
    const ad = Number(prompt('Реклама / ДРР (%):', r.adsPct)); if (isNaN(ad)) return;
    const tx = Number(prompt('Налог (%, напр. АУСН 8):', r.taxPct)); if (isNaN(tx)) return;
    r.price = pr; r.commPct = cm; r.logRub = lg; r.adsPct = ad; r.taxPct = tx;
    persistAll();
    renderUnitEconTab();
  };

  window.delUnitEconRow = function (idx) {
    if (!confirm('Удалить расчёт этой модели из Юнит-экономики?')) return;
    ensureErp().unitEcon.splice(idx, 1);
    persistAll();
    renderUnitEconTab();
  };

  function calcUnitEconMetrics(r, rate) {
    const cogsUsd = getModelCostUsd(r.model);
    const cogsRub = cogsUsd * rate;
    const bo = Math.max(10, Math.min(100, Number(r.buyoutPct) || 85)) / 100;
    const effLog = (Number(r.logRub) || 0) / bo;
    const commRub = r.price * ((Number(r.commPct) || 0) / 100);
    const adsRub = r.price * ((Number(r.adsPct) || 0) / 100);
    const taxRub = r.price * ((Number(r.taxPct) || 0) / 100);
    const netProfit = r.price - cogsRub - commRub - effLog - adsRub - taxRub;
    const marginPct = r.price > 0 ? (netProfit / r.price) * 100 : 0;
    const roiPct = cogsRub > 0 ? (netProfit / cogsRub) * 100 : 0;
    return { cogsUsd, cogsRub, effLog, commRub, adsRub, taxRub, netProfit, marginPct, roiPct };
  }
  function renderUnitEconTab() {
    let sec = document.getElementById('tab-ue');
    if (!sec) {
      const main = document.querySelector('main.content');
      if (!main) return;
      sec = document.createElement('section');
      sec.id = 'tab-ue';
      sec.className = 'hidden';
      main.appendChild(sec);
    }
    const e = ensureErp();
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const models = getUnifiedModels();
    const modelOpts = models.map(m => `<option value="${m.name}">${m.name} (${fmtU(getModelCostUsd(m.name))})</option>`).join('');

    sec.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📈 Юнит-экономика по моделям (авто-подтяжка себестоимости из Техкарт)</div>
            <div style="font-size:11.5px;color:#64748b">Курс расчёта: <b>${rate} ₽/$</b> • Себестоимость подтягивается из вашей Техкарты или Каталога SKU автоматически</div>
          </div>
        </div>
        <form onsubmit="saveUnitEconRow(event)" class="form-grid" style="grid-template-columns:2fr 1fr 1fr 0.9fr 1fr 0.9fr 0.9fr 0.9fr auto;gap:7px;margin-bottom:14px">
          <div><label>Модель товара</label><select id="p4-ue-model" class="select" required>${modelOpts}</select></div>
          <div><label>Площадка</label><select id="p4-ue-mp" class="select"><option>Wildberries</option><option>Ozon</option><option>Яндекс Маркет</option></select></div>
          <div><label>Цена продажи (₽)</label><input id="p4-ue-price" type="number" class="input" required placeholder="2490"></div>
          <div><label>Комиссия %</label><input id="p4-ue-comm" type="number" step="0.1" class="input" value="22"></div>
          <div><label>Логистика ₽</label><input id="p4-ue-log" type="number" class="input" value="110"></div>
          <div><label>Выкуп %</label><input id="p4-ue-bo" type="number" class="input" value="85"></div>
          <div><label>Реклама %</label><input id="p4-ue-ads" type="number" step="0.1" class="input" value="8"></div>
          <div><label>Налог %</label><input id="p4-ue-tax" type="number" step="0.1" class="input" value="8"></div>
          <div style="align-self:end"><button type="submit" class="btn btn-primary">+ Рассчитать</button></div>
        </form>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>Модель</th><th>МП</th><th class="num">Цена (₽)</th><th class="num">Себест. ($ / ₽)</th>
                <th class="num">Комиссия</th><th class="num">Логистика (с выкупом)</th><th class="num">Реклама + Налог</th>
                <th class="num">Чистая прибыль / шт.</th><th class="num">Маржа %</th><th class="num">ROI %</th><th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${(e.unitEcon || []).map((r, idx) => {
                const m = calcUnitEconMetrics(r, rate);
                const profCls = m.netProfit >= 0 ? 'text-green' : 'text-red';
                return `<tr>
                  <td class="bold">${r.model}</td><td>${r.mp}</td><td class="num bold">${fmtR(r.price)}</td>
                  <td class="num">${fmtU(m.cogsUsd)} / <b>${fmtR(m.cogsRub)}</b></td>
                  <td class="num">${fmtR(m.commRub)} (${r.commPct}%)</td>
                  <td class="num">${fmtR(m.effLog)} (${r.buyoutPct}%)</td>
                  <td class="num">${fmtR(m.adsRub + m.taxRub)}</td>
                  <td class="num bold ${profCls}" style="font-size:13.5px">${fmtR(m.netProfit)}</td>
                  <td class="num bold ${profCls}">${m.marginPct.toFixed(1)}%</td>
                  <td class="num">${m.roiPct.toFixed(0)}%</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="btn" style="padding:2px 6px" title="Редактировать" onclick="editUnitEconRow(${idx})">✏️</button>
                    <button type="button" class="btn btn-danger" style="padding:2px 6px" title="Удалить" onclick="delUnitEconRow(${idx})">✕</button>
                  </td>
                </tr>`;
              }).join('') || '<tr><td colspan="11" style="text-align:center;color:#64748b;padding:14px">Выберите модель сверху и нажмите «+ Рассчитать»</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- ИНТЕГРАЦИЯ В МЕНЮ И БЕЗОПАСНЫЙ ПЕРЕХВАТ ВКЛАДОК ---
  function injectUnitEconNav() {
    if (document.getElementById('nav-ue')) return;
    const skuBtn = document.getElementById('nav-sku');
    if (!skuBtn || !skuBtn.parentNode) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.id = 'nav-ue';
    btn.textContent = '📈 Юнит-экономика';
    btn.onclick = function () { window.tab('ue'); };
    skuBtn.parentNode.insertBefore(btn, skuBtn.nextSibling);
  }

  const _origTab = window.tab;
  window.tab = function (id) {
    injectUnitEconNav();
    renderUnitEconTab();
    if (id === 'ue') {
      if (window.db) window.db.tab = 'ue';
      ['dash', 'abc', 'rep', 'sku', 'stk', 'dds', 'exp', 'sup', 'set', 'ue'].forEach(t => {
        const s = document.getElementById('tab-' + t);
        const n = document.getElementById('nav-' + t);
        if (s) s.classList.toggle('hidden', t !== 'ue');
        if (n) n.classList.toggle('active', t === 'ue');
      });
      const cr = document.getElementById('crumb');
      if (cr) cr.textContent = 'SKOS / Юнит-экономика по моделям (SKU)';
      return;
    }
    const ueSec = document.getElementById('tab-ue');
    const ueNav = document.getElementById('nav-ue');
    if (ueSec) ueSec.classList.add('hidden');
    if (ueNav) ueNav.classList.remove('active');

    if (typeof _origTab === 'function') _origTab(id);
    if (id === 'stk') renderStkTab();
    if (id === 'dds') enhanceDdsTopBar();
    if (id === 'exp') enhanceExpTab();
    if (id === 'sup') enhanceSupTab();
    if (id === 'set') injectUnarchiveButton();
  };

  const _origRender = window.render;
  window.render = function () {
    if (typeof _origRender === 'function') _origRender();
    injectUnitEconNav();
    const cur = window.db?.tab || 'dash';
    if (cur === 'stk') renderStkTab();
    if (cur === 'dds') enhanceDdsTopBar();
    if (cur === 'exp') enhanceExpTab();
    if (cur === 'sup') enhanceSupTab();
    if (cur === 'set') injectUnarchiveButton();
    if (cur === 'ue') renderUnitEconTab();

    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const bal = calcStockBalances();
    const kFrz = document.getElementById('k-frz');
    if (kFrz && bal.totalUsd > 0) kFrz.textContent = fmtR(bal.totalUsd * rate);
  };

  setTimeout(function () {
    injectUnitEconNav();
    if (window.db && window.db.tab) window.tab(window.db.tab);
  }, 250);
})();
