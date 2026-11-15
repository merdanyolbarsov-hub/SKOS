const KEY='skos_v3_prod';
let csvRows=[],csvHdr=[];
let db={
  tab:'dash',mode:'FULL',rates:{'2026-11':96.5},locked:{},colMap:{},
  orgs:[
    {id:'o1',name:'ИП Каримов Артем',bank:'ВТБ'},
    {id:'o2',name:'ИП Джуманиязова Мавлюда',bank:'Альфа-Банк'},
    {id:'o3',name:'ИП Джуманиязова Мавлюда',bank:'Точка'},
    {id:'o4',name:'ИП Джуманиязова Эльмира',bank:'Альфа-Банк'},
    {id:'o5',name:'ИП Тыррыков Курбан',bank:'ВТБ'},
    {id:'o6',name:'ИП Керимов Сахет',bank:'ВТБ'},
    {id:'o7',name:'ООО «Скос»',bank:'Расчётный счёт ООО'}
  ],
  cashWallets:[
    {id:'c1',name:'Наличные RUB (Главный)',cur:'RUB'},
    {id:'c2',name:'Склад Москва RUB',cur:'RUB'},
    {id:'c3',name:'Наличные USD Главный',cur:'USD'},
    {id:'c4',name:'Наличные USD Китай',cur:'USD'},
    {id:'c5',name:'Наличные USD Туркменистан',cur:'USD'},
    {id:'c6',name:'Касым Туркменистан USD',cur:'USD'}
  ],
  skus:[
    {id:'s1',name:'Брюки мужские зауженные',art:'SKOS-B',col:'Базовый',siz:'—',bc:'2043192743629',usd:6.60,src:'База SKOS',isNew:false},
    {id:'s2',name:'Мужские летние штаны',art:'SKOS-LB',col:'Базовый',siz:'—',bc:'SKOS-LB',usd:5.78,src:'База SKOS',isNew:false},
    {id:'s3',name:'Костюм флисовый с замком',art:'SKOS-FKZ',col:'Базовый',siz:'—',bc:'SKOS-FKZ',usd:9.21,src:'База SKOS',isNew:false}
  ],
  accs:[],stockMoves:[],reports:[],itemSales:[],dds:[],ddsHashes:{},taxes:[],expenses:[],supOps:[],assets:[],
  cloud:{url:'',key:'',pin:'2026'}
};

function init(){
  const s=localStorage.getItem(KEY);
  if(s){try{db=Object.assign(db,JSON.parse(s));}catch(e){}}
  ['f-yr','up-yr','tx-yr','ex-yr','mn-yr'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    let h=id==='f-yr'?'<option value="ALL">Все года (2020–2050)</option>':'';
    for(let y=2020;y<=2050;y++)h+='<option value="'+y+'"'+(y===2026?' selected':'')+'>'+y+'</option>';
    el.innerHTML=h;
  });
  document.getElementById('sb-url').value=db.cloud.url||'';
  document.getElementById('sb-key').value=db.cloud.key||'';
  document.getElementById('sb-pin').value=db.cloud.pin||'2026';
  onPerChange();
}

