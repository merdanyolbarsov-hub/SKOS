(() => {
  'use strict';
  const config = window.skosCloudConfig;
  const defaults = structuredClone(window.db);
  const gate = document.createElement('dialog');
  gate.style.cssText = 'max-width:min(420px,92vw);margin:auto;padding:24px;border:1px solid #cbd5e1;border-radius:14px';
  gate.innerHTML = '<h2>SKOS Finance</h2><p role="status" style="margin:12px 0">Проверяем доступ…</p><form data-skos-login><label>Логин (почта)<input class="input" type="email" name="email" autocomplete="username" required></label><label>Пароль<input class="input" type="password" name="password" autocomplete="current-password" required></label><button type="submit" class="btn btn-primary" style="margin-top:12px" disabled>Войти</button></form>';
  gate.addEventListener('cancel', event => event.preventDefault());
  document.body.append(gate);
  const appContent = [...document.querySelectorAll('.sidebar, .main-wrap')];
  const setAppReady = ready => appContent.forEach(element => {
    element.inert = !ready;
    element.style.visibility = ready ? '' : 'hidden';
  });
  const showLogin = () => { if (!gate.open) gate.showModal(); };
  setAppReady(false);
  window.__skosReadOnly = true;
  const message = gate.querySelector('[role=status]');
  const form = gate.querySelector('form');
  const login = form.querySelector('button');
  const cloud = document.getElementById('skos-cloud-button');
  const settings = document.getElementById('skos-cloud-settings');
  const logout = document.createElement('button');
  const history = document.createElement('button');
  const ownedFolders = window.getFolderNames;
  const working = document.createElement('button');
  const returnToLatest = document.createElement('button');
  for (const button of [logout, history, returnToLatest, working]) {
    button.className = 'btn';
    button.type = 'button';
    button.hidden = true;
    cloud.before(button);
  }
  logout.textContent = 'Выйти';
  history.textContent = 'Версии облака';
  working.textContent = 'Локальный черновик';
  cloud.disabled = true;

  let ownerWork, ownerLatest, ownerCloudReady;
  let user, role, timer, stopWatching, currentVersion, archivedVersion, session = 0, updating = false, publishing = false;
  const tell = text => {
    message.textContent = text;
    settings.textContent = text;
    cloud.title = text;
  };
  const format = date => new Date(date).toLocaleString('ru-RU');
  const signatureKey = 'skos_owner_cloud_signature';
  function capture(data = window.db, folderNames = window.getFolderNames()) {
    const {cloud, tab, ...content} = data;
    return {schema:1,data:content,folderNames};
  }
  async function signature(payload) {
    const {erp, ...data} = payload.data;
    const {dictSub, stkSub, ...records} = erp || {};
    const ordered = (_, value) => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])) : value;
    const bytes = new TextEncoder().encode(JSON.stringify({data:{...data,erp:records},folderNames:payload.folderNames},ordered));
    const digest = await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  function apply(payload, owner) {
    const {cloud, tab, ...data} = structuredClone(payload.data);
    const selectedTab = window.db.tab;
    for (const key of Object.keys(window.db)) delete window.db[key];
    Object.assign(window.db, structuredClone(defaults), data, {tab:selectedTab});
    window.getFolderNames = owner ? ownedFolders : () => payload.folderNames || {};
    if (owner) localStorage.setItem(window._CFG.FMAP, JSON.stringify(payload.folderNames || {}));
    window.ensureStore();
    window.fillAllSelects();
    window.onPerChange();
    if (document.getElementById('nav-unit')?.classList.contains('active')) window.renderUnitTab();
    else window.tab(window.db.tab || 'dash');
  }
  function ownerMode(editable) {
    if (editable) {
      window.__skosReadOnly = false;
      document.getElementById('ro-css')?.remove();
    } else window.applyGuestRestrictions();
    cloud.disabled = !editable || !ownerCloudReady;
    working.hidden = editable || !ownerWork;
  }
  function showOwnerLatest() {
    archivedVersion = '';
    returnToLatest.hidden = true;
    if (ownerWork) {
      ownerMode(false);
      apply(ownerLatest.snapshot,false);
      tell('Последняя версия облака ' + format(ownerLatest.date) + '. Локальный черновик доступен отдельно.');
    } else if (ownerLatest) {
      ownerMode(true);
      apply(ownerLatest.snapshot,true);
      window.flushLocalSave();
      tell('Последняя версия облака ' + format(ownerLatest.date));
    }
  }
  function openOwnerDraft() {
    if (role !== 'owner' || !ownerWork || publishing) return;
    const draft = ownerWork;
    ownerWork = null;
    archivedVersion = '';
    ownerMode(true);
    apply(draft,true);
    window.flushLocalSave();
    returnToLatest.textContent = 'Открыть последнюю облачную версию';
    returnToLatest.hidden = !ownerLatest;
    tell('Открыт локальный черновик. Кнопка «Облако» публикует его как новую версию.');
  }
  working.onclick = openOwnerDraft;
  let firestore;
  async function request(path, body) {
    try {
      if (path === '/session') return await firestore.session();
      if (path === '/latest') return await firestore.latest();
      if (path === '/history') return await firestore.history();
      if (path === '/publish') return await firestore.publish(body);
      return await firestore.version(decodeURIComponent(path.slice('/version/'.length)));
    } catch (error) {
      if (error.code === 'permission-denied') error.status = 403;
      throw error;
    }
  }
  let pendingVersion = '';
  async function refresh(versionId = '') {
    if (role !== 'viewer' || archivedVersion) return;
    if (updating) {
      if (versionId && versionId !== currentVersion) pendingVersion = versionId;
      return;
    }
    const active = session;
    updating = true;
    try {
      const latest = await request('/latest');
      if (active !== session || archivedVersion) return;
      if (!latest) { tell('Владелец ещё не опубликовал базу.'); showLogin(); return; }
      if (latest.id !== currentVersion) {
        const version = await request('/version/' + encodeURIComponent(latest.title));
        if (active !== session || archivedVersion) return;
        apply(version.snapshot, false);
        currentVersion = latest.id;
      }
      tell('Данные обновлены ' + format(latest.date));
      if (gate.open) gate.close();
      setAppReady(true);
      returnToLatest.hidden = true;
      returnToLatest.disabled = false;
    } catch (error) {
      if (active !== session || archivedVersion) return;
      tell('Не удалось получить облачную базу.');
      if (error.status === 401 || error.status === 403 || !currentVersion) showLogin();
    } finally {
      updating = false;
      returnToLatest.disabled = false;
      const queued = pendingVersion;
      pendingVersion = '';
      if (queued && queued !== currentVersion) refresh(queued);
    }
  }

  window.syncCloud = async () => {
    if (role !== 'owner' || window.__skosReadOnly || !ownerCloudReady || publishing) return;
    publishing = true;
    cloud.disabled = true;
    let notice;
    try {
      window.flushLocalSave();
      const snapshot = structuredClone(capture());
      const baseline = await signature(snapshot);
      const result = await request('/publish',snapshot);
      try { localStorage.setItem(signatureKey,baseline); } catch {}
      ownerLatest = {...result,snapshot};
      returnToLatest.hidden = true;
      notice = 'База опубликована ' + format(result.date);
    } catch (error) {
      notice = error.status === 413 ? 'База превышает размер одной публикации.' : 'Облако не подтвердило публикацию.';
    } finally {
      publishing = false;
      cloud.disabled = role !== 'owner' || window.__skosReadOnly;
    }
    tell(notice);
    window.showToastProgress(notice, 3500);
  };

  returnToLatest.onclick = async () => {
    if (role === 'owner') {
      if (publishing || !ownerLatest) return;
      if (!window.__skosReadOnly) {
        window.flushLocalSave();
        const draft = structuredClone(capture());
        const active = session;
        const hash = await signature(draft);
        if (active !== session) return;
        ownerWork = hash === localStorage.getItem(signatureKey) ? null : draft;
      }
      showOwnerLatest();
      return;
    }
    archivedVersion = '';
    currentVersion = '';
    returnToLatest.disabled = true;
    refresh();
  };

  history.onclick = async () => {
    const active = session;
    const viewer = role === 'viewer';
    if (publishing) return;
    history.disabled = true;
    try {
      const versions = await request('/history');
      if (active !== session) return;
      if (!versions.length) { tell('Сохранённых версий пока нет.'); return; }
      const dialog = document.createElement('dialog');
      dialog.style.cssText = gate.style.cssText;
      dialog.innerHTML = '<h2>Версии облака</h2><select class="select" aria-label="Версия"></select><p role="status"></p><button type="button" class="btn btn-primary">Открыть для просмотра</button> <button type="button" class="btn" data-download>Скачать JSON</button> <button type="button" class="btn">Закрыть</button>';
      const select = dialog.querySelector('select');
      for (const title of versions) {
        const date = title.slice(7,24).replace(/^(....)(..)(..)(..)(..)(..)(...)$/, '$1-$2-$3T$4:$5:$6.$7Z');
        select.add(new Option(format(date) + (title===(ownerLatest?.id || currentVersion)?' · текущая':''),title));
      }
      const [open, download, close] = dialog.querySelectorAll('button');
      download.hidden = viewer;
      close.onclick = () => dialog.close();
      dialog.onclose = () => dialog.remove();
      const viewVersion = async shouldDownload => {
        open.disabled = download.disabled = true;
        const title = select.value;
        const previousArchive = archivedVersion;
        if (!shouldDownload && viewer) archivedVersion = title;
        try {
          const {snapshot, date} = await request('/version/' + encodeURIComponent(title));
          if (active !== session) return;
          if (!shouldDownload) {
            if (!viewer && !window.__skosReadOnly) {
              window.flushLocalSave();
              const draft = structuredClone(capture());
              const hash = await signature(draft);
              if (active !== session) return;
              ownerWork = ownerLatest && hash === localStorage.getItem(signatureKey) ? null : draft;
            }
            archivedVersion = title;
            if (!viewer) ownerMode(false);
            apply(snapshot, false);
            returnToLatest.textContent = 'Архив ' + format(date) + ' · к последней версии';
            returnToLatest.hidden = false;
            dialog.close();
            return;
          }
          const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'}));
          const link = document.createElement('a');
          link.href = url;
          link.download = title + '.json';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url),1000);
        } catch {
          if (active !== session) return;
          if (viewer) archivedVersion = previousArchive;
          dialog.querySelector('[role=status]').textContent = 'Не удалось открыть версию.';
        } finally { open.disabled = download.disabled = false; }
      };
      open.onclick = () => viewVersion(false);
      download.onclick = () => viewVersion(true);
      document.body.append(dialog);
      dialog.showModal();
    } catch { tell('Не удалось получить историю облака.'); }
    finally { history.disabled = false; }
  };

  async function setup() {
    if (!config?.firebase?.apiKey || !config.ownerUid || !config.viewerUid) {
      tell('Подключение Firebase ещё не настроено.');
      showLogin();
      return;
    }
    const base = 'https://www.gstatic.com/firebasejs/11.10.0/';
    const [appSdk, authSdk, databaseSdk] = await Promise.all([
      import(base+'firebase-app.js'), import(base+'firebase-auth.js'), import(base+'firebase-firestore.js')
    ]);
    const app = appSdk.initializeApp(config.firebase);
    const auth = authSdk.getAuth(app);
    firestore = window.makeSkosFirestore(databaseSdk, databaseSdk.getFirestore(app), config, () => user?.uid);
    await auth.authStateReady();
    await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
    form.onsubmit = async event => {
      event.preventDefault();
      login.disabled = true;
      try { await authSdk.signInWithEmailAndPassword(auth,form.elements.email.value.trim(),form.elements.password.value); }
      catch { tell('Проверьте логин и пароль или обратитесь к владельцу SKOS.'); }
      finally { form.elements.password.value = ''; login.disabled = false; }
    };
    logout.onclick = async () => {
      window.flushLocalSave();
      await authSdk.signOut(auth);
      location.reload();
    };
    authSdk.onAuthStateChanged(auth, async account => {
      const active = ++session;
      clearInterval(timer);
      stopWatching?.();
      stopWatching = undefined;
      pendingVersion = '';
      role = null;
      ownerLatest = ownerWork = null;
      ownerCloudReady = false;
      working.hidden = true;
      window.getFolderNames = ownedFolders;
      user = account;
      currentVersion = '';
      archivedVersion = '';
      returnToLatest.hidden = true;
      returnToLatest.disabled = false;
      window.__skosReadOnly = true;
      cloud.disabled = true;
      history.hidden = true;
      setAppReady(false);
      login.disabled = false;
      if (!account) {
        tell('Введите логин SKOS и пароль.');
        showLogin();
        return;
      }
      try {
        const result = await request('/session');
        if (active !== session) return;
        if (result.role === 'owner') {
          let local;
          try { local = JSON.parse(localStorage.getItem(window._CFG.KEY)); } catch {}
          const draft = local && capture(local,ownedFolders());
          try {
            const latest = await request('/latest');
            if (active !== session) return;
            ownerCloudReady = true;
            if (latest) {
              const version = await request('/version/' + encodeURIComponent(latest.title));
              if (active !== session) return;
              ownerLatest = {...latest,...version};
              if (draft) {
                const [localSignature, cloudSignature] = await Promise.all([signature(draft),signature(version.snapshot)]);
                if (localSignature !== cloudSignature && localSignature !== localStorage.getItem(signatureKey)) ownerWork = draft;
              }
              if (active !== session) return;
            }
          } catch {
            if (active !== session) return;
            if (!draft) throw new Error('Облачная база недоступна.');
            ownerLatest = null;
            ownerCloudReady = false;
          }
          role = 'owner';
          if (ownerLatest) {
            if (ownerWork) openOwnerDraft();
            else {
              showOwnerLatest();
              const baseline = await signature(capture());
              if (active !== session) return;
              localStorage.setItem(signatureKey,baseline);
            }
          } else {
            ownerMode(true);
            if (draft) apply(draft,true);
            tell(ownerCloudReady ? 'Сохранённых версий в облаке пока нет.' :
              'Открыта локальная база. Обновите страницу, чтобы повторить проверку облака перед публикацией.');
          }
          window.tab('dash');
          history.hidden = false;
          if (gate.open) gate.close();
          setAppReady(true);
        } else if (result.role === 'viewer') {
          role = 'viewer';
          window.applyGuestRestrictions();
          history.hidden = false;
          await refresh();
          if (active === session) {
            timer = setInterval(refresh,10000);
            stopWatching = firestore.watchLatest?.(id => {
              if (active === session && id !== currentVersion) refresh(id);
            });
          }
        }
        if (active === session) logout.hidden = false;
      } catch {
        if (active !== session) return;
        tell('Этому аккаунту не выдан доступ к SKOS или сервер недоступен.');
        showLogin();
      }
    });
    document.addEventListener('visibilitychange',() => { if (!document.hidden) refresh(); });
  }
  setup().catch(() => { tell('Не удалось подключиться к Firebase.'); showLogin(); });
})();
