/* === SKOS Finance 3.0 — patch6.js (Точный адрес Supabase + Быстрые вкладки + Надёжное Облако) === */
(function () {
  if (window.__skosPatch6Loaded) return;
  window.__skosPatch6Loaded = true;

  const REAL_URL = 'https://supabase.co';
  const REAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdWR2bnp5cXJ4eGFsaWtjbWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NTEwNzYsImV4cCI6MjExMDMyNzA3Nn0.cgCy3KoqjKuJaI4gzG8_nIlv20JttvAg7UgwTVQ-qwE';
  const REAL_PIN = 'Skos#9482!Tm';
  const KEY_PROD = 'skos_v3_prod';

  // 1. Записываем правильный URL в память браузера и объект базы
  ['skos_sb_url', 'skos_supa_url', 'supabase_url', 'sb_url'].forEach(k => localStorage.setItem(k, REAL_URL));
  ['skos_sb_key', 'skos_supa_key', 'supabase_key', 'sb_key'].forEach(k => localStorage.setItem(k, REAL_KEY));

  function ensureCloudCfg() {
    if (!window.db) window.db = {};
    if (!window.db.cloud) window.db.cloud = {};
    window.db.cloud.url = REAL_URL;
    window.db.cloud.key = REAL_KEY;
    if (!window.db.cloud.pin || window.db.cloud.pin === '2026') {
      window.db.cloud.pin = REAL_PIN;
    }
    const uEl = document.getElementById('sb-url');
    const kEl = document.getElementById('sb-key');
    if (uEl) uEl.value = REAL_URL;
    if (kEl && !kEl.value) kEl.value = REAL_KEY;
  }
  ensureCloudCfg();

  // 2. Останавливаем лишние фоновые интервалы, которые тормозят переключение вкладок
  for (let i = 1; i < 2000; i++) {
    try { clearInterval(i); } catch (e) {}
  }

  // 3. Ускоряем render(): перерисовываем только активную вкладку
  const rawRender = window.render;
  let rafLock = false;
  window.render = function () {
    if (rafLock) return;
    rafLock = true;
    requestAnimationFrame(function () {
      rafLock = false;
      const tab = (window.db && window.db.tab) || 'dash';
      const oldAbc = window.renderEnhancedAbc;
      if (tab !== 'abc') window.renderEnhancedAbc = function () {};
      try {
        if (typeof rawRender === 'function') rawRender.apply(window, arguments);
      } finally {
        window.renderEnhancedAbc = oldAbc;
      }
    });
  };

  // 4. Надёжная выгрузка в Supabase (пачками по 4000 строк, чтобы не было таймаутов)
  window.p6PushCloud = async function () {
    ensureCloudCfg();
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Облако'));
    const oldTxt = btn ? btn.textContent : '☁️ Облако';
    if (btn) {
      if (btn.dataset.busy === '1') return;
      btn.dataset.busy = '1';
      btn.textContent = '⏳ Сохраняю...';
    }

    try {
      if (typeof window.save === 'function') window.save();
      const skus = Array.isArray(window.db.skus) ? window.db.skus : [];
      const sales = Array.isArray(window.db.itemSales) ? window.db.itemSales : [];
      const sz = 4000;
      const sc = Math.max(1, Math.ceil(skus.length / sz));
      const salc = Math.ceil(sales.length / sz);

      const mainPayload = Object.assign({}, window.db, {
        skus: [],
        itemSales: [],
        skusChunks: sc,
        salesChunks: salc
      });

      const hdrs = {
        apikey: REAL_KEY,
        Authorization: 'Bearer ' + REAL_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
        'x-skos-pin': window.db.cloud.pin
      };

      const sendChunk = async (id, payload) => {
        const r = await fetch(REAL_URL + '/rest/v1/skos_cloud?on_conflict=id', {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify([{ id: id, payload: payload, updated_at: new Date().toISOString() }])
        });
        if (!r.ok) throw new Error('Ошибка записи ' + id + ' (код ' + r.status + ')');
      };

      await sendChunk('main', mainPayload);
      for (let c = 0; c < sc; c++) {
        const part = skus.slice(c * sz, (c + 1) * sz).map(s => ({
          n: s.name, a: s.art, c: s.col, z: s.siz, b: s.bc, u: s.usd
        }));
        await sendChunk('skus_' + c, part);
      }
      for (let s = 0; s < salc; s++) {
        await sendChunk('sales_' + s, sales.slice(s * sz, (s + 1) * sz));
      }

      alert('✅ Всё успешно сохранено в облако Supabase!\nТоваров (ШК): ' + skus.length + ' шт.\nОтчётов: ' + (window.db.reports || []).length);
    } catch (e) {
      alert('❌ Не удалось сохранить в облако: ' + e.message);
    } finally {
      if (btn) {
        btn.dataset.busy = '0';
        btn.textContent = oldTxt;
      }
    }
  };

  // 5. Надёжная загрузка из Supabase при обновлении/открытии страницы
  window.p6PullCloud = async function (silent) {
    ensureCloudCfg();
    const hdrs = {
      apikey: REAL_KEY,
      Authorization: 'Bearer ' + REAL_KEY,
      'x-skos-pin': window.db.cloud.pin
    };

    try {
      const rMain = await fetch(REAL_URL + '/rest/v1/skos_cloud?id=eq.main&select=payload', { headers: hdrs });
      if (!rMain.ok) return;
      const rows = await rMain.json();
      if (!Array.isArray(rows) || !rows.length || !rows[0].payload) return;

      const data = rows[0].payload;
      const sc = Number(data.skusChunks || 0);
      if (sc > 0 && (!Array.isArray(data.skus) || !data.skus.length)) {
        const allSkus = [];
        for (let c = 0; c < sc; c++) {
          const rSku = await fetch(REAL_URL + '/rest/v1/skos_cloud?id=eq.skus_' + c + '&select=payload', { headers: hdrs });
          if (rSku.ok) {
            const sRows = await rSku.json();
            if (Array.isArray(sRows) && sRows[0] && Array.isArray(sRows[0].payload)) {
              sRows[0].payload.forEach((it, idx) => {
                allSkus.push({
                  id: 's_' + c + '_' + idx,
                  name: it.n || it.name || it.a || 'Товар',
                  art: it.a || it.art || '',
                  col: it.c || it.col || '—',
                  siz: it.z || it.s || it.siz || '—',
                  bc: it.b || it.bc || it.barcode || '',
                  usd: Number(it.u !== undefined ? it.u : (it.usd || 0))
                });
              });
            }
          }
        }
        if (allSkus.length) data.skus = allSkus;
      }

      const salc = Number(data.salesChunks || 0);
      if (salc > 0 && (!Array.isArray(data.itemSales) || !data.itemSales.length)) {
        const allSales = [];
        for (let s = 0; s < salc; s++) {
          const rSal = await fetch(REAL_URL + '/rest/v1/skos_cloud?id=eq.sales_' + s + '&select=payload', { headers: hdrs });
          if (rSal.ok) {
            const slRows = await rSal.json();
            if (Array.isArray(slRows) && slRows[0] && Array.isArray(slRows[0].payload)) {
              allSales.push(...slRows[0].payload);
            }
          }
        }
        if (allSales.length) data.itemSales = allSales;
      }

      Object.assign(window.db, data);
      ensureCloudCfg();
      localStorage.setItem(KEY_PROD, JSON.stringify(window.db));
      if (typeof window.onPerChange === 'function') window.onPerChange();
      if (typeof window.render === 'function') window.render();
      if (!silent) alert('✅ Данные восстановлены из облака!');
    } catch (e) {
      if (!silent) alert('Ошибка чтения из облака: ' + e.message);
    }
  };

  window.syncCloud = function (manual) {
    return manual ? window.p6PushCloud() : window.p6PullCloud(true);
  };
  window.p4ForceCloudSync = window.p6PushCloud;

  // Привязываем верхнюю кнопку «☁️ Облако» и подгружаем базу при открытии
  setTimeout(function () {
    const topCloud = Array.from(document.querySelectorAll('.topbar button')).find(b => (b.textContent || '').includes('Облако'));
    if (topCloud) topCloud.onclick = window.p6PushCloud;

    const isEmpty = !window.db || (
      !(window.db.reports && window.db.reports.length) &&
      !(window.db.dds && window.db.dds.length) &&
      !(window.db.skus && window.db.skus.length > 10)
    );
    if (isEmpty) window.p6PullCloud(true);
  }, 500);
})();