function save(){localStorage.setItem(KEY,JSON.stringify(db));}
function fmtR(n){return Math.round(n||0).toLocaleString('ru-RU')+' ₽';}
function fmtU(n){return(n||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' $';}
function curPer(){return document.getElementById('f-yr').value+'-'+document.getElementById('f-mo').value;}
function getRate(per){return db.rates[per||curPer()]||96.5;}
function setRate(v){const p=curPer();if(db.locked[p])return alert('Месяц закрыт!');const n=parseFloat(v);if(n>0){db.rates[p]=n;save();render();}}
function onPerChange(){const p=curPer();document.getElementById('usd-rate').value=getRate(p);document.getElementById('lock-btn').textContent=db.locked[p]?'🔒 Закрыт':'🔓 Открыт';render();}
function toggleLock(){const p=curPer();db.locked[p]=!db.locked[p];save();onPerChange();}
function tab(id){db.tab=id;['dash','abc','rep','sku','stk','dds','exp','sup','set'].forEach(t=>{document.getElementById('tab-'+t).classList.toggle('hidden',t!==id);document.getElementById('nav-'+t).classList.toggle('active',t===id);});render();}
function setMode(m){db.mode=m;document.getElementById('m-full').className=m==='FULL'?'btn btn-primary':'btn';document.getElementById('m-mp').className=m==='MP'?'btn btn-primary':'btn';render();}
function openMan(){document.getElementById('m-man').classList.remove('hidden');}
function openTransferModal(){document.getElementById('m-trf').classList.remove('hidden');calcTrf();}
function closeModals(){document.getElementById('m-man').classList.add('hidden');document.getElementById('m-trf').classList.add('hidden');}

function importCostCsv(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    const lines=e.target.result.split(/\r?\n/).filter(l=>l.trim());
    const sep=lines[0].includes(';')?';':',';
    let added=0;
    lines.slice(1).forEach(l=>{
      const c=l.split(sep).map(x=>x.replace(/^"|"$/g,'').trim());
      if(c.length<3)return;
      const name=c[0],bc=c[1],usd=parseFloat(String(c[2]).replace(',','.'))||0;
      if(!bc||db.skus.some(s=>s.bc===bc))return;
      db.skus.push({id:'s_'+Date.now()+Math.random(),name:name||'Товар',art:name.split(' ')[0]||bc,col:'—',siz:'—',bc,usd,src:'Импорт Свода',isNew:usd===0});
      added++;
    });
    save();render();alert('Загружено уникальных ШК (без дублей): '+added);
  };
  r.readAsText(f,'UTF-8');
}
function dedupSkus(){const seen=new Set(),b=db.skus.length;db.skus=db.skus.filter(s=>{if(seen.has(s.bc))return false;seen.add(s.bc);return true;});save();render();alert('Удалено дублей: '+(b-db.skus.length));}
function searchSku(q){
  const v=q.trim().toLowerCase(),box=document.getElementById('sku-q-res');
  if(!v){box.innerHTML='';return;}
  const f=db.skus.find(s=>s.bc.toLowerCase().includes(v)||s.art.toLowerCase().includes(v)||s.name.toLowerCase().includes(v));
  box.innerHTML=f?'<span class="badge badge-green">'+f.name+' ('+f.art+') • '+fmtU(f.usd)+' / '+fmtR(f.usd*getRate())+'</span>':'<span class="badge badge-red">Не найдено</span>';
}
function onRepFile(ev){
  const f=ev.target.files;if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    const lines=e.target.result.split(/\r?\n/).filter(l=>l.trim());
    const sep=lines.includes(';')?';':',';
    let hdrIdx=0;
    for(let i=0;i<Math.min(25,lines.length);i++){
      if(lines[i].toLowerCase().match(/баркод|штрих|sku|артикул|реализовал|доставлено|выручка/)){hdrIdx=i;break;}
    }
    csvHdr=lines[hdrIdx].split(sep).map(h=>h.replace(/^"|"$/g,'').trim());
    csvRows=lines.slice(hdrIdx+1).map(l=>l.split(sep).map(c=>c.replace(/^"|"$/g,'').trim()));
    const mp=document.getElementById('up-mp').value;
    const flds=[
      {k:'bc',l:'ШК / Баркод / Ваш SKU',h:/баркод|штрих|ваш sku|sku/i},
      {k:'art',l:'Артикул / Название',h:/артикул|наименование|название/i},
      {k:'col',l:'Цвет',h:/цвет/i},
      {k:'siz',l:'Размер',h:/размер/i},
      {k:'qty',l:'Кол-во (шт)',h:/кол-во|реализовано экземпляров|доставлено|возвращено/i},
      {k:'rev',l:'Выручка / Продажа (₽)',h:/реализовал|реализовано на сумму|стоимость всех|выручка|продажа/i},
      {k:'com',l:'Комиссия / Вознаграждение',h:/вознаграждение|комиссия/i},
      {k:'log',l:'Логистика / Доставка',h:/доставк|логистик/i},
      {k:'ads',l:'Реклама / Удержания',h:/удержан|продвижен|реклам|клик/i},
      {k:'typ',l:'Тип документа / Обоснование',h:/тип документа|обоснование|тип начисления/i}
    ];
    document.getElementById('map-fields').innerHTML=flds.map(fl=>{
      const sv=db.colMap[mp+'_'+fl.k];
      const opts=['<option value="">— Нет —</option>'].concat(csvHdr.map((h,i)=>'<option value="'+i+'" '+((sv===h||(!sv&&fl.h.test(h)))?'selected':'')+'>'+h+'</option>')).join('');
      return '<div><label>'+fl.l+'</label><select id="mp-'+fl.k+'" class="select">'+opts+'</select></div>';
    }).join('');
    document.getElementById('map-box').classList.remove('hidden');
  };
  r.readAsText(f,'UTF-8');
}

function runRepImport(){
  const org=document.getElementById('up-org').value,mp=document.getElementById('up-mp').value,yr=document.getElementById('up-yr').value,mo=document.getElementById('up-mo').value,per=yr+'-'+mo;
  if(db.locked[per])return alert('Месяц закрыт!');
  const g=k=>document.getElementById('mp-'+k).value;
  const idx={bc:g('bc'),art:g('art'),col:g('col'),siz:g('siz'),qty:g('qty'),rev:g('rev'),com:g('com'),log:g('log'),ads:g('ads'),typ:g('typ')};
  Object.keys(idx).forEach(k=>{if(idx[k]!=='')db.colMap[mp+'_'+k]=csvHdr[idx[k]];});
  const num=v=>parseFloat(String(v||'0').replace(/\s+/g,'').replace(',','.'))||0;
  let rev=0,ret=0,com=0,log=0,ads=0,cogs=0,sQty=0,rQty=0,newSkus=0;
  const rate=getRate(per);
  csvRows.forEach(r=>{
    const bc=idx.bc!==''?r[idx.bc]:'',art=idx.art!==''?r[idx.art]:bc,col=idx.col!==''?r[idx.col]:'—',siz=idx.siz!==''?r[idx.siz]:'—';
    const q=idx.qty!==''?Math.abs(num(r[idx.qty])):1,vRev=idx.rev!==''?num(r[idx.rev]):0,vCom=idx.com!==''?Math.abs(num(r[idx.com])):0,vLog=idx.log!==''?Math.abs(num(r[idx.log])):0,vAds=idx.ads!==''?Math.abs(num(r[idx.ads])):0;
    const tp=idx.typ!==''?String(r[idx.typ]).toLowerCase():'';
    if(tp.includes('продвижен')||tp.includes('реклам')){ads+=vAds||Math.abs(vRev);return;}
    const isRet=tp.includes('возврат')||tp.includes('сторно')||vRev<0;
    let sku=bc?db.skus.find(s=>s.bc===bc||s.art===bc):null;
    if(!sku&&bc){
      const sm=db.skus.find(s=>s.art&&art&&s.art.toLowerCase()===art.toLowerCase()&&s.usd>0);
      const uP=sm?sm.usd:0;
      sku={id:'s_'+Date.now()+Math.random(),name:art||bc,art:art||bc,col,siz,bc,usd:uP,src:'Авто из '+mp,isNew:uP===0};
      db.skus.unshift(sku);if(uP===0)newSkus++;
    }
    const uRub=(sku?sku.usd:0)*rate;
    if(isRet){ret+=Math.abs(vRev);rQty+=q;cogs-=uRub*q;}else{rev+=Math.abs(vRev);sQty+=q;cogs+=uRub*q;}
    com+=vCom;log+=vLog;ads+=vAds;
    if(bc&&(vRev!==0||q>0))db.itemSales.push({org,mp,yr,mo,bc,sQty:isRet?0:q,rQty:isRet?q:0,rev:isRet?-Math.abs(vRev):Math.abs(vRev),fee:vCom+vLog+vAds});
  });
  const bo=(sQty+rQty)>0?Math.round((sQty/(sQty+rQty))*100):89;
  db.reports.unshift({id:'r_'+Date.now(),org,mp,yr,mo,rev:Math.max(0,rev-ret),ret,ads,log,com,cogs:Math.max(0,cogs),bo});
  save();document.getElementById('map-box').classList.add('hidden');render();
  alert('Отчёт '+mp+' загружен!'+(newSkus?' Новых ШК без цены: '+newSkus:''));
}

