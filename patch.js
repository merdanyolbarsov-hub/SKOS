(function () {
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

  // Вспомогательная функция: забирает URL и Key прямо из полей на экране или из db.cloud
  function getCloudCredentials() {
    if (!window.db) window.db = {};
    if (!db.cloud) db.cloud = {};

    const inputs = Array.from(document.querySelectorAll('input'));
    for (const inp of inputs) {
      const val = (inp.value || '').trim();
      const ph = (inp.placeholder || '').toLowerCase();
      if (val.includes('supabase.co') || ph.includes('supabase.co')) {
        if (val) db.cloud.url = val;
      } else if (val.startsWith('eyJ') || ph.includes('eyj')) {
        if (val) db.cloud.key = val;
      }
    }

    return {
      url: (db.cloud.url || '').trim(),
      key: (db.cloud.key || '').trim()
    };
  }

  // 2. Переопределяем функцию синхронизации с облаком Supabase
  window.syncCloud = async function (manual) {
    const creds = getCloudCredentials();

    if (!creds.url || !creds.key) {
      if (manual) {
        alert('Вставьте длинный ключ Anon Public Key (начинается с eyJ...) во второе поле и нажмите кнопку ещё раз.');
      }
      return null;
    }

    if (typeof save === 'function') save();

    const u = creds.url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const headers = {
      apikey: creds.key,
      Authorization: 'Bearer ' + creds.key,
      'Content-Type': 'application/json'
    };

    try {
      // При нажатии кнопки «Сохранить и синхронизировать» отправляем всю базу в Supabase
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

      // При фоновом чтении подтягиваем данные из облака
      const res = await fetch(u + '/rest/v1/skos_cloud?id=eq.main', { headers });
      if (!res.ok) throw new Error('Чтение: ' + (await res.text()));
      const rows = await res.json();

      if (rows && rows.length && rows[0].payload && Object.keys(rows[0].payload).length > 0) {
        Object.assign(db, rows[0].payload);
        if (typeof save === 'function') save();
        if (typeof render === 'function') render();
      }
    } catch (e) {
      console.error('Ошибка Supabase:', e);
      if (manual) alert('Ошибка облака: ' + e.message);
    }
  };
})();
