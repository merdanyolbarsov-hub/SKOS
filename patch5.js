(function () {
  // 1. СЖАТИЕ И ЗАЩИТА БАЗЫ ОТ ПЕРЕПОЛНЕНИЯ LOCALSTORAGE (QuotaExceededError)
  function compactDb() {
    if (!window.db) return;

    // Убираем дубликаты ШК и лишние дефолтные поля, которые раздувают файл до >5 МБ
    if (Array.isArray(db.skus)) {
      const seen = new Set();
      db.skus = db.skus.filter(s => {
        if (!s || !s.bc) return false;
        if (seen.has(s.bc)) return false;
        seen.add(s.bc);
        return true;
      });
      db.skus.forEach(s => {
        const val = parseFloat(String(s.usd || 0).replace(/\s+/g, '').replace(',', '.'));
        s.usd = (isNaN(val) || val < 0 || val > 1000) ? 0 : val;
        if (s.col === '—' || s.col === '') delete s.col;
        if (s.siz === '—' || s.siz === '') delete s.siz;
        if (s.src === 'Импорт Свода' || s.src === 'База SKOS') delete s.src;
        if (!s.isNew) delete s.isNew;
      });
    }

    // Очищаем лишние пустые массивы/хэши
    if (db.ddsHashes && Object.keys(db.ddsHashes).length > 2000) {
      db.ddsHashes = {};
    }
  }

  // Надёжное сохранение в localStorage с авто-сжатием при нехватке места
  window.save = function () {
    compactDb();
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      // Если места всё равно мало — сжимаем историю построчных продаж, оставляя все сводные отчёты
      if (Array.isArray(db.itemSales) && db.itemSales.length > 3000) {
        db.itemSales = db.itemSales.slice(0, 3000);
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(db));
      } catch (e2) {
        alert('Внимание: память браузера переполнена! Скачайте Бэкап и удалите лишние дубли ШК.');
      }
    }
  };

  // При старте страницы сразу чистим битые цены (вроде 1 221 526 198 $) и сохраняем компактно
  setTimeout(function () {
    if (window.db && Array.isArray(db.skus) && db.skus.length > 0) {
      compactDb();
      if (typeof recalcReportsCogs === 'function') recalcReportsCogs();
      window.save();
      if (typeof render === 'function') render();
    }
  }, 400);

  // 2. КУРС ВАЛЮТ: держит твой курс по месяцам, не сбрасывает на 96.5
  function getSavedDefaultRate() {
    const manual = parseFloat(localStorage.getItem('skos_manual_default_rate'));
    if (manual > 0) return manual;
    if (window.db && db.rates) {
      const vals = Object.values(db.rates).filter(v => Number(v) > 0 && Number(v) !== 96.5);
      if (vals.length) return Number(vals[vals.length - 1]);
    }
    return 80;
  }

  window.getRate = function (per) {
    const p = per || (typeof curPer === 'function' ? curPer() : '');
    if (p && window.db && db.rates && db.rates[p] && db.rates[p] !== 96.5) return db.rates[p];
    return getSavedDefaultRate();
  };

  window.setRate = function (v) {
    const p = typeof curPer === 'function' ? curPer() : '2026-01';
    if (db.locked && db.locked[p]) return alert('Месяц закрыт!');
    const n = parseFloat(String(v).replace(',', '.'));
    if (n > 0) {
      if (!db.rates) db.rates = {};
      db.rates[p] = n;
      localStorage.setItem('skos_manual_default_rate', String(n));
      window.save();
      if (typeof render === 'function') render();
    }
  };

  // 3. ЗАЩИТА ОТ ВВОДА НЕВЕРНЫХ ЦЕН В ТОВАРАХ И ПАПКАХ
  const origUpdateSkuUsd = window.updateSkuUsd;
  window.updateSkuUsd = function (id, val) {
    const clean = parseFloat(String(val || 0).replace(/\s+/g, '').replace(',', '.'));
    if (isNaN(clean) || clean < 0 || clean > 1000) return alert('Некорректная цена: ' + val);
    if (typeof origUpdateSkuUsd === 'function') origUpdateSkuUsd(id, clean);
  };

  const origApplyModelUsd = window.applyModelUsd;
  window.applyModelUsd = function (art, usd) {
    const clean = parseFloat(String(usd || 0).replace(/\s+/g, '').replace(',', '.'));
    if (isNaN(clean) || clean < 0 || clean > 1000) return alert('Некорректная цена: ' + usd);
    if (typeof origApplyModelUsd === 'function') origApplyModelUsd(art, clean);
  };

  // 4. УСКОРЕНИЕ ВКЛАДОК И ОБЛАКА
  const origAbc = window.renderAbc;
  window.renderAbc = function () {
    if (window.db && db.tab !== 'abc') return;
    if (typeof origAbc === 'function') origAbc.apply(this, arguments);
  };

  const origSyncCloud = window.syncCloud;
  if (typeof origSyncCloud === 'function') {
    window.syncCloud = async function () {
      const btn = document.querySelector('button[onclick*="syncCloud"]');
      const oldText = btn ? btn.textContent : '☁️ Облако';
      if (btn) {
        if (btn.dataset.busy === '1') return;
        btn.dataset.busy = '1';
        btn.textContent = '⏳ Отправка...';
      }
      compactDb();
      try {
        return await origSyncCloud.apply(this, arguments);
      } finally {
        if (btn) {
          btn.dataset.busy = '0';
          btn.textContent = oldText;
        }
      }
    };
  }
})();