function importBankCsv(ev){
  const f=ev.target.files;if(!f)return;
  const walId=document.getElementById('dds-wal').value;
  const r=new FileReader();
  r.onload=e=>{
    const lines=e.target.result.split(/\r?\n/).filter(l=>l.trim());
    const sep=lines.includes(';')?';':',';
    let added=0,skip=0;
    lines.slice(1).forEach(l=>{
      const c=l.split(sep).map(x=>x.replace(/^"|"$/g,'').trim());
      if(c.length<3)return;
      const dt=c,desc=c.join(' '),low=desc.toLowerCase();
      let amt=0;
      for(let i=1;i<c.length;i++){const n=parseFloat(c[i].replace(/\s+/g,'').replace(',','.'));if(!isNaN(n)&&n!==0){amt=n;break;}}
      if(!amt)return;
      const hash=walId+'_'+dt+'_'+amt+'_'+desc.slice(0,25);
      if(db.ddsHashes[hash]){skip++;return;}
      db.ddsHashes[hash]=true;
      let cat='Банковская операция';
      if(low.match(/вайлдберриз|wildberries|озон|интернет решения|яндекс/))cat='Поступление от МП';
      else if(low.match(/уфнс|енс|налог|взнос/))cat='Оплата налогов';
      else if(low.match(/зарплат|аванс/))cat='Зарплата (ФОТ)';
      else if(low.match(/комисс|обслуживан|конвертац/))cat='Комиссия банка / конвертация';
      else if(low.match(/снятие налич|выдача налич|собственн|физлиц/))cat='Перевод в Наличные Главный';
      db.dds.unshift({id:'d_'+Date.now()+Math.random(),date:dt,wal:walId,cat,amt});
      if(cat==='Перевод в Наличные Главный')db.dds.unshift({id:'d_'+Date.now()+Math.random(),date:dt,wal:'c1',cat:'Поступление из банка',amt:Math.abs(amt)});
      added++;
    });
    save();render();alert('Загружено: '+added+', пропущено дублей: '+skip);
  };
  r.readAsText(f,'UTF-8');
}

function calcTrf(){
  const a=parseFloat(document.getElementById('tr-amt').value)||0,f=parseFloat(document.getElementById('tr-fee').value)||0,r=parseFloat(document.getElementById('tr-rate').value)||1;
  const from=document.getElementById('tr-from').value,to=document.getElementById('tr-to').value;
  const isF=['c3','c4','c5','c6'].includes(from),isT=['c3','c4','c5','c6'].includes(to);
  let res=Math.max(0,a-f);
  if(!isF&&isT&&r>1)res=(a-f)/r;else if(isF&&!isT&&r>1)res=(a-f)*r;
  document.getElementById('tr-res').value=res.toFixed(2)+(isT?' $':' ₽');
}

function saveTransfer(e){
  e.preventDefault();
  const dt=document.getElementById('tr-date').value,from=document.getElementById('tr-from').value,to=document.getElementById('tr-to').value;
  const a=parseFloat(document.getElementById('tr-amt').value)||0,f=parseFloat(document.getElementById('tr-fee').value)||0,r=parseFloat(document.getElementById('tr-rate').value)||1;
  const isF=['c3','c4','c5','c6'].includes(from),isT=['c3','c4','c5','c6'].includes(to);
  let res=Math.max(0,a-f);
  if(!isF&&isT&&r>1)res=(a-f)/r;else if(isF&&!isT&&r>1)res=(a-f)*r;
  db.dds.unshift({id:'d_'+Date.now()+1,date:dt,wal:from,cat:'Перевод / Конвертация (исх.)',amt:-a});
  db.dds.unshift({id:'d_'+Date.now()+2,date:dt,wal:to,cat:'Перевод / Конвертация (вх.)',amt:res});
  if(f>0)db.dds.unshift({id:'d_'+Date.now()+3,date:dt,wal:from,cat:'Комиссия за обмен',amt:0});
  save();closeModals();render();
}
function fillSelects(){
  const orgNames=[...new Set(db.orgs.map(o=>o.name))];
  ['f-org','up-org','tx-org','ex-org','mn-org'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;
    let h=id==='f-org'?'<option value="ALL">Все юрлица (5 ИП + ООО)</option>':'';
    orgNames.forEach(n=>h+='<option value="'+n+'">'+n+'</option>');
    el.innerHTML=h;if(cur)el.value=cur;
  });
  const allWals=db.orgs.map(o=>({id:o.id,name:o.name+' ('+o.bank+')',cur:'RUB'})).concat(db.cashWallets);
  ['dds-wal','d-wal','tr-from','tr-to'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;
    el.innerHTML=allWals.map(w=>'<option value="'+w.id+'">'+w.name+' ['+w.cur+']</option>').join('');
    if(cur)el.value=cur;
  });
}

