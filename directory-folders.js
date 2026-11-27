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
    const name = prompt(folder ? 'Название папки:' : 'Название новой папки:', folder?.label || '')?.trim();
    if (!name || name === folder?.label) return;
    if (sections(store).some(item => item.id !== folder?.id && norm(item.label) === norm(name))) {
      alert('Папка с таким названием уже существует.');
      return;
    }
    if (folder) {
      if (folder.custom) folder.custom.title = name;
      else folderSettings(store, folder).label = name;
    } else {
      const id = 'cust_' + crypto.randomUUID();
      store[id] = [];
      store.customDictFolders.push({id,key:id,title:name});
      openFolderId = id;
    }
    saveFolders();
  }

  function folderSettings(store, folder) {
    store.dictFolderSettings ||= {};
    return store.dictFolderSettings[folder.id] ||= {};
  }

  function removeFolder(store, folder) {
    if (window.__skosReadOnly) return;
    if (folder.custom) {
      const length = records(store, folder).length;
      if (!confirm('Удалить папку «' + folder.label + '»? Записей в папке: ' + length + '.')) return;
      store.customDictFolders = store.customDictFolders.filter(item => item.id !== folder.id);
      delete store[folder.key];
    } else {
      folderSettings(store, folder).hidden = true;
    }
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
            <button type="button" class="btn" data-rename-folder="${esc(folder.id)}">Переименовать</button>
            <button type="button" class="btn ${folder.custom ? 'btn-danger' : ''}" data-remove-folder="${esc(folder.id)}">${folder.custom ? 'Удалить' : 'Скрыть'}</button>
          </div>`}
        </div>`).join('')}
      </div>
      ${!readOnly && hidden.length ? `<details style="margin-top:12px"><summary>Скрытые папки (${hidden.length})</summary>
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
      folderSettings(store, byId.get(button.dataset.restoreFolder)).hidden = false;
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
