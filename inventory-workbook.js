(() => {
  'use strict';
  const renderExisting = window.renderStkTab;
  const esc = window.esc;
  const num = window.num;
  const money = window.fmtU;
  const tabs = [
    ['sum','Свод'], ['mat','Материалы и остатки'], ['inc','Приход материалов'],
    ['ord','Пошив и техкарты'], ['mov','Списание / НЗП'],
    ['fg','Готовый товар и брак'], ['rawdef','Брак материалов'], ['cost','Себестоимость']
  ];
  let month = window.loadViewFilter('stockMonth',''), year = window.loadViewFilter('stockYear',''), edited = '';

  const names = values => [...new Set(values.map(value=>String(value || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b, 'ru'));
  const period = date => String(date || '').slice(0,7);
  const table = (heads,rows) => `<div style="overflow-x:auto"><table><thead><tr>${heads.map(head=>`<th>${esc(head)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}">Нет записей.</td></tr>`}</tbody></table></div>`;
  const cells = values => '<tr>' + values.map(value=>'<td>'+esc(value)+'</td>').join('') + '</tr>';
  const monthField = () => `<label>Месяц <input class="input" type="month" data-stock-month value="${esc(month)}" style="width:auto"></label> <button type="button" class="btn" data-all-months>Все месяцы</button>`;

  function materialNames(store) {
    return names([...store.materials.map(row=>row.name),
      ...window.directoryRows('stockInputs').filter(row=>!row.arch).map(row=>row.name)]);
  }

  function renderMovements(store) {
    const rows = store.orders.flatMap(order => {
      if (order.production && (!order.production.legacy || order.production.issues.length)) {
        return order.production.issues.flatMap(issue=>issue.materials.map(line=>({
          date:issue.date,product:order.product,material:line.matName,qty:num(line.usedQty),
          price:num(line.priceUsd),status:'Выдано в пошив',note:order.comment
        })));
      }
      return (order.lines || []).map(line=>({
        date:order.date, completed:order.doneDate, product:order.product, material:line.matName,
        qty:num(line.usedQty), price:num(line.priceUsd), status:order.status==='DONE'?'Списано':'В работе', note:order.comment
      }));
    }).filter(row=>!month || period(row.date)===month || period(row.completed)===month)
      .sort((a,b)=>String(b.date || '').localeCompare(String(a.date || '')))
      .map(row=>cells([period(row.date),row.date,quantity(row.qty),money(row.price),money(row.qty*row.price),
        row.material,row.product,row.note || '',row.completed || '—',row.status]));
    return `<p style="margin:8px 0">Здесь видна выдача сырья по партиям и списание по завершённым заказам старого формата.</p>
      <div style="margin:10px 0">${monthField()}</div>${table(['Месяц','Дата','Количество','Цена USD','Итого USD',
        'Материал','Товар','Комментарий','Дата изготовления','Статус'],rows)}`;
  }

  const quantity = value => num(value).toLocaleString('ru-RU',{maximumFractionDigits:6});
  function renderBalances() {
    const rows = window.calcStockStats().matRows;
    return `<h3 style="margin:16px 0 8px">Остаток сырья и фурнитуры на руках</h3>
      <p>Остаток = начальный запас + приход − списано по заказам − брак материалов. Расход по незавершённым заказам показан отдельно.</p>
      ${table(['Материал','Категория','Ед.','Начальный','Приход','Списано по заказам','Брак','В пошиве','На руках'],rows.map(row =>
        cells([row.name,row.cat,row.unit,...[row.initialQty,row.receivedQty,row.orderQty,row.defectQty,row.plannedQty,row.qty].map(quantity)])))}`;
  }

  function renderMaterialDefects(store) {
    const writable = !window.__skosReadOnly;
    const options = window.calcStockStats().matRows.map(row =>
      `<option value="${esc(row.name)}">${esc(row.name)} · ${quantity(row.qty)} ${esc(row.unit)}</option>`).join('');
    return `<h3 style="margin:16px 0 8px">Списание брака сырья и фурнитуры</h3>
      <p>Вносите здесь материал, снятый со складского остатка. Брак готового изделия учитывается во вкладке «Готовый товар и брак».</p>
      ${writable?`<form class="form-grid" data-material-defect style="margin:10px 0">
        <label>Дата<input class="input" name="date" type="date" value="${esc(window.today())}" required></label>
        <label>Материал<select class="select" name="material" required><option value="">Выберите</option>${options}</select></label>
        <label>Количество<input class="input" name="qty" type="number" min="0.000001" step="any" required></label>
        <label>Причина<input class="input" name="reason" required></label>
        <button type="submit" class="btn btn-danger">Списать брак</button></form>`:''}
      ${table(['Дата','Материал','Списано','Причина',...(writable?['Действия']:[])],(store.materialDefects || []).map(row=>{
        const content = cells([row.date,row.material,quantity(row.qty),row.reason]);
        return writable?content.replace('</tr>',`<td><button type="button" class="btn" data-remove-material-defect="${esc(row.id)}">Отменить списание</button></td></tr>`):content;
      }))}${renderBalances()}`;
  }

  function costForm(store, current) {
    const materialOptions = materialNames(store);
    if (current?.material && !materialOptions.includes(current.material)) materialOptions.push(current.material);
    const modelOptions = window.getModelsOptions(current?.product || '');
    return `<form class="form-grid" id="stock-cost-form" style="margin:12px 0">
      <label>Дата<input name="date" type="date" class="input" required value="${esc(current?.date || window.today())}"></label>
      <label>Материал / услуга<select name="material" class="select" required><option value="">Выберите</option>
        ${materialOptions.map(name=>`<option value="${esc(name)}"${name===current?.material?' selected':''}>${esc(name)}</option>`).join('')}</select></label>
      <label>Товар<select name="product" class="select" required>${modelOptions}</select></label>
      <label>Количество<input name="qty" type="number" min="0.000001" step="any" class="input" required value="${esc(current?.qty ?? '')}"></label>
      <label>Цена за ед., USD<input name="price" type="number" min="0" step="any" class="input" required value="${esc(current?.price ?? '')}"></label>
      <label>Комментарий<input name="note" class="input" value="${esc(current?.note || '')}"></label>
      <button class="btn btn-primary" type="submit">${current?'Сохранить':'Добавить строку'}</button>
      ${current?'<button class="btn" type="button" data-cancel-cost>Отмена</button>':''}</form>`;
  }

  function renderCosts(store) {
    const list = store.inventoryCosts || [];
    const selected = list.find(row=>row.id===edited);
    const rows = list.filter(row=>!month || period(row.date)===month).sort((a,b)=>b.date.localeCompare(a.date));
    const groups = new Map();
    for (const row of rows) groups.set(row.product, (groups.get(row.product) || 0) + num(row.qty)*num(row.price));
    const writable = !window.__skosReadOnly;
    return `<p style="margin:8px 0">Добавляйте материалы и услуги из связанной папки справочника. Журнал считает состав себестоимости и не меняет стоимость штрихкодов или остатки склада.</p>
      <div style="margin:10px 0">${monthField()}</div>
      ${writable?costForm(store, selected):''}
      ${table(['Месяц','Дата','Количество','Цена USD','Итого USD','Материал / услуга','Товар','Комментарий',
          ...(writable?['Действия']:[])],rows.map(row=>{
        const output = cells([period(row.date),row.date,row.qty,money(row.price),money(num(row.qty)*num(row.price)),row.material,row.product,row.note]);
        return writable?output.replace('</tr>',`<td><button type="button" class="btn" data-edit-stock-cost="${esc(row.id)}">Редактировать</button>
          <button type="button" class="btn btn-danger" data-delete-stock-cost="${esc(row.id)}">Удалить</button></td></tr>`):output;
      }))}
      <h3 style="margin:16px 0 8px">Свод по моделям</h3>${table(['Товар','Итого USD'],[...groups].map(([name,total])=>cells([name,money(total)]))) }`;
  }

  function finishedBatches(store) {
    return store.orders.flatMap((order,orderIndex)=>(order.production?.releases || []).map((batch,batchIndex)=>({...batch,product:order.product,orderIndex,batchIndex})));
  }

  function renderFinishedBatches(store) {
    const batches=finishedBatches(store).sort((a,b)=>b.date.localeCompare(a.date));
    const editable=!window.__skosReadOnly;
    return `<h3 style="margin:16px 0 8px">Готовая продукция из пошива</h3>
      <p>Партии уже учтены в запасах. При отгрузке уточняйте фактический остаток в строке партии.</p>
      ${table(['Дата выпуска','Модель','Выпущено, шт.','Остаток, шт.','Склад выпуска','Себестоимость за шт., USD','Стоимость остатка, USD',...(editable?['Действия']:[])],batches.map(batch=>{
        const cost=(batch.materialUsd+batch.serviceUsd)/batch.qty;
        const left=batch.remainingQty ?? batch.qty;
        const row=cells([batch.date,batch.product,quantity(batch.qty),quantity(left),'ТМ',money(cost),money(cost*left)]);
        return editable?row.replace('</tr>',`<td><button class="btn" type="button" onclick="editProductionRemainder(${batch.orderIndex},${batch.batchIndex})">Уточнить остаток</button></td></tr>`):row;
      }))}`;
  }

  function renderMonthly(store) {
    if (!year) year = window.today().slice(0,4);
    const months = Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
    const rows = [
      ['Приход материалов',store.matIn,entry=>entry.date,entry=>num(entry.totalUsd) || num(entry.qty)*num(entry.priceUsd)],
      ['Передано в пошив',store.orders.flatMap(order=>order.production && (!order.production.legacy || order.production.issues.length)
        ? order.production.issues : [{date:order.date,materialUsd:order.totalUsd}]),entry=>entry.date,entry=>num(entry.materialUsd)],
      ['Завершённые заказы (по техкарте)',store.orders.filter(entry=>entry.status==='DONE' && !entry.production?.releases.length),entry=>entry.doneDate,entry=>num(entry.totalUsd)],
      ['Выпуск по партиям',finishedBatches(store),entry=>entry.date,entry=>entry.materialUsd+entry.serviceUsd],
      ['Готовые товары (внесённые остатки)',store.fgStocks,entry=>entry.month,entry=>num(entry.lockedUsd) || (num(entry.ruQty)+num(entry.tmQty)+num(entry.wayQty))*num(entry.unitUsd)],
      ['Брак',store.defects,entry=>entry.date,entry=>num(entry.qty)*num(entry.unitUsd)]
    ].map(([label,list,date,amount])=>{
      const sums=new Map();
      for (const entry of list) {const key=period(date(entry));sums.set(key,(sums.get(key)||0)+amount(entry));}
      return cells([label,...months.map(key=>money(sums.get(key)||0))]);
    });
    return `<div class="card" style="margin-top:12px"><div class="card-header"><div class="card-title">Движение по месяцам, USD</div>
      <label>Год <input type="number" class="input" data-stock-year min="2000" max="2100" value="${esc(year)}" style="width:100px"></label></div>
      ${table(['Операция',...months.map(key=>key.slice(5))],rows)}</div>`;
  }

  window.renderStkTab = function () {
    const target = document.getElementById('tab-stk');
    if (!target) return;
    const store = window.ensureStore(), sub = store.stkSub || 'sum';
    if (['mov','cost','rawdef'].includes(sub)) {
      target.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">🏭 Запасы, Брак и Фурнитура</div></div>
        <div data-stock-tabs style="display:flex;flex-wrap:wrap;gap:6px"></div>${sub==='mov'?renderMovements(store):sub==='cost'?renderCosts(store):renderMaterialDefects(store)}</div>`;
    } else {
      renderExisting.apply(this,arguments);
      target.querySelector('.card-header + div')?.setAttribute('data-stock-tabs','');
      if (sub==='fg') target.firstElementChild?.insertAdjacentHTML('beforeend',renderFinishedBatches(store));
      if (sub==='sum') target.insertAdjacentHTML('beforeend',renderMonthly(store));
      if (['sum','mat','inc'].includes(sub)) target.firstElementChild?.insertAdjacentHTML('beforeend',renderBalances());
    }

    const navigation = target.querySelector('[data-stock-tabs]');
    if (!navigation) return;
    navigation.innerHTML = tabs.map(([id,label])=>`<button type="button" class="btn ${id===sub?'btn-primary':''}" data-inventory-tab="${id}">${esc(label)}</button>`).join('');
    for (const button of navigation.querySelectorAll('button')) button.onclick=()=>{
      edited='';
      window.p4StkSub(button.dataset.inventoryTab);
    };
    const dateFilter=target.querySelector('[data-stock-month]');
    if (dateFilter) {
      dateFilter.onchange=()=>{month=dateFilter.value;window.saveViewFilter('stockMonth',month);window.renderStkTab();};
      target.querySelector('[data-all-months]').onclick=()=>{month='';window.saveViewFilter('stockMonth',month);window.renderStkTab();};
    }
    const yearFilter=target.querySelector('[data-stock-year]');
    if (yearFilter) yearFilter.onchange=()=>{if(yearFilter.checkValidity()){year=yearFilter.value;window.saveViewFilter('stockYear',year);window.renderStkTab();}};

    const newMaterial=target.querySelector('#sm-nm');
    if (newMaterial) {
      const suggestions=document.createElement('datalist');
      suggestions.id='stock-material-suggestions';
      const registered = new Set(store.materials.map(row=>row.name.toLocaleLowerCase('ru')));
      suggestions.append(...materialNames(store).filter(name=>!registered.has(name.toLocaleLowerCase('ru'))).map(name=>new Option(name,name)));
      newMaterial.after(suggestions);
      newMaterial.setAttribute('list',suggestions.id);
    }
    const defectForm = target.querySelector('[data-material-defect]');
    if (defectForm) defectForm.onsubmit = event => {
      event.preventDefault();
      if (window.__skosReadOnly) return;
      const {date, material, qty: inputQty, reason} = Object.fromEntries(new FormData(defectForm));
      const qty = Number(inputQty);
      const row = window.calcStockStats().matRows.find(item => item.name === material);
      if (!date || !reason.trim() || !row || !Number.isFinite(qty) || qty <= 0) return;
      if (qty > row.qty + 1e-8) return alert('На складе недостаточно материала для списания.');
      store.materialDefects ||= [];
      store.materialDefects.unshift({id:crypto.randomUUID(),date,material,qty,reason:reason.trim()});
      window.save(true);
      window.renderStkTab();
    };
    for (const button of target.querySelectorAll('[data-remove-material-defect]')) button.onclick = () => {
      if (window.__skosReadOnly || !confirm('Отменить списание и вернуть количество в остаток?')) return;
      store.materialDefects = store.materialDefects.filter(row => row.id !== button.dataset.removeMaterialDefect);
      window.save(true);
      window.renderStkTab();
    };
    const form=target.querySelector('#stock-cost-form');
    if (!form || window.__skosReadOnly) return;
    const save=()=>{edited='';window.save(true);window.renderStkTab();};
    form.onsubmit=event=>{
      event.preventDefault();
      if (window.__skosReadOnly) return;
      const values=Object.fromEntries(new FormData(form));
      const row={id:edited || crypto.randomUUID(),date:values.date,product:values.product,material:values.material,
        qty:Number(values.qty),price:Number(values.price),note:values.note.trim()};
      if (!row.date || !row.product || !row.material || !Number.isFinite(row.qty) || row.qty<=0 ||
        !Number.isFinite(row.price) || row.price<0) return;
      store.inventoryCosts ||= [];
      const index=store.inventoryCosts.findIndex(item=>item.id===row.id);
      if (index<0) store.inventoryCosts.unshift(row); else store.inventoryCosts[index]=row;
      save();
    };
    target.querySelector('[data-cancel-cost]')?.addEventListener('click',()=>{edited='';window.renderStkTab();});
    for (const button of target.querySelectorAll('[data-edit-stock-cost]')) button.onclick=()=>{
      if (window.__skosReadOnly) return;
      edited=button.dataset.editStockCost;window.renderStkTab();
    };
    for (const button of target.querySelectorAll('[data-delete-stock-cost]')) button.onclick=()=>{
      if (window.__skosReadOnly || !confirm('Удалить эту строку журнала себестоимости?')) return;
      store.inventoryCosts=store.inventoryCosts.filter(row=>row.id!==button.dataset.deleteStockCost);
      save();
    };
  };
})();
