(function () {
  if (window.__skosPatch3Loaded) return;
  window.__skosPatch3Loaded = true;

  // --- УСКОРЕНИЕ РАБОТЫ САЙТА (останавливаем лишние фоновые циклы без поломки вкладок) ---
  setTimeout(function () {
    for (let i = 1; i < 400; i++) {
      try { clearInterval(i); } catch (e) {}
    }
  }, 800);

  let searchDebounce = null;
  const origSearchSku = window.searchSku;
  if (typeof origSearchSku === 'function') {
    window.searchSku = function (q) {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function () {
        origSearchSku(q);
      }, 250);
    };
  }

  function normClean(v) { return String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim(); }
  function normKey(v) { return normClean(v).toLowerCase().replace(/[\s\-_]+/g, ''); }
  function stripZero(v) { return v.replace(/^0+/, '').replace(/^ozn/, ''); }

  // Умный поиск модели, цвета, размера и себестоимости из 32 папок
  function resolveProductMeta(bcRaw, artRaw, nameRaw) {
    const bc = normClean(bcRaw);
    const art = normClean(artRaw);
    const name = normClean(nameRaw);
    const kBc = stripZero(normKey(bc));
    const kArt = normKey(art);
    const list = (window.db && Array.isArray(db.skus)) ? db.skus : [];

    let fNames = {};
    try { fNames = JSON.parse(localStorage.getItem('skos_v3_folder_names') || '{}'); } catch (e) {}

    let found = null;
    if (bc) found = list.find(s => normClean(s.bc) === bc);
    if (!found && kBc) found = list.find(s => stripZero(normKey(s.bc)) === kBc);
    if (!found && kArt) found = list.find(s => normKey(s.bc) === kArt || normKey(s.art) === kArt);

    if (!found) {
      const combo = (art + ' ' + name + ' ' + bc).toUpperCase();
      const m = combo.match(/\b(SKOS-[A-ZА-Я0-9]+)\b/);
      if (m) {
        const code = m.at(1);
        found = list.find(s => normClean(s.art).toUpperCase() === code && (s.usd || 0) > 0)
             || list.find(s => normClean(s.art).toUpperCase() === code);
      }
    }

    const srcText = (name + ' ' + art + ' ' + bc).trim();
    let parsedCol = '—';
    let parsedSiz = '—';

    const colMatch = srcText.match(/(черн[а-я]*|бел[а-я]*|бежев[а-я]*|темно[\-\s]*бежев[а-я]*|сер[а-я\-]*|молочн[а-я]*|син[а-я]*|голуб[а-я]*|зелен[а-я]*|хаки|коричнев[а-я]*|бордов[а-я]*|красн[а-я]*|графит[а-я]*|шоколад[а-я]*|оливк[а-я]*|песочн[а-я]*)/i);
    if (colMatch) {
      const cRaw = colMatch.at(1).toLowerCase();
      parsedCol = cRaw.charAt(0).toUpperCase() + cRaw.slice(1);
    }

    const sizMatch = srcText.match(/(?:^|[\sа-яА-Я\-_])(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|28|29|30|31|32|33|34|35|36|38|40|42|44|46|48|50|52|54|56|58|60)$/i);
    if (sizMatch) {
      parsedSiz = sizMatch.at(1).toUpperCase();
    }

    if (found) {
      const folderCode = normClean(found.art) || 'Без артикула';
      const folderTitle = fNames[folderCode] || found.name || folderCode;
      return {
        bc: bc || found.bc,
        art: folderCode,
        modelTitle: folderTitle,
        usd: Number(found.usd) || 0,
        col: (found.col && found.col !== '—' && found.col !== 'Базовый') ? found.col : parsedCol,
        siz: (found.siz && found.siz !== '—') ? found.siz : parsedSiz
      };
    }

    return {
      bc: bc || art || 'Неизвестный ШК',
      art: art || 'Без папки',
      modelTitle: name || art || bc || 'Нераспознанный товар',
      usd: 0,
      col: parsedCol,
      siz: parsedSiz
    };
  }
  // --- БЛОК 1: ДВОЙНОЙ ABC-АНАЛИЗ С ФИЛЬТРАМИ, ОЧИСТКОЙ И ИТОГАМИ ---
  window.clearAbcData = function () {
    if (!window.db || !Array.isArray(db.itemSales)) return;
    const yr = document.getElementById('abc-f-yr')?.value || 'ALL';
    const mo = document.getElementById('abc-f-mo')?.value || 'ALL';
    const mp = document.getElementById('abc-f-mp')?.value || 'ALL';
    const org = document.getElementById('abc-f-org')?.value || 'ALL';

    const isFiltered = (yr !== 'ALL' || mo !== 'ALL' || mp !== 'ALL' || org !== 'ALL');
    const msg = isFiltered
      ? 'Очистить записи ABC-анализа ТОЛЬКО по выбранному фильтру (период/МП/юрлицо)?'
      : 'Очистить ВСЮ историю продаж для ABC-анализа (чтобы загрузить отчёты заново на чистовик)?\nСами итоговые отчёты в Сводке останутся.';

    if (!confirm(msg)) return;

    if (!isFiltered) {
      db.itemSales = [];
    } else {
      db.itemSales = db.itemSales.filter(it => {
        if (yr !== 'ALL' && String(it.yr) !== yr) return true;
        if (mo !== 'ALL' && String(it.mo) !== mo) return true;
        if (mp !== 'ALL' && String(it.mp) !== mp) return true;
        if (org !== 'ALL' && String(it.org) !== org) return true;
        return false;
      });
    }

    if (typeof save === 'function') save();
    if (typeof syncCloud === 'function' && db.cloud && db.cloud.url) syncCloud(false);
    renderEnhancedAbc();
    alert('Данные ABC-анализа очищены!');
  };

  function ensureAbcFiltersUi() {
    const sec = document.getElementById('tab-abc');
    if (!sec || !window.db) return;
    const card = sec.querySelector('.card');
    if (!card) return;

    const header = card.querySelector('.card-header');
    const rightHdr = header ? header.children.item(1) : null;
    if (rightHdr && !document.getElementById('abc-clear-btn')) {
      const clrBtn = document.createElement('button');
      clrBtn.id = 'abc-clear-btn';
      clrBtn.type = 'button';
      clrBtn.className = 'btn btn-danger';
      clrBtn.style.padding = '6px 10px';
      clrBtn.textContent = '🧹 Очистить ABC';
      clrBtn.onclick = window.clearAbcData;
      rightHdr.appendChild(clrBtn);
    }

    let filterPanel = document.getElementById('skos-abc-filters');
    if (!filterPanel) {
      filterPanel = document.createElement('div');
      filterPanel.id = 'skos-abc-filters';
      filterPanel.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:12px;';
      filterPanel.innerHTML = `
        <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">
          <div><label>Год</label><select id="abc-f-yr" class="select" onchange="renderEnhancedAbc()"></select></div>
          <div><label>Месяц</label><select id="abc-f-mo" class="select" onchange="renderEnhancedAbc()">
            <option value="ALL">Все месяцы</option>
            <option value="01">Январь</option><option value="02">Февраль</option><option value="03">Март</option>
            <option value="04">Апрель</option><option value="05">Май</option><option value="06">Июнь</option>
            <option value="07">Июль</option><option value="08">Август</option><option value="09">Сентябрь</option>
            <option value="10">Октябрь</option><option value="11">Ноябрь</option><option value="12">Декабрь</option>
          </select></div>
          <div><label>Юрлицо (ИП / ООО)</label><select id="abc-f-org" class="select" onchange="renderEnhancedAbc()"></select></div>
          <div><label>Маркетплейс (МП)</label><select id="abc-f-mp" class="select" onchange="renderEnhancedAbc()">
            <option value="ALL">Все площадки</option>
            <option value="WB">Wildberries</option>
            <option value="OZON">Ozon</option>
            <option value="YM">Яндекс Маркет</option>
          </select></div>
          <div><label>Артикул / Папка</label><select id="abc-f-art" class="select" onchange="renderEnhancedAbc()"></select></div>
          <div><label>Цвет</label><select id="abc-f-col" class="select" onchange="renderEnhancedAbc()"></select></div>
          <div><label>Размер</label><select id="abc-f-siz" class="select" onchange="renderEnhancedAbc()"></select></div>
        </div>
        <div id="skos-abc-summary" style="margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1"></div>
      `;
      header.insertAdjacentElement('afterend', filterPanel);

      const yrSel = document.getElementById('abc-f-yr');
      let yHtml = '<option value="ALL">Все годы</option>';
      for (let y = 2024; y <= 2030; y++) yHtml += `<option value="${y}">${y}</option>`;
      yrSel.innerHTML = yHtml;
      yrSel.value = document.getElementById('f-yr')?.value || '2026';

      const moSel = document.getElementById('abc-f-mo');
      const mainMo = document.getElementById('f-mo')?.value;
      if (mainMo) moSel.value = mainMo;
    }

    const orgSel = document.getElementById('abc-f-org');
    const curOrg = orgSel.value || 'ALL';
    orgSel.innerHTML = '<option value="ALL">Все юрлица</option>' + (db.orgs || []).map(o =>
      `<option value="${o.id}">${o.name} (${o.bank})</option>`
    ).join('');
    orgSel.value = curOrg;

    const enrichedAll = (db.itemSales || []).map(it => resolveProductMeta(it.bc, it.art, it.name));
    const arts = [...new Set(enrichedAll.map(x => x.art).filter(Boolean))].sort();
    const cols = [...new Set(enrichedAll.map(x => x.col).filter(x => x && x !== '—'))].sort();
    const sizs = [...new Set(enrichedAll.map(x => x.siz).filter(x => x && x !== '—'))].sort();

    const fillSelect = (id, allLabel, arr) => {
      const el = document.getElementById(id);
      if (!el) return;
      const prev = el.value || 'ALL';
      el.innerHTML = `<option value="ALL">${allLabel}</option>` + arr.map(v => `<option value="${v}">${v}</option>`).join('');
      if (arr.includes(prev)) el.value = prev;
    };

    fillSelect('abc-f-art', 'Все артикулы', arts);
    fillSelect('abc-f-col', 'Все цвета', cols);
    fillSelect('abc-f-siz', 'Все размеры', sizs);
  }
  window.renderEnhancedAbc = function () {
    const sec = document.getElementById('tab-abc');
    if (!sec || !window.db) return;
    ensureAbcFiltersUi();

    const mode = document.getElementById('abc-mode')?.value || 'MODEL';
    const fYr = document.getElementById('abc-f-yr')?.value || 'ALL';
    const fMo = document.getElementById('abc-f-mo')?.value || 'ALL';
    const fOrg = document.getElementById('abc-f-org')?.value || 'ALL';
    const fMp = document.getElementById('abc-f-mp')?.value || 'ALL';
    const fArt = document.getElementById('abc-f-art')?.value || 'ALL';
    const fCol = document.getElementById('abc-f-col')?.value || 'ALL';
    const fSiz = document.getElementById('abc-f-siz')?.value || 'ALL';

    const rawSales = Array.isArray(db.itemSales) ? db.itemSales : [];
    const groups = {};
    let totSold = 0, totRet = 0, totRev = 0, totCogs = 0, totFee = 0, totProf = 0;

    rawSales.forEach(it => {
      if (fYr !== 'ALL' && String(it.yr) !== fYr) return;
      if (fMo !== 'ALL' && String(it.mo) !== fMo) return;
      if (fOrg !== 'ALL' && String(it.org) !== fOrg) return;
      if (fMp !== 'ALL' && String(it.mp) !== fMp) return;

      const meta = resolveProductMeta(it.bc, it.art, it.name);
      if (fArt !== 'ALL' && meta.art !== fArt) return;
      if (fCol !== 'ALL' && meta.col !== fCol) return;
      if (fSiz !== 'ALL' && meta.siz !== fSiz) return;

      const rate = typeof getRate === 'function' ? getRate(it.yr + '-' + it.mo) : 96.5;
      const sq = Number(it.sQty) || 0;
      const rq = Number(it.rQty) || 0;
      const rev = Number(it.rev) || 0;
      const fee = Number(it.fee) || 0;
      const netQty = sq - rq;
      const cogs = Math.max(0, meta.usd * rate * netQty);
      const prof = rev - fee - cogs;

      totSold += sq; totRet += rq; totRev += rev; totCogs += cogs; totFee += fee; totProf += prof;

      let gKey = meta.art;
      let gTitle = `${meta.art} — ${meta.modelTitle}`;
      let gSub = `Папка: ${meta.art}`;

      if (mode === 'COLOR') {
        gKey = meta.art + '||' + meta.col;
        gTitle = `${meta.modelTitle} (${meta.col})`;
        gSub = `Артикул: ${meta.art} • Цвет: ${meta.col}`;
      } else if (mode === 'SIZE') {
        gKey = meta.art + '||' + meta.siz;
        gTitle = `${meta.modelTitle} • Размер ${meta.siz}`;
        gSub = `Артикул: ${meta.art} • Размер: ${meta.siz}`;
      } else if (mode === 'SKU') {
        gKey = meta.bc;
        gTitle = `${meta.modelTitle} (${meta.bc})`;
        gSub = `${meta.art} • Цвет: ${meta.col} • Размер: ${meta.siz}`;
      }

      if (!groups[gKey]) {
        groups[gKey] = { key: gKey, title: gTitle, sub: gSub, sQty: 0, rQty: 0, rev: 0, cogs: 0, fee: 0, prof: 0, mps: new Set(), orgs: new Set() };
      }
      const g = groups[gKey];
      g.sQty += sq; g.rQty += rq; g.rev += rev; g.cogs += cogs; g.fee += fee; g.prof += prof;
      if (it.mp) g.mps.add(it.mp);
      if (it.org) {
        const oObj = (db.orgs || []).find(o => o.id === it.org);
        g.orgs.add(oObj ? oObj.name : it.org);
      }
    });

    const list = Object.values(groups).sort((a, b) => b.prof - a.prof);
    const posProfTotal = list.reduce((acc, x) => acc + Math.max(0, x.prof), 0);
    let cumProf = 0;
    list.forEach(x => {
      if (x.prof <= 0 || posProfTotal <= 0) { x.abcProf = 'C'; }
      else {
        cumProf += x.prof;
        const share = (cumProf / posProfTotal) * 100;
        x.abcProf = share <= 80 ? 'A' : (share <= 95 ? 'B' : 'C');
      }
    });

    const byRev = [...list].sort((a, b) => b.rev - a.rev);
    const posRevTotal = byRev.reduce((acc, x) => acc + Math.max(0, x.rev), 0);
    let cumRev = 0;
    byRev.forEach(x => {
      if (x.rev <= 0 || posRevTotal <= 0) { x.abcRev = 'C'; }
      else {
        cumRev += x.rev;
        const share = (cumRev / posRevTotal) * 100;
        x.abcRev = share <= 80 ? 'A' : (share <= 95 ? 'B' : 'C');
      }
    });

    const boTotal = (totSold + totRet) > 0 ? Math.round((totSold / (totSold + totRet)) * 100) : 0;
    const marTotal = totRev > 0 ? ((totProf / totRev) * 100).toFixed(1) : '0.0';
    const sumBox = document.getElementById('skos-abc-summary');
    if (sumBox) {
      sumBox.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;font-size:12px">
          <div style="background:#fff;padding:7px 9px;border:1px solid #e2e8f0;border-radius:7px">Выкуплено / Возврат: <b>${totSold} / <span style="color:#e11d48">${totRet}</span> шт.</b> (${boTotal}%)</div>
          <div style="background:#fff;padding:7px 9px;border:1px solid #e2e8f0;border-radius:7px">Чистая выручка: <b>${fmtR(totRev)}</b></div>
          <div style="background:#fff;padding:7px 9px;border:1px solid #e2e8f0;border-radius:7px">Расходы МП: <b>${fmtR(totFee)}</b></div>
          <div style="background:#fff;padding:7px 9px;border:1px solid #e2e8f0;border-radius:7px">Себестоимость: <b>${fmtR(totCogs)}</b></div>
          <div style="background:#eff6ff;padding:7px 9px;border:1px solid #bfdbfe;border-radius:7px">Чистая прибыль: <b style="color:${totProf >= 0 ? '#059669' : '#e11d48'}">${fmtR(totProf)}</b> (Маржа ${marTotal}%)</div>
        </div>
      `;
    }

    const tbody = sec.querySelector('tbody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:18px;color:#64748b">Нет данных продаж за выбранный фильтр. Загрузите отчёты МП или сбросьте фильтры.</td></tr>';
      return;
    }

    const badgeCls = c => c === 'A' ? 'badge-green' : (c === 'B' ? 'badge-amber' : 'badge-red');
    tbody.innerHTML = list.map(x => {
      const shareProf = posProfTotal > 0 ? ((Math.max(0, x.prof) / posProfTotal) * 100).toFixed(1) : '0.0';
      const bo = (x.sQty + x.rQty) > 0 ? Math.round((x.sQty / (x.sQty + x.rQty)) * 100) : 100;
      const mpsTxt = Array.from(x.mps).join(', ') || '—';
      const orgsTxt = Array.from(x.orgs).join(', ') || '—';
      return `
        <tr>
          <td style="white-space:nowrap">
            <span class="badge ${badgeCls(x.abcProf)}">Приб: ${x.abcProf}</span>
            <span class="badge ${badgeCls(x.abcRev)}">Прод: ${x.abcRev}</span>
          </td>
          <td class="bold">${x.title}</td>
          <td style="font-size:11.5px;color:#475569">${x.sub}<br><span style="color:#2563eb;font-weight:600">МП: ${mpsTxt}</span> • <span style="color:#64748b">${orgsTxt}</span></td>
          <td class="num bold">${x.sQty} <span style="font-size:10.5px;color:#64748b">(${bo}%)</span></td>
          <td class="num text-red">${x.rQty}</td>
          <td class="num">${fmtR(x.rev)}</td>
          <td class="num">${fmtR(x.cogs)}</td>
          <td class="num bold ${x.prof >= 0 ? 'text-green' : 'text-red'}">${fmtR(x.prof)}</td>
          <td class="num bold">${shareProf}%</td>
        </tr>
      `;
    }).join('');
  };

  window.renderAbc = window.renderEnhancedAbc;
  // --- БЛОК 2: СВОДКА ДЛЯ НАЧАЛЬНИКА (3 СТУПЕНИ ПРИБЫЛИ, НАГРУЗКА МП И ДИНАМИКА НЕДЕЛЯ / МЕСЯЦ / ГОД) ---
  let dynMode = 'MONTH'; // 'WEEK' | 'MONTH' | 'YEAR'

  window.setSkosDynMode = function (m) {
    dynMode = m;
    renderBossAnalyticsBlock();
  };

  function matchPeriod(yr, mo, fYr, fMo) {
    if (fYr && fYr !== 'ALL' && String(yr) !== String(fYr)) return false;
    if (fMo && fMo !== 'ALL' && String(mo) !== String(fMo)) return false;
    return true;
  }

  function calcPeriodMetrics(fYr, fMo, fOrg) {
    const reps = (db.reports || []).filter(r => {
      if (!matchPeriod(r.yr, r.mo, fYr, fMo)) return false;
      if (fOrg && fOrg !== 'ALL' && r.org !== fOrg) return false;
      return true;
    });

    let rev = 0, ret = 0, com = 0, log = 0, ads = 0, cogs = 0;
    reps.forEach(r => {
      rev += Number(r.rev) || 0;
      ret += Number(r.ret) || 0;
      com += Number(r.com) || 0;
      log += Number(r.log) || 0;
      ads += Number(r.ads) || 0;
      cogs += Number(r.cogs) || 0;
    });

    const mpFeeTotal = com + log + ads;
    const afterMp = rev - mpFeeTotal; // Ступень 1: Без учёта себестоимости (нагрузка МП)
    const grossProfit = afterMp - cogs; // Ступень 2: С себестоимостью, но ДО налогов, ЗП и офиса

    let taxSum = 0, opexSum = 0;
    const mode = db.mode || 'FULL';
    if (mode === 'FULL') {
      const rate = typeof getRate === 'function' ? getRate() : 96.5;
      (db.taxes || []).forEach(t => {
        if (fOrg && fOrg !== 'ALL' && t.org && t.org !== fOrg) return;
        const mList = Array.isArray(t.months) ? t.months : (t.mo ? [t.mo] : []);
        const perMonth = (Number(t.amt) || 0) / (mList.length || 1);
        mList.forEach(m => {
          if (matchPeriod(t.yr, m, fYr, fMo)) taxSum += perMonth;
        });
      });

      (db.expenses || []).forEach(ex => {
        if (fOrg && fOrg !== 'ALL' && ex.org && ex.org !== fOrg) return;
        if (matchPeriod(ex.yr, ex.mo, fYr, fMo)) {
          const val = Number(ex.amt) || 0;
          opexSum += (ex.cur === 'USD' ? val * rate : val);
        }
      });

      (db.assets || []).forEach(a => {
        if (fOrg && fOrg !== 'ALL' && a.org && a.org !== fOrg) return;
        const wear = (Number(a.cost) || 0) / Math.max(1, Number(a.months) || 12);
        if (fMo === 'ALL') opexSum += wear * 12;
        else opexSum += wear;
      });
    }

    const netProfit = grossProfit - taxSum - opexSum; // Ступень 3: Чистая прибыль после ВСЕХ расходов
    return {
      rev, ret, com, log, ads, mpFeeTotal, afterMp, cogs, grossProfit, taxSum, opexSum, netProfit,
      repsCount: reps.length
    };
  }

  function renderBossAnalyticsBlock() {
    const dash = document.getElementById('tab-dash');
    if (!dash || !window.db) return;

    const fYr = document.getElementById('f-yr')?.value || '2026';
    const fMo = document.getElementById('f-mo')?.value || '11';
    const fOrg = document.getElementById('f-org')?.value || 'ALL';

    const m = calcPeriodMetrics(fYr, fMo, fOrg);

    const pct = (part, total) => total > 0 ? ((part / total) * 100).toFixed(1) : '0.0';
    const mpLoadPct = pct(m.mpFeeTotal, m.rev);
    const afterMpPct = pct(m.afterMp, m.rev);
    const cogsPct = pct(m.cogs, m.rev);
    const grossPct = pct(m.grossProfit, m.rev);
    const overheadPct = pct(m.taxSum + m.opexSum, m.rev);
    const netPct = pct(m.netProfit, m.rev);

    let box = document.getElementById('skos-boss-ladder-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-boss-ladder-box';
      const kpiGrid = dash.querySelector('.kpi-grid');
      if (kpiGrid) kpiGrid.insertAdjacentElement('afterend', box);
      else dash.appendChild(box);
    }

    const safeRev = Math.max(1, m.rev);
    const wMp = m.rev > 0 ? Math.min(100, Math.max(0, (m.mpFeeTotal / safeRev) * 100)) : 0;
    const wCogs = m.rev > 0 ? Math.min(100 - wMp, Math.max(0, (m.cogs / safeRev) * 100)) : 0;
    const wOverhead = m.rev > 0 ? Math.min(100 - wMp - wCogs, Math.max(0, ((m.taxSum + m.opexSum) / safeRev) * 100)) : 0;
    const wNet = m.rev > 0 ? Math.max(0, 100 - wMp - wCogs - wOverhead) : 0;

    box.innerHTML = `
      <div class="card" style="border:1.5px solid #bfdbfe;background:linear-gradient(180deg,#f8faff 0%,#ffffff 100%)">
        <div class="card-header">
          <div>
            <div class="card-title">🪜 Лесенка прибыли для руководителя (от продаж МП до чистых денег)</div>
            <div style="font-size:11.5px;color:#64748b">Показывает отдельно поборы площадок, заработок на товаре и чистый остаток после всех расходов компании</div>
          </div>
          <button type="button" class="btn btn-success" onclick="exportBossSummaryCsv()">📊 Скачать сводку (Excel/CSV)</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:14px">
          <div style="background:#fff;border:1px solid #cbd5e1;border-left:4px solid #2563eb;border-radius:12px;padding:12px 14px">
            <div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase">1. Остаток от МП (Без себестоимости)</div>
            <div style="font-size:21px;font-weight:800;margin:5px 0;color:#0f172a">${fmtR(m.afterMp)}</div>
            <div style="font-size:11.5px;color:#334155;line-height:1.4">
              • Нагрузка МП (комиссия + логистика + реклама): <b style="color:#e11d48">${fmtR(m.mpFeeTotal)} (${mpLoadPct}%)</b><br>
              • Площадки перечисляют нам от выручки: <b style="color:#2563eb">${afterMpPct}%</b>
            </div>
          </div>

          <div style="background:#fff;border:1px solid #cbd5e1;border-left:4px solid #d97706;border-radius:12px;padding:12px 14px">
            <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase">2. Заработок на товаре (До налогов и ЗП)</div>
            <div style="font-size:21px;font-weight:800;margin:5px 0;color:${m.grossProfit >= 0 ? '#0f172a' : '#e11d48'}">${fmtR(m.grossProfit)}</div>
            <div style="font-size:11.5px;color:#334155;line-height:1.4">
              • Вычли себестоимость товара: <b>${fmtR(m.cogs)} (${cogsPct}%)</b><br>
              • Валовая маржа товара (до офиса, ЗП и налогов): <b style="color:#b45309">${grossPct}%</b>
            </div>
          </div>

          <div style="background:#fff;border:1px solid #cbd5e1;border-left:4px solid ${m.netProfit >= 0 ? '#059669' : '#e11d48'};border-radius:12px;padding:12px 14px">
            <div style="font-size:11px;font-weight:700;color:${m.netProfit >= 0 ? '#047857' : '#be123c'};text-transform:uppercase">3. Чистая прибыль бизнеса (В карман)</div>
            <div style="font-size:21px;font-weight:800;margin:5px 0;color:${m.netProfit >= 0 ? '#059669' : '#e11d48'}">${fmtR(m.netProfit)}</div>
            <div style="font-size:11.5px;color:#334155;line-height:1.4">
              • Налоги (1/3 кв.) + ЗП + склад и офис: <b>${fmtR(m.taxSum + m.opexSum)} (${overheadPct}%)</b><br>
              • Чистая рентабельность после ВСЕХ расходов: <b style="color:${m.netProfit >= 0 ? '#059669' : '#e11d48'}">${netPct}%</b>
            </div>
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <span>📊 Куда ушёл каждый рубль чистой выручки (${fmtR(m.rev)} = 100%):</span>
            <span style="color:#64748b">Нагрузка МП: ${mpLoadPct}% • Себест.: ${cogsPct}% • Офис/Налоги: ${overheadPct}% • Чистыми: ${netPct}%</span>
          </div>
          <div style="height:14px;border-radius:99px;overflow:hidden;display:flex;background:#e2e8f0">
            <div style="width:${wMp}%;background:#3b82f6" title="Нагрузка МП: ${mpLoadPct}%"></div>
            <div style="width:${wCogs}%;background:#f59e0b" title="Себестоимость: ${cogsPct}%"></div>
            <div style="width:${wOverhead}%;background:#8b5cf6" title="Налоги и офис: ${overheadPct}%"></div>
            <div style="width:${wNet}%;background:#10b981" title="Чистая прибыль: ${netPct}%"></div>
          </div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:#475569">
            <span><b style="color:#3b82f6">■</b> Нагрузка площадок (${mpLoadPct}%)</span>
            <span><b style="color:#f59e0b">■</b> Себестоимость товара (${cogsPct}%)</span>
            <span><b style="color:#8b5cf6">■</b> Налоги, ЗП и офис (${overheadPct}%)</span>
            <span><b style="color:#10b981">■</b> Чистая прибыль в карман (${netPct}%)</span>
          </div>
        </div>
      </div>
    `;

    renderPeriodDynamicsCard(fYr, fMo, fOrg);
  }
  function renderPeriodDynamicsCard(fYr, fMo, fOrg) {
    const dash = document.getElementById('tab-dash');
    if (!dash) return;

    let dynBox = document.getElementById('skos-dyn-card');
    if (!dynBox) {
      dynBox = document.createElement('div');
      dynBox.id = 'skos-dyn-card';
      const ladder = document.getElementById('skos-boss-ladder-box');
      if (ladder) ladder.insertAdjacentElement('afterend', dynBox);
      else dash.appendChild(dynBox);
    }

    const monthsRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const mCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const targetYr = fYr === 'ALL' ? '2026' : fYr;
    const targetMo = fMo === 'ALL' ? '11' : fMo;

    let rowsData = [];
    let subTitle = '';

    if (dynMode === 'WEEK') {
      subTitle = `Разбивка по неделям внутри периода: ${monthsRu.at(parseInt(targetMo, 10) - 1) || targetMo} ${targetYr} (по загруженным отчётам)`;
      const reps = (db.reports || []).filter(r => {
        if (String(r.yr) !== String(targetYr) || String(r.mo) !== String(targetMo)) return false;
        if (fOrg && fOrg !== 'ALL' && r.org !== fOrg) return false;
        return true;
      }).slice().reverse();

      if (reps.length > 0) {
        const weeks = [
          { label: '1-я неделя (1–7 число)', rev: 0, mpFee: 0, cogs: 0, prof: 0, cnt: 0 },
          { label: '2-я неделя (8–14 число)', rev: 0, mpFee: 0, cogs: 0, prof: 0, cnt: 0 },
          { label: '3-я неделя (15–21 число)', rev: 0, mpFee: 0, cogs: 0, prof: 0, cnt: 0 },
          { label: '4-я неделя (22–28 число)', rev: 0, mpFee: 0, cogs: 0, prof: 0, cnt: 0 },
          { label: '5-я неделя (29–31 число)', rev: 0, mpFee: 0, cogs: 0, prof: 0, cnt: 0 }
        ];

        reps.forEach((r, idx) => {
          let wIdx = idx % 4;
          const tsMatch = String(r.id || '').match(/r_(\d{13})/);
          if (tsMatch) {
            const d = new Date(Number(tsMatch.at(1)));
            if (!isNaN(d.getTime())) {
              const day = d.getDate();
              wIdx = Math.min(4, Math.floor((day - 1) / 7));
            }
          }
          const rev = Number(r.rev) || 0;
          const fee = (Number(r.com) || 0) + (Number(r.log) || 0) + (Number(r.ads) || 0);
          const cogs = Number(r.cogs) || 0;
          weeks.at(wIdx).rev += rev;
          weeks.at(wIdx).mpFee += fee;
          weeks.at(wIdx).cogs += cogs;
          weeks.at(wIdx).prof += (rev - fee - cogs);
          weeks.at(wIdx).cnt += 1;
        });

        rowsData = weeks.filter(w => w.cnt > 0 || w.rev > 0);
      }
    } else if (dynMode === 'MONTH') {
      subTitle = `Помесячная динамика продаж и прибыли за ${targetYr} год`;
      rowsData = mCodes.map((mc, i) => {
        const m = calcPeriodMetrics(targetYr, mc, fOrg);
        return {
          label: monthsRu.at(i),
          rev: m.rev,
          mpFee: m.mpFeeTotal,
          cogs: m.cogs,
          prof: m.netProfit
        };
      });
    } else if (dynMode === 'YEAR') {
      subTitle = 'Сводная динамика продаж и чистой прибыли по годам';
      const yrsSet = new Set(['2024', '2025', '2026']);
      (db.reports || []).forEach(r => { if (r.yr) yrsSet.add(String(r.yr)); });
      rowsData = Array.from(yrsSet).sort().map(y => {
        const m = calcPeriodMetrics(y, 'ALL', fOrg);
        return {
          label: y + ' год',
          rev: m.rev,
          mpFee: m.mpFeeTotal,
          cogs: m.cogs,
          prof: m.netProfit
        };
      });
    }

    const totalPeriodRev = rowsData.reduce((acc, x) => acc + Math.max(0, x.rev), 0);

    const tbodyHtml = rowsData.map((row, idx) => {
      const sharePct = totalPeriodRev > 0 ? ((Math.max(0, row.rev) / totalPeriodRev) * 100).toFixed(1) : '0.0';
      const mpPct = row.rev > 0 ? ((row.mpFee / row.rev) * 100).toFixed(1) : '0.0';
      const marPct = row.rev > 0 ? ((row.prof / row.rev) * 100).toFixed(1) : '0.0';

      let growthHtml = '<span style="color:#94a3b8">—</span>';
      if (idx > 0) {
        const prevRev = rowsData.at(idx - 1).rev;
        if (prevRev > 0 && row.rev > 0) {
          const diff = ((row.rev - prevRev) / prevRev) * 100;
          const sign = diff >= 0 ? '+' : '';
          const cls = diff >= 0 ? 'text-green' : 'text-red';
          growthHtml = `<span class="bold ${cls}">${sign}${diff.toFixed(1)}%</span>`;
        }
      }

      return `
        <tr>
          <td class="bold">${row.label}</td>
          <td class="num bold">${fmtR(row.rev)}</td>
          <td class="num"><span class="badge badge-blue">${sharePct}%</span></td>
          <td class="num">${growthHtml}</td>
          <td class="num">${fmtR(row.mpFee)} <span style="font-size:10.5px;color:#64748b">(${mpPct}%)</span></td>
          <td class="num">${fmtR(row.cogs)}</td>
          <td class="num bold ${row.prof >= 0 ? 'text-green' : 'text-red'}">${fmtR(row.prof)} <span style="font-size:10.5px">(${marPct}%)</span></td>
        </tr>
      `;
    }).join('');

    dynBox.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📈 Динамика продаж и процентное соотношение (Недели / Месяцы / Годы)</div>
            <div style="font-size:11.5px;color:#64748b">${subTitle}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="btn ${dynMode === 'WEEK' ? 'btn-primary' : ''}" onclick="setSkosDynMode('WEEK')">📅 По неделям</button>
            <button type="button" class="btn ${dynMode === 'MONTH' ? 'btn-primary' : ''}" onclick="setSkosDynMode('MONTH')">🗓️ По месяцам</button>
            <button type="button" class="btn ${dynMode === 'YEAR' ? 'btn-primary' : ''}" onclick="setSkosDynMode('YEAR')">📊 По годам</button>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>Период</th>
                <th class="num">Чистая выручка</th>
                <th class="num">Доля в периоде %</th>
                <th class="num">Рост к прошл. %</th>
                <th class="num">Нагрузка МП (₽ / %)</th>
                <th class="num">Себестоимость</th>
                <th class="num">Прибыль (₽ / Маржа %)</th>
              </tr>
            </thead>
            <tbody>
              ${tbodyHtml || '<tr><td colspan="7" style="text-align:center;padding:16px;color:#64748b">Загрузите отчёты маркетплейсов за этот период, чтобы увидеть недельную/месячную разбивку.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  window.exportBossSummaryCsv = function () {
    const fYr = document.getElementById('f-yr')?.value || '2026';
    const fMo = document.getElementById('f-mo')?.value || '11';
    const fOrg = document.getElementById('f-org')?.value || 'ALL';
    const m = calcPeriodMetrics(fYr, fMo, fOrg);

    const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1).replace('.', ',') + '%' : '0%';
    const lines = [
      '\uFEFFПоказатель;Сумма (RUB);Доля от выручки;Пояснение для руководителя',
      `Чистая выручка МП;${Math.round(m.rev)};100%;Продажи за вычетом возвратов`,
      `Нагрузка площадок (Комиссия + Логистика + Реклама);${Math.round(m.mpFeeTotal)};${pct(m.mpFeeTotal, m.rev)};Сколько забрали маркетплейсы`,
      `1. Остаток от МП (Без учёта себестоимости);${Math.round(m.afterMp)};${pct(m.afterMp, m.rev)};К перечислению от площадок до себестоимости`,
      `Себестоимость проданного товара;${Math.round(m.cogs)};${pct(m.cogs, m.rev)};Закуп + пошив + карго по курсу периода`,
      `2. Заработок на товаре (До налогов и ЗП);${Math.round(m.grossProfit)};${pct(m.grossProfit, m.rev)};Валовая маржа после себестоимости`,
      `Налоги (1/3 квартала);${Math.round(m.taxSum)};${pct(m.taxSum, m.rev)};Распределённая налоговая нагрузка`,
      `Расходы компании (ЗП, склад, офис, износ);${Math.round(m.opexSum)};${pct(m.opexSum, m.rev)};Операционные расходы юрлиц`,
      `3. Чистая прибыль бизнеса (В карман);${Math.round(m.netProfit)};${pct(m.netProfit, m.rev)};Финальный чистый результат после ВСЕХ расходов`
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Svodka_SKOS_${fYr}_${fMo}.csv`;
    a.click();
  };

  const origRender = window.render;
  if (typeof origRender === 'function') {
    window.render = function () {
      origRender.apply(this, arguments);
      renderBossAnalyticsBlock();
      if (window.db && db.tab === 'abc') renderEnhancedAbc();
    };
  }

  const origTab = window.tab;
  if (typeof origTab === 'function') {
    window.tab = function (id) {
      origTab.apply(this, arguments);
      if (id === 'dash') renderBossAnalyticsBlock();
      if (id === 'abc') renderEnhancedAbc();
    };
  }

  setTimeout(function () {
    renderBossAnalyticsBlock();
    if (window.db && db.tab === 'abc') renderEnhancedAbc();
  }, 200);
})();
(function () {
  function expandAllYearSelects() {
    const selects = document.querySelectorAll('#f-yr, #abc-f-yr, #up-yr');

    selects.forEach(sel => {
      if (!sel || sel.dataset.years2050 === '1') return;
      const curVal = sel.value || '2026';
      const hasAllOption = Array.from(sel.options).some(o => o.value === 'ALL');

      let html = hasAllOption ? '<option value="ALL">Все годы</option>' : '';
      for (let y = 2020; y <= 2050; y++) {
        html += `<option value="${y}">${y}</option>`;
      }
      sel.innerHTML = html;
      sel.value = curVal;
      sel.dataset.years2050 = '1';
    });
  }

  expandAllYearSelects();
  setInterval(expandAllYearSelects, 2000);
})();
(function () {
  // 1. Заполняем годы 2020–2050 в Сводке (#f-yr), ABC (#abc-f-yr) и Отчётах (#up-yr), не трогая ДДС
  function fillYears2020to2050() {
    ['f-yr', 'abc-f-yr', 'up-yr'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel || sel.options.length > 25) return;

      const curVal = sel.value || '2026';
      const hasAll = Array.from(sel.options).some(o => o.value === 'ALL');
      let html = hasAll ? '<option value="ALL">Все годы</option>' : '';
      for (let y = 2020; y <= 2050; y++) {
        html += '<option value="' + y + '">' + y + '</option>';
      }
      sel.innerHTML = html;
      sel.value = curVal;
    });
  }

  // Храним выбранные для сравнения годы (по умолчанию 2024, 2025, 2026)
  let comparedYears = ['2024', '2025', '2026'];

  window.toggleCompareYear = function (yr) {
    const idx = comparedYears.indexOf(yr);
    if (idx >= 0) {
      if (comparedYears.length > 1) comparedYears.splice(idx, 1);
    } else {
      comparedYears.push(yr);
      comparedYears.sort();
    }
    enhanceDynamicsMultiYear();
  };

  window.addCompareYearFromSelect = function (sel) {
    const y = sel.value;
    if (y && !comparedYears.includes(y)) {
      comparedYears.push(y);
      comparedYears.sort();
      enhanceDynamicsMultiYear();
    }
    sel.value = '';
  };

  // 2. Панель выбора нескольких годов (например, 3 года для сравнения) при нажатии «📊 По годам»
  function enhanceDynamicsMultiYear() {
    const dynBox = document.getElementById('skos-dyn-card');
    if (!dynBox) return;

    const header = dynBox.querySelector('.card-header');
    const btnBar = header ? header.children.item(1) : null;
    const yearBtn = btnBar ? Array.from(btnBar.querySelectorAll('button')).find(b => (b.textContent || '').includes('По годам')) : null;
    if (!header || !yearBtn) return;

    const oldPick = document.getElementById('skos-dyn-yr-pick');
    if (oldPick) oldPick.remove();

    let multiBar = document.getElementById('skos-multi-yr-bar');
    if (!multiBar) {
      multiBar = document.createElement('div');
      multiBar.id = 'skos-multi-yr-bar';
      multiBar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:7px 10px;margin-bottom:10px;font-size:12px;';
      header.insertAdjacentElement('afterend', multiBar);
    }

    const isYearMode = yearBtn.classList.contains('btn-primary');
    multiBar.style.display = isYearMode ? 'flex' : 'none';
    if (!isYearMode) return;

    // Отрисовываем чипсы с галочками для выбранных годов + выбор любого года 2020–2050
    const quickList = Array.from(new Set(['2023', '2024', '2025', '2026', ...comparedYears])).sort();
    let addOpts = '<option value="">+ Добавить год...</option>';
    for (let y = 2020; y <= 2050; y++) {
      if (!quickList.includes(String(y))) {
        addOpts += '<option value="' + y + '">' + y + ' год</option>';
      }
    }

    multiBar.innerHTML =
      '<span style="font-weight:700;color:#334155">Сравнить годы:</span>' +
      quickList.map(y => {
        const checked = comparedYears.includes(y);
        return '<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;cursor:pointer;border:1px solid ' + (checked ? '#2563eb' : '#cbd5e1') + ';background:' + (checked ? '#eff6ff' : '#fff') + ';font-weight:' + (checked ? '700' : '500') + '">' +
          '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="toggleCompareYear(\'' + y + '\')"> ' + y +
        '</label>';
      }).join('') +
      '<select class="select" style="width:auto;padding:3px 8px;font-size:12px" onchange="addCompareYearFromSelect(this)">' + addOpts + '</select>';

    // Пересчитываем таблицу строго по отмеченным годам
    const tbody = dynBox.querySelector('tbody');
    if (!tbody || !window.db) return;
    const fOrg = document.getElementById('f-org')?.value || 'ALL';

    const rows = comparedYears.map(y => {
      const reps = (db.reports || []).filter(r => String(r.yr) === y && (fOrg === 'ALL' || r.org === fOrg));
      let rev = 0, mpFee = 0, cogs = 0;
      reps.forEach(r => {
        rev += Number(r.rev) || 0;
        mpFee += (Number(r.com) || 0) + (Number(r.log) || 0) + (Number(r.ads) || 0);
        cogs += Number(r.cogs) || 0;
      });
      return { label: y + ' год', rev, mpFee, cogs, prof: rev - mpFee - cogs };
    });

    const totRev = rows.reduce((a, x) => a + Math.max(0, x.rev), 0);
    tbody.innerHTML = rows.map((row, idx) => {
      const share = totRev > 0 ? ((Math.max(0, row.rev) / totRev) * 100).toFixed(1) : '0.0';
      const mpPct = row.rev > 0 ? ((row.mpFee / row.rev) * 100).toFixed(1) : '0.0';
      const marPct = row.rev > 0 ? ((row.prof / row.rev) * 100).toFixed(1) : '0.0';
      let gr = '<span style="color:#94a3b8">—</span>';
      if (idx > 0 && rows[idx - 1].rev > 0 && row.rev > 0) {
        const d = ((row.rev - rows[idx - 1].rev) / rows[idx - 1].rev) * 100;
        gr = '<span class="bold ' + (d >= 0 ? 'text-green' : 'text-red') + '">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%</span>';
      }
      return '<tr>' +
        '<td class="bold">' + row.label + '</td>' +
        '<td class="num bold">' + fmtR(row.rev) + '</td>' +
        '<td class="num"><span class="badge badge-blue">' + share + '%</span></td>' +
        '<td class="num">' + gr + '</td>' +
        '<td class="num">' + fmtR(row.mpFee) + ' <span style="font-size:10.5px;color:#64748b">(' + mpPct + '%)</span></td>' +
        '<td class="num">' + fmtR(row.cogs) + '</td>' +
        '<td class="num bold ' + (row.prof >= 0 ? 'text-green' : 'text-red') + '">' + fmtR(row.prof) + ' <span style="font-size:10.5px">(' + marPct + '%)</span></td>' +
      '</tr>';
    }).join('');
  }

  fillYears2020to2050();
  enhanceDynamicsMultiYear();
  setInterval(function () {
    fillYears2020to2050();
    enhanceDynamicsMultiYear();
  }, 500);
})();

