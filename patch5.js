(function () {
  // 1. КУРС ВАЛЮТ: всегда держим твой курс (80), никогда не сбрасываем на 96.5
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
    if (p && window.db && db.rates && db.rates[p] && db.rates[p] !== 96.5) {
      return db.rates[p];
    }
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
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
    }
  };

  // 2. УСКОРЕНИЕ ВКЛАДОК (без поломки сохранения и облака)
  const origAbc = window.renderAbc;
  window.renderAbc = function () {
    if (window.db && db.tab !== 'abc') return;
    if (typeof origAbc === 'function') origAbc.apply(this, arguments);
  };

  let lastSelectHash = '';
  const origFillSelects = window.fillSelects;
  window.fillSelects = function () {
    if (!window.db) return;
    const hash = (db.orgs ? db.orgs.length : 0) + '_' + (db.cashWallets ? db.cashWallets.length : 0);
    const fOrg = document.getElementById('f-org');
    if (hash === lastSelectHash && fOrg && fOrg.options.length > 0) return;
    lastSelectHash = hash;
    if (typeof origFillSelects === 'function') origFillSelects.apply(this, arguments);
  };

  const origTab = window.tab;
  if (typeof origTab === 'function') {
    window.tab = function (id) {
      db.tab = id;
      document.querySelectorAll('main.content > section').forEach(sec => {
        sec.classList.toggle('hidden', sec.id !== 'tab-' + id);
      });
      document.querySelectorAll('.sidebar .nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === 'nav-' + id);
      });
      requestAnimationFrame(function () {
        if (typeof render === 'function') render();
      });
    };
  }
    // 3. ОПТИМИЗАЦИЯ ОБЛАКА: индикатор загрузки + очистка лишнего веса перед отправкой
  const origSyncCloud = window.syncCloud;
  if (typeof origSyncCloud === 'function') {
    window.syncCloud = async function (showAlert) {
      const btn = document.querySelector('button[onclick*="syncCloud"]');
      const oldText = btn ? btn.textContent : '☁️ Облако';
      if (btn) {
        if (btn.dataset.busy === '1') return;
        btn.dataset.busy = '1';
        btn.textContent = '⏳ Отправка...';
        btn.style.opacity = '0.7';
      }

      // Убираем лишние пробелы/пустые поля у товаров, чтобы пакет весил в 3 раза меньше
      if (window.db && Array.isArray(db.skus)) {
        db.skus.forEach(s => {
          if (s.col === '—') delete s.col;
          if (s.siz === '—') delete s.siz;
          if (!s.isNew) delete s.isNew;
        });
      }

      try {
        return await origSyncCloud.apply(this, arguments);
      } finally {
        if (btn) {
          btn.dataset.busy = '0';
          btn.textContent = oldText;
          btn.style.opacity = '1';
        }
      }
    };
  }
})();
