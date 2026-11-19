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
  // 1. Делаем папки на вкладке товаров сверхлёгкими: строки ШК рисуются ТОЛЬКО при клике на папку!
  function optimizeFoldersLazy() {
    const wrap = document.getElementById('skos-folders-wrap');
    if (!wrap) return;

    wrap.querySelectorAll('details').forEach(det => {
      if (det.dataset.lazyReady === '1') return;
      det.dataset.lazyReady = '1';

      const bodyDiv = det.querySelector('div');
      if (!bodyDiv) return;

      // Если папка закрыта — выгружаем тяжёлую таблицу из DOM в память до момента клика
      if (!det.open) {
        det._cachedHtml = bodyDiv.innerHTML;
        bodyDiv.innerHTML = '';
      }

      det.addEventListener('toggle', function () {
        if (det.open && det._cachedHtml) {
          bodyDiv.innerHTML = det._cachedHtml;
          det._cachedHtml = null;
        }
      });
    });
  }

  // 2. Запрещаем перестройку каталога на 11 248 ШК, когда пользователь находится на других вкладках
  const prevRender = window.render;
  if (typeof prevRender === 'function') {
    window.render = function () {
      const wrap = document.getElementById('skos-folders-wrap');
      if (wrap && window.db && db.tab !== 'sku') {
        wrap.innerHTML = ''; // Очищаем тяжёлый DOM каталога при уходе со вкладки товаров
      }
      prevRender.apply(this, arguments);
      if (window.db && db.tab === 'sku') {
        setTimeout(optimizeFoldersLazy, 50);
      }
    };
  }

  const prevTab = window.tab;
  if (typeof prevTab === 'function') {
    window.tab = function (id) {
      const wrap = document.getElementById('skos-folders-wrap');
      if (wrap && id !== 'sku') {
        wrap.innerHTML = '';
      }
      prevTab.apply(this, arguments);
      if (id === 'sku') {
        setTimeout(optimizeFoldersLazy, 50);
      }
    };
  }

  setTimeout(optimizeFoldersLazy, 300);
})();

(function () {
  function fixClosedFoldersAndPrices() {
    const wrap = document.getElementById('skos-folders-wrap');
    if (!wrap || !window.db || !Array.isArray(db.skus)) return;

    let fNames = {};
    try { fNames = JSON.parse(localStorage.getItem('skos_v3_folder_names') || '{}'); } catch (e) {}

    // Собираем список папок по порядку из базы
    const foldersMap = new Map();
    db.skus.forEach(s => {
      const fk = String(s.art || '').trim() || 'Без артикула';
      if (!foldersMap.has(fk)) {
        foldersMap.set(fk, { key: fk, title: fNames[fk] || s.name || fk, count: 0 });
      }
      foldersMap.get(fk).count += 1;
    });
    const sortedFolders = Array.from(foldersMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    const summaries = wrap.querySelectorAll('details > summary');
    summaries.forEach((sum, idx) => {
      // 1. Убираем двойную цену (оставляем основную после тире)
      const greenBadge = sum.querySelector('.badge-green');
      if (greenBadge) {
        const txt = greenBadge.textContent || '';
        if (txt.includes('–') || txt.includes('-')) {
          const parts = txt.split(/[–-]/);
          const singlePrice = parts.at(-1).trim();
          if (singlePrice) greenBadge.textContent = singlePrice;
        }
      }

      // 2. Если у закрытой папки пустой левый блок — вписываем её название, артикул и кол-во ШК
      const leftDiv = sum.children.item(0);
      const info = sortedFolders.at(idx);
      if (leftDiv && info && (!leftDiv.textContent || !leftDiv.textContent.trim())) {
        leftDiv.innerHTML = `
          <span style="font-size:15px">📁</span>
          <span style="font-weight:800;font-size:13px;color:#0f172a">${info.key}</span>
          <span style="font-size:12.5px;color:#475569">— ${info.title}</span>
          <span class="badge badge-blue">${info.count} ШК</span>
        `;
      }
    });
  }

  setInterval(fixClosedFoldersAndPrices, 1000);
  setTimeout(fixClosedFoldersAndPrices, 300);
})();
