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
    const f = ev.target.files && ev.target.files.item(0); if (!f) return;
    const walId = document.getElementById('dds-wal').value, batchId = 'b_' + Date.now();
    const r = new FileReader();
    r.onload = e => {
      const buf = new Uint8Array(e.target.result);
      let txt = new TextDecoder('utf-8').decode(buf);
      if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(buf);
      const firstLine = txt.split(/\r?\n/).find(l => l.replace(/[,;\t]/g, '').trim()) || '';
      const sep = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');

      const rows = []; let row = [], cell = '', inQ = false;
      for (let i = 0; i < txt.length; i++) {
        const ch = txt.at(i), nx = txt.at(i + 1);
        if (ch === '"') { if (inQ && nx === '"') { cell += '"'; i++; } else inQ = !inQ; }
        else if (ch === sep && !inQ) { row.push(cell.trim()); cell = ''; }
        else if ((ch === '\n' || ch === '\r') && !inQ) {
          if (ch === '\r' && nx === '\n') i++;
          row.push(cell.trim());
          if (row.some(x => x !== '')) rows.push(row);
          row = []; cell = '';
        } else cell += ch;
      }
      if (cell || row.length) { row.push(cell.trim()); if (row.some(x => x !== '')) rows.push(row); }

      const num = v => parseFloat(String(v || '').replace(/\s+/g, '').replace(',', '.')) || 0;
      const normDt = s => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('.') : s;
      let fileEndBal = 0;
      rows.forEach(c => {
        const idxEnd = c.findIndex(x => x.toLowerCase().includes('исходящий остаток') || x.toLowerCase().includes('исходящее сальдо'));
        if (idxEnd >= 0) { const n = c.slice(idxEnd + 1).map(num).find(v => v > 0); if (n) fileEndBal = n; }
      });

      const hdrIdx = rows.findIndex(c => c.join(' ').toLowerCase().match(/sum_rur|d_c|списание|зачисление|дата операции|дебет.*кредит|дата.*номер.*контрагент/));
      const hdr = hdrIdx >= 0 ? rows.at(hdrIdx).map(x => x.toLowerCase()) : [];
      const iDc = hdr.indexOf('d_c');
      const iDt = hdr.indexOf('date_oper') >= 0 ? hdr.indexOf('date_oper') : (hdr.indexOf('дата операции') >= 0 ? hdr.indexOf('дата операции') : hdr.findIndex(h => h.includes('дата')));
      const iIn = hdr.findIndex(h => h.match(/зачислен|приход|поступлен|кредит/) && !h.includes('ост') && !h.includes('обор'));
      const iOut = hdr.findIndex(h => h.match(/списан|расход|дебет/) && !h.includes('ост') && !h.includes('обор'));
      const iSum = hdr.indexOf('sum_rur') >= 0 ? hdr.indexOf('sum_rur') : hdr.findIndex(h => h === 'сумма' || h.includes('сумма операц') || h.includes('сумма док'));
      const iText = hdr.indexOf('text70') >= 0 ? hdr.indexOf('text70') : hdr.findIndex(h => h.includes('назначен'));
      const iEndCol = hdr.indexOf('tc_rur');

      let added = 0, skip = 0, sumIn = 0, sumOut = 0, toCashRub = 0;
      const startRow = hdrIdx >= 0 ? (rows.at(hdrIdx + 1) && rows.at(hdrIdx + 1).join(' ').toLowerCase().includes('id-выписки') ? hdrIdx + 2 : hdrIdx + 1) : 0;

      for (let idx = startRow; idx < rows.length; idx++) {
        const c = rows.at(idx);
        const lowFull = c.join(' ').toLowerCase();
        if (lowFull.includes('выписка по счету с')) break;
        const rawDt = (iDt >= 0 && /^(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$/.test(c.at(iDt))) ? c.at(iDt) : c.find(x => /^(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$/.test(x));
        if (!rawDt) continue;
        const dtCell = normDt(rawDt);
        if (lowFull.includes('входящий остаток') || lowFull.includes('исходящий остаток') || lowFull.includes('итого')) continue;
        if (iEndCol >= 0 && num(c.at(iEndCol))) fileEndBal = num(c.at(iEndCol));

        let amt = 0;
        if (iDc >= 0 && iSum >= 0) {
          const v = Math.abs(num(c.at(iSum))), dc = String(c.at(iDc) || '').toUpperCase();
          amt = dc === 'D' ? -v : (dc === 'C' ? v : 0);
        } else if (iIn >= 0 || iOut >= 0) {
          const vIn = iIn >= 0 ? Math.abs(num(c.at(iIn))) : 0, vOut = iOut >= 0 ? Math.abs(num(c.at(iOut))) : 0;
          amt = vIn > 0 ? vIn : (vOut > 0 ? -vOut : 0);
        } else if (iSum >= 0) amt = num(c.at(iSum));
        if (!amt) continue;

        const desc = iText >= 0 ? (c.at(iText) || c.join(' ')) : c.join(' ');
        const lowDesc = desc.toLowerCase();
        const hash = walId + '_' + dtCell + '_' + amt + '_' + desc.slice(0, 40) + '_' + idx;
        if (db.ddsHashes[hash]) { skip++; continue; }
        db.ddsHashes[hash] = true;
        if (amt > 0) sumIn += amt; else sumOut += Math.abs(amt);

        let cat = amt >= 0 ? 'Прочие поступления' : 'Прочие расходы', autoCash = false;
        if (lowFull.match(/вайлдберриз|wildberries|рвб/)) cat = 'Поступление от ВБ';
        else if (lowFull.match(/озон|интернет решения/)) cat = 'Поступление от Озон';
        else if (lowFull.match(/яндекс|спичкин/)) cat = 'Поступление от ЯМ';
        else if (lowDesc.match(/ком\.за выдачу|комисс|обслуживан|рко|пакета услуг/)) cat = 'Комиссия РКО';
        else if (lowDesc.match(/выдача наличных|снятие по карте|перевод собствен|сбп.*(мавлюда|артем|эльмира|курбан|сахет)/)) {
          cat = amt >= 0 ? 'Поступление — Перевод между счетами' : 'Выбытие — Перевод между счетами';
          if (amt < 0) autoCash = true;
        }
        else if (lowDesc.match(/уфнс|енс|енп|единый налоговый|налог|взнос/)) cat = 'ЕНП';
        else if (lowDesc.match(/1с|мойсклад|битрикс|mpstats|лицензион|подписк/)) cat = 'Программное обеспечение (1С / сервисы)';
        else if (lowDesc.match(/црпт|маркировк|сертификат|честный знак/)) cat = 'Сертификация товара';
        else if (lowDesc.match(/аренд/)) cat = 'Аренда склада';
        else if (lowDesc.match(/доставк|сдэк|пэк|деловые линии|транспорт/)) cat = 'Доставка по РФ до склада';
        else if (lowDesc.match(/за покупку|за товар|по счету|по счёту|оплата по дог/)) cat = amt >= 0 ? 'Возвраты от поставщиков' : 'Закуп товара RUB';

        db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dtCell, wal: walId, cat, amt, batchId, hash });
        if (autoCash) {
          db.dds.unshift({ id: 'd_' + Date.now() + Math.random(), date: dtCell, wal: 'c1', cat: 'Поступление — Перевод между счетами', amt: Math.abs(amt), batchId });
          toCashRub += Math.abs(amt);
        }
        added++;
      }

      ev.target.value = '';
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      const curBal = ((db.initBalances && Number(db.initBalances[walId])) || 0) + db.dds.filter(d => d.wal === walId).reduce((s, d) => s + d.amt, 0);
      const chk = fileEndBal ? (Math.abs(curBal - fileEndBal) < 1 ? ' ✅ Сходится с выпиской!' : ' ⚠️ В выписке: ' + fmtR(fileEndBal)) : '';
      const cashNote = toCashRub > 0 ? `\n💵 В «Наличные RUB (Главный)» зачислено: +${fmtR(toCashRub)}` : '';
      alert(`Загружено: ${added} (дублей: ${skip})\nПриход: +${fmtR(sumIn)} | Расход: −${fmtR(sumOut)}\nИтоговый остаток: ${fmtR(curBal)}${chk}${cashNote}`);
    };
    r.readAsArrayBuffer(f);
  };
  window.resetTestData = function () {
    if (!confirm('Очистить ВСЕ тестовые операции (выписки, начальные остатки, отчёты МП, налоги, расходы) и начать с чистого листа?\n\nНастройки юрлиц, архив ИП, папки статей и облако СОХРАНЯТСЯ.')) return;
    db.dds = []; db.ddsHashes = {}; db.initBalances = {};
    db.reports = []; db.itemSales = []; db.taxes = [];
    db.expenses = []; db.stockMoves = []; db.supOps = []; db.assets = [];
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    alert('База очищена! Теперь можно начинать чистовой учёт с выбранного года.');
  };

  window.renderExpFolderStats = function () {
    const wfBox = document.getElementById('wf-box');
    if (!wfBox || !window.db) return;
    let box = document.getElementById('skos-exp-folders-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'skos-exp-folders-box';
      box.className = 'card';
      box.style.cssText = 'margin-top:14px;padding:14px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;';
      wfBox.parentNode.appendChild(box);
    }
    const rate = typeof getRate === 'function' ? getRate() : 96.5;
    const allWals = db.orgs.map(o => ({ id: o.id, name: o.name + ' (' + o.bank + ')', cur: 'RUB' })).concat(db.cashWallets);
    const cats = ensureCats(), groups = [...new Set(cats.map(c => c.grp))];

    if (!document.getElementById('ef-wal')) {
      let yrsHtml = '<option value="ALL">Все года</option>';
      for (let y = 2020; y <= 2050; y++) yrsHtml += `<option value="${y}"${y === 2026 ? ' selected' : ''}>${y}</option>`;
      box.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:8px">📊 Детализация расходов по папкам и статьям</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <select id="ef-wal" class="select" onchange="renderExpFolderStats()"><option value="ALL">Все счета и кассы</option>${allWals.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}</select>
          <select id="ef-yr" class="select" onchange="renderExpFolderStats()">${yrsHtml}</select>
          <select id="ef-mo" class="select" onchange="renderExpFolderStats()"><option value="ALL">Все месяцы</option>${MONTHS_RU.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('')}</select>
          <select id="ef-grp" class="select" onchange="renderExpFolderStats()"><option value="ALL">Все папки</option>${groups.map(g => `<option value="${g}">📁 ${g}</option>`).join('')}</select>
          <select id="ef-cat" class="select" onchange="renderExpFolderStats()"><option value="ALL">Все статьи</option>${cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</select>
        </div>
        <div id="ef-res"></div>`;
    }

    const fWal = document.getElementById('ef-wal').value, fYr = document.getElementById('ef-yr').value;
    const fMo = document.getElementById('ef-mo').value, fGrp = document.getElementById('ef-grp').value, fCat = document.getElementById('ef-cat').value;
    const folderTotals = {}, itemTotals = {};
    let cnt = 0;

    db.dds.forEach(d => {
      if (d.amt >= 0) return;
      if (fWal !== 'ALL' && d.wal !== fWal) return;
      const mDt = String(d.date || '');
      const parts = mDt.includes('.') ? mDt.split('.') : [];
      const dYr = parts.length === 3 ? parts.at(2) : mDt.slice(0, 4);
      const dMo = parts.length === 3 ? parts.at(1) : mDt.slice(5, 7);
      if (fYr !== 'ALL' && dYr !== fYr) return;
      if (fMo !== 'ALL' && dMo !== fMo) return;
      const cObj = cats.find(c => c.name === d.cat);
      const grp = cObj ? cObj.grp : 'Прочие расходы';
      if (fGrp !== 'ALL' && grp !== fGrp) return;
      if (fCat !== 'ALL' && d.cat !== fCat) return;
      const wObj = allWals.find(x => x.id === d.wal);
      const rub = Math.abs(d.amt) * (wObj && wObj.cur === 'USD' ? rate : 1);
      folderTotals[grp] = (folderTotals[grp] || 0) + rub;
      itemTotals[grp + '||' + d.cat] = (itemTotals[grp + '||' + d.cat] || 0) + rub;
      cnt++;
    });

    const grandTotal = Object.values(folderTotals).reduce((a, b) => a + b, 0);
    const fKeys = Object.keys(folderTotals).sort((a, b) => folderTotals[b] - folderTotals[a]);
    const resEl = document.getElementById('ef-res');
    if (!resEl) return;

    resEl.innerHTML = `<div style="margin-bottom:8px;font-size:13px">Итого по фильтру: <b class="text-red">${fmtR(grandTotal)}</b> (${cnt} операций)</div>` +
      (fKeys.length ? fKeys.map(g => {
        const subs = Object.keys(itemTotals).filter(k => k.startsWith(g + '||')).map(k =>
          `<div style="display:flex;justify-content:space-between;padding:3px 0 3px 16px;font-size:12px;border-bottom:1px dashed #e2e8f0"><span>${k.split('||').at(1)}</span><span class="bold text-red">${fmtR(itemTotals[k])}</span></div>`
        ).join('');
        return `<details open style="margin-bottom:6px;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px">
          <summary style="cursor:pointer;display:flex;justify-content:space-between;font-weight:700;font-size:13px"><span>📁 ${g}</span><span class="text-red">${fmtR(folderTotals[g])}</span></summary>
          <div style="margin-top:4px">${subs}</div>
        </details>`;
      }).join('') : '<div style="font-size:12px;color:#94a3b8">По выбранным фильтрам расходов нет</div>');
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
      if (!document.getElementById('btn-reset-test')) {
        const card = orgSet.closest('.card') || orgSet.parentNode;
        card.insertAdjacentHTML('afterend', '<div id="btn-reset-test" class="card" style="margin-top:12px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600;color:#991b1b">Завершили тесты? Очистите операции и начните чистовой учёт с выбранного года:</span><button type="button" class="btn btn-danger" onclick="resetTestData()">🧹 Очистить тестовые данные</button></div>');
      }
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

    renderExpFolderStats();
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
      if (rows && rows.length && rows.payload && Object.keys(rows.payload).length) {
        Object.assign(db, rows.payload);
        db.cloud.url = url; db.cloud.key = key;
        if (typeof save === 'function') save();
        if (typeof render === 'function') render();
      }
    } catch (e) { if (manual) alert('Ошибка облака: ' + e.message); }
  };

  if (typeof render === 'function') render();
})();
