(() => {
  const renderRecords = window.renderDictTab;
  const norm = value => String(value || '').trim().toLocaleLowerCase('ru');
  function records(store, folder) {
    return folder.key === 'ddsCats' ? window.db.ddsCats : store[folder.key] || [];
  }
  const groups = [
    ['dds','ddsCats','Статьи ДДС'], ['opiu','dictOpiuArticles','Статьи ОПиУ'],
    ['ctrs','contractors','Контрагенты'], ['staff','staffList','Сотрудники'],
    ['taxes','dictTaxTypes','Виды налогов'], ['cats','dictMatCats','Категории сырья'],
    ['units','dictUnits','Единицы измерения'], ['sups','dictSuppliers','Поставщики'],
    ['sizes','dictSizes','Размерный ряд'], ['colors','dictColors','Цвета']
  ];

  const destinations = new Map([
    ['', 'Только справочник'],
    ['banks', 'Юрлица → Банк / Счёт'],
    ['ddsCats', 'ДДС → Статья'],
    ['dictOpiuArticles', 'Расходы → Статья ОПиУ'],
    ['contractors', 'Поставщики и ОС → Контрагент'],
    ['staffList', 'Зарплатная ведомость → Сотрудник'],
    ['dictTaxTypes', 'Налоги → Вид налога'],
    ['dictMatCats', 'Запасы → Категория сырья'],
    ['stockInputs', 'Запасы → Материалы / услуги'],
    ['dictUnits', 'Запасы → Единица измерения'],
    ['dictSuppliers', 'Запасы → Поставщик'],
    ['dictSizes', 'Товары → Размер'],
    ['dictColors', 'Товары → Цвет']
  ]);
  window.directoryPurpose = folder => typeof folder.usage === 'string'
    ? (destinations.has(folder.usage) ? folder.usage : '')
    : (/банк|расч[её]тн[а-яё]*\s+сч[её]т/i.test(folder.title || '') ? 'banks' : '');

  window.directoryRows = key => {
    const store = window.ensureStore();
    const base = key === 'ddsCats' ? window.db.ddsCats : store[key];
    const entries = new Map();
    function add(row, group) {
      const name = norm(row?.name);
      if (!name || (entries.has(name) && (!entries.get(name).arch || row.arch))) return;
      entries.set(name, group && key === 'ddsCats' && !row.grp ? {...row,grp:group} : row);
    }
    for (const row of Array.isArray(base) ? base : []) add(row);
    for (const folder of store.customDictFolders) {
      if (store.dictFolderSettings?.[folder.id]?.removed || window.directoryPurpose(folder) !== key || !Array.isArray(store[folder.key])) continue;
      for (const row of store[folder.key]) add(row, folder.title);
    }
    return [...entries.values()];
  };

  const renderSettings = window.renderSetTab;
  window.renderSetTab = function () {
    renderSettings.apply(this, arguments);
    const field = document.getElementById('og-bank');
    if (!field) return;
    let options = document.getElementById('skos-bank-options');
    if (!options) {
      options = document.createElement('datalist');
      options.id = 'skos-bank-options';
      field.after(options);
      field.setAttribute('list', options.id);
    }
    const banks = new Map();
    for (const name of [...window.directoryRows('banks').filter(row=>!row.arch).map(row=>row.name),
        ...(window.db.orgs || []).map(org=>org.bank)]) {
      if (norm(name) && !banks.has(norm(name))) banks.set(norm(name), name);
    }
    options.replaceChildren(...Array.from(banks.values(), name => new Option(name, name)));
  };

  let openFolderId = '';
  function sections(store) {
    const settings = store.dictFolderSettings || {};
    return [
      {id:'sku', label:'Товары, ШК и себестоимость',count:(window.db.skus || []).length},
      ...groups.map(([id,key,label])=>({id,key,label})),
      ...(store.customDictFolders || []).map(folder=>({
        id:folder.id,key:folder.key,label:String(folder.title || '').replace(/^📁\s*/u,''),custom:folder
      }))
    ].map(folder => ({...folder, ...settings[folder.id]}));
  }

  function saveFolders() {
    window.save(true);
    window.renderDictTab();
  }

  function editFolder(store, folder) {
    if (window.__skosReadOnly) return;
    const duplicate = name => sections(store).some(item => item.id !== folder?.id && norm(item.label) === norm(name));
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'width:min(520px,92vw);margin:auto;padding:20px;border:1px solid #cbd5e1;border-radius:14px';
    dialog.innerHTML = '<form><h3>Настройки папки</h3><label>Название<input class="input" name="name" required></label><label>Где показывать записи<select class="select" name="usage"></select></label><p role="status" style="color:#b91c1c"></p><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button type="button" class="btn">Отмена</button><button type="submit" class="btn btn-primary">Сохранить</button></div></form>';
    const form = dialog.querySelector('form');
    const nameField = form.elements.namedItem('name');
    const usageField = form.elements.namedItem('usage');
    for (const [value,label] of destinations) usageField.add(new Option(label,value));
    nameField.value = folder?.label || '';
    if (folder && !folder.custom) {
      if (folder.id === 'sku') usageField.add(new Option('Товары → Каталог', 'sku'));
      usageField.value = folder.key || 'sku';
      usageField.disabled = true;
    } else {
      usageField.value = folder ? window.directoryPurpose(folder.custom) : '';
    }
    form.querySelector('button[type=button]').onclick = () => dialog.close();
    dialog.onclose = () => dialog.remove();
    form.onsubmit = event => {
      event.preventDefault();
      const name = nameField.value.trim(), usage = usageField.value;
      if (!name || duplicate(name)) {
        form.querySelector('[role=status]').textContent = 'Укажите уникальное название папки.';
        return;
      }
      if (folder?.custom) Object.assign(folder.custom, {title:name,usage});
      else if (folder) folderSettings(store, folder).label = name;
      else {
        const id = 'cust_' + crypto.randomUUID();
        store[id] = [];
        store.customDictFolders.push({id,key:id,title:name,usage});
        openFolderId = id;
      }
      dialog.close();
      saveFolders();
    };
    document.body.append(dialog);
    dialog.showModal();
  }

  function folderSettings(store, folder) {
    store.dictFolderSettings ||= {};
    return store.dictFolderSettings[folder.id] ||= {};
  }

  function removeFolder(store, folder) {
    if (window.__skosReadOnly) return;
    if (!confirm('Удалить папку «' + folder.label + '» из списка? Её можно будет восстановить вместе с записями.')) return;
    const settings = folderSettings(store, folder);
    settings.hidden = true;
    settings.removed = true;
    saveFolders();
  }

  function renderFolders(target, store, all, readOnly) {
    const esc = window.esc;
    const visible = all.filter(folder => !folder.hidden);
    const hidden = all.filter(folder => folder.hidden);
    target.innerHTML = `<section class="card"><div class="card-header"><div class="card-title">Справочники SKOS</div>
      ${readOnly ? '' : '<button type="button" class="btn btn-primary" id="skos-add-folder">+ Новая папка</button>'}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:10px">
        ${visible.map(folder => `<div style="border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;padding:10px">
          <button type="button" class="btn" data-open-folder="${esc(folder.id)}" style="width:100%;text-align:left;white-space:normal;min-height:46px">📁 ${esc(folder.label)} (${folder.count ?? records(store,folder).filter(row=>!row.arch).length})</button>
          ${readOnly ? '' : `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
            <button type="button" class="btn" data-rename-folder="${esc(folder.id)}">Настроить</button>
            <button type="button" class="btn btn-danger" data-remove-folder="${esc(folder.id)}">Удалить</button>
          </div>`}
        </div>`).join('')}
      </div>
      ${!readOnly && hidden.length ? `<details style="margin-top:12px"><summary>Удалённые папки (${hidden.length})</summary>
        ${hidden.map(folder => `<div style="margin-top:8px">${esc(folder.label)} <button type="button" class="btn" data-restore-folder="${esc(folder.id)}">Восстановить</button></div>`).join('')}
      </details>` : ''}</section>`;
    const byId = new Map(all.map(folder => [folder.id,folder]));
    for (const button of target.querySelectorAll('[data-open-folder]')) button.onclick = () => {
      const id = button.dataset.openFolder;
      if (id === 'sku') window.tab('sku');
      else { openFolderId = id; window.renderDictTab(); }
    };
    if (readOnly) return;
    target.querySelector('#skos-add-folder').onclick = () => editFolder(store);
    for (const button of target.querySelectorAll('[data-rename-folder]')) button.onclick = () => editFolder(store, byId.get(button.dataset.renameFolder));
    for (const button of target.querySelectorAll('[data-remove-folder]')) button.onclick = () => removeFolder(store, byId.get(button.dataset.removeFolder));
    for (const button of target.querySelectorAll('[data-restore-folder]')) button.onclick = () => {
      const settings = folderSettings(store, byId.get(button.dataset.restoreFolder));
      settings.hidden = false;
      delete settings.removed;
      saveFolders();
    };
  }

  window.renderDictTab = function () {
    const target = document.getElementById('tab-dict');
    if (!target) return;
    const store = window.ensureStore();
    const all = sections(store);
    const current = all.find(folder => folder.id === openFolderId && !folder.hidden);
    if (!current) {
      openFolderId = '';
      renderFolders(target, store, all, window.__skosReadOnly);
      return;
    }

    const previousSection = store.dictSub;
    store.dictSub = current.id;
    try {
      renderRecords();
    } finally {
      store.dictSub = previousSection;
    }

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn';
    back.style.marginBottom = '12px';
    back.textContent = '← Все папки';
    back.onclick = () => {
      openFolderId = '';
      window.renderDictTab();
    };
    target.firstElementChild.replaceWith(back);
    const title = target.querySelector('.card-title');
    if (title) title.textContent = current.label;
    const addRecord = target.querySelector('#skos-dir-add');
    if (addRecord) addRecord.textContent = '+ Добавить запись';
  };
})();