function calcPeriodStats(yr,mo,orgF){
  const rate=getRate((yr==='ALL'?'2026':yr)+'-'+(mo==='ALL'?'11':mo));
  const reps=db.reports.filter(r=>(yr==='ALL'||r.yr===yr)&&(mo==='ALL'||r.mo===mo)&&(orgF==='ALL'||r.org===orgF));
  let rev=0,ret=0,ads=0,log=0,com=0,cogs=0,boSum=0;
  reps.forEach(r=>{rev+=r.rev;ret+=r.ret;ads+=r.ads;log+=r.log;com+=r.com;cogs+=r.cogs;boSum+=r.bo;});
  const mpProf=rev-ads-log-com-cogs;
  let taxMonth=0;
  db.taxes.forEach(t=>{
    if((yr==='ALL'||t.yr===yr)&&(orgF==='ALL'||t.org===orgF)){
      const kvM={1:['01','02','03'],2:['04','05','06'],3:['07','08','09'],4:['10','11','12']}[t.kv]||[];
      if(mo==='ALL')taxMonth+=t.amt;else if(kvM.includes(mo))taxMonth+=(t.amt/3);
    }
  });
  let expRub=0;
  db.expenses.forEach(e=>{if((yr==='ALL'||e.yr===yr)&&(mo==='ALL'||e.mo===mo)&&(orgF==='ALL'||e.org===orgF))expRub+=e.cur==='USD'?e.amt*rate:e.amt;});
  const depMonth=db.assets.reduce((s,a)=>s+(a.cost/(a.mos||24)),0)*(mo==='ALL'?12:1);
  const defectRub=db.stockMoves.filter(m=>m.op==='DEFECT').reduce((s,m)=>s+(m.qty*m.usd*rate),0);
  const net=db.mode==='FULL'?(mpProf-taxMonth-expRub-depMonth-defectRub):mpProf;
  return{rev,ret,ads,log,com,cogs,mpProf,taxMonth,expRub,depMonth,defectRub,net,bo:reps.length?Math.round(boSum/reps.length):0};
}

