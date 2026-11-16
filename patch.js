(function () {
  const DEFAULT_URL = 'https://supabase.co';

  const ALL_CATS = [
    { grp: 'Поступления', name: 'Поступление от ВБ' },
    { grp: 'Поступления', name: 'Поступление от Озон' },
    { grp: 'Поступления', name: 'Поступление от ЯМ' },
    { grp: 'Поступления', name: 'Поступление от соц. сетей' },
    { grp: 'Поступления', name: 'Оптовые продажи / Безнал' },
    { grp: 'Поступления', name: 'Вклады от собственников RUB' },
    { grp: 'Поступления', name: 'Вклады от собственников USD' },
    { grp: 'Поступления', name: 'Возвраты от поставщиков' },
    { grp: 'Поступления', name: 'Прочие поступления' },
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
    { grp: 'Закуп и логистика', name: 'Таможенное оформление RUB' },
    { grp: 'Закуп и логистика', name: 'Таможенное оформление USD' },
    { grp: 'Закуп и логистика', name: 'Федеральная таможенная служба' },
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ склад' },
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ менеджеры' },
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ офис' },
    { grp: 'Зарплата (ФОТ)', name: 'ФОТ собственник' },
    { grp: 'Зарплата (ФОТ)', name: 'Расходы на персонал' },
    { grp: 'Авто, командировки, офис', name: 'Авто расходы компании' },
    { grp: 'Авто, командировки, офис', name: 'Командировки RUB' },
    { grp: 'Авто, командировки, офис', name: 'Командировки USD' },
    { grp: 'Авто, командировки, офис', name: 'Аренда склада' },
    { grp: 'Авто, командировки, офис', name: 'Содержание офиса' },
    { grp: 'Авто, командировки, офис', name: 'Оплата рекламных систем' },
    { grp: 'Авто, командировки, офис', name: 'Программное обеспечение (1С / сервисы)' },
    { grp: 'Авто, командировки, офис', name: 'Юридические и админ. услуги' },
    { grp: 'Авто, командировки, офис', name: 'Прочие расходы' },
    { grp: 'Налоги и банк', name: 'Комиссия РКО' },
    { grp: 'Налоги и банк', name: 'Комиссия за конвертацию валют' },
    { grp: 'Налоги и банк', name: 'АУСН' },
    { grp: 'Налоги и банк', name: 'УСН' },
    { grp: 'Налоги и банк', name: 'НДС' },
    { grp: 'Налоги и банк', name: 'ЕНП' },
    { grp: 'Налоги и банк', name: 'Взносы ИП фикс. + 1%' },
    { grp: 'Переводы, валюта, ОС', name: 'Поступление — Перевод между счетами' },
    { grp: 'Переводы, валюта, ОС', name: 'Выбытие — Перевод между счетами' },
    { grp: 'Переводы, валюта, ОС', name: 'Поступление - Конвертация валют USD' },
    { grp: 'Переводы, валюта, ОС', name: 'Выбытие - Конвертация валют RUB' },
    { grp: 'Переводы, валюта, ОС', name: 'Дивиденды' },
    { grp: 'Переводы, валюта, ОС', name: 'Покупка ОС' }
  ];

  const TAX_LIST = ['АУСН', 'УСН', 'НДС', 'ЕНП', 'Налог на прибыль (ООО)', 'Патент (ПСН)', 'Взносы ИП фикс. + 1%', 'Страховые взносы (сотрудники)', 'НДФЛ', 'Торговый сбор', 'Прочие налоги'];
  const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  function ensureCats() {
    if (!window.db) return [];
    if (!Array.isArray(db.ddsCats) || !db.ddsCats.length) {
      db.ddsCats = ALL_CATS.map((c, i) => ({ id: 'cat_' + i, grp: c.grp, name: c.name }));
      if (typeof save === 'function') save();
    }
    return db.ddsCats;
  }

  function buildCatOptions() {
    const cats = ensureCats(), groups = {};
    cats.forEach(c => { (groups[c.grp] = groups[c.grp] || []).push(c.name); });
    return Object.keys(groups).map(g =>
      `<optgroup label="${g}">${groups[g].map(n => `<option value="${n}">${n}</option>`).join('')}</optgroup>`
    ).join('');
  }

  function syncCatSelects() {
    ['d-cat', 'ex-cat'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'INPUT') {
        const sel = document.createElement('select');
        sel.id = id; sel.className = el.className || 'select'; sel.required = true;
        el.replaceWith(sel);
      }
      const s = document.getElementById(id);
      const sig = ensureCats().map(c => c.id).join(',');
      if (s && s.dataset.sig !== sig) {
        const cur = s.value;
        s.innerHTML = buildCatOptions();
        if (cur) s.value = cur;
        s.dataset.sig = sig;
      }
    });
  }

  function renderInitBalancesBox() {
    const kpiBox = document.getElementById('dds-kpis');
    if (!kpiBox || !window.db) return;
    if (!db.initBalances) db.initBalances = {};
    let box = document.getElementById('skos-init-bal-box');
    if (box && box.dataset.ready === '1') return;
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-init-bal-box';
      box.style.cssText = 'margin:12px 0;padding:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;';
      kpiBox.parentNode.insertBefore(box, kpiBox.nextSibling);
    }
    box.dataset.ready = '1';
    const allWals = db.orgs.map(o => ({ id: o.id, name: o.name + ' (' + o.bank + ')', cur: 'RUB' })).concat(db.cashWallets);
    const rowsHtml = allWals.map(w =>
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;background:#fff;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;">
        <span style="font-size:12px;font-weight:600">${w.name} [${w.cur}]</span>
        <input type="number" step="0.01" class="input skos-init-inp" data-wal="${w.id}" value="${db.initBalances[w.id] || ''}" placeholder="0.00" style="width:120px;text-align:right">
      </div>`
    ).join('');
    box.innerHTML = `<details><summary style="cursor:pointer;font-weight:700;font-size:13px;color:#1e293b">🏦 Входящее сальдо (Начальные остатки счетов и касс на 01.01.2026) — нажмите, чтобы открыть</summary>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:8px;margin-top:10px">${rowsHtml}</div>
      <div style="margin-top:10px;text-align:right"><button type="button" class="btn btn-primary" onclick="saveInitBalances()">💾 Сохранить начальные остатки</button></div>
    </details>`;
  }

  window.saveInitBalances = function () {
    if (!db.initBalances) db.initBalances = {};
    document.querySelectorAll('.skos-init-inp').forEach(inp => { db.initBalances[inp.dataset.wal] = parseFloat(inp.value) || 0; });
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    alert('Начальные остатки на 01.01.2026 сохранены!');
  };
  function renderCatEditorBox(force) {
    const orgTbl = document.getElementById('tb-orgs-set');
    if (!orgTbl || !window.db) return;
    const parentCard = orgTbl.closest('.card') || orgTbl.parentNode;
    let box = document.getElementById('skos-cat-editor-box');
    if (box && !force && box.dataset.ready === '1') return;
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-cat-editor-box';
      box.className = 'card';
      box.style.cssText = 'margin-top:14px;padding:14px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;';
      parentCard.parentNode.insertBefore(box, parentCard.nextSibling);
    }
    box.dataset.ready = '1';
    const cats = ensureCats(), groups = [...new Set(cats.map(c => c.grp))];
    const foldersHtml = groups.map(g => {
      const items = cats.filter(c => c.grp === g).map(c =>
        `<span style="display:inline-flex;align-items:center;gap:5px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:3px 8px;font-size:12px;">
          ${c.name}<button type="button" onclick="delDdsCat('${c.id}')" style="border:none;background:none;color:#dc2626;font-weight:700;cursor:pointer">✕</button>
        </span>`
      ).join('');
      return `<details open style="border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;margin-bottom:6px;background:#fcfcfd">
        <summary style="cursor:pointer;font-weight:700;font-size:12px;color:#1e40af">📁 ${g} (${cats.filter(c => c.grp === g).length})</summary>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${items}</div>
      </details>`;
    }).join('');
    box.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:8px">📑 Справочник статей ДДС по папкам (Добавление и удаление)</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <input id="new-cat-grp" list="grp-list" class="input" placeholder="Папка (выберите или введите новую)..." style="width:240px">
        <datalist id="grp-list">${groups.map(g => `<option value="${g}">`).join('')}</datalist>
        <input id="new-cat-name" class="input" placeholder="Название новой статьи..." style="flex:1;min-width:200px">
        <button type="button" class="btn btn-primary" onclick="addDdsCat()">+ Добавить статью</button>
      </div>
      <div>${foldersHtml}</div>`;
  }

  window.addDdsCat = function () {
    const grp = (document.getElementById('new-cat-grp').value || '').trim() || 'Прочее';
    const name = (document.getElementById('new-cat-name').value || '').trim();
    if (!name) return alert('Введите название статьи');
    ensureCats().push({ id: 'cat_' + Date.now(), grp, name });
    document.getElementById('new-cat-name').value = '';
    if (typeof save === 'function') save();
    renderCatEditorBox(true); syncCatSelects();
  };

  window.delDdsCat = function (id) {
    db.ddsCats = ensureCats().filter(c => c.id !== id);
    if (typeof save === 'function') save();
    renderCatEditorBox(true); syncCatSelects();
  };

  window.toggleOrgArch = function (id) {
    const o = db.orgs.find(x => x.id === id);
    if (!o) return;
    if (!o.archived) {
      const y = prompt('Укажите год закрытия ИП (в этом году оно останется в Сводке, а со следующего скроется):', '2026');
      if (y === null) return;
      o.archived = true; o.closedYear = parseInt(y, 10) || 2026;
    } else {
      o.archived = false; delete o.closedYear;
    }
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
  };

  window.editDdsRow = function (id) {
    const d = db.dds.find(x => x.id === id);
    if (!d) return;
    const nd = prompt('Дата операции:', d.date); if (nd === null) return;
    const nc = prompt('Статья ДДС:', d.cat); if (nc === null) return;
    const na = prompt('Сумма (с минусом если расход):', d.amt); if (na === null) return;
    d.date = nd.trim() || d.date; d.cat = nc.trim() || d.cat;
    const parsed = parseFloat(String(na).replace(/\s+/g, '').replace(',', '.'));
    if (!isNaN(parsed)) d.amt = parsed;
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
  };

  window.undoLastImport = function () {
    const walId = document.getElementById('dds-wal').value;
    const batches = [...new Set(db.dds.filter(d => d.batchId).map(d => d.batchId))];
    if (batches.length) {
      const lastId = batches[0];
      const cnt = db.dds.filter(d => d.batchId === lastId).length;
      if (!confirm('Удалить последнюю загрузку (' + cnt + ' операций)?')) return;
      db.dds = db.dds.filter(d => d.batchId !== lastId);
    } else {
      const cnt = db.dds.filter(d => d.wal === walId).length;
      if (cnt && !confirm('Очистить все операции по выбранному счёту (' + cnt + ' шт.)?')) return;
      db.dds = db.dds.filter(d => d.wal !== walId);
    }
    db.ddsHashes = {};
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    alert('Очищено! Теперь можно загрузить выписку заново.');
  };
    window.importBankCsv = function (ev) {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const walId = document.getElementById('dds-wal').value, batchId = 'b_' + Date.now();
    const r = new FileReader();
    r.onload = e => {
      const buf = new Uint8Array(e.target.result);
      let txt = new TextDecoder('utf-8').decode(buf);
      if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(buf);
      const lines = txt.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 1) return alert('Файл пустой');
      const sep = (lines.find(l => l.includes(';')) || lines[0]).includes(';') ? ';' : ',';
      const hdrIdx = lines.findIndex(l => l.toLowerCase().match(/сумма|списан|дебет|кредит|приход|расход/));
      const hdr = hdrIdx >= 0 ? lines[hdrIdx].split(sep).map(x => x.replace(/^"|"$/g, '').trim().toLowerCase()) : [];
      const dtCol = hdr.findIndex(h => h.includes('дата'));
      const inCol = hdr.findIndex(h => h.match(/приход|поступлен|кредит/));
      const outCol = hdr.findIndex(h => h.match(/расход|списан|дебет/));
      const sumCol = hdr.findIndex(h => h === 'сумма' || h.includes('сумма операц'));
      const num = v => parseFloat(String(v || '').replace(/\s+/g, '').replace(',', '.')) || 0;
      let added = 0, skip = 0;

      lines.slice(hdrIdx >= 0 ? hdrIdx + 1 : 0).forEach((l, idx) => {
        const c = l.split(sep).map(x => x.replace(/^"|"$/g, '').trim());
        const isAlfaLong = c.length > 15 && /^\d{2}\.\d{2}\.\d{4}$/.test(c[1]) && /^\d{2}\.\d{2}\.\d{4}$/.test(c[2]);
        const dtCell = isAlfaLong ? c[1] : ((dtCol >= 0 && /\d{2}\.\d{2}\.\d{4}/.test(c[dtCol])) ? c[dtCol] : c.find(x => /^\d{2}\.\d{2}\.\d{4}$/.test(x)));
        if (!dtCell) return;
        const desc = c.join(' '), low = desc.toLowerCase();
        if (low.includes('входящий остаток') || low.includes('исходящий остаток') || low.includes('итого')) return;

        let amt = 0;
        if (isAlfaLong) {
          const tailNums = c.slice(14).map(x => ({ v: num(x), raw: x.replace(/\s+/g, '') })).filter(x => /^[+-]?\d+([.,]\d+)?$/.test(x.raw) && x.v !== 0);
          const v14 = num(c[14]), v15 = num(c[15]);
          if (v14 > 0 && v15 === 0) amt = -v14;
          else if (v15 > 0 && v14 === 0) amt = v15;
          else if (tailNums.length) amt = tailNums[0].v;
        } else if (inCol >= 0 || outCol >= 0) {
          const vIn = inCol >= 0 ? Math.abs(num(c[inCol])) : 0;
          const vOut = outCol >= 0 ? Math.abs(num(c[outCol])) : 0;
          amt = vIn > 0 ? vIn : (vOut > 0 ? -vOut : 0);
        } else if (sumCol >= 0) {
          amt = num(c[sumCol]);
        } else {
          const nums = c.slice(1).map(x => ({ v: num(x), raw: x.replace(/\s+/g, '') })).filter(x => /^[+-]?\d+([.,]\d+)?$/.test(x.raw) && x.v !== 0);
          if (nums.length) amt = nums[nums.length - 1].v;
        }
        if (!amt) return;

        const hash = walId + '_' + dtCell + '_' + amt + '_' + desc.slice(-45) + '_' + idx;
        if (db.ddsHashes[hash]) { skip++; return; }
        db.ddsHashes[hash] = true;
        let cat = amt >= 0 ? 'Прочие поступления' : 'Прочие расходы';
        if (low.match(/вайлдберриз|wildberries/)) cat = 'Поступление от ВБ';
        else if (low.match(/озон|интернет решения/)) cat = 'Поступление от Озон';
        else if (low.match(/яндекс/)) cat = 'Поступление от ЯМ';
        else if (low.match(/1с|мойсклад|битрикс|mpstats/)) cat = 'Программное обеспечение (1С / сервисы)';
        else if (low.match(/фтс|тамож|свх/)) cat = 'Федеральная таможенная служба';
        else if (low.match(/уфнс|енс|енп|налог|взнос/)) cat = 'ЕНП';
        else if (low.match(/комисс|обслуживан|рко/)) cat = 'Комиссия РКО';
        else if (low.match(/перевод|снятие налич|выдача налич/)) cat = amt >= 0 ? 'Поступление — Перевод между счетами' : 'Выбытие — Перевод между счетами';
        db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dtCell, wal: walId, cat, amt, batchId, hash });
        added++;
      });
      ev.target.value = '';
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      alert('Загружено операций: ' + added + ', пропущено дублей: ' + skip);
    };
    r.readAsArrayBuffer(f);
  };
  const origRender = window.render;
  window.render = function () {
    if (typeof origRender === 'function') origRender();
    const yr = document.getElementById('f-yr') ? document.getElementById('f-yr').value : 'ALL';
    const mo = document.getElementById('f-mo') ? document.getElementById('f-mo').value : 'ALL';
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const initB = db.initBalances || {};

    const tbOrgs = document.getElementById('tb-orgs');
    if (tbOrgs && yr !== 'ALL') {
      const yNum = parseInt(yr, 10);
      const visNames = [...new Set(db.orgs.filter(o => !o.closedYear || o.closedYear >= yNum).map(o => o.name))];
      tbOrgs.innerHTML = visNames.map(on => {
        const os = calcPeriodStats(yr, mo, on);
        const bIds = db.orgs.filter(o => o.name === on).map(o => o.id);
        const bBal = bIds.reduce((s, id) => s + (Number(initB[id]) || 0), 0) + db.dds.filter(d => bIds.includes(d.wal)).reduce((s, d) => s + d.amt, 0);
        const nc = os.net >= 0 ? 'text-green' : 'text-red';
        return `<tr><td class="bold">${on}</td><td class="num bold">${fmtR(os.rev)}</td><td class="num text-red">${fmtR(os.ret)}</td><td class="num">${fmtR(os.ads + os.log + os.com)}</td><td class="num">${fmtR(os.cogs)}</td><td class="num">${fmtR(os.taxMonth)}</td><td class="num">${fmtR(os.expRub)}</td><td class="num bold ${nc}">${fmtR(os.net)}</td><td class="num bold">${fmtR(bBal)}</td></tr>`;
      }).join('');
    }

    const allWals = db.orgs.map(o => ({ id: o.id, name: o.name + ' (' + o.bank + ')' + (o.archived ? ' [Архив ' + (o.closedYear || '') + ']' : ''), cur: 'RUB' })).concat(db.cashWallets);
    const kpiEl = document.getElementById('dds-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = allWals.map(w => {
        const bal = (Number(initB[w.id]) || 0) + db.dds.filter(d => d.wal === w.id).reduce((s, d) => s + d.amt, 0);
        return `<div class="kpi-card"><div style="font-size:11px;color:#64748b;font-weight:700">${w.name}</div><div class="kpi-val ${w.cur === 'USD' ? 'text-green' : ''}" style="font-size:16px">${w.cur === 'USD' ? fmtU(bal) : fmtR(bal)}</div></div>`;
      }).join('');
    }

    const tbDds = document.getElementById('tb-dds');
    if (tbDds) {
      tbDds.innerHTML = db.dds.slice(0, 100).map(d => {
        const w = allWals.find(x => x.id === d.wal) || { name: d.wal, cur: 'RUB' };
        const vs = w.cur === 'USD' ? fmtU(d.amt) : fmtR(d.amt);
        const rs = fmtR(w.cur === 'USD' ? d.amt * rate : d.amt);
        return `<tr><td>${d.date}</td><td class="bold">${w.name}</td><td>${d.cat}</td><td class="num bold ${d.amt >= 0 ? 'text-green' : 'text-red'}">${vs}</td><td class="num">${rs}</td>
          <td style="white-space:nowrap"><button class="btn" onclick="editDdsRow('${d.id}')" title="Изменить">✏️</button> <button class="btn btn-danger" onclick="db.dds=db.dds.filter(x=>x.id!=='${d.id}');save();render()">✕</button></td></tr>`;
      }).join('');
    }

    const orgSet = document.getElementById('tb-orgs-set');
    if (orgSet) {
      orgSet.innerHTML = db.orgs.map(o =>
        `<tr><td class="bold">${o.name} ${o.archived ? `<span class="badge badge-amber">Закрыто (${o.closedYear || 2026})</span>` : ''}</td><td>${o.bank}</td>
        <td><button class="btn" onclick="toggleOrgArch('${o.id}')">${o.archived ? 'Вернуть' : 'В архив'}</button>
        <button class="btn btn-danger" onclick="db.orgs=db.orgs.filter(x=>x.id!=='${o.id}');save();render()">✕</button></td></tr>`
      ).join('');
    }

    const ddsWal = document.getElementById('dds-wal');
    if (ddsWal && !document.getElementById('btn-undo-imp')) {
      ddsWal.insertAdjacentHTML('afterend', ' <button id="btn-undo-imp" type="button" class="btn" style="margin-left:6px" onclick="undoLastImport()">↩️ Отменить загрузку</button>');
    }

    const txType = document.getElementById('tx-type');
    if (txType && txType.dataset.p !== '1') { txType.innerHTML = TAX_LIST.map(t => `<option value="${t}">${t}</option>`).join(''); txType.dataset.p = '1'; }
    const txKv = document.getElementById('tx-kv');
    if (txKv && txKv.dataset.p !== '1') {
      txKv.insertAdjacentHTML('beforeend', `<optgroup label="Помесячно (АУСН / НДФЛ)">${MONTHS_RU.map((m, i) => `<option value="M${String(i + 1).padStart(2, '0')}">Месяц: ${m}</option>`).join('')}</optgroup>`);
      txKv.dataset.p = '1';
    }

    const wfBox = document.getElementById('wf-box');
    if (wfBox) {
      let expByCatBox = document.getElementById('skos-exp-folders-box');
      if (!expByCatBox) {
        expByCatBox = document.createElement('div');
        expByCatBox.id = 'skos-exp-folders-box';
        expByCatBox.className = 'card';
        expByCatBox.style.cssText = 'margin-top:14px;padding:14px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;';
        wfBox.parentNode.appendChild(expByCatBox);
      }
      const cats = ensureCats(), folderTotals = {}, itemTotals = {};
      db.dds.forEach(d => {
        if (d.amt >= 0) return;
        const mDt = String(d.date || '');
        const dYr = mDt.includes('.') ? mDt.split('.')[2] : mDt.slice(0, 4);
        const dMo = mDt.includes('.') ? mDt.split('.')[1] : mDt.slice(5, 7);
        if (yr !== 'ALL' && dYr !== yr) return;
        if (mo !== 'ALL' && dMo !== mo) return;
        const wObj = allWals.find(x => x.id === d.wal);
        const rub = Math.abs(d.amt) * (wObj && wObj.cur === 'USD' ? rate : 1);
        const cObj = cats.find(c => c.name === d.cat);
        const grp = cObj ? cObj.grp : 'Прочие расходы';
        folderTotals[grp] = (folderTotals[grp] || 0) + rub;
        itemTotals[grp + '||' + d.cat] = (itemTotals[grp + '||' + d.cat] || 0) + rub;
      });
      const fKeys = Object.keys(folderTotals).sort((a, b) => folderTotals[b] - folderTotals[a]);
      expByCatBox.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:8px">📊 Сводка расходов по папкам и статьям (за выбранный период)</div>` +
        (fKeys.length ? fKeys.map(g => {
          const subs = Object.keys(itemTotals).filter(k => k.startsWith(g + '||')).map(k =>
            `<div style="display:flex;justify-content:space-between;padding:3px 0 3px 16px;font-size:12px;border-bottom:1px dashed #e2e8f0"><span>${k.split('||')[1]}</span><span class="bold text-red">${fmtR(itemTotals[k])}</span></div>`
          ).join('');
          return `<details open style="margin-bottom:6px;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px">
            <summary style="cursor:pointer;display:flex;justify-content:space-between;font-weight:700;font-size:13px"><span>📁 ${g}</span><span class="text-red">${fmtR(folderTotals[g])}</span></summary>
            <div style="margin-top:4px">${subs}</div>
          </details>`;
        }).join('') : '<div style="font-size:12px;color:#94a3b8">За выбранный период расходов в ДДС пока нет</div>');
    }

    renderInitBalancesBox();
    renderCatEditorBox(false);
    syncCatSelects();
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

  if (typeof render === 'function') render();
})();
