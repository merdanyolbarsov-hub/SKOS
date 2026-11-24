/* === SKOS Finance 3.0 — turbo.js (Ускоритель + мгновенный расчёт Цена/шт и Прибыль/шт в ABC) === */
(function () {
  if (window.__SKOS_TURBO_V2__) return;
  window.__SKOS_TURBO_V2__ = true;

  // --- 1. Мгновенный расчёт ЦЕНА/ШТ и ПРИБЫЛЬ/ШТ в таблице ABC ---
  function parseNum(str) {
    const noParens = String(str || '').replace(/\([^)]*\)/g, '');
    const clean = noParens.replace(/[^\d.,-]/g, '').replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }
  function fmtRub(n) {
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function fillAbcUnitCols() {
    const cells = document.querySelectorAll('td, div');
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.children.length > 0) continue;
      const txt = cell.textContent.trim();
      // Находим колонку ДОЛЯ ПРИБ. (например "59.7%", "40.3%", "0.0%")
      if (!/^-?\d+\.\d+%$/.test(txt)) continue;

      const row = cell.parentElement;
      if (!row || row.children.length < 9) continue;

      const cols = Array.from(row.children);
      const idxShare = cols.indexOf(cell);
      const cellPrice = cols[idxShare + 1];
      const cellProfit = cols[idxShare + 2];
      if (!cellPrice || !cellProfit) continue;

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
        const pTxt = fmtRub(rev / qty);
        const prTxt = fmtRub(prof / qty);
        if (cellPrice.textContent !== pTxt) {
          cellPrice.textContent = pTxt;
          cellPrice.style.whiteSpace = 'nowrap';
        }
        if (cellProfit.textContent !== prTxt) {
          cellProfit.textContent = prTxt;
          cellProfit.style.whiteSpace = 'nowrap';
          cellProfit.style.color = prof >= 0 ? '#16a34a' : '#dc2626';
          cellProfit.style.fontWeight = '600';
        }
      } else {
        if (cellPrice.textContent !== '0 ₽') cellPrice.textContent = '0 ₽';
        if (cellProfit.textContent !== '0 ₽') cellProfit.textContent = '0 ₽';
      }
    }
  }

  // --- 2. Защита от частых старых setInterval ---
  const origSetInterval = window.setInterval;
  window.setInterval = function (fn, delay) {
    return origSetInterval.call(window, fn, (!delay || delay < 1500) ? 1500 : delay);
  };

  // --- 3. Отложенная запись в localStorage (без тормозов при кликах) ---
  const origSetItem = Storage.prototype.setItem;
  let pendingValue = null;
  let saveTimer = null;

  function flushSave() {
    if (pendingValue !== null) {
      const val = pendingValue;
      pendingValue = null;
      try { origSetItem.call(localStorage, 'skos_v3_prod', val); } catch (e) {}
    }
  }

  Storage.prototype.setItem = function (key, val) {
    if (key === 'skos_v3_prod' && typeof val === 'string' && val.length > 30000) {
      pendingValue = val;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 2500);
      return;
    }
    return origSetItem.apply(this, arguments);
  };

  window.addEventListener('beforeunload', flushSave);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flushSave();
  });

  // --- 4. Склеиваем вызовы render() + сразу после каждого render заполняем Цена/шт ---
  function wrapRender() {
    if (typeof window.render === 'function' && !window.render.__turboWrapped) {
      const origRender = window.render;
      let queued = false;
      const fastRender = function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          origRender.apply(window, arguments);
          fillAbcUnitCols();
        });
      };
      fastRender.__turboWrapped = true;
      window.render = fastRender;
    }
  }

  wrapRender();
  setTimeout(wrapRender, 300);
  setTimeout(wrapRender, 1500);

  // Следим за появлением таблицы ABC при первой загрузке/обновлении страницы
  const obs = new MutationObserver(function () {
    fillAbcUnitCols();
  });
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      obs.observe(document.body, { childList: true, subtree: true });
      fillAbcUnitCols();
    });
  }

  // --- 5. Аппаратное ускорение длинных таблиц ---
  const css = document.createElement('style');
  css.textContent = 'table tbody tr:nth-child(n+60) { content-visibility: auto; contain-intrinsic-size: 36px; }';
  document.head.appendChild(css);
})();
