/* === SKOS Finance 3.0 — Точная Юнит-экономика (1-в-1 как в таблице SKOS) === */
(function () {
  window.unitState = { sub: 'WB', org: 'ALL', yr: '2026', mo: 'ALL', model: 'ALL' };
  window.unitCalcState = { mp: 'WB', model: '', price: 4500, buyout: 30, commPct: 29, acqPct: 1.5, logTo: 120, logBack: 50, pack: 65, taxPct: 8, drrPct: 5, targetMargin: 25 };

  function hidePages(keepId) {
    document.querySelectorAll('[id^="tab-"], [id^="page-"], [id^="sec-"], .tab-sec, .page').forEach(el => {
      const show = el.id === keepId;
      el.classList.toggle('hidden', !show);
      el.classList.toggle('active', show);
      el.style.display = show ? 'block' : 'none';
    });
  }

  window.mountUnitNav = function () {
    const abcBtn = document.getElementById('nav-abc');
    const abcSec = document.getElementById('tab-abc') || document.getElementById('page-abc') || document.getElementById('sec-abc') || document.querySelector('[id$="-abc"]');
    if (abcBtn && !document.getElementById('nav-unit')) {
      const btn = document.createElement('button');
      btn.id = 'nav-unit'; btn.type = 'button'; btn.className = 'nav-btn';
      btn.textContent = '🧮 Юнит-экономика (WB / Ozon / ЯМ)';
      btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hidePages('page-unit');
        window.renderUnitTab();
      };
      abcBtn.insertAdjacentElement('afterend', btn);
    }
    if (abcSec && !document.getElementById('page-unit')) {
      const sec = document.createElement('div');
      sec.id = 'page-unit';
      sec.className = abcSec.className;
      sec.style.display = 'none';
      abcSec.insertAdjacentElement('afterend', sec);
    }
    document.querySelectorAll('.nav-btn:not(#nav-unit)').forEach(b => {
      if (!b.dataset.uClean) {
        b.dataset.uClean = '1';
        b.addEventListener('click', () => {
          document.getElementById('nav-unit')?.classList.remove('active');
          const u = document.getElementById('page-unit');
          if (u) { u.classList.add('hidden'); u.classList.remove('active'); u.style.display = 'none'; }
          document.querySelectorAll('[id^="tab-"], [id^="page-"], [id^="sec-"], .tab-sec, .page').forEach(el => {
            if (el.id !== 'page-unit') el.style.removeProperty('display');
          });
        }, true);
      }
    });
  };

  function resolveFolder(artRaw, nameRaw, fNames, skuMap) {
    const aLow = String(artRaw || '').trim().toLowerCase();
    const nLow = String(nameRaw || '').trim().toLowerCase();
    if (fNames[aLow]) return fNames[aLow];
    if (skuMap.has(aLow)) {
      const s = skuMap.get(aLow);
      const k = String(s.art || '').trim().toLowerCase();
      if (fNames[k]) return fNames[k];
    }
    const full = (String(artRaw || '') + ' ' + String(nameRaw || '')).toUpperCase().replace(/SKOS[\s\-_]+/g, 'SKOS-');
    const match = full.match(/SKOS-([A-ZА-Я]{1,5})/);
    if (match) {
      const pref = 'skos-' + match[1].toLowerCase();
      if (fNames[pref]) return fNames[pref];
    }
    if (nLow.includes('двойка') && fNames['skos-kd']) return fNames['skos-kd'];
    return nameRaw || artRaw || 'Без модели';
  }
  window.buildUnitRows = function (mpCode) {
    const { org, yr, mo, model } = window.unitState;
    const fNames = window.getFolderNames ? window.getFolderNames() : {};
    const skuMap = new Map(), usdByFolder = new Map();
    (window.db.skus || []).forEach(s => {
      const a = String(s.art || '').trim().toLowerCase(), b = String(s.bc || '').trim().toLowerCase();
      if (a) skuMap.set(a, s);
      if (b) skuMap.set(b, s);
      const fn = fNames[a] || s.name || s.art;
      if (fn && window.num(s.usd) > 0 && !usdByFolder.has(fn)) usdByFolder.set(fn, window.num(s.usd));
    });

    const repMap = new Map(), repTotals = new Map();
    (window.db.reports || []).forEach(r => {
      repMap.set(String(r.id), r);
      if (String(r.mp || '').toUpperCase() !== mpCode) return;
      const k = `${r.org || ''}|||${String(r.per || r.period || r.month || '')}`;
      const cur = repTotals.get(k) || { rev: 0, log: 0, comm: 0, ret: 0, retQty: 0 };
      cur.rev += window.num(r.rev || 0);
      cur.log += window.num(r.log || 0);
      cur.comm += window.num(r.comm || 0) + window.num(r.ads || 0);
      cur.ret += window.num(r.ret || 0);
      cur.retQty += window.num(r.retQty || r.rq || 0);
      repTotals.set(k, cur);
    });
    const fallbackRt = Array.from(repTotals.values()).reduce((a, b) => ({ rev: a.rev + b.rev, log: a.log + b.log, comm: a.comm + b.comm, ret: a.ret + b.ret, retQty: a.retQty + b.retQty }), { rev: 0, log: 0, comm: 0, ret: 0, retQty: 0 });

    const map = new Map(), modelsSet = new Set(), rate = window.getRate();
    (window.db.itemSales || []).forEach(s => {
      const r = repMap.get(String(s.repId || s.rId || s.reportId || ''));
      const mp = String(r ? r.mp : (s.mp || '')).toUpperCase();
      if (mp !== mpCode) return;
      const rOrg = r ? r.org : (s.org || 'ИП Каримов Артем');
      const rPer = String(r ? (r.per || r.period || r.month || '') : (s.per || s.period || '2026-01'));
      const title = resolveFolder(s.art || s.bc, s.name, fNames, skuMap);
      modelsSet.add(title);

      if (org !== 'ALL' && rOrg !== org) return;
      if (yr !== 'ALL' && rPer && !rPer.startsWith(yr)) return;
      if (mo !== 'ALL' && rPer && rPer.slice(5, 7) !== mo) return;
      if (model !== 'ALL' && title !== model) return;

      const rNet = window.num(s.rev || 0);
      const uUsd = usdByFolder.get(title) || 0;
      const rt = repTotals.get(`${rOrg}|||${rPer}`) || fallbackRt;
      const share = (rt && rt.rev > 0) ? (rNet / rt.rev) : 0;

      let qNet = window.num(s.sold ?? s.q ?? s.qty ?? s.qSale ?? s.saleQty ?? s.cnt ?? 0);
      let qR = window.num(s.rq ?? s.retQty ?? s.qRet ?? s.retCnt ?? 0);
      if (qNet < 0) { qR += Math.abs(qNet); qNet = 0; }
      if (!qNet && rNet > 0) qNet = Math.max(1, Math.round(rNet / 2600));
      if (!qR && rt && rt.retQty > 0) qR = Math.round(rt.retQty * share);
      if (!qR && rt && rt.ret > 0 && rNet > 0) qR = Math.round((rt.ret * share) / (rNet / Math.max(1, qNet)));

      // Реальная себестоимость каждой модели (Штуки × Цена папки в $ × Курс)
      const cNet = (qNet > 0 && uUsd > 0) ? (qNet * uUsd * rate) : window.num(s.cost || 0);
      // Реальная логистика и комиссия из строки продажи (если есть), иначе из отчёта
      const sLog = window.num(s.log || 0);
      const sComm = window.num(s.comm || 0) + window.num(s.ads || 0);
      const log = sLog > 0 ? sLog : (rt ? rt.log * share : 0);
      const comm = sComm > 0 ? sComm : (rt ? rt.comm * share : 0);

      const key = `${rOrg}|||${rPer}|||${title}`;
      const cur = map.get(key) || { org: rOrg, per: rPer, title, qS: 0, qR: 0, qN: 0, netRev: 0, cNet: 0, log: 0, comm: 0 };
      cur.qN += qNet; cur.qR += qR; cur.qS += (qNet + qR);
      cur.netRev += rNet; cur.cNet += cNet; cur.log += log; cur.comm += comm;
      map.set(key, cur);
    });

    const rows = Array.from(map.values()).map(x => {
      const netQty = x.qN, retPct = x.qS > 0 ? (x.qR / x.qS) * 100 : 0, buyoutPct = x.qS > 0 ? (netQty / x.qS) * 100 : 0;
      const avgCheck = netQty > 0 ? x.netRev / netQty : 0;
      const costPct = x.netRev > 0 ? (x.cNet / x.netRev) * 100 : 0, costUnit = netQty > 0 ? x.cNet / netQty : 0;
      const logPct = x.netRev > 0 ? (x.log / x.netRev) * 100 : 0, logUnit = netQty > 0 ? x.log / netQty : 0, commPct = x.netRev > 0 ? (x.comm / x.netRev) * 100 : 0;
      const commUnit = netQty > 0 ? x.comm / netQty : 0;
      const margin = x.netRev - x.cNet - x.log - x.comm, margUnit = netQty > 0 ? margin / netQty : 0;
      const rentPct = x.netRev > 0 ? (margin / x.netRev) * 100 : 0;
      return Object.assign(x, { netQty, retPct, buyoutPct, avgCheck, costPct, costUnit, logPct, logUnit, commPct, commUnit, margin, margUnit, rentPct });
    }).sort((a, b) => b.netRev - a.netRev);
    return { rows, models: Array.from(modelsSet).sort() };
  };
  window.renderUnitTab = function () {
    window.mountUnitNav();
    const sec = document.getElementById('page-unit'); if (!sec) return;
    const st = window.unitState, c = window.unitCalcState, rate = window.getRate(), fNames = window.getFolderNames ? window.getFolderNames() : {};
    const nav = [['WB', '🟣 UNIT ВБ (факт)'], ['OZON', '🔵 UNIT Ozon (факт)'], ['YM', '🟡 UNIT ЯМ (факт)'], ['CALC', '🧮 Калькулятор цены (план)']]
      .map(([k, t]) => `<button type="button" class="btn ${st.sub === k ? 'btn-primary' : ''}" style="display:inline-flex;align-items:center" onclick="unitState.sub='${k}';unitState.model='ALL';renderUnitTab()">${t}</button>`).join('');

    if (st.sub === 'CALC') {
      const models = [...new Set((window.db.skus || []).map(s => fNames[String(s.art || '').trim().toLowerCase()] || s.name || s.art).filter(Boolean))].sort();
      const usd = (window.db.skus || []).find(s => (fNames[String(s.art || '').trim().toLowerCase()] || s.name || s.art) === c.model && window.num(s.usd) > 0)?.usd || 0;
      const costRub = window.num(usd) * rate, bRate = Math.max(0.1, Math.min(1, window.num(c.buyout) / 100));
      const realLog = (window.num(c.logTo) + (1 - bRate) * window.num(c.logBack)) / bRate;
      const varPct = (window.num(c.commPct) + window.num(c.acqPct) + window.num(c.taxPct) + window.num(c.drrPct)) / 100;
      const fixRub = costRub + realLog + window.num(c.pack), profit = window.num(c.price) * (1 - varPct) - fixRub;
      const marginPct = window.num(c.price) > 0 ? (profit / window.num(c.price)) * 100 : 0;
      const breakEven = fixRub / Math.max(0.05, 1 - varPct), recPrice = fixRub / Math.max(0.05, 1 - varPct - Math.min(0.7, window.num(c.targetMargin) / 100));
      sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🧮 Калькулятор Юнит-экономики SKOS</div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${nav}</div>
        <div class="form-grid" style="margin-bottom:12px">
          <div style="grid-column:span 2"><label>Папка-модель (Курс: ${rate} ₽/$)</label><select class="select" onchange="unitCalcState.model=this.value;renderUnitTab()"><option value="">— Выберите модель —</option>${models.map(m => `<option value="${window.esc(m)}"${m === c.model ? ' selected' : ''}>${window.esc(m)}</option>`).join('')}</select></div>
          <div><label>Цена ₽</label><input type="number" class="input" value="${c.price}" onchange="unitCalcState.price=num(this.value);renderUnitTab()"></div>
          <div><label>% Выкупа</label><input type="number" class="input" value="${c.buyout}" onchange="unitCalcState.buyout=num(this.value);renderUnitTab()"></div>
          <div><label>Комиссия %</label><input type="number" step="0.1" class="input" value="${c.commPct}" onchange="unitCalcState.commPct=num(this.value);renderUnitTab()"></div>
          <div><label>Эквайринг %</label><input type="number" step="0.1" class="input" value="${c.acqPct}" onchange="unitCalcState.acqPct=num(this.value);renderUnitTab()"></div>
          <div><label>Логистика туда ₽</label><input type="number" class="input" value="${c.logTo}" onchange="unitCalcState.logTo=num(this.value);renderUnitTab()"></div>
          <div><label>Возврат ₽</label><input type="number" class="input" value="${c.logBack}" onchange="unitCalcState.logBack=num(this.value);renderUnitTab()"></div>
          <div><label>Упаковка ₽</label><input type="number" class="input" value="${c.pack}" onchange="unitCalcState.pack=num(this.value);renderUnitTab()"></div>
          <div><label>Налог %</label><input type="number" step="0.1" class="input" value="${c.taxPct}" onchange="unitCalcState.taxPct=num(this.value);renderUnitTab()"></div>
          <div><label>ДРР %</label><input type="number" step="0.1" class="input" value="${c.drrPct}" onchange="unitCalcState.drrPct=num(this.value);renderUnitTab()"></div>
          <div><label>Цель маржи %</label><input type="number" class="input" value="${c.targetMargin}" onchange="unitCalcState.targetMargin=num(this.value);renderUnitTab()"></div>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card"><div>Себест. (${window.num(usd).toFixed(2)} $)</div><div class="kpi-val">${window.fmtR(costRub)}</div></div>
          <div class="kpi-card"><div>Логист. с выкупом</div><div class="kpi-val">${window.fmtR(realLog)}</div></div>
          <div class="kpi-card highlight"><div>Прибыль с 1 шт</div><div class="kpi-val ${profit >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(profit)} (${marginPct.toFixed(1)}%)</div></div>
          <div class="kpi-card" style="background:#fef2f2"><div>Мин. цена в ноль</div><div class="kpi-val text-red">${window.fmtR(breakEven)}</div></div>
          <div class="kpi-card" style="background:#f0fdf4"><div>Реком. цена (${c.targetMargin}%)</div><div class="kpi-val text-green">${window.fmtR(recPrice)}</div></div>
        </div></div>`;
      return;
    }
    const { rows, models } = window.buildUnitRows(st.sub);
    const orgNames = [...new Set((window.db.orgs || []).map(o => o.name))];
    let yrOpts = '<option value="ALL">Все года</option>';
    for (let y = 2020; y <= 2050; y++) yrOpts += `<option value="${y}"${String(y) === st.yr ? ' selected' : ''}>${y}</option>`;
    const mos = [['ALL', 'Все месяцы'], ['01', 'Январь'], ['02', 'Февраль'], ['03', 'Март'], ['04', 'Апрель'], ['05', 'Май'], ['06', 'Июнь'], ['07', 'Июль'], ['08', 'Август'], ['09', 'Сентябрь'], ['10', 'Октябрь'], ['11', 'Ноябрь'], ['12', 'Декабрь']];
    const moOpts = mos.map(([k, v]) => `<option value="${k}"${k === st.mo ? ' selected' : ''}>${v}</option>`).join('');

    const tot = rows.reduce((a, r) => { a.qS += r.qS; a.qR += r.qR; a.qN += r.netQty; a.rN += r.netRev; a.cN += r.cNet; a.l += r.log; a.cm += r.comm; a.m += r.margin; return a; }, { qS: 0, qR: 0, qN: 0, rN: 0, cN: 0, l: 0, cm: 0, m: 0 });
    const tRet = tot.qS > 0 ? (tot.qR / tot.qS) * 100 : 0, tBuy = tot.qS > 0 ? (tot.qN / tot.qS) * 100 : 0;
    const tAvg = tot.qN > 0 ? tot.rN / tot.qN : 0, tCostU = tot.qN > 0 ? tot.cN / tot.qN : 0, tLogU = tot.qN > 0 ? tot.l / tot.qN : 0, tCommU = tot.qN > 0 ? tot.cm / tot.qN : 0, tMargU = tot.qN > 0 ? tot.m / tot.qN : 0;
    const tRent = tot.rN > 0 ? (tot.m / tot.rN) * 100 : 0;

    const trs = rows.map(r => `<tr>
      <td>${window.esc(r.org)}</td><td>${window.esc(r.per)}</td><td class="bold">${window.esc(r.title)}</td>
      <td class="num">${r.qS}</td><td class="num text-red">${r.qR}</td><td class="num bold">${r.netQty}</td>
      <td class="num bold text-green">${r.buyoutPct.toFixed(1)}%</td><td class="num">${r.retPct.toFixed(1)}%</td>
      <td class="num bold">${window.fmtR(r.netRev)}</td><td class="num bold" style="background:#f8fafc">${window.fmtR(r.avgCheck)}</td>
      <td class="num">${window.fmtR(r.cNet)} (${r.costPct.toFixed(0)}%)</td><td class="num" style="background:#f8fafc">${window.fmtR(r.costUnit)}</td>
      <td class="num">${window.fmtR(r.log)} (${r.logPct.toFixed(0)}%)</td><td class="num" style="background:#f8fafc">${window.fmtR(r.logUnit)}</td>
      <td class="num">${window.fmtR(r.comm)} (${r.commPct.toFixed(0)}%)</td><td class="num" style="background:#f8fafc">${window.fmtR(r.commUnit)}</td>
      <td class="num bold ${r.margin >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(r.margin)}</td>
      <td class="num bold ${r.margUnit >= 0 ? 'text-green' : 'text-red'}" style="background:#f0fdf4">${window.fmtR(r.margUnit)}</td>
      <td class="num"><span class="badge ${r.rentPct >= 25 ? 'badge-green' : (r.rentPct >= 10 ? 'badge-amber' : 'badge-red')}">${r.rentPct.toFixed(1)}%</span></td>
    </tr>`).join('');

    sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🧮 Юнит-экономика SKOS (${st.sub}) — По папкам-моделям</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${nav}</div>
      <div class="form-grid" style="margin-bottom:10px">
        <div><label>Юрлицо / Аккаунт</label><select class="select" onchange="unitState.org=this.value;renderUnitTab()"><option value="ALL">Все (5 ИП + ООО)</option>${orgNames.map(n => `<option value="${window.esc(n)}"${n === st.org ? ' selected' : ''}>${window.esc(n)}</option>`).join('')}</select></div>
        <div><label>Год (2020–2050)</label><select class="select" onchange="unitState.yr=this.value;renderUnitTab()">${yrOpts}</select></div>
        <div><label>Месяц</label><select class="select" onchange="unitState.mo=this.value;renderUnitTab()">${moOpts}</select></div>
        <div style="grid-column:span 2"><label>Папка-модель (${models.length} шт.)</label><select class="select" onchange="unitState.model=this.value;renderUnitTab()"><option value="ALL">— Все папки-модели —</option>${models.map(m => `<option value="${window.esc(m)}"${m === st.model ? ' selected' : ''}>${window.esc(m)}</option>`).join('')}</select></div>
      </div>
      <div style="overflow-x:auto"><table style="font-size:11.5px;white-space:nowrap">
        <thead>
          <tr><th>Аккаунт</th><th>Период</th><th>Папка-модель</th><th class="num">Прод</th><th class="num">Возвр</th><th class="num">Чист</th><th class="num">Выкуп %</th><th class="num">%возв</th><th class="num">Выручка ₽</th><th class="num" style="background:#eef2ff">Ср.чек/шт</th><th class="num">Себест ₽</th><th class="num" style="background:#eef2ff">Себ/шт</th><th class="num">Логист ₽</th><th class="num" style="background:#eef2ff">Лог/шт</th><th class="num">Комис+Экв</th><th class="num" style="background:#eef2ff">Ком/шт</th><th class="num">Маржа ₽</th><th class="num" style="background:#dcfce7">Маржа/шт</th><th class="num">Рентаб</th></tr>
          <tr style="background:#f1f5f9;font-weight:800"><td colspan="3">ИТОГО (${rows.length} папок)</td><td class="num">${tot.qS}</td><td class="num text-red">${tot.qR}</td><td class="num">${tot.qN}</td><td class="num text-green">${tBuy.toFixed(1)}%</td><td class="num">${tRet.toFixed(1)}%</td><td class="num">${window.fmtR(tot.rN)}</td><td class="num">${window.fmtR(tAvg)}</td><td class="num">${window.fmtR(tot.cN)}</td><td class="num">${window.fmtR(tCostU)}</td><td class="num">${window.fmtR(tot.l)}</td><td class="num">${window.fmtR(tLogU)}</td><td class="num">${window.fmtR(tot.cm)}</td><td class="num">${window.fmtR(tCommU)}</td><td class="num ${tot.m >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(tot.m)}</td><td class="num ${tMargU >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(tMargU)}</td><td class="num">${tRent.toFixed(1)}%</td></tr>
        </thead><tbody>${trs || '<tr><td colspan="19">Нет данных за выбранный период</td></tr>'}</tbody>
      </table></div></div>`;
  };

  let _cloudTicks = 0;
  const _cloudWatch = setInterval(() => {
    window.mountUnitNav();
    if (window.db && (window.db.reports || []).length > 0) {
      _cloudTicks++;
      const svodBtn = document.getElementById('nav-svod');
      if (svodBtn && svodBtn.classList.contains('active')) {
        if (typeof window.onPerChange === 'function') window.onPerChange();
        if (typeof window.render === 'function') window.render();
      }
      if (_cloudTicks >= 4) clearInterval(_cloudWatch);
    }
  }, 500);
  window.mountUnitNav();
})();
