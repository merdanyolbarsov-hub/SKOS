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

  // 2. Переопределяем функцию синхронизации с облаком Supabase
  window.syncCloud = async function (manual) {
    if (!window.db || !db.cloud || !db.cloud.url || !db.cloud.key) {
      if (manual) alert('Укажите Project URL и Anon Key в Настройках');
      return null;
    }

    const u = db.cloud.url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const headers = {
      apikey: db.cloud.key,
      Authorization: 'Bearer ' + db.cloud.key,
      'Content-Type': 'application/json'
    };

    try {
      // Если нажата кнопка вручную — принудительно отправляем локальную базу в облако
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

      // Если вызов автоматический — проверяем облако
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