(function () {
  // --- 1. ГОДЫ 2020–2050 И СРАВНЕНИЕ НЕСКОЛЬКИХ ЛЕТ ---
  const compareYears = ['2024', '2025', '2026'];

  window.toggleSkosYr = function (y) {
    const idx = compareYears.indexOf(y);
    if (idx >= 0) {
      if (compareYears.length > 1) compareYears.splice(idx, 1);
    } else {
      compareYears.push(y);
      compareYears.sort();
    }
    updateYearsAndDynamics();
  };

  window.addSkosYr = function (sel) {
    const y = sel.value;
    if (y && compareYears.indexOf(y) < 0) {
      compareYears.push(y);
      compareYears.sort();
      updateYearsAndDynamics();
    }
    sel.value = '';
  };

  function updateYearsAndDynamics() {
    ['f-yr', 'abc-f-yr', 'up-yr'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel || sel.options.length > 25) return;
      const cur = sel.value || '2026';
      const hasAll = Array.from(sel.options).some(o => o.value === 'ALL');
      let h = hasAll ? '<option value="ALL">Все годы</option>' : '';
      for (let y = 2020; y <= 2050; y++) h += `<option value="${y}">${y}</option>`;
      sel.innerHTML = h;
      sel.value = cur;
    });

    const dynBox = document.getElementById('skos-dyn-card');
    if (!dynBox) return;
    const header = dynBox.querySelector('.card-header');
    const btnBar = header ? header.children.item(1) : null;
    const yearBtn = btnBar ? Array.from(btnBar.querySelectorAll('button')).find(b => (b.textContent || '').includes('По годам')) : null;
    if (!header || !yearBtn) return;

    let bar = document.getElementById('skos-multi-yr-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'skos-multi-yr-bar';
      bar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:7px 10px;margin-bottom:10px;font-size:12px;';
      header.insertAdjacentElement('afterend', bar);
    }

    const active = yearBtn.classList.contains('btn-primary');
    bar.style.display = active ? 'flex' : 'none';
    if (!active) return;

    const base = Array.from(new Set(['2023', '2024', '2025', '2026', ...compareYears])).sort();
    let addHtml = '<option value="">+ Добавить год (2020–2050)...</option>';
    for (let y = 2020; y <= 2050; y++) {
      if (base.indexOf(String(y)) < 0) addHtml += `<option value="${y}">${y} год</option>`;
    }

    bar.innerHTML = '<span style="font-weight:700;color:#334155">Сравнить годы:</span>' +
      base.map(y => {
        const on = compareYears.indexOf(y) >= 0;
        return `<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;cursor:pointer;border:1px solid ${on ? '#2563eb' : '#cbd5e1'};background:${on ? '#eff6ff' : '#fff'};font-weight:${on ? '700' : '500'}">` +
          `<input type="checkbox" ${on ? 'checked' : ''} onchange="toggleSkosYr('${y}')"> ${y}</label>`;
      }).join('') +
      `<select class="select" style="width:auto;padding:3px 8px;font-size:12px" onchange="addSkosYr(this)">${addHtml}</select>`;

    const tbody = dynBox.querySelector('tbody');
    if (!tbody || !window.db) return;
    const fOrg = document.getElementById('f-org')?.value || 'ALL';

    const rows = compareYears.map(y => {
      const reps = (db.reports || []).filter(r => String(r.yr) === y && (fOrg === 'ALL' || r.org === fOrg));
      let rev = 0, fee = 0, cogs = 0;
      reps.forEach(r => {
        rev += Number(r.rev) || 0;
        fee += (Number(r.com) || 0) + (Number(r.log) || 0) + (Number(r.ads) || 0);
        cogs += Number(r.cogs) || 0;
      });
      return { label: y + ' год', rev, fee, cogs, prof: rev - fee - cogs };
    });

    const tot = rows.reduce((a, x) => a + Math.max(0, x.rev), 0);
    tbody.innerHTML = rows.map((row, idx) => {
      const share = tot > 0 ? ((Math.max(0, row.rev) / tot) * 100).toFixed(1) : '0.0';
      const mpP = row.rev > 0 ? ((row.fee / row.rev) * 100).toFixed(1) : '0.0';
      const marP = row.rev > 0 ? ((row.prof / row.rev) * 100).toFixed(1) : '0.0';
      let gr = '<span style="color:#94a3b8">—</span>';
      if (idx > 0 && rows.at(idx - 1).rev > 0 && row.rev > 0) {
        const d = ((row.rev - rows.at(idx - 1).rev) / rows.at(idx - 1).rev) * 100;
        gr = `<span class="bold ${d >= 0 ? 'text-green' : 'text-red'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%</span>`;
      }
      return `<tr><td class="bold">${row.label}</td><td class="num bold">${fmtR(row.rev)}</td><td class="num"><span class="badge badge-blue">${share}%</span></td><td class="num">${gr}</td><td class="num">${fmtR(row.fee)} <span style="font-size:10.5px;color:#64748b">(${mpP}%)</span></td><td class="num">${fmtR(row.cogs)}</td><td class="num bold ${row.prof >= 0 ? 'text-green' : 'text-red'}">${fmtR(row.prof)} <span style="font-size:10.5px">(${marP}%)</span></td></tr>`;
    }).join('');
  }

  // --- 2. РУЧНОЙ РЕДАКТОР СТОЛБЦОВ ОТЧЁТОВ МП (если МП поменял названия или добавил колонки) ---
  const MAP_STORAGE_KEY = 'skos_v3_custom_col_aliases';
  const defaultAliases = {
    bc: 'Баркод, SKU, Ваш SKU, ШК, Штрихкод',
    art: 'Артикул поставщика, Артикул, Артикул продавца',
    qty: 'Кол-во, Количество, Количество доставленных товаров',
    rev: 'Вайлдберриз реализовал товар, Сумма итого, Цена продажи, Выручка',
    pay: 'К перечислению продавцу, Итого к начислению',
    log: 'Услуги по доставке товара покупателю, Доставка покупателю, Логистика',
    com: 'Хранение, Вознаграждение, Все услуги маркета за заказы, Комиссия',
    ads: 'Общая сумма штрафов, Удержания, Буст продаж, Продвижение, Реклама'
  };

  window.openColMappingModal = function () {
    let saved = { ...defaultAliases };
    try {
      const raw = JSON.parse(localStorage.getItem(MAP_STORAGE_KEY) || '{}');
      saved = { ...saved, ...raw };
    } catch (e) {}

    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:660px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="font-size:16px;font-weight:800">⚙️ Ручная настройка столбцов отчётов МП</h3>
          <button type="button" class="btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <p style="font-size:12px;color:#475569;margin-bottom:10px">
          Если маркетплейс переименовал столбец или добавил новый — впишите его название через запятую в нужное поле (или удалите ненужное). Программа будет искать столбцы по этому списку.
        </p>
        <div style="display:grid;gap:8px;max-height:55vh;overflow-y:auto;padding-right:4px">
          <div><label>Штрихкод / Баркод / SKU</label><input class="input" id="cm-bc" value="${saved.bc}"></div>
          <div><label>Артикул продавца</label><input class="input" id="cm-art" value="${saved.art}"></div>
          <div><label>Количество (шт.)</label><input class="input" id="cm-qty" value="${saved.qty}"></div>
          <div><label>Выручка / Цена продажи</label><input class="input" id="cm-rev" value="${saved.rev}"></div>
          <div><label>К перечислению продавцу</label><input class="input" id="cm-pay" value="${saved.pay}"></div>
          <div><label>Логистика и доставка</label><input class="input" id="cm-log" value="${saved.log}"></div>
          <div><label>Комиссия, хранение и услуги МП</label><input class="input" id="cm-com" value="${saved.com}"></div>
          <div><label>Реклама, продвижение, штрафы и удержания</label><input class="input" id="cm-ads" value="${saved.ads}"></div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn" id="cm-reset">↩️ Сбросить по умолчанию</button>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button>
            <button type="button" class="btn btn-primary" id="cm-save">✅ Сохранить правила столбцов</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cm-reset').onclick = function () {
      localStorage.removeItem(MAP_STORAGE_KEY);
      modal.remove();
      alert('Настройки столбцов сброшены на стандартные!');
    };
    document.getElementById('cm-save').onclick = function () {
      const next = {
        bc: document.getElementById('cm-bc').value.trim(),
        art: document.getElementById('cm-art').value.trim(),
        qty: document.getElementById('cm-qty').value.trim(),
        rev: document.getElementById('cm-rev').value.trim(),
        pay: document.getElementById('cm-pay').value.trim(),
        log: document.getElementById('cm-log').value.trim(),
        com: document.getElementById('cm-com').value.trim(),
        ads: document.getElementById('cm-ads').value.trim()
      };
      localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(next));
      modal.remove();
      alert('Новые названия столбцов сохранены! Теперь они будут автоматически распознаваться при загрузке файлов.');
    };
  };

  function injectColMappingBtn() {
    const repTab = document.getElementById('tab-rep');
    if (!repTab) return;
    const hdr = repTab.querySelector('.card-header');
    if (!hdr || document.getElementById('skos-col-map-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'skos-col-map-btn';
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = '⚙️ Настроить столбцы МП';
    btn.onclick = window.openColMappingModal;
    hdr.appendChild(btn);
  }

  document.addEventListener('click', function () {
    setTimeout(function () {
      updateYearsAndDynamics();
      injectColMappingBtn();
    }, 80);
  });

  setTimeout(function () {
    updateYearsAndDynamics();
    injectColMappingBtn();
  }, 300);
})();

