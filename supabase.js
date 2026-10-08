/* BandPlan — Supabase Auth + isolated per-account cloud state */
(function () {
  'use strict';
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.__bandplanSupabaseSdkError = true;
    console.error('BandPlan: Supabase SDK не загрузился.');
    return;
  }
  const SUPABASE_URL = 'https://oczcjphvzoadfqntoqlc.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY';
  const TABLE = 'bandplan_user_state';
  /*
    Use Supabase's standard browser storage key. A previous repair introduced a
    custom key, which split the app into two independent auth stores and made
    previously valid sessions appear logged out. Migrate the old temporary key
    once, then let supabase-js own session persistence.
  */
  const LEGACY_AUTH_STORAGE_KEY = 'bandplan-auth-v2';
  const AUTH_STORAGE_KEY = 'sb-' + new globalThis.URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token';

  /*
    Recover the newest valid persisted session when an older repair left two
    auth stores behind. Supabase's default key is explicit here so a future
    client configuration change cannot silently move the session again.
  */
  function authSessionScore(raw) {
    try {
      const parsed = JSON.parse(raw);
      const expiresAt = Number(parsed?.expires_at || parsed?.session?.expires_at || 0);
      const refreshToken = String(parsed?.refresh_token || parsed?.session?.refresh_token || '').trim();
      return {expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0, hasRefreshToken: !!refreshToken, validShape: !!parsed};
    } catch (_) {
      return {expiresAt: 0, hasRefreshToken: false, validShape: false};
    }
  }
  try {
    const standardRaw = localStorage.getItem(AUTH_STORAGE_KEY);
    const legacyRaw = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (legacyRaw) {
      const standardScore = authSessionScore(standardRaw || '');
      const legacyScore = authSessionScore(legacyRaw);
      const shouldRecoverLegacy =
        !standardRaw ||
        !standardScore.hasRefreshToken ||
        (legacyScore.hasRefreshToken && legacyScore.expiresAt > standardScore.expiresAt);
      if (shouldRecoverLegacy && legacyScore.hasRefreshToken) {
        localStorage.setItem(AUTH_STORAGE_KEY, legacyRaw);
      }
    }
  } catch (_) {}

  function cleanupLegacyAuthStorage() {
    try { localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY); } catch (_) {}
  }
  const fetchWithTimeout = (input, init={}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const sourceSignal = init?.signal;
    if (sourceSignal) {
      if (sourceSignal.aborted) controller.abort();
      else sourceSignal.addEventListener('abort', () => controller.abort(), {once:true});
    }
    return globalThis.fetch(input, {...init, signal:controller.signal})
      .finally(() => clearTimeout(timeout));
  };
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {fetch: fetchWithTimeout},
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: AUTH_STORAGE_KEY
    }
  });
  let currentSession = null, timer = null, pending = null, channel = null, groupChannel = null, activeGroupId = null, activeMemberIds = [], lastUpdated = '', refreshTimer = null, realtimePollTimer = null, realtimeSharedReady = false, groupSetupPromise = null, sharedBaseline = {songs:{},events:{},setlists:{}};
  let authSubscription = null;
  let realtimeGeneration = 0;
  let subscriptionCallback = null;
  let participationCallback = null;
  let participationChannel = null;

  /* Durable offline cache: per-account snapshot + latest pending sync. */
  const IDB_NAME='bandplan-cloud-v1', IDB_VERSION=3, IDB_SNAPSHOT='snapshots', IDB_QUEUE='sync_queue', IDB_PARTICIPATION='participation_queue', IDB_OFFLINE_SONGS='event_offline_songs';
  let idbPromise=null;
  function openOfflineDb(){
    if(!('indexedDB' in window)) return Promise.resolve(null);
    if(idbPromise) return idbPromise;
    idbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(IDB_NAME,IDB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;
        if(!db.objectStoreNames.contains(IDB_SNAPSHOT))db.createObjectStore(IDB_SNAPSHOT,{keyPath:'user_id'});
        if(!db.objectStoreNames.contains(IDB_QUEUE))db.createObjectStore(IDB_QUEUE,{keyPath:'user_id'});
        if(!db.objectStoreNames.contains(IDB_PARTICIPATION)){
          const store=db.createObjectStore(IDB_PARTICIPATION,{keyPath:'key'});
          store.createIndex('user_id','user_id',{unique:false});
          store.createIndex('event_id','event_id',{unique:false});
        }
        if(!db.objectStoreNames.contains(IDB_OFFLINE_SONGS)){
          const store=db.createObjectStore(IDB_OFFLINE_SONGS,{keyPath:'key'});
          store.createIndex('account_id','accountId',{unique:false});
          store.createIndex('event_id','eventId',{unique:false});
          store.createIndex('event_date','eventDate',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('IndexedDB недоступен'));
    }).catch(error=>{console.warn('BandPlan IndexedDB unavailable:',error);return null;});
    return idbPromise;
  }
  function idbRequest(storeName,mode,operation){
    return openOfflineDb().then(db=>new Promise((resolve,reject)=>{
      if(!db)return resolve(null);
      let tx;try{tx=db.transaction(storeName,mode);}catch(error){reject(error);return;}
      const request=operation(tx.objectStore(storeName));
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('IndexedDB operation failed'));
      tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
    })).catch(error=>{console.warn('BandPlan IndexedDB operation failed:',error);return null;});
  }
  async function durableSnapshot(userId){return idbRequest(IDB_SNAPSHOT,'readonly',store=>store.get(userId));}
  async function durableQueue(userId){return idbRequest(IDB_QUEUE,'readonly',store=>store.get(userId));}
  async function writeDurableState(userId,state,updatedAt,pendingSync){
    const record={user_id:userId,state:cloneValue(state||{}),updated_at:updatedAt||new Date().toISOString(),pending_sync:!!pendingSync};
    await idbRequest(IDB_SNAPSHOT,'readwrite',store=>store.put(record));
    if(pendingSync)await idbRequest(IDB_QUEUE,'readwrite',store=>store.put({user_id:userId,state:record.state,updated_at:record.updated_at}));
    else await idbRequest(IDB_QUEUE,'readwrite',store=>store.delete(userId));
  }
  async function hydrateLocalCache(){
    const uid=currentSession?.user?.id;if(!uid)return null;
    const queued=await durableQueue(uid),snapshot=await durableSnapshot(uid),record=queued||snapshot;
    if(!record?.state)return null;
    const state=cloneValue(record.state),pendingSync=!!queued||!!record.pending_sync;
    if(pendingSync)pending=state;
    return {state,updatedAt:record.updated_at||'',pendingSync};
  }
  async function clearDurableQueue(userId){
    await idbRequest(IDB_QUEUE,'readwrite',store=>store.delete(userId));
    const snapshot=await durableSnapshot(userId);
    if(snapshot)await idbRequest(IDB_SNAPSHOT,'readwrite',store=>store.put(Object.assign({},snapshot,{pending_sync:false})));
  }
  async function saveOfflineEventSongs(record){
    const uid=String(currentSession?.user?.id||'');
    const eventId=String(record?.eventId||'').trim();
    if(!uid||!eventId) return false;
    const value=Object.assign({},record,{
      key:uid+':'+eventId,accountId:uid,eventId,
      savedAt:record?.savedAt||new Date().toISOString(),
      version:Number(record?.version||1)
    });
    const result=await idbRequest(IDB_OFFLINE_SONGS,'readwrite',store=>store.put(value));
    return result !== null;
  }
  async function listOfflineEventSongs(){
    const uid=String(currentSession?.user?.id||'');
    if(!uid)return [];
    const db=await openOfflineDb(); if(!db)return [];
    return await new Promise(resolve=>{
      let tx; try{tx=db.transaction(IDB_OFFLINE_SONGS,'readonly');}catch(_){resolve([]);return;}
      const req=tx.objectStore(IDB_OFFLINE_SONGS).index('account_id').getAll(uid);
      req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
      req.onerror=()=>resolve([]);
    });
  }
  async function getOfflineEventSongs(eventId){
    const uid=String(currentSession?.user?.id||''); const id=String(eventId||'').trim();
    if(!uid||!id)return null;
    return idbRequest(IDB_OFFLINE_SONGS,'readonly',store=>store.get(uid+':'+id));
  }
  async function deleteOfflineEventSongs(eventId){
    const uid=String(currentSession?.user?.id||''); const id=String(eventId||'').trim();
    if(!uid||!id)return;
    await idbRequest(IDB_OFFLINE_SONGS,'readwrite',store=>store.delete(uid+':'+id));
  }
  async function clearOfflineEventSongs(){
    const uid=String(currentSession?.user?.id||'');
    if(!uid || !('indexedDB' in window)) return;
    const db=await openOfflineDb(); if(!db)return;
    await new Promise(resolve=>{
      let tx; try{tx=db.transaction(IDB_OFFLINE_SONGS,'readwrite');}catch(_){resolve();return;}
      const req=tx.objectStore(IDB_OFFLINE_SONGS).index('account_id').openCursor(IDBKeyRange.only(uid));
      req.onsuccess=()=>{const cursor=req.result;if(cursor){cursor.delete();cursor.continue();}};
      tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
    });
  }
  async function offlineEventSongsBytes(){
    const rows=await listOfflineEventSongs();
    try{return new Blob([JSON.stringify(rows)]).size;}catch(_){return 0;}
  }
  async function requestStoragePersistence(){
    try{
      if(navigator.storage?.persist && navigator.storage?.persisted){
        if(!(await navigator.storage.persisted())) await navigator.storage.persist();
      }
    }catch(_){}
  }

  async function clearParticipationQueue(userId){
    if(!userId || !('indexedDB' in window)) return;
    const db=await openOfflineDb(); if(!db) return;
    await new Promise(resolve=>{
      let tx;
      try { tx=db.transaction(IDB_PARTICIPATION,'readwrite'); } catch (_) { resolve(); return; }
      const store=tx.objectStore(IDB_PARTICIPATION), req=store.index('user_id').openCursor(IDBKeyRange.only(String(userId)));
      req.onsuccess=()=>{
        const cursor=req.result;
        if(cursor){ cursor.delete(); cursor.continue(); }
      };
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>resolve();
      tx.onabort=()=>resolve();
    });
  }
  async function queueEventParticipation(eventId,status,updatedAt){
    const uid=String(currentSession?.user?.id||'');
    const id=String(eventId||'').trim();
    if(!uid||!id) throw new Error('Требуется вход в аккаунт.');
    const cleanStatus=String(status||'');
    if(cleanStatus&&!['yes','maybe','no'].includes(cleanStatus)) throw new Error('Некорректный статус участия.');
    const stamp=updatedAt||new Date().toISOString();
    await idbRequest(IDB_PARTICIPATION,'readwrite',store=>store.put({
      key:uid+':'+id,user_id:uid,event_id:id,status:cleanStatus,updated_at:stamp,group_id:activeGroupId||null
    }));
    return {queued:true,event_id:id,status:cleanStatus,updated_at:stamp};
  }
  async function participationQueueRows(){
    const uid=String(currentSession?.user?.id||'');
    if(!uid)return [];
    const db=await openOfflineDb(); if(!db)return [];
    return await new Promise(resolve=>{
      let tx;
      try { tx=db.transaction(IDB_PARTICIPATION,'readonly'); } catch (_) { resolve([]); return; }
      const req=tx.objectStore(IDB_PARTICIPATION).index('user_id').getAll(String(uid));
      req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
      req.onerror=()=>resolve([]);
    });
  }
  function participationErrorRetryable(error){
    const code=String(error?.code||'').toUpperCase();
    const msg=String(error?.message||error||'').toLowerCase();
    return !['EVENT_NOT_FOUND','GROUP_REQUIRED','AUTH_REQUIRED','INVALID_PARTICIPATION_STATUS'].includes(code) &&
      !msg.includes('event_not_found') && !msg.includes('group_required') && !msg.includes('auth_required') &&
      !msg.includes('invalid_participation_status') && !msg.includes('permission denied') && !msg.includes('row-level security');
  }
  async function flushEventParticipationQueue(){
    if(!currentSession?.user || navigator.onLine===false) return {sent:0,failed:0};
    const rows=(await participationQueueRows()).sort((a,b)=>String(a.updated_at||'').localeCompare(String(b.updated_at||'')));
    let sent=0,failed=0;
    for(const row of rows){
      try{
        const remote=await writeEventParticipation(row.event_id,row.status,row.updated_at);
        await idbRequest(IDB_PARTICIPATION,'readwrite',store=>store.delete(row.key));
        window.dispatchEvent(new CustomEvent('bandplan:participation-synced',{detail:{
          eventId:row.event_id,status:String(remote?.status||''),updatedAt:String(remote?.updated_at||row.updated_at||'')
        }}));
        sent++;
      }catch(error){
        if(participationErrorRetryable(error)){ failed++; continue; }
        await idbRequest(IDB_PARTICIPATION,'readwrite',store=>store.delete(row.key));
        window.dispatchEvent(new CustomEvent('bandplan:participation-error',{detail:{
          eventId:row.event_id,message:error?.message||'Сервер отклонил отметку участия.'
        }}));
        failed++;
      }
    }
    return {sent,failed};
  }

  const JUST_REGISTERED_KEY = 'bandplan:just-registered';
  const JUST_REGISTERED_EMAIL_KEY = 'bandplan:just-registered-email';
  const hasJustRegisteredFlag = () => { try { return sessionStorage.getItem(JUST_REGISTERED_KEY) === '1'; } catch (_) { return false; } };
  const setJustRegisteredFlag = (email) => {
    try {
      sessionStorage.setItem(JUST_REGISTERED_KEY, '1');
      if (email) sessionStorage.setItem(JUST_REGISTERED_EMAIL_KEY, String(email).trim().toLowerCase());
    } catch (_) {}
  };
  const isJustRegisteredForEmail = (email) => {
    try {
      return hasJustRegisteredFlag() &&
        sessionStorage.getItem(JUST_REGISTERED_EMAIL_KEY) === String(email || '').trim().toLowerCase();
    } catch (_) { return false; }
  };
  const clearJustRegisteredFlag = () => {
    try {
      sessionStorage.removeItem(JUST_REGISTERED_KEY);
      sessionStorage.removeItem(JUST_REGISTERED_EMAIL_KEY);
    } catch (_) {}
  };
  let mode = 'login';
  let passwordRecoveryMode = false;
  function disposeRealtime() {
    realtimeGeneration += 1;
    clearTimeout(refreshTimer);
    refreshTimer = null;
    if (channel) { client.removeChannel(channel); channel = null; }
    if (Array.isArray(groupChannel)) { groupChannel.forEach(ch => client.removeChannel(ch)); groupChannel = null; }
    else if (groupChannel) { client.removeChannel(groupChannel); groupChannel = null; }
    participationChannel = null;
  }
  let authState = 'loading';

  function bindAuthLifecycle() {
    if (authSubscription) return;
    const result = client.auth.onAuthStateChange((authEvent, session) => {
      currentSession = session || null;
      if (authEvent === 'INITIAL_SESSION') {
        authState = 'ready';
        return;
      }
      if (authEvent === 'SIGNED_IN' || authEvent === 'TOKEN_REFRESHED' || authEvent === 'USER_UPDATED') {
        authState = 'ready';
        if (currentSession?.user) {
          window.__bandplanAuthUserId = currentSession.user.id;
          window.dispatchEvent(new CustomEvent('bandplan:auth-ready',{detail:{userId:currentSession.user.id}}));
        }
        return;
      }
      if (authEvent === 'SIGNED_OUT') {
        authState = 'ready';
        clearTimeout(timer);
        pending = null;
        activeGroupId = null;
        activeMemberIds = [];
        lastUpdated = '';
        sharedBaseline = {songs:{},events:{},setlists:{}};
        disposeRealtime();
        mode = 'login';
        if(typeof window.__bandplanHandleSignedOut==='function') {
          window.__bandplanHandleSignedOut();
        }
        // Always rebuild the authentication gate after sign-out. This makes
        // logout deterministic: the authenticated shell is closed and the
        // user is immediately returned to the normal "Вход в аккаунт" screen,
        // including when the previous screen was onboarding/settings or a modal.
        mode = 'login';
        passwordRecoveryMode = false;
        renderGate();

        // A logout must produce a genuinely fresh, empty login form. Mobile
        // browsers and password managers can restore autocomplete/autofill
        // values asynchronously after the DOM is rebuilt, so one immediate
        // reset is not sufficient. Clear both the live value and the default
        // value, then repeat the cleanup on the next frames/ticks. This is
        // scoped only to SIGNED_OUT and never interferes with normal typing,
        // validation rerenders, or password recovery.
        const clearSignedOutForm = () => {
          try {
            const loginForm = document.getElementById('bpAuthForm');
            if (!loginForm) return;
            loginForm.reset();
            loginForm.querySelectorAll('input, textarea, select').forEach(input => {
              input.value = '';
              input.defaultValue = '';
              input.removeAttribute('value');
            });
            loginForm.setAttribute('autocomplete', 'off');
            loginForm.querySelectorAll('input').forEach(input => {
              input.setAttribute('autocomplete', 'off');
            });
          } catch (_) {}
        };
        clearSignedOutForm();
        try {
          requestAnimationFrame(() => {
            clearSignedOutForm();
            requestAnimationFrame(clearSignedOutForm);
          });
        } catch (_) {}
        setTimeout(clearSignedOutForm, 50);
        setTimeout(clearSignedOutForm, 250);
        return;
      }
      if (authEvent === 'PASSWORD_RECOVERY') {
        authState = 'ready';
        mode = 'reset';
        passwordRecoveryMode = true;
        renderGate('Введите новый пароль.');
      }
    });
    authSubscription = result?.data?.subscription || null;
  }
  const cloneValue = value => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const $ = (s, root=document) => root.querySelector(s);
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function setAuthShellLocked(locked) {
    document.documentElement.classList.toggle('bp-auth-required', !!locked);
  }
  function gate() {
    let el = $('#bpAuthGate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bpAuthGate'; el.className = 'bp-auth-gate';
      el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','Вход в BandPlan');
      document.body.appendChild(el);
    }
    return el;
  }
  function renderGate(message, error=false) {
    setAuthShellLocked(true);
    const el = gate();
    const signup = mode === 'signup', reset = mode === 'reset';
    const changingPassword = reset && passwordRecoveryMode;
    el.hidden = false;
    el.innerHTML = '<section class="bp-auth-card"><div class="bp-auth-mark">BP</div><div class="bp-auth-brand">BandPlan</div>' +
      '<h1>' + (signup ? 'Создать аккаунт' : reset ? 'Восстановить пароль' : 'С возвращением') + '</h1>' +
      '<p class="bp-auth-desc">' + (signup ? 'Личный профиль для каждого участника коллектива.' : reset ? 'Отправим ссылку для смены пароля на вашу почту.' : 'Войдите, чтобы открыть свои данные и продолжить работу.') + '</p>' +
      '<form id="bpAuthForm" novalidate>' +
      (signup ? '<label class="bp-auth-label" for="bpAuthName">Имя</label><input id="bpAuthName" class="bp-auth-input" type="text" maxlength="60" autocomplete="name" placeholder="Имя и фамилия" required>' : '') +
      '<label class="bp-auth-label" for="bpAuthEmail">Электронная почта</label><input id="bpAuthEmail" class="bp-auth-input" type="email" autocomplete="email" inputmode="email" enterkeyhint="next" autocapitalize="off" spellcheck="false" placeholder="name@example.com" required>' +
      (reset && !changingPassword ? '' : '<label class="bp-auth-label" for="bpAuthPassword">' + (changingPassword ? 'Новый пароль' : 'Пароль') + '</label><div class="bp-auth-password-wrap"><input id="bpAuthPassword" class="bp-auth-input" type="password" minlength="8" autocomplete="' + ((signup || changingPassword)?'new-password':'current-password') + '" inputmode="text" enterkeyhint="done" placeholder="Не менее 8 символов" required><button type="button" class="bp-auth-password-toggle" id="bpAuthPasswordToggle" aria-label="Показать пароль" aria-pressed="false">Показать</button></div>') +
      '<p class="bp-auth-message ' + (error?'is-error':'') + '" id="bpAuthMessage" role="alert" aria-live="assertive">' + escapeHtml(message || '') + '</p>' +
      '<button class="bp-auth-submit" id="bpAuthSubmit" type="submit">' + (signup?'Зарегистрироваться':reset?'Отправить ссылку':'Войти') + '</button></form>' +
      '<div class="bp-auth-links">' +
      (reset ? '<button type="button" data-auth-mode="login">Вернуться ко входу</button>' :
        (signup ? '<span>Уже есть аккаунт?</span><button type="button" data-auth-mode="login">Войти</button>' :
        '<button type="button" data-auth-mode="signup">Создать аккаунт</button><button type="button" data-auth-mode="reset">Забыли пароль?</button>')) +
      '</div></section>';
    $('#bpAuthForm',el).addEventListener('submit',submitAuth);
    const passwordToggle = $('#bpAuthPasswordToggle', el);
    if (passwordToggle) passwordToggle.addEventListener('click', () => {
      const input = $('#bpAuthPassword', el);
      if (!input) return;
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      passwordToggle.textContent = visible ? 'Показать' : 'Скрыть';
      passwordToggle.setAttribute('aria-label', visible ? 'Показать пароль' : 'Скрыть пароль');
      passwordToggle.setAttribute('aria-pressed', visible ? 'false' : 'true');
      input.focus({preventScroll:true});
    });
    el.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.authMode;renderGate();}));
  }
  function setMessage(message,error=false) {
    const el=$('#bpAuthMessage'); if(el){el.textContent=message;el.classList.toggle('is-error',!!error);}
  }
  function authErrorMessage(error, actionMode='login') {
    const raw = String(error?.message || '').trim();
    const code = String(error?.code || '').toLowerCase();
    const httpStatus = Number(error?.status || 0);
    const text = raw.toLowerCase();

    if (httpStatus === 429 || /too many|rate limit|rate_limit|over_request/.test(text) || code.includes('rate')) {
      return 'Слишком много попыток. Подождите немного и попробуйте снова.';
    }
    if (/invalid login credentials|invalid credentials|invalid email or password/.test(text)) {
      return 'Неверная почта или пароль.';
    }
    if (/email not confirmed|email_not_confirmed|confirm.*email/.test(text)) {
      return 'Почта не подтверждена. Проверьте письмо от Supabase и подтвердите адрес.';
    }
    if (/user already registered|already registered|already been registered/.test(text)) {
      return 'Аккаунт с этой почтой уже существует. Войдите или восстановите пароль.';
    }
    if (/invalid email|email.*invalid/.test(text)) {
      return 'Введите корректный адрес электронной почты.';
    }
    if (/password.*(weak|short)|weak password|password should be/.test(text)) {
      return actionMode === 'signup'
        ? 'Пароль слишком слабый. Используйте не менее 8 символов.'
        : 'Пароль не подходит.';
    }
    if (/abort|timeout|timed out/.test(text)) {
      return 'Запрос превысил время ожидания. Проверьте соединение и попробуйте снова.';
    }
    if (/network|failed to fetch|fetch failed|load failed|offline|connection/.test(text)) {
      return 'Не удалось связаться с сервером. Проверьте интернет-соединение и попробуйте снова.';
    }
    if (actionMode === 'reset' && /not found|user.*not/.test(text)) {
      return 'Не удалось найти аккаунт с этой почтой.';
    }
    return raw || 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form=event.currentTarget, button=$('#bpAuthSubmit');
    const email=$('#bpAuthEmail').value.trim(), password=$('#bpAuthPassword')?.value || '';
    const accountName=$('#bpAuthName')?.value.trim() || '';
    const actionMode = mode;
    const changingPassword = actionMode==='reset' && passwordRecoveryMode;
    /*
      Do not impose the registration password policy on existing logins.
      Supabase must decide whether the stored password is valid. Otherwise an
      older, perfectly valid account can be blocked in the UI before the
      request even reaches Auth. The 8-character rule remains for signup and
      password changes only.
    */
    const passwordTooShort =
      (actionMode==='signup' || changingPassword) && password.length < 8;
    if(!email || (actionMode==='signup' && !accountName) || passwordTooShort || ((actionMode==='login' || actionMode==='reset') && !password && changingPassword)){
      setMessage(
        actionMode==='signup'
          ? 'Укажите имя, почту и пароль не короче 8 символов.'
          : changingPassword
            ? 'Новый пароль должен быть не короче 8 символов.'
            : 'Укажите почту и пароль.',
        true
      );
      return;
    }
    button.disabled=true;
    button.textContent='Подождите…';
    try {
      let result;
      if(actionMode==='signup') {
        result=await client.auth.signUp({
          email,
          password,
          options:{data:{full_name:accountName,bandplan_onboarding_required:true}}
        });
        if(result.error) throw result.error;
        if(result.data?.session?.user) {
          currentSession=result.data.session;
          authState='ready';
          setJustRegisteredFlag(email);
        }
      } else if(actionMode==='reset') {
        if (passwordRecoveryMode) {
          result=await client.auth.updateUser({password});
          if(result.error) throw result.error;
          passwordRecoveryMode=false;
        } else {
          result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});
          if(result.error) throw result.error;
        }
      } else {
        result=await client.auth.signInWithPassword({email,password});
        if(result.error) throw result.error;
        const session=result.data?.session;
        if(!session?.user) throw new Error('Supabase не вернул пользователя после входа.');
        currentSession=session;
        authState='ready';
      }

      if(actionMode==='signup' && !result.data?.session) {
        renderGate('Аккаунт создан. Проверьте почту и подтвердите адрес, затем войдите.');
        return;
      }
      if(actionMode==='reset') {
        if (changingPassword) {
          mode='login';
          renderGate('Пароль изменён. Теперь войдите с новым паролем.');
        } else {
          renderGate('Если адрес зарегистрирован, на него отправлена ссылка для восстановления.');
        }
        return;
      }

      if(!currentSession?.user) throw new Error('Сессия не создана. Попробуйте войти ещё раз.');
      if(actionMode==='login' && !isJustRegisteredForEmail(currentSession.user.email)) clearJustRegisteredFlag();
      setAuthShellLocked(false);
      gate().hidden=true;

      // The auth module remains the single source of truth. The app shell is
      // resumed exactly once after sign-in; no second auth client is created.
      if(typeof window.__bandplanResumeAuthenticated==='function') {
        await window.__bandplanResumeAuthenticated(currentSession.user);
      } else if (typeof window.__bandplanEnsureCore === 'function') {
        await window.__bandplanEnsureCore();
        if (typeof window.__bandplanResumeAuthenticated !== 'function') throw new Error('Не удалось загрузить рабочее пространство BandPlan.');
        await window.__bandplanResumeAuthenticated(currentSession.user);
      } else {
        throw new Error('Не удалось загрузить рабочее пространство BandPlan.');
      }
    } catch(err) {
      console.error('BandPlan authentication request failed:', err);
      setMessage(authErrorMessage(err, actionMode),true);
      button.disabled=false;
      button.textContent=actionMode==='signup'?'Зарегистрироваться':changingPassword?'Сохранить новый пароль':actionMode==='reset'?'Отправить ссылку':'Войти';
    }
  }
  let authInitPromise = null;
  async function initialize() {
    if (authInitPromise) return authInitPromise;
    authInitPromise = (async () => {
      bindAuthLifecycle();
      authState='loading';

      // Keep the auth gate hidden for the entire initial session resolution.
      // Login/onboarding is rendered only after Supabase has definitively
      // reported that there is no persisted session.
      gate().hidden=true;

      const {data,error}=await client.auth.getSession();
      if(error) {
        console.error('BandPlan session check failed:', error);
        currentSession=null;
        authState='ready';
        mode='login';
        renderGate('Не удалось восстановить вход. Войдите снова.',true);
        return null;
      }

      currentSession=data?.session||null;
      authState='ready';
      if(currentSession?.user) {
        cleanupLegacyAuthStorage();
        setAuthShellLocked(false);
        gate().hidden=true;
        window.__bandplanAuthUserId = currentSession.user.id;
        window.dispatchEvent(new CustomEvent('bandplan:auth-ready',{detail:{userId:currentSession.user.id}}));
        if (typeof window.__bandplanEnsureCore === 'function') {
          await window.__bandplanEnsureCore();
          if (typeof window.__bandplanResumeAuthenticated !== 'function') throw new Error('Не удалось загрузить рабочее пространство BandPlan.');
          await window.__bandplanResumeAuthenticated(currentSession.user);
        }
        return currentSession.user;
      }

      cleanupLegacyAuthStorage();
      mode='login';
      renderGate();
      return null;
    })();
    try {
      return await authInitPromise;
    } finally {
      authInitPromise = null;
    }
  }
  function hydratePersonalEventParticipation(events, profile) {
    const nextProfile = Object.assign({}, profile || {});
    const map = nextProfile.eventParticipation && typeof nextProfile.eventParticipation === 'object'
      ? Object.assign({}, nextProfile.eventParticipation) : {};
    const cleanEvents = (events || []).map(raw => {
      const ev = Object.assign({}, raw || {});
      const id = String(ev.id || '').trim();
      if (id && !map[id] && ev.myStatus) map[id] = ev.myStatus;
      delete ev.myStatus;
      return ev;
    });
    nextProfile.eventParticipation = map;
    return { events: cleanEvents, profile: nextProfile };
  }
  async function hasAccountIdentity() {
    const user=currentSession?.user;
    if(!user) return false;

    // The auth user's metadata is a durable cross-device marker that the
    // one-time profile onboarding has already been completed. It is checked
    // first so a temporary profile/RLS/network failure can never turn an
    // existing account into a "new" account again.
    if(user.user_metadata?.bandplan_onboarding_done===true) return true;

    try {
      const { data, error } = await client.from('bandplan_accounts')
        .select('user_id,display_name,roles')
        .eq('user_id', user.id)
        .maybeSingle();
      // The account row itself is the durable profile existence signal.
      // Do not require a particular name/role shape here: older accounts can
      // have partial profile data and must never be sent through onboarding
      // again just because one profile field is temporarily empty.
      if(!error && data?.user_id === user.id) return true;
      if(error) console.warn('BandPlan account identity check failed:', error);
    } catch(error) {
      console.warn('BandPlan account identity check failed:', error);
    }

    /*
      Do not treat IndexedDB/local state as proof that the account exists.
      A stale or partially-created local profile must not suppress the
      first-run wizard forever. The authoritative identity is the Supabase
      account row (or the durable auth metadata marker above).
    */
    return false;
  }

  async function markOnboardingComplete() {
    if(!currentSession?.user) return;
    try {
      const result=await client.auth.updateUser({
        data:{bandplan_onboarding_done:true,bandplan_onboarding_required:false}
      });
      if(result.error) throw result.error;
      currentSession=result.data?.user ? Object.assign({},currentSession,{user:result.data.user}) : currentSession;
    } catch(error) {
      // The database/account row remains the source of truth; metadata is an
      // additional durable guard against showing onboarding on a later login.
      console.warn('BandPlan onboarding marker update failed:',error);
    }
  }

  async function load() {
    if(!currentSession?.user) throw new Error('Требуется вход в аккаунт.');
    const uid=currentSession.user.id;
    const personal=await client.from(TABLE).select('state,updated_at').eq('user_id',uid).maybeSingle();
    if(personal.error) throw personal.error;
    const pstate=personal.data?.state||{};lastUpdated=personal.data?.updated_at||'';
    const groupLookup=await client.rpc('bandplan_get_my_group');
    if(groupLookup.error)throw groupLookup.error;
    const groupRow=Array.isArray(groupLookup.data)?groupLookup.data[0]:groupLookup.data;
    activeGroupId=groupRow?.group_id||null;

    /*
      The account row is the durable identity source for the member's name and
      roles. Keep the personal snapshot as the primary source, but hydrate
      missing/stale role data from the account so a fresh device never asks
      the member to choose the role again.
    */
    let accountProfile=null;
    try{
      const account=await client.from('bandplan_accounts').select('display_name,roles,personal_settings').eq('user_id',uid).maybeSingle();
      if(!account.error) accountProfile=account.data||null;
    }catch(e){ console.warn('BandPlan account profile hydration skipped:',e); }
    const profile=Object.assign({},pstate.profile||{});
    if(activeGroupId) profile.groupId=activeGroupId;
    if(accountProfile?.display_name) profile.name=accountProfile.display_name;
    if(Array.isArray(accountProfile?.roles)&&accountProfile.roles.length){
      profile.roles=accountProfile.roles.slice();
      profile.role=profile.roles[0]||'';
    }
    const accountSettings=accountProfile?.personal_settings&&typeof accountProfile.personal_settings==='object' ? accountProfile.personal_settings : {};
    const settings=Object.assign({},accountSettings,pstate.settings||{});
    const hasAccountIdentity=accountProfile?.user_id===uid;
    const hydratedPersonal=Object.assign({},pstate,{profile,settings,onboardingDone:!!(pstate.onboardingDone||hasAccountIdentity)});
    const personalEvents=hydratePersonalEventParticipation(pstate.events||[],profile);
    if(!activeGroupId){
      delete profile.groupId;
      sharedBaseline={songs:{},events:{},setlists:{}};
      activeMemberIds=[];
      if(!(personal.data||accountProfile)) return null;
      return {
        state:Object.assign({},hydratedPersonal,{
          profile:personalEvents.profile,
          songs:[],
          events:[],
          setlists:[],
          members:[]
        }),
        updatedAt:lastUpdated
      };
    }
    const [songs,events,setlists,gs,memberRows,groupInfo,participation]=await Promise.all([
      client.from('bandplan_songs').select('data').eq('group_id',activeGroupId),
      client.from('bandplan_events').select('data').eq('group_id',activeGroupId),
      client.from('bandplan_setlists').select('data').eq('group_id',activeGroupId),
      client.from('bandplan_group_state').select('state').eq('group_id',activeGroupId).maybeSingle(),
      client.from('bandplan_group_members').select('user_id').eq('group_id',activeGroupId),
      client.from('bandplan_groups').select('name').eq('id',activeGroupId).maybeSingle(),
      client.from('bandplan_event_participation').select('event_id,user_id,status,updated_at').eq('group_id',activeGroupId)
    ]);
    for(const q of [songs,events,setlists,gs,memberRows,groupInfo,participation])if(q.error)throw q.error;
    const toSharedMap=rows=>Object.fromEntries((rows||[]).map(x=>{const data=x.data||{};const id=String(data.id||'').trim();return id?[id,JSON.stringify(data)]:null;}).filter(Boolean));
    sharedBaseline={songs:toSharedMap(songs.data),events:toSharedMap(events.data),setlists:toSharedMap(setlists.data)};
    const shared=gs.data?.state||{}, ids=(memberRows.data||[]).map(x=>x.user_id).filter(Boolean);
    activeMemberIds=ids.slice(0,100);
    let accounts=[];
    if(ids.length){const a=await client.from('bandplan_accounts').select('user_id,display_name,roles').in('user_id',ids);if(a.error)throw a.error;accounts=a.data||[];}
    const roster=Array.isArray(shared.members)?shared.members.slice():(pstate.members||[]);
    accounts.forEach(a=>{
      if(!a.display_name)return;
      const existing=roster.find(m=>m.accountId===a.user_id||m.id===a.user_id||String(m.name||'').trim().toLowerCase()===a.display_name.trim().toLowerCase());
      if(existing){existing.name=a.display_name;existing.roles=a.roles||existing.roles;existing.role=(a.roles||[])[0]||existing.role;existing.accountId=a.user_id;}
      else roster.push({id:a.user_id,accountId:a.user_id,name:a.display_name,roles:a.roles||[],role:(a.roles||[])[0]||'',note:''});
    });
    const groupProfile=Object.assign({},profile);if(groupInfo.data?.name)groupProfile.bandName=groupInfo.data.name;
    const participationByEvent={}, participationUpdatedAtByEvent={};
    (participation.data||[]).forEach(row=>{
      const eventId=String(row.event_id||'').trim(),userId=String(row.user_id||'').trim();
      if(!eventId||!userId)return;
      if(!participationByEvent[eventId])participationByEvent[eventId]={};
      if(!participationUpdatedAtByEvent[eventId])participationUpdatedAtByEvent[eventId]={};
      if(row.status)participationByEvent[eventId][userId]=String(row.status);
      if(row.updated_at)participationUpdatedAtByEvent[eventId][userId]=String(row.updated_at);
    });
    const baseEvents=(events.data||[]).map(x=>x.data).map(ev=>{
      const copy=Object.assign({},ev);
      // The participation table is the source of truth. Always replace the
      // embedded map, including with an empty map after a user clears a status.
      copy.participation=Object.assign({},participationByEvent[String(ev?.id||'').trim()]||{});
      copy.participationUpdatedAt=Object.assign({},participationUpdatedAtByEvent[String(ev?.id||'').trim()]||{});
      return copy;
    });
    const hydratedEvents=hydratePersonalEventParticipation(baseEvents,groupProfile);
    return {state:Object.assign({},pstate,{profile:hydratedEvents.profile,songs:(songs.data||[]).map(x=>x.data),events:hydratedEvents.events,setlists:(setlists.data||[]).map(x=>x.data),members:roster}),updatedAt:lastUpdated};
  }
  function assertSessionOwner(userId){
    if(!currentSession?.user?.id || currentSession.user.id!==userId){
      const error=new Error('Сессия аккаунта изменилась. Синхронизация старого состояния отменена.');
      error.code='BANDPLAN_SESSION_CHANGED';
      throw error;
    }
  }
  async function saveNow(state) {
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    const snapshot=JSON.parse(JSON.stringify(state||{})),uid=currentSession.user.id,updatedAt=new Date().toISOString();
    assertSessionOwner(uid);
    snapshot.events=(snapshot.events||[]).map(ev=>{const copy=Object.assign({},ev);delete copy.myStatus;return copy;});
    clearTimeout(timer);pending=snapshot;
    await writeDurableState(uid,snapshot,updatedAt,true);
    assertSessionOwner(uid);
    if(!activeGroupId){
      assertSessionOwner(uid);
      const membership=await client.rpc('bandplan_get_my_group');
      assertSessionOwner(uid);
      if(membership.error)throw membership.error;
      const row=Array.isArray(membership.data)?membership.data[0]:membership.data;
      activeGroupId=row?.group_id||null;
    }
    if(activeGroupId) snapshot.profile=Object.assign({},snapshot.profile||{}, {groupId:activeGroupId, groupDetached:false});
    if(!activeGroupId&&snapshot.onboardingDone&&!snapshot.profile?.groupDetached){
      if(!groupSetupPromise)groupSetupPromise=(async()=>{
        assertSessionOwner(uid);
        const made=await client.rpc('bandplan_create_group',{p_name:snapshot.profile?.bandName||'Моя группа',p_display_name:snapshot.profile?.name||'',p_roles:snapshot.profile?.roles||(snapshot.profile?.role?[snapshot.profile.role]:[])});
        if(made.error)throw made.error;
        assertSessionOwner(uid);
        activeGroupId=made.data?.[0]?.group_id||made.data?.group_id||null;
        return activeGroupId;
      })().finally(()=>{groupSetupPromise=null;});
      await groupSetupPromise;
    }
    if(activeGroupId){
      if(String(snapshot.profile?.bandName||'').trim().length>=3){
        assertSessionOwner(uid);
        const renamed=await client.rpc('bandplan_rename_group',{p_name:snapshot.profile.bandName});
        if(renamed.error){pending=snapshot;throw renamed.error;}
        assertSessionOwner(uid);
      }
      const songs=snapshot.songs||[],events=snapshot.events||[],setlists=snapshot.setlists||[];
      /*
        Shared records are synchronized as deltas, not as the entire local
        snapshot. This prevents a stale client from overwriting another
        member's newer song/event/setlist when it saves unrelated changes.
      */
      const delta=(baseline,current)=>{
        const rows=[],currentIds=new Set();
        (current||[]).forEach(row=>{
          const id=String(row?.id||'').trim();
          if(!id)return;
          currentIds.add(id);
          const serialized=JSON.stringify(row);
          if(baseline[id]!==serialized)rows.push(row);
        });
        const deleted=Object.keys(baseline).filter(id=>!currentIds.has(id));
        return {rows,deleted};
      };
      const songDelta=delta(sharedBaseline.songs,songs);
      const eventDelta=delta(sharedBaseline.events,events);
      const setlistDelta=delta(sharedBaseline.setlists,setlists);
      assertSessionOwner(uid);
      const sync=await client.rpc('bandplan_sync_group',{
        p_songs:songDelta.rows,
        p_events:eventDelta.rows,
        p_setlists:setlistDelta.rows,
        p_roster:(snapshot.members||[]).map(m=>({
          id:m?.id||m?.accountId||'',
          accountId:m?.accountId||m?.id||'',
          name:m?.name||'',
          roles:Array.isArray(m?.roles)?m.roles.slice():(m?.role?[m.role]:[]),
          role:m?.role||'',
          note:m?.note||''
        })).filter(m=>m.name),
        p_display_name:snapshot.profile?.name||'',
        p_roles:snapshot.profile?.roles||(snapshot.profile?.role?[snapshot.profile.role]:[]),
        p_personal_settings:snapshot.settings||{},
        p_delete_songs:songDelta.deleted,
        p_delete_events:eventDelta.deleted,
        p_delete_setlists:setlistDelta.deleted
      });
      if(sync.error){pending=snapshot;throw sync.error;}
      assertSessionOwner(uid);
      sharedBaseline={
        songs:Object.fromEntries(songs.map(x=>[String(x.id),JSON.stringify(x)]).filter(([id])=>id)),
        events:Object.fromEntries(events.map(x=>[String(x.id),JSON.stringify(x)]).filter(([id])=>id)),
        setlists:Object.fromEntries(setlists.map(x=>[String(x.id),JSON.stringify(x)]).filter(([id])=>id))
      };
    }
    assertSessionOwner(uid);
    const personalState={profile:snapshot.profile||{},settings:snapshot.settings||{},onboardingDone:!!snapshot.onboardingDone};
    const {data,error}=await client.from(TABLE).upsert({user_id:uid,state:personalState,updated_at:updatedAt},{onConflict:'user_id'}).select('updated_at').single();
    if(error){pending=snapshot;await writeDurableState(uid,snapshot,updatedAt,true);throw error;}
    assertSessionOwner(uid);
    lastUpdated=data?.updated_at||updatedAt;
    const latestPending=pending&&JSON.stringify(pending)!==JSON.stringify(snapshot)?JSON.parse(JSON.stringify(pending)):null;
    if(latestPending)await writeDurableState(uid,latestPending,new Date().toISOString(),true);
    else{pending=null;await clearDurableQueue(uid);}
    return lastUpdated;
  }
  function schedule(state) {
    if(!currentSession?.user)return;
    pending=JSON.parse(JSON.stringify(state||{}));clearTimeout(timer);
    timer=setTimeout(()=>{if(pending)saveNow(pending).catch(e=>{console.warn('BandPlan account save failed:',e);window.dispatchEvent(new CustomEvent('bandplan:sync-error',{detail:e?.message||'Ошибка синхронизации'}));});},350);
  }
  function subscribe(onState,onParticipation) {
    if(!currentSession?.user)return ()=>{};
    subscriptionCallback=onState;
    participationCallback=typeof onParticipation === 'function' ? onParticipation : null;
    const uid=currentSession.user.id;
    disposeRealtime();
    const generation = realtimeGeneration;
    const handleStatus = (label, status, error) => {
      if (generation !== realtimeGeneration) return;
      if (label === 'shared' && status === 'SUBSCRIBED') realtimeSharedReady = true;
      if (label === 'shared' && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) realtimeSharedReady = false;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('BandPlan realtime '+label+' '+status, error || '');
        window.dispatchEvent(new CustomEvent('bandplan:sync-error',{detail:'Realtime-синхронизация временно недоступна'}));
      }
    };
    channel=client.channel('bp-personal-'+uid).on('postgres_changes',{event:'*',schema:'public',table:TABLE,filter:'user_id=eq.'+uid},payload=>{
      const row=payload?.new;if(!row?.state||(row.updated_at&&row.updated_at===lastUpdated))return;
      lastUpdated=row.updated_at||'';
      load().then(x=>{if(x?.state)onState(x.state,row.updated_at||'');}).catch(e=>console.warn('Personal sync refresh failed',e));
    }).subscribe(status => handleStatus('personal', status));
    let live=client.channel('bp-shared-'+uid);
    const refreshShared=()=>{if(!activeGroupId)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{
      load().then(x=>{if(x?.state)onState(x.state,x.updatedAt||'');}).catch(e=>console.warn('Shared sync refresh failed',e));
    },200);};
    const sharedSubscriptions=[
      ['bandplan_songs',['group_id','id','updated_at']],
      ['bandplan_events',['group_id','id','updated_at']],
      ['bandplan_setlists',['group_id','id','updated_at']],
      ['bandplan_group_state',['group_id','updated_at']]
    ];
    sharedSubscriptions.forEach(([table,select])=>{
      live=live.on('postgres_changes',{event:'*',schema:'public',table,filter:'group_id=eq.'+activeGroupId,select},payload=>{
        const gid=payload?.new?.group_id||payload?.old?.group_id;
        if(gid===activeGroupId)refreshShared();
      });
    });
    live=live.on('postgres_changes',{event:'*',schema:'public',table:'bandplan_groups',filter:'id=eq.'+activeGroupId,select:['id']},refreshShared);
    // Only listen for accounts belonging to the current group. The old global
    // subscription caused every account update in the project to wake every client.
    if(activeMemberIds.length){
      const memberFilter='user_id=in.('+activeMemberIds.join(',')+')';
      live=live.on('postgres_changes',{event:'*',schema:'public',table:'bandplan_accounts',filter:memberFilter,select:['user_id','updated_at']},refreshShared);
    }
    live=live.on('postgres_changes',{event:'*',schema:'public',table:'bandplan_group_members',filter:'group_id=eq.'+activeGroupId,select:['group_id','user_id']},refreshShared);
    const sharedChannel=live.subscribe(status => handleStatus('shared', status));
    participationChannel=client.channel('bp-participation-'+activeGroupId)
      .on('broadcast',{event:'participation'},payload=>{
        const data=payload?.payload;
        if(data?.event_id&&data?.user_id&&typeof participationCallback==='function') participationCallback(data);
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'bandplan_event_participation',filter:'group_id=eq.'+activeGroupId},payload=>{
        if(generation !== realtimeGeneration) return;
        const row=payload?.new||payload?.old;
        if(!row?.event_id||!row?.user_id) return;
        if(typeof participationCallback==='function') participationCallback({
          group_id:row.group_id,event_id:String(row.event_id),user_id:String(row.user_id),
          status:payload?.event==='DELETE'?'':String(row.status||''),
          updated_at:row.updated_at||new Date().toISOString(),deleted:payload?.event==='DELETE'
        });
      }).subscribe(status=>handleStatus('participation',status));
    groupChannel=[sharedChannel,participationChannel];
    /* Realtime/WebSocket is primary. Poll only while the shared channel is degraded. */
    realtimePollTimer=setInterval(()=>{
      if(!currentSession?.user||!activeGroupId||navigator.onLine===false||realtimeSharedReady||document.hidden)return;
      load().then(x=>{if(x?.state&&subscriptionCallback)subscriptionCallback(x.state,x.updatedAt||'');})
        .catch(e=>console.warn('BandPlan fallback refresh failed',e));
    },30000);
    return ()=>disposeRealtime();
  }
  async function joinGroup(code,name,roles){
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    const normalizedCode=String(code||'').toUpperCase().replace(/[^0-9A-F]/g,'');
    if(!normalizedCode)throw new Error('Введите код приглашения.');
    const {data,error}=await client.rpc('bandplan_join_group',{
      p_code:normalizedCode,
      p_display_name:String(name||'').trim(),
      p_roles:Array.isArray(roles)?roles:[]
    });
    if(error)throw error;
    activeGroupId=data?.[0]?.group_id||null;
    if(activeGroupId && subscriptionCallback){
      try { await load(); } catch(e) { console.warn('BandPlan group hydration after join deferred:',e); }
      subscribe(subscriptionCallback,participationCallback);
    }
    return data?.[0]||null;
  }
  async function writeEventParticipation(eventId,status,updatedAt){
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    const uid=String(currentSession.user.id);
    const id=String(eventId||'').trim();
    const cleanStatus=String(status||'');
    if(!id)throw new Error('Не удалось определить событие.');
    if(cleanStatus&&!['yes','maybe','no'].includes(cleanStatus))throw new Error('Некорректный статус участия.');
    const stamp=updatedAt||new Date().toISOString();
    const {data,error}=await client.rpc('bandplan_set_event_participation',{
      p_event_id:id,
      p_status:cleanStatus,
      p_updated_at:stamp
    });
    if(error)throw error;
    // Postgres functions returning TABLE produce an array, while scalar/json
    // functions may return an object. Normalize both before broadcasting.
    const row=Array.isArray(data)?data[0]:data;
    const result=Object.assign({
      group_id:activeGroupId,event_id:id,user_id:uid,status:cleanStatus,updated_at:new Date().toISOString()
    },row&&typeof row==='object'?row:{});
    result.event_id=String(result.event_id||id);
    result.user_id=String(result.user_id||uid);
    result.status=String(result.status||'');
    if(participationChannel){
      try{
        await participationChannel.send({type:'broadcast',event:'participation',payload:{
          group_id:result.group_id||activeGroupId,event_id:result.event_id,user_id:result.user_id,
          status:result.status,updated_at:result.updated_at||new Date().toISOString(),deleted:!result.status
        }});
      }catch(broadcastError){
        // The database write has already succeeded; realtime delivery may retry via DB changes.
        console.warn('BandPlan participation broadcast failed:',broadcastError);
      }
    }
    return result;
  }
  async function setEventParticipation(eventId,status,updatedAt){
    const stamp=updatedAt||new Date().toISOString();
    return writeEventParticipation(eventId,status,stamp);
  }
  async function deleteAccount(){
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    clearTimeout(timer);
    pending=null;
    disposeRealtime();
    const uid=currentSession.user.id;
    const {error}=await client.rpc('bandplan_delete_my_account');
    if(error)throw error;

    /*
      The RPC deletes the server-side account. Explicitly revoke the local
      Supabase session while currentSession is still populated; otherwise the
      public signOut wrapper below can become a no-op after we null it.
    */
    try{await client.auth.signOut({scope:'local'});}catch(signOutError){
      console.warn('BandPlan local Auth sign-out after account deletion failed:',signOutError);
    }
    try{await clearLocalCache();}catch(e){}
    try{await clearOfflineEventSongs();}catch(e){}
    try{localStorage.clear();}catch(e){}
    activeGroupId=null;
    lastUpdated='';
    sharedBaseline={songs:{},events:{},setlists:{}};
    currentSession=null;
    return uid;
  }
  async function getInviteCode(){
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    const profileName=String(arguments[0]||'').trim();
    const roles=Array.isArray(arguments[1])?arguments[1]:[];
    const {data,error}=await client.rpc('bandplan_create_group_and_invite',{
      p_name:profileName||'Моя группа',
      p_display_name:profileName,
      p_roles:roles
    });
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.invite_code)throw new Error('Supabase не вернул код приглашения.');
    const previousGroupId=activeGroupId;
    activeGroupId=row.group_id||activeGroupId||null;
    if(activeGroupId && activeGroupId!==previousGroupId && subscriptionCallback){
      try { await load(); } catch(e) { console.warn('BandPlan group hydration after creation deferred:',e); }
      subscribe(subscriptionCallback,participationCallback);
    }
    return {code:String(row.invite_code).trim().toUpperCase(),groupId:activeGroupId,groupName:row.group_name||''};
  }
  window.addEventListener('online',async()=>{
    if(!currentSession?.user)return;
    try{await hydrateLocalCache();}catch(e){console.warn('BandPlan durable queue restore failed:',e);}
    try{await flushEventParticipationQueue();}catch(e){console.warn('BandPlan participation queue flush failed:',e);}
    if(pending){
      const snap=JSON.parse(JSON.stringify(pending));
      try{
        await saveNow(snap);
        if(subscriptionCallback)subscribe(subscriptionCallback,participationCallback);
      }catch(e){
        console.warn('BandPlan reconnect sync failed:',e);
        window.dispatchEvent(new CustomEvent('bandplan:sync-error',{detail:e?.message||'Ошибка синхронизации'}));
      }
    } else if(subscriptionCallback && activeGroupId && !groupChannel){
      subscribe(subscriptionCallback,participationCallback);
    }
  });
  async function clearLocalCache(){
    const uid=currentSession?.user?.id;
    if(!uid)return;
    pending=null;
    await idbRequest(IDB_QUEUE,'readwrite',store=>store.delete(uid));
    await idbRequest(IDB_SNAPSHOT,'readwrite',store=>store.delete(uid));
    await clearParticipationQueue(uid);
    await clearOfflineEventSongs();
  }
  async function leaveGroup(){
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    clearTimeout(timer);
    pending=null;
    disposeRealtime();
    const uid=currentSession.user.id;
    const {data,error}=await client.rpc('bandplan_leave_group');
    if(error)throw error;

    // The RPC removes membership, clears group data, preserves personal settings,
    // and updates the shared roster atomically.
    // Verify the membership is actually gone before reporting success.
    const check=await client.from('bandplan_group_members').select('group_id').eq('user_id',uid).limit(1).maybeSingle();
    if(check.error)throw check.error;
    if(check.data?.group_id)throw new Error('Не удалось удалить членство в группе.');

    activeGroupId=null;
    lastUpdated='';
    sharedBaseline={songs:{},events:{},setlists:{}};
    await clearLocalCache();
    return Array.isArray(data)?(data[0]||null):(data||null);
  }
  async function signOut(){
    clearTimeout(timer);pending=null;disposeRealtime();
    const uid=currentSession?.user?.id;
    if(uid) await clearParticipationQueue(uid);
    await clearOfflineEventSongs();
    await client.auth.signOut();
  }
  requestStoragePersistence();
  openOfflineDb().catch(error=>console.warn('BandPlan IndexedDB initialization deferred:',error));
  window.BandPlanCloud={client,initialize,user:()=>currentSession?.user||null,authState:()=>authState,load,saveNow,schedule,subscribe,signOut,leaveGroup,clearLocalCache,joinGroup,getInviteCode,setEventParticipation,queueEventParticipation,flushEventParticipationQueue,saveOfflineEventSongs,listOfflineEventSongs,getOfflineEventSongs,deleteOfflineEventSongs,clearOfflineEventSongs,offlineEventSongsBytes,deleteAccount,hydrateLocalCache,hasAccountIdentity,markOnboardingComplete,isJustRegistered:hasJustRegisteredFlag,clearJustRegistered:clearJustRegisteredFlag};
  initialize().catch(error=>console.error('BandPlan auth initialization failed:',error));
})();
