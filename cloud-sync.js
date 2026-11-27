(() => {
  'use strict';
  const config = window.skosCloudConfig;
  const gate = document.createElement('dialog');
  gate.style.cssText = 'max-width:min(420px,92vw);margin:auto;padding:24px;border:1px solid #cbd5e1;border-radius:14px';
  gate.innerHTML = '<h2>SKOS Finance</h2><p role="status" style="margin:12px 0">Проверяем доступ…</p><form><label>Логин (почта)<input class="input" type="email" name="email" autocomplete="username" required></label><label>Пароль<input class="input" type="password" name="password" autocomplete="current-password" required></label><button type="submit" class="btn btn-primary" style="margin-top:12px" disabled>Войти</button></form>';
  gate.addEventListener('cancel', event => event.preventDefault());
  document.body.append(gate);
  gate.showModal();
  window.__skosReadOnly = true;
  const message = gate.querySelector('[role=status]');
  const form = gate.querySelector('form');
  const login = form.querySelector('button');
  const cloud = document.getElementById('skos-cloud-button');
  const settings = document.getElementById('skos-cloud-settings');
  const logout = document.createElement('button');
  const history = document.createElement('button');
  for (const button of [logout, history]) {
    button.className = 'btn';
    button.type = 'button';
    button.hidden = true;
    cloud.before(button);
  }
  logout.textContent = 'Выйти';
  history.textContent = 'Версии облака';
  cloud.disabled = true;

  let user, role, timer, currentVersion, session = 0, updating = false, publishing = false;
  const tell = text => {
    message.textContent = text;
    settings.textContent = text;
    cloud.title = text;
  };
  const format = date => new Date(date).toLocaleString('ru-RU');
  function apply(payload, owner) {
    const {cloud, tab, ...data} = payload.data;
    Object.assign(window.db, data);
    if (owner) localStorage.setItem(window._CFG.FMAP, JSON.stringify(payload.folderNames));
    else window.getFolderNames = () => payload.folderNames;
    window.ensureStore();
    window.fillAllSelects();
    window.onPerChange();
    window.tab(window.db.tab || 'dash');
  }
  async function request(path, body) {
    const token = await user.getIdToken();
    const result = await fetch(config.apiUrl.replace(/\/+$/, '') + path, {
      method:body ? 'POST' : 'GET', cache:'no-store',
      headers:{Authorization:'Bearer ' + token, ...(body ? {'Content-Type':'application/json'} : {})},
      body: body ? JSON.stringify(body) : undefined
    });
    if (!result.ok) throw Object.assign(new Error('HTTP ' + result.status),{status:result.status});
    return result.json();
  }
  async function refresh() {
    if (role !== 'viewer' || updating) return;
    const active = session;
    updating = true;
    try {
      const latest = await request('/latest');
      if (active !== session) return;
      if (!latest) { tell('Владелец ещё не опубликовал базу.'); return; }
      if (latest.id !== currentVersion) {
        const version = await request('/version/' + encodeURIComponent(latest.title));
        if (active !== session) return;
        apply(version.snapshot, false);
        currentVersion = latest.id;
      }
      tell('Данные обновлены ' + format(latest.date));
      if (gate.open) gate.close();
    } catch (error) {
      if (active !== session) return;
      tell('Не удалось получить облачную базу.');
      if (error.status === 401 && !gate.open) gate.showModal();
    } finally { updating = false; }
  }

  window.syncCloud = async () => {
    if (role !== 'owner' || publishing) return;
    publishing = true;
    cloud.disabled = true;
    let notice;
    try {
      window.flushLocalSave();
      const {cloud, tab, ...data} = window.db;
      const result = await request('/publish',{schema:1,data,folderNames:window.getFolderNames()});
      notice = 'База опубликована ' + format(result.date);
    } catch (error) {
      notice = error.status === 413 ? 'База превышает размер одной публикации.' : 'Облако не подтвердило публикацию.';
    } finally {
      publishing = false;
      cloud.disabled = role !== 'owner';
    }
    tell(notice);
    window.showToastProgress(notice, 3500);
  };

  history.onclick = async () => {
    history.disabled = true;
    try {
      const versions = await request('/history');
      if (!versions.length) { tell('Сохранённых версий пока нет.'); return; }
      const dialog = document.createElement('dialog');
      dialog.style.cssText = gate.style.cssText;
      dialog.innerHTML = '<h2>Версии облака</h2><select class="select" aria-label="Версия"></select><p role="status"></p><button type="button" class="btn btn-primary">Скачать JSON</button> <button type="button" class="btn">Закрыть</button>';
      const select = dialog.querySelector('select');
      for (const title of versions) {
        const date = title.slice(7,24).replace(/^(....)(..)(..)(..)(..)(..)(...)$/, '$1-$2-$3T$4:$5:$6.$7Z');
        select.add(new Option(format(date),title));
      }
      const [download, close] = dialog.querySelectorAll('button');
      close.onclick = () => dialog.close();
      dialog.onclose = () => dialog.remove();
      download.onclick = async () => {
        download.disabled = true;
        try {
          const {snapshot} = await request('/version/' + encodeURIComponent(select.value));
          const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'}));
          const link = document.createElement('a');
          link.href = url;
          link.download = select.value + '.json';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url),1000);
        } catch { dialog.querySelector('[role=status]').textContent = 'Не удалось скачать версию.'; }
        finally { download.disabled = false; }
      };
      document.body.append(dialog);
      dialog.showModal();
    } catch { tell('Не удалось получить историю облака.'); }
    finally { history.disabled = false; }
  };

  async function setup() {
    if (!config?.firebase?.apiKey || !config.apiUrl.startsWith('https://')) {
      tell('Сервер входа SKOS ещё не подключён.');
      return;
    }
    const base = 'https://www.gstatic.com/firebasejs/11.10.0/';
    const [appSdk, authSdk] = await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js')]);
    const auth = authSdk.getAuth(appSdk.initializeApp(config.firebase));
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
      role = null;
      user = account;
      currentVersion = '';
      window.__skosReadOnly = true;
      cloud.disabled = true;
      history.hidden = true;
      if (!gate.open) gate.showModal();
      login.disabled = false;
      if (!account) { tell('Введите логин SKOS и пароль.'); return; }
      try {
        const result = await request('/session');
        if (active !== session) return;
        if (result.role === 'owner') {
          const local = localStorage.getItem(window._CFG.KEY);
          if (local) {
            const {cloud,tab,...data} = JSON.parse(local);
            apply({data,folderNames:window.getFolderNames()},true);
          } else {
            const latest = await request('/latest');
            if (latest) apply((await request('/version/' + latest.title)).snapshot,true);
          }
          if (active !== session) return;
          role = 'owner';
          window.__skosReadOnly = false;
          window.tab('dash');
          cloud.disabled = false;
          history.hidden = false;
          gate.close();
          tell('Доступ владельца. Нажмите «Облако», чтобы опубликовать базу.');
        } else if (result.role === 'viewer') {
          role = 'viewer';
          window.applyGuestRestrictions();
          await refresh();
          if (active === session) timer = setInterval(refresh,10000);
        }
        if (active === session) logout.hidden = false;
      } catch { tell('Этому аккаунту не выдан доступ к SKOS или сервер недоступен.'); }
    });
    document.addEventListener('visibilitychange',() => { if (!document.hidden) refresh(); });
  }
  setup().catch(() => tell('Не удалось подключиться к серверу входа SKOS.'));
})();
