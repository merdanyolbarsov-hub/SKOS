(() => {
  'use strict';
  const num = window.num, rub = window.fmtR, esc = window.esc;

  window.renderOpiuTab = function () {
    const target = document.getElementById('tab-opiu');
    const fields = [['f-yr','Год'], ['f-mo','Месяц'], ['f-org','Юрлицо']];
    const selections = fields.map(([id])=>document.getElementById(id));
    const [year,month,org] = selections.map(select=>select.value || 'ALL');
    const totals = window.calcPeriodStats(year, month, org);
    target.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">Отчёт о прибылях и убытках</div>
      ${window.__skosReadOnly?'':'<button type="button" class="btn" onclick="tab(\'exp\')">Расходы и налоги</button>'}</div>
      <div class="form-grid" data-opiu-filters style="margin-bottom:12px"></div>
      <p style="margin-bottom:12px">Режим: ${window.db.mode==='FULL'?'Вся компания':'Только маркетплейсы'}. Движение денег — в ДДС.</p>
      ${window.getOpiuRows(totals)}</div>`;
    const filters = target.querySelector('[data-opiu-filters]');
    selections.forEach((select,i)=>{
      const label = document.createElement('label');
      label.append(fields[i][1]);
      const dropdown = document.createElement('select');
      dropdown.className = 'select';
      dropdown.replaceChildren(...Array.from(select.options, option=>option.cloneNode(true)));
      dropdown.value = select.value;
      dropdown.onchange = () => {
        select.value = dropdown.value;
        select.dispatchEvent(new Event('change'));
        window.render();
      };
      label.append(dropdown);
      filters.append(label);
    });
  };

  window.renderBalanceTab = function () {
    const target = document.getElementById('tab-balance');
    const store = window.ensureStore(), currency = new Map((window.db.cashWallets || []).map(wallet=>[wallet.id,wallet.cur]));
    const rate = window.getRate();
    const toRub = (id,amount) => num(amount) * (currency.get(id)==='USD' || (!currency.has(id) && /^c[3-6]$/.test(id)) ? rate : 1);
    const cash = Object.entries(window.db.initBalances || {}).reduce((sum,[id,amount])=>sum+toRub(id,amount),0) +
      (window.db.dds || []).reduce((sum,entry)=>sum+toRub(entry.wal,entry.amt),0);
    const stock = window.calcStockStats().totalUsd * rate;
    const fixed = store.osList.reduce((sum,item)=>{
      const full = num(item.qty || 1)*num(item.price), months = Math.max(1,num(item.months) || 24);
      return sum + Math.max(0,full - full/months*Math.min(months,num(item.passed)));
    },0);
    const tax = store.taxDebts.reduce((sum,item)=>sum+num(item.debt),0);
    const assets = cash + stock + fixed;
    const rows = [
      ['Деньги по учтённым счетам и кассам',cash],
      ['Запасы, НЗП и готовая продукция',stock],
      ['Основные средства, остаточная стоимость',fixed],
      ['Итого учтённые активы',assets],
      ['Внесённые налоговые обязательства',tax],
      ['Чистые активы по учтённым статьям',assets-tax]
    ];
    target.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">Управленческий баланс</div></div>
      <p style="margin-bottom:12px">Текущие учтённые остатки. Курс ${esc(rate)} ₽ за USD. В баланс входят только перечисленные статьи.</p>
      <table><thead><tr><th>Статья</th><th class="num">Сумма</th></tr></thead><tbody>
      ${rows.map(([label,value])=>`<tr><td>${esc(label)}</td><td class="num">${rub(value)}</td></tr>`).join('')}
      </tbody></table></div>`;
  };
})();
