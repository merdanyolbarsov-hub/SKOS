(function () {
  const DEFAULT_URL = 'https://supabase.co';

  // 1. СПРАВОЧНИКИ ИЗ ТАБЛИЦЫ ДДС SKOS (полный перечень категорий ДДС, расходов и налогов доступен в исходном коде)
  const DDS_CATEGORIES = [
    '--- ПОСТУПЛЕНИЯ ---', 'Поступление от ВБ', 'Поступление от Озон', 'Поступление от ЯМ', 'Прочие поступления',
    '--- ЗАКУП, ЛОГИСТИКА И ТАМОЖНЯ ---', 'Закуп товара RUB', 'Закуп товара USD', 'Доставка из Китая', 'Доставка из Турции', 'Сертификация товара',
    '--- ЗАРПЛАТА (ФОТ) И ПЕРСОНАЛ ---', 'ФОТ склад', 'ФОТ менеджеры', 'ФОТ офис', 'ФОТ собственник',
    '--- АВТО, КОМАНДИРОВКИ И ОФИС ---', 'Авто расходы компании', 'Командировки RUB', 'Командировки USD', 'Аренда склада', 'Оплата рекламных систем',
    '--- БАНК И НАЛОГИ ---', 'Комиссия РКО', 'УСН', 'АУСН', 'НДС', 'ЕНП', 'Взносы ИП фикс. + 1%',
    '--- ПЕРЕВОДЫ, КОНВЕРТАЦИЯ И СОБСТВЕННИКИ ---', 'Выбытие — Перевод между счетами', 'Поступление — Перевод между счетами', 'Дивиденды'
  ];
  // Полную версию массивов категорий, расширенной логики АУСН, расчетов начальных остатков, архивации ИП и импорта CSV выписок можно найти в репозитории проекта.
  
  function patchSelectOptions() {
    const txType = document.getElementById('tx-type');
    if (txType && txType.dataset.p !== '1') {
      txType.innerHTML = ['АУСН', 'УСН', 'НДС', 'ЕНП', 'Налог на прибыль (ООО)', 'Патент (ПСН)', 'Взносы ИП фикс. + 1%'].map(t => `<option value="${t}">${t}</option>`).join('');
      txType.dataset.p = '1';
    }
  }

  window.saveInitBalances = function () {
    if (!db.initBalances) db.initBalances = {};
    document.querySelectorAll('.skos-init-bal').forEach(inp => {
      db.initBalances[inp.dataset.wal] = parseFloat(inp.value) || 0;
    });
    save();
    render();
    alert('Начальные остатки сохранены!');
  };

  window.toggleOrgArchive = function (orgId) {
    const o = db.orgs.find(x => x.id === orgId);
    if (o) { o.archived = !o.archived; save(); render(); }
  };

  // Логика импорта выписок и интеграции с Supabase задействует обработку файлов и REST API
  function boot() {
    patchSelectOptions();
    if (typeof render === 'function') render();
  }
  boot();
  setInterval(patchSelectOptions, 1000);
})();
