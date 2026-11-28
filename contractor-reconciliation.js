(() => {
  'use strict';

  const {esc, num} = window;
  const labels = {accrual:'Начислено', payment:'Выплачено'};
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const filters = {year:'ALL',month:'ALL',party:'ALL',...window.loadViewFilter('contractors',{})};
  const currency = value => String(value || 'RUB').toUpperCase();
  const amount = (value, cur) => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value) + ' ' + cur;
  const options = (entries, selected) => entries.map(([value,label]) =>
    `<option value="${esc(value)}"${value===selected?' selected':''}>${esc(label)}</option>`).join('');
  const optionPairs = values => values.map(value=>[value,value]);

  function table(head, rows) {
    return `<div style="overflow-x:auto"><table><thead><tr>${head.map(label=>`<th>${esc(label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('') || `<tr><td colspan="${head.length}">Нет записей.</td></tr>`}</tbody></table></div>`;
  }

  const row = (values, actions='') => `<tr>${values.map(value=>`<td>${esc(value)}</td>`).join('')}${actions}</tr>`;

  function summarize(parties, operations, start, end) {
    const groups = new Map();
    const groupFor = (party, cur) => {
      const key = JSON.stringify([party,cur]);
      if (!groups.has(key)) groups.set(key,{party,cur,opening:0,accrued:0,paid:0});
      return groups.get(key);
    };
    for (const party of parties) {
      const group = groupFor(party.name,currency(party.cur));
      group.opening = num(party.initDebt);
    }
    for (const op of operations) {
      if (end && String(op.date) > end) continue;
      const group = groupFor(op.ctr,currency(op.cur));
      const accrued = op.kind === labels.accrual;
      if (start && String(op.date) < start) group.opening += num(op.amt) * (accrued ? 1 : -1);
      else group[accrued?'accrued':'paid'] += num(op.amt);
    }
    return [...groups.values()].sort((a,b)=>a.party.localeCompare(b.party,'ru') || a.cur.localeCompare(b.cur));
  }

  window.renderContractorReconciliation = function (target) {
    const store = window.ensureStore();
    const parties = window.directoryRows('contractors');
    const years = [...new Set([window.today().slice(0,4),...store.contractorOps.map(o=>String(o.date).slice(0,4))])]
      .filter(year=>/^\d{4}$/.test(year)).sort().reverse();
    const names = [...new Set([...parties.map(p=>p.name),...store.contractorOps.map(o=>o.ctr)])].filter(Boolean).sort();
    if (!years.includes(filters.year)) filters.year='ALL';
    if (!names.includes(filters.party)) filters.party='ALL';
    const inParty = item => filters.party==='ALL' || item===filters.party;
    const selected = filters.year!=='ALL';
    const start = selected ? filters.year+'-'+(filters.month==='ALL'?'01':filters.month)+'-01' : '';
    const end = selected ? filters.year+'-'+(filters.month==='ALL'?'12':filters.month)+'-31' : '';
    const history = store.contractorOps.map((op,index)=>({op,index})).filter(({op})=>inParty(op.ctr) &&
      (!start || (op.date>=start && op.date<=end))).sort((a,b)=>String(b.op.date).localeCompare(String(a.op.date)));
    const write = !window.__skosReadOnly;
    const balances = summarize(parties.filter(p=>inParty(p.name)),store.contractorOps.filter(o=>inParty(o.ctr)),start,end)
      .map(item=>{
        const endBalance = Math.round((item.opening + item.accrued - item.paid)*100)/100;
        return row([item.party,...[item.opening,item.accrued,item.paid,Math.abs(endBalance)].map(value=>amount(value,item.cur)),
          endBalance>0?'Мы должны':endBalance<0?'Аванс / сальдо в нашу пользу':'Расчёты закрыты']);
      });
    target.innerHTML = `<div class="card-header"><div class="card-title">Расчёты с контрагентами</div></div>
      <p>Журнал показывает взаиморасчёты. Расход для ОПиУ вводите в «Расходы и налоги». Фактический платёж отражайте в ДДС один раз.</p>
      <div class="form-grid" style="margin:12px 0">
        <label>Контрагент<select class="select" data-filter="party">${options([['ALL','Все контрагенты'],...optionPairs(names)],filters.party)}</select></label>
        <label>Год<select class="select" data-filter="year">${options([['ALL','Вся история'],...optionPairs(years)],filters.year)}</select></label>
        <label>Месяц<select class="select" data-filter="month"${selected?'':' disabled'}>${options([['ALL','Весь год'],...months.map((label,i)=>[String(i+1).padStart(2,'0'),label])],filters.month)}</select></label>
      </div>
      ${table(['Контрагент','Сальдо на начало','Начислено','Выплачено','Остаток','Кто должен'],balances)}
      <p style="margin:8px 0">Сальдо на начало включает стартовую сумму из справочника и операции до выбранного периода. Валюты показаны отдельно.</p>
      ${write?`<form class="form-grid" style="margin:12px 0">
        <label>Дата операции<input class="input" type="date" name="date" value="${esc(window.today())}" required></label>
        <label>Контрагент<select class="select" name="party" required>${options([['','Выберите'],...optionPairs([...new Set(parties.filter(p=>!p.arch).map(p=>p.name))])],filters.party)}</select></label>
        <label>Операция<select class="select" name="kind">${options(optionPairs(Object.values(labels)),labels.accrual)}</select></label>
        <label>Сумма<input class="input" type="number" name="amt" min="0.01" step="0.01" required></label>
        <label>Услуга с<input class="input" type="month" name="serviceFrom"></label>
        <label>Услуга по<input class="input" type="month" name="serviceTo"></label>
        <label>Комментарий<input class="input" name="note"></label>
        <button class="btn btn-primary" type="submit">Записать операцию</button>
      </form>`:''}
      <h3 style="margin:12px 0 8px">Операции за выбранный период</h3>
      ${table(['Дата','Контрагент','Операция','Сумма','Период услуги','Комментарий',...(write?['Действия']:[])],history.map(({op,index})=>
        row([op.date,op.ctr,op.kind,amount(num(op.amt),currency(op.cur)),
          [op.serviceFrom,op.serviceTo!==op.serviceFrom?op.serviceTo:''].filter(Boolean).join(' — ') || '—',op.note || ''],
          write?`<td><button class="btn" type="button" data-edit="${index}">Редактировать</button>
            <button class="btn btn-danger" type="button" data-remove="${index}">Удалить</button></td>`:''))) }`;

    for (const dropdown of target.querySelectorAll('[data-filter]')) dropdown.onchange = () => {
      filters[dropdown.dataset.filter]=dropdown.value;
      if (filters.year==='ALL') filters.month='ALL';
      window.saveViewFilter('contractors',filters);
      window.renderContractorReconciliation(target);
    };
    if (!write) return;

    const form = target.querySelector('form');
    let editing = null;
    for (const button of target.querySelectorAll('[data-edit]')) button.onclick = () => {
      if (window.__skosReadOnly) return;
      editing = store.contractorOps[Number(button.dataset.edit)];
      const select = form.elements.party;
      if (![...select.options].some(option=>option.value===editing.ctr)) select.add(new Option(editing.ctr,editing.ctr));
      const values = {...editing,party:editing.ctr};
      for (const field of ['party','kind','date','amt','serviceFrom','serviceTo','note']) form.elements[field].value=values[field] ?? '';
      select.disabled=true;
      form.querySelector('button').textContent='Сохранить изменения';
      form.elements.date.focus();
    };
    for (const button of target.querySelectorAll('[data-remove]')) button.onclick = () => {
      if (window.__skosReadOnly || !confirm('Удалить операцию из взаиморасчётов?')) return;
      store.contractorOps.splice(Number(button.dataset.remove),1);
      window.save(true);
      window.renderContractorReconciliation(target);
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (window.__skosReadOnly) return;
      const data = Object.fromEntries(new FormData(form));
      const ctr = editing?.ctr || data.party;
      const party = parties.find(item=>item.name===ctr && !item.arch);
      if (!editing && !party) return;
      const amt = Number(data.amt);
      if (!Number.isFinite(amt) || amt<=0 || !data.date || !Object.values(labels).includes(data.kind)) return;
      if (data.serviceTo && !data.serviceFrom || data.serviceTo && data.serviceTo<data.serviceFrom) return alert('Проверьте начало и конец периода услуги.');
      const operation = {ctr,amt,date:data.date,kind:data.kind,cur:currency(editing?.cur || party?.cur),
        serviceFrom:data.serviceFrom,serviceTo:data.serviceTo,note:data.note.trim()};
      const duplicate = store.contractorOps.some(item=>item!==editing && item.ctr===ctr && item.date===data.date &&
        item.kind===data.kind && num(item.amt)===amt && currency(item.cur)===operation.cur);
      if (duplicate && !confirm('Такая операция уже есть. Записать ещё одну?')) return;
      if (editing) Object.assign(editing,operation);
      else store.contractorOps.unshift(operation);
      window.save(true);
      window.renderContractorReconciliation(target);
    });
  };
})();
