(function () {
  // 1. Индикатор загрузки patch5 в правом нижнем углу (чтобы точно знать, что файл обновился)
  function showBadge() {
    if (document.getElementById('p5-badge')) return;
    const b = document.createElement('div');
    b.id = 'p5-badge';
    b.textContent = 'SKOS patch5 OK';
    b.style.cssText = 'position:fixed;bottom:6px;right:8px;background:#16a34a;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;z-index:99999;opacity:0.85;pointer-events:none';
    document.body.appendChild(b);
  }

  // 2. Убираем двойной экран (прячем «Каталог товаров», когда открыта другая вкладка)
  function fixDoubleScreen() {
    const activeNav = document.querySelector('.nav-item.active');
    const activeText = activeNav ? activeNav.textContent.trim() : '';
    document.querySelectorAll('section, .tab-pane, [id^="tab-"]').forEach(sec => {
      const txt = sec.textContent || '';
      if (txt.includes('Поиск по ШК / Артикулу') && txt.includes('Каталог товаров')) {
        sec.style.display = activeText.includes('Товары') ? '' : 'none';
      }
      if (txt.includes('Управление запасами, производством')) {
        sec.style.display = activeText.includes('Запасы') ? '' : 'none';
      }
    });
  }

  // 3. Кнопка «Целиком за месяц» для ЛЮБОГО налога
  window.addWholeMonthTaxAny = function () {
    if (!window.db) return;
    const finSec = Array.from(document.querySelectorAll('section, .tab-pane, [id^="tab-"]')).find(el =>
      el.offsetParent !== null && (el.textContent || '').includes('Налоги от бухгалтера')
    );
    if (!finSec) return;

    const selects = finSec.querySelectorAll('select');
    const org = selects.item(0) ? selects.item(0).value : 'ИП';
    const taxType = selects.item(1) ? selects.item(1).value : 'Налог';
    const yr = selects.item(2) ? selects.item(2).value : (document.getElementById('f-yr')?.value || '2026');
    const amtInput = finSec.querySelector('input[type="number"], input[placeholder*="300000"]');
    const amount = Number(amtInput ? amtInput.value : 0) || 0;

    if (amount <= 0) {
      alert('Введите сумму налога (например, 300000).');
      if (amtInput) amtInput.focus();
      return;
    }

    const curMo = document.getElementById('f-mo')?.value || '11';
    const moPrompt = prompt(
      `За какой месяц ${yr} года провести налог «${taxType}» (${amount.toLocaleString('ru-RU')} ₽) ЦЕЛИКОМ?\nВведите номер месяца от 1 до 12 (сейчас выбран ${curMo}):`,
      curMo
    );
    if (!moPrompt) return;
    const moNum = Number(moPrompt);
    if (!moNum || moNum < 1 || moNum > 12) {
      alert('Укажите номер месяца от 1 до 12.');
      return;
    }
    const mo = String(moNum).padStart(2, '0');

    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    window.db.taxes.unshift({
      id: 'tax_' + Date.now(),
      yr: String(yr),
      mo: mo,
      q: Math.ceil(moNum / 3),
      org: org,
      type: taxType,
      name: taxType,
      amount: amount,
      monthAmount: amount,
      isMonthly: true,
      comment: `Целиком за ${mo}.${yr}`
    });

    if (amtInput) amtInput.value = '';
    if (typeof save === 'function') save();
    else localStorage.setItem('skos_db', JSON.stringify(window.db));
    if (typeof renderAll === 'function') renderAll();
    alert(`✅ Налог «${taxType}» (${amount.toLocaleString('ru-RU')} ₽) записан ЦЕЛИКОМ на ${mo}.${yr}!`);
  };

  // 4. Подтянуть ВСЕ налоги из ДДС с выбором: разбить на 3 мес. или целиком
  window.pullTaxesFromDds = function () {
    if (!window.db) return;
    const ddsList = window.db.dds || window.db.cashflow || window.db.tx || window.db.bank || [];
    if (!Array.isArray(ddsList) || !ddsList.length) {
      alert('В ДДС (Выписки и Кассы) пока нет операций.');
      return;
    }

    if (!Array.isArray(window.db.taxes)) window.db.taxes = [];
    const existingIds = new Set(window.db.taxes.map(t => t.ddsId).filter(Boolean));

    const taxRows = ddsList.filter(r => {
      if (existingIds.has(r.id)) return false;
      const amt = Number(r.amount ?? r.sum ?? r.rub ?? 0);
      if (amt > 0 && r.type !== 'out' && r.dir !== 'out' && r.isExpense !== true && !String(r.cat || r.article || '').toLowerCase().includes('налог')) {
        return false;
      }
      const txt = `${r.cat || ''} ${r.article || ''} ${r.comment || ''} ${r.desc || ''} ${r.purpose || ''}`.toLowerCase();
      return /налог|фнс|енп|усн|аусн|ндфл|патент|взнос|пфр|фомс|фсс/.test(txt);
    });

    if (!taxRows.length) {
      alert('Новых налоговых платежей в ДДС не найдено (все уже подтянуты или нет операций со статьёй «Налоги» / ФНС / ЕНП / АУСН / УСН).');
      return;
    }

    let added = 0;
    for (const r of taxRows) {
      const fullAmt = Math.abs(Number(r.amount ?? r.sum ?? r.rub ?? 0));
      if (!fullAmt) continue;

      const dateStr = String(r.date || r.dt || `${r.yr || '2026'}-${String(r.mo || '11').padStart(2, '0')}-01`);
      const yr = dateStr.slice(0, 4) || '2026';
      const moNum = Number(dateStr.slice(5, 7)) || Number(r.mo) || 11;
      const org = r.org || r.entity || r.company || 'ИП';
      const label = r.cat || r.article || 'Налог из ДДС';
      const desc = r.comment || r.desc || r.purpose || '';

      const split3 = confirm(
        `Найден платёж в ДДС:\n` +
        `• Юрлицо: ${org}\n` +
        `• Дата: ${dateStr} | Сумма: ${fullAmt.toLocaleString('ru-RU')} ₽\n` +
        `• Назначение: ${label} ${desc ? '(' + desc + ')' : ''}\n\n` +
        `Нажмите ОК — РАЗБИТЬ на 3 месяца квартала (по ${Math.round(fullAmt / 3).toLocaleString('ru-RU')} ₽/мес. для ОПиУ).\n` +
        `Нажмите ОТМЕНА — записать ЦЕЛИКОМ (${fullAmt.toLocaleString('ru-RU')} ₽) в ${String(moNum).padStart(2, '0')}.${yr}.`
      );

      if (split3) {
        const q = Math.ceil(moNum / 3);
        const startMo = (q - 1) * 3 + 1;
        const part = Math.round((fullAmt / 3) * 100) / 100;
        for (let i = 0; i < 3; i++) {
          const mStr = String(startMo + i).padStart(2, '0');
          window.db.taxes.unshift({
            id: `tax_${Date.now()}_${added}_${i}`,
            ddsId: r.id || `${dateStr}_${fullAmt}`,
            yr: yr, mo: mStr, q: q, org: org,
            type: label, name: label,
            amount: part, monthAmount: part,
            comment: `1/3 из ДДС от ${dateStr} (${fullAmt.toLocaleString('ru-RU')} ₽)`
          });
        }
      } else {
        const mStr = String(moNum).padStart(2, '0');
        window.db.taxes.unshift({
          id: `tax_${Date.now()}_${added}`,
          ddsId: r.id || `${dateStr}_${fullAmt}`,
          yr: yr, mo: mStr, q: Math.ceil(moNum / 3), org: org,
          type: label, name: label,
          amount: fullAmt, monthAmount: fullAmt,
          isMonthly: true,
          comment: `Целиком из ДДС от ${dateStr}`
        });
      }
      added++;
    }

    if (typeof save === 'function') save();
    else localStorage.setItem('skos_db', JSON.stringify(window.db));
    if (typeof renderAll === 'function') renderAll();
    alert(`✅ Обработано налоговых платежей из ДДС: ${added} шт.`);
  };

  // 5. Единый список моделей из всех техкарт и каталога товаров
  function getAllModelsList() {
    const set = new Set();
    const erp = window.db && window.db.erp ? window.db.erp : null;
    if (erp && Array.isArray(erp.bom)) {
      erp.bom.forEach(b => { if (b && b.product) set.add(String(b.product).trim()); });
    }
    if (window.db) {
      ['products', 'items', 'catalog', 'sku', 'goods'].forEach(k => {
        if (Array.isArray(window.db[k])) {
          window.db[k].forEach(it => {
            const name = typeof it === 'string' ? it : (it.name || it.title || it.product || it.model);
            if (name) set.add(String(name).trim());
          });
        }
      });
    }
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function applyPatch5() {
    showBadge();
    fixDoubleScreen();

    // Подключаем кнопки на вкладке «Расходы и Налоги»
    const ausnBtn = document.getElementById('skos-ausn-month-btn') ||
      Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Целиком за месяц'));
    if (ausnBtn) {
      ausnBtn.textContent = '✅ Целиком за месяц';
      ausnBtn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); window.addWholeMonthTaxAny(); };
    }

    const pullBtn = document.getElementById('skos-pull-tax-dds') ||
      Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Подтянуть налоги из ДДС'));
    if (pullBtn) {
      pullBtn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); window.pullTaxesFromDds(); };
    }

    // Обновляем выпадающие списки моделей везде
    const models = getAllModelsList();
    if (models.length) {
      const erp = window.db && window.db.erp ? window.db.erp : null;
      const bomSet = new Set((erp && erp.bom ? erp.bom : []).map(b => b.product.toLowerCase()));

      const ordSel = document.getElementById('erp-ord-prod');
      if (ordSel && ordSel.options.length !== models.length) {
        const cur = ordSel.value;
        ordSel.innerHTML = models.map(m =>
          `<option value="${m}">${m}${bomSet.has(m.toLowerCase()) ? ' ✅' : ' (нет техкарты)'}</option>`
        ).join('');
        if (cur) ordSel.value = cur;
      }

      let dl = document.getElementById('bom-prod-list');
      if (!dl) {
        dl = document.createElement('datalist');
        dl.id = 'bom-prod-list';
        document.body.appendChild(dl);
      }
      dl.innerHTML = models.map(m => `<option value="${m}">`).join('');

      document.querySelectorAll('#bom-prod-name, #tab-inv input[placeholder*="Брюки"], #tab-inv input[placeholder*="Модель"], #tab-inv input[id*="fg-prod"], #tab-inv input[id*="def-prod"]').forEach(inp => {
        inp.setAttribute('list', 'bom-prod-list');
      });
    }
  }

  setInterval(applyPatch5, 500);
  setTimeout(applyPatch5, 200);
})();