function render(){
  fillSelects();
  const yr=document.getElementById('f-yr').value,mo=document.getElementById('f-mo').value,orgF=document.getElementById('f-org').value,cmp=document.getElementById('f-cmp').value;
  const rate=getRate(yr+'-'+mo);document.getElementById('h-rate').textContent=rate+' ₽/$';
  const st=calcPeriodStats(yr,mo,orgF);
  let pYr=yr,pMo=mo;
  if(cmp==='YOY'&&yr!=='ALL')pYr=String(Number(yr)-1);
  else if(cmp==='MOM'&&mo!=='ALL'){const mN=Number(mo);if(mN===1){pMo='12';if(yr!=='ALL')pYr=String(Number(yr)-1);}else pMo=String(mN-1).padStart(2,'0');}
  const prev=calcPeriodStats(pYr,pMo,orgF);
  const diffPct=prev.net!==0?(((st.net-prev.net)/Math.abs(prev.net))*100).toFixed(1):'0.0';

  document.getElementById('k-rev').textContent=fmtR(st.rev);document.getElementById('k-ret').textContent='Возвраты: '+fmtR(st.ret);document.getElementById('k-bo').textContent='Выкуп '+st.bo+'%';
  const kp=document.getElementById('k-prof');kp.textContent=fmtR(st.net);kp.className='kpi-val '+(st.net>=0?'text-green':'text-red');
  document.getElementById('k-mar').textContent='Маржа '+(st.rev>0?((st.net/st.rev)*100).toFixed(1):'0.0')+'%';
  document.getElementById('k-cmp').textContent=(cmp==='MOM'?'К прошл. мес.: ':'К прошл. году: ')+(Number(diffPct)>=0?'+':'')+diffPct+'%';
  document.getElementById('k-ads').textContent=fmtR(st.ads);document.getElementById('k-drr').textContent='ДРР '+(st.rev>0?((st.ads/st.rev)*100).toFixed(1):'0.0')+'%';
  document.getElementById('k-fee').textContent=fmtR(st.log+st.com);

  let frzUsd=0;db.stockMoves.forEach(m=>{if(['FAB_IN','TO_WAY','TO_RF','REWORK_OUT'].includes(m.op))frzUsd+=m.qty*m.usd;else if(m.op==='DEFECT')frzUsd-=m.qty*m.usd;});
  document.getElementById('k-frz').textContent=fmtR(Math.max(0,frzUsd)*rate);document.getElementById('k-frz-u').textContent='В валюте: '+fmtU(Math.max(0,frzUsd));

  const orgNames=[...new Set(db.orgs.map(o=>o.name))];
  document.getElementById('tb-orgs').innerHTML=orgNames.map(on=>{
    const os=calcPeriodStats(yr,mo,on);
    const bIds=db.orgs.filter(o=>o.name===on).map(o=>o.id);
    const bBal=db.dds.filter(d=>bIds.includes(d.wal)).reduce((s,d)=>s+d.amt,0);
    return '<tr><td class="bold">'+on+'</td><td class="num bold">'+fmtR(os.rev)+'</td><td class="num text-red">'+fmtR(os.ret)+'</td><td class="num">'+fmtR(os.ads+os.log+os.com)+'</td><td class="num">'+fmtR(os.cogs)+'</td><td class="num">'+fmtR(os.taxMonth)+'</td><td class="num">'+fmtR(os.expRub)+'</td><td class="num bold '+(os.net>=0?'text-green':'text-red')+'">'+fmtR(os.net)+'</td><td class="num bold">'+fmtR(bBal)+'</td></tr>';
  }).join('');

  document.getElementById('tb-mps').innerHTML=['WB','OZON','YM'].map(m=>{
    const sub=db.reports.filter(r=>(yr==='ALL'||r.yr===yr)&&(mo==='ALL'||r.mo===mo)&&(orgF==='ALL'||r.org===orgF)&&r.mp===m);
    const r=sub.reduce((a,b)=>a+b.rev,0),rt=sub.reduce((a,b)=>a+b.ret,0),ad=sub.reduce((a,b)=>a+b.ads,0),lg=sub.reduce((a,b)=>a+b.log,0),cm=sub.reduce((a,b)=>a+b.com,0),cg=sub.reduce((a,b)=>a+b.cogs,0);
    const pr=r-ad-lg-cm-cg,bo=sub.length?Math.round(sub.reduce((a,b)=>a+b.bo,0)/sub.length)+'%':'—';
    return '<tr><td class="bold">'+m+'</td><td class="num bold">'+fmtR(r)+'</td><td class="num text-red">'+fmtR(rt)+'</td><td class="num">'+fmtR(ad)+'</td><td class="num">'+fmtR(lg)+'</td><td class="num">'+fmtR(cm)+'</td><td class="num">'+fmtR(cg)+'</td><td class="num">'+bo+'</td><td class="num bold '+(pr>=0?'text-green':'text-red')+'">'+fmtR(pr)+'</td></tr>';
  }).join('');

  let wf='<div class="wf-row"><span>1. Чистая выручка маркетплейсов</span><span class="bold">'+fmtR(st.rev)+'</span></div><div class="wf-row"><span>− Комиссия, логистика и услуги</span><span class="text-red">−'+fmtR(st.com+st.log)+'</span></div><div class="wf-row"><span>− Реклама и выкупы</span><span class="text-red">−'+fmtR(st.ads)+'</span></div><div class="wf-row"><span>− Себестоимость товаров</span><span class="text-red">−'+fmtR(st.cogs)+'</span></div><div class="wf-row wf-sub"><span>= Маржинальная прибыль площадок</span><span>'+fmtR(st.mpProf)+'</span></div>';
  if(db.mode==='FULL')wf+='<div class="wf-row"><span>− Налоги (1/3 кв.)</span><span class="text-red">−'+fmtR(st.taxMonth)+'</span></div><div class="wf-row"><span>− Операционные расходы (Таможня, 1С, Аренда, Сырьё, ФОТ)</span><span class="text-red">−'+fmtR(st.expRub)+'</span></div><div class="wf-row"><span>− Амортизация и Брак</span><span class="text-red">−'+fmtR(st.depMonth+st.defectRub)+'</span></div><div class="wf-row wf-tot '+(st.net<0?'neg':'')+'"><span>= ЧИСТАЯ ПРИБЫЛЬ КОМПАНИИ</span><span>'+fmtR(st.net)+'</span></div>';
  document.getElementById('wf-box').innerHTML=wf;
  renderAbc();renderLists();
}

function renderAbc(){
  const mode=document.getElementById('abc-mode').value,yr=document.getElementById('f-yr').value,mo=document.getElementById('f-mo').value,orgF=document.getElementById('f-org').value;
  const rate=getRate((yr==='ALL'?'2026':yr)+'-'+(mo==='ALL'?'11':mo));
  const items=db.itemSales.filter(i=>(yr==='ALL'||i.yr===yr)&&(mo==='ALL'||i.mo===mo)&&(orgF==='ALL'||i.org===orgF));
  const grp={};
  items.forEach(it=>{
    const s=db.skus.find(x=>x.bc===it.bc||x.art===it.bc)||{name:it.bc,art:it.bc,col:'—',siz:'—',usd:0};
    let k=s.art,det='Модель: '+s.art;
    if(mode==='COLOR'){k=s.art+'_'+s.col;det=s.art+' • Цвет: '+s.col;}
    else if(mode==='SIZE'){k=s.siz;det='Размер: '+s.siz;}
    else if(mode==='SKU'){k=s.bc;det=s.art+' • '+s.col+' • '+s.siz+' • ШК: '+s.bc;}
    if(!grp[k])grp[k]={tit:mode==='SIZE'?('Размер '+s.siz):s.name,det,sq:0,rq:0,rev:0,fee:0,cog:0};
    const netQ=it.sQty-it.rQty;
    grp[k].sq+=netQ;grp[k].rq+=it.rQty;grp[k].rev+=it.rev;grp[k].fee+=it.fee;grp[k].cog+=netQ*(s.usd*rate);
  });
  const arr=Object.values(grp).map(g=>{g.prof=g.rev-g.fee-g.cog;return g;}).sort((a,b)=>b.prof-a.prof);
  const totP=arr.reduce((s,x)=>s+Math.max(0,x.prof),0),totR=arr.reduce((s,x)=>s+Math.max(0,x.rev),0);
  const revRank=[...arr].sort((a,b)=>b.rev-a.rev);
  let cR=0,rCls={};
  revRank.forEach(x=>{cR+=totR>0?(Math.max(0,x.rev)/totR)*100:0;rCls[x.tit+x.det]=cR<=80?'A':(cR<=95?'B':'C');});
  let cP=0;
  document.getElementById('tb-abc').innerHTML=arr.length?arr.map(g=>{
    const sh=totP>0?(Math.max(0,g.prof)/totP)*100:0;cP+=sh;
    const pC=(g.prof>0&&cP<=80)?'A':((g.prof>0&&cP<=95)?'B':'C'),sC=rCls[g.tit+g.det]||'C';
    return '<tr><td><span class="badge '+(pC==='A'?'badge-green':pC==='B'?'badge-amber':'badge-red')+'">Приб: '+pC+'</span> <span class="badge badge-blue">Прод: '+sC+'</span></td><td class="bold">'+g.tit+'</td><td>'+g.det+'</td><td class="num">'+g.sq+'</td><td class="num text-red">'+g.rq+'</td><td class="num">'+fmtR(g.rev)+'</td><td class="num">'+fmtR(g.cog)+'</td><td class="num bold '+(g.prof>=0?'text-green':'text-red')+'">'+fmtR(g.prof)+'</td><td class="num">'+sh.toFixed(1)+'%</td></tr>';
  }).join(''):'<tr><td colspan="9" style="text-align:center;padding:16px;color:#94a3b8">Загрузите отчёты WB/Ozon/ЯМ для построения ABC-анализа</td></tr>';
}
function updateSkuUsd(id,val){const s=db.skus.find(x=>x.id===id);if(!s)return;s.usd=parseFloat(val)||0;s.isNew=s.usd===0;recalcReportsCogs();save();render();}
function applyModelUsd(art,usd){db.skus.forEach(s=>{if(s.art===art){s.usd=usd;s.isNew=usd===0;}});recalcReportsCogs();save();render();alert('Цена '+fmtU(usd)+' применена ко всей модели '+art);}
function recalcReportsCogs(){
  db.reports.forEach(r=>{
    const rate=getRate(r.yr+'-'+r.mo),its=db.itemSales.filter(i=>i.org===r.org&&i.mp===r.mp&&i.yr===r.yr&&i.mo===r.mo);
    if(its.length)r.cogs=Math.max(0,its.reduce((sum,it)=>{const s=db.skus.find(x=>x.bc===it.bc||x.art===it.bc);return sum+(it.sQty-it.rQty)*((s?s.usd:0)*rate);},0));
  });
}

