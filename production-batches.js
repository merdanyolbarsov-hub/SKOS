(() => {
  'use strict';
  const {num,esc,fmtU} = window;
  const count = value => value.toLocaleString('ru-RU',{maximumFractionDigits:4});
  const inputs = production => production.issues || [];

  window.toggleBomArchive = index => {
    if (window.__skosReadOnly) return;
    const card = window.ensureStore().bom[index];
    if (!card) return;
    card.arch = !card.arch;
    window.save(true);
    window.renderStkTab();
  };

  window.p4EditBom = index => {
    if (window.__skosReadOnly) return;
    const card = window.ensureStore().bom[index];
    if (!card?.items?.length) return alert('Сначала добавьте позицию в техкарту.');
    const dialog = document.createElement('dialog');
    dialog.className = 'bom-editor';
    dialog.innerHTML = `<h2>Редактировать техкарту</h2><p>${esc(card.product)}</p>
      <form>
        <label>Позиция в техкарте<select class="select" name="item">${card.items.map((item,i)=>
          `<option value="${i}">${esc(item.matName)} · норма ${count(num(item.norm))}</option>`).join('')}</select></label>
        <label>Норма на изделие<input class="input" name="norm" type="number" min="0.000001" step="any" required></label>
        <label>Цена за единицу, USD<input class="input" name="price" type="number" min="0" step="any" required></label>
        <p role="status">Выберите позицию и сохраните её изменения.</p>
        <div class="row-actions"><button type="submit" class="btn btn-primary">Сохранить позицию</button>
          <button type="button" class="btn" data-close>Закрыть</button></div>
      </form>`;
    const form = dialog.querySelector('form');
    const picker = form.querySelector('[name="item"]');
    const status = form.querySelector('[role=status]');
    function showItem() {
      const item = card.items[Number(picker.value)];
      form.elements.norm.value = num(item.norm);
      form.elements.price.value = num(item.priceUsd);
    }
    picker.onchange = () => {
      showItem();
      status.textContent = '';
    };
    form.onsubmit = event => {
      event.preventDefault();
      if (window.__skosReadOnly || window.ensureStore().bom[index] !== card) return;
      const selected = Number(picker.value);
      const item = card.items[selected];
      const norm = Number(form.elements.norm.value), priceUsd = Number(form.elements.price.value);
      if (!item || !Number.isFinite(norm) || norm<=0 || !Number.isFinite(priceUsd) || priceUsd<0) return;
      Object.assign(item,{norm,priceUsd});
      picker.options[selected].textContent = item.matName+' · норма '+count(norm);
      window.save(true);
      window.renderStkTab();
      status.textContent = 'Позиция сохранена.';
    };
    showItem();
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.onclose = () => dialog.remove();
    document.body.append(dialog);
    dialog.showModal();
  };

  window.productionTotals = production => {
    const issues = inputs(production);
    const releases = production.releases || [];
    const issued = issues.reduce((sum, row)=>sum + row.qty,0);
    const ready = releases.reduce((sum, row)=>sum + row.qty,0);
    const issuedCost = issues.reduce((sum,row)=>sum + row.materialUsd,0);
    const usedCost = releases.reduce((sum,row)=>sum + row.materialUsd,0);
    return {issued,ready,wipUsd:Math.max(0,issuedCost-usedCost),
      finishedUsd:releases.reduce((sum,row)=>sum+(row.materialUsd+row.serviceUsd)*(row.remainingQty ?? row.qty)/row.qty,0)};
  };

  window.editProductionRemainder = (orderIndex,batchIndex) => {
    if (window.__skosReadOnly) return;
    const batch=window.ensureStore().orders[orderIndex]?.production?.releases[batchIndex];
    if (!batch) return;
    const value=prompt('Фактический остаток этой партии на складе, шт.:',batch.remainingQty ?? batch.qty);
    if (value===null) return;
    const qty=Number(value);
    if (!value.trim() || !Number.isSafeInteger(qty) || qty<0 || qty>batch.qty) return alert('Укажите целое количество от 0 до '+batch.qty+'.');
    batch.remainingQty=qty;
    window.save(true);
    window.renderStkTab();
  };

  function recipe(order,store) {
    if (order.production?.recipe) return order.production.recipe;
    const lines = order.lines?.length && order.qty ? order.lines.map(line=>({
      matName:line.matName,norm:num(line.usedQty)/num(order.qty),priceUsd:num(line.priceUsd)
    })) : store.bom.find(card=>card.product===order.product)?.items || [];
    return lines.map(line=>{
      const material = store.materials.find(item=>item.name===line.matName);
      const service = material ? /^услуг/i.test(material.cat || '') : /^пошив\b|^пошив\s|^пошив$/i.test(line.matName);
      return {matName:line.matName,norm:num(line.norm),priceUsd:num(line.priceUsd),service};
    }).filter(line=>line.norm>0);
  }

  window.productionActions = (order,index) => {
    const production = order.production;
    const totals = window.productionTotals(production || {});
    const left = Math.max(0,num(order.qty)-totals.ready);
    const buttons = window.__skosReadOnly || order.status==='DONE' ? '' : [
      totals.issued < order.qty && !production?.paused && `<button class="btn" type="button" onclick="openProductionBatch(${index},'issue')">Выдать в пошив</button>`,
      totals.ready < totals.issued && !production?.paused && `<button class="btn btn-success" type="button" onclick="openProductionBatch(${index},'release')">Выпустить партию</button>`,
      `<button class="btn" type="button" onclick="toggleProductionPause(${index})">${production?.paused?'Продолжить':'Пауза'}</button>`
    ].filter(Boolean).join(' ');
    return `${production?`<div style="margin-bottom:5px">Выдано: ${count(totals.issued)} · Готово: ${count(totals.ready)} · Осталось: ${count(left)}
      ${production.paused?` · Пауза${production.pauseReason?' — '+esc(production.pauseReason):''}`:''}</div>`:''}${buttons}`;
  };

  window.toggleProductionPause = index => {
    if (window.__skosReadOnly) return;
    const order = window.ensureStore().orders[index];
    if (order?.status !== 'WIP') return;
    if (order.production?.paused) {
      order.production.paused=false;
    } else {
      const reason = prompt('Причина паузы (необязательно):','');
      if (reason === null) return;
      if (!order.production) order.production={issues:[],releases:[],legacy:true};
      order.production.paused=true;
      order.production.pauseReason=reason.trim();
    }
    window.save(true);
    window.renderStkTab();
  };

  window.openProductionBatch = (index,operation) => {
    if (window.__skosReadOnly) return;
    const store=window.ensureStore();
    const order=store.orders[index];
    if (order?.status !== 'WIP' || order.production?.paused) return;
    const isIssue=operation==='issue';
    const production=order.production || {issues:[],releases:[],legacy:true};
    const lines=recipe(order,store);
    if (!lines.length) return alert('Сначала заполните техкарту модели.');
    const initial=window.productionTotals(production);
    const max=isIssue ? num(order.qty)-initial.issued : initial.issued-initial.ready;
    if (!Number.isSafeInteger(max) || max<=0) return;
    const lastDate=[order.date,production.issues.at(-1)?.date,production.releases.at(-1)?.date].filter(Boolean).sort().at(-1);
    const materialRows = new Map(window.calcStockStats().matRows.map(row=>[row.name,row]));
    const amounts=new Map();
    for (const line of lines.filter(item=>!item.service)) {
      const entry=amounts.get(line.matName) || {norm:0,priceUsd:line.priceUsd};
      entry.norm+=line.norm;
      amounts.set(line.matName,entry);
    }
    const serviceUsd=lines.filter(item=>item.service).reduce((sum,item)=>sum+item.norm*item.priceUsd,0);
    const dialog=document.createElement('dialog');
    dialog.style.cssText='margin:auto;padding:20px;border:1px solid #c8c5bd;border-radius:12px;width:min(94vw,650px);max-height:88vh';
    const action=isIssue?'Выдать в пошив':'Выпустить партию';
    dialog.innerHTML=`<h2>${action}</h2><p style="margin:8px 0">${esc(order.product)} · максимум ${count(max)} шт.</p>
      <form style="display:grid;gap:10px">
      <label>Дата операции<input type="date" class="input" name="date" min="${esc(lastDate || '')}" value="${esc([lastDate,window.today()].filter(Boolean).sort().at(-1))}" required></label>
      <label>Количество изделий<input type="number" class="input" name="qty" min="1" max="${max}" step="1" value="${isIssue?'':max}" required></label>
      <div data-batch-preview></div><p role="status"></p>
      <div><button type="submit" class="btn btn-primary">${action}</button> <button type="button" class="btn" data-close>Отмена</button></div>
      </form>`;
    const form=dialog.querySelector('form');
    const preview=dialog.querySelector('[data-batch-preview]');
    const setPreview=()=>{
      const qty=Number(form.elements.qty.value);
      if (!Number.isSafeInteger(qty) || qty<1 || qty>max) {preview.textContent='Укажите количество для расчёта.';return;}
      if (isIssue) {
        preview.innerHTML=[...amounts].map(([name,item])=>{
          const material=materialRows.get(name);
          const need=item.norm*qty;
          return `<p>${esc(name)} · нужно ${count(need)} ${esc(material?.unit || '')} · на руках ${count(material?.qty || 0)}
            ${need>(material?.qty || 0)+1e-8?` · <strong class="text-red">Не хватает ${count(need-(material?.qty || 0))}</strong>`:''}</p>`;
        }).join('') || '<p>По техкарте есть только услуги.</p>';
      } else {
        const cost=initial.wipUsd*qty/max+serviceUsd*qty;
        preview.textContent='Себестоимость партии: '+fmtU(cost)+' · на изделие: '+fmtU(cost/qty)+'. Склад выпуска: ТМ.';
      }
    };
    form.elements.qty.oninput=setPreview;
    setPreview();
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.onclose=()=>dialog.remove();
    form.onsubmit=event=>{
      event.preventDefault();
      if (window.__skosReadOnly || !dialog.open || store.orders[index]!==order || order.status!=='WIP' ||
          order.production?.paused || (order.production && order.production!==production)) return;
      const qty=Number(form.elements.qty.value), date=form.elements.date.value;
      const current=window.productionTotals(production);
      const limit=isIssue ? num(order.qty)-current.issued : current.issued-current.ready;
      const latestDate=[order.date,production.issues.at(-1)?.date,production.releases.at(-1)?.date].filter(Boolean).sort().at(-1);
      if (!Number.isSafeInteger(qty) || qty<1 || qty>limit || !date || (latestDate && date<latestDate)) return;
      const status=dialog.querySelector('[role=status]');
      if (window.db.locked?.[date.slice(0,7)]) {status.textContent='Этот месяц закрыт.';return;}
      if (isIssue) {
        const actualRows=new Map(window.calcStockStats().matRows.map(row=>[row.name,row]));
        const materials=[];
        for (const [name,item] of amounts) {
          const source=actualRows.get(name);
          const usedQty=item.norm*qty;
          if (!source || usedQty>source.qty+1e-8) {status.textContent='Недостаточно материала: '+name;return;}
          materials.push({matName:name,usedQty,priceUsd:source.avg});
        }
        if (production.legacy && !production.issues.length &&
            store.fgStocks.some(row=>row.product===order.product) &&
            !confirm('По этой модели уже есть ручные остатки. Подтвердите, что выпускаемая партия не включена в них.')) return;
        production.issues.push({date,qty,materials,materialUsd:materials.reduce((sum,row)=>sum+row.usedQty*row.priceUsd,0)});
      } else {
        const materialUsd=current.wipUsd*qty/limit;
        production.releases.push({date,qty,materialUsd,serviceUsd:serviceUsd*qty});
        if (current.ready+qty===num(order.qty)) {
          order.status='DONE';
          order.doneDate=date;
        }
      }
      production.recipe=lines;
      order.production=production;
      dialog.close();
      window.save(true);
      window.renderStkTab();
    };
    document.body.append(dialog);
    dialog.showModal();
  };
})();
