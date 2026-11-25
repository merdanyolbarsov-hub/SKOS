(function () {
  if (window.__skosPatch5Master) return;
  window.__skosPatch5Master = true;

  function normClean(v) { return String(v || '').replace(/^[\uFEFF\u200B]+/, '').trim(); }
  function parseSafeNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v || '0').replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  // 1. НАДЁЖНОЕ СОХРАНЕНИЕ В БРАУЗЕР (при F5 ничего не пропадает)
  const rawSetItem = Storage.prototype.setItem;
  const rawGetItem = Storage.prototype.getItem;

  window.save = function () {
    if (!window.db) return;
    cleanBrokenSkuPrices();
    try {
      rawSetItem.call(localStorage, 'skos_v3_prod', JSON.stringify(window.db));
    } catch (e) {
      console.warn('Ошибка записи в localStorage:', e);
    }
  };

  window.importJson = function (ev) {
    const f = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function (e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== 'object') return alert('Неверный формат файла бэкапа');
        window.db = Object.assign(window.db || {}, parsed);
        cleanBrokenSkuPrices();
        rawSetItem.call(localStorage, 'skos_v3_prod', JSON.stringify(window.db));
        if (typeof onPerChange === 'function') onPerChange();
        if (typeof render === 'function') render();
        alert('✅ Бэкап успешно загружен и надёжно сохранён!');
      } catch (err) {
        alert('Ошибка чтения файла бэкапа: ' + err.message);
      }
    };
    r.readAsText(f, 'UTF-8');
    ev.target.value = '';
  };

  // 2. ОЧИСТКА И ЗАЩИТА ЦЕН В ТОВАРАХ И ПАПКАХ
  function cleanBrokenSkuPrices() {
    if (!window.db || !Array.isArray(db.skus)) return false;
    let changed = false;
    const seen = new Set();
    db.skus = db.skus.filter(s => {
      if (!s) return false;
      const bc = normClean(s.bc || s.barcode);
      if (!bc || seen.has(bc)) return false;
      seen.add(bc);
      s.bc = bc;
      if (s.usd === undefined && s.costUsd !== undefined) s.usd = s.costUsd;
      const val = parseSafeNum(s.usd);
      if (val < 0 || val > 5000) {
        s.usd = 0;
        s.isNew = true;
        changed = true;
      } else {
        s.usd = val;
      }
      return true;
    });
    if (changed && typeof recalcReportsCogs === 'function') {
      recalcReportsCogs();
    }
    return changed;
  }

  window.openEditFolderModal = function (encodedKey) {
    const fKey = decodeURIComponent(encodedKey);
    const items = (db.skus || []).filter(s => (normClean(s.art) || 'Без артикула') === fKey);
    if (!items.length) return;

    let fNames = {};
    try { fNames = JSON.parse(rawGetItem.call(localStorage, 'skos_v3_folder_names') || '{}'); } catch (e) {}
    const curTitle = fNames[fKey] || (items[0] && items[0].name) || fKey;
    const validPrices = items.map(x => parseSafeNum(x.usd)).filter(x => x > 0 && x <= 5000);
    const curUsd = validPrices.length ? validPrices[0] : 0;

    const oldModal = document.getElementById('p5-folder-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'p5-folder-modal';
    modal.className = 'modal-bg';
    modal.innerHTML =
      '<div class="modal-box">' +
        '<h3 style="font-size:16px;font-weight:800;margin-bottom:6px">✏️ Редактировать всю папку (' + items.length + ' ШК)</h3>' +
        '<p style="font-size:11.5px;color:#64748b;margin-bottom:12px">Изменения применятся ко всем ' + items.length + ' штрихкодам внутри папки.</p>' +
        '<div style="display:grid;gap:10px">' +
          '<div><label style="font-size:11px;font-weight:700">Код папки (Артикул модели)</label><input id="p5-fld-art" class="input" value="' + fKey.replace(/"/g, '&quot;') + '"></div>' +
          '<div><label style="font-size:11px;font-weight:700">Название модели</label><input id="p5-fld-name" class="input" value="' + curTitle.replace(/"/g, '&quot;') + '"></div>' +
          '<div>' +
            '<label style="font-size:11px;font-weight:700">Себестоимость ($ USD) для всех ' + items.length + ' ШК</label>' +
            '<input id="p5-fld-usd" type="text" inputmode="decimal" class="input" value="' + curUsd + '">' +
            '<label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11.5px;cursor:pointer">' +
              '<input type="checkbox" id="p5-fld-apply" checked> Обновить себестоимость $ у всех ШК в этой папке' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">' +
          '<button type="button" class="btn" onclick="document.getElementById(\'p5-folder-modal\').remove()">Отмена</button>' +
          '<button type="button" class="btn btn-primary" id="p5-fld-save">💾 Применить и сохранить</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('p5-fld-save').onclick = function () {
      const newArt = normClean(document.getElementById('p5-fld-art').value) || fKey;
      const newName = normClean(document.getElementById('p5-fld-name').value) || curTitle;
      const applyPrice = document.getElementById('p5-fld-apply').checked;
      const newUsd = parseSafeNum(document.getElementById('p5-fld-usd').value);

      if (applyPrice && (newUsd < 0 || newUsd > 5000)) {
        return alert('Введите нормальную себестоимость в долларах (от 0 до 5000).');
      }

      fNames[newArt] = newName;
      try { rawSetItem.call(localStorage, 'skos_v3_folder_names', JSON.stringify(fNames)); } catch (e) {}

      items.forEach(s => {
        s.art = newArt;
        s.name = newName;
        if (applyPrice) {
          s.usd = newUsd;
          s.isNew = newUsd === 0;
        }
      });

      if (typeof recalcReportsCogs === 'function') recalcReportsCogs();
      modal.remove();
      window.save();
      if (typeof render === 'function') render();
    };
  };
  // 3. КУРС ВАЛЮТ ПО МЕСЯЦАМ (не сбрасывается на 96.5)
  function getSavedDefaultRate() {
    const manual = parseSafeNum(rawGetItem.call(localStorage, 'skos_manual_default_rate'));
    if (manual > 0) return manual;
    if (window.db && db.rates) {
      const vals = Object.values(db.rates).map(parseSafeNum).filter(v => v > 0 && v !== 96.5);
      if (vals.length) return vals[vals.length - 1];
    }
    return 80;
  }

  window.getRate = function (per) {
    const p = per || (typeof curPer === 'function' ? curPer() : '');
    if (p && window.db && db.rates && db.rates[p] && parseSafeNum(db.rates[p]) !== 96.5) {
      return parseSafeNum(db.rates[p]);
    }
    return getSavedDefaultRate();
  };

  window.setRate = function (v) {
    const p = typeof curPer === 'function' ? curPer() : '2026-01';
    if (db.locked && db.locked[p]) return alert('Месяц закрыт!');
    const n = parseSafeNum(v);
    if (n > 0) {
      if (!db.rates) db.rates = {};
      db.rates[p] = n;
      rawSetItem.call(localStorage, 'skos_manual_default_rate', String(n));
      window.save();
      if (typeof render === 'function') render();
    }
  };
  // 4. УМНОЕ ОБЛАКО (разделяем main, skus и itemSales — без ошибки 500)
  const SUPA_URL = 'https://supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdWR2bnp5cXJ4eGFsaWtjbWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NTEwNzYsImV4cCI6MjExMDMyNzA3Nn0.cgCy3KoqjKuJaI4gzG8_nIlv20JttvAg7UgwTVQ-qwE';
  const SYNC_HASH_KEY = 'skos_cloud_chunk_hashes_v2';

  function fastHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  window.p4ForceCloudSync = async function (forceFull) {
    const url = ((document.getElementById('sb-url') || {}).value || (db.cloud && db.cloud.url) || SUPA_URL).trim().replace(/\/$/, '');
    const key = ((document.getElementById('sb-key') || {}).value || (db.cloud && db.cloud.key) || SUPA_KEY).trim();
    const pin = ((document.getElementById('sb-pin') || {}).value || (db.cloud && db.cloud.pin) || 'Skos#9482!Tm').trim();

    if (sessionStorage.getItem('skos_auth_role') === 'viewer') {
      return alert('В режиме просмотра сохранение в облако отключено.');
    }

    const btn = document.querySelector('.topbar button[onclick*="syncCloud"], .topbar button[onclick*="p4ForceCloudSync"]');
    const oldTxt = btn ? btn.textContent : '☁️ Облако';
    if (btn) {
      if (btn.dataset.busy === '1') return;
      btn.dataset.busy = '1';
      btn.textContent = '⏳ Проверка...';
    }

    cleanBrokenSkuPrices();
    window.save();

    let savedHashes = {};
    if (forceFull !== true) {
      try { savedHashes = JSON.parse(rawGetItem.call(localStorage, SYNC_HASH_KEY) || '{}'); } catch (e) {}
    }
    const nextHashes = Object.assign({}, savedHashes);

    const allSkus = Array.isArray(db.skus) ? db.skus : [];
    const allSales = Array.isArray(db.itemSales) ? db.itemSales : [];
    const chunkSize = 4000;

    const skuChunks = Math.max(1, Math.ceil(allSkus.length / chunkSize));
    const salesChunks = Math.ceil(allSales.length / chunkSize);

    // В main оставляем только лёгкие сводные данные (без тяжёлых массивов skus и itemSales)
    const finDb = Object.assign({}, db, {
      skus: [],
      itemSales: [],
      ddsHashes: {},
      skusChunks: skuChunks,
      skusTotal: allSkus.length,
      salesChunks: salesChunks
    });

    const mainHash = fastHash(JSON.stringify(finDb));
    const tasks = [];
    const changedParts = [];

    if (savedHashes.main !== mainHash) {
      tasks.push({ id: 'main', payload: finDb, hashKey: 'main', hashVal: mainHash, label: 'Финансы и отчёты' });
    }

    for (let c = 0; c < skuChunks; c++) {
      const part = allSkus.slice(c * chunkSize, (c + 1) * chunkSize).map(s => ({
        n: s.name, a: s.art, b: s.bc, u: s.usd
      }));
      const partHash = fastHash(JSON.stringify(part));
      const keyName = 'skus_' + c;
      if (savedHashes[keyName] !== partHash) {
        tasks.push({ id: keyName, payload: part, hashKey: keyName, hashVal: partHash, label: 'Товары (пачка #' + (c + 1) + ')' });
      }
    }

    for (let s = 0; s < salesChunks; s++) {
      const sPart = allSales.slice(s * chunkSize, (s + 1) * chunkSize);
      const sHash = fastHash(JSON.stringify(sPart));
      const sKey = 'sales_' + s;
      if (savedHashes[sKey] !== sHash) {
        tasks.push({ id: sKey, payload: sPart, hashKey: sKey, hashVal: sHash, label: 'ABC-продажи (пачка #' + (s + 1) + ')' });
      }
    }

    if (!tasks.length) {
      if (btn) {
        btn.dataset.busy = '0';
        btn.textContent = oldTxt;
      }
      return alert('✅ Новых изменений нет — в облаке уже сохранена самая свежая версия!');
    }

    if (btn) btn.textContent = '⏳ Отправка (' + tasks.length + ')...';

    const hdrs = {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=merge-duplicates',
      'x-skos-pin': pin
    };

    try {
      // Отправляем по одной лёгкой пачке последовательно, чтобы не перегружать Supabase (избегаем ошибки 500)
      for (const t of tasks) {
        const r = await fetch(url + '/rest/v1/skos_cloud?on_conflict=id', {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify([{ id: t.id, payload: t.payload, updated_at: new Date().toISOString() }])
        });
        if (!r.ok) {
          const errTxt = await r.text().catch(() => '');
          throw new Error(t.label + ' (' + r.status + ' ' + errTxt.slice(0, 80) + ')');
        }
        nextHashes[t.hashKey] = t.hashVal;
        changedParts.push(t.label);
      }

      rawSetItem.call(localStorage, SYNC_HASH_KEY, JSON.stringify(nextHashes));
      alert('✅ Сохранены только новые изменения:\n• ' + changedParts.join('\n• '));
    } catch (e) {
      alert('❌ Ошибка облака: ' + e.message);
    } finally {
      if (btn) {
        btn.dataset.busy = '0';
        btn.textContent = oldTxt;
      }
    }
  };

  window.syncCloud = function (manual) {
    if (manual) return window.p4ForceCloudSync(false);
  };

  // 5. ЗАПУСК ПРИ СТАРТЕ
  setTimeout(function () {
    if (cleanBrokenSkuPrices()) {
      window.save();
    }
    const topCloudBtn = Array.from(document.querySelectorAll('.topbar button')).find(b => (b.textContent || '').includes('Облако'));
    if (topCloudBtn) topCloudBtn.onclick = function () { window.p4ForceCloudSync(false); };
    if (typeof render === 'function') render();
  }, 450);
})();
