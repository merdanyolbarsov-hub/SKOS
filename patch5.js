(function () {
  function readCsvSmart(file, callback) {
    const rUtf = new FileReader();
    rUtf.onload = function (e) {
      const txt = e.target.result || '';
      if (txt.includes('\uFFFD')) {
        const rWin = new FileReader();
        rWin.onload = ev => callback(ev.target.result || '');
        rWin.readAsText(file, 'windows-1251');
      } else {
        callback(txt);
      }
    };
    rUtf.readAsText(file, 'UTF-8');
  }

  function parseCsvLine(line, sep) {
    const res = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        res.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur.trim());
    return res;
  }

  function detectMarketplace(headers) {
    const joined = headers.join(' | ').toLowerCase();
    if (
      joined.includes('ваш sku') ||
      joined.includes('яндекс') ||
      joined.includes('размещение товаров на витрине') ||
      joined.includes('буст продаж') ||
      joined.includes('полки')
    ) return 'YM';
    if (
      joined.includes('ozon id') ||
      joined.includes('начислено за') ||
      joined.includes('тип начисления') ||
      joined.includes('доставка покупателю')
    ) return 'OZON';
    if (
      joined.includes('вайлдберриз') ||
      joined.includes('обоснование для оплаты') ||
      joined.includes('к перечислению продавцу')
    ) return 'WB';
    return null;
  }

  function findMatchingSku(bc, art) {
    const cleanBc = String(bc || '').trim().toLowerCase();
    const cleanArt = String(art || '').trim().toLowerCase();

    if (cleanBc) {
      const byBc = db.skus.find(s => String(s.bc || '').trim().toLowerCase() === cleanBc);
      if (byBc) return byBc;
    }
    if (cleanArt) {
      const byArt = db.skus.find(s => String(s.art || '').trim().toLowerCase() === cleanArt);
      if (byArt) return byArt;
    }
    if (cleanBc) {
      const byBcAsArt = db.skus.find(s => String(s.art || '').trim().toLowerCase() === cleanBc);
      if (byBcAsArt) return byBcAsArt;
    }

    const probe = cleanBc || cleanArt;
    if (probe && probe.includes('-')) {
      const basePrefix = probe.split('-').slice(0, 2).join('-');
      const byPrefix = db.skus.find(
        s => s.usd > 0 && String(s.art || '').trim().toLowerCase().startsWith(basePrefix)
      );
      if (byPrefix) return byPrefix;
    }
    return null;
  }
  window.onRepFile = function (ev) {
    const f = ev.target.files && ev.target.files;
    if (!f) return;

    readCsvSmart(f, function (rawText) {
      const lines = rawText.split(/\r?\n/).filter(l => l.trim());
      if (!lines.length) return alert('Файл пустой!');

      let sep = ';';
      for (let i = 0; i < Math.min(15, lines.length); i++) {
        if (lines[i].split(';').length > 3) { sep = ';'; break; }
        if (lines[i].split(',').length > 3) { sep = ','; break; }
      }

      let hdrIdx = 0;
      for (let i = 0; i < Math.min(30, lines.length); i++) {
        const low = lines[i].toLowerCase();
        if (low.match(/ваш sku|баркод|штрих|артикул|реализовал|доставлено|выручка|наименование товара|название товара/)) {
          hdrIdx = i;
          break;
        }
      }

      csvHdr = parseCsvLine(lines[hdrIdx], sep);
      csvRows = lines
        .slice(hdrIdx + 1)
        .map(l => parseCsvLine(l, sep))
        .filter(r => r.some(cell => cell !== ''));

      const detectedMp = detectMarketplace(csvHdr);
      const mpSel = document.getElementById('up-mp');
      if (detectedMp && mpSel) mpSel.value = detectedMp;
      const mp = mpSel ? mpSel.value : 'YM';

      const flds = [
        { k: 'bc', l: 'ШК / Ваш SKU / Баркод', h: /ваш sku|баркод|штрихкод|штрих|код товара|sku/i },
        { k: 'art', l: 'Артикул / Название товара', h: /артикул продавца|артикул|название товара|наименование товара|название/i },
        { k: 'col', l: 'Цвет', h: /цвет/i },
        { k: 'siz', l: 'Размер', h: /размер/i },
        { k: 'qty', l: 'Кол-во (шт)', h: /доставлено|реализовано экземпляров|кол-во|количество|передано/i },
        { k: 'rev', l: 'Выручка / Продажа (₽)', h: /выручка|цена покупателя|стоимость товаров|реализовал|реализовано на сумму|итого за товар|сумма продажи/i },
        { k: 'com', l: 'Комиссия / Размещение (₽)', h: /размещение товаров|вознаграждение|комиссия|обработка заказа|приём и перевод/i },
        { k: 'log', l: 'Логистика / Доставка (₽)', h: /доставк|логистик|складская обработка|магистраль|обратная логистика/i },
        { k: 'ads', l: 'Реклама / Продвижение (₽)', h: /продвижен|буст|реклам|полки|удержан|клик/i },
        { k: 'typ', l: 'Тип операции / Статус', h: /статус|тип документа|обоснование|тип начисления|операция/i }
      ];

      document.getElementById('map-fields').innerHTML = flds
        .map(fl => {
          const sv = db.colMap[mp + '_' + fl.k];
          const opts = ['<option value="">— Нет / Авто —</option>']
            .concat(
              csvHdr.map((h, i) => {
                const sel = sv === h || (!sv && fl.h.test(h)) ? 'selected' : '';
                return '<option value="' + i + '" ' + sel + '>' + h + '</option>';
              })
            )
            .join('');
          return '<div><label>' + fl.l + '</label><select id="mp-' + fl.k + '" class="select">' + opts + '</select></div>';
        })
        .join('');

      document.getElementById('map-box').classList.remove('hidden');
    });
  };
  window.runRepImport = function () {
    const org = document.getElementById('up-org').value;
    const mp = document.getElementById('up-mp').value;
    const yr = document.getElementById('up-yr').value;
    const mo = document.getElementById('up-mo').value;
    const per = yr + '-' + mo;

    if (db.locked[per]) return alert('Месяц закрыт!');

    const g = k => document.getElementById('mp-' + k).value;
    const idx = {
      bc: g('bc'), art: g('art'), col: g('col'), siz: g('siz'),
      qty: g('qty'), rev: g('rev'), com: g('com'), log: g('log'),
      ads: g('ads'), typ: g('typ')
    };

    Object.keys(idx).forEach(k => {
      if (idx[k] !== '') db.colMap[mp + '_' + k] = csvHdr[idx[k]];
    });

    const extraComCols = [], extraLogCols = [], extraAdsCols = [];
    if (mp === 'YM') {
      csvHdr.forEach((h, i) => {
        const si = String(i);
        if ([idx.com, idx.log, idx.ads, idx.rev, idx.qty].includes(si)) return;
        const low = h.toLowerCase();
        if (low.match(/размещение|обработка|перевод платежа|эквайринг|комиссия/) && low.match(/₽|руб|сумма|стоимость|итого/)) extraComCols.push(i);
        else if (low.match(/доставка|логистика|хранение|невыкуп|возврат товара/) && low.match(/₽|руб|сумма|стоимость|итого/)) extraLogCols.push(i);
        else if (low.match(/продвижение|буст|полки|бонусы|балл/) && low.match(/₽|руб|сумма|стоимость|итого/)) extraAdsCols.push(i);
      });
    }

    const num = v => parseFloat(String(v || '0').replace(/\s+/g, '').replace(',', '.')) || 0;
    let rev = 0, ret = 0, com = 0, log = 0, ads = 0, cogs = 0, sQty = 0, rQty = 0, newSkus = 0;
    const rate = getRate(per);

    csvRows.forEach(r => {
      const firstCell = String(r || '').toLowerCase();
      if (firstCell.startsWith('итого') || firstCell.startsWith('всего')) return;

      const bc = idx.bc !== '' ? String(r[idx.bc] || '').trim() : '';
      const art = idx.art !== '' ? String(r[idx.art] || '').trim() : bc;
      const col = idx.col !== '' ? String(r[idx.col] || '—').trim() : '—';
      const siz = idx.siz !== '' ? String(r[idx.siz] || '—').trim() : '—';

      const q = idx.qty !== '' ? Math.abs(num(r[idx.qty])) : 1;
      const vRev = idx.rev !== '' ? num(r[idx.rev]) : 0;

      let vCom = idx.com !== '' ? Math.abs(num(r[idx.com])) : 0;
      let vLog = idx.log !== '' ? Math.abs(num(r[idx.log])) : 0;
      let vAds = idx.ads !== '' ? Math.abs(num(r[idx.ads])) : 0;

      if (mp === 'YM') {
        extraComCols.forEach(ci => { vCom += Math.abs(num(r[ci])); });
        extraLogCols.forEach(li => { vLog += Math.abs(num(r[li])); });
        extraAdsCols.forEach(ai => { vAds += Math.abs(num(r[ai])); });
      }

      const tp = idx.typ !== '' ? String(r[idx.typ] || '').toLowerCase() : '';
      if (tp.match(/продвижен|реклам|буст|полк/) && vRev === 0) { ads += vAds || Math.abs(vRev); return; }
      if (tp.includes('отменен') && vRev === 0 && vLog === 0 && vCom === 0) return;

      const isRet = tp.match(/возврат|сторно|невыкуп/) || vRev < 0;
      let sku = findMatchingSku(bc, art);
      const itemKey = bc || art;

      if (!sku && itemKey) {
        const matchedTemplate = findMatchingSku('', itemKey);
        const uP = matchedTemplate ? matchedTemplate.usd : 0;
        const cleanArt = matchedTemplate ? matchedTemplate.art : (art || itemKey);
        sku = {
          id: 's_' + Date.now() + Math.random(),
          name: art || itemKey, art: cleanArt, col, siz, bc: itemKey,
          usd: uP, src: 'Авто из ' + mp, isNew: uP === 0
        };
        db.skus.unshift(sku);
        if (uP === 0) newSkus++;
      }

      const uRub = (sku ? sku.usd : 0) * rate;
      if (isRet) { ret += Math.abs(vRev); rQty += q; cogs -= uRub * q; }
      else { rev += Math.abs(vRev); sQty += q; cogs += uRub * q; }

      com += vCom; log += vLog; ads += vAds;

      if (itemKey && (vRev !== 0 || q > 0)) {
        db.itemSales.push({
          org, mp, yr, mo, bc: sku ? sku.bc : itemKey,
          sQty: isRet ? 0 : q, rQty: isRet ? q : 0,
          rev: isRet ? -Math.abs(vRev) : Math.abs(vRev),
          fee: vCom + vLog + vAds
        });
      }
    });

    const bo = (sQty + rQty) > 0 ? Math.round((sQty / (sQty + rQty)) * 100) : 89;
    db.reports.unshift({
      id: 'r_' + Date.now(), org, mp, yr, mo,
      rev: Math.max(0, rev - ret), ret, ads, log, com,
      cogs: Math.max(0, cogs), bo
    });

    save();
    document.getElementById('map-box').classList.add('hidden');
    render();
    alert('Отчёт ' + mp + ' загружен!' + (newSkus ? ' Новых ШК/SKU без себестоимости: ' + newSkus : ''));
  };
})();