function renderLists(){
  const rate=getRate();
  const newCnt=db.skus.filter(s=>s.isNew||s.usd===0).length;
  const al=document.getElementById('new-sku-alert');
  if(al){al.classList.toggle('hidden',newCnt===0);al.textContent='⚠️ Новых ШК без себестоимости: '+newCnt;}

  document.getElementById('tb-skus').innerHTML=db.skus.map(s=>{
    const rc=(s.isNew||s.usd===0)?'row-new-sku':'';
    const bc=s.isNew?'badge-amber':'badge-blue';
    return '<tr class="'+rc+'"><td class="bold">'+s.name+'</td><td>'+s.art+'</td><td>'+s.col+'</td><td>'+s.siz+'</td><td>'+s.bc+'</td>' +
      '<td><span class="badge '+bc+'">'+s.src+'</span></td>' +
      '<td class="num" style="background:#ecfdf5"><input type="number" step="0.01" class="inline-edit" value="'+s.usd+'" onchange="updateSkuUsd(\''+s.id+'\',this.value)"> $</td>' +
      '<td class="num bold" style="background:#eff6ff;color:#1e40af">'+fmtR(s.usd*rate)+'</td>' +
      '<td><button class="btn" onclick="applyModelUsd(\''+s.art+'\','+s.usd+')">На всю модель</button></td>' +
      '<td><button class="btn btn-danger" onclick="db.skus=db.skus.filter(x=>x.id!==\''+s.id+'\');save();render()">✕</button></td></tr>';
  }).join('');

  document.getElementById('rep-cnt').textContent=db.reports.length+' отчётов';
  document.getElementById('tb-reps').innerHTML=db.reports.map(r=>{
    const p=://log-r.com-r.cogs;
    const pc=p>=0?'text-green':'text-red';
    return '<tr><td>'+r.yr+'-'+r.mo+'</td><td class="bold">'+r.org+'</td><td>'+r.mp+'</td>' +
      '<td class="num">'+fmtR(r.rev)+'</td><td class="num text-red">'+fmtR(r.ret)+'</td>' +
      '<td class="num">'+fmtR(r.ads)+'</td><td class="num">'+fmtR(r.log)+'</td><td class="num">'+fmtR(r.com)+'</td><td class="num">'+fmtR(r.cogs)+'</td>' +
      '<td class="num bold '+pc+'">'+fmtR(p)+'</td>' +
      '<td><button class="btn btn-danger" onclick="db.reports=db.reports.filter(x=>x.id!==\''+r.id+'\');save();render()">✕</button></td></tr>';
  }).join('');

  document.getElementById('tb-accs').innerHTML=db.accs.map(a=>
    '<tr><td class="bold">'+a.art+'</td><td>'+a.name+'</td><td class="num">'+a.qty+'</td><td class="num">'+fmtU(a.usd)+'</td>' +
    '<td class="num bold text-green">'+fmtU(a.qty*a.usd)+'</td>' +
    '<td><button class="btn btn-danger" onclick="db.accs=db.accs.filter(x=>x.id!==\''+a.id+'\');save();render()">✕</button></td></tr>'
  ).join('');

  const opNames={FAB_IN:'🧵 Пошив на фабрике',TO_WAY:'🚚 Отправка в путь',TO_RF:'🏢 Приёмка склад РФ',DEFECT:'❌ Брак (убыток)',REWORK_IN:'🔧 В переработку',REWORK_OUT:'✅ Из переработки на склад'};
  document.getElementById('tb-stk').innerHTML=db.stockMoves.map(m=>
    '<tr><td class="bold">'+m.dt+'</td><td class="bold">'+m.item+'</td><td>'+(opNames[m.op]||m.op)+'</td>' +
    '<td class="num">'+m.qty+'</td><td class="num">'+fmtU(m.usd)+'</td><td class="num bold">'+fmtR(m.qty*m.usd*rate)+'</td>' +
    '<td><button class="btn btn-danger" onclick="db.stockMoves=db.stockMoves.filter(x=>x.id!==\''+m.id+'\');save();render()">✕</button></td></tr>'
  ).join('');

  const allWals=db.orgs.map(o=>({id:o.id,name:o.name+' ('+o.bank+')',cur:'RUB'})).concat(db.cashWallets);
  document.getElementById('dds-kpis').innerHTML=allWals.map(w=>{
    const bal=db.dds.filter(d=>d.wal===w.id).reduce((s,d)=>s+d.amt,0);
    const vc=w.cur==='USD'?'text-green':'';
    const vs=w.cur==='USD'?fmtU(bal):fmtR(bal);
    return '<div class="kpi-card"><div style="font-size:11px;color:#64748b;font-weight:700">'+w.name+'</div><div class="kpi-val '+vc+'" style="font-size:16px">'+vs+'</div></div>';
  }).join('');

  document.getElementById('tb-dds').innerHTML=db.dds.slice(0,80).map(d=>{
    const w=allWals.find(x=>x.id===d.wal)||{name:d.wal,cur:'RUB'};
    const vs=w.cur==='USD'?fmtU(d.amt):fmtR(d.amt);
    const rs=fmtR(w.cur==='USD'?d.amt*rate:d.amt);
    const ac=d.amt>=0?'text-green':'text-red';
    return '<tr><td>'+d.date+'</td><td class="bold">'+w.name+'</td><td>'+d.cat+'</td><td class="num bold '+ac+'">'+vs+'</td><td class="num">'+rs+'</td>' +
      '<td><button class="btn btn-danger" onclick="db.dds=db.dds.filter(x=>x.id!==\''+d.id+'\');save();render()">✕</button></td></tr>';
  }).join('');

  document.getElementById('tb-tax').innerHTML=db.taxes.map(t=>
    '<tr><td>'+t.yr+' • '+t.kv+' кв.</td><td class="bold">'+t.org+'</td><td>'+t.type+'</td><td class="num">'+fmtR(t.amt)+'</td><td class="num bold text-red">'+fmtR(t.amt/3)+' / мес.</td>' +
    '<td><button class="btn btn-danger" onclick="db.taxes=db.taxes.filter(x=>x.id!==\''+t.id+'\');save();render()">✕</button></td></tr>'
  ).join('');

  document.getElementById('tb-exp').innerHTML=db.expenses.map(e=>{
    const vs=e.cur==='USD'?fmtU(e.amt):fmtR(e.amt);
    const rs=fmtR(e.cur==='USD'?e.amt*rate:e.amt);
    return '<tr><td>'+e.yr+'-'+e.mo+'</td><td class="bold">'+e.org+'</td><td>'+e.cat+'</td><td>'+e.tit+'</td><td class="num">'+vs+'</td><td class="num bold text-red">'+rs+'</td>' +
      '<td><button class="btn btn-danger" onclick="db.expenses=db.expenses.filter(x=>x.id!==\''+e.id+'\');save();render()">✕</button></td></tr>';
  }).join('');

  const sups={};
  db.supOps.forEach(o=>{
    const k=o.name+'_'+o.cur;
    if(!sups[k])sups[k]={name:o.name,cur:o.cur,bill:0,pay:0};
    if(o.type==='BILL')sups[k].bill+=o.amt;else sups[k].pay+=o.amt;
  });
  document.getElementById('tb-sup').innerHTML=Object.values(sups).map(s=>{
    const bal=s.bill-s.pay;
    const bs=s.cur==='USD'?fmtU(s.bill):fmtR(s.bill);
    const ps=s.cur==='USD'?fmtU(s.pay):fmtR(s.pay);
    const bls=s.cur==='USD'?fmtU(bal):fmtR(bal);
    const bc=bal>0?'text-red':'text-green';
    return '<tr><td class="bold">'+s.name+'</td><td>'+s.cur+'</td><td class="num">'+bs+'</td><td class="num">'+ps+'</td><td class="num bold '+bc+'">'+bls+'</td></tr>';
  }).join('');

  document.getElementById('tb-ast').innerHTML=db.assets.map(a=>
    '<tr><td class="bold">'+a.name+'</td><td class="num">'+fmtR(a.cost)+'</td><td class="num">'+a.mos+'</td><td class="num bold text-red">'+fmtR(a.cost/(a.mos||24))+'</td>' +
    '<td><button class="btn btn-danger" onclick="db.assets=db.assets.filter(x=>x.id!==\''+a.id+'\');save();render()">✕</button></td></tr>'
  ).join('');

  document.getElementById('tb-orgs-set').innerHTML=db.orgs.map(o=>
    '<tr><td class="bold">'+o.name+'</td><td>'+o.bank+'</td><td><button class="btn btn-danger" onclick="db.orgs=db.orgs.filter(x=>x.id!==\''+o.id+'\');save();render()">✕</button></td></tr>'
  ).join('');
}

