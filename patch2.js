(function () {
  if (window.__skosPatch2Loaded) return;
  window.__skosPatch2Loaded = true;

  const UNDO_KEY = 'skos_v3_undo_snap';
  const GSHEET_KEY = 'skos_v3_gsheet_url';
  const FOLDER_MAP_KEY = 'skos_v3_folder_names';
  let draftReport = null;

  // --- 1. УТИЛИТЫ: ОТКАТ (UNDO), ОБЛАКО И НАЗВАНИЯ ПАПОК ---
  function saveUndoSnapshot(label) {
    try {
      const snap = {
        label: label || 'Действие',
        time: new Date().toLocaleTimeString('ru-RU'),
        skus: JSON.parse(JSON.stringify(db.skus || [])),
        reports: JSON.parse(JSON.stringify(db.reports || [])),
        itemSales: JSON.parse(JSON.stringify(db.itemSales || []))
      };
      sessionStorage.setItem(UNDO_KEY, JSON.stringify(snap));
      updateUndoButtons();
    } catch (e) {}
  }

  window.skosUndoLast = function () {
    const raw = sessionStorage.getItem(UNDO_KEY);
    if (!raw) return alert('Нет действий для отмены.');
    try {
      const snap = JSON.parse(raw);
      if (!confirm('Отменить действие «' + snap.label + '» (от ' + snap.time + ') и вернуть данные назад?')) return;
      db.skus = snap.skus;
      db.reports = snap.reports;
      db.itemSales = snap.itemSales;
      sessionStorage.removeItem(UNDO_KEY);
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
      if (typeof render === 'function') render();
      renderSkuFolders();
      updateUndoButtons();
      alert('Изменения успешно отменены!');
    } catch (e) {
      alert('Ошибка при восстановлении: ' + e.message);
    }
  };

  function updateUndoButtons() {
    const raw = sessionStorage.getItem(UNDO_KEY);
    let label = '';
    if (raw) {
      try { label = JSON.parse(raw).label; } catch (e) {}
    }
    document.querySelectorAll('.skos-undo-btn').forEach(btn => {
      if (label) {
        btn.classList.remove('hidden');
        btn.title = 'Отменить: ' + label;
      } else {
        btn.classList.add('hidden');
      }
    });
  }

  function getFolderNames() {
    try { return JSON.parse(localStorage.getItem(FOLDER_MAP_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setFolderName(art, title) {
    const m = getFolderNames();
    m[art] = title;
    localStorage.setItem(FOLDER_MAP_KEY, JSON.stringify(m));
  }

  function normBc(v) {
    return String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim();
  }

  function normKey(v) {
    return String(v || '').toLowerCase().replace(/[\s\-_]+/g, '').trim();
  }

  function parseNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v || '0').replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function parseCsvLine(line, sep) {
    const res = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        res.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur.trim());
    return res;
  }

  function readSmartText(file, cb) {
    const r = new FileReader();
    r.onload = function (e) {
      const buf = e.target.result;
      let txt = new TextDecoder('utf-8').decode(buf);
      if (txt.includes('\uFFFD')) {
        txt = new TextDecoder('windows-1251').decode(buf);
      }
      cb(txt.replace(/^\uFEFF/, ''));
    };
    r.readAsArrayBuffer(file);
  }

  function findSkuByAny(bcRaw, artRaw) {
    const bc = normBc(bcRaw);
    const art = normBc(artRaw);
    const kBc = normKey(bc);
    const kArt = normKey(art);
    if (!kBc && !kArt) return null;

    let found = db.skus.find(s => normBc(s.bc) === bc && bc !== '');
    if (found) return found;

    if (kBc) {
      found = db.skus.find(s => normKey(s.bc) === kBc);
      if (found) return found;
      const noOzn = kBc.replace(/^ozn/, '');
      found = db.skus.find(s => normKey(s.bc).replace(/^ozn/, '') === noOzn);
      if (found) return found;
    }

    if (kArt) {
      found = db.skus.find(s => normKey(s.bc) === kArt || normKey(s.art) === kArt);
      if (found) return found;
    }
    return null;
  }
  // --- 2. УЛУЧШЕННЫЙ ПАРСЕР ВСЕХ 4 ОТЧЁТОВ МП С ЧЕРНОВИКОМ ---
  function analyzeMpFile(text, selectedMp) {
    const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length < 2) throw new Error('Файл пустой или содержит менее 2 строк.');

    // Определяем тип отчёта автоматически
    const headSample = rawLines.slice(0, 20).join('\n').toLowerCase();
    let detectedType = selectedMp;
    let hdrIdx = 0;

    if (headSample.includes('обоснование для оплаты') || headSample.includes('вайлдберриз реализовал')) {
      detectedType = 'WB';
      hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('обоснование для оплаты'));
    } else if (headSample.includes('группа услуг') && headSample.includes('тип начисления')) {
      detectedType = 'OZON';
      hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('группа услуг'));
    } else if (headSample.includes('ваш sku') && headSample.includes('доставка покупателю')) {
      detectedType = 'YM_ORDERS';
      hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('ваш sku') && l.toLowerCase().includes('название товара'));
    } else if (headSample.includes('все услуги маркета за заказы') || headSample.includes('id бизнес-аккаунта')) {
      detectedType = 'YM_SERVICES';
      hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('статус заказа') && l.toLowerCase().includes('цена продажи'));
    } else {
      hdrIdx = rawLines.findIndex(l => l.toLowerCase().match(/баркод|штрих|sku|артикул|выручка/));
    }
    if (hdrIdx < 0) hdrIdx = 0;

    const sep = (rawLines[hdrIdx].split(';').length >= rawLines[hdrIdx].split(',').length) ? ';' : ',';
    const headers = parseCsvLine(rawLines[hdrIdx], sep);
    const rows = rawLines.slice(hdrIdx + 1).map(l => parseCsvLine(l, sep));

    const colIdx = (regexArr) => {
      for (const rx of regexArr) {
        const i = headers.findIndex(h => rx.test(h.toLowerCase()));
        if (i >= 0) return i;
      }
      return -1;
    };

    let rev = 0, ret = 0, com = 0, log = 0, ads = 0, cogs = 0, sQty = 0, rQty = 0;
    const itemMap = {};
    const missingMap = {};
    const rate = getRate(document.getElementById('up-yr').value + '-' + document.getElementById('up-mo').value);

    const addItemStat = (bc, name, sq, rq, rSum, fSum) => {
      const key = bc || name || 'UNKNOWN';
      if (!itemMap[key]) itemMap[key] = { bc: key, name: name || key, sQty: 0, rQty: 0, rev: 0, fee: 0 };
      itemMap[key].sQty += sq;
      itemMap[key].rQty += rq;
      itemMap[key].rev += rSum;
      itemMap[key].fee += fSum;
    };

    const resolveCogs = (bc, art, name, qty, isReturn) => {
      const sku = findSkuByAny(bc, art);
      if (sku && sku.usd > 0) {
        const rub = sku.usd * rate * qty;
        if (isReturn) cogs -= rub; else cogs += rub;
      } else if (bc || art) {
        const mk = bc || art;
        if (!missingMap[mk]) missingMap[mk] = { bc: mk, name: name || art || bc, qty: 0 };
        missingMap[mk].qty += qty;
      }
    };

    if (detectedType === 'WB') {
      const iArt = colIdx([/^артикул поставщика$/i]);
      const iSiz = colIdx([/^размер$/i]);
      const iBc = colIdx([/^баркод$/i]);
      const iDoc = colIdx([/^тип документа$/i]);
      const iOb = colIdx([/^обоснование для оплаты$/i]);
      const iQty = colIdx([/^кол-во$/i]);
      const iPr = colIdx([/вайлдберриз реализовал товар/i]);
      const iPay = colIdx([/к перечислению продавцу/i]);
      const iLog = colIdx([/услуги по доставке товара/i]);
      const iFine = colIdx([/общая сумма штрафов/i]);
      const iStor = colIdx([/^хранение$/i]);
      const iDed = colIdx([/^удержания$/i]);

      rows.forEach(r => {
        if (r.length < 5) return;
        const doc = iDoc >= 0 ? (r[iDoc] || '').toLowerCase() : '';
        const ob = iOb >= 0 ? (r[iOb] || '').toLowerCase() : '';
        const art = iArt >= 0 ? r[iArt] : '';
        const siz = iSiz >= 0 ? r[iSiz] : '';
        const bc = iBc >= 0 ? r[iBc] : '';
        const artFull = (art + (siz && siz !== '0' ? siz : '')).trim();
        const q = iQty >= 0 ? Math.abs(parseNum(r[iQty])) : 0;
        const vPr = iPr >= 0 ? parseNum(r[iPr]) : 0;
        const vPay = iPay >= 0 ? parseNum(r[iPay]) : 0;
        const vLog = iLog >= 0 ? Math.abs(parseNum(r[iLog])) : 0;
        const vFine = iFine >= 0 ? Math.abs(parseNum(r[iFine])) : 0;
        const vStor = iStor >= 0 ? Math.abs(parseNum(r[iStor])) : 0;
        const vDed = iDed >= 0 ? Math.abs(parseNum(r[iDed])) : 0;

        log += vLog;
        ads += vFine + vDed;
        com += vStor;

        if (doc === 'продажа' && ob === 'продажа') {
          const vCom = Math.max(0, vPr - vPay);
          rev += vPr;
          com += vCom;
          sQty += (q || 1);
          resolveCogs(bc, artFull, art, (q || 1), false);
          addItemStat(bc || artFull, artFull, (q || 1), 0, vPr, vCom + vLog + vFine + vDed);
        } else if (doc === 'возврат' || ob === 'возврат') {
          const vCom = Math.max(0, vPr - vPay);
          ret += vPr;
          com -= vCom;
          rQty += (q || 1);
          resolveCogs(bc, artFull, art, (q || 1), true);
          addItemStat(bc || artFull, artFull, 0, (q || 1), -vPr, vLog - vCom);
        } else {
          if (bc || artFull) addItemStat(bc || artFull, artFull, 0, 0, 0, vLog + vFine + vStor + vDed);
        }
      });
    } else if (detectedType === 'OZON') {
      const iGrp = colIdx([/^группа услуг$/i]);
      const iTyp = colIdx([/^тип начисления$/i]);
      const iArt = colIdx([/^артикул$/i]);
      const iSku = colIdx([/^sku$/i]);
      const iName = colIdx([/^название товара$/i]);
      const iQty = colIdx([/^количество$/i]);
      const iTot = colIdx([/^сумма итого/i]);

      rows.forEach(r => {
        if (r.length < 5) return;
        const grp = iGrp >= 0 ? (r[iGrp] || '').toLowerCase() : '';
        const typ = iTyp >= 0 ? (r[iTyp] || '').toLowerCase() : '';
        const art = iArt >= 0 ? r[iArt] : '';
        const sku = iSku >= 0 ? r[iSku] : '';
        const name = iName >= 0 ? r[iName] : art;
        const q = iQty >= 0 ? Math.abs(parseNum(r[iQty])) : 0;
        const tot = iTot >= 0 ? parseNum(r[iTot]) : 0;
        const bcKey = sku ? ('OZN' + sku) : art;

        if (grp === 'продажи') {
          if (typ === 'выручка') {
            rev += tot;
            sQty += (q || 1);
            resolveCogs(bcKey, art, name, (q || 1), false);
            addItemStat(bcKey || art, art || name, (q || 1), 0, tot, 0);
          } else if (typ.includes('баллы') || typ.includes('программы партн')) {
            rev += tot;
            addItemStat(bcKey || art, art || name, 0, 0, tot, 0);
          }
        } else if (grp === 'возвраты') {
          if (typ === 'возврат выручки') {
            ret += Math.abs(tot);
            rQty += (q || 1);
            resolveCogs(bcKey, art, name, (q || 1), true);
            addItemStat(bcKey || art, art || name, 0, (q || 1), -Math.abs(tot), 0);
          } else if (typ.includes('баллы') || typ.includes('программы партн')) {
            ret += Math.abs(tot);
            addItemStat(bcKey || art, art || name, 0, 0, -Math.abs(tot), 0);
          } else {
            com += (-tot);
          }
        } else if (grp.includes('вознаграждение')) {
          com += (-tot);
          if (bcKey || art) addItemStat(bcKey || art, art || name, 0, 0, 0, -tot);
        } else if (grp.includes('услуги доставки') || grp.includes('услуги агентов')) {
          log += (-tot);
          if (bcKey || art) addItemStat(bcKey || art, art || name, 0, 0, 0, -tot);
        } else if (grp.includes('продвижение') || grp.includes('реклам')) {
          ads += (-tot);
        } else {
          com += (-tot);
        }
      });
    }
    else if (detectedType === 'YM_ORDERS') {
      const iSku = colIdx([/^ваш sku$/i]);
      const iName = colIdx([/^название товара$/i]);
      const iSt = colIdx([/^статус товара$/i]);
      const iQty = colIdx([/^количество/i]);
      const iPrice = colIdx([/^цена продажи/i]);
      const payCols = [];
      const balCols = [];
      headers.forEach((h, idx) => {
        const hl = h.toLowerCase();
        if (hl === 'сумма платежа') payCols.push(idx);
        if (hl === 'сумма баллов') balCols.push(idx);
      });

      rows.forEach(r => {
        if (r.length < 8) return;
        const sku = iSku >= 0 ? r[iSku] : '';
        const name = iName >= 0 ? r[iName] : sku;
        const st = iSt >= 0 ? (r[iSt] || '').toLowerCase() : '';
        const q = iQty >= 0 ? Math.abs(parseNum(r[iQty])) : 1;
        const price = iPrice >= 0 ? parseNum(r[iPrice]) : 0;
        const payIn = payCols.length > 0 ? parseNum(r[payCols[0]]) : 0;
        const balIn = balCols.length > 0 ? parseNum(r[balCols[0]]) : 0;
        const payOut = payCols.length > 1 ? Math.abs(parseNum(r[payCols[1]])) : 0;
        const balOut = balCols.length > 1 ? Math.abs(parseNum(r[balCols[1]])) : 0;

        if (!sku && !name) return;

        if (st.includes('доставлен')) {
          const sum = (payIn + balIn) > 0 ? (payIn + balIn) : (price * q);
          rev += sum;
          sQty += q;
          resolveCogs(sku, sku, name, q, false);
          addItemStat(sku, name, q, 0, sum, 0);
        } else if (st.includes('возврат')) {
          const sum = (payOut + balOut) > 0 ? (payOut + balOut) : (price * q);
          ret += sum;
          rQty += q;
          resolveCogs(sku, sku, name, q, true);
          addItemStat(sku, name, 0, q, -sum, 0);
        }
      });
    } else if (detectedType === 'YM_SERVICES') {
      const iSt = colIdx([/^статус заказа$/i]);
      const iPrice = colIdx([/^цена продажи/i]);
      const iAllSrv = colIdx([/^все услуги маркета за заказы/i]);
      const iBoost = colIdx([/^буст продаж/i]);
      const iLog = colIdx([/^доставка покупателю/i]);

      rows.forEach(r => {
        if (r.length < 6) return;
        const st = iSt >= 0 ? (r[iSt] || '').toLowerCase() : '';
        const price = iPrice >= 0 ? parseNum(r[iPrice]) : 0;
        const srv = iAllSrv >= 0 ? Math.abs(parseNum(r[iAllSrv])) : 0;
        const bst = iBoost >= 0 ? Math.abs(parseNum(r[iBoost])) : 0;
        const dlv = iLog >= 0 ? Math.abs(parseNum(r[iLog])) : 0;

        if (st === 'доставлен') {
          rev += price;
          sQty += 1;
        } else if (st.includes('полный возврат')) {
          ret += price;
          rQty += 1;
        }
        ads += bst;
        log += dlv;
        com += Math.max(0, srv - bst - dlv);
      });
    }

    const mpCode = detectedType.startsWith('YM') ? 'YM' : detectedType;
    const labelMap = {
      WB: 'Wildberries (Детализация)',
      OZON: 'Ozon (Начисления)',
      YM_ORDERS: 'Яндекс Маркет (Заказы и платежи по SKU)',
      YM_SERVICES: 'Яндекс Маркет (Услуги и маржа по заказам)'
    };

    return {
      mp: mpCode,
      detectedLabel: labelMap[detectedType] || detectedType,
      rowsCount: rows.length,
      rev: Math.max(0, rev - ret),
      grossRev: rev,
      ret,
      com: Math.max(0, com),
      log: Math.max(0, log),
      ads: Math.max(0, ads),
      cogs: Math.max(0, cogs),
      sQty,
      rQty,
      bo: (sQty + rQty) > 0 ? Math.round((sQty / (sQty + rQty)) * 100) : 89,
      items: Object.values(itemMap),
      missing: Object.values(missingMap)
    };
  }

  window.onRepFile = function (ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const selectedMp = document.getElementById('up-mp').value;
    readSmartText(f, function (text) {
      try {
        const res = analyzeMpFile(text, selectedMp);
        if (res.mp !== selectedMp) {
          document.getElementById('up-mp').value = res.mp;
        }
        draftReport = {
          fileName: f.name,
          org: document.getElementById('up-org').value,
          yr: document.getElementById('up-yr').value,
          mo: document.getElementById('up-mo').value,
          ...res
        };
        renderDraftBox();
        ev.target.value = '';
      } catch (err) {
        alert('Не удалось разобрать отчёт: ' + err.message);
      }
    });
  };

  function renderDraftBox() {
    const mapBox = document.getElementById('map-box');
    if (!mapBox) return;
    if (!draftReport) {
      mapBox.classList.add('hidden');
      return;
    }
    const d = draftReport;
    const orgObj = (db.orgs || []).find(o => o.id === d.org);
    const orgName = orgObj ? (orgObj.name + ' (' + orgObj.bank + ')') : d.org;
    const profit = d.rev - d.com - d.log - d.ads - d.cogs;

    const dupExists = (db.reports || []).some(r => r.org === d.org && r.mp === d.mp && r.yr === d.yr && r.mo === d.mo && Math.abs(r.rev - d.rev) < 5);

    const missHtml = d.missing.length
      ? `<details style="margin-top:8px;background:#fffbeb;border:1px solid #fcd34d;padding:8px;border-radius:8px;">
          <summary style="cursor:pointer;font-weight:700;color:#b45309;font-size:12px">⚠️ Не найдена себестоимость для ${d.missing.length} ШК/артикулов (нажмите, чтобы посмотреть)</summary>
          <div style="max-height:130px;overflow-y:auto;margin-top:6px;font-size:11.5px;">
            ${d.missing.map(m => `<div>• <b>${m.bc}</b> — ${m.name} (${m.qty} шт.)</div>`).join('')}
          </div>
        </details>`
      : `<div style="margin-top:8px;font-size:12px;color:#059669;font-weight:600">✅ Все проданные товары найдены в базе себестоимости!</div>`;

    mapBox.classList.remove('hidden');
    mapBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <div>
          <span class="badge badge-amber">📝 ЧЕРНОВИК ОТЧЁТА</span>
          <strong style="margin-left:6px;font-size:13px">${d.detectedLabel}</strong>
          <span style="font-size:11.5px;color:#64748b"> • Файл: ${d.fileName} (${d.rowsCount} строк)</span>
        </div>
        <div style="font-size:12px;font-weight:700;color:#1e40af">${orgName} • ${d.mo}.${d.yr}</div>
      </div>
      ${dupExists ? '<div style="padding:8px;margin-bottom:8px;background:#ffe4e6;border:1px solid #fecdd3;color:#be123c;border-radius:8px;font-size:12px;font-weight:700">⛔ Внимание: похожий отчёт по этому юрлицу и периоду уже загружен! Проверьте, чтобы не задвоить цифры.</div>' : ''}
      <div class="kpi-grid" style="margin-bottom:8px">
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Чистая выручка</div><div style="font-size:16px;font-weight:800">${fmtR(d.rev)}</div><div style="font-size:10.5px;color:#64748b">Выкуп: ${d.sQty} шт. (${d.bo}%)</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Возвраты</div><div style="font-size:16px;font-weight:800;color:#e11d48">${fmtR(d.ret)}</div><div style="font-size:10.5px;color:#64748b">${d.rQty} шт.</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Комиссия и услуги</div><div style="font-size:16px;font-weight:800">${fmtR(d.com)}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Логистика</div><div style="font-size:16px;font-weight:800">${fmtR(d.log)}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Реклама и штрафы</div><div style="font-size:16px;font-weight:800">${fmtR(d.ads)}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Себестоимость</div><div style="font-size:16px;font-weight:800">${fmtR(d.cogs)}</div></div>
        <div class="kpi-card highlight" style="padding:10px"><div style="font-size:11px;color:#1d4ed8">Расчётная прибыль</div><div style="font-size:16px;font-weight:800;color:${profit >= 0 ? '#059669' : '#e11d48'}">${fmtR(profit)}</div></div>
      </div>
      ${missHtml}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button type="button" class="btn btn-primary" onclick="commitDraftReport()">✅ Утвердить, сохранить и удалить черновик</button>
        <button type="button" class="btn btn-danger" onclick="discardDraftReport()">🗑️ Удалить черновик без сохранения</button>
      </div>
    `;
  }
  window.commitDraftReport = function () {
    if (!draftReport) return;
    const d = draftReport;
    const per = d.yr + '-' + d.mo;
    if (db.locked[per]) return alert('Этот месяц закрыт от изменений!');

    saveUndoSnapshot('Загрузка отчёта ' + d.mp + ' (' + d.mo + '.' + d.yr + ')');

    db.reports.unshift({
      id: 'r_' + Date.now(),
      org: d.org,
      mp: d.mp,
      yr: d.yr,
      mo: d.mo,
      rev: d.rev,
      ret: d.ret,
      ads: d.ads,
      log: d.log,
      com: d.com,
      cogs: d.cogs,
      bo: d.bo,
      note: d.detectedLabel
    });

    d.items.forEach(it => {
      db.itemSales.push({
        org: d.org,
        mp: d.mp,
        yr: d.yr,
        mo: d.mo,
        bc: it.bc,
        sQty: it.sQty,
        rQty: it.rQty,
        rev: it.rev,
        fee: it.fee
      });
    });

    draftReport = null;
    if (typeof csvRows !== 'undefined') csvRows = [];
    if (typeof csvHdr !== 'undefined') csvHdr = [];
    document.getElementById('map-box').classList.add('hidden');
    document.getElementById('map-box').innerHTML = '';

    if (typeof save === 'function') save();
    if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
    if (typeof render === 'function') render();
    alert('Отчёт учтён! Все данные сохранены, а черновик полностью удалён.');
  };

  window.discardDraftReport = function () {
    draftReport = null;
    if (typeof csvRows !== 'undefined') csvRows = [];
    if (typeof csvHdr !== 'undefined') csvHdr = [];
    const mapBox = document.getElementById('map-box');
    if (mapBox) {
      mapBox.classList.add('hidden');
      mapBox.innerHTML = '';
    }
  };

  // --- 3. ШАБЛОН CSV, ИМПОРТ С РАСПРЕДЕЛЕНИЕМ ПО ПАПКАМ, GOOGLE ТАБЛИЦА И ДУБЛИ ---
  window.downloadSkuTemplateCsv = function () {
    const bom = '\uFEFF';
    const header = 'Артикул продавца;ШК;Название;Себестоимость USD\r\n';
    const sample = [
      'SKOS-B;2043192743629;Брюки мужские зауженные;6,60',
      'SKOS-FK;OZN861358069;Костюм флисовый с пуговицами;9,80',
      'SKOS-YR;SKOS-YR черный48;Рубашка мужская;7,50'
    ].join('\r\n');
    const blob = new Blob([bom + header + sample], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shablon_sebestoimost_SKOS.csv';
    a.click();
  };

  function parseSkuTableText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const sep = (lines.split(';').length >= lines.split(',').length) ? ';' : ',';
    const firstCols = parseCsvLine(lines, sep).map(c => c.toLowerCase());

    let iArt = firstCols.findIndex(c => c.includes('артикул'));
    let iBc = firstCols.findIndex(c => c === 'шк' || c.includes('штрих') || c.includes('баркод') || c.includes('sku'));
    let iName = firstCols.findIndex(c => c.includes('название') || c.includes('наименование'));
    let iUsd = firstCols.findIndex(c => c.includes('себест') || c.includes('usd') || c.includes('цена'));

    let startRow = 1;
    if (iBc < 0 && iUsd < 0) {
      startRow = 0;
      iArt = 0; iBc = 1; iName = 2; iUsd = 3;
    }

    const parsed = [];
    let brokenExp = 0;
    for (let r = startRow; r < lines.length; r++) {
      const c = parseCsvLine(lines[r], sep);
      const bc = normBc(iBc >= 0 ? c[iBc] : '');
      if (!bc) continue;
      if (/e\+/i.test(bc)) { brokenExp++; continue; }
      const art = normBc(iArt >= 0 ? c[iArt] : '');
      const name = normBc(iName >= 0 ? c[iName] : '');
      const usd = iUsd >= 0 ? parseNum(c[iUsd]) : 0;
      parsed.push({ art, bc, name, usd });
    }
    if (brokenExp > 0) {
      alert('Внимание: пропущено ' + brokenExp + ' строк, где Excel испортил штрихкод в вид E+12. Используйте наш CSV-шаблон или Google Таблицу.');
    }
    return parsed;
  }

  function processIncomingSkus(rows, sourceName) {
    if (!rows.length) return alert('В файле не найдено корректных строк с ШК.');

    const uniqueIncoming = new Map();
    rows.forEach(r => uniqueIncoming.set(r.bc, r));
    const list = Array.from(uniqueIncoming.values());

    const existingFolders = {};
    const fNames = getFolderNames();
    db.skus.forEach(s => {
      const folderKey = normBc(s.art) || 'Без артикула';
      if (!existingFolders[folderKey]) {
        existingFolders[folderKey] = fNames[folderKey] || s.name || folderKey;
      }
    });

    const unknownGroups = {};
    const readyToApply = [];

    list.forEach(item => {
      const existingSku = db.skus.find(s => normBc(s.bc) === item.bc);
      if (existingSku) {
        readyToApply.push({ ...item, targetArt: existingSku.art, isExistingSku: true });
        return;
      }

      if (item.art && existingFolders[item.art]) {
        readyToApply.push({ ...item, targetArt: item.art, isExistingSku: false });
        return;
      }

      if (!item.art && item.name) {
        const matchFolder = Object.keys(existingFolders).find(k => existingFolders[k].toLowerCase() === item.name.toLowerCase());
        if (matchFolder) {
          readyToApply.push({ ...item, targetArt: matchFolder, isExistingSku: false });
          return;
        }
      }

      const gKey = (item.art || 'БЕЗ_АРТИКУЛА') + '||' + (item.name || 'Без названия');
      if (!unknownGroups[gKey]) {
        unknownGroups[gKey] = {
          gKey,
          art: item.art,
          name: item.name || item.art || 'Новый товар',
          items: []
        };
      }
      unknownGroups[gKey].items.push(item);
    });

    const groupsArr = Object.values(unknownGroups);
    if (!groupsArr.length) {
      applyImportedSkus(readyToApply, sourceName);
      return;
    }

    openFolderAssignModal(groupsArr, existingFolders, readyToApply, sourceName);
  }
  function openFolderAssignModal(groupsArr, existingFolders, readyToApply, sourceName) {
    let modal = document.getElementById('skos-folder-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'skos-folder-modal';
    modal.className = 'modal-bg';

    const folderOptions = Object.keys(existingFolders).sort().map(k =>
      `<option value="${k}">📁 ${k} — ${existingFolders[k]}</option>`
    ).join('');

    const rowsHtml = groupsArr.map((g, idx) => {
      const defArt = g.art || ('MODEL_' + (idx + 1));
      return `
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin-bottom:10px;background:#f8fafc">
          <div style="font-size:12.5px;font-weight:700;color:#0f172a">
            Группа: <span style="color:#2563eb">${g.art ? g.art + ' — ' : ''}${g.name}</span>
            <span class="badge badge-blue">${g.items.length} ШК</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin:3px 0 8px">Такой папки ещё нет. Выберите, куда добавить эти ШК:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label style="font-size:10.5px;font-weight:700;display:block;margin-bottom:2px">Действие</label>
              <select class="select skos-grp-mode" data-idx="${idx}" onchange="toggleGrpMode(${idx}, this.value)">
                <option value="NEW">➕ Создать новую папку</option>
                <option value="EXIST">📥 Добавить в существующую папку</option>
              </select>
            </div>
            <div id="skos-grp-new-${idx}">
              <label style="font-size:10.5px;font-weight:700;display:block;margin-bottom:2px">Код / Название новой папки</label>
              <input type="text" class="input skos-grp-new-art" data-idx="${idx}" value="${defArt}" placeholder="Например: SKOS-NEW">
            </div>
            <div id="skos-grp-ex-${idx}" class="hidden">
              <label style="font-size:10.5px;font-weight:700;display:block;margin-bottom:2px">Выберите папку</label>
              <select class="select skos-grp-ex-art" data-idx="${idx}">${folderOptions}</select>
            </div>
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="modal-box" style="max-width:640px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="font-size:16px;font-weight:800">📁 Распределение новых товаров по папкам</h3>
          <button class="btn" onclick="document.getElementById('skos-folder-modal').remove()">✕</button>
        </div>
        <p style="font-size:12px;color:#475569;margin-bottom:12px">
          Уже распознано по существующим папкам: <b>${readyToApply.length} ШК</b>. Для новых позиций укажите папку ниже:
        </p>
        <div style="max-height:55vh;overflow-y:auto">${rowsHtml}</div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
          <button class="btn" onclick="document.getElementById('skos-folder-modal').remove()">Отмена</button>
          <button class="btn btn-primary" id="skos-confirm-folders-btn">✅ Сохранить и разложить по папкам</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    window.toggleGrpMode = function (idx, val) {
      document.getElementById('skos-grp-new-' + idx).classList.toggle('hidden', val !== 'NEW');
      document.getElementById('skos-grp-ex-' + idx).classList.toggle('hidden', val !== 'EXIST');
    };

    document.getElementById('skos-confirm-folders-btn').onclick = function () {
      const finalItems = [...readyToApply];
      groupsArr.forEach((g, idx) => {
        const mode = modal.querySelector(`.skos-grp-mode[data-idx="${idx}"]`).value;
        let chosenArt = '';
        if (mode === 'NEW') {
          chosenArt = normBc(modal.querySelector(`.skos-grp-new-art[data-idx="${idx}"]`).value) || g.name || 'Новая папка';
          setFolderName(chosenArt, g.name);
        } else {
          chosenArt = modal.querySelector(`.skos-grp-ex-art[data-idx="${idx}"]`).value;
        }
        const folderTitle = existingFolders[chosenArt] || g.name;
        g.items.forEach(it => {
          finalItems.push({ ...it, targetArt: chosenArt, name: it.name || folderTitle });
        });
      });
      modal.remove();
      applyImportedSkus(finalItems, sourceName);
    };
  }
  function applyImportedSkus(items, sourceName) {
    saveUndoSnapshot('Импорт товаров (' + sourceName + ')');
    let added = 0, updated = 0;

    items.forEach(it => {
      const idx = db.skus.findIndex(s => normBc(s.bc) === it.bc);
      if (idx >= 0) {
        if (it.usd > 0) db.skus[idx].usd = it.usd;
        if (it.name) db.skus[idx].name = it.name;
        if (it.targetArt) db.skus[idx].art = it.targetArt;
        db.skus[idx].isNew = (db.skus[idx].usd || 0) === 0;
        updated++;
      } else {
        db.skus.push({
          id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          name: it.name || it.targetArt || 'Товар',
          art: it.targetArt || 'Без артикула',
          col: '—',
          siz: '—',
          bc: it.bc,
          usd: it.usd || 0,
          src: sourceName,
          isNew: (it.usd || 0) === 0
        });
        added++;
      }
    });

    const seen = new Set();
    db.skus = db.skus.filter(s => {
      const k = normBc(s.bc);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (typeof save === 'function') save();
    if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
    if (typeof render === 'function') render();
    renderSkuFolders();
    alert(`Импорт завершён!\n• Добавлено новых ШК: ${added}\n• Обновлено существующих: ${updated}`);
  }

  window.importCostCsv = function (ev) {
    const f = ev.target.files && ev.target.files;
    if (!f) return;
    readSmartText(f, function (text) {
      const rows = parseSkuTableText(text);
      processIncomingSkus(rows, 'CSV: ' + f.name);
      ev.target.value = '';
    });
  };

  window.importFromGoogleSheet = async function () {
    const inp = document.getElementById('skos-gsheet-url');
    const url = (inp ? inp.value : '').trim();
    if (!url) return alert('Вставьте ссылку на Google Таблицу (доступ: «Все, у кого есть ссылка — Читатель»).');
    localStorage.setItem(GSHEET_KEY, url);

    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return alert('Неверная ссылка. Скопируйте ссылку из адресной строки Google Таблицы.');
    const sheetId = m;
    const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch : '0';
    const exportUrl = `https://google.com{sheetId}/export?format=csv&gid=${gid}`;

    const btn = document.getElementById('skos-gsheet-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Загрузка...'; }
    try {
      const resp = await fetch(exportUrl);
      if (!resp.ok) throw new Error('Нет доступа к таблице. Откройте доступ «Все, у кого есть ссылка».');
      const text = await resp.text();
      if (text.trim().startsWith('<!DOCTYPE')) throw new Error('Таблица закрыта паролем/доступом. Включите доступ по ссылке.');
      const rows = parseSkuTableText(text);
      processIncomingSkus(rows, 'Google Таблица');
    } catch (err) {
      alert('Ошибка Google Таблицы: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '☁️ Из Google Таблицы'; }
    }
  };

  window.dedupSkus = function () {
    saveUndoSnapshot('Удаление дублей ШК');
    const map = new Map();
    let removed = 0;
    db.skus.forEach(s => {
      const k = normBc(s.bc);
      if (!k) { removed++; return; }
      if (!map.has(k)) {
        s.bc = k;
        map.set(k, s);
      } else {
        const prev = map.get(k);
        if ((prev.usd || 0) === 0 && (s.usd || 0) > 0) {
          s.bc = k;
          map.set(k, s);
        }
        removed++;
      }
    });
    db.skus = Array.from(map.values());
    if (typeof save === 'function') save();
    if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
    if (typeof render === 'function') render();
    renderSkuFolders();
    alert('Очистка завершена! Удалено дублей ШК: ' + removed + '. Уникальных ШК в базе: ' + db.skus.length);
  };
  // --- 4. ПАПКИ СЕБЕСТОИМОСТИ, ПОИСК И КАРАНДАШ РЕДАКТИРОВАНИЯ ✏️ ---
  function renderSkuFolders(filterQuery) {
    const tabSku = document.getElementById('tab-sku');
    if (!tabSku || !window.db) return;

    let wrap = document.getElementById('skos-folders-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'skos-folders-wrap';
      wrap.className = 'card';
      tabSku.appendChild(wrap);
    }

    Array.from(tabSku.children).forEach(ch => {
      if (ch !== tabSku.firstElementChild && ch.id !== 'skos-folders-wrap') {
        ch.classList.add('hidden');
      }
    });

    const q = (filterQuery !== undefined ? filterQuery : (document.getElementById('sku-q')?.value || '')).trim().toLowerCase();
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const fNames = getFolderNames();

    const folders = {};
    db.skus.forEach(s => {
      const fKey = normBc(s.art) || 'Без артикула';
      if (!folders[fKey]) {
        folders[fKey] = {
          key: fKey,
          title: fNames[fKey] || s.name || fKey,
          items: []
        };
      }
      if (!q || s.bc.toLowerCase().includes(q) || fKey.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)) {
        folders[fKey].items.push(s);
      }
    });

    const sortedKeys = Object.keys(folders).filter(k => folders[k].items.length > 0).sort();
    const totalShown = sortedKeys.reduce((acc, k) => acc + folders[k].items.length, 0);

    const foldersHtml = sortedKeys.map(k => {
      const f = folders[k];
      const prices = f.items.map(x => x.usd || 0).filter(x => x > 0);
      const minP = prices.length ? Math.min(...prices) : 0;
      const maxP = prices.length ? Math.max(...prices) : 0;
      const priceBadge = minP === maxP ? fmtU(minP) : `${fmtU(minP)} – ${fmtU(maxP)}`;
      const noPriceCnt = f.items.filter(x => !(x.usd > 0)).length;

      const rowsHtml = f.items.slice(0, 300).map(s => `
        <tr class="${!(s.usd > 0) ? 'row-new-sku' : ''}">
          <td style="font-family:monospace;font-weight:700">${s.bc}</td>
          <td>${s.name || '—'}</td>
          <td class="num bold">${fmtU(s.usd)}</td>
          <td class="num" style="color:#64748b">${fmtR((s.usd || 0) * rate)}</td>
          <td style="text-align:right;white-space:nowrap">
            <button type="button" class="btn" style="padding:3px 7px" title="Редактировать ШК" onclick="openEditSkuModal('${s.id}')">✏️</button>
            <button type="button" class="btn btn-danger" title="Удалить ШК" onclick="deleteSingleSku('${s.id}')">✕</button>
          </td>
        </tr>
      `).join('');

      const moreNote = f.items.length > 300 ? `<div style="padding:6px;font-size:11px;color:#64748b">Показаны первые 300 из ${f.items.length} ШК. Используйте поиск выше для точного фильтра.</div>` : '';

      return `
        <details ${q ? 'open' : ''} style="border:1px solid #cbd5e1;border-radius:10px;margin-bottom:8px;background:#fff;overflow:hidden">
          <summary style="cursor:pointer;padding:10px 12px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;user-select:none">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:15px">📁</span>
              <span style="font-weight:800;font-size:13px;color:#0f172a">${f.key}</span>
              <span style="font-size:12.5px;color:#475569">— ${f.title}</span>
              <span class="badge badge-blue">${f.items.length} ШК</span>
              ${noPriceCnt ? `<span class="badge badge-amber">Без цены: ${noPriceCnt}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px" onclick="event.preventDefault()">
              <span class="badge badge-green">${priceBadge}</span>
              <button type="button" class="btn" style="padding:4px 8px;font-size:11.5px" title="Редактировать всю папку (цену или название)" onclick="openEditFolderModal('${encodeURIComponent(f.key)}')">✏️ Папка</button>
            </div>
          </summary>
          <div style="padding:8px 12px;overflow-x:auto">
            <table>
              <thead><tr><th>ШК / Баркод / SKU</th><th>Название</th><th class="num">Себест. $</th><th class="num">Себест. ₽</th><th style="text-align:right">Действия</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            ${moreNote}
          </div>
        </details>
      `;
    }).join('');

    wrap.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">📂 Каталог товаров и себестоимости по папкам (${sortedKeys.length} папок • ${totalShown} ШК)</div>
          <div style="font-size:11.5px;color:#64748b">Нажмите на папку, чтобы открыть список ШК, или нажмите ✏️ для редактирования цены/названия.</div>
        </div>
        <button type="button" class="btn btn-primary" onclick="openAddSingleSkuModal()">+ Добавить 1 ШК вручную</button>
      </div>
      ${foldersHtml || '<div style="padding:16px;text-align:center;color:#64748b">Ничего не найдено по вашему запросу.</div>'}
    `;
  }

  window.searchSku = function (q) {
    const v = (q || '').trim().toLowerCase();
    const box = document.getElementById('sku-q-res');
    if (box) {
      if (!v) {
        box.innerHTML = '';
      } else {
        const cnt = db.skus.filter(s => s.bc.toLowerCase().includes(v) || (s.art || '').toLowerCase().includes(v) || (s.name || '').toLowerCase().includes(v)).length;
        box.innerHTML = cnt > 0
          ? `<span class="badge badge-green">Найдено совпадений: ${cnt}</span>`
          : `<span class="badge badge-red">Не найдено</span>`;
      }
    }
    renderSkuFolders(q);
  };
  window.openEditSkuModal = function (id) {
    const s = db.skus.find(x => x.id === id);
    if (!s) return;
    const fKeys = [...new Set(db.skus.map(x => normBc(x.art) || 'Без артикула'))].sort();
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:12px">✏️ Редактирование карточки ШК</h3>
        <div style="display:grid;gap:10px">
          <div><label style="font-size:11px;font-weight:700">ШК / Баркод / SKU</label><input id="ed-sku-bc" class="input" value="${s.bc}"></div>
          <div><label style="font-size:11px;font-weight:700">Папка (Артикул модели)</label><input id="ed-sku-art" list="skos-art-list" class="input" value="${s.art || ''}"><datalist id="skos-art-list">${fKeys.map(k => `<option value="${k}">`).join('')}</datalist></div>
          <div><label style="font-size:11px;font-weight:700">Название товара</label><input id="ed-sku-name" class="input" value="${s.name || ''}"></div>
          <div><label style="font-size:11px;font-weight:700">Себестоимость ($ USD)</label><input id="ed-sku-usd" type="number" step="0.01" class="input" value="${s.usd || 0}"></div>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
          <button class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button>
          <button class="btn btn-primary" id="ed-sku-save">💾 Сохранить</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('ed-sku-save').onclick = function () {
      const newBc = normBc(document.getElementById('ed-sku-bc').value);
      if (!newBc) return alert('ШК не может быть пустым!');
      if (newBc !== s.bc && db.skus.some(x => normBc(x.bc) === newBc)) {
        return alert('Такой ШК уже существует в базе! Дубли запрещены.');
      }
      saveUndoSnapshot('Редактирование ШК ' + s.bc);
      s.bc = newBc;
      s.art = normBc(document.getElementById('ed-sku-art').value) || 'Без артикула';
      s.name = normBc(document.getElementById('ed-sku-name').value) || s.art;
      s.usd = parseNum(document.getElementById('ed-sku-usd').value);
      s.isNew = s.usd === 0;
      modal.remove();
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
      if (typeof render === 'function') render();
      renderSkuFolders();
    };
  };

  window.openEditFolderModal = function (encodedKey) {
    const fKey = decodeURIComponent(encodedKey);
    const items = db.skus.filter(s => (normBc(s.art) || 'Без артикула') === fKey);
    if (!items.length) return;
    const fNames = getFolderNames();
    const curTitle = fNames[fKey] || items.name || fKey;
    const curUsd = items.usd || 0;

    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:6px">✏️ Редактировать всю папку (${items.length} ШК)</h3>
        <p style="font-size:11.5px;color:#64748b;margin-bottom:12px">Изменения применятся ко всем ${items.length} штрихкодам внутри этой папки.</p>
        <div style="display:grid;gap:10px">
          <div><label style="font-size:11px;font-weight:700">Код папки (Артикул модели)</label><input id="ed-fld-art" class="input" value="${fKey}"></div>
          <div><label style="font-size:11px;font-weight:700">Название модели (для всех ШК в папке)</label><input id="ed-fld-name" class="input" value="${curTitle}"></div>
          <div>
            <label style="font-size:11px;font-weight:700">Новая себестоимость ($ USD) для всех ${items.length} ШК</label>
            <input id="ed-fld-usd" type="number" step="0.01" class="input" value="${curUsd}">
            <label style="display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11.5px;cursor:pointer">
              <input type="checkbox" id="ed-fld-apply-price" checked> Обновить себестоимость $ у всех ШК в этой папке
            </label>
          </div>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
          <button class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button>
          <button class="btn btn-primary" id="ed-fld-save">💾 Применить ко всей папке</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('ed-fld-save').onclick = function () {
      const newArt = normBc(document.getElementById('ed-fld-art').value) || fKey;
      const newName = normBc(document.getElementById('ed-fld-name').value) || curTitle;
      const applyPrice = document.getElementById('ed-fld-apply-price').checked;
      const newUsd = parseNum(document.getElementById('ed-fld-usd').value);

      saveUndoSnapshot('Редактирование папки ' + fKey);
      setFolderName(newArt, newName);
      items.forEach(s => {
        s.art = newArt;
        s.name = newName;
        if (applyPrice) {
          s.usd = newUsd;
          s.isNew = newUsd === 0;
        }
      });
      modal.remove();
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
      if (typeof render === 'function') render();
      renderSkuFolders();
    };
  };
  window.deleteSingleSku = function (id) {
    const s = db.skus.find(x => x.id === id);
    if (!s || !confirm('Удалить ШК ' + s.bc + ' (' + s.name + ')?')) return;
    saveUndoSnapshot('Удаление ШК ' + s.bc);
    db.skus = db.skus.filter(x => x.id !== id);
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    renderSkuFolders();
  };

  window.openAddSingleSkuModal = function () {
    const fKeys = [...new Set(db.skus.map(x => normBc(x.art) || 'Без артикула'))].sort();
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:12px">+ Добавить новый ШК в каталог</h3>
        <div style="display:grid;gap:10px">
          <div><label style="font-size:11px;font-weight:700">ШК / Баркод / SKU *</label><input id="add-sku-bc" class="input" placeholder="Например: 2043192743629"></div>
          <div><label style="font-size:11px;font-weight:700">Папка (Артикул модели) *</label><input id="add-sku-art" list="skos-add-list" class="input" placeholder="Выберите из списка или введите новый"><datalist id="skos-add-list">${fKeys.map(k => `<option value="${k}">`).join('')}</datalist></div>
          <div><label style="font-size:11px;font-weight:700">Название товара</label><input id="add-sku-name" class="input" placeholder="Например: Брюки мужские зауженные"></div>
          <div><label style="font-size:11px;font-weight:700">Себестоимость ($ USD)</label><input id="add-sku-usd" type="number" step="0.01" class="input" placeholder="6.60"></div>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
          <button class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button>
          <button class="btn btn-primary" id="add-sku-save">✅ Добавить</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('add-sku-save').onclick = function () {
      const bc = normBc(document.getElementById('add-sku-bc').value);
      if (!bc) return alert('Введите ШК!');
      if (db.skus.some(x => normBc(x.bc) === bc)) return alert('Такой ШК уже есть в каталоге! Дубли запрещены.');
      const art = normBc(document.getElementById('add-sku-art').value) || 'Без артикула';
      const name = normBc(document.getElementById('add-sku-name').value) || art;
      const usd = parseNum(document.getElementById('add-sku-usd').value);
      saveUndoSnapshot('Добавление ШК ' + bc);
      db.skus.unshift({ id: 's_' + Date.now(), bc, art, name, col: '—', siz: '—', usd, src: 'Вручную', isNew: usd === 0 });
      modal.remove();
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      renderSkuFolders();
    };
  };

  // --- 5. ВСТРАИВАНИЕ КНОПОК В ИНТЕРФЕЙС ---
  function injectControls() {
    const repHeader = document.querySelector('#tab-rep .card-header div:last-child') || document.querySelector('#tab-rep .card-header');
    if (repHeader && !document.getElementById('skos-rep-undo')) {
      const uBtn = document.createElement('button');
      uBtn.id = 'skos-rep-undo';
      uBtn.type = 'button';
      uBtn.className = 'btn btn-amber skos-undo-btn hidden';
      uBtn.textContent = '↩️ Отменить последнее';
      uBtn.onclick = window.skosUndoLast;
      repHeader.appendChild(uBtn);
    }

    const skuCard = document.querySelector('#tab-sku .card');
    if (skuCard && !document.getElementById('skos-tpl-btn')) {
      const btnBar = skuCard.querySelector('.card-header div:last-child');
      if (btnBar) {
        const tplBtn = document.createElement('button');
        tplBtn.id = 'skos-tpl-btn';
        tplBtn.type = 'button';
        tplBtn.className = 'btn';
        tplBtn.textContent = '📄 Шаблон (CSV)';
        tplBtn.onclick = window.downloadSkuTemplateCsv;
        btnBar.insertBefore(tplBtn, btnBar.children[0] || null);

        const undoBtn = document.createElement('button');
        undoBtn.id = 'skos-sku-undo';
        undoBtn.type = 'button';
        undoBtn.className = 'btn btn-amber skos-undo-btn hidden';
        undoBtn.textContent = '↩️ Отменить';
        undoBtn.onclick = window.skosUndoLast;
        btnBar.appendChild(undoBtn);
      }

    updateUndoButtons();
  }

  const origTab = window.tab;
  if (typeof origTab === 'function') {
    window.tab = function (id) {
      origTab.apply(this, arguments);
      injectControls();
      if (id === 'sku') renderSkuFolders();
    };
  }

  const origRender = window.render;
  if (typeof origRender === 'function') {
    window.render = function () {
      origRender.apply(this, arguments);
      injectControls();
      if (window.db && db.tab === 'sku') renderSkuFolders();
    };
  }

  setTimeout(function () {
    injectControls();
    if (window.db && db.tab === 'sku') renderSkuFolders();
  }, 150);
})();
(function () {
  function fixSkuTopBar() {
    const skuCard = document.querySelector('#tab-sku .card');
    if (!skuCard) return;

    // 1. Убираем старую кнопку Шаблон из левого заголовка и убираем строку Google Таблицы
    const oldTpl = document.getElementById('skos-tpl-btn');
    if (oldTpl) oldTpl.remove();

    const gsInp = document.getElementById('skos-gsheet-url');
    if (gsInp && gsInp.parentElement) gsInp.parentElement.remove();

    // 2. Ставим кнопку «📄 Шаблон» строго МЕЖДУ «Импорт» и «Убрать дубли»
    const header = skuCard.querySelector('.card-header');
    if (!header) return;
    const rightBar = header.children[1];
    if (!rightBar || document.getElementById('skos-tpl-mid-btn')) return;

    const dedupBtn = Array.from(rightBar.children).find(el => (el.textContent || '').includes('Убрать дубли'));

    const tplBtn = document.createElement('button');
    tplBtn.id = 'skos-tpl-mid-btn';
    tplBtn.type = 'button';
    tplBtn.className = 'btn btn-primary';
    tplBtn.textContent = '📄 Шаблон';
    tplBtn.title = 'Открыть онлайн-таблицу для быстрого добавления новых ШК или скачать CSV-шаблон';
    tplBtn.onclick = window.openOnlineSkuTemplate;

    if (dedupBtn) {
      rightBar.insertBefore(tplBtn, dedupBtn);
    } else {
      rightBar.appendChild(tplBtn);
    }
  }

  // 3. Онлайн-редактор шаблона (можно заполнить прямо здесь или скачать CSV)
  window.openOnlineSkuTemplate = function () {
    let modal = document.getElementById('skos-online-tpl-modal');
    if (modal) modal.remove();

    const fKeys = [...new Set((db.skus || []).map(x => String(x.art || '').trim()).filter(Boolean))].sort();
    const dlHtml = `<datalist id="skos-tpl-arts">${fKeys.map(k => `<option value="${k}">`).join('')}</datalist>`;

    const makeRow = (art = '', bc = '', name = '', usd = '') => `
      <tr>
        <td><input type="text" class="input tpl-art" list="skos-tpl-arts" value="${art}" placeholder="Например: SKOS-B"></td>
        <td><input type="text" class="input tpl-bc" value="${bc}" placeholder="ШК / Баркод / SKU" style="font-family:monospace"></td>
        <td><input type="text" class="input tpl-name" value="${name}" placeholder="Название (необяз.)"></td>
        <td><input type="number" step="0.01" class="input tpl-usd" value="${usd}" placeholder="6.60" style="text-align:right"></td>
        <td style="text-align:center"><button type="button" class="btn btn-danger" onclick="this.closest('tr').remove()">✕</button></td>
      </tr>
    `;

    modal = document.createElement('div');
    modal.id = 'skos-online-tpl-modal';
    modal.className = 'modal-bg';
    modal.innerHTML = `
      ${dlHtml}
      <div class="modal-box" style="max-width:780px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="font-size:16px;font-weight:800">📄 Шаблон добавления новых товаров и себестоимости</h3>
          <button type="button" class="btn" onclick="document.getElementById('skos-online-tpl-modal').remove()">✕</button>
        </div>
        <p style="font-size:12px;color:#475569;margin-bottom:10px">
          Заполните строки прямо здесь (можно вставлять скопированные столбцы из Excel/таблицы) и нажмите <b>«Сохранить в базу»</b> — программа сама разложит по папкам и проверит дубли.
        </p>
        <div style="max-height:52vh;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px">
          <table>
            <thead>
              <tr>
                <th style="width:22%">Артикул (Папка)</th>
                <th style="width:28%">ШК / Баркод *</th>
                <th style="width:30%">Название товара</th>
                <th style="width:14%" class="num">Себест. $</th>
                <th style="width:6%"></th>
              </tr>
            </thead>
            <tbody id="skos-tpl-tbody">
              ${makeRow()}${makeRow()}${makeRow()}${makeRow()}${makeRow()}
            </tbody>
          </table>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="btn" id="skos-tpl-add-row">+ Добавить строку</button>
            <button type="button" class="btn" onclick="downloadSkuTemplateCsv()">⬇️ Скачать файл шаблона (CSV)</button>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" onclick="document.getElementById('skos-online-tpl-modal').remove()">Отмена</button>
            <button type="button" class="btn btn-primary" id="skos-tpl-save-btn">✅ Сохранить в базу (по папкам)</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const tbody = document.getElementById('skos-tpl-tbody');

    // Поддержка вставки (Ctrl+V) сразу нескольких строк из Excel/Google Таблицы
    tbody.addEventListener('paste', function (e) {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
      e.preventDefault();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      lines.forEach((line, idx) => {
        const cols = line.split('\t').map(c => c.trim());
        const tr = document.createElement('tr');
        tr.innerHTML = makeRow(cols[0] || '', cols[1] || '', cols[2] || '', (cols[3] || '').replace(',', '.')).replace(/^<tr>|<\/tr>$/g, '');
        if (idx === 0 && e.target && e.target.closest('tr')) {
          e.target.closest('tr').replaceWith(tr);
        } else {
          tbody.appendChild(tr);
        }
      });
    });

    document.getElementById('skos-tpl-add-row').onclick = function () {
      const tr = document.createElement('tr');
      tr.innerHTML = makeRow().replace(/^<tr>|<\/tr>$/g, '');
      tbody.appendChild(tr);
    };

    document.getElementById('skos-tpl-save-btn').onclick = function () {
      const lines = ['Артикул продавца;ШК;Название;Себестоимость USD'];
      tbody.querySelectorAll('tr').forEach(tr => {
        const art = tr.querySelector('.tpl-art').value.trim();
        const bc = tr.querySelector('.tpl-bc').value.trim();
        const name = tr.querySelector('.tpl-name').value.trim();
        const usd = tr.querySelector('.tpl-usd').value.trim();
        if (bc) lines.push(`${art};${bc};${name};${usd}`);
      });
      if (lines.length <= 1) return alert('Заполните хотя бы один ШК!');
      modal.remove();
      // Передаём собранные строки в наш стандартный импортёр с проверкой дублей и выбором папки
      const fakeFile = new File([lines.join('\r\n')], 'Онлайн-шаблон.csv', { type: 'text/csv' });
      window.importCostCsv({ target: { files: [fakeFile], value: '' } });
    };
  };

  setInterval(fixSkuTopBar, 400);
  setTimeout(fixSkuTopBar, 200);
})();
(function () {
  function normStr(v) {
    return String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim();
  }
  function toNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(String(v || '0').replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function splitLine(line, sep) {
    const res = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        res.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur.trim());
    return res;
  }
  function readFileAuto(file, cb) {
    const r = new FileReader();
    r.onload = function (e) {
      const buf = e.target.result;
      let txt = new TextDecoder('utf-8').decode(buf);
      if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(buf);
      cb(txt.replace(/^\uFEFF/, ''));
    };
    r.readAsArrayBuffer(file);
  }

  // 1. Исправляем импорт себестоимости (CSV и онлайн-шаблон)
  window.importCostCsv = function (ev) {
    const f = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!f) return;
    readFileAuto(f, function (text) {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (!lines.length) return alert('Файл пустой!');
      const sep = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
      const head = splitLine(lines[0], sep).map(c => c.toLowerCase());

      let iArt = head.findIndex(c => c.includes('артикул'));
      let iBc = head.findIndex(c => c === 'шк' || c.includes('штрих') || c.includes('баркод') || c.includes('sku'));
      let iName = head.findIndex(c => c.includes('название') || c.includes('наименование'));
      let iUsd = head.findIndex(c => c.includes('себест') || c.includes('usd') || c.includes('цена'));

      let startRow = 1;
      if (iBc < 0 && iUsd < 0) {
        startRow = 0;
        iArt = 0; iBc = 1; iName = 2; iUsd = 3;
      }

      const rows = [];
      let broken = 0;
      for (let r = startRow; r < lines.length; r++) {
        const c = splitLine(lines[r], sep);
        const bc = normStr(iBc >= 0 ? c[iBc] : '');
        if (!bc) continue;
        if (/e\+/i.test(bc)) { broken++; continue; }
        rows.push({
          art: normStr(iArt >= 0 ? c[iArt] : ''),
          bc: bc,
          name: normStr(iName >= 0 ? c[iName] : ''),
          usd: iUsd >= 0 ? toNum(c[iUsd]) : 0
        });
      }
      if (broken > 0) {
        alert('Пропущено ' + broken + ' строк с испорченным в Excel штрихкодом (вида E+12).');
      }
      if (!rows.length) return alert('Не найдено ни одной строки с ШК. Проверьте столбцы файла.');

      // Убираем дубли внутри самого файла
      const uniq = new Map();
      rows.forEach(x => uniq.set(x.bc, x));
      const cleanList = Array.from(uniq.values());

      // Собираем существующие папки
      let fNames = {};
      try { fNames = JSON.parse(localStorage.getItem('skos_v3_folder_names') || '{}'); } catch (e) {}
      const existingFolders = {};
      (db.skus || []).forEach(s => {
        const fk = normStr(s.art) || 'Без артикула';
        if (!existingFolders[fk]) existingFolders[fk] = fNames[fk] || s.name || fk;
      });

      const ready = [];
      const unknownMap = {};
      cleanList.forEach(item => {
        const ex = (db.skus || []).find(s => normStr(s.bc) === item.bc);
        if (ex) {
          ready.push({ ...item, targetArt: ex.art });
          return;
        }
        if (item.art && existingFolders[item.art]) {
          ready.push({ ...item, targetArt: item.art });
          return;
        }
        if (!item.art && item.name) {
          const match = Object.keys(existingFolders).find(k => existingFolders[k].toLowerCase() === item.name.toLowerCase());
          if (match) {
            ready.push({ ...item, targetArt: match });
            return;
          }
        }
        const gk = (item.art || 'НОВАЯ') + '||' + (item.name || 'Без названия');
        if (!unknownMap[gk]) unknownMap[gk] = { art: item.art, name: item.name || item.art || 'Новый товар', items: [] };
        unknownMap[gk].items.push(item);
      });

      const groups = Object.values(unknownMap);

      const finishSave = (finalList) => {
        try {
          sessionStorage.setItem('skos_v3_undo_snap', JSON.stringify({
            label: 'Импорт ' + f.name,
            time: new Date().toLocaleTimeString('ru-RU'),
            skus: JSON.parse(JSON.stringify(db.skus || [])),
            reports: JSON.parse(JSON.stringify(db.reports || [])),
            itemSales: JSON.parse(JSON.stringify(db.itemSales || []))
          }));
        } catch (e) {}

        let added = 0, updated = 0;
        finalList.forEach(it => {
          const idx = db.skus.findIndex(s => normStr(s.bc) === it.bc);
          if (idx >= 0) {
            if (it.usd > 0) db.skus[idx].usd = it.usd;
            if (it.name) db.skus[idx].name = it.name;
            if (it.targetArt) db.skus[idx].art = it.targetArt;
            db.skus[idx].isNew = (db.skus[idx].usd || 0) === 0;
            updated++;
          } else {
            db.skus.push({
              id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
              name: it.name || it.targetArt || 'Товар',
              art: it.targetArt || 'Без артикула',
              col: '—', siz: '—', bc: it.bc, usd: it.usd || 0,
              src: f.name, isNew: (it.usd || 0) === 0
            });
            added++;
          }
        });
        const seen = new Set();
        db.skus = db.skus.filter(s => { const k = normStr(s.bc); if (!k || seen.has(k)) return false; seen.add(k); return true; });
        if (typeof save === 'function') save();
        if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
        if (typeof render === 'function') render();
        alert('Импорт выполнен!\n• Добавлено новых ШК: ' + added + '\n• Обновлено: ' + updated);
      };

      if (!groups.length) {
        finishSave(ready);
      } else {
        const modal = document.createElement('div');
        modal.className = 'modal-bg';
        const opts = Object.keys(existingFolders).sort().map(k => `<option value="${k}">📁 ${k} — ${existingFolders[k]}</option>`).join('');
        modal.innerHTML = `
          <div class="modal-box" style="max-width:620px">
            <h3 style="font-size:16px;font-weight:800;margin-bottom:8px">📁 Куда добавить новые товары?</h3>
            <p style="font-size:12px;color:#475569;margin-bottom:10px">Уже совпало с папками: <b>${ready.length} ШК</b>. Для новых укажите папку:</p>
            <div style="max-height:55vh;overflow-y:auto">
              ${groups.map((g, i) => `
                <div style="border:1px solid #cbd5e1;border-radius:9px;padding:10px;margin-bottom:8px;background:#f8fafc">
                  <div style="font-weight:700;font-size:12.5px;margin-bottom:6px">${g.art ? g.art + ' — ' : ''}${g.name} <span class="badge badge-blue">${g.items.length} ШК</span></div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <select class="select g-mode" data-i="${i}" onchange="this.closest('div').querySelector('.g-new').classList.toggle('hidden',this.value!=='NEW');this.closest('div').querySelector('.g-ex').classList.toggle('hidden',this.value==='NEW')">
                      <option value="NEW">➕ Создать новую папку</option>
                      ${opts ? '<option value="EXIST">📥 Добавить в существующую папку</option>' : ''}
                    </select>
                    <input class="input g-new" data-i="${i}" value="${g.art || g.name}" placeholder="Название/код папки">
                    <select class="select g-ex hidden" data-i="${i}">${opts}</select>
                  </div>
                </div>
              `).join('')}
            </div>
            <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px">
              <button class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button>
              <button class="btn btn-primary" id="g-save-ok">✅ Сохранить по папкам</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('g-save-ok').onclick = function () {
          const all = [...ready];
          groups.forEach((g, i) => {
            const m = modal.querySelector(`.g-mode[data-i="${i}"]`).value;
            const art = m === 'NEW'
              ? (normStr(modal.querySelector(`.g-new[data-i="${i}"]`).value) || g.name)
              : modal.querySelector(`.g-ex[data-i="${i}"]`).value;
            if (m === 'NEW') {
              fNames[art] = g.name;
              localStorage.setItem('skos_v3_folder_names', JSON.stringify(fNames));
            }
            g.items.forEach(it => all.push({ ...it, targetArt: art, name: it.name || existingFolders[art] || g.name }));
          });
          modal.remove();
          finishSave(all);
        };
      }
      if (ev.target) ev.target.value = '';
    });
  };

  // 2. Исправляем выбор файла на вкладке Отчёты МП (чтобы точно брался files[0])
  const origOnRep = window.onRepFile;
  window.onRepFile = function (ev) {
    if (ev && ev.target && ev.target.files && ev.target.files[0]) {
      const fileObj = ev.target.files[0];
      const proxyEv = { target: { files: fileObj, value: '' } };
      if (typeof origOnRep === 'function') {
        try { origOnRep(proxyEv); } catch (e) { alert('Ошибка чтения отчёта: ' + e.message); }
      }
      ev.target.value = '';
    }
  };
})();
(function () {
  function cleanUiAndAddFolderDelete() {
    document.querySelectorAll('.skos-undo-btn, #skos-rep-undo, #skos-sku-undo').forEach(b => b.remove());

    const wrap = document.getElementById('skos-folders-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('summary button').forEach(btn => {
      if (!(btn.textContent || '').includes('Папка')) return;
      const box = btn.parentElement;
      if (!box || box.querySelector('.skos-del-folder-btn')) return;

      const m = (btn.getAttribute('onclick') || '').match(/openEditFolderModal\('([^']+)'\)/);
      if (!m || !m) return;
      const encKey = m;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger skos-del-folder-btn';
      delBtn.style.cssText = 'padding:4px 8px;font-size:11.5px;margin-left:4px';
      delBtn.title = 'Удалить всю папку';
      delBtn.textContent = '✕';
      delBtn.setAttribute('onclick', `event.stopPropagation(); deleteWholeFolder('${encKey}')`);
      box.appendChild(delBtn);
    });
  }

  function normS(v) { return String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim(); }
  function normK(v) { return String(v || '').toLowerCase().replace(/[\s\-_]+/g, '').trim(); }
  function pNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(String(v || '0').replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function pCsvLine(line, sep) {
    const res = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        res.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur.trim());
    return res;
  }

  function findSkuSmart(bcRaw, artRaw) {
    const bc = normS(bcRaw), art = normS(artRaw);
    const kBc = normK(bc), kArt = normK(art);
    if (!kBc && !kArt) return null;
    let f = (db.skus || []).find(s => normS(s.bc) === bc && bc !== '');
    if (f) return f;
    if (kBc) {
      f = (db.skus || []).find(s => normK(s.bc) === kBc);
      if (f) return f;
      const noOzn = kBc.replace(/^ozn/, '');
      f = (db.skus || []).find(s => normK(s.bc).replace(/^ozn/, '') === noOzn);
      if (f) return f;
    }
    if (kArt) {
      f = (db.skus || []).find(s => normK(s.bc) === kArt || normK(s.art) === kArt);
      if (f) return f;
    }
    return null;
  }

  let currentDraft = null;
  function parseAndShowDraft(file) {
    const r = new FileReader();
    r.onload = function (e) {
      try {
        const buf = e.target.result;
        let text = new TextDecoder('utf-8').decode(buf);
        if (text.includes('\uFFFD')) text = new TextDecoder('windows-1251').decode(buf);
        text = text.replace(/^\uFEFF/, '');

        const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (rawLines.length < 2) return alert('Файл пустой или слишком короткий.');

        const headSample = rawLines.slice(0, 20).join('\n').toLowerCase();
        let det = document.getElementById('up-mp').value;
        let hdrIdx = 0;

        if (headSample.includes('обоснование для оплаты') || headSample.includes('вайлдберриз реализовал')) {
          det = 'WB';
          hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('обоснование для оплаты'));
        } else if (headSample.includes('группа услуг') && headSample.includes('тип начисления')) {
          det = 'OZON';
          hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('группа услуг'));
        } else if (headSample.includes('ваш sku') && headSample.includes('доставка покупателю')) {
          det = 'YM_ORDERS';
          hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('ваш sku') && l.toLowerCase().includes('название товара'));
        } else if (headSample.includes('все услуги маркета за заказы') || headSample.includes('id бизнес-аккаунта')) {
          det = 'YM_SERVICES';
          hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('статус заказа') && l.toLowerCase().includes('цена продажи'));
        } else {
          hdrIdx = rawLines.findIndex(l => l.toLowerCase().match(/баркод|штрих|sku|артикул|выручка/));
        }
        if (hdrIdx < 0) hdrIdx = 0;

        const sep = (rawLines[hdrIdx].split(';').length >= rawLines[hdrIdx].split(',').length) ? ';' : ',';
        const headers = pCsvLine(rawLines[hdrIdx], sep);
        const rows = rawLines.slice(hdrIdx + 1).map(l => pCsvLine(l, sep));

        const col = (rxs) => {
          for (const rx of rxs) {
            const i = headers.findIndex(h => rx.test(h.toLowerCase()));
            if (i >= 0) return i;
          }
          return -1;
        };

        let rev = 0, ret = 0, com = 0, log = 0, ads = 0, cogs = 0, sQty = 0, rQty = 0;
        const itemMap = {}, missMap = {};
        const yr = document.getElementById('up-yr').value;
        const mo = document.getElementById('up-mo').value;
        const org = document.getElementById('up-org').value;
        const rate = typeof getRate === 'function' ? getRate(yr + '-' + mo) : 96.5;

        const addIt = (bc, name, sq, rq, rSum, fSum) => {
          const k = bc || name || 'UNKNOWN';
          if (!itemMap[k]) itemMap[k] = { bc: k, name: name || k, sQty: 0, rQty: 0, rev: 0, fee: 0 };
          itemMap[k].sQty += sq; itemMap[k].rQty += rq; itemMap[k].rev += rSum; itemMap[k].fee += fSum;
        };
        const addCogs = (bc, art, name, q, isRet) => {
          const sku = findSkuSmart(bc, art);
          if (sku && sku.usd > 0) {
            const rub = sku.usd * rate * q;
            if (isRet) cogs -= rub; else cogs += rub;
          } else if (bc || art) {
            const mk = bc || art;
            if (!missMap[mk]) missMap[mk] = { bc: mk, name: name || art || bc, qty: 0 };
            missMap[mk].qty += q;
          }
        };

        if (det === 'WB') {
          const iArt = col([/^артикул поставщика$/i]), iSiz = col([/^размер$/i]), iBc = col([/^баркод$/i]);
          const iDoc = col([/^тип документа$/i]), iOb = col([/^обоснование для оплаты$/i]), iQty = col([/^кол-во$/i]);
          const iPr = col([/вайлдберриз реализовал товар/i]), iPay = col([/к перечислению продавцу/i]);
          const iLog = col([/услуги по доставке товара/i]), iFine = col([/общая сумма штрафов/i]);
          const iStor = col([/^хранение$/i]), iDed = col([/^удержания$/i]);

          rows.forEach(rw => {
            if (rw.length < 5) return;
            const doc = iDoc >= 0 ? (rw[iDoc] || '').toLowerCase() : '';
            const ob = iOb >= 0 ? (rw[iOb] || '').toLowerCase() : '';
            const art = iArt >= 0 ? rw[iArt] : '', siz = iSiz >= 0 ? rw[iSiz] : '', bc = iBc >= 0 ? rw[iBc] : '';
            const artFull = (art + (siz && siz !== '0' ? siz : '')).trim();
            const q = iQty >= 0 ? Math.abs(pNum(rw[iQty])) : 0;
            const vPr = iPr >= 0 ? pNum(rw[iPr]) : 0, vPay = iPay >= 0 ? pNum(rw[iPay]) : 0;
            const vLog = iLog >= 0 ? Math.abs(pNum(rw[iLog])) : 0;
            const vFine = iFine >= 0 ? Math.abs(pNum(rw[iFine])) : 0;
            const vStor = iStor >= 0 ? Math.abs(pNum(rw[iStor])) : 0;
            const vDed = iDed >= 0 ? Math.abs(pNum(rw[iDed])) : 0;

            log += vLog; ads += vFine + vDed; com += vStor;
            if (doc === 'продажа' && ob === 'продажа') {
              const vCom = Math.max(0, vPr - vPay);
              rev += vPr; com += vCom; sQty += (q || 1);
              addCogs(bc, artFull, art, (q || 1), false);
              addIt(bc || artFull, artFull, (q || 1), 0, vPr, vCom + vLog + vFine + vDed);
            } else if (doc === 'возврат' || ob === 'возврат') {
              const vCom = Math.max(0, vPr - vPay);
              ret += vPr; com -= vCom; rQty += (q || 1);
              addCogs(bc, artFull, art, (q || 1), true);
              addIt(bc || artFull, artFull, 0, (q || 1), -vPr, vLog - vCom);
            } else if (bc || artFull) {
              addIt(bc || artFull, artFull, 0, 0, 0, vLog + vFine + vStor + vDed);
            }
          });
        } else if (det === 'OZON') {
          const iGrp = col([/^группа услуг$/i]), iTyp = col([/^тип начисления$/i]);
          const iArt = col([/^артикул$/i]), iSku = col([/^sku$/i]), iName = col([/^название товара$/i]);
          const iQty = col([/^количество$/i]), iTot = col([/^сумма итого/i]);

          rows.forEach(rw => {
            if (rw.length < 5) return;
            const grp = iGrp >= 0 ? (rw[iGrp] || '').toLowerCase() : '';
            const typ = iTyp >= 0 ? (rw[iTyp] || '').toLowerCase() : '';
            const art = iArt >= 0 ? rw[iArt] : '', sku = iSku >= 0 ? rw[iSku] : '';
            const name = iName >= 0 ? rw[iName] : art;
            const q = iQty >= 0 ? Math.abs(pNum(rw[iQty])) : 0;
            const tot = iTot >= 0 ? pNum(rw[iTot]) : 0;
            const bcKey = sku ? ('OZN' + sku) : art;

            if (grp === 'продажи') {
              if (typ === 'выручка') {
                rev += tot; sQty += (q || 1);
                addCogs(bcKey, art, name, (q || 1), false);
                addIt(bcKey || art, art || name, (q || 1), 0, tot, 0);
              } else if (typ.includes('баллы') || typ.includes('программы партн')) {
                rev += tot; addIt(bcKey || art, art || name, 0, 0, tot, 0);
              }
            } else if (grp === 'возвраты') {
              if (typ === 'возврат выручки') {
                ret += Math.abs(tot); rQty += (q || 1);
                addCogs(bcKey, art, name, (q || 1), true);
                addIt(bcKey || art, art || name, 0, (q || 1), -Math.abs(tot), 0);
              } else if (typ.includes('баллы') || typ.includes('программы партн')) {
                ret += Math.abs(tot); addIt(bcKey || art, art || name, 0, 0, -Math.abs(tot), 0);
              } else {
                com += (-tot);
              }
            } else if (grp.includes('вознаграждение')) {
              com += (-tot); if (bcKey || art) addIt(bcKey || art, art || name, 0, 0, 0, -tot);
            } else if (grp.includes('услуги доставки') || grp.includes('услуги агентов')) {
              log += (-tot); if (bcKey || art) addIt(bcKey || art, art || name, 0, 0, 0, -tot);
            } else if (grp.includes('продвижение') || grp.includes('реклам')) {
              ads += (-tot);
            } else {
              com += (-tot);
            }
          });
        }
        else if (det === 'YM_ORDERS') {
          const iSku = col([/^ваш sku$/i]), iName = col([/^название товара$/i]);
          const iSt = col([/^статус товара$/i]), iQty = col([/^количество/i]), iPrice = col([/^цена продажи/i]);
          const payCols = [], balCols = [];
          headers.forEach((h, idx) => {
            if (h.toLowerCase() === 'сумма платежа') payCols.push(idx);
            if (h.toLowerCase() === 'сумма баллов') balCols.push(idx);
          });

          rows.forEach(rw => {
            if (rw.length < 8) return;
            const sku = iSku >= 0 ? rw[iSku] : '', name = iName >= 0 ? rw[iName] : sku;
            const st = iSt >= 0 ? (rw[iSt] || '').toLowerCase() : '';
            const q = iQty >= 0 ? Math.abs(pNum(rw[iQty])) : 1;
            const price = iPrice >= 0 ? pNum(rw[iPrice]) : 0;
            const payIn = payCols.length > 0 ? pNum(rw[payCols[0]]) : 0;
            const balIn = balCols.length > 0 ? pNum(rw[balCols[0]]) : 0;
            const payOut = payCols.length > 1 ? Math.abs(pNum(rw[payCols[1]])) : 0;
            const balOut = balCols.length > 1 ? Math.abs(pNum(rw[balCols[1]])) : 0;
            if (!sku && !name) return;

            if (st.includes('доставлен')) {
              const sum = (payIn + balIn) > 0 ? (payIn + balIn) : (price * q);
              rev += sum; sQty += q;
              addCogs(sku, sku, name, q, false);
              addIt(sku, name, q, 0, sum, 0);
            } else if (st.includes('возврат')) {
              const sum = (payOut + balOut) > 0 ? (payOut + balOut) : (price * q);
              ret += sum; rQty += q;
              addCogs(sku, sku, name, q, true);
              addIt(sku, name, 0, q, -sum, 0);
            }
          });
        } else if (det === 'YM_SERVICES') {
          const iSt = col([/^статус заказа$/i]), iPrice = col([/^цена продажи/i]);
          const iAllSrv = col([/^все услуги маркета за заказы/i]), iBoost = col([/^буст продаж/i]), iLog = col([/^доставка покупателю/i]);

          rows.forEach(rw => {
            if (rw.length < 6) return;
            const st = iSt >= 0 ? (rw[iSt] || '').toLowerCase() : '';
            const price = iPrice >= 0 ? pNum(rw[iPrice]) : 0;
            const srv = iAllSrv >= 0 ? Math.abs(pNum(rw[iAllSrv])) : 0;
            const bst = iBoost >= 0 ? Math.abs(pNum(rw[iBoost])) : 0;
            const dlv = iLog >= 0 ? Math.abs(pNum(rw[iLog])) : 0;
            if (st === 'доставлен') { rev += price; sQty += 1; }
            else if (st.includes('полный возврат')) { ret += price; rQty += 1; }
            ads += bst; log += dlv; com += Math.max(0, srv - bst - dlv);
          });
        }

        const mpCode = det.startsWith('YM') ? 'YM' : det;
        document.getElementById('up-mp').value = mpCode;
        const labels = {
          WB: 'Wildberries (Детализация)',
          OZON: 'Ozon (Начисления)',
          YM_ORDERS: 'Яндекс Маркет (Заказы и платежи по SKU)',
          YM_SERVICES: 'Яндекс Маркет (Услуги и маржа по заказам)'
        };

        currentDraft = {
          fileName: file.name, org, mp: mpCode, yr, mo,
          detectedLabel: labels[det] || det,
          rowsCount: rows.length,
          rev: Math.max(0, rev - ret),
          ret, com: Math.max(0, com), log: Math.max(0, log), ads: Math.max(0, ads), cogs: Math.max(0, cogs),
          sQty, rQty,
          bo: (sQty + rQty) > 0 ? Math.round((sQty / (sQty + rQty)) * 100) : 89,
          items: Object.values(itemMap),
          missing: Object.values(missMap)
        };
        drawDraftCard();
      } catch (err) {
        alert('Ошибка разбора файла: ' + err.message);
      }
    };
    r.readAsArrayBuffer(file);
  }

  function drawDraftCard() {
    const mapBox = document.getElementById('map-box');
    if (!mapBox) return;
    if (!currentDraft) { mapBox.classList.add('hidden'); mapBox.innerHTML = ''; return; }
    const d = currentDraft;
    const orgObj = (db.orgs || []).find(o => o.id === d.org);
    const orgName = orgObj ? (orgObj.name + ' (' + orgObj.bank + ')') : d.org;
    const profit = d.rev - d.com - d.log - d.ads - d.cogs;

    const missHtml = d.missing.length
      ? `<details style="margin-top:8px;background:#fffbeb;border:1px solid #fcd34d;padding:8px;border-radius:8px;">
          <summary style="cursor:pointer;font-weight:700;color:#b45309;font-size:12px">⚠️ Не найдена себестоимость для ${d.missing.length} ШК/артикулов</summary>
          <div style="max-height:130px;overflow-y:auto;margin-top:6px;font-size:11.5px;">
            ${d.missing.map(m => `<div>• <b>${m.bc}</b> — ${m.name} (${m.qty} шт.)</div>`).join('')}
          </div>
        </details>`
      : `<div style="margin-top:8px;font-size:12px;color:#059669;font-weight:600">✅ Все товары найдены в базе себестоимости!</div>`;

    mapBox.classList.remove('hidden');
    mapBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <div>
          <span class="badge badge-amber">📝 ЧЕРНОВИК ОТЧЁТА</span>
          <strong style="margin-left:6px;font-size:13px">${d.detectedLabel}</strong>
          <span style="font-size:11.5px;color:#64748b"> • ${d.fileName} (${d.rowsCount} строк)</span>
        </div>
        <div style="font-size:12px;font-weight:700;color:#1e40af">${orgName} • ${d.mo}.${d.yr}</div>
      </div>
      <div class="kpi-grid" style="margin-bottom:8px">
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Чистая выручка</div><div style="font-size:16px;font-weight:800">${fmtR(d.rev)}</div><div style="font-size:10.5px;color:#64748b">Выкуп: ${d.sQty} шт. (${d.bo}%)</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Возвраты</div><div style="font-size:16px;font-weight:800;color:#e11d48">${fmtR(d.ret)}</div><div style="font-size:10.5px;color:#64748b">${d.rQty} шт.</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Комиссия и услуги</div><div style="font-size:16px;font-weight:800">${fmtR(d.com)}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Логистика</div><div style="font-size:16px;font-weight:800">${fmtR(d.log)}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Реклама и штрафы</div><div style="font-size:16px;font-weight:800">${fmtR(d.ads)}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:11px;color:#64748b">Себестоимость</div><div style="font-size:16px;font-weight:800">${fmtR(d.cogs)}</div></div>
        <div class="kpi-card highlight" style="padding:10px"><div style="font-size:11px;color:#1d4ed8">Расчётная прибыль</div><div style="font-size:16px;font-weight:800;color:${profit >= 0 ? '#059669' : '#e11d48'}">${fmtR(profit)}</div></div>
      </div>
      ${missHtml}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="btn-commit-draft-2">✅ Утвердить, сохранить и удалить черновик</button>
        <button type="button" class="btn btn-danger" id="btn-drop-draft-2">🗑️ Удалить черновик</button>
      </div>
    `;

    document.getElementById('btn-commit-draft-2').onclick = function () {
      if (!currentDraft) return;
      const x = currentDraft;
      if (db.locked && db.locked[x.yr + '-' + x.mo]) return alert('Этот месяц закрыт от изменений!');
      db.reports.unshift({
        id: 'r_' + Date.now(), org: x.org, mp: x.mp, yr: x.yr, mo: x.mo,
        rev: x.rev, ret: x.ret, ads: x.ads, log: x.log, com: x.com, cogs: x.cogs, bo: x.bo, note: x.detectedLabel
      });
      x.items.forEach(it => {
        db.itemSales.push({ org: x.org, mp: x.mp, yr: x.yr, mo: x.mo, bc: it.bc, sQty: it.sQty, rQty: it.rQty, rev: it.rev, fee: it.fee });
      });
      currentDraft = null;
      drawDraftCard();
      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
      if (typeof render === 'function') render();
      alert('Отчёт учтён! Все данные сохранены, черновик удалён.');
    };

    document.getElementById('btn-drop-draft-2').onclick = function () {
      currentDraft = null;
      drawDraftCard();
    };
  }

  window.onRepFile = function (ev) {
    const f = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!f) return;
    parseAndShowDraft(f);
    ev.target.value = '';
  };

  setInterval(function () {
    cleanUiAndAddFolderDelete();
    const inp = document.getElementById('rep-file');
    if (inp && !inp.dataset.skosBound) {
      inp.dataset.skosBound = '1';
      inp.onchange = window.onRepFile;
    }
  }, 350);
  setTimeout(cleanUiAndAddFolderDelete, 150);
})();
(function () {
  // 1. Скрываем через CSS любые старые кнопки «Отменить» и блок Google Таблицы мгновенно (без мелькания)
  const st = document.createElement('style');
  st.textContent = '.skos-undo-btn, #skos-rep-undo, #skos-sku-undo, #skos-tpl-btn { display: none !important; }';
  document.head.appendChild(st);

  // 2. Умный поиск себестоимости: 13/14-значный GTIN (с нулём спереди), Ozon ID, и авто-подхват по коду папки (SKOS-...)
  window.findSkuSmartGlobal = function (bcRaw, artRaw, nameRaw) {
    const clean = v => String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim();
    const key = v => clean(v).toLowerCase().replace(/[\s\-_]+/g, '');
    const stripZeros = v => v.replace(/^0+/, '');

    const bc = clean(bcRaw), art = clean(artRaw), name = clean(nameRaw);
    const kBc = key(bc), kArt = key(art);
    const list = window.db && Array.isArray(db.skus) ? db.skus : [];
    if (!list.length) return null;

    // Шаг 1: Точное совпадение по ШК
    if (bc) {
      let f = list.find(s => clean(s.bc) === bc);
      if (f && f.usd > 0) return f;
    }

    // Шаг 2: Совпадение по GTIN без ведущих нулей (04680712809212 == 4680712809212) и OZN ID (861358069 == OZN861358069)
    if (kBc) {
      const bcNoZero = stripZeros(kBc.replace(/^ozn/, ''));
      let f = list.find(s => {
        const sBc = stripZeros(key(s.bc).replace(/^ozn/, ''));
        return sBc && sBc === bcNoZero && s.usd > 0;
      });
      if (f) return f;
    }

    // Шаг 3: Совпадение по артикулу
    if (kArt) {
      let f = list.find(s => (key(s.bc) === kArt || key(s.art) === kArt) && s.usd > 0);
      if (f) return f;
    }

    // Шаг 4: Вытаскиваем код модели SKOS-... из артикула или названия (например "skos-kcyk черный" -> "SKOS-KCYK")
    const combo = (art + ' ' + name + ' ' + bc).toUpperCase();
    const modelMatch = combo.match(/\b(SKOS-[A-ZА-Я0-9]+)\b/);
    if (modelMatch) {
      const modelCode = modelMatch;
      let f = list.find(s => clean(s.art).toUpperCase() === modelCode && s.usd > 0);
      if (f) return f;
    }

    return null;
  };

  // Переопределяем разбор отчёта так, чтобы он использовал findSkuSmartGlobal (GTIN + Ozon ID + код папки SKOS-...)
  const origOnRep = window.onRepFile;
  window.onRepFile = function (ev) {
    const f = ev && ev.target && ev.target.files && ev.target.files;
    if (!f) return;
    const r = new FileReader();
    r.onload = function (e) {
      const buf = e.target.result;
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1251').decode(buf);
      text = text.replace(/^\uFEFF/, '');

      // Вызываем стандартный разбор через оригинальный обработчик, а затем пересчитываем себестоимость по умному поиску
      if (typeof origOnRep === 'function') {
        origOnRep({ target: { files: [f], value: '' } });
      }
      setTimeout(function () {
        const box = document.getElementById('map-box');
        if (!box || box.classList.contains('hidden')) return;
        // Дополнительно проверяем список ненайденных — если findSkuSmartGlobal их находит, пересчитываем!
        const yr = document.getElementById('up-yr').value;
        const mo = document.getElementById('up-mo').value;
        const rate = typeof getRate === 'function' ? getRate(yr + '-' + mo) : 96.5;

        const missDivs = box.querySelectorAll('details div div');
        if (!missDivs.length) return;

        let recoveredRub = 0;
        let stillMissing = [];
        missDivs.forEach(div => {
          const txt = div.textContent || '';
          const m = txt.match(/•\s*([^\s—]+)\s*—\s*(.+?)\s*\((\d+)\s*шт\.\)/);
          if (!m) return;
          const bc = m, name = m, qty = parseInt(m, 10) || 1;
          const found = window.findSkuSmartGlobal(bc, name, name);
          if (found && found.usd > 0) {
            recoveredRub += found.usd * rate * qty;
          } else {
            stillMissing.push(div.outerHTML);
          }
        });

        if (recoveredRub > 0) {
          // Обновляем отображаемую себестоимость и прибыль в черновике
          const cards = box.querySelectorAll('.kpi-card');
          if (cards.length >= 7) {
            const curCogs = parseFloat((cards.children.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
            const curProf = parseFloat((cards.children.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
            const newCogs = Math.round(curCogs + recoveredRub);
            const newProf = Math.round(curProf - recoveredRub);
            cards.children.textContent = fmtR(newCogs);
            cards.children.textContent = fmtR(newProf);
            cards.children.style.color = newProf >= 0 ? '#059669' : '#e11d48';
          }
          const detEl = box.querySelector('details');
          if (detEl) {
            if (!stillMissing.length) {
              detEl.outerHTML = '<div style="margin-top:8px;font-size:12px;color:#059669;font-weight:600">✅ Все товары автоматически распознаны по GTIN / ID / коду модели!</div>';
            } else {
              detEl.querySelector('summary').textContent = '⚠️ Не найдена себестоимость для ' + stillMissing.length + ' ШК/артикулов';
              detEl.querySelector('div').innerHTML = stillMissing.join('');
            }
          }
        }
      }, 120);
    };
    r.readAsArrayBuffer(f);
    ev.target.value = '';
  };
})();
(function () {
  // 1. Блокируем 5-секундное появление Google Таблицы на вкладке товаров
  const hideGoogleOnce = setInterval(function () {
    const inp = document.getElementById('skos-gsheet-url');
    if (inp && inp.parentElement) {
      inp.parentElement.remove();
      clearInterval(hideGoogleOnce);
    }
  }, 30);
  setTimeout(function () { clearInterval(hideGoogleOnce); }, 6000);

  // 2. Усиленная пакетная загрузка отчётов WB / Ozon / ЯМ с накоплением в черновике и автоочисткой
  let multiBatch = null;

  function normClean(v) { return String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim(); }
  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(String(v || '0').replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function parseLineCsv(line, sep) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line.charAt(i);
      if (ch === '"') {
        if (inQ && line.charAt(i + 1) === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        out.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  function matchProductCost(bcRaw, artRaw, nameRaw) {
    const clean = v => normClean(v).toLowerCase().replace(/[\s\-_]+/g, '');
    const noZero = v => v.replace(/^0+/, '').replace(/^ozn/, '');
    const kBc = noZero(clean(bcRaw));
    const kArt = clean(artRaw);
    const list = (window.db && Array.isArray(db.skus)) ? db.skus : [];

    if (kBc) {
      const f = list.find(s => s.usd > 0 && noZero(clean(s.bc)) === kBc);
      if (f) return f;
    }
    if (kArt) {
      const f = list.find(s => s.usd > 0 && (clean(s.art) === kArt || clean(s.bc) === kArt));
      if (f) return f;
    }
    const combo = (String(artRaw || '') + ' ' + String(nameRaw || '')).toUpperCase();
    const m = combo.match(/\b(SKOS-[A-ZА-Я0-9]+)\b/);
    if (m) {
      const code = m.at(1);
      const f = list.find(s => s.usd > 0 && normClean(s.art).toUpperCase() === code);
      if (f) return f;
    }
    return null;
  }
  function readSingleMpFile(file, rate) {
    return new Promise(resolve => {
      const r = new FileReader();
      r.onload = function (e) {
        try {
          const buf = e.target.result;
          let text = new TextDecoder('utf-8').decode(buf);
          if (text.includes('\uFFFD')) text = new TextDecoder('windows-1251').decode(buf);
          text = text.replace(/^\uFEFF/, '');

          const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          if (rawLines.length < 2) return resolve(null);

          const sample = rawLines.slice(0, 20).join('\n').toLowerCase();
          let det = document.getElementById('up-mp').value;
          let hdrIdx = 0;

          if (sample.includes('обоснование для оплаты') || sample.includes('вайлдберриз реализовал')) {
            det = 'WB';
            hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('обоснование для оплаты'));
          } else if (sample.includes('группа услуг') && sample.includes('тип начисления')) {
            det = 'OZON';
            hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('группа услуг'));
          } else if (sample.includes('ваш sku') && sample.includes('доставка покупателю')) {
            det = 'YM_ORDERS';
            hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('ваш sku') && l.toLowerCase().includes('название товара'));
          } else if (sample.includes('все услуги маркета за заказы') || sample.includes('id бизнес-аккаунта')) {
            det = 'YM_SERVICES';
            hdrIdx = rawLines.findIndex(l => l.toLowerCase().includes('статус заказа') && l.toLowerCase().includes('цена продажи'));
          } else {
            hdrIdx = rawLines.findIndex(l => l.toLowerCase().match(/баркод|штрих|sku|артикул|выручка/));
          }
          if (hdrIdx < 0) hdrIdx = 0;

          const hdrLine = rawLines.at(hdrIdx);
          const sep = (hdrLine.split(';').length >= hdrLine.split(',').length) ? ';' : ',';
          const headers = parseLineCsv(hdrLine, sep);
          const rows = rawLines.slice(hdrIdx + 1).map(l => parseLineCsv(l, sep));

          const col = (rxs) => {
            for (const rx of rxs) {
              const i = headers.findIndex(h => rx.test(h.toLowerCase()));
              if (i >= 0) return i;
            }
            return -1;
          };

          let grossRev = 0, ret = 0, com = 0, log = 0, ads = 0, cogs = 0, sQty = 0, rQty = 0;
          const items = [], missing = [];

          const addCogs = (bc, art, name, q, isRet) => {
            const sku = matchProductCost(bc, art, name);
            if (sku && sku.usd > 0) {
              const rub = sku.usd * rate * q;
              if (isRet) cogs -= rub; else cogs += rub;
            } else if (bc || art) {
              missing.push({ bc: bc || art, name: name || art || bc, qty: q });
            }
          };

          if (det === 'WB') {
            const iArt = col([/^артикул поставщика$/i]), iSiz = col([/^размер$/i]), iBc = col([/^баркод$/i]);
            const iDoc = col([/^тип документа$/i]), iOb = col([/^обоснование для оплаты$/i]), iQty = col([/^кол-во$/i]);
            const iPr = col([/вайлдберриз реализовал товар/i]), iPay = col([/к перечислению продавцу/i]);
            const iLog = col([/услуги по доставке товара/i]), iFine = col([/общая сумма штрафов/i]);
            const iStor = col([/^хранение$/i]), iDed = col([/^удержания$/i]);

            rows.forEach(rw => {
              if (rw.length < 5) return;
              const doc = iDoc >= 0 ? (rw.at(iDoc) || '').toLowerCase() : '';
              const ob = iOb >= 0 ? (rw.at(iOb) || '').toLowerCase() : '';
              const art = iArt >= 0 ? (rw.at(iArt) || '') : '';
              const siz = iSiz >= 0 ? (rw.at(iSiz) || '') : '';
              const bc = iBc >= 0 ? (rw.at(iBc) || '') : '';
              const artFull = (art + (siz && siz !== '0' ? siz : '')).trim();
              const q = iQty >= 0 ? Math.abs(toNumber(rw.at(iQty))) : 0;
              const vPr = iPr >= 0 ? toNumber(rw.at(iPr)) : 0;
              const vPay = iPay >= 0 ? toNumber(rw.at(iPay)) : 0;
              const vLog = iLog >= 0 ? Math.abs(toNumber(rw.at(iLog))) : 0;
              const vFine = iFine >= 0 ? Math.abs(toNumber(rw.at(iFine))) : 0;
              const vStor = iStor >= 0 ? Math.abs(toNumber(rw.at(iStor))) : 0;
              const vDed = iDed >= 0 ? Math.abs(toNumber(rw.at(iDed))) : 0;

              log += vLog; ads += vFine + vDed; com += vStor;
              if (doc === 'продажа' && ob === 'продажа') {
                const vCom = Math.max(0, vPr - vPay);
                grossRev += vPr; com += vCom; sQty += (q || 1);
                addCogs(bc, artFull, art, (q || 1), false);
                items.push({ bc: bc || artFull, sQty: (q || 1), rQty: 0, rev: vPr, fee: vCom + vLog + vFine + vDed });
              } else if (doc === 'возврат' || ob === 'возврат') {
                const vCom = Math.max(0, vPr - vPay);
                ret += vPr; com -= vCom; rQty += (q || 1);
                addCogs(bc, artFull, art, (q || 1), true);
                items.push({ bc: bc || artFull, sQty: 0, rQty: (q || 1), rev: -vPr, fee: vLog - vCom });
              } else if (bc || artFull) {
                items.push({ bc: bc || artFull, sQty: 0, rQty: 0, rev: 0, fee: vLog + vFine + vStor + vDed });
              }
            });
          } else if (det === 'OZON') {
            const iGrp = col([/^группа услуг$/i]), iTyp = col([/^тип начисления$/i]);
            const iArt = col([/^артикул$/i]), iSku = col([/^sku$/i]), iName = col([/^название товара$/i]);
            const iQty = col([/^количество$/i]), iTot = col([/^сумма итого/i]);

            rows.forEach(rw => {
              if (rw.length < 5) return;
              const grp = iGrp >= 0 ? (rw.at(iGrp) || '').toLowerCase() : '';
              const typ = iTyp >= 0 ? (rw.at(iTyp) || '').toLowerCase() : '';
              const art = iArt >= 0 ? (rw.at(iArt) || '') : '';
              const sku = iSku >= 0 ? (rw.at(iSku) || '') : '';
              const name = iName >= 0 ? (rw.at(iName) || '') : art;
              const q = iQty >= 0 ? Math.abs(toNumber(rw.at(iQty))) : 0;
              const tot = iTot >= 0 ? toNumber(rw.at(iTot)) : 0;
              const bcKey = sku ? ('OZN' + sku) : art;

              if (grp === 'продажи') {
                if (typ === 'выручка') {
                  grossRev += tot; sQty += (q || 1);
                  addCogs(bcKey, art, name, (q || 1), false);
                  items.push({ bc: bcKey || art, sQty: (q || 1), rQty: 0, rev: tot, fee: 0 });
                } else if (typ.includes('баллы') || typ.includes('программы партн')) {
                  grossRev += tot;
                  items.push({ bc: bcKey || art, sQty: 0, rQty: 0, rev: tot, fee: 0 });
                }
              } else if (grp === 'возвраты') {
                if (typ === 'возврат выручки') {
                  ret += Math.abs(tot); rQty += (q || 1);
                  addCogs(bcKey, art, name, (q || 1), true);
                  items.push({ bc: bcKey || art, sQty: 0, rQty: (q || 1), rev: -Math.abs(tot), fee: 0 });
                } else if (typ.includes('баллы') || typ.includes('программы партн')) {
                  ret += Math.abs(tot);
                  items.push({ bc: bcKey || art, sQty: 0, rQty: 0, rev: -Math.abs(tot), fee: 0 });
                } else {
                  com += (-tot);
                }
              } else if (grp.includes('вознаграждение')) {
                com += (-tot); if (bcKey || art) items.push({ bc: bcKey || art, sQty: 0, rQty: 0, rev: 0, fee: -tot });
              } else if (grp.includes('услуги доставки') || grp.includes('услуги агентов')) {
                log += (-tot); if (bcKey || art) items.push({ bc: bcKey || art, sQty: 0, rQty: 0, rev: 0, fee: -tot });
              } else if (grp.includes('продвижение') || grp.includes('реклам')) {
                ads += (-tot);
              } else {
                com += (-tot);
              }
            });
          }
          else if (det === 'YM_ORDERS') {
            const iSku = col([/^ваш sku$/i]), iName = col([/^название товара$/i]);
            const iSt = col([/^статус товара$/i]), iQty = col([/^количество/i]), iPrice = col([/^цена продажи/i]);
            const payCols = [], balCols = [];
            headers.forEach((h, idx) => {
              if (h.toLowerCase() === 'сумма платежа') payCols.push(idx);
              if (h.toLowerCase() === 'сумма баллов') balCols.push(idx);
            });

            rows.forEach(rw => {
              if (rw.length < 8) return;
              const sku = iSku >= 0 ? (rw.at(iSku) || '') : '';
              const name = iName >= 0 ? (rw.at(iName) || '') : sku;
              const st = iSt >= 0 ? (rw.at(iSt) || '').toLowerCase() : '';
              const q = iQty >= 0 ? Math.abs(toNumber(rw.at(iQty))) : 1;
              const price = iPrice >= 0 ? toNumber(rw.at(iPrice)) : 0;
              const payIn = payCols.length > 0 ? toNumber(rw.at(payCols.at(0))) : 0;
              const balIn = balCols.length > 0 ? toNumber(rw.at(balCols.at(0))) : 0;
              const payOut = payCols.length > 1 ? Math.abs(toNumber(rw.at(payCols.at(1)))) : 0;
              const balOut = balCols.length > 1 ? Math.abs(toNumber(rw.at(balCols.at(1)))) : 0;
              if (!sku && !name) return;

              if (st.includes('доставлен')) {
                const sum = (payIn + balIn) > 0 ? (payIn + balIn) : (price * q);
                grossRev += sum; sQty += q;
                addCogs(sku, sku, name, q, false);
                items.push({ bc: sku, sQty: q, rQty: 0, rev: sum, fee: 0 });
              } else if (st.includes('возврат')) {
                const sum = (payOut + balOut) > 0 ? (payOut + balOut) : (price * q);
                ret += sum; rQty += q;
                addCogs(sku, sku, name, q, true);
                items.push({ bc: sku, sQty: 0, rQty: q, rev: -sum, fee: 0 });
              }
            });
          } else if (det === 'YM_SERVICES') {
            const iSt = col([/^статус заказа$/i]), iPrice = col([/^цена продажи/i]);
            const iAllSrv = col([/^все услуги маркета за заказы/i]), iBoost = col([/^буст продаж/i]), iLog = col([/^доставка покупателю/i]);

            rows.forEach(rw => {
              if (rw.length < 6) return;
              const st = iSt >= 0 ? (rw.at(iSt) || '').toLowerCase() : '';
              const price = iPrice >= 0 ? toNumber(rw.at(iPrice)) : 0;
              const srv = iAllSrv >= 0 ? Math.abs(toNumber(rw.at(iAllSrv))) : 0;
              const bst = iBoost >= 0 ? Math.abs(toNumber(rw.at(iBoost))) : 0;
              const dlv = iLog >= 0 ? Math.abs(toNumber(rw.at(iLog))) : 0;
              if (st === 'доставлен') { grossRev += price; sQty += 1; }
              else if (st.includes('полный возврат')) { ret += price; rQty += 1; }
              ads += bst; log += dlv; com += Math.max(0, srv - bst - dlv);
            });
          }

          const mpCode = det.startsWith('YM') ? 'YM' : det;
          const labels = {
            WB: 'WB Детализация',
            OZON: 'Ozon Начисления',
            YM_ORDERS: 'ЯМ Заказы по SKU',
            YM_SERVICES: 'ЯМ Услуги и маржа'
          };

          resolve({
            fileName: file.name,
            mp: mpCode,
            detType: det,
            label: labels[det] || det,
            rev: Math.max(0, grossRev - ret),
            ret,
            com: Math.max(0, com),
            log: Math.max(0, log),
            ads: Math.max(0, ads),
            cogs: Math.max(0, cogs),
            sQty,
            rQty,
            items,
            missing
          });
        } catch (err) {
          resolve(null);
        }
      };
      r.readAsArrayBuffer(file);
    });
  }
  function showMultiBatchDraft() {
    const mapBox = document.getElementById('map-box');
    if (!mapBox) return;
    if (!multiBatch || !multiBatch.files.length) {
      mapBox.classList.add('hidden');
      mapBox.innerHTML = '';
      return;
    }

    const orgObj = (db.orgs || []).find(o => o.id === multiBatch.org);
    const orgName = orgObj ? (orgObj.name + ' (' + orgObj.bank + ')') : multiBatch.org;

    const grouped = {};
    multiBatch.files.forEach(f => {
      if (!grouped[f.mp]) {
        grouped[f.mp] = {
          mp: f.mp, names: [], hasYmOrders: false, hasYmServices: false,
          rev: 0, ret: 0, com: 0, log: 0, ads: 0, cogs: 0, sQty: 0, rQty: 0,
          items: [], missingMap: new Map()
        };
      }
      const g = grouped[f.mp];
      g.names.push(f.fileName);
      if (f.detType === 'YM_ORDERS') g.hasYmOrders = true;
      if (f.detType === 'YM_SERVICES') g.hasYmServices = true;
      g.rev += f.rev; g.ret += f.ret; g.com += f.com; g.log += f.log; g.ads += f.ads; g.cogs += f.cogs;
      g.sQty += f.sQty; g.rQty += f.rQty;
      f.items.forEach(it => g.items.push(it));
      f.missing.forEach(m => {
        const prev = g.missingMap.get(m.bc);
        if (prev) prev.qty += m.qty;
        else g.missingMap.set(m.bc, { ...m });
      });
    });

    if (grouped.YM && grouped.YM.hasYmOrders && grouped.YM.hasYmServices) {
      grouped.YM.rev = Math.round(grouped.YM.rev / 2);
      grouped.YM.ret = Math.round(grouped.YM.ret / 2);
      grouped.YM.sQty = Math.round(grouped.YM.sQty / 2);
      grouped.YM.rQty = Math.round(grouped.YM.rQty / 2);
    }

    const cardsHtml = Object.values(grouped).map(g => {
      g.bo = (g.sQty + g.rQty) > 0 ? Math.round((g.sQty / (g.sQty + g.rQty)) * 100) : 89;
      const prof = g.rev - g.com - g.log - g.ads - g.cogs;
      const missArr = Array.from(g.missingMap.values());
      const missBlock = missArr.length
        ? `<details style="margin-top:6px;background:#fffbeb;border:1px solid #fcd34d;padding:6px 8px;border-radius:7px">
            <summary style="cursor:pointer;font-weight:700;color:#b45309;font-size:11.5px">⚠️ Без себестоимости: ${missArr.length} поз.</summary>
            <div style="max-height:110px;overflow-y:auto;margin-top:4px;font-size:11px">${missArr.map(m => `<div>• <b>${m.bc}</b> — ${m.name} (${m.qty} шт.)</div>`).join('')}</div>
          </details>`
        : `<div style="margin-top:5px;font-size:11.5px;color:#059669;font-weight:600">✅ Все товары найдены в базе себестоимости</div>`;

      return `
        <div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin-bottom:10px;background:#fff">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px">
            <div><span class="badge badge-blue">${g.mp}</span> <span style="font-size:11.5px;color:#475569">Файлы (${g.names.length}): ${g.names.join(', ')}</span></div>
            <div style="font-weight:800;font-size:13px;color:${prof >= 0 ? '#059669' : '#e11d48'}">Прибыль: ${fmtR(prof)}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:6px;font-size:12px">
            <div style="background:#f8fafc;padding:6px;border-radius:6px">Выручка: <b>${fmtR(g.rev)}</b> (${g.sQty} шт.)</div>
            <div style="background:#f8fafc;padding:6px;border-radius:6px">Возвраты: <b style="color:#e11d48">${fmtR(g.ret)}</b> (${g.rQty} шт.)</div>
            <div style="background:#f8fafc;padding:6px;border-radius:6px">Комиссия/Усл.: <b>${fmtR(g.com)}</b></div>
            <div style="background:#f8fafc;padding:6px;border-radius:6px">Логистика: <b>${fmtR(g.log)}</b></div>
            <div style="background:#f8fafc;padding:6px;border-radius:6px">Реклама/Штрафы: <b>${fmtR(g.ads)}</b></div>
            <div style="background:#f8fafc;padding:6px;border-radius:6px">Себестоимость: <b>${fmtR(g.cogs)}</b></div>
          </div>
          ${missBlock}
        </div>
      `;
    }).join('');

    mapBox.classList.remove('hidden');
    mapBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <span class="badge badge-amber">📝 ЧЕРНОВИК ПАКЕТА (${multiBatch.files.length} файлов)</span>
          <strong style="margin-left:6px;font-size:13px">${orgName} • ${multiBatch.mo}.${multiBatch.yr}</strong>
          <div style="font-size:11px;color:#64748b;margin-top:2px">Можете докинуть ещё файлы в этот же пакет или нажать «Сохранить» — после сохранения черновик удалится.</div>
        </div>
      </div>
      ${cardsHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="btn btn-primary" id="btn-commit-batch">✅ Сохранить в учёт и удалить черновик</button>
        <button type="button" class="btn btn-danger" id="btn-clear-batch">🗑️ Удалить черновик</button>
      </div>
    `;

    document.getElementById('btn-commit-batch').onclick = function () {
      if (!multiBatch) return;
      if (db.locked && db.locked[multiBatch.yr + '-' + multiBatch.mo]) return alert('Этот месяц закрыт от изменений!');

      Object.values(grouped).forEach(g => {
        db.reports.unshift({
          id: 'r_' + Date.now() + '_' + g.mp,
          org: multiBatch.org,
          mp: g.mp,
          yr: multiBatch.yr,
          mo: multiBatch.mo,
          rev: g.rev,
          ret: g.ret,
          ads: g.ads,
          log: g.log,
          com: g.com,
          cogs: g.cogs,
          bo: g.bo || 89,
          note: 'Пакет (' + g.names.length + ' ф.)'
        });
        g.items.forEach(it => {
          db.itemSales.push({
            org: multiBatch.org, mp: g.mp, yr: multiBatch.yr, mo: multiBatch.mo,
            bc: it.bc, sQty: it.sQty, rQty: it.rQty, rev: it.rev, fee: it.fee
          });
        });
      });

      const savedCount = multiBatch.files.length;
      multiBatch = null;
      if (typeof csvRows !== 'undefined') csvRows = [];
      if (typeof csvHdr !== 'undefined') csvHdr = [];
      mapBox.classList.add('hidden');
      mapBox.innerHTML = '';

      if (typeof save === 'function') save();
      if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
      if (typeof render === 'function') render();
      alert('Сохранено навсегда (' + savedCount + ' файлов)! Черновик полностью удалён.');
    };

    document.getElementById('btn-clear-batch').onclick = function () {
      multiBatch = null;
      if (typeof csvRows !== 'undefined') csvRows = [];
      if (typeof csvHdr !== 'undefined') csvHdr = [];
      mapBox.classList.add('hidden');
      mapBox.innerHTML = '';
    };
  }

  document.addEventListener('change', async function (ev) {
    if (!ev.target || ev.target.id !== 'rep-file') return;
    ev.stopImmediatePropagation();

    const fileList = ev.target.files;
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);
    ev.target.value = '';

    const org = document.getElementById('up-org').value;
    const yr = document.getElementById('up-yr').value;
    const mo = document.getElementById('up-mo').value;
    const rate = typeof getRate === 'function' ? getRate(yr + '-' + mo) : 96.5;

    if (!multiBatch || multiBatch.org !== org || multiBatch.yr !== yr || multiBatch.mo !== mo) {
      multiBatch = { org, yr, mo, files: [] };
    }

    for (const f of files) {
      const parsed = await readSingleMpFile(f, rate);
      if (parsed) multiBatch.files.push(parsed);
    }

    if (!multiBatch.files.length) {
      multiBatch = null;
      return alert('Не удалось распознать выбранные CSV-файлы.');
    }
    showMultiBatchDraft();
  }, true);
})();

