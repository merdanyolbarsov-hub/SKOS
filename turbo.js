/* === SKOS Finance 3.0 — turbo.js V5 (Лечение ошибки patch4.js:730 + отключение тормозов сети при кликах) === */
(function () {
  if (window.__SKOS_TURBO_V5__) return;
  window.__SKOS_TURBO_V5__ = true;

  // --- 1. Гарантируем, что объект базы существует (лечит падение patch4.js:730 reading 'skus') ---
  function ensureDbStructure() {
    if (!window.db || typeof window.db !== 'object') {
      try {
        const raw = localStorage.getItem('skos_v3_prod');
        window.db = raw ? JSON.parse(raw) : {};
      } catch (e) {
        window.db = {};
      }
    }
    if (!Array.isArray(window.db.skus)) window.db.skus = [];
    if (!Array.isArray(window.db.reports)) window.db.reports = [];
  }
  ensureDbStructure();

  // --- 2. Защищаем syncCloud и p4ForceCloudSync от падений и лишних сетевых запросов ---
  let allowCloudNow = false;
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button, a, div');
    if (btn && /облако|sync|сохран/i.test(btn.textContent || '')) {
      allowCloudNow = true;
      setTimeout(function () { allowCloudNow = false; }, 15000);
    }
  }, true);

  function patchCloudFunctions() {
    if (typeof window.p4ForceCloudSync === 'function' && !window.p4ForceCloudSync.__safeWrapped) {
      const origForce = window.p4ForceCloudSync;
      const safeForce = async function () {
        ensureDbStructure();
        try {
          return await origForce.apply(this, arguments);
        } catch (err) {
          console.warn('[SKOS Turbo] Ошибка облака перехвачена безопасно:', err.message);
          return null;
        }
      };
      safeForce.__safeWrapped = true;
      window.p4ForceCloudSync = safeForce;
    }

    if (typeof window.syncCloud === 'function' && !window.syncCloud.__safeWrapped) {
      const origSync = window.syncCloud;
      const safeSync = async function () {
        ensureDbStructure();
        // Если интернет слабый — не дёргаем облако при обычном переключении вкладок/фильтров
        if (!allowCloudNow && arguments.length === 0) {
          return null;
        }
        try {
          return await origSync.apply(this, arguments);
        } catch (err) {
          console.warn('[SKOS Turbo] syncCloud перехвачен:', err.message);
          return null;
        }
      };
      safeSync.__safeWrapped = true;
      window.syncCloud = safeSync;
    }
  }

  patchCloudFunctions();
  setTimeout(patchCloudFunctions, 100);
  setTimeout(patchCloudFunctions, 500);
  setTimeout(patchCloudFunctions, 1500);

  // --- 3. Сверхбыстрый расчёт ЦЕНА/ШТ и ПРИБЫЛЬ/ШТ в таблице ABC ---
  function parseNum(str) {
    const noParens = String(str || '').replace(/\([^)]*\)/g, '');
    const clean = noParens.replace(/[^\d.,-]/g, '').replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }
  function fmtRub(n) {
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function keepAbcUnitColsFilled() {
    const rows = document.querySelectorAll('table tbody tr, [class*="row"]');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cols = row.children;
      if (!cols || cols.length < 9) continue;

      let idxShare = -1;
      for (let c = 5; c < cols.length - 2; c++) {
        const t = cols[c].textContent.trim();
        if (/^-?\d+\.\d+%$/.test(t)) {
          idxShare = c;
          break;
        }
      }
      if (idxShare === -1) continue;

      const cellPrice = cols[idxShare + 1];
      const cellProfit = cols[idxShare + 2];
      if (!cellPrice || !cellProfit) continue;

      if (cellPrice.textContent.includes('₽') && cellProfit.textContent.includes('₽')) continue;

      let qty = 0, rev = 0, prof = 0;
      for (let c = 0; c < idxShare; c++) {
        const t = cols[c].textContent.trim();
        if (t.includes('%') && /\d+/.test(t) && qty === 0) {
          qty = parseNum(t);
        } else if (t.includes('₽')) {
          if (rev === 0) rev = parseNum(t);
          else prof = parseNum(t);
        }
      }

      if (qty > 0) {
        cellPrice.textContent = fmtRub(rev / qty);
        cellPrice.style.whiteSpace = 'nowrap';
        cellProfit.textContent = fmtRub(prof / qty);
        cellProfit.style.whiteSpace = 'nowrap';
        cellProfit.style.color = prof >= 0 ? '#16a34a' : '#dc2626';
        cellProfit.style.fontWeight = '600';
      } else {
        cellPrice.textContent = '0 ₽';
        cellProfit.textContent = '0 ₽';
      }
    }
  }

  const rawSetInterval = window.setInterval;
  rawSetInterval.call(window, keepAbcUnitColsFilled, 300);

  // --- 4. Замедление лишних старых таймеров ---
  window.setInterval = function (fn, delay) {
    const safeDelay = (!delay || delay < 3000) ? 3000 : delay;
    return rawSetInterval.call(window, fn, safeDelay);
  };

  // --- 5. Кэш localStorage + мгновенное сохранение при импорте файлов ---
  const origGetItem = Storage.prototype.getItem;
  const origSetItem = Storage.prototype.setItem;
  let cachedDbStr = null;
  let pendingSaveStr = null;
  let saveTimer = null;
  let forceImmediateSaveUntil = 0;

  document.addEventListener('change', function (e) {
    if (e.target && e.target.type === 'file') {
      forceImmediateSaveUntil = Date.now() + 10000;
      cachedDbStr = null;
    }
  }, true);

  Storage.prototype.getItem = function (key) {
    if (key === 'skos_v3_prod' && cachedDbStr !== null) {
      return cachedDbStr;
    }
    const res = origGetItem.apply(this, arguments);
    if (key === 'skos_v3_prod') cachedDbStr = res;
    return res;
  };

  function flushSave() {
    if (pendingSaveStr !== null) {
      const val = pendingSaveStr;
      pendingSaveStr = null;
      try { origSetItem.call(localStorage, 'skos_v3_prod', val); } catch (e) {}
    }
  }

  Storage.prototype.setItem = function (key, val) {
    if (key === 'skos_v3_prod' && typeof val === 'string') {
      cachedDbStr = val;
      if (Date.now() < forceImmediateSaveUntil) {
        clearTimeout(saveTimer);
        pendingSaveStr = null;
        try { origSetItem.call(localStorage, 'skos_v3_prod', val); } catch (e) {}
        return;
      }
      pendingSaveStr = val;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 1500);
      return;
    }
    return origSetItem.apply(this, arguments);
  };

  window.addEventListener('beforeunload', flushSave);
  document.addEventListener('pagehide', flushSave);

  // --- 6. Оптимизация render() и длинных таблиц ---
  function wrapRender() {
    if (typeof window.render === 'function' && !window.render.__turboV5) {
      const origRender = window.render;
      let queued = false;
      const fastRender = function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          origRender.apply(window, arguments);
          keepAbcUnitColsFilled();
        });
      };
      fastRender.__turboV5 = true;
      window.render = fastRender;
    }
  }

  wrapRender();
  setTimeout(wrapRender, 200);
  setTimeout(wrapRender, 1000);

  const css = document.createElement('style');
  css.textContent = 'table tbody tr:nth-child(n+50) { content-visibility: auto; contain-intrinsic-size: 36px; }';
  document.head.appendChild(css);
})();
