(function () {
  const DEFAULT_URL = 'https://supabase.co';
  const DEFAULT_DDS_CATS = [
    { grp: 'Поступления', name: 'Поступление от ВБ' },
    { grp: 'Поступления', name: 'Поступление от Озон' },
    { grp: 'Поступления', name: 'Поступление от ЯМ' },
    { grp: 'Поступления', name: 'Поступление от соц. сетей' },
    { grp: 'Поступления', name: 'Прочие поступления' },
    { grp: 'Поступления', name: 'Возвраты от поставщиков' },
    { grp: 'Закуп и логистика', name: 'Закуп товара RUB' },
    { grp: 'Закуп и логистика', name: 'Закуп товара USD' },
    { grp: 'Закуп и логистика', name: 'Поставщик товара USD' },
    { grp: 'Закуп и логистика', name: 'Сертификация товара' },
    { grp: 'Закуп и логистика', name: 'Упаковочные материалы RUB' },
    { grp: 'Закуп и логистика', name: 'Упаковочные материалы USD' },
    { grp: 'Закуп и логистика', name: 'Доставка по РФ до склада' },
    { grp: 'Закуп и логистика', name: 'Доставка из Китая' },
    { grp: 'Закуп и логистика', name: 'Доставка из Турции' },
    { grp: 'Закуп и логистика', name: 'Транспортные и курьерские услуги' },
    { grp: 'Закуп и логистика', name: 'Организация таможенного оформления RUB' },
    { grp: 'Закуп и логистика', name: 'Организация таможенного оформления USD' },
    { grp: 'Закуп и логистика', name: 'Федеральная таможенная служба' }
  ];
  const MORE_DDS_CATS = [
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ склад' },
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ менеджеры' },
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ офис' },
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ собственник' },
    { grp: 'Зарплата (ФОТ)', name: 'Расходы на персонал' },
    { grp: 'Зарплата (ФОТ)', name: 'Поиск и найм персонала' },
    { grp: 'Авто, командировки, офис', name: 'Авто расходы компании' },
    { grp: 'Авто, командировки, офис', name: 'Командировки RUB' },
    { grp: 'Авто, командировки, офис', name: 'Командировки USD' },
    { grp: 'Авто, командировки, офис', name: 'Представительские расходы RUB' },
    { grp: 'Авто, командировки, офис', name: 'Представительские расходы USD' },
    { grp: 'Авто, командировки, офис', name: 'Содержание офиса' },
    { grp: 'Авто, командировки, офис', name: 'Аренда склада' },
    { grp: 'Авто, командировки, офис', name: 'Оплата рекламных систем' },
    { grp: 'Авто, командировки, офис', name: 'Маркетинговые подрядчики' },
    { grp: 'Авто, командировки, офис', name: 'Программное обеспечение' },
    { grp: 'Авто, командировки, офис', name: 'Административные и юридические услуги' },
    { grp: 'Авто, командировки, офис', name: 'Обучение' },
    { grp: 'Авто, командировки, офис', name: 'Прочие расходы' },
    { grp: 'Налоги и банк', name: 'Комиссия РКО' },
    { grp: 'Налоги и банк', name: 'Комиссия за конвертацию валют RUB' },
    { grp: 'Налоги и банк', name: 'Комиссия за конвертацию валют USD' },
    { grp: 'Налоги и банк', name: 'АУСН' },
    { grp: 'Налоги и банк', name: 'УСН' },
    { grp: 'Налоги и банк', name: 'НДС' },
    { grp: 'Налоги и банк', name: 'ЕНП' },
    { grp: 'Налоги и банк', name: 'Взносы ИП фикс. + 1%' },
    { grp: 'Переводы, валюта, ОС', name: 'Поступление — Перевод между счетами' },
    { grp: 'Переводы, валюта, ОС', name: 'Выбытие — Перевод между счетами' },
    { grp: 'Переводы, валюта, ОС', name: 'Поступление - Конвертация валют USD' },
    { grp: 'Переводы, валюта, ОС', name: 'Выбытие - Конвертация валют RUB' },
    { grp: 'Переводы, валюта, ОС', name: 'Вклады от собственников RUB' },
    { grp: 'Переводы, валюта, ОС', name: 'Вклады от собственников USD' },
    { grp: 'Переводы, валюта, ОС', name: 'Дивиденды' },
    { grp: 'Переводы, валюта, ОС', name: 'Покупка ОС' },
    { grp: 'Переводы, валюта, ОС', name: 'Продажа ОС' },
    { grp: 'Переводы, валюта, ОС', name: 'Ремонт ОС' }
  ];
  const ALL_INIT_CATS = DEFAULT_DDS_CATS.concat(MORE_DDS_CATS);
  const TAX_LIST = ['АУСН', 'УСН', 'НДС', 'ЕНП', 'Налог на прибыль (ООО)', 'Патент (ПСН)', 'Взносы ИП фикс. + 1%', 'Страховые взносы (сотрудники)', 'НДФЛ', 'Торговый сбор', 'Прочие налоги'];
  const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  function ensureCats() {
    if (!window.db) return [];
    if (!Array.isArray(db.ddsCats) || !db.ddsCats.length) {
      db.ddsCats = ALL_INIT_CATS.map((c, i) => ({ id: 'cat_' + i, grp: c.grp, name: c.name }));
      if (typeof save === 'function') save();
    }
    return db.ddsCats;
  }

  function buildCatOptions() {
    const cats = ensureCats();
    const groups = {};
    cats.forEach(c => { (groups[c.grp] = groups[c.grp] || []).push(c.name); });
    return Object.keys(groups).map(g =>
      `<optgroup label="${g}">${groups[g].map(n => `<option value="${n}">${n}</option>`).join('')}</optgroup>`
    ).join('');
  }

  function syncCatInputs() {
    ['d-cat', 'ex-cat'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'INPUT') {
        const sel = document.createElement('select');
        sel.id = id;
        sel.className = el.className || 'select';
        sel.required = true;
        el.replaceWith(sel);
      }
      const s = document.getElementById(id);
      if (s && s.dataset.cnt !== String(ensureCats().length)) {
        const cur = s.value;
        s.innerHTML = buildCatOptions();
        if (cur) s.value = cur;
        s.dataset.cnt = String(ensureCats().length);
      }
    });
  }
  function renderInitBalancesBox() {
    const kpiBox = document.getElementById('dds-kpis');
    if (!kpiBox || !window.db) return;
    if (!db.initBalances) db.initBalances = {};
    let box = document.getElementById('skos-init-bal-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-init-bal-box';
      box.style.cssText = 'margin:12px 0;padding:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;';
      kpiBox.parentNode.insertBefore(box, kpiBox.nextSibling);
    }
    const allWals = db.orgs.map(o => ({ id: o.id, name: o.name + ' (' + o.bank + ')', cur: 'RUB' })).concat(db.cashWallets);
    const rowsHtml = allWals.map(w => {
      const val = db.initBalances[w.id] || '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;background:#fff;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;">
        <span style="font-size:12px;font-weight:600">${w.name} [${w.cur}]</span>
        <input type="number" step="0.01" class="input skos-init-inp" data-wal="${w.id}" value="${val}" placeholder="0.00" style="width:120px;text-align:right">
      </div>`;
    }).join('');
    box.innerHTML = `<details><summary style="cursor:pointer;font-weight:700;font-size:13px;color:#1e293b">🏦 Входящее сальдо (Начальные остатки счетов и касс на 01.01.2026) — нажмите, чтобы открыть</summary>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:8px;margin-top:10px">${rowsHtml}</div>
      <div style="margin-top:10px;text-align:right"><button type="button" class="btn btn-primary" onclick="saveInitBalances()">💾 Сохранить начальные остатки</button></div>
    </details>`;
  }

  window.saveInitBalances = function () {
    if (!db.initBalances) db.initBalances = {};
    document.querySelectorAll('.skos-init-inp').forEach(inp => {
      db.initBalances[inp.dataset.wal] = parseFloat(inp.value) || 0;
    });
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    alert('Начальные остатки на 01.01.2026 сохранены!');
  };
  function renderCatEditorBox() {
    const orgTbl = document.getElementById('tb-orgs-set');
    if (!orgTbl || !window.db) return;
    const parentCard = orgTbl.closest('.card') || orgTbl.parentNode;
    let box = document.getElementById('skos-cat-editor-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-cat-editor-box';
      box.className = 'card';
      box.style.cssText = 'margin-top:14px;padding:14px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;';
      parentCard.parentNode.insertBefore(box, parentCard.nextSibling);
    }
    const cats = ensureCats();
    const groups = [...new Set(cats.map(c => c.grp))];
    const listHtml = cats.map(c =>
      `<span style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;font-size:12px;">
        <b>[${c.grp}]</b> ${c.name}
        <button type="button" onclick="delDdsCat('${c.id}')" style="border:none;background:none;color:#dc2626;font-weight:700;cursor:pointer">✕</button>
      </span>`
    ).join('');
    box.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:8px">📑 Справочник статей ДДС и Расходов (Добавление и удаление)</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <select id="new-cat-grp" class="select" style="width:220px">${groups.map(g => `<option value="${g}">${g}</option>`).join('')}</select>
        <input id="new-cat-name" class="input" placeholder="Название новой статьи..." style="flex:1;min-width:200px">
        <button type="button" class="btn btn-primary" onclick="addDdsCat()">+ Добавить статью</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:220px;overflow-y:auto">${listHtml}</div>`;
  }

  window.addDdsCat = function () {
    const grp = document.getElementById('new-cat-grp').value;
    const name = (document.getElementById('new-cat-name').value || '').trim();
    if (!name) return alert('Введите название статьи');
    ensureCats().push({ id: 'cat_' + Date.now(), grp, name });
    document.getElementById('new-cat-name').value = '';
    if (typeof save === 'function') save();
    renderCatEditorBox();
    syncCatInputs();
  };

  window.delDdsCat = function (id) {
    db.ddsCats = ensureCats().filter(c => c.id !== id);
    if (typeof save === 'function') save();
    renderCatEditorBox();
    syncCatInputs();
  };
  window.toggleOrgArch = function (id) {
    const o = db.orgs.find(x => x.id === id);
    if (!o) return;
    o.archived = !o.archived;
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
  };

  function patchTaxesAndArchive() {
    const txType = document.getElementById('tx-type');
    if (txType && txType.dataset.p !== '1') {
      txType.innerHTML = TAX_LIST.map(t => `<option value="${t}">${t}</option>`).join('');
      txType.dataset.p = '1';
    }
    const txKv = document.getElementById('tx-kv');
    if (txKv && txKv.dataset.p !== '1') {
      const mOpts = MONTHS_RU.map((m, i) => `<option value="M${String(i + 1).padStart(2, '0')}">Месяц: ${m}</option>`).join('');
      txKv.insertAdjacentHTML('beforeend', `<optgroup label="Помесячно (АУСН / НДФЛ)">${mOpts}</optgroup>`);
      txKv.dataset.p = '1';
    }
  }

  const origRenderLists = window.renderLists;
  window.renderLists = function () {
    if (typeof origRenderLists === 'function') origRenderLists();
    const initB = db.initBalances || {};
    const allWals = db.orgs.map(o => ({ id: o.id, name: o.name + ' (' + o.bank + ')' + (o.archived ? ' [АРХИВ]' : ''), cur: 'RUB' })).concat(db.cashWallets);
    const kpiEl = document.getElementById('dds-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = allWals.map(w => {
        const bal = (Number(initB[w.id]) || 0) + db.dds.filter(d => d.wal === w.id).reduce((s, d) => s + d.amt, 0);
        const vc = w.cur === 'USD' ? 'text-green' : '';
        const vs = w.cur === 'USD' ? fmtU(bal) : fmtR(bal);
        return `<div class="kpi-card"><div style="font-size:11px;color:#64748b;font-weight:700">${w.name}</div><div class="kpi-val ${vc}" style="font-size:16px">${vs}</div></div>`;
      }).join('');
    }
    const orgSet = document.getElementById('tb-orgs-set');
    if (orgSet) {
      orgSet.innerHTML = db.orgs.map(o =>
        `<tr><td class="bold">${o.name} ${o.archived ? '<span class="badge badge-amber">Архив</span>' : ''}</td><td>${o.bank}</td>
        <td><button class="btn" onclick="toggleOrgArch('${o.id}')">${o.archived ? 'Вернуть' : 'В архив'}</button>
        <button class="btn btn-danger" onclick="db.orgs=db.orgs.filter(x=>x.id!=='${o.id}');save();render()">✕</button></td></tr>`
      ).join('');
    }
    renderInitBalancesBox();
    renderCatEditorBox();
    syncCatInputs();
  };
  window.importBankCsv = function (ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const walId = document.getElementById('dds-wal').value;
    const r = new FileReader();
    r.onload = e => {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines[0].includes(';') ? ';' : ',';
      let added = 0, skip = 0;
      lines.slice(1).forEach((l, idx) => {
        const c = l.split(sep).map(x => x.replace(/^"|"$/g, '').trim());
        if (c.length < 2) return;
        const dt = c[0], desc = c.join(' '), low = desc.toLowerCase();
        let amt = 0;
        for (let i = 1; i < c.length; i++) {
          const n = parseFloat(c[i].replace(/\s+/g, '').replace(',', '.'));
          if (!isNaN(n) && n !== 0) { amt = n; break; }
        }
        if (!amt) return;
        const hash = walId + '_' + dt + '_' + amt + '_' + desc.slice(0, 30) + '_' + idx;
        if (db.ddsHashes[hash]) { skip++; return; }
        db.ddsHashes[hash] = true;
        let cat = 'Прочие расходы';
        if (low.match(/вайлдберриз|wildberries/)) cat = 'Поступление от ВБ';
        else if (low.match(/озон|интернет решения/)) cat = 'Поступление от Озон';
        else if (low.match(/яндекс/)) cat = 'Поступление от ЯМ';
        else if (low.match(/уфнс|енс|енп|налог|взнос/)) cat = 'ЕНП';
        else if (low.match(/комисс|обслуживан|рко/)) cat = 'Комиссия РКО';
        else if (low.match(/перевод|снятие налич|выдача налич/)) cat = amt >= 0 ? 'Поступление — Перевод между счетами' : 'Выбытие — Перевод между счетами';
        db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dt, wal: walId, cat, amt });
        added++;
      });
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      alert('Загружено: ' + added + ', пропущено дублей: ' + skip);
    };
    r.readAsText(f, 'UTF-8');
  };

  window.syncCloud = async function (manual) {
    if (!window.db) window.db = {};
    if (!db.cloud) db.cloud = {};
    const urlEl = document.getElementById('sb-url'), keyEl = document.getElementById('sb-key');
    const url = ((urlEl && urlEl.value) || localStorage.getItem('skos_sb_url') || db.cloud.url || DEFAULT_URL).trim();
    const key = ((keyEl && keyEl.value) || localStorage.getItem('skos_sb_key') || db.cloud.key || '').trim();
    if (urlEl && !urlEl.value) urlEl.value = url;
    if (keyEl && !keyEl.value && key) keyEl.value = key;
    if (!url || !key) { if (manual) alert('Укажите Project URL и Anon Key в Настройках'); return null; }
    db.cloud.url = url; db.cloud.key = key;
    localStorage.setItem('skos_sb_url', url); localStorage.setItem('skos_sb_key', key);
    if (typeof save === 'function') save();
    const u = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
    try {
      if (manual) {
        const wr = await fetch(u + '/rest/v1/skos_cloud', { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ id: 'main', payload: db, updated_at: new Date().toISOString() }) });
        if (!wr.ok) throw new Error(await wr.text());
        alert('Облако SKOS успешно синхронизировано!');
        return await wr.json();
      }
      const res = await fetch(u + '/rest/v1/skos_cloud?id=eq.main', { headers });
      const rows = await res.json();
      if (rows && rows.length && rows[0].payload && Object.keys(rows[0].payload).length) {
        Object.assign(db, rows[0].payload);
        db.cloud.url = url; db.cloud.key = key;
        if (typeof save === 'function') save();
        if (typeof render === 'function') render();
      }
    } catch (e) { if (manual) alert('Ошибка облака: ' + e.message); }
  };

  function bootAll() {
    ensureCats();
    syncCatInputs();
    patchTaxesAndArchive();
    renderInitBalancesBox();
    renderCatEditorBox();
  }
  bootAll();
  setInterval(bootAll, 1200);
})();
