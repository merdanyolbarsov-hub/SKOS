/* === SKOS Finance 3.0 — turbo.js (Надёжный ускоритель вкладок, фильтров и памяти) === */
(function () {
  if (window.__SKOS_TURBO_V1__) return;
  window.__SKOS_TURBO_V1__ = true;

  // 1. Защита от частого опроса DOM старыми таймерами (минимум 1500 мс)
  const origSetInterval = window.setInterval;
  window.setInterval = function (fn, delay) {
    return origSetInterval.call(window, fn, (!delay || delay < 1500) ? 1500 : delay);
  };

  // 2. Умная отложенная запись в localStorage (не тормозит интерфейс во время кликов)
  const origSetItem = Storage.prototype.setItem;
  let pendingValue = null;
  let saveTimer = null;

  function flushSave() {
    if (pendingValue !== null) {
      const val = pendingValue;
      pendingValue = null;
      try {
        origSetItem.call(localStorage, 'skos_v3_prod', val);
      } catch (e) {}
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

  // 3. Склеиваем множественные вызовы render() в один кадр (убирает двойные/тройные зависания)
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
        });
      };
      fastRender.__turboWrapped = true;
      window.render = fastRender;
    }
  }

  wrapRender();
  setTimeout(wrapRender, 300);
  setTimeout(wrapRender, 1500);

  // 4. Аппаратное ускорение отрисовки длинных таблиц и списков (не рендерит невидимые строки)
  const css = document.createElement('style');
  css.textContent = `
    table tbody tr:nth-child(n+60) {
      content-visibility: auto;
      contain-intrinsic-size: 36px;
    }
  `;
  document.head.appendChild(css);
})();