function addSku(e){
  e.preventDefault();
  const bc=document.getElementById('s-bc').value.trim();
  if(db.skus.some(s=>s.bc===bc))return alert('Этот ШК уже есть!');
  db.skus.unshift({
    id:'s_'+Date.now(),
    name:document.getElementById('s-name').value,
    art:document.getElementById('s-art').value,
    col:document.getElementById('s-col').value||'—',
    siz:document.getElementById('s-siz').value||'—',
    bc:bc,
    usd:Number(document.getElementById('s-usd').value),
    src:'Вручную',
    isNew:false
  });
  e.target.reset();save();render();
}
function addAcc(e){
  e.preventDefault();
  db.accs.unshift({id:'a_'+Date.now(),art:document.getElementById('ac-art').value,name:document.getElementById('ac-name').value,qty:Number(document.getElementById('ac-qty').value),usd:Number(document.getElementById('ac-usd').value)});
  e.target.reset();save();render();
}
function addStockMove(e){
  e.preventDefault();
  db.stockMoves.unshift({id:'m_'+Date.now(),dt:new Date().toISOString().slice(0,10),item:document.getElementById('st-item').value,op:document.getElementById('st-op').value,qty:Number(document.getElementById('st-qty').value),usd:Number(document.getElementById('st-usd').value)});
  e.target.reset();save();render();
}
function addManualDds(e){
  e.preventDefault();
  const t=document.getElementById('d-type').value,a=Number(document.getElementById('d-amt').value);
  db.dds.unshift({id:'d_'+Date.now(),date:document.getElementById('d-date').value,wal:document.getElementById('d-wal').value,cat:document.getElementById('d-cat').value,amt:t==='IN'?a:-a});
  e.target.reset();save();render();
}
function addTax(e){
  e.preventDefault();
  db.taxes.unshift({id:'t_'+Date.now(),org:document.getElementById('tx-org').value,type:document.getElementById('tx-type').value,yr:document.getElementById('tx-yr').value,kv:Number(document.getElementById('tx-kv').value),amt:Number(document.getElementById('tx-amt').value)});
  e.target.reset();save();render();
}
function addExp(e){
  e.preventDefault();
  db.expenses.unshift({id:'e_'+Date.now(),org:document.getElementById('ex-org').value,cat:document.getElementById('ex-cat').value,tit:document.getElementById('ex-tit').value,amt:Number(document.getElementById('ex-amt').value),cur:document.getElementById('ex-cur').value,yr:document.getElementById('ex-yr').value,mo:document.getElementById('ex-mo').value});
  e.target.reset();save();render();
}
function addSupOp(e){
  e.preventDefault();
  db.supOps.unshift({id:'p_'+Date.now(),name:document.getElementById('sp-name').value,type:document.getElementById('sp-type').value,amt:Number(document.getElementById('sp-amt').value),cur:document.getElementById('sp-cur').value});
  e.target.reset();save();render();
}
function addAsset(e){
  e.preventDefault();
  db.assets.unshift({id:'as_'+Date.now(),name:document.getElementById('as-name').value,cost:Number(document.getElementById('as-cost').value),mos:Number(document.getElementById('as-mos').value)});
  e.target.reset();save();render();
}
function addOrg(e){
  e.preventDefault();
  db.orgs.push({id:'o_'+Date.now(),name:document.getElementById('og-name').value,bank:document.getElementById('og-bank').value});
  e.target.reset();save();render();
}
function saveMan(e){
  e.preventDefault();
  db.reports.unshift({id:'r_'+Date.now(),org:document.getElementById('mn-org').value,mp:document.getElementById('mn-mp').value,yr:document.getElementById('mn-yr').value,mo:document.getElementById('mn-mo').value,rev:Number(document.getElementById('mn-rev').value),ret:Number(document.getElementById('mn-ret').value),ads:Number(document.getElementById('mn-ads').value),log:Number(document.getElementById('mn-log').value),com:Number(document.getElementById('mn-com').value),cogs:Number(document.getElementById('mn-cog').value),bo:Number(document.getElementById('mn-bo').value)});
  save();closeModals();render();
}
function exportJson(){const a=document.createElement('a');a.href='data:text/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(db));a.download='SKOS_3_Backup.json';a.click();}
function importJson(ev){const f=ev.target.files;if(!f)return;const r=new FileReader();r.onload=e=>{try{db=Object.assign(db,JSON.parse(e.target.result));save();onPerChange();alert('База загружена!');}catch(err){alert('Ошибка файла');}};r.readAsText(f);}
function saveCloudCfg(){db.cloud={url:document.getElementById('sb-url').value.trim(),key:document.getElementById('sb-key').value.trim(),pin:document.getElementById('sb-pin').value.trim()||'2026'};save();syncCloud(true);}
async function syncCloud(manual){
  if(!db.cloud.url||!db.cloud.key)return manual?alert('Укажите Project URL и Anon Key в Настройках'):null;
  try{
    const res=await fetch(db.cloud.url+'/rest/v1/skos_cloud?id=eq.main',{headers:{apikey:db.cloud.key,Authorization:'Bearer '+db.cloud.key}});
    const rows=await res.json();
    if(rows&&rows.length&&rows.payload&&Object.keys(rows.payload).length&&!manual){db=Object.assign(db,rows.payload);save();render();}
    else{await fetch(db.cloud.url+'/rest/v1/skos_cloud?id=eq.main',{method:'PATCH',headers:{apikey:db.cloud.key,Authorization:'Bearer '+db.cloud.key,'Content-Type':'application/json'},body:JSON.stringify({payload:db,updated_at:new Date().toISOString()})});if(manual)alert('Облако SKOS успешно синхронизировано!');}
  }catch(e){if(manual)alert('Ошибка связи с облаком: '+e.message);}
}
window.addEventListener('DOMContentLoaded',()=>{init();syncCloud(false);});


