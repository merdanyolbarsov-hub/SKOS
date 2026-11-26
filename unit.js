/* === SKOS Finance 3.0 — Независимый модуль Юнит-экономики (WB / Ozon / ЯМ) === */
(function () {
  window.unitState = { sub: 'WB', org: 'ALL', yr: '2026', mo: 'ALL', model: 'ALL' };
  window.unitCalcState = { mp: 'WB', model: '', price: 4500, buyout: 88, commPct: 29, acqPct: 1.5, logTo: 120, logBack: 50, pack: 65, taxPct: 8, drrPct: 5, targetMargin: 25 };

  function hideAllPagesExcept(keepId) {
    document.querySelectorAll('[id^="tab-"], [id^="page-"], [id^="sec-"], .tab-sec, .page').forEach(el => {
      if (el.id === keepId) {
        el.classList.remove('hidden');
        el.classList.add('active');
        el.style.display = 'block';
      } else {
        el.classList.add('hidden');
        el.classList.remove('active');
        el.style.display = 'none';
      }
    });
  }

  window.mountUnitNav = function () {
    const abcBtn = document.getElementById('nav-abc');
    const abcSec = document.getElementById('tab-abc') || document.getElementById('page-abc') || document.getElementById('sec-abc') || document.querySelector('[id$="-abc"]');
    if (abcBtn && !document.getElementById('nav-unit')) {
      const btn = document.createElement('button');
      btn.id = 'nav-unit'; btn.type = 'button'; btn.className = 'nav-btn';
      btn.textContent = '🧮 Юнит-экономика (WB / Ozon / ЯМ)';
      btn.onclick = function () {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hideAllPagesExcept('page-unit');
        window.renderUnitTab();
      };
      abcBtn.insertAdjacentElement('afterend', btn);
    }
    if (abcSec && !document.getElementById('page-unit')) {
      const sec = document.createElement('div');
      sec.id = 'page-unit';
      sec.className = abcSec.className;
      sec.classList.add('hidden');
      sec.classList.remove('active');
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

  window.getUnitFolderName = function (artRaw, nameRaw, fNames, skuMap) {
    const low = String(artRaw || '').trim().toLowerCase();
    if (fNames[low]) return fNames[low];
    const up = (String(artRaw || '') + ' ' + String(nameRaw || '')).toUpperCase();
    const pos = up.indexOf('SKOS-');
    if (pos !== -1) {
      let pref = 'skos-';
      for (let i = pos + 5; i < up.length; i++) {
        const ch = up[i];
        if ((ch >= 'A' && ch <= 'Z') || (ch >= 'А' && ch <= 'Я')) pref += ch.toLowerCase();
        else break;
      }
      if (fNames[pref]) return fNames[pref];
    }
    if (skuMap.has(low)) {
      const s = skuMap.get(low);
      const k = String(s.art || '').trim().toLowerCase();
      return fNames[k] || s.name || s.art;
    }
    return nameRaw || artRaw || 'Без модели';
  };
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
    const repMap = new Map();
    (window.db.reports || []).forEach(r => repMap.set(String(r.id), r));

    const map = new Map(), modelsSet = new Set();
    (window.db.itemSales || []).forEach(s => {
      const r = repMap.get(String(s.repId || s.rId || s.reportId || '')) || (window.db.reports || []).find(x => Object.values(s).map(String).includes(String(x.id)));
      const mp = String(r ? r.mp : (s.mp || '')).toUpperCase();
      if (mp !== mpCode) return;
      const rOrg = r ? r.org : (s.org || 'Без юрлица');
      const rPer = String(r ? (r.per || r.period || r.month || '') : (s.per || ''));
      const title = window.getUnitFolderName(s.art || s.bc, s.name, fNames, skuMap);
      modelsSet.add(title);
      if (org !== 'ALL' && rOrg !== org) return;
      if (yr !== 'ALL' && rPer && !rPer.startsWith(yr)) return;
      if (mo !== 'ALL' && rPer && rPer.slice(5, 7) !== mo) return;
      if (model !== 'ALL' && title !== model) return;

      const rS = Math.max(0, window.num(s.rev || 0)), rR = window.num(s.ret || s.retRev || 0);
      const cNet = window.num(s.cost || 0), log = window.num(s.log || 0), comm = window.num(s.comm || 0) + window.num(s.ads || 0);
      const uUsd = usdByFolder.get(title) || 0, rate = window.getRate();
      const qNet = window.num(s.q || s.qty || 0) || (uUsd > 0 && rate > 0 ? Math.round(cNet / (uUsd * rate)) : 0);
      const qR = window.num(s.rq || s.retQty || 0);
      const key = `${rOrg}|||${rPer}|||${title}`;
      const cur = map.get(key) || { org: rOrg, per: rPer, title, qS: 0, qR: 0, rS: 0, rR: 0, cNet: 0, log: 0, comm: 0 };
      cur.qS += qNet + qR; cur.qR += qR; cur.rS += rS; cur.rR += rR; cur.cNet += cNet; cur.log += log; cur.comm += comm;
      map.set(key, cur);
    });

    const rows = Array.from(map.values()).map(x => {
      const netQty = Math.max(0, x.qS - x.qR), retPct = x.qS > 0 ? (x.qR / x.qS) * 100 : 0, netRev = x.rS - x.rR, avgCheck = netQty > 0 ? netRev / netQty : 0;
      const costPct = netRev > 0 ? (x.cNet / netRev) * 100 : 0, costUnit = netQty > 0 ? x.cNet / netQty : 0;
      const logPct = netRev > 0 ? (x.log / netRev) * 100 : 0, logUnit = netQty > 0 ? x.log / netQty : 0, commPct = netRev > 0 ? (x.comm / netRev) * 100 : 0;
      const margin = netRev - x.cNet - x.log - x.comm, rentPct = netRev > 0 ? (margin / netRev) * 100 : 0;
      return Object.assign(x, { netQty, retPct, netRev, avgCheck, costPct, costUnit, logPct, logUnit, commPct, margin, rentPct });
    }).sort((a, b) => b.netRev - a.netRev);
    return { rows, models: Array.from(modelsSet).sort() };
  };
  window.renderUnitTab = function () {
    window.mountUnitNav();
    const sec = document.getElementById('page-unit'); if (!sec) return;
    const st = window.unitState, c = window.unitCalcState, rate = window.getRate(), fNames = window.getFolderNames ? window.getFolderNames() : {};
    const nav = [['WB', '🟣 UNIT ВБ (факт)'], ['OZON', '🔵 UNIT Ozon (факт)'], ['YM', '🟡 UNIT ЯМ (факт)'], ['CALC', '🧮 Калькулятор цены (план)']]
      .map(([k, t]) => `<button type="button" class="btn ${st.sub === k ? 'btn-primary' : ''}" onclick="unitState.sub='${k}';unitState.model='ALL';renderUnitTab()">${t}</button>`).join('');

    if (st.sub === 'CALC') {
      const models = [...new Set((window.db.skus || []).map(s => fNames[String(s.art || '').trim().toLowerCase()] || s.name || s.art).filter(Boolean))].sort();
      const usd = (window.db.skus || []).find(s => (fNames[String(s.art || '').trim().toLowerCase()] || s.name || s.art) === c.model && window.num(s.usd) > 0)?.usd || 0;
      const costRub = window.num(usd) * rate, bRate = Math.max(0.1, Math.min(1, window.num(c.buyout) / 100));
      const realLog = (window.num(c.logTo) + (1 - bRate) * window.num(c.logBack)) / bRate;
      const varPct = (window.num(c.commPct) + window.num(c.acqPct) + window.num(c.taxPct) + window.num(c.drrPct)) / 100;
      const fixRub = costRub + realLog + window.num(c.pack), profit = window.num(c.price) * (1 - varPct) - fixRub;
      const marginPct = window.num(c.price) > 0 ? (profit / window.num(c.price)) * 100 : 0;
      const breakEven = fixRub / Math.max(0.05, 1 - varPct), recPrice = fixRub / Math.max(0.05, 1 - varPct - Math.min(0.7, window.num(c.targetMargin) / 100));
      sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🧮 Калькулятор Юнит-экономики SKOS</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${nav}</div>
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
    const tRet = tot.qS > 0 ? (tot.qR / tot.qS) * 100 : 0, tAvg = tot.qN > 0 ? tot.rN / tot.qN : 0, tRent = tot.rN > 0 ? (tot.m / tot.rN) * 100 : 0;

    const trs = rows.map(r => `<tr>
      <td>${window.esc(r.org)}</td><td>${window.esc(r.per)}</td><td class="bold">${window.esc(r.title)}</td>
      <td class="num">${r.qS}</td><td class="num text-red">${r.qR}</td><td class="num bold">${r.netQty}</td><td class="num">${r.retPct.toFixed(1)}%</td>
      <td class="num bold">${window.fmtR(r.netRev)}</td><td class="num">${window.fmtR(r.avgCheck)}</td>
      <td class="num">${window.fmtR(r.cNet)} (${r.costPct.toFixed(0)}%)</td><td class="num">${window.fmtR(r.costUnit)}</td>
      <td class="num">${window.fmtR(r.log)} (${r.logPct.toFixed(0)}%)</td><td class="num">${window.fmtR(r.logUnit)}</td>
      <td class="num">${window.fmtR(r.comm)} (${r.commPct.toFixed(0)}%)</td>
      <td class="num bold ${r.margin >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(r.margin)}</td>
      <td class="num"><span class="badge ${r.rentPct >= 25 ? 'badge-green' : (r.rentPct >= 10 ? 'badge-amber' : 'badge-red')}">${r.rentPct.toFixed(1)}%</span></td>
    </tr>`).join('');

    sec.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🧮 Юнит-экономика SKOS (${st.sub}) — По папкам-моделям</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${nav}</div>
      <div class="form-grid" style="margin-bottom:10px">
        <div><label>Юрлицо / Аккаунт</label><select class="select" onchange="unitState.org=this.value;renderUnitTab()"><option value="ALL">Все (5 ИП + ООО)</option>${orgNames.map(n => `<option value="${window.esc(n)}"${n === st.org ? ' selected' : ''}>${window.esc(n)}</option>`).join('')}</select></div>
        <div><label>Год (2020–2050)</label><select class="select" onchange="unitState.yr=this.value;renderUnitTab()">${yrOpts}</select></div>
        <div><label>Месяц</label><select class="select" onchange="unitState.mo=this.value;renderUnitTab()">${moOpts}</select></div>
        <div style="grid-column:span 2"><label>Папка-модель (${models.length} шт.)</label><select class="select" onchange="unitState.model=this.value;renderUnitTab()"><option value="ALL">— Все папки-модели —</option>${models.map(m => `<option value="${window.esc(m)}"${m === st.model ? ' selected' : ''}>${window.esc(m)}</option>`).join('')}</select></div>
      </div>
      <div style="overflow-x:auto"><table style="font-size:11.5px;white-space:nowrap">
        <thead>
          <tr><th>Аккаунт</th><th>Период</th><th>Папка-модель</th><th class="num">Прод</th><th class="num">Возвр</th><th class="num">Чист</th><th class="num">%возв</th><th class="num">Выручка ₽</th><th class="num">Ср.чек</th><th class="num">Себест ₽</th><th class="num">Себ/ед</th><th class="num">Логист ₽</th><th class="num">Лог/ед</th><th class="num">Комис+Экв</th><th class="num">Маржа ₽</th><th class="num">Рентаб</th></tr>
          <tr style="background:#f1f5f9;font-weight:800"><td colspan="3">ИТОГО (${rows.length} строк)</td><td class="num">${tot.qS}</td><td class="num text-red">${tot.qR}</td><td class="num">${tot.qN}</td><td class="num">${tRet.toFixed(1)}%</td><td class="num">${window.fmtR(tot.rN)}</td><td class="num">${window.fmtR(tAvg)}</td><td class="num">${window.fmtR(tot.cN)}</td><td class="num">${tot.qN > 0 ? window.fmtR(tot.cN / tot.qN) : '0 ₽'}</td><td class="num">${window.fmtR(tot.l)}</td><td class="num">${tot.qN > 0 ? window.fmtR(tot.l / tot.qN) : '0 ₽'}</td><td class="num">${window.fmtR(tot.cm)}</td><td class="num ${tot.m >= 0 ? 'text-green' : 'text-red'}">${window.fmtR(tot.m)}</td><td class="num">${tRent.toFixed(1)}%</td></tr>
        </thead>
        <tbody>${trs || '<tr><td colspan="16">Нет данных за выбранный период</td></tr>'}</tbody>
      </table></div></div>`;
  };

  setInterval(window.mountUnitNav, 800);
  window.mountUnitNav();
})();
