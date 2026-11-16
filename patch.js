(function () {
  const DEFAULT_URL = 'https://supabase.co';

  // 1. Обновляем список налогов (добавляем АУСН 8% и 20%)
  const sel = document.getElementById('tx-type');
  if (sel) {
    sel.innerHTML = [
      '<option value="АУСН (8% Доходы)">АУСН (8% Доходы)</option>',
      '<option value="АУСН (20% Доходы-Расходы)">АУСН (20% Доходы - Расходы)</option>',
      '<option value="УСН">УСН</option>',
      '<option value="НДС">НДС</option>',
      '<option value="Страховые взносы / 1%">Страховые взносы / 1%</option>',
      '<option value="Патент / НДФЛ">Патент / НДФЛ</option>'
    ].join('');
  }

  // Находим инпуты URL и Key на странице
  function findCloudInputs() {
    let urlInput = null;
    let keyInput = null;
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const inp of inputs) {
      const val = (inp.value || '').trim();
      const ph = (inp.placeholder || '').toLowerCase();
      if (val.includes('supabase.co') || ph.includes('supabase.co')) {
        urlInput = inp;
      } else if (val.startsWith('eyJ') || ph.includes('eyj')) {
        keyInput = inp;
      }
    }
    return { urlInput, keyInput };
  }

  // Автозаполнение и автосохранение в localStorage при вводе
  function initCloudFields() {
    if (!window.db) window.db = {};
    if (!db.cloud) db.cloud = {};

    const savedUrl = localStorage.getItem('skos_sb_url') || db.cloud.url || DEFAULT_URL;
    const savedKey = localStorage.getItem('skos_sb_key') || db.cloud.key || '';

    db.cloud.url = savedUrl;
    if (savedKey) db.cloud.key = savedKey;

    const { urlInput, keyInput } = findCloudInputs();
    if (urlInput) {
      if (!urlInput.value || urlInput.value === 'https://supabase.co') {
        urlInput.value = savedUrl;
      }
      urlInput.addEventListener('input', () => {
        db.cloud.url = urlInput.value.trim();
        localStorage.setItem('skos_sb_url', db.cloud.url);
      });
    }
    if (keyInput) {
      if (!keyInput.value && savedKey) {
        keyInput.value = savedKey;
      }
      keyInput.addEventListener('input', () => {
        db.cloud.key = keyInput.value.trim();
        localStorage.setItem('skos_sb_key', db.cloud.key);
      });
    }
  }

  initCloudFields();
  setInterval(initCloudFields, 1500);

  // 2. Переопределяем функцию синхронизации с облаком Supabase
  window.syncCloud = async function (manual) {
    initCloudFields();
    const { urlInput, keyInput } = findCloudInputs();

    const url = ((urlInput && urlInput.value) || db.cloud.url || '').trim();
    const key = ((keyInput && keyInput.value) || db.cloud.key || '').trim();

    if (!url || !key) {
      if (manual) {
        alert('Вставьте длинный ключ Anon Public Key (начинается с eyJ...) во второе поле и нажмите кнопку ещё раз.');
      }
      return null;
    }

    db.cloud.url = url;
    db.cloud.key = key;
    localStorage.setItem('skos_sb_url', url);
    localStorage.setItem('skos_sb_key', key);
    if (typeof save === 'function') save();

    const u = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const headers = {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    };

    try {
      if (manual) {
        const wr = await fetch(u + '/rest/v1/skos_cloud', {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify({
            id: 'main',
            payload: db,
            updated_at: new Date().toISOString()
          })
        });

        if (!wr.ok) throw new Error('Запись: ' + (await wr.text()));
        const saved = await wr.json();
        console.log('Supabase UPSERT ответ:', saved);
        alert('Облако SKOS успешно синхронизировано!');
        return saved;
      }

      const res = await fetch(u + '/rest/v1/skos_cloud?id=eq.main', { headers });
      if (!res.ok) throw new Error('Чтение: ' + (await res.text()));
      const rows = await res.json();

      if (rows && rows.length && rows[0].payload && Object.keys(rows[0].payload).length > 0) {
        Object.assign(db, rows[0].payload);
        db.cloud.url = url;
        db.cloud.key = key;
        if (typeof save === 'function') save();
        if (typeof render === 'function') render();
      }
    } catch (e) {
      console.error('Ошибка Supabase:', e);
      if (manual) alert('Ошибка облака: ' + e.message);
    }
  };
})();
