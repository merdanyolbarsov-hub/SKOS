(function () {
  if (window.__skosPatch5Master) return;
  window.__skosPatch5Master = true;
  const rawSet = Storage.prototype.setItem, rawGet = Storage.prototype.getItem;
  const norm = v => String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim();
  const num = v => { const n = parseFloat(String(v || '0').replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  function cleanSkus() {
    if (!window.db || !Array.isArray(db.skus)) return false;
    let ch = false; const seen = new Set();
    db.skus = db.skus.filter(s => {
      if (!s) return false;
      const bc = norm(s.bc || s.barcode);
      if (!bc || seen.has(bc)) return false;
      seen.add(bc); s.bc = bc;
      const v = num(s.usd !== undefined ? s.usd : s.costUsd);
      if (v < 0 || v > 5000) { s.usd = 0; s.isNew = true; ch = true; } else s.usd = v;
      return true;
    });
    if (ch && typeof recalcReportsCogs === 'function') recalcReportsCogs();
    return ch;
  }

  window.save = function () {
    if (!window.db) return;
    cleanSkus();
    try { rawSet.call(localStorage, 'skos_v3_prod', JSON.stringify(window.db)); } catch (e) {}
  };

  window.importJson = function (ev) {
    const f = ev && ev.target && ev.target.files && ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        window.db = Object.assign(window.db || {}, JSON.parse(e.target.result));
        cleanSkus(); rawSet.call(localStorage, 'skos_v3_prod', JSON.stringify(window.db));
        if (typeof onPerChange === 'function') onPerChange();
        if (typeof render === 'function') render();
        alert('✅ Бэкап загружен и сохранён!');
      } catch (err) { alert('Ошибка: ' + err.message); }
    };
    r.readAsText(f, 'UTF-8'); ev.target.value = '';
  };

  window.openEditFolderModal = function (enc) {
    const fKey = decodeURIComponent(enc);
    const items = (db.skus || []).filter(s => (norm(s.art) || 'Без артикула') === fKey);
    if (!items.length) return;
    let fNames = {}; try { fNames = JSON.parse(rawGet.call(localStorage, 'skos_v3_folder_names') || '{}'); } catch (e) {}
    const curTitle = fNames[fKey] || (items[0] && items[0].name) || fKey;
    const vp = items.map(x => num(x.usd)).filter(x => x > 0 && x <= 5000);
    const curUsd = vp.length ? vp[0] : 0;

    const old = document.getElementById('p5-fld-m'); if (old) old.remove();
    const m = document.createElement('div'); m.id = 'p5-fld-m'; m.className = 'modal-bg';
    m.innerHTML = `<div class="modal-box"><h3 style="font-size:16px;font-weight:800">✏️ Папка (${items.length} ШК)</h3>
      <div style="display:grid;gap:8px;margin-top:10px">
        <div><label style="font-size:11px;font-weight:700">Код</label><input id="p5-fa" class="input" value="${fKey}"></div>
        <div><label style="font-size:11px;font-weight:700">Название</label><input id="p5-fn" class="input" value="${curTitle}"></div>
        <div><label style="font-size:11px;font-weight:700">Себест. ($)</label><input id="p5-fu" class="input" value="${curUsd}"></div>
      </div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px">
        <button type="button" class="btn" onclick="this.closest('.modal-bg').remove()">Отмена</button>
        <button type="button" class="btn btn-primary" id="p5-fs">💾 Сохранить</button>
      </div></div>`;
    document.body.appendChild(m);
    document.getElementById('p5-fs').onclick = () => {
      const na = norm(document.getElementById('p5-fa').value) || fKey;
      const nn = norm(document.getElementById('p5-fn').value) || curTitle;
      const nu = num(document.getElementById('p5-fu').value);
      if (nu < 0 || nu > 5000) return alert('Цена должна быть от 0 до 5000 $');
      fNames[na] = nn; rawSet.call(localStorage, 'skos_v3_folder_names', JSON.stringify(fNames));
      items.forEach(s => { s.art = na; s.name = nn; s.usd = nu; s.isNew = nu === 0; });
      if (typeof recalcReportsCogs === 'function') recalcReportsCogs();
      m.remove(); window.save(); if (typeof render === 'function') render();
    };
  };

  window.getRate = per => {
    const p = per || (typeof curPer === 'function' ? curPer() : '');
    if (p && window.db && db.rates && num(db.rates[p]) > 0 && num(db.rates[p]) !== 96.5) return num(db.rates[p]);
    return num(rawGet.call(localStorage, 'skos_manual_default_rate')) || 80;
  };
  window.setRate = v => {
    const p = typeof curPer === 'function' ? curPer() : '2026-01', n = num(v);
    if (n > 0) { if (!db.rates) db.rates = {}; db.rates[p] = n; rawSet.call(localStorage, 'skos_manual_default_rate', String(n)); window.save(); if (typeof render === 'function') render(); }
  };
  const S_URL = 'https://supabase.co';
  const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdWR2bnp5cXJ4eGFsaWtjbWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NTEwNzYsImV4cCI6MjExMDMyNzA3Nn0.cgCy3KoqjKuJaI4gzG8_nIlv20JttvAg7UgwTVQ-qwE';
  const H_KEY = 'skos_cloud_chunk_hashes_v2';
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) + '_' + s.length; };

  window.p4ForceCloudSync = async function () {
    const url = ((db.cloud && db.cloud.url) || S_URL).trim().replace(/\/$/, '');
    const key = ((db.cloud && db.cloud.key) || S_KEY).trim();
    const pin = ((db.cloud && db.cloud.pin) || 'Skos#9482!Tm').trim();
    const btn = document.querySelector('.topbar button[onclick*="syncCloud"], .topbar button[onclick*="p4ForceCloudSync"]');
    const old = btn ? btn.textContent : '☁️ Облако';
    if (btn) { if (btn.dataset.b === '1') return; btn.dataset.b = '1'; btn.textContent = '⏳...'; }

    cleanSkus(); window.save();
    let oldH = {}; try { oldH = JSON.parse(rawGet.call(localStorage, H_KEY) || '{}'); } catch (e) {}
    const nextH = Object.assign({}, oldH);
    const skus = db.skus || [], sales = db.itemSales || [], sz = 4000;
    const sc = Math.max(1, Math.ceil(skus.length / sz)), salc = Math.ceil(sales.length / sz);
    const fin = Object.assign({}, db, { skus: [], itemSales: [], ddsHashes: {}, skusChunks: sc, salesChunks: salc });
    const tasks = [], done = [];

    const mh = hash(JSON.stringify(fin));
    if (oldH.main !== mh) tasks.push({ id: 'main', p: fin, k: 'main', v: mh, l: 'Финансы' });
    for (let c = 0; c < sc; c++) {
      const pt = skus.slice(c * sz, (c + 1) * sz).map(s => ({ n: s.name, a: s.art, b: s.bc, u: s.usd }));
      const ph = hash(JSON.stringify(pt));
      if (oldH['skus_' + c] !== ph) tasks.push({ id: 'skus_' + c, p: pt, k: 'skus_' + c, v: ph, l: 'Товары #' + (c + 1) });
    }
    for (let s = 0; s < salc; s++) {
      const sp = sales.slice(s * sz, (s + 1) * sz), sh = hash(JSON.stringify(sp));
      if (oldH['sales_' + s] !== sh) tasks.push({ id: 'sales_' + s, p: sp, k: 'sales_' + s, v: sh, l: 'Продажи #' + (s + 1) });
    }
    if (!tasks.length) { if (btn) { btn.dataset.b = '0'; btn.textContent = old; } return alert('✅ Новых изменений нет!'); }

    const hdrs = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates', 'x-skos-pin': pin };
    try {
      for (const t of tasks) {
        const r = await fetch(url + '/rest/v1/skos_cloud?on_conflict=id', { method: 'POST', headers: hdrs, body: JSON.stringify([{ id: t.id, payload: t.p, updated_at: new Date().toISOString() }]) });
        if (!r.ok) throw new Error(t.l + ' (' + r.status + ')');
        nextH[t.k] = t.v; done.push(t.l);
      }
      rawSet.call(localStorage, H_KEY, JSON.stringify(nextH));
      alert('✅ Сохранено:\n• ' + done.join('\n• '));
    } catch (e) { alert('❌ Ошибка: ' + e.message); }
    finally { if (btn) { btn.dataset.b = '0'; btn.textContent = old; } }
  };
  window.syncCloud = m => { if (m) return window.p4ForceCloudSync(); };

  async function pullCloudIfEmpty() {
    if (!window.db || (db.reports && db.reports.length) || (db.dds && db.dds.length) || (db.skus && db.skus.length > 10)) return;
    const url = ((db.cloud && db.cloud.url) || S_URL).trim().replace(/\/$/, '');
    const key = ((db.cloud && db.cloud.key) || S_KEY).trim();
    const hdrs = { apikey: key, Authorization: 'Bearer ' + key };
    try {
      const rm = await fetch(url + '/rest/v1/skos_cloud?id=eq.main&select=payload', { headers: hdrs });
      const rows = await rm.json(); if (!rows || !rows[0] || !rows[0].payload) return;
      const d = rows[0].payload, allS = [], allSal = [];
      for (let c = 0; c < Number(d.skusChunks || 0); c++) {
        const rs = await fetch(url + '/rest/v1/skos_cloud?id=eq.skus_' + c + '&select=payload', { headers: hdrs });
        const sr = await rs.json();
        if (sr && sr[0] && Array.isArray(sr[0].payload)) sr[0].payload.forEach((it, i) => allS.push({ id: 's_' + c + '_' + i, name: it.n || it.a, art: it.a, bc: it.b, usd: num(it.u) }));
      }
      for (let s = 0; s < Number(d.salesChunks || 0); s++) {
        const rsl = await fetch(url + '/rest/v1/skos_cloud?id=eq.sales_' + s + '&select=payload', { headers: hdrs });
        const slr = await rsl.json();
        if (slr && slr[0] && Array.isArray(slr[0].payload)) allSal.push(...slr[0].payload);
      }
      if (allS.length) d.skus = allS;
      if (allSal.length) d.itemSales = allSal;
      Object.assign(window.db, d); cleanSkus();
      rawSet.call(localStorage, 'skos_v3_prod', JSON.stringify(window.db));
      if (typeof onPerChange === 'function') onPerChange();
      if (typeof render === 'function') render();
    } catch (e) {}
  }
  window.renderEnhancedAbc = window.renderAbc = function () {
    const sec = document.getElementById('tab-abc');
    if (!sec || !window.db || db.tab !== 'abc') return;
    const byEx = new Map(), byArt = new Map();
    let fNames = {}; try { fNames = JSON.parse(rawGet.call(localStorage, 'skos_v3_folder_names') || '{}'); } catch (e) {}
    const kOf = v => norm(v).toLowerCase().replace(/[\s\-_]+/g, '');
    (db.skus || []).forEach(s => {
      if (!s) return;
      const b = kOf(s.bc), a = kOf(s.art);
      if (b && !byEx.has(b)) byEx.set(b, s);
      if (a && (!byArt.has(a) || num(s.usd) > 0)) byArt.set(a, s);
    });

    const fYr = document.getElementById('abc-f-yr')?.value || 'ALL', fMo = document.getElementById('abc-f-mo')?.value || 'ALL';
    const fMp = document.getElementById('abc-f-mp')?.value || 'ALL', mode = document.getElementById('abc-mode')?.value || 'MODEL';
    const grp = {}; let tS = 0, tR = 0, tRev = 0, tCog = 0, tFee = 0, tPr = 0;

    (db.itemSales || []).forEach(it => {
      if (fYr !== 'ALL' && String(it.yr) !== fYr) return;
      if (fMo !== 'ALL' && String(it.mo) !== fMo) return;
      if (fMp !== 'ALL' && String(it.mp) !== fMp) return;
      const b = kOf(it.bc), a = kOf(it.art);
      const f = byEx.get(b) || byArt.get(a);
      const art = f ? norm(f.art) : (norm(it.art) || 'Без папки');
      const tit = f ? (fNames[art] || f.name || art) : (it.name || art);
      const rate = getRate(it.yr + '-' + it.mo);
      const sq = num(it.sQty), rq = num(it.rQty), rev = num(it.rev), fee = num(it.fee);
      const cog = Math.max(0, (f ? num(f.usd) : 0) * rate * (sq - rq)), pr = rev - fee - cog;
      tS += sq; tR += rq; tRev += rev; tCog += cog; tFee += fee; tPr += pr;

      const gk = mode === 'SKU' ? (norm(it.bc) || art) : art;
      if (!grp[gk]) grp[gk] = { tit: mode === 'SKU' ? `${tit} (${it.bc})` : `${art} — ${tit}`, sub: 'Папка: ' + art, sq: 0, rq: 0, rev: 0, cog: 0, pr: 0 };
      const g = grp[gk]; g.sq += sq; g.rq += rq; g.rev += rev; g.cog += cog; g.pr += pr;
    });

    const arr = Object.values(grp).sort((a, b) => b.pr - a.pr);
    const posP = arr.reduce((a, x) => a + Math.max(0, x.pr), 0);
    let cP = 0;
    const sumBox = document.getElementById('skos-abc-summary');
    if (sumBox) sumBox.innerHTML = `<div style="font-size:12px;padding:6px">Выкуплено: <b>${tS} шт.</b> | Выручка: <b>${fmtR(tRev)}</b> | Себест.: <b>${fmtR(tCog)}</b> | Прибыль: <b style="color:${tPr >= 0 ? '#059669' : '#e11d48'}">${fmtR(tPr)}</b></div>`;

    const tbody = sec.querySelector('tbody');
    if (tbody) tbody.innerHTML = arr.length ? arr.map(x => {
      cP += Math.max(0, x.pr);
      const cls = (x.pr <= 0 || posP <= 0) ? 'C' : ((cP / posP) * 100 <= 80 ? 'A' : ((cP / posP) * 100 <= 95 ? 'B' : 'C'));
      const sh = posP > 0 ? ((Math.max(0, x.pr) / posP) * 100).toFixed(1) : '0.0';
      const nq = Math.max(1, x.sq - x.rq);
      return `<tr><td><span class="badge ${cls === 'A' ? 'badge-green' : (cls === 'B' ? 'badge-amber' : 'badge-red')}">${cls}</span></td><td class="bold">${x.tit}</td><td>${x.sub}</td><td class="num bold">${x.sq}</td><td class="num text-red">${x.rq}</td><td class="num">${fmtR(x.rev)}</td><td class="num">${fmtR(x.cog)}</td><td class="num bold ${x.pr >= 0 ? 'text-green' : 'text-red'}">${fmtR(x.pr)}</td><td class="num">${sh}%</td><td class="num">${x.sq > 0 ? fmtR(x.rev / nq) : '0 ₽'}</td><td class="num">${x.sq > 0 ? fmtR(x.pr / nq) : '0 ₽'}</td></tr>`;
    }).join('') : '<tr><td colspan="11" style="text-align:center;padding:16px">Нет данных</td></tr>';
  };

  const baseRender = window.render;
  window.render = function () {
    const act = (window.db && db.tab) || 'dash';
    const sA = window.renderAbc, sE = window.renderEnhancedAbc, sF = window.renderExpFolderStats;
    if (act !== 'abc') { window.renderAbc = () => {}; window.renderEnhancedAbc = () => {}; }
    if (act !== 'dash' && act !== 'exp') window.renderExpFolderStats = () => {};
    try { if (typeof baseRender === 'function') baseRender.apply(this, arguments); }
    finally { window.renderAbc = sA; window.renderEnhancedAbc = sE; window.renderExpFolderStats = sF; }
  };

  setTimeout(() => {
    if (cleanSkus()) window.save();
    const b = Array.from(document.querySelectorAll('.topbar button')).find(x => (x.textContent || '').includes('Облако'));
    if (b) b.onclick = () => window.p4ForceCloudSync();
    pullCloudIfEmpty();
    if (typeof render === 'function') render();
  }, 450);
})();
