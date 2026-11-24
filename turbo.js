/* === SKOS Finance 3.0 — turbo.js V4 (Мгновенное сохранение после импорта + быстрые фильтры + Цена/шт) === */
(function () {
  if (window.__SKOS_TURBO_V4__) return;
  window.__SKOS_TURBO_V4__ = true;

  // --- 1. Сверхбыстрый расчёт ЦЕНА/ШТ и ПРИБЫЛЬ/ШТ в таблице ABC ---
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

  // --- 2. Глушим частые фоновые таймеры старых патчей ---
  window.setInterval = function (fn, delay) {
    const safeDelay = (!delay || delay < 3000) ? 3000 : delay;
    return rawSetInterval.call(window, fn, safeDelay);
  };

  // --- 3. Умное сохранение: при импорте файлов пишем СРАЗУ, при кликах по фильтрам — с задержкой ---
  const origGetItem = Storage.prototype.getItem;
  const origSetItem = Storage.prototype.setItem;
  let cachedDbStr = null;
  let pendingSaveStr = null;
  let saveTimer = null;
  let forceImmediateSaveUntil = 0;

  // Если пользователь загружает CSV / Excel / JSON — разрешаем мгновенную запись на 10 секунд
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
      // При загрузке файла или нажатии кнопок сохранения пишем мгновенно!
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

  // --- 4. Склеиваем вызовы render() и сразу после них заполняем Цена/шт ---
  function wrapRender() {
    if (typeof window.render === 'function' && !window.render.__turboV4) {
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
      fastRender.__turboV4 = true;
      window.render = fastRender;
    }
  }

  wrapRender();
  setTimeout(wrapRender, 200);
  setTimeout(wrapRender, 1000);
  setTimeout(keepAbcUnitColsFilled, 100);
  setTimeout(keepAbcUnitColsFilled, 600);

  // --- 5. Ускорение отрисовки длинных таблиц ---
  const css = document.createElement('style');
  css.textContent = 'table tbody tr:nth-child(n+50) { content-visibility: auto; contain-intrinsic-size: 36px; }';
  document.head.appendChild(css);
})();
