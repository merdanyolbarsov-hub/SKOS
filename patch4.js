(function () {
  function fmtUsd(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
  }
  function fmtN(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  }
  function saveErp() {
    if (typeof save === 'function') save();
  }
  function ensureErpStore() {
    if (!window.db) window.db = {};
    if (!db.erp) {
      db.erp = {
        materials: [
          { id: 'm1', name: 'Ткань лён', type: 'Материал', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm2', name: 'Ткань флис', type: 'Материал', unit: 'кг', startQty: 0, startUsd: 0 },
          { id: 'm3', name: 'Ткань жаты', type: 'Материал', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm4', name: 'Ткань муслин', type: 'Материал', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm5', name: 'Ткань брюк', type: 'Материал', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm6', name: 'Пуговицы', type: 'Аксессуары', unit: 'шт', startQty: 0, startUsd: 0 },
          { id: 'm7', name: 'Замки', type: 'Аксессуары', unit: 'шт', startQty: 0, startUsd: 0 },
          { id: 'm8', name: 'Крючки', type: 'Аксессуары', unit: 'шт', startQty: 0, startUsd: 0 },
          { id: 'm9', name: 'Карсаж', type: 'Аксессуары', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm10', name: 'Ичлик', type: 'Аксессуары', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm11', name: 'Клейвой', type: 'Аксессуары', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm12', name: 'Этикетки', type: 'Аксессуары', unit: 'шт', startQty: 0, startUsd: 0 },
          { id: 'm13', name: 'Резинки', type: 'Аксессуары', unit: 'м2', startQty: 0, startUsd: 0 },
          { id: 'm14', name: 'Шнурок', type: 'Аксессуары', unit: 'шт', startQty: 0, startUsd: 0 },
          { id: 'm15', name: 'Пакет 5', type: 'Аксессуары', unit: 'шт', startQty: 0, startUsd: 0 },
          { id: 'm16', name: 'Пакет 10', type: 'Аксессуары', unit: 'шт', startQty: 0, startUsd: 0 }
        ],
        incoming: [],
        bom: [
          {
            product: 'Брюки мужские зауженные',
            items: [
              { matName: 'Пошив одежды', norm: 1, priceUsd: 2.00 },
              { matName: 'Ткань брюк', norm: 1.25, priceUsd: 2.65 },
              { matName: 'Карсаж', norm: 1.1, priceUsd: 0.15 },
              { matName: 'Ичлик', norm: 0.35, priceUsd: 0.25 },
              { matName: 'Пуговицы', norm: 2, priceUsd: 0.03 },
              { matName: 'Замки', norm: 1, priceUsd: 0.12 },
              { matName: 'Крючки', norm: 1, priceUsd: 0.04 },
              { matName: 'Этикетки', norm: 2, priceUsd: 0.02 },
              { matName: 'Пакет 10', norm: 1, priceUsd: 0.05 }
            ]
          }
        ],
        orders: [],
        fgStocks: [],
        defects: [],
        supOps: []
      };
    }
    ['materials', 'incoming', 'bom', 'orders', 'fgStocks', 'defects', 'supOps'].forEach(k => {
      if (!Array.isArray(db.erp[k])) db.erp[k] = [];
    });
    return db.erp;
  }

  function calcMaterialsBalances() {
    const erp = ensureErpStore();
    const map = {};
    erp.materials.forEach(m => {
      const sQty = Number(m.startQty) || 0;
      const sUsd = Number(m.startUsd) || 0;
      map[m.name] = {
        ...m,
        startQty: sQty,
        startUsd: sUsd,
        inQty: 0,
        inUsd: 0,
        outQty: 0,
        outUsd: 0,
        curQty: sQty,
        curUsd: sUsd,
        avgPrice: sQty > 0 ? sUsd / sQty : 0
      };
    });

    erp.incoming.forEach(inc => {
      const m = map[inc.matName];
      if (!m) return;
      m.inQty += Number(inc.qty) || 0;
      m.inUsd += Number(inc.usd) || 0;
    });

    Object.values(map).forEach(m => {
      const totQty = m.startQty + m.inQty;
      const totUsd = m.startUsd + m.inUsd;
      if (totQty > 0) m.avgPrice = totUsd / totQty;
    });

    erp.orders.forEach(ord => {
      (ord.lines || []).forEach(ln => {
        const m = map[ln.matName];
        if (!m) return;
        const q = Number(ln.qty) || 0;
        m.outQty += q;
        m.outUsd += q * m.avgPrice;
      });
    });

    Object.values(map).forEach(m => {
      m.curQty = m.startQty + m.inQty - m.outQty;
      m.curUsd = Math.max(0, m.curQty * m.avgPrice);
    });

    return { map, list: Object.values(map) };
  }

  // Поиск цены за 1 единицу модели ($) из каталога 32 папок или техкарты
  function getModelUnitUsd(modelName) {
    const clean = String(modelName || '').trim().toLowerCase();
    if (!clean) return 0;

    let fNames = {};
    try { fNames = JSON.parse(localStorage.getItem('skos_v3_folder_names') || '{}'); } catch (e) {}

    // 1. Ищем по названию папки
    let matchedArt = null;
    Object.keys(fNames).forEach(art => {
      if (String(fNames[art] || '').trim().toLowerCase() === clean) matchedArt = art;
    });

    const skus = (window.db && Array.isArray(db.skus)) ? db.skus : [];
    if (matchedArt) {
      const s = skus.find(x => String(x.art || '').trim() === matchedArt && Number(x.usd) > 0);
      if (s) return Number(s.usd);
    }

    const byName = skus.find(x => String(x.name || '').trim().toLowerCase() === clean && Number(x.usd) > 0);
    if (byName) return Number(byName.usd);

    // 2. Считаем по техкарте
    const erp = ensureErpStore();
    const bom = (erp.bom || []).find(b => String(b.product || '').trim().toLowerCase() === clean);
    if (bom && Array.isArray(bom.items)) {
      const { map } = calcMaterialsBalances();
      let sum = 0;
      bom.items.forEach(bi => {
        const mat = map[bi.matName];
        const p = mat ? mat.avgPrice : (Number(bi.priceUsd) || 0);
        sum += (Number(bi.norm) || 0) * p;
      });
      if (sum > 0) return sum;
    }
    return 0;
  }

  // Подсчёт общей суммы запасов (Сырьё + НЗП + Готовая продукция) и передача на главную Сводку
  function calcTotalInventoryMoney(targetYr, targetMo) {
    const erp = ensureErpStore();
    const rate = typeof getRate === 'function' ? getRate(targetYr + '-' + targetMo) : 70;
    const { list: matList } = calcMaterialsBalances();

    let rawUsd = 0;
    matList.forEach(m => { rawUsd += Math.max(0, m.curUsd); });

    let wipUsd = 0;
    (erp.orders || []).forEach(o => {
      if (o.status === 'WIP') wipUsd += Number(o.totalUsd) || 0;
    });

    let fgUsd = 0, fgRub = 0;
    const fgRows = (erp.fgStocks || []).filter(r => String(r.yr) === String(targetYr) && String(r.mo) === String(targetMo));
    fgRows.forEach(r => {
      const qty = (Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0);
      const u = Number(r.fixedUsd) || 0;
      const rb = Number(r.fixedRub) || (u * rate);
      fgUsd += u;
      fgRub += rb;
    });

    const totalUsd = rawUsd + wipUsd + fgUsd;
    const totalRub = (rawUsd + wipUsd) * rate + fgRub;
    return { rawUsd, wipUsd, fgUsd, fgRub, totalUsd, totalRub, rate };
  }

  // --- РЕНДЕР РАЗДЕЛА «🏭 ЗАПАСЫ, БРАК И ФУРНИТУРА» ---
  let invSubTab = 'SUMMARY'; // 'SUMMARY' | 'MATERIALS' | 'INCOMING' | 'ORDERS' | 'FG_DEFECT'
  let editMaterialIdx = -1;
  let editIncomingIdx = -1;
  let editFgIdx = -1;
  let editDefectIdx = -1;

  window.setSkosInvTab = function (t) {
    invSubTab = t;
    renderErpInventoryTab();
  };

  window.renderErpInventoryTab = function () {
    const sec = document.getElementById('tab-inv');
    if (!sec || !window.db) return;

    const erp = ensureErpStore();
    const curYr = document.getElementById('f-yr')?.value || '2026';
    const curMo = document.getElementById('f-mo')?.value || '11';
    const invMoney = calcTotalInventoryMoney(curYr, curMo);

    // Обновляем карточку «Заморожено в запасах» на главной Сводке
    const dashFrozen = document.querySelector('#tab-dash .kpi-grid > div:last-child .kpi-val, #tab-dash .kpi-grid > div:last-child div[style*="font-size:22px"]');
    if (dashFrozen && invMoney.totalRub > 0) {
      dashFrozen.textContent = fmtR(invMoney.totalRub);
    }

    const tabBtn = (id, label) => `<button type="button" class="btn ${invSubTab === id ? 'btn-primary' : ''}" onclick="setSkosInvTab('${id}')">${label}</button>`;

    let bodyHtml = '';
    if (invSubTab === 'SUMMARY') bodyHtml = buildInvSummaryHtml(curYr, curMo, invMoney);
    else if (invSubTab === 'MATERIALS') bodyHtml = buildMaterialsHtml();
    else if (invSubTab === 'INCOMING') bodyHtml = buildIncomingHtml();
    else if (invSubTab === 'ORDERS') bodyHtml = buildOrdersAndBomHtml();
    else if (invSubTab === 'FG_DEFECT') bodyHtml = buildFgAndDefectHtml(curYr, curMo);

    sec.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🏭 Управление запасами, производством (НЗП), фурнитурой и браком</div>
            <div style="font-size:11.5px;color:#64748b">Период оценки: <b>${curMo}.${curYr}</b> • Курс: <b>${invMoney.rate} ₽/$</b> • Полное редактирование, удаление и импорт CSV</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${tabBtn('SUMMARY', '📊 Свод запасов')}
            ${tabBtn('MATERIALS', '📋 Материалы и фурнитура')}
            ${tabBtn('INCOMING', '📥 Приход сырья')}
            ${tabBtn('ORDERS', '✂️ Пошив / НЗП и Нормы')}
            ${tabBtn('FG_DEFECT', '👕 Готовый товар и ⚠️ Брак')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px">
            <div style="font-size:11px;color:#64748b;font-weight:700">1. СЫРЬЁ И ФУРНИТУРА НА СКЛАДЕ</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;margin:3px 0">${fmtUsd(invMoney.rawUsd)}</div>
            <div style="font-size:11.5px;color:#475569">${fmtR(invMoney.rawUsd * invMoney.rate)}</div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px">
            <div style="font-size:11px;color:#b45309;font-weight:700">2. В ПОШИВЕ (НЗП НА ФАБРИКЕ)</div>
            <div style="font-size:18px;font-weight:800;color:#92400e;margin:3px 0">${fmtUsd(invMoney.wipUsd)}</div>
            <div style="font-size:11.5px;color:#78350f">${fmtR(invMoney.wipUsd * invMoney.rate)}</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px">
            <div style="font-size:11px;color:#15803d;font-weight:700">3. ГОТОВАЯ ПРОДУКЦИЯ (РФ+ТМ+ПУТЬ)</div>
            <div style="font-size:18px;font-weight:800;color:#166534;margin:3px 0">${fmtUsd(invMoney.fgUsd)}</div>
            <div style="font-size:11.5px;color:#14532d">${fmtR(invMoney.fgRub)}</div>
          </div>
          <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:10px 12px">
            <div style="font-size:11px;color:#1d4ed8;font-weight:700">ИТОГО ЗАМОРОЖЕНО В ЗАПАСАХ</div>
            <div style="font-size:18px;font-weight:800;color:#1e3a8a;margin:3px 0">${fmtUsd(invMoney.totalUsd)}</div>
            <div style="font-size:11.5px;color:#1e40af;font-weight:700">${fmtR(invMoney.totalRub)}</div>
          </div>
        </div>

        ${bodyHtml}
      </div>
    `;
  };
  function buildInvSummaryHtml(curYr, curMo, invMoney) {
    const erp = ensureErpStore();
    const { list: matList } = calcMaterialsBalances();
    const fgRows = (erp.fgStocks || []).filter(r => String(r.yr) === String(curYr) && String(r.mo) === String(curMo));
    const activeOrders = (erp.orders || []).filter(o => o.status === 'WIP');

    const topMats = [...matList].filter(m => m.curUsd > 0).sort((a, b) => b.curUsd - a.curUsd).slice(0, 10);

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px">
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px">
          <div style="font-weight:800;font-size:13.5px;margin-bottom:8px">🧵 Топ-10 остатков сырья и фурнитуры на складе</div>
          <table>
            <thead><tr><th>Материал</th><th>Тип</th><th class="num">Остаток</th><th class="num">Сумма USD</th></tr></thead>
            <tbody>
              ${topMats.map(m => `
                <tr>
                  <td class="bold">${m.name}</td>
                  <td><span class="badge ${m.type === 'Материал' ? 'badge-blue' : 'badge-amber'}">${m.type}</span></td>
                  <td class="num">${fmtN(m.curQty)} ${m.unit}</td>
                  <td class="num bold">${fmtUsd(m.curUsd)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;color:#64748b">Нет остатков</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px">
          <div style="font-weight:800;font-size:13.5px;margin-bottom:8px">👕 Готовая продукция на конец ${curMo}.${curYr} (Россия / ТМ / В пути)</div>
          <table>
            <thead><tr><th>Модель товара</th><th class="num">РФ</th><th class="num">ТМ</th><th class="num">Путь</th><th class="num">Сумма USD</th></tr></thead>
            <tbody>
              ${fgRows.map(r => `
                <tr>
                  <td class="bold">${r.product}</td>
                  <td class="num">${fmtN(r.ruQty)}</td>
                  <td class="num">${fmtN(r.tmQty)}</td>
                  <td class="num">${fmtN(r.wayQty)}</td>
                  <td class="num bold text-green">${fmtUsd(r.fixedUsd)}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b">За этот месяц остатки готового товара ещё не зафиксированы (перейдите во вкладку «👕 Готовый товар и Брак»).</td></tr>'}
            </tbody>
          </table>

          <div style="font-weight:800;font-size:13.5px;margin:14px 0 8px">⏳ Заказы в работе (НЗП на фабрике): ${activeOrders.length}</div>
          <table>
            <thead><tr><th>Дата</th><th>Модель</th><th class="num">Шт.</th><th class="num">Себест. USD</th></tr></thead>
            <tbody>
              ${activeOrders.map(o => `
                <tr>
                  <td>${o.date}</td>
                  <td class="bold">${o.product}</td>
                  <td class="num">${fmtN(o.qty)}</td>
                  <td class="num bold">${fmtUsd(o.totalUsd)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;color:#64748b">Все заказы выполнены (НЗП = 0 $)</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- ВКЛАДКА «МАТЕРИАЛЫ И ФУРНИТУРА» ---
  window.saveErpMaterial = function (e) {
    e.preventDefault();
    const erp = ensureErpStore();
    const name = document.getElementById('erp-m-name').value.trim();
    const type = document.getElementById('erp-m-type').value;
    const unit = document.getElementById('erp-m-unit').value.trim() || 'шт';
    const startQty = Number(document.getElementById('erp-m-qty').value) || 0;
    const startUsd = Number(document.getElementById('erp-m-usd').value) || 0;
    if (!name) return;

    if (editMaterialIdx >= 0 && erp.materials.at(editMaterialIdx)) {
      erp.materials[editMaterialIdx] = { ...erp.materials.at(editMaterialIdx), name, type, unit, startQty, startUsd };
      editMaterialIdx = -1;
    } else {
      erp.materials.push({ id: 'mat_' + Date.now(), name, type, unit, startQty, startUsd });
    }
    saveErp();
    renderErpInventoryTab();
  };

  window.editErpMaterial = function (idx) {
    editMaterialIdx = idx;
    renderErpInventoryTab();
  };

  window.delErpMaterial = function (idx) {
    const erp = ensureErpStore();
    if (!confirm('Удалить этот материал из справочника?')) return;
    erp.materials.splice(idx, 1);
    editMaterialIdx = -1;
    saveErp();
    renderErpInventoryTab();
  };
  window.importMaterialsCsv = function (inp) {
    const file = inp.files && inp.files.item(0);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const text = ev.target.result || '';
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines.at(0).includes(';') ? ';' : ',';
      const erp = ensureErpStore();
      let added = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines.at(i).split(sep).map(c => c.replace(/^"|"$/g, '').trim());
        const name = cols.at(0);
        if (!name || name.toLowerCase().includes('наименование')) continue;
        const type = cols.at(1) || 'Материал';
        const qty = parseFloat((cols.at(2) || '0').replace(/\s+/g, '').replace(',', '.')) || 0;
        const unit = cols.at(3) || 'шт';
        const usd = parseFloat((cols.at(4) || '0').replace(/\s+/g, '').replace(',', '.')) || 0;

        const existing = erp.materials.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.type = type;
          existing.unit = unit;
          existing.startQty = qty;
          existing.startUsd = usd;
        } else {
          erp.materials.push({ id: 'mat_' + Date.now() + '_' + i, name, type, unit, startQty: qty, startUsd: usd });
        }
        added++;
      }
      saveErp();
      renderErpInventoryTab();
      alert('Импортировано / обновлено материалов: ' + added);
    };
    reader.readAsText(file, 'UTF-8');
  };

  function buildMaterialsHtml() {
    const erp = ensureErpStore();
    const { list } = calcMaterialsBalances();
    const ed = editMaterialIdx >= 0 ? erp.materials.at(editMaterialIdx) : null;

    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:800;font-size:13px">${ed ? '✏️ Редактирование материала: ' + ed.name : '➕ Добавить материал / фурнитуру (лист «Запасы»)'}</div>
          <label class="btn" style="cursor:pointer">📥 Импорт листа «Запасы» (CSV)<input type="file" accept=".csv" style="display:none" onchange="importMaterialsCsv(this)"></label>
        </div>
        <form onsubmit="saveErpMaterial(event)" class="form-grid" style="grid-template-columns:2fr 1fr 0.8fr 1fr 1fr auto;gap:8px">
          <div><label>Наименование</label><input id="erp-m-name" class="input" required value="${ed ? ed.name : ''}" placeholder="Напр: Ткань лён"></div>
          <div><label>Тип</label><select id="erp-m-type" class="select">
            <option value="Материал" ${ed && ed.type === 'Материал' ? 'selected' : ''}>Материал (Ткань)</option>
            <option value="Аксессуары" ${ed && ed.type === 'Аксессуары' ? 'selected' : ''}>Аксессуары / Фурнитура</option>
          </select></div>
          <div><label>Ед. изм.</label><input id="erp-m-unit" class="input" required value="${ed ? ed.unit : 'шт'}" placeholder="м2 / кг / шт"></div>
          <div><label>Нач. остаток (кол-во)</label><input id="erp-m-qty" type="number" step="0.01" class="input" value="${ed ? ed.startQty : 0}"></div>
          <div><label>Нач. остаток (USD)</label><input id="erp-m-usd" type="number" step="0.01" class="input" value="${ed ? ed.startUsd : 0}"></div>
          <div style="display:flex;gap:4px">
            <button type="submit" class="btn btn-primary">${ed ? 'Сохранить' : '+ Добавить'}</button>
            ${ed ? '<button type="button" class="btn" onclick="editMaterialIdx=-1;renderErpInventoryTab()">Отмена</button>' : ''}
          </div>
        </form>
      </div>

      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Наименование материала</th>
              <th>Тип</th>
              <th>Ед.</th>
              <th class="num">Нач. остаток</th>
              <th class="num">+ Приход</th>
              <th class="num">− Списано (НЗП)</th>
              <th class="num">Текущий остаток</th>
              <th class="num">Цена ед. ($)</th>
              <th class="num">Остаток USD</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((m, idx) => `
              <tr>
                <td class="bold">${m.name}</td>
                <td><span class="badge ${m.type === 'Материал' ? 'badge-blue' : 'badge-amber'}">${m.type}</span></td>
                <td>${m.unit}</td>
                <td class="num">${fmtN(m.startQty)}</td>
                <td class="num text-green">+${fmtN(m.inQty)}</td>
                <td class="num text-red">−${fmtN(m.outQty)}</td>
                <td class="num bold">${fmtN(m.curQty)} ${m.unit}</td>
                <td class="num">${fmtUsd(m.avgPrice)}</td>
                <td class="num bold">${fmtUsd(m.curUsd)}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="btn" style="padding:3px 7px" onclick="editErpMaterial(${idx})">✏️</button>
                  <button type="button" class="btn btn-danger" style="padding:3px 7px" onclick="delErpMaterial(${idx})">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  // --- ВКЛАДКА «ПРИХОД СЫРЬЯ» ---
  window.saveErpIncoming = function (e) {
    e.preventDefault();
    const erp = ensureErpStore();
    const date = document.getElementById('erp-in-date').value;
    const matName = document.getElementById('erp-in-mat').value;
    const qty = Number(document.getElementById('erp-in-qty').value) || 0;
    const usd = Number(document.getElementById('erp-in-usd').value) || 0;
    const supplier = document.getElementById('erp-in-sup').value.trim();
    const comment = document.getElementById('erp-in-com').value.trim();
    if (!matName || qty <= 0) return;

    const item = { id: 'inc_' + Date.now(), date, matName, qty, usd, supplier, comment };
    if (editIncomingIdx >= 0 && erp.incoming.at(editIncomingIdx)) {
      erp.incoming[editIncomingIdx] = item;
      editIncomingIdx = -1;
    } else {
      erp.incoming.unshift(item);
    }
    saveErp();
    renderErpInventoryTab();
  };

  window.editErpIncoming = function (idx) { editIncomingIdx = idx; renderErpInventoryTab(); };
  window.delErpIncoming = function (idx) {
    if (!confirm('Удалить запись о приходе материала?')) return;
    ensureErpStore().incoming.splice(idx, 1);
    editIncomingIdx = -1;
    saveErp();
    renderErpInventoryTab();
  };

  function buildIncomingHtml() {
    const erp = ensureErpStore();
    const ed = editIncomingIdx >= 0 ? erp.incoming.at(editIncomingIdx) : null;
    const matOpts = (erp.materials || []).map(m => `<option value="${m.name}" ${ed && ed.matName === m.name ? 'selected' : ''}>${m.name} (${m.unit})</option>`).join('');

    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-weight:800;font-size:13px;margin-bottom:8px">${ed ? '✏️ Редактировать приход сырья' : '📥 Оприходовать поступление материалов на фабрику'}</div>
        <form onsubmit="saveErpIncoming(event)" class="form-grid" style="grid-template-columns:1fr 1.6fr 0.9fr 1fr 1.2fr 1.4fr auto;gap:8px">
          <div><label>Дата прихода</label><input id="erp-in-date" type="date" class="input" required value="${ed ? ed.date : new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Материал (из справочника)</label><select id="erp-in-mat" class="select" required>${matOpts}</select></div>
          <div><label>Кол-во</label><input id="erp-in-qty" type="number" step="0.01" class="input" required value="${ed ? ed.qty : ''}"></div>
          <div><label>Сумма USD</label><input id="erp-in-usd" type="number" step="0.01" class="input" required value="${ed ? ed.usd : ''}"></div>
          <div><label>Поставщик</label><input id="erp-in-sup" class="input" value="${ed ? ed.supplier : ''}" placeholder="MUSTAFA KUMAŞ"></div>
          <div><label>Комментарий</label><input id="erp-in-com" class="input" value="${ed ? ed.comment : ''}" placeholder="TIR №2"></div>
          <div style="display:flex;gap:4px">
            <button type="submit" class="btn btn-primary">${ed ? 'Сохранить' : '+ Записать'}</button>
            ${ed ? '<button type="button" class="btn" onclick="editIncomingIdx=-1;renderErpInventoryTab()">Отмена</button>' : ''}
          </div>
        </form>
      </div>

      <table>
        <thead><tr><th>Дата</th><th>Материал</th><th class="num">Кол-во</th><th class="num">Цена ед. ($)</th><th class="num">Итого USD</th><th>Поставщик</th><th>Комментарий</th><th>Действия</th></tr></thead>
        <tbody>
          ${(erp.incoming || []).map((r, idx) => {
            const unitP = r.qty > 0 ? r.usd / r.qty : 0;
            return `
              <tr>
                <td>${r.date}</td>
                <td class="bold">${r.matName}</td>
                <td class="num bold text-green">+${fmtN(r.qty)}</td>
                <td class="num">${fmtUsd(unitP)}</td>
                <td class="num bold">${fmtUsd(r.usd)}</td>
                <td>${r.supplier || '—'}</td>
                <td style="font-size:12px;color:#475569">${r.comment || '—'}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="btn" style="padding:3px 7px" onclick="editErpIncoming(${idx})">✏️</button>
                  <button type="button" class="btn btn-danger" style="padding:3px 7px" onclick="delErpIncoming(${idx})">✕</button>
                </td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:14px">Записей о приходе материалов пока нет.</td></tr>'}
        </tbody>
      </table>
    `;
  }
  // --- ВКЛАДКА «ПОШИВ / ЗАКАЗЫ В РАБОТУ (НЗП) И ТЕХКАРТЫ» ---
  window.createProductionOrder = function (e) {
    e.preventDefault();
    const erp = ensureErpStore();
    const date = document.getElementById('erp-ord-date').value;
    const product = document.getElementById('erp-ord-prod').value.trim();
    const qty = Number(document.getElementById('erp-ord-qty').value) || 0;
    const comment = document.getElementById('erp-ord-com').value.trim();
    if (!product || qty <= 0) return;

    const bom = (erp.bom || []).find(b => b.product.toLowerCase() === product.toLowerCase());
    if (!bom || !Array.isArray(bom.items) || !bom.items.length) {
      alert('Для модели «' + product + '» не найдена техкарта (нормы расхода). Сначала создайте её ниже в конструкторе норм.');
      return;
    }

    const { map } = calcMaterialsBalances();
    let totalUsd = 0;
    const lines = bom.items.map(bi => {
      const mQty = (Number(bi.norm) || 0) * qty;
      const mat = map[bi.matName];
      const unitUsd = mat ? mat.avgPrice : (Number(bi.priceUsd) || 0);
      const lineUsd = mQty * unitUsd;
      totalUsd += lineUsd;
      return { matName: bi.matName, qty: mQty, priceUsd: unitUsd, totalUsd: lineUsd };
    });

    erp.orders.unshift({
      id: 'ord_' + Date.now(),
      date,
      doneDate: '',
      status: 'WIP',
      product,
      qty,
      totalUsd,
      comment: comment || `Заказ товара "${product}" в объеме "${qty}"`,
      lines
    });

    saveErp();
    renderErpInventoryTab();
  };

  window.completeProductionOrder = function (idx) {
    const erp = ensureErpStore();
    const ord = erp.orders.at(idx);
    if (!ord) return;
    const doneDate = prompt('Введите дату выполнения заказа (ДД.ММ.ГГГГ или ГГГГ-ММ-ДД):', new Date().toISOString().slice(0, 10));
    if (!doneDate) return;

    ord.status = 'DONE';
    ord.doneDate = doneDate;

    const curYr = document.getElementById('f-yr')?.value || '2026';
    const curMo = document.getElementById('f-mo')?.value || '11';
    let fgRow = erp.fgStocks.find(r => String(r.yr) === String(curYr) && String(r.mo) === String(curMo) && r.product === ord.product);
    const unitPrice = ord.qty > 0 ? (ord.totalUsd / ord.qty) : getModelUnitUsd(ord.product);
    const rate = typeof getRate === 'function' ? getRate(curYr + '-' + curMo) : 70;

    if (!fgRow) {
      fgRow = { id: 'fg_' + Date.now(), yr: curYr, mo: curMo, product: ord.product, ruQty: 0, tmQty: 0, wayQty: 0, unitUsd: unitPrice, fixedUsd: 0, fixedRub: 0 };
      erp.fgStocks.push(fgRow);
    }
    fgRow.tmQty = (Number(fgRow.tmQty) || 0) + Number(ord.qty);
    const totQty = (Number(fgRow.ruQty) || 0) + (Number(fgRow.tmQty) || 0) + (Number(fgRow.wayQty) || 0);
    fgRow.unitUsd = unitPrice || fgRow.unitUsd;
    fgRow.fixedUsd = totQty * fgRow.unitUsd;
    fgRow.fixedRub = fgRow.fixedUsd * rate;

    saveErp();
    renderErpInventoryTab();
    alert(`Заказ выполнен! ${ord.qty} шт. «${ord.product}» зачислены в готовую продукцию (Туркменистан).`);
  };

  window.deleteProductionOrder = function (idx) {
    if (!confirm('Удалить этот производственный заказ? Списанные по нему материалы вернутся на склад.')) return;
    ensureErpStore().orders.splice(idx, 1);
    saveErp();
    renderErpInventoryTab();
  };

  window.addBomItemRow = function (e) {
    e.preventDefault();
    const erp = ensureErpStore();
    const prod = document.getElementById('bom-prod-name').value.trim();
    const matName = document.getElementById('bom-mat-name').value;
    const norm = Number(document.getElementById('bom-norm').value) || 0;
    const priceUsd = Number(document.getElementById('bom-price').value) || 0;
    if (!prod || !matName || norm <= 0) return;

    let bom = erp.bom.find(b => b.product.toLowerCase() === prod.toLowerCase());
    if (!bom) {
      bom = { product: prod, items: [] };
      erp.bom.push(bom);
    }
    const ex = bom.items.find(x => x.matName === matName);
    if (ex) { ex.norm = norm; ex.priceUsd = priceUsd; }
    else bom.items.push({ matName, norm, priceUsd });

    saveErp();
    renderErpInventoryTab();
  };

  window.delBomItemRow = function (bIdx, iIdx) {
    const erp = ensureErpStore();
    const bom = erp.bom.at(bIdx);
    if (!bom) return;
    bom.items.splice(iIdx, 1);
    if (!bom.items.length) erp.bom.splice(bIdx, 1);
    saveErp();
    renderErpInventoryTab();
  };
  function buildOrdersAndBomHtml() {
    const erp = ensureErpStore();
    const prodOpts = (erp.bom || []).map(b => `<option value="${b.product}">${b.product}</option>`).join('');
    const matOpts = ['Пошив одежды'].concat((erp.materials || []).map(m => m.name))
      .map(n => `<option value="${n}">${n}</option>`).join('');

    return `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-weight:800;font-size:13px;color:#92400e;margin-bottom:8px">✂️ Запустить новый заказ в пошив (Калькулятор авто-списания по техкарте)</div>
        <form onsubmit="createProductionOrder(event)" class="form-grid" style="grid-template-columns:1fr 2fr 1fr 2fr auto;gap:8px">
          <div><label>Дата запуска</label><input id="erp-ord-date" type="date" class="input" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Модель товара (по техкарте)</label><select id="erp-ord-prod" class="select" required>${prodOpts}</select></div>
          <div><label>Объём (шт.)</label><input id="erp-ord-qty" type="number" class="input" required placeholder="5550"></div>
          <div><label>Комментарий / № заказа</label><input id="erp-ord-com" class="input" placeholder="Заказ на фабрику ТМ"></div>
          <div><button type="submit" class="btn btn-primary">⚙️ Списать сырьё и запустить</button></div>
        </form>
      </div>

      <div style="font-weight:800;font-size:13.5px;margin-bottom:8px">📋 Журнал заказов в работе (НЗП) и выполненных партий</div>
      <table style="margin-bottom:18px">
        <thead><tr><th>Дата запуска</th><th>Статус / Дата готовн.</th><th>Модель</th><th class="num">Кол-во шт.</th><th class="num">Цена 1 шт. ($)</th><th class="num">Итого USD</th><th>Комментарий</th><th>Действия</th></tr></thead>
        <tbody>
          ${(erp.orders || []).map((o, idx) => {
            const uPrice = o.qty > 0 ? o.totalUsd / o.qty : 0;
            const stBadge = o.status === 'WIP'
              ? '<span class="badge badge-amber">⏳ В работе (НЗП)</span>'
              : `<span class="badge badge-green">✅ Готов (${o.doneDate})</span>`;
            return `
              <tr>
                <td>${o.date}</td>
                <td>${stBadge}</td>
                <td class="bold">${o.product}</td>
                <td class="num bold">${fmtN(o.qty)}</td>
                <td class="num">${fmtUsd(uPrice)}</td>
                <td class="num bold">${fmtUsd(o.totalUsd)}</td>
                <td style="font-size:11.5px;color:#475569">${o.comment}</td>
                <td style="white-space:nowrap">
                  ${o.status === 'WIP' ? `<button type="button" class="btn btn-success" style="padding:3px 8px" onclick="completeProductionOrder(${idx})">✅ Выполнен</button>` : ''}
                  <button type="button" class="btn btn-danger" style="padding:3px 7px" onclick="deleteProductionOrder(${idx})">✕</button>
                </td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:12px">Заказов пока нет.</td></tr>'}
        </tbody>
      </table>

      <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#f8fafc">
        <div style="font-weight:800;font-size:13.5px;margin-bottom:8px">📐 Конструктор норм расхода (Техкарты моделей)</div>
        <form onsubmit="addBomItemRow(event)" class="form-grid" style="grid-template-columns:1.8fr 1.8fr 1fr 1fr auto;gap:8px;margin-bottom:10px">
          <div><label>Модель товара</label><input id="bom-prod-name" class="input" list="bom-prod-list" required placeholder="Напр: Брюки мужские зауженные">
            <datalist id="bom-prod-list">${(erp.bom || []).map(b => `<option value="${b.product}">`).join('')}</datalist>
          </div>
          <div><label>Материал / Работа</label><select id="bom-mat-name" class="select">${matOpts}</select></div>
          <div><label>Норма на 1 шт.</label><input id="bom-norm" type="number" step="0.0001" class="input" required placeholder="1.25"></div>
          <div><label>Цена ед. ($)</label><input id="bom-price" type="number" step="0.001" class="input" placeholder="2.65"></div>
          <div><button type="submit" class="btn btn-primary">+ В техкарту</button></div>
        </form>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px">
          ${(erp.bom || []).map((b, bIdx) => {
            const unitSum = b.items.reduce((acc, x) => acc + (Number(x.norm) || 0) * (Number(x.priceUsd) || 0), 0);
            return `
              <details style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px">
                <summary style="cursor:pointer;font-weight:700;font-size:12.5px">📋 ${b.product} — Себест.: <span class="text-green">${fmtUsd(unitSum)}</span> (${b.items.length} поз.)</summary>
                <table style="margin-top:8px;font-size:11.5px">
                  <thead><tr><th>Материал</th><th class="num">Норма</th><th class="num">Цена $</th><th class="num">Сумма $</th><th></th></tr></thead>
                  <tbody>
                    ${b.items.map((it, iIdx) => `
                      <tr>
                        <td>${it.matName}</td>
                        <td class="num">${it.norm}</td>
                        <td class="num">${it.priceUsd}</td>
                        <td class="num bold">${(it.norm * it.priceUsd).toFixed(3)}</td>
                        <td><button type="button" class="btn btn-danger" style="padding:1px 5px" onclick="delBomItemRow(${bIdx},${iIdx})">✕</button></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </details>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  // --- ВКЛАДКА «ГОТОВАЯ ПРОДУКЦИЯ (РФ / ТМ / В ПУТИ) И ЖУРНАЛ БРАКА» ---
  window.saveFgStockRow = function (e) {
    e.preventDefault();
    const erp = ensureErpStore();
    const yr = document.getElementById('f-yr')?.value || '2026';
    const mo = document.getElementById('f-mo')?.value || '11';
    const product = document.getElementById('fg-prod').value.trim();
    const ruQty = Number(document.getElementById('fg-ru').value) || 0;
    const tmQty = Number(document.getElementById('fg-tm').value) || 0;
    const wayQty = Number(document.getElementById('fg-way').value) || 0;
    let unitUsd = Number(document.getElementById('fg-usd').value) || 0;
    if (!product) return;

    if (!unitUsd) unitUsd = getModelUnitUsd(product);
    const rate = typeof getRate === 'function' ? getRate(yr + '-' + mo) : 70;
    const totQty = ruQty + tmQty + wayQty;
    const fixedUsd = totQty * unitUsd;
    const fixedRub = fixedUsd * rate;

    const row = { id: 'fg_' + Date.now(), yr, mo, product, ruQty, tmQty, wayQty, unitUsd, fixedUsd, fixedRub };
    if (editFgIdx >= 0 && erp.fgStocks.at(editFgIdx)) {
      erp.fgStocks[editFgIdx] = row;
      editFgIdx = -1;
    } else {
      const existing = erp.fgStocks.find(r => String(r.yr) === String(yr) && String(r.mo) === String(mo) && r.product === product);
      if (existing) Object.assign(existing, { ruQty, tmQty, wayQty, unitUsd, fixedUsd, fixedRub });
      else erp.fgStocks.push(row);
    }
    saveErp();
    renderErpInventoryTab();
  };

  window.moveFgBatch = function (globalIdx, dir) {
    const erp = ensureErpStore();
    const r = erp.fgStocks.at(globalIdx);
    if (!r) return;
    const label = dir === 'TM_TO_WAY' ? 'из Туркменистана В ПУТЬ (Карго)' : 'ИЗ ПУТИ на склад в РОССИИ';
    const qty = Number(prompt(`Сколько штук «${r.product}» перевести ${label}?`, '100')) || 0;
    if (qty <= 0) return;

    if (dir === 'TM_TO_WAY') {
      if (r.tmQty < qty) { alert('Недостаточно товара в Туркменистане!'); return; }
      r.tmQty -= qty;
      r.wayQty += qty;
    } else {
      if (r.wayQty < qty) { alert('Недостаточно товара в пути!'); return; }
      r.wayQty -= qty;
      r.ruQty += qty;
    }
    saveErp();
    renderErpInventoryTab();
  };

  window.editFgStockRow = function (globalIdx) { editFgIdx = globalIdx; renderErpInventoryTab(); };
  window.delFgStockRow = function (globalIdx) {
    if (!confirm('Удалить эту строку остатков готовой продукции?')) return;
    ensureErpStore().fgStocks.splice(globalIdx, 1);
    editFgIdx = -1;
    saveErp();
    renderErpInventoryTab();
  };

  window.saveDefectRecord = function (e) {
    e.preventDefault();
    const erp = ensureErpStore();
    const date = document.getElementById('def-date').value;
    const mode = document.getElementById('def-mode').value; // 'LOSS' | 'REWORK'
    const srcType = document.getElementById('def-src-type').value; // 'FG' | 'MAT'
    const srcName = document.getElementById('def-src-name').value.trim();
    const location = document.getElementById('def-loc').value;
    const lossQty = Number(document.getElementById('def-qty').value) || 0;
    const unitCostUsd = Number(document.getElementById('def-cost').value) || 0;
    const outProd = document.getElementById('def-out-prod').value.trim();
    const outQty = Number(document.getElementById('def-out-qty').value) || 0;
    const extraUsd = Number(document.getElementById('def-extra').value) || 0;
    const comment = document.getElementById('def-com').value.trim();
    if (!srcName || lossQty <= 0) return;

    const totalLossUsd = lossQty * unitCostUsd;
    const rec = { id: 'def_' + Date.now(), date, mode, srcType, srcName, location, lossQty, unitCostUsd, totalLossUsd, outProd, outQty, extraUsd, comment };

    if (editDefectIdx >= 0 && erp.defects.at(editDefectIdx)) {
      erp.defects[editDefectIdx] = rec;
      editDefectIdx = -1;
    } else {
      erp.defects.unshift(rec);
      const curYr = document.getElementById('f-yr')?.value || '2026';
      const curMo = document.getElementById('f-mo')?.value || '11';
      const rate = typeof getRate === 'function' ? getRate(curYr + '-' + curMo) : 70;

      // Списываем брак с остатков готового товара или сырья
      if (srcType === 'FG') {
        const fg = erp.fgStocks.find(r => String(r.yr) === String(curYr) && String(r.mo) === String(curMo) && r.product === srcName);
        if (fg) {
          if (location === 'РФ') fg.ruQty = Math.max(0, (Number(fg.ruQty) || 0) - lossQty);
          else if (location === 'ТМ') fg.tmQty = Math.max(0, (Number(fg.tmQty) || 0) - lossQty);
          else fg.wayQty = Math.max(0, (Number(fg.wayQty) || 0) - lossQty);
          const tot = (Number(fg.ruQty) || 0) + (Number(fg.tmQty) || 0) + (Number(fg.wayQty) || 0);
          fg.fixedUsd = tot * (Number(fg.unitUsd) || unitCostUsd);
          fg.fixedRub = fg.fixedUsd * rate;
        }
      } else {
        erp.orders.unshift({
          id: 'def_mat_' + Date.now(),
          date,
          doneDate: date,
          status: 'DONE',
          product: 'Списание брака сырья: ' + srcName,
          qty: 0,
          totalUsd: totalLossUsd,
          comment: comment || 'Брак материала',
          lines: [{ matName: srcName, qty: lossQty, priceUsd: unitCostUsd, totalUsd: totalLossUsd }]
        });
      }

      // Если переработка в годные штуки — приходуем новый товар на склад
      if (mode === 'REWORK' && outProd && outQty > 0) {
        let outFg = erp.fgStocks.find(r => String(r.yr) === String(curYr) && String(r.mo) === String(curMo) && r.product === outProd);
        const newUnitUsd = (totalLossUsd + extraUsd) / outQty;
        if (!outFg) {
          outFg = { id: 'fg_' + Date.now(), yr: curYr, mo: curMo, product: outProd, ruQty: 0, tmQty: 0, wayQty: 0, unitUsd: newUnitUsd, fixedUsd: 0, fixedRub: 0 };
          erp.fgStocks.push(outFg);
        }
        if (location === 'РФ') outFg.ruQty = (Number(outFg.ruQty) || 0) + outQty;
        else outFg.tmQty = (Number(outFg.tmQty) || 0) + outQty;
        const totOut = (Number(outFg.ruQty) || 0) + (Number(outFg.tmQty) || 0) + (Number(outFg.wayQty) || 0);
        outFg.unitUsd = newUnitUsd;
        outFg.fixedUsd = totOut * newUnitUsd;
        outFg.fixedRub = outFg.fixedUsd * rate;
      }
    }

    saveErp();
    renderErpInventoryTab();
  };

  window.editDefectRecord = function (idx) { editDefectIdx = idx; renderErpInventoryTab(); };
  window.delDefectRecord = function (idx) {
    if (!confirm('Удалить запись из журнала брака?')) return;
    ensureErpStore().defects.splice(idx, 1);
    editDefectIdx = -1;
    saveErp();
    renderErpInventoryTab();
  };
  function buildFgAndDefectHtml(curYr, curMo) {
    const erp = ensureErpStore();
    const rate = typeof getRate === 'function' ? getRate(curYr + '-' + curMo) : 70;
    const fgFiltered = (erp.fgStocks || []).map((r, globalIdx) => ({ ...r, globalIdx }))
      .filter(r => String(r.yr) === String(curYr) && String(r.mo) === String(curMo));
    const edFg = editFgIdx >= 0 ? erp.fgStocks.at(editFgIdx) : null;
    const edDef = editDefectIdx >= 0 ? erp.defects.at(editDefectIdx) : null;

    const modelSuggestions = Array.from(new Set([
      ...(erp.bom || []).map(b => b.product),
      ...((window.db && Array.isArray(db.skus)) ? db.skus.map(s => s.name).filter(Boolean) : [])
    ])).slice(0, 60);

    return `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-weight:800;font-size:13px;color:#166534;margin-bottom:8px">
          ${edFg ? '✏️ Редактировать остаток готовой продукции' : `👕 Зафиксировать остаток готового товара на конец ${curMo}.${curYr} (Россия / Туркменистан / В пути)`}
        </div>
        <form onsubmit="saveFgStockRow(event)" class="form-grid" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:8px">
          <div><label>Модель товара</label><input id="fg-prod" class="input" list="fg-models-dl" required value="${edFg ? edFg.product : ''}" placeholder="Брюки мужские зауженные">
            <datalist id="fg-models-dl">${modelSuggestions.map(m => `<option value="${m}">`).join('')}</datalist>
          </div>
          <div><label>В России (шт.)</label><input id="fg-ru" type="number" class="input" value="${edFg ? edFg.ruQty : 0}"></div>
          <div><label>В Туркменистане (шт.)</label><input id="fg-tm" type="number" class="input" value="${edFg ? edFg.tmQty : 0}"></div>
          <div><label>В пути / Карго (шт.)</label><input id="fg-way" type="number" class="input" value="${edFg ? edFg.wayQty : 0}"></div>
          <div><label>Цена 1 шт. ($)</label><input id="fg-usd" type="number" step="0.01" class="input" value="${edFg ? edFg.unitUsd : ''}" placeholder="Авто из базы"></div>
          <div style="display:flex;gap:4px">
            <button type="submit" class="btn btn-success">${edFg ? 'Сохранить' : '🔒 Зафиксировать'}</button>
            ${edFg ? '<button type="button" class="btn" onclick="editFgIdx=-1;renderErpInventoryTab()">Отмена</button>' : ''}
          </div>
        </form>
      </div>

      <table style="margin-bottom:18px">
        <thead>
          <tr>
            <th>Модель товара</th>
            <th class="num">Россия (шт.)</th>
            <th class="num">Туркменистан (шт.)</th>
            <th class="num">В пути (шт.)</th>
            <th class="num">Итого шт.</th>
            <th class="num">Цена $</th>
            <th class="num">Фикс. сумма USD</th>
            <th class="num">Фикс. сумма RUB</th>
            <th>Перемещение / Действия</th>
          </tr>
        </thead>
        <tbody>
          ${fgFiltered.map(r => {
            const tot = (Number(r.ruQty) || 0) + (Number(r.tmQty) || 0) + (Number(r.wayQty) || 0);
            return `
              <tr>
                <td class="bold">${r.product}</td>
                <td class="num bold text-blue">${fmtN(r.ruQty)}</td>
                <td class="num">${fmtN(r.tmQty)}</td>
                <td class="num text-amber">${fmtN(r.wayQty)}</td>
                <td class="num bold">${fmtN(tot)}</td>
                <td class="num">${fmtUsd(r.unitUsd)}</td>
                <td class="num bold text-green">${fmtUsd(r.fixedUsd)}</td>
                <td class="num bold">${fmtR(r.fixedRub)}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="btn" style="padding:3px 6px;font-size:11px" title="Отправить из ТМ в путь" onclick="moveFgBatch(${r.globalIdx},'TM_TO_WAY')">ТМ➔Путь</button>
                  <button type="button" class="btn" style="padding:3px 6px;font-size:11px" title="Принять из пути в РФ" onclick="moveFgBatch(${r.globalIdx},'WAY_TO_RU')">Путь➔РФ</button>
                  <button type="button" class="btn" style="padding:3px 6px" onclick="editFgStockRow(${r.globalIdx})">✏️</button>
                  <button type="button" class="btn btn-danger" style="padding:3px 6px" onclick="delFgStockRow(${r.globalIdx})">✕</button>
                </td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:12px">За период ${curMo}.${curYr} остатки готовой продукции ещё не зафиксированы.</td></tr>`}
        </tbody>
      </table>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-weight:800;font-size:13px;color:#991b1b;margin-bottom:8px">⚠️ Журнал брака и переработки (Безвозвратный убыток или перешив в годные штуки)</div>
        <form onsubmit="saveDefectRecord(event)" class="form-grid" style="grid-template-columns:1fr 1.4fr 1fr 1.6fr 1fr 0.9fr 0.9fr;gap:8px">
          <div><label>Дата</label><input id="def-date" type="date" class="input" required value="${edDef ? edDef.date : new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Вариант обработки</label><select id="def-mode" class="select">
            <option value="LOSS" ${edDef && edDef.mode === 'LOSS' ? 'selected' : ''}>🗑️ Безвозвратный брак (убыток)</option>
            <option value="REWORK" ${edDef && edDef.mode === 'REWORK' ? 'selected' : ''}>♻️ В переработку (получаем штуки)</option>
          </select></div>
          <div><label>Что списываем</label><select id="def-src-type" class="select">
            <option value="FG" ${edDef && edDef.srcType === 'FG' ? 'selected' : ''}>Готовый товар (шт.)</option>
            <option value="MAT" ${edDef && edDef.srcType === 'MAT' ? 'selected' : ''}>Ткань / Сырьё (м²/кг)</option>
          </select></div>
          <div><label>Наименование (товар/ткань)</label><input id="def-src-name" class="input" list="fg-models-dl" required value="${edDef ? edDef.srcName : ''}" placeholder="Ткань жаты / Костюм..."></div>
          <div><label>Локация</label><select id="def-loc" class="select">
            <option value="ТМ" ${edDef && edDef.location === 'ТМ' ? 'selected' : ''}>Туркменистан</option>
            <option value="РФ" ${edDef && edDef.location === 'РФ' ? 'selected' : ''}>Россия</option>
            <option value="Путь" ${edDef && edDef.location === 'Путь' ? 'selected' : ''}>В пути</option>
          </select></div>
          <div><label>Списано ед.</label><input id="def-qty" type="number" step="0.01" class="input" required value="${edDef ? edDef.lossQty : ''}"></div>
          <div><label>Цена ед. ($)</label><input id="def-cost" type="number" step="0.01" class="input" required value="${edDef ? edDef.unitCostUsd : ''}"></div>

          <div style="grid-column:span 2"><label>♻️ Если переработка: Какой товар получили</label><input id="def-out-prod" class="input" list="fg-models-dl" value="${edDef ? edDef.outProd : ''}" placeholder="Напр: Жениский топик"></div>
          <div><label>Вышло годных шт.</label><input id="def-out-qty" type="number" class="input" value="${edDef ? edDef.outQty : 0}"></div>
          <div><label>Доп. расход перешива ($)</label><input id="def-extra" type="number" step="0.01" class="input" value="${edDef ? edDef.extraUsd : 0}"></div>
          <div style="grid-column:span 2"><label>Причина / Комментарий</label><input id="def-com" class="input" value="${edDef ? edDef.comment : ''}" placeholder="Дефект рулона -> перешили в топики"></div>
          <div style="display:flex;gap:4px">
            <button type="submit" class="btn btn-danger">${edDef ? 'Сохранить' : '+ Провести брак'}</button>
            ${edDef ? '<button type="button" class="btn" onclick="editDefectIdx=-1;renderErpInventoryTab()">Отмена</button>' : ''}
          </div>
        </form>
      </div>

      <table>
        <thead><tr><th>Дата</th><th>Тип</th><th>Списано (локация)</th><th class="num">Кол-во</th><th class="num">Сумма $</th><th>Результат переработки</th><th>Комментарий</th><th>Действия</th></tr></thead>
        <tbody>
          ${(erp.defects || []).map((d, idx) => `
            <tr>
              <td>${d.date}</td>
              <td>${d.mode === 'REWORK' ? '<span class="badge badge-green">♻️ Переработка</span>' : '<span class="badge badge-red">🗑️ Убыток</span>'}</td>
              <td class="bold">${d.srcName} <span style="color:#64748b">(${d.location})</span></td>
              <td class="num">${fmtN(d.lossQty)}</td>
              <td class="num bold text-red">${fmtUsd(d.totalLossUsd)} <span style="font-size:10.5px;color:#64748b">(${fmtR(d.totalLossUsd * rate)})</span></td>
              <td>${d.mode === 'REWORK' ? `<b class="text-green">+${d.outQty} шт.</b> «${d.outProd}»` : '—'}</td>
              <td style="font-size:11.5px;color:#475569">${d.comment || '—'}</td>
              <td style="white-space:nowrap">
                <button type="button" class="btn" style="padding:3px 7px" onclick="editDefectRecord(${idx})">✏️</button>
                <button type="button" class="btn btn-danger" style="padding:3px 7px" onclick="delDefectRecord(${idx})">✕</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:12px">Записей о браке пока нет.</td></tr>'}
        </tbody>
      </table>
    `;
  }
  // --- БЛОК 2: РАСХОДЫ И НАЛОГИ (АУСН БЕЗ ДЕЛЕНИЯ + РАЗНЕСЕНИЕ НА N МЕС. + КОПИРОВАНИЕ ИЗ ПРОШЛОГО МЕС.) ---
  window.saveTaxWholeMonth = function () {
    if (!window.db) return;
    const tab = document.getElementById('tab-fin');
    if (!tab) return;

    const selects = tab.querySelectorAll('.card:first-child select');
    const inp = tab.querySelector('.card:first-child input[type="number"]');
    if (selects.length < 4 || !inp) return;

    const org = selects.item(0).value;
    const kind = selects.item(1).value;
    const yr = selects.item(2).value;
    const qVal = selects.item(3).value;
    const amt = Number(inp.value) || 0;
    if (amt <= 0) { alert('Введите сумму налога!'); return; }

    const moMap = {
      'm01': '01', 'm02': '02', 'm03': '03', 'm04': '04', 'm05': '05', 'm06': '06',
      'm07': '07', 'm08': '08', 'm09': '09', 'm10': '10', 'm11': '11', 'm12': '12',
      '1': '01', '2': '04', '3': '07', '4': '10'
    };
    const rawKey = String(qVal).replace(/^0+/, '');
    const targetMo = moMap[qVal] || moMap[rawKey] || (String(qVal).match(/^\d{2}$/) ? qVal : '11');

    if (!Array.isArray(db.taxes)) db.taxes = [];
    db.taxes.unshift({
      id: 'tax_' + Date.now(),
      org,
      kind: kind + ' (100% за мес.)',
      yr,
      q: '100%',
      months: [targetMo],
      amt
    });

    inp.value = '';
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    enhanceFinanceTab();
  };

  window.editTaxRecord = function (idx) {
    if (!window.db || !db.taxes || !db.taxes.at(idx)) return;
    const t = db.taxes.at(idx);
    const nextAmt = Number(prompt(`Новая сумма налога (${t.kind}, ${t.yr}):`, t.amt));
    if (!isNaN(nextAmt) && nextAmt > 0) {
      t.amt = nextAmt;
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      enhanceFinanceTab();
    }
  };

  window.copyOpexFromPrevMonth = function () {
    if (!window.db || !Array.isArray(db.expenses)) return;
    const tab = document.getElementById('tab-fin');
    const opexCard = tab ? tab.querySelectorAll('.card').item(1) : null;
    if (!opexCard) return;

    const selects = opexCard.querySelectorAll('select');
    const targetYr = selects.item(3)?.value || '2026';
    const targetMo = selects.item(4)?.value || '11';

    let prevMoNum = parseInt(targetMo, 10) - 1;
    let prevYr = String(targetYr);
    if (prevMoNum < 1) { prevMoNum = 12; prevYr = String(parseInt(targetYr, 10) - 1); }
    const prevMo = String(prevMoNum).padStart(2, '0');

    const prevList = db.expenses.filter(ex => String(ex.yr) === prevYr && String(ex.mo) === prevMo);
    if (!prevList.length) {
      alert(`За прошлый месяц (${prevMo}.${prevYr}) операционных расходов не найдено.`);
      return;
    }

    if (!confirm(`Скопировать ${prevList.length} расходов из ${prevMo}.${prevYr} в ${targetMo}.${targetYr}?`)) return;

    prevList.forEach((ex, i) => {
      db.expenses.unshift({
        ...ex,
        id: 'exp_' + Date.now() + '_' + i,
        yr: targetYr,
        mo: targetMo
      });
    });

    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    enhanceFinanceTab();
  };
  window.saveOpexWithSpread = function (e) {
    if (e) e.preventDefault();
    if (!window.db) return;
    const tab = document.getElementById('tab-fin');
    const opexCard = tab ? tab.querySelectorAll('.card').item(1) : null;
    if (!opexCard) return;

    const selects = opexCard.querySelectorAll('select');
    const inputs = opexCard.querySelectorAll('input');

    const org = selects.item(0)?.value || 'ALL';
    const cat = selects.item(1)?.value || 'Прочие расходы';
    const cur = selects.item(2)?.value || 'RUB';
    const startYr = parseInt(selects.item(3)?.value || '2026', 10);
    const startMo = parseInt(selects.item(4)?.value || '11', 10);

    const desc = inputs.item(0)?.value.trim() || '';
    const totalAmt = Number(inputs.item(1)?.value) || 0;
    const spreadMonths = Math.max(1, Math.min(60, parseInt(document.getElementById('skos-opex-spread')?.value || '1', 10)));

    if (totalAmt <= 0) { alert('Введите сумму расхода!'); return; }

    if (cat.includes('Сырьё') || cat.includes('пошив')) {
      if (!confirm('Внимание: ткани и фурнитура уже учитываются в себестоимости через склад материалов. Записать этот расход дополнительно в ОПиУ?')) return;
    }

    if (!Array.isArray(db.expenses)) db.expenses = [];
    const partAmt = totalAmt / spreadMonths;

    for (let i = 0; i < spreadMonths; i++) {
      const mTotal = (startMo - 1) + i;
      const y = startYr + Math.floor(mTotal / 12);
      const m = String((mTotal % 12) + 1).padStart(2, '0');
      const suffix = spreadMonths > 1 ? ` (${i + 1}/${spreadMonths} мес.)` : '';

      db.expenses.unshift({
        id: 'exp_' + Date.now() + '_' + i,
        org,
        cat,
        desc: (desc || cat) + suffix,
        amt: partAmt,
        cur,
        yr: String(y),
        mo: m
      });
    }

    if (inputs.item(0)) inputs.item(0).value = '';
    if (inputs.item(1)) inputs.item(1).value = '';
    if (document.getElementById('skos-opex-spread')) document.getElementById('skos-opex-spread').value = '1';

    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    enhanceFinanceTab();
  };

  window.editOpexRecord = function (idx) {
    if (!window.db || !db.expenses || !db.expenses.at(idx)) return;
    const ex = db.expenses.at(idx);
    const nextAmt = Number(prompt(`Новая сумма расхода (${ex.cat} — ${ex.desc || ''}):`, ex.amt));
    if (!isNaN(nextAmt) && nextAmt > 0) {
      ex.amt = nextAmt;
      const nextDesc = prompt('Комментарий:', ex.desc || '');
      if (nextDesc !== null) ex.desc = nextDesc;
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      enhanceFinanceTab();
    }
  };

  function enhanceFinanceTab() {
    const tab = document.getElementById('tab-fin');
    if (!tab || !window.db) return;

    const cards = tab.querySelectorAll('.card');
    const taxCard = cards.item(0);
    const opexCard = cards.item(1);

    if (taxCard) {
      const addTaxBtn = taxCard.querySelector('button.btn-primary');
      if (addTaxBtn && !document.getElementById('skos-tax-whole-btn')) {
        addTaxBtn.textContent = '+ Разнести 1/3 кв.';
        const wholeBtn = document.createElement('button');
        wholeBtn.id = 'skos-tax-whole-btn';
        wholeBtn.type = 'button';
        wholeBtn.className = 'btn btn-success';
        wholeBtn.style.marginLeft = '6px';
        wholeBtn.textContent = '✅ Целиком за месяц (АУСН)';
        wholeBtn.onclick = window.saveTaxWholeMonth;
        addTaxBtn.insertAdjacentElement('afterend', wholeBtn);
      }

      taxCard.querySelectorAll('tbody tr').forEach((tr, idx) => {
        const firstTd = tr.children.item(0);
        if (firstTd && firstTd.textContent.includes('NaN')) {
          const t = (db.taxes || []).at(idx);
          const moLabel = t && Array.isArray(t.months) ? t.months.join(', ') + ' мес.' : 'Месяц';
          firstTd.textContent = (t ? t.yr : '2026') + ' • ' + moLabel + ' (100%)';
        }
        const lastTd = tr.lastElementChild;
        if (lastTd && !lastTd.querySelector('.skos-edit-tax')) {
          const edBtn = document.createElement('button');
          edBtn.type = 'button';
          edBtn.className = 'btn skos-edit-tax';
          edBtn.style.cssText = 'padding:3px 7px;margin-right:4px';
          edBtn.textContent = '✏️';
          edBtn.onclick = function () { window.editTaxRecord(idx); };
          lastTd.prepend(edBtn);
        }
      });
    }

    if (opexCard) {
      const hdr = opexCard.querySelector('.card-header');
      if (hdr && !document.getElementById('skos-copy-opex-btn')) {
        const cpBtn = document.createElement('button');
        cpBtn.id = 'skos-copy-opex-btn';
        cpBtn.type = 'button';
        cpBtn.className = 'btn';
        cpBtn.textContent = '📋 Скопировать из прошлого месяца';
        cpBtn.onclick = window.copyOpexFromPrevMonth;
        hdr.appendChild(cpBtn);
      }

      const selects = opexCard.querySelectorAll('select');
      const catSel = selects.item(1);
      if (catSel && catSel.dataset.cleaned !== '1') {
        catSel.dataset.cleaned = '1';
        Array.from(catSel.options).forEach(opt => {
          const txt = opt.textContent || '';
          if (txt.includes('Поступлени') || txt.includes('ВБ') || txt.includes('Ozon') || txt.includes('Яндекс')) {
            opt.remove();
          }
        });
      }

      const addOpexBtn = opexCard.querySelector('button.btn-primary');
      if (addOpexBtn && !document.getElementById('skos-opex-spread-wrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'skos-opex-spread-wrap';
        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-right:6px';
        wrap.innerHTML = '<span style="font-size:11.5px;font-weight:700;color:#475569">На мес.:</span>' +
          '<input id="skos-opex-spread" type="number" min="1" max="60" value="1" class="input" style="width:62px;padding:5px 6px" title="1 = целиком в этот месяц, 6 = на полгода, 12 = на год (1С)">';
        addOpexBtn.parentElement.insertBefore(wrap, addOpexBtn);
        addOpexBtn.type = 'button';
        addOpexBtn.onclick = window.saveOpexWithSpread;
      }

      opexCard.querySelectorAll('tbody tr').forEach((tr, idx) => {
        const lastTd = tr.lastElementChild;
        if (lastTd && !lastTd.querySelector('.skos-edit-opex')) {
          const edBtn = document.createElement('button');
          edBtn.type = 'button';
          edBtn.className = 'btn skos-edit-opex';
          edBtn.style.cssText = 'padding:3px 7px;margin-right:4px';
          edBtn.textContent = '✏️';
          edBtn.onclick = function () { window.editOpexRecord(idx); };
          lastTd.prepend(edBtn);
        }
      });
    }
  }
  // --- БЛОК 3: ПОСТАВЩИКИ, ДЕПОЗИТЫ (С АВТОПОДТЯЖКОЙ ИЗ ДДС) И ОСНОВНЫЕ СРЕДСТВА (ОС) ---
  let editSupOpIdx = -1;
  let editAssetIdx = -1;

  window.saveSupplierOp = function (e) {
    e.preventDefault();
    const erp = ensureErpStore();
    const date = document.getElementById('sup-date').value;
    const supplier = document.getElementById('sup-name').value.trim();
    const type = document.getElementById('sup-type').value; // 'PAY' (Оплачено авансом) | 'ACT' (Закрыто актом/товаром)
    const amt = Number(document.getElementById('sup-amt').value) || 0;
    const cur = document.getElementById('sup-cur').value || 'RUB';
    const toOpex = document.getElementById('sup-to-opex')?.checked;
    const opexCat = document.getElementById('sup-opex-cat')?.value || 'Таможня и сборы';
    const comment = document.getElementById('sup-com').value.trim();
    if (!supplier || amt <= 0) return;

    const item = { id: 'sup_' + Date.now(), date, supplier, type, amt, cur, comment };
    if (editSupOpIdx >= 0 && erp.supOps.at(editSupOpIdx)) {
      erp.supOps[editSupOpIdx] = item;
      editSupOpIdx = -1;
    } else {
      erp.supOps.unshift(item);

      // Если закрыли акт/растаможку и стоит галочка «В расход месяца» — сразу пишем в ОПиУ
      if (type === 'ACT' && toOpex && Array.isArray(db.expenses)) {
        const parts = date.split('-');
        const yr = parts.at(0) || '2026';
        const mo = parts.at(1) || '11';
        db.expenses.unshift({
          id: 'exp_sup_' + Date.now(),
          org: 'ALL',
          cat: opexCat,
          desc: `${supplier}: ${comment || 'Закрытие акта с депозита'}`,
          amt,
          cur,
          yr,
          mo
        });
      }
    }

    saveErp();
    if (typeof render === 'function') render();
    renderSuppliersAndAssetsTab();
  };

  window.editSupOp = function (idx) { editSupOpIdx = idx; renderSuppliersAndAssetsTab(); };
  window.delSupOp = function (idx) {
    if (!confirm('Удалить эту операцию по поставщику?')) return;
    ensureErpStore().supOps.splice(idx, 1);
    editSupOpIdx = -1;
    saveErp();
    renderSuppliersAndAssetsTab();
  };

  function calcSuppliersSummary() {
    const erp = ensureErpStore();
    const map = {};
    const addEntry = (sup, cur, paid, billed) => {
      const name = String(sup || '').trim();
      if (!name) return;
      const key = name + '||' + cur;
      if (!map[key]) map[key] = { supplier: name, cur, paid: 0, billed: 0 };
      map[key].paid += paid;
      map[key].billed += billed;
    };

    // 1. Ручные операции по депозитам и актам
    (erp.supOps || []).forEach(op => {
      if (op.type === 'PAY') addEntry(op.supplier, op.cur, Number(op.amt) || 0, 0);
      else addEntry(op.supplier, op.cur, 0, Number(op.amt) || 0);
    });

    // 2. Автоматически подтягиваем оплаты поставщикам из ДДС (чтобы не вбивать дважды!)
    const ddsList = (window.db && Array.isArray(db.dds)) ? db.dds : [];
    ddsList.forEach(d => {
      const amt = Number(d.amt) || 0;
      if (amt >= 0) return; // берём только выбытия (оплаты)
      const cat = String(d.cat || '').toLowerCase();
      const desc = String(d.desc || d.comment || '').trim();
      if (cat.includes('поставщик') || cat.includes('закуп') || cat.includes('тамож') || cat.includes('доставк') || cat.includes('мебато')) {
        const cur = String(d.cur || (String(d.acc || '').includes('USD') ? 'USD' : 'RUB'));
        const supName = d.contractor || desc.split(' ').slice(0, 2).join(' ') || d.cat;
        addEntry(supName, cur, Math.abs(amt), 0);
      }
    });

    // 3. Автоматически учитываем приходы материалов на склад (как начисление по накладной в USD)
    (erp.incoming || []).forEach(inc => {
      if (inc.supplier) addEntry(inc.supplier, 'USD', 0, Number(inc.usd) || 0);
    });

    return Object.values(map).map(x => ({
      ...x,
      balance: x.paid - x.billed // > 0 = Наш аванс / остаток депозита у поставщика; < 0 = Наш долг
    }));
  }
  window.saveErpAsset = function (e) {
    e.preventDefault();
    if (!window.db) return;
    if (!Array.isArray(db.assets)) db.assets = [];

    const group = document.getElementById('os-group').value.trim() || 'Оборудование';
    const name = document.getElementById('os-name').value.trim();
    const qty = Math.max(1, Number(document.getElementById('os-qty').value) || 1);
    const unitCost = Number(document.getElementById('os-unit-cost').value) || 0;
    const months = Math.max(1, Number(document.getElementById('os-months').value) || 60);
    const startDate = document.getElementById('os-date').value || '2026-01-01';
    const owner = document.getElementById('os-owner').value.trim();
    const location = document.getElementById('os-loc').value;
    if (!name || unitCost <= 0) return;

    const totalCost = qty * unitCost;
    const item = { id: 'os_' + Date.now(), group, name, qty, unitCost, cost: totalCost, months, startDate, owner, location, soldAmt: 0 };

    if (editAssetIdx >= 0 && db.assets.at(editAssetIdx)) {
      db.assets[editAssetIdx] = { ...db.assets.at(editAssetIdx), ...item };
      editAssetIdx = -1;
    } else {
      db.assets.unshift(item);
    }

    if (typeof save === 'function') save();
    renderSuppliersAndAssetsTab();
  };

  window.editErpAsset = function (idx) { editAssetIdx = idx; renderSuppliersAndAssetsTab(); };
  window.delErpAsset = function (idx) {
    if (!confirm('Удалить этот объект ОС?')) return;
    db.assets.splice(idx, 1);
    editAssetIdx = -1;
    if (typeof save === 'function') save();
    renderSuppliersAndAssetsTab();
  };

  window.sellErpAsset = function (idx) {
    const a = (db.assets || []).at(idx);
    if (!a) return;
    const salePrice = Number(prompt(`Продажа ОС «${a.name}» (балансовая стоимость ${fmtR(a.cost)}). Введите цену продажи (₽):`, '0'));
    if (isNaN(salePrice) || salePrice < 0) return;
    a.soldAmt = salePrice;
    a.months = 0;
    if (typeof save === 'function') save();
    renderSuppliersAndAssetsTab();
  };

  window.importAssetsCsv = function (inp) {
    const file = inp.files && inp.files.item(0);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const lines = (ev.target.result || '').split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines.at(0).includes(';') ? ';' : ',';
      if (!Array.isArray(db.assets)) db.assets = [];
      let added = 0;
      for (let i = 1; i < lines.length; i++) {
        const c = lines.at(i).split(sep).map(x => x.replace(/^"|"$/g, '').trim());
        const name = c.at(1) || c.at(0);
        if (!name || name.toLowerCase().includes('наименование')) continue;
        const qty = Math.max(1, parseFloat((c.at(2) || '1').replace(/\s+/g, '')) || 1);
        const uCost = parseFloat((c.at(3) || '0').replace(/\s+/g, '').replace(',', '.')) || 0;
        const months = Math.max(1, parseInt(c.at(9) || '60', 10) || 60);
        if (uCost > 0) {
          db.assets.push({ id: 'os_' + Date.now() + '_' + i, group: name, name, qty, unitCost: uCost, cost: qty * uCost, months, startDate: '2026-01-01', owner: '', location: 'Россия' });
          added++;
        }
      }
      if (typeof save === 'function') save();
      renderSuppliersAndAssetsTab();
      alert('Импортировано объектов ОС: ' + added);
    };
    reader.readAsText(file, 'UTF-8');
  };
  window.renderSuppliersAndAssetsTab = function () {
    const sec = document.getElementById('tab-sup');
    if (!sec || !window.db) return;

    const erp = ensureErpStore();
    const supSummary = calcSuppliersSummary();
    const edSup = editSupOpIdx >= 0 ? erp.supOps.at(editSupOpIdx) : null;
    const edOs = editAssetIdx >= 0 ? (db.assets || []).at(editAssetIdx) : null;

    const assets = Array.isArray(db.assets) ? db.assets : [];
    const totalOsCost = assets.reduce((s, a) => s + (a.soldAmt ? 0 : (Number(a.cost) || 0)), 0);
    const totalMonthlyWear = assets.reduce((s, a) => s + (a.soldAmt || !a.months ? 0 : ((Number(a.cost) || 0) / a.months)), 0);

    sec.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🤝 Поставщики, Таможня и Депозиты (Оплаты из ДДС + Ручные авансы / Акты)</div>
            <div style="font-size:11.5px;color:#64748b">Оплаты из ДДС и приходы сырья подтягиваются сюда автоматически. Закрывайте акты с депозита в 1 клик.</div>
          </div>
        </div>

        <form onsubmit="saveSupplierOp(event)" class="form-grid" style="grid-template-columns:1fr 1.6fr 1.5fr 1fr 0.8fr 1.5fr auto;gap:8px;background:#f8fafc;padding:10px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:12px">
          <div><label>Дата</label><input id="sup-date" type="date" class="input" required value="${edSup ? edSup.date : new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Поставщик / Брокер</label><input id="sup-name" class="input" list="sup-names-dl" required value="${edSup ? edSup.supplier : ''}" placeholder="Таможня / MUSTAFA KUMAŞ">
            <datalist id="sup-names-dl">${supSummary.map(s => `<option value="${s.supplier}">`).join('')}</datalist>
          </div>
          <div><label>Операция</label><select id="sup-type" class="select">
            <option value="PAY" ${edSup && edSup.type === 'PAY' ? 'selected' : ''}>💸 Оплачено авансом / Депозит (+)</option>
            <option value="ACT" ${edSup && edSup.type === 'ACT' ? 'selected' : ''}>📄 Закрыто актом / накладной (−)</option>
          </select></div>
          <div><label>Сумма</label><input id="sup-amt" type="number" step="0.01" class="input" required value="${edSup ? edSup.amt : ''}"></div>
          <div><label>Валюта</label><select id="sup-cur" class="select">
            <option value="RUB" ${edSup && edSup.cur === 'RUB' ? 'selected' : ''}>RUB (₽)</option>
            <option value="USD" ${edSup && edSup.cur === 'USD' ? 'selected' : ''}>USD ($)</option>
          </select></div>
          <div><label>Комментарий</label><input id="sup-com" class="input" value="${edSup ? edSup.comment : ''}" placeholder="Растаможка партии №12"></div>
          <div style="display:flex;gap:4px">
            <button type="submit" class="btn btn-primary">${edSup ? 'Сохранить' : '+ Записать'}</button>
            ${edSup ? '<button type="button" class="btn" onclick="editSupOpIdx=-1;renderSuppliersAndAssetsTab()">Отмена</button>' : ''}
          </div>
          <div style="grid-column:1 / -1;display:flex;align-items:center;gap:10px;font-size:12px;color:#334155">
            <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;text-transform:none;font-size:12px">
              <input type="checkbox" id="sup-to-opex" checked> При закрытии акта (−) сразу списать эту сумму в <b>Операционные расходы месяца</b> по статье:
            </label>
            <select id="sup-opex-cat" class="select" style="width:auto;padding:3px 8px;font-size:12px">
              <option value="Таможня и сборы">🛃 Таможня и сборы</option>
              <option value="Карго / Доставка">🚚 Карго / Доставка</option>
              <option value="1С и сервисы">💻 1С и сервисы</option>
              <option value="Аренда склада / офиса">🏢 Аренда склада / офиса</option>
              <option value="Прочие расходы">📦 Прочие расходы</option>
            </select>
          </div>
        </form>

        <table style="margin-bottom:14px">
          <thead><tr><th>Поставщик / Контрагент</th><th>Валюта</th><th class="num">Всего оплачено (ДДС + авансы)</th><th class="num">Закрыто актами / товаром</th><th class="num">Сальдо (Остаток депозита / Долг)</th></tr></thead>
          <tbody>
            ${supSummary.map(s => {
              const f = s.cur === 'USD' ? fmtUsd : fmtR;
              const balBadge = s.balance >= 0
                ? `<span class="badge badge-green">Наш остаток депозита: +${f(s.balance)}</span>`
                : `<span class="badge badge-red">Наш долг: ${f(s.balance)}</span>`;
              return `<tr><td class="bold">${s.supplier}</td><td>${s.cur}</td><td class="num">${f(s.paid)}</td><td class="num">${f(s.billed)}</td><td class="num bold">${balBadge}</td></tr>`;
            }).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:12px">Операций по поставщикам пока нет.</td></tr>'}
          </tbody>
        </table>

        <details style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px">
          <summary style="cursor:pointer;font-weight:700;font-size:12.5px">📜 Журнал ручных операций по депозитам и актам (${(erp.supOps || []).length}) — редактирование и удаление</summary>
          <table style="margin-top:8px">
            <thead><tr><th>Дата</th><th>Поставщик</th><th>Тип</th><th class="num">Сумма</th><th>Комментарий</th><th>Действия</th></tr></thead>
            <tbody>
              ${(erp.supOps || []).map((op, idx) => `
                <tr>
                  <td>${op.date}</td>
                  <td class="bold">${op.supplier}</td>
                  <td>${op.type === 'PAY' ? '<span class="badge badge-green">Оплата / Депозит</span>' : '<span class="badge badge-amber">Закрытие акта</span>'}</td>
                  <td class="num bold">${op.cur === 'USD' ? fmtUsd(op.amt) : fmtR(op.amt)}</td>
                  <td>${op.comment || '—'}</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="btn" style="padding:2px 6px" onclick="editSupOp(${idx})">✏️</button>
                    <button type="button" class="btn btn-danger" style="padding:2px 6px" onclick="delSupOp(${idx})">✕</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </details>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🖥️ Учёт основных средств (ОС) и Амортизация (авто-износ в ОПиУ)</div>
            <div style="font-size:11.5px;color:#64748b">Всего на балансе: <b>${fmtR(totalOsCost)}</b> • Ежемесячная амортизация в ОПиУ: <b class="text-red">${fmtR(totalMonthlyWear)} / мес.</b></div>
          </div>
          <label class="btn" style="cursor:pointer">📥 Импорт «Учёт ОС» (CSV)<input type="file" accept=".csv" style="display:none" onchange="importAssetsCsv(this)"></label>
        </div>

        <form onsubmit="saveErpAsset(event)" class="form-grid" style="grid-template-columns:1fr 1.5fr 0.6fr 1fr 0.7fr 1fr 1fr auto;gap:8px;background:#f8fafc;padding:10px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:12px">
          <div><label>Группа ОС</label><input id="os-group" class="input" list="os-grp-dl" value="${edOs ? (edOs.group || '') : ''}" placeholder="Ноутбуки / Авто">
            <datalist id="os-grp-dl"><option value="Авто"><option value="Ноутбуки"><option value="Моноблок"><option value="Стеллажи"><option value="Камера"><option value="Мебель"><option value="Оборудование"></datalist>
          </div>
          <div><label>Наименование</label><input id="os-name" class="input" required value="${edOs ? edOs.name : ''}" placeholder="Lenovo / Стеллажи"></div>
          <div><label>Кол-во</label><input id="os-qty" type="number" min="1" class="input" value="${edOs ? (edOs.qty || 1) : 1}"></div>
          <div><label>Цена ед. (₽)</label><input id="os-unit-cost" type="number" step="0.01" class="input" required value="${edOs ? (edOs.unitCost || edOs.cost) : ''}"></div>
          <div><label>Срок (мес.)</label><input id="os-months" type="number" min="1" class="input" value="${edOs ? edOs.months : 60}"></div>
          <div><label>Ответственный</label><input id="os-owner" class="input" list="os-own-dl" value="${edOs ? (edOs.owner || '') : ''}" placeholder="Мердан">
            <datalist id="os-own-dl"><option value="Мердан"><option value="Саид"><option value="Курбан"><option value="Касым"><option value="Саша"></datalist>
          </div>
          <div><label>Локация</label><select id="os-loc" class="select">
            <option value="Россия" ${edOs && edOs.location === 'Россия' ? 'selected' : ''}>Россия</option>
            <option value="Туркменистан" ${edOs && edOs.location === 'Туркменистан' ? 'selected' : ''}>Туркменистан</option>
          </select></div>
          <input id="os-date" type="hidden" value="${edOs ? (edOs.startDate || '2026-01-01') : '2026-01-01'}">
          <div style="display:flex;gap:4px">
            <button type="submit" class="btn btn-primary">${edOs ? 'Сохранить' : '+ Добавить ОС'}</button>
            ${edOs ? '<button type="button" class="btn" onclick="editAssetIdx=-1;renderSuppliersAndAssetsTab()">Отмена</button>' : ''}
          </div>
        </form>

        <table>
          <thead><tr><th>Группа</th><th>Наименование</th><th class="num">Кол-во</th><th class="num">Стоимость (₽)</th><th class="num">Срок</th><th class="num">Износ / мес.</th><th>Ответственный / Локация</th><th>Действия</th></tr></thead>
          <tbody>
            ${assets.map((a, idx) => {
              const wear = a.soldAmt || !a.months ? 0 : ((Number(a.cost) || 0) / a.months);
              return `
                <tr>
                  <td><span class="badge badge-blue">${a.group || 'ОС'}</span></td>
                  <td class="bold">${a.name} ${a.soldAmt ? `<span class="badge badge-amber">Продано за ${fmtR(a.soldAmt)}</span>` : ''}</td>
                  <td class="num">${a.qty || 1}</td>
                  <td class="num bold">${fmtR(a.cost)}</td>
                  <td class="num">${a.months || 0} мес.</td>
                  <td class="num bold text-red">${fmtR(wear)}</td>
                  <td style="font-size:12px">${a.owner || '—'} • <b>${a.location || 'Россия'}</b></td>
                  <td style="white-space:nowrap">
                    ${!a.soldAmt ? `<button type="button" class="btn" style="padding:3px 6px;font-size:11px" title="Продать ОС" onclick="sellErpAsset(${idx})">💰</button>` : ''}
                    <button type="button" class="btn" style="padding:3px 6px" onclick="editErpAsset(${idx})">✏️</button>
                    <button type="button" class="btn btn-danger" style="padding:3px 6px" onclick="delErpAsset(${idx})">✕</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:12px">Объекты ОС пока не добавлены.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  };

    function syncAllPatch4Views() {
    if (!window.db) return;

    // 1. Вкладка «Запасы, Брак и Фурнитура» (находим активную секцию по заголовку или id)
    const invSec = document.getElementById('tab-inv') || document.getElementById('tab-stock') ||
      Array.from(document.querySelectorAll('section, .tab-pane, [id^="tab-"]')).find(el =>
        el.offsetParent !== null && (el.textContent || '').includes('Конструктор аксессуаров и фурнитуры')
      );
    if (invSec && !invSec.querySelector('#skos-erp-inv-ready')) {
      invSec.id = 'tab-inv';
      renderErpInventoryTab();
      if (invSec.firstElementChild) invSec.firstElementChild.id = 'skos-erp-inv-ready';
    }

    // 2. Вкладка «Расходы и Налоги (КВ/3)» (находим активную секцию по заголовку или id)
    const finSec = document.getElementById('tab-fin') || document.getElementById('tab-exp') ||
      Array.from(document.querySelectorAll('section, .tab-pane, [id^="tab-"]')).find(el =>
        el.offsetParent !== null && (el.textContent || '').includes('Налоги от бухгалтера')
      );
    if (finSec && finSec.offsetParent !== null) {
      finSec.id = 'tab-fin';
      enhanceFinanceTab();
    }

    // 3. Вкладка «Поставщики и ОС»
    const supSec = document.getElementById('tab-sup');
    if (supSec && supSec.offsetParent !== null && !supSec.querySelector('#skos-erp-sup-ready')) {
      renderSuppliersAndAssetsTab();
      if (supSec.firstElementChild) supSec.firstElementChild.id = 'skos-erp-sup-ready';
    }

    // 4. Обновление карточки «Заморожено в запасах» на Сводке
    const dashSec = document.getElementById('tab-dash');
    if (dashSec && dashSec.offsetParent !== null) {
      const y = document.getElementById('f-yr')?.value || '2026';
      const m = document.getElementById('f-mo')?.value || '11';
      const invMoney = calcTotalInventoryMoney(y, m);
      const dashFrozen = dashSec.querySelector('.kpi-grid > div:last-child .kpi-val, .kpi-grid > div:last-child div[style*="font-size:22px"]');
      if (dashFrozen && invMoney.totalRub > 0) dashFrozen.textContent = fmtR(invMoney.totalRub);
    }
  }

  document.addEventListener('click', function () {
    setTimeout(syncAllPatch4Views, 60);
  });
  setInterval(syncAllPatch4Views, 800);
  setTimeout(syncAllPatch4Views, 200);
})();
