/* === SKOS Finance 3.0 — patch6.js (Ускорение без фризов + Надёжное сохранение/загрузка Облака) === */
(function () {
  if (window.__skosPatch6Loaded) return;
  window.__skosPatch6Loaded = true;

  const SUPA_URL = 'https://supabase.co'; // <-- Проверьте ваш точный Project URL из Настроек!
  const KEY_PROD = 'skos_v3_prod';

  // 1. Останавливаем паразитные фоновые таймеры (setInterval), которые вешают вкладку
  for (let i = 1; i < 2000; i++) {
    try { clearInterval(i); } catch (e) {}
  }

  // 2. Ускоряем переключение вкладок и фильтров (убираем перерисовку скрытых таблиц)
  const rawRender = window.render;
  let renderQueued = false;
  window.render = function () {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      const activeTab = (window.db && window.db.tab) || 'dash';
      // Временно отключаем рендер ABC, если открыта другая вкладка
      const savedAbc = window.renderEnhancedAbc;
      if (activeTab !== 'abc') window.renderEnhancedAbc = function () {};
      try {
        if (typeof rawRender === 'function') rawRender.apply(window, arguments);
      } finally {
        window.renderEnhancedAbc = savedAbc;
      }
    });
  };

  // 3. Надёжная функция загрузки из облака при открытии сайта (исправлены rows[0] и skus_0)
  async function reliablePullCloud() {
    if (!window.db) window.db = {};
    const url = ((window.db.cloud && window.db.cloud.url) || localStorage.getItem('skos_sb_url') || SUPA_URL).trim().replace(/\/$/, '');
    const key = ((window.db.cloud && window.db.cloud.key) || localStorage.getItem('skos_sb_key') || '').trim();
    const pin = ((window.db.cloud && window.db.cloud.pin) || localStorage.getItem('skos_supa_pin') || 'Skos#9482!Tm').trim();
    if (!url || !key) return;

    const hdrs = {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'x-skos-pin': pin
    };

    try {
      const res = await fetch(url + '/rest/v1/skos_cloud?id=eq.main&select=payload', { headers: hdrs });
      if (!res.ok) return;
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length || !rows[0].payload) return;

      const cloudDb = rows[0].payload;
      const sc = Number(cloudDb.skusChunks || 0);
      if (sc > 0 && (!Array.isArray(cloudDb.skus) || cloudDb.skus.length === 0)) {
        const loadedSkus = [];
        for (let c = 0; c < sc; c++) {
          const rSku = await fetch(url + '/rest/v1/skos_cloud?id=eq.skus_' + c + '&select=payload', { headers: hdrs });
          if (rSku.ok) {
            const sRows = await rSku.json();
            if (Array.isArray(sRows) && sRows[0] && Array.isArray(sRows[0].payload)) {
              sRows[0].payload.forEach(function (it, idx) {
                loadedSkus.push({
                  id: 's_' + c + '_' + idx,
                  name: it.n || it.name || it.a || 'Товар',
                  art: it.a || it.art || '',
                  col: it.c || it.col || '—',
                  siz: it.z || it.s || it.siz || '—',
                  bc: it.b || it.bc || it.barcode || '',
                  usd: Number(it.u !== undefined ? it.u : (it.usd || it.costUsd || 0))
                });
              });
            }
          }
        }
        if (loadedSkus.length) cloudDb.skus = loadedSkus;
      }

      const salc = Number(cloudDb.salesChunks || 0);
      if (salc > 0 && (!Array.isArray(cloudDb.itemSales) || cloudDb.itemSales.length === 0)) {
        const loadedSales = [];
        for (let s = 0; s < salc; s++) {
          const rSal = await fetch(url + '/rest/v1/skos_cloud?id=eq.sales_' + s + '&select=payload', { headers: hdrs });
          if (rSal.ok) {
            const slRows = await rSal.json();
            if (Array.isArray(slRows) && slRows[0] && Array.isArray(slRows[0].payload)) {
              loadedSales.push(...slRows[0].payload);
            }
          }
        }
        if (loadedSales.length) cloudDb.itemSales = loadedSales;
      }

      // Применяем загруженные данные, сохраняя настройки подключения
      Object.assign(window.db, cloudDb);
      window.db.cloud = { url: url, key: key, pin: pin };
      localStorage.setItem(KEY_PROD, JSON.stringify(window.db));
      if (typeof window.onPerChange === 'function') window.onPerChange();
      if (typeof window.render === 'function') window.render();
    } catch (err) {
      console.error('[SKOS Patch6] Ошибка загрузки из облака:', err);
    }
  }

  // 4. Запускаем загрузку из облака при старте, если локально база пустая
  setTimeout(function () {
    const hasLocalData = window.db && (
      (Array.isArray(window.db.reports) && window.db.reports.length > 0) ||
      (Array.isArray(window.db.dds) && window.db.dds.length > 0) ||
      (Array.isArray(window.db.skus) && window.db.skus.length > 10)
    );
    if (!hasLocalData) {
      reliablePullCloud();
    }
  }, 600);
})();
