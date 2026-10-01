/* BandPlan — Supabase Auth + per-user cloud sync */
(function () {
  'use strict';

  const URL = 'https://oczcjphvzoadfqntoqlc.supabase.co';
  const KEY = 'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY';
  const STATE_TABLE = 'bandplan_user_state';
  const LEGACY_TABLE = 'bandplan_state';
  const PROFILE_TABLE = 'bandplan_profiles';
  const FRIEND_TABLE = 'bandplan_friendships';
  const GROUP_STATE_TABLE = 'bandplan_group_state';
  const GROUP_ACTIVE_PREFIX = 'bandplan.activeGroup:';
  const REGISTER_FN = URL + '/functions/v1/bandplan-register';

  const client = window.supabase.createClient(URL, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  let currentSession = null;
  let currentProfile = null;
  let realtimeStop = null;
  const listeners = [];

  function usernameEmail(username) {
    const normalized = String(username || '').trim().toLowerCase();
    // Keep compatibility with existing Latin accounts; encode Unicode nicks
    // into an ASCII-only synthetic email accepted by Supabase Auth.
    if (/^[a-z0-9_.-]+$/.test(normalized)) return normalized + '@users.bandplan.local';
    const hex = Array.from(new TextEncoder().encode(normalized), b => b.toString(16).padStart(2, '0')).join('');
    return 'bp-' + hex + '@users.bandplan.local';
  }

  async function checkUsername(username) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!/^[a-zа-яё0-9_.-]{3,24}$/i.test(normalized)) {
      return { available: false, error: 'Ник: 3–24 символа, только буквы, цифры, _, ., -' };
    }
    const res = await fetch(REGISTER_FN, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'check_username', username: normalized })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Не удалось проверить ник');
    return body;
  }

  function emit(event, session) {
    listeners.slice().forEach(fn => {
      try { fn(event, session); } catch (e) { console.warn('BandPlan auth listener:', e); }
    });
  }

  async function loadProfile() {
    if (!currentSession) { currentProfile = null; return null; }
    const { data, error } = await client
      .from(PROFILE_TABLE)
      .select('id,username,friend_code,created_at')
      .eq('id', currentSession.user.id)
      .maybeSingle();
    if (error) throw error;
    currentProfile = data || null;
    return currentProfile;
  }

  async function signIn(username, password) {
    const { data, error } = await client.auth.signInWithPassword({
      email: usernameEmail(username),
      password
    });
    if (error) throw error;
    currentSession = data.session;
    await loadProfile();
    if (currentSession && currentSession.user) localStorage.setItem('bandplan.auth.userId', currentSession.user.id);
    return currentProfile;
  }

  function redirectUrl() {
    return window.location.origin + window.location.pathname;
  }

  async function signInWithProvider(provider) {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl(),
        queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'select_account' } : undefined
      }
    });
    if (error) throw error;
    return data;
  }

  async function ensureOAuthProfile() {
    if (!currentSession || !currentSession.access_token) return null;
    const existing = await loadProfile();
    if (existing) return existing;
    const res = await fetch(REGISTER_FN, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + currentSession.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'oauth' })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Не удалось создать профиль OAuth');
    await loadProfile();
    return currentProfile;
  }

  async function register(username, password) {
    const res = await fetch(REGISTER_FN, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Не удалось зарегистрировать аккаунт');
    await signIn(username, password);
    return body;
  }

  async function signOut() {
    if (realtimeStop) { try { realtimeStop(); } catch (e) {} realtimeStop = null; }
    await client.auth.signOut();
    currentSession = null;
    currentProfile = null;
    try {
      localStorage.removeItem('bandplan.premium.v6');
      localStorage.removeItem('bandplan.auth.userId');
    } catch (e) {}
    emit('SIGNED_OUT', null);
  }

  async function addFriendByCode(code) {
    if (!currentSession) throw new Error('Сначала войдите в аккаунт');
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(normalized)) throw new Error('Код должен содержать 12 символов');
    const { data: friend, error: findError } = await client
      .from(PROFILE_TABLE)
      .select('id,username,friend_code')
      .eq('friend_code', normalized)
      .maybeSingle();
    if (findError) throw findError;
    if (!friend) throw new Error('Пользователь с таким кодом не найден');
    if (friend.id === currentSession.user.id) throw new Error('Нельзя добавить самого себя');

    const { error } = await client.from(FRIEND_TABLE).insert({
      user_id: currentSession.user.id,
      friend_id: friend.id
    });
    if (error && error.code !== '23505') throw error;
    return friend;
  }

  async function getFriends() {
    if (!currentSession) return [];
    const { data: links, error } = await client
      .from(FRIEND_TABLE)
      .select('user_id,friend_id,created_at')
      .or('user_id.eq.' + currentSession.user.id + ',friend_id.eq.' + currentSession.user.id);
    if (error) throw error;
    const ids = (links || []).map(x => x.user_id === currentSession.user.id ? x.friend_id : x.user_id);
    if (!ids.length) return [];
    const { data: profiles, error: profileError } = await client
      .from(PROFILE_TABLE)
      .select('id,username,friend_code')
      .in('id', ids);
    if (profileError) throw profileError;
    return profiles || [];
  }

  function activeGroupId() {
    if (!currentSession || !currentSession.user) return null;
    try { return localStorage.getItem(GROUP_ACTIVE_PREFIX + currentSession.user.id) || null; }
    catch (_) { return null; }
  }

  function groupPayload(snapshot) {
    return {
      members: Array.isArray(snapshot.members) ? snapshot.members : [],
      events: Array.isArray(snapshot.events) ? snapshot.events : [],
      songs: Array.isArray(snapshot.songs) ? snapshot.songs : [],
      setlists: Array.isArray(snapshot.setlists) ? snapshot.setlists : []
    };
  }

  async function joinGroup(name, initialState) {
    if (!currentSession) throw new Error('AUTH_REQUIRED');
    const groupName = String(name || '').trim();
    if (groupName.length < 3 || groupName.length > 50) throw new Error('Название группы должно содержать от 3 до 50 символов');
    const { data, error } = await client.rpc('bandplan_join_group_by_name', { p_name: groupName });
    if (error) throw error;
    const group = Array.isArray(data) ? data[0] : data;
    if (!group || !group.group_id) throw new Error('Сервер не вернул группу');
    try { localStorage.setItem(GROUP_ACTIVE_PREFIX + currentSession.user.id, group.group_id); } catch (_) {}

    const { data: row, error: readError } = await client.from(GROUP_STATE_TABLE)
      .select('state').eq('group_id', group.group_id).maybeSingle();
    if (readError) throw readError;
    const existing = row && row.state ? row.state : {};
    const hasSharedContent = ['songs','events','setlists','members'].some(k => Array.isArray(existing[k]) && existing[k].length);
    if (!hasSharedContent && initialState && ['songs','events','setlists','members'].some(k => Array.isArray(initialState[k]) && initialState[k].length)) {
      const payload = groupPayload(initialState);
      const { error: seedError } = await client.from(GROUP_STATE_TABLE).upsert({
        group_id: group.group_id, state: payload, updated_at: new Date().toISOString()
      }, { onConflict: 'group_id' });
      if (seedError) throw seedError;
    }
    const loaded = await loadState();
    return { group, ...(loaded || {}) };
  }

  function leaveGroup() {
    if (!currentSession || !currentSession.user) return;
    try { localStorage.removeItem(GROUP_ACTIVE_PREFIX + currentSession.user.id); } catch (_) {}
  }

  async function loadState() {
    if (!currentSession) throw new Error('AUTH_REQUIRED');
    const { data, error } = await client
      .from(STATE_TABLE).select('state,updated_at')
      .eq('user_id', currentSession.user.id).maybeSingle();
    if (error) throw error;
    const personal = data ? (data.state || {}) : null;
    const groupId = activeGroupId();
    if (groupId) {
      const { data: groupRow, error: groupError } = await client.from(GROUP_STATE_TABLE)
        .select('state,updated_at').eq('group_id', groupId).maybeSingle();
      if (groupError) throw groupError;
      if (groupRow && groupRow.state) {
        const shared = groupRow.state;
        const merged = Object.assign({}, personal || {});
        ['members','events','songs','setlists'].forEach(k => {
          if (Array.isArray(shared[k])) merged[k] = shared[k];
        });
        return { state: merged, updatedAt: groupRow.updated_at || (data && data.updated_at) || '', sharedGroup: true };
      }
    }
    if (data) return { state: personal, updatedAt: data.updated_at || '' };

    /* Legacy migration for accounts without a personal state row. */
    const legacy = await client.from(LEGACY_TABLE).select('state,updated_at').eq('id', 1).maybeSingle();
    if (legacy.error) throw legacy.error;
    return legacy.data && legacy.data.state
      ? { state: legacy.data.state, updatedAt: legacy.data.updated_at || '', legacy: true }
      : null;
  }

  async function saveState(state) {
    if (!currentSession) throw new Error('AUTH_REQUIRED');
    const snapshot = JSON.parse(JSON.stringify(state || {}));
    const stamp = new Date().toISOString();
    const { data, error } = await client.from(STATE_TABLE).upsert({
      user_id: currentSession.user.id, state: snapshot, updated_at: stamp
    }, { onConflict: 'user_id' }).select('updated_at').single();
    if (error) throw error;
    const groupId = activeGroupId();
    if (groupId) {
      const { error: groupError } = await client.from(GROUP_STATE_TABLE).upsert({
        group_id: groupId, state: groupPayload(snapshot), updated_at: stamp
      }, { onConflict: 'group_id' });
      if (groupError) throw groupError;
    }
    return data && data.updated_at;
  }

  function subscribe(onState) {
    if (!currentSession) return function () {};
    const groupId = activeGroupId();
    const table = groupId ? GROUP_STATE_TABLE : STATE_TABLE;
    const filter = groupId ? 'group_id=eq.' + groupId : 'user_id=eq.' + currentSession.user.id;
    const channel = client.channel('bandplan-state-' + (groupId || currentSession.user.id))
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, function (payload) {
        const row = payload && payload.new;
        if (!row) return;
        if (groupId) {
          loadState().then(latest => {
            if (latest && latest.state) onState(latest.state, latest.updatedAt || '');
          }).catch(e => console.warn('BandPlan shared group refresh:', e));
        } else if (row.state) onState(row.state, row.updated_at || '');
      })
      .subscribe(function (status, err) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('BandPlan Realtime:', status, err || '');
      });
    realtimeStop = function () { try { client.removeChannel(channel); } catch (e) {} };
    return realtimeStop;
  }

  function renderAuth() {
    const root = document.getElementById('authScreen');
    if (!root) return;
    root.hidden = !!currentSession;
  }

  function authErrorMessage(error) {
    const msg = String(error && error.message || error || '');
    if (/invalid login credentials/i.test(msg)) return 'Неверный ник или пароль';
    if (/weak password|password/i.test(msg) && msg.length < 180) return 'Пароль должен содержать минимум 8 символов';
    return msg || 'Произошла ошибка. Попробуйте ещё раз.';
  }

  function setAuthBusy(busy) {
    document.querySelectorAll('#authScreen button[type="submit"]').forEach(b => {
      b.disabled = busy;
      b.classList.toggle('loading', busy);
    });
  }

  function switchAuth(mode) {
    const login = mode === 'login';
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const submit = document.getElementById('authSubmit');
    const confirm = document.getElementById('authPassword2Wrap');
    const tabs = document.querySelectorAll('[data-auth-mode]');
    if (title) title.textContent = login ? 'С возвращением' : 'Создайте аккаунт';
    if (subtitle) subtitle.textContent = login ? 'Введите ник и пароль, чтобы продолжить работу с BandPlan.' : 'Ваши песни, события и настройки будут привязаны к аккаунту.';
    if (submit) submit.textContent = login ? 'Войти' : 'Создать аккаунт';
    if (confirm) confirm.hidden = login;
    tabs.forEach(t => t.classList.toggle('on', t.getAttribute('data-auth-mode') === mode));
    rootAuthMode = mode;
    const err = document.getElementById('authError');
    if (err) err.textContent = '';
    const status = document.getElementById('authUsernameStatus');
    if (status) { status.textContent = ''; status.className = 'auth-username-status'; }
  }

  let rootAuthMode = 'login';

  function mountAuth() {
    const root = document.getElementById('authScreen');
    if (!root) return;
    renderAuth();
    root.addEventListener('click', async function (e) {
      const mode = e.target.closest('[data-auth-mode]');
      if (mode) { e.preventDefault(); switchAuth(mode.getAttribute('data-auth-mode')); return; }
      const providerButton = e.target.closest('[data-auth-provider]');
      if (providerButton) {
        e.preventDefault();
        const provider = providerButton.getAttribute('data-auth-provider');
        const err = document.getElementById('authError');
        if (err) err.textContent = '';
        providerButton.disabled = true;
        try { await signInWithProvider(provider); }
        catch (error) { if (err) err.textContent = authErrorMessage(error); providerButton.disabled = false; }
      }
    });
    const usernameInput = document.getElementById('authUsername');
    const usernameStatus = document.getElementById('authUsernameStatus');
    let usernameCheckSequence = 0;
    if (usernameInput && usernameStatus) {
      usernameInput.addEventListener('input', function () {
        usernameCheckSequence++;
        usernameStatus.textContent = '';
        usernameStatus.className = 'auth-username-status';
      });
      usernameInput.addEventListener('blur', async function () {
        if (rootAuthMode !== 'register') return;
        const username = String(usernameInput.value || '').trim().toLowerCase();
        if (!/^[a-zа-яё0-9_.-]{3,24}$/i.test(username)) {
          usernameStatus.textContent = username ? 'Ник должен содержать 3–24 допустимых символа' : '';
          usernameStatus.className = 'auth-username-status invalid';
          return;
        }
        const seq = ++usernameCheckSequence;
        usernameStatus.textContent = 'Проверяем ник…';
        usernameStatus.className = 'auth-username-status';
        try {
          const result = await checkUsername(username);
          if (seq !== usernameCheckSequence || rootAuthMode !== 'register' || usernameInput.value.trim().toLowerCase() !== username) return;
          usernameStatus.textContent = result.available ? 'Ник свободен' : 'Этот ник уже занят';
          usernameStatus.className = 'auth-username-status ' + (result.available ? 'available' : 'taken');
        } catch (error) {
          if (seq !== usernameCheckSequence) return;
          usernameStatus.textContent = authErrorMessage(error);
          usernameStatus.className = 'auth-username-status invalid';
        }
      });
    }
    const password2Input = document.getElementById('authPassword2');
    if (password2Input) password2Input.addEventListener('input', function () {
      const err = document.getElementById('authError');
      if (rootAuthMode === 'register' && password2Input.value && password2Input.value !== document.getElementById('authPassword').value) {
        if (err) err.textContent = 'Пароли не совпадают';
      } else if (err && err.textContent === 'Пароли не совпадают') err.textContent = '';
    });
    const form = document.getElementById('authForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const username = String(document.getElementById('authUsername').value || '').trim();
      const password = String(document.getElementById('authPassword').value || '');
      const password2 = String(document.getElementById('authPassword2').value || '');
      const err = document.getElementById('authError');
      if (err) err.textContent = '';
      if (!/^[A-Za-zА-Яа-яЁё0-9_.-]{3,24}$/.test(username)) {
        if (err) err.textContent = 'Ник: 3–24 символа, только буквы, цифры, _, ., -';
        return;
      }
      if (password.length < 8) {
        if (err) err.textContent = 'Пароль должен содержать минимум 8 символов';
        return;
      }
      if (rootAuthMode === 'register' && password !== password2) {
        if (err) err.textContent = 'Пароли не совпадают';
        return;
      }
      setAuthBusy(true);
      try {
        if (rootAuthMode === 'register') await register(username, password);
        else await signIn(username, password);
        renderAuth();
        emit('SIGNED_IN', currentSession);
      } catch (error) {
        if (err) err.textContent = authErrorMessage(error);
      } finally {
        setAuthBusy(false);
      }
    });
  }

  const ready = (async function () {
    const { data } = await client.auth.getSession();
    currentSession = data && data.session ? data.session : null;
    if (currentSession) {
      try {
        await loadProfile();
        if (!currentProfile) await ensureOAuthProfile();
        if (currentSession.user) localStorage.setItem('bandplan.auth.userId', currentSession.user.id);
      } catch (e) { console.warn('BandPlan profile:', e); }
    }
    mountAuth();
    renderAuth();
    return !!currentSession;
  })();

  client.auth.onAuthStateChange(function (event, session) {
    currentSession = session || null;
    if (!session) currentProfile = null;
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      loadProfile().catch(() => {});
    }
    emit(event, session);
    renderAuth();
  });

  window.BandPlanAuth = {
    client, ready,
    isAuthenticated: () => !!currentSession,
    signInWithProvider,
    ensureOAuthProfile,
    getSession: () => currentSession,
    getProfile: () => currentProfile,
    onChange: fn => { if (typeof fn === 'function') listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    signIn, register, checkUsername, signOut, addFriendByCode, getFriends, loadProfile
  };

  const OFFLINE_DB = 'bandplan-offline-v1';
  let offlineDbPromise = null;
  let offlineQueueTimer = null;
  function offlineDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (offlineDbPromise) return offlineDbPromise;
    offlineDbPromise = new Promise(function (resolve) {
      const req = indexedDB.open(OFFLINE_DB, 1);
      req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
    return offlineDbPromise;
  }
  async function idbGet(key) {
    const db = await offlineDb(); if (!db) return null;
    return new Promise(function (resolve) {
      const tx = db.transaction('kv', 'readonly'), req = tx.objectStore('kv').get(key);
      req.onsuccess = function () { resolve(req.result || null); }; req.onerror = function () { resolve(null); };
    });
  }
  async function idbPut(key, value) {
    const db = await offlineDb(); if (!db) return false;
    return new Promise(function (resolve) {
      const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key);
      tx.oncomplete = function () { resolve(true); }; tx.onerror = function () { resolve(false); };
    });
  }
  async function idbDelete(key) {
    const db = await offlineDb(); if (!db) return false;
    return new Promise(function (resolve) {
      const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(key);
      tx.oncomplete = function () { resolve(true); }; tx.onerror = function () { resolve(false); };
    });
  }
  async function cacheOfflineState(state) {
    const id = currentSession && currentSession.user ? currentSession.user.id : 'guest';
    return idbPut('state:' + id, { state: JSON.parse(JSON.stringify(state || {})), updatedAt: new Date().toISOString() });
  }
  async function queueOfflineState(state) {
    const id = currentSession && currentSession.user ? currentSession.user.id : 'guest';
    return idbPut('pending:' + id, { state: JSON.parse(JSON.stringify(state || {})), queuedAt: new Date().toISOString() });
  }
  async function flushOfflineQueue() {
    if (!currentSession || !navigator.onLine) return false;
    const id = currentSession.user.id, pending = await idbGet('pending:' + id);
    if (!pending || !pending.state) return false;
    try { await saveState(pending.state); await cacheOfflineState(pending.state); await idbDelete('pending:' + id); return true; }
    catch (e) { console.warn('BandPlan offline queue retry:', e); return false; }
  }
  async function offlineAwareLoad() {
    const id = currentSession && currentSession.user ? currentSession.user.id : 'guest';
    if (!navigator.onLine) {
      return (await idbGet('pending:' + id)) || (await idbGet('state:' + id));
    }
    try {
      /* Сначала читаем сервер, чтобы старая очередь с этого устройства
         не перезаписала более свежие данные, созданные на другом устройстве. */
      const remote = await loadState();
      const pending = await idbGet('pending:' + id);
      if (pending && pending.state) {
        const pendingAt = Date.parse(pending.queuedAt || 0) || 0;
        const remoteAt = Date.parse(remote && remote.updatedAt || 0) || 0;
        if (!remote || pendingAt >= remoteAt) {
          const flushed = await flushOfflineQueue();
          if (flushed) {
            const latest = await loadState();
            if (latest && latest.state) await cacheOfflineState(latest.state);
            return latest || pending;
          }
          return pending;
        }
        await idbDelete('pending:' + id);
      }
      if (remote && remote.state) await cacheOfflineState(remote.state);
      return remote;
    } catch (e) {
      const pending = await idbGet('pending:' + id);
      if (pending && pending.state) return pending;
      const cached = await idbGet('state:' + id);
      if (cached) return cached;
      throw e;
    }
  }
  async function offlineAwareSave(state) {
    if (!currentSession) throw new Error('AUTH_REQUIRED');
    await cacheOfflineState(state);
    if (!navigator.onLine) { await queueOfflineState(state); return 'offline'; }
    try { const stamp = await saveState(state); await idbDelete('pending:' + currentSession.user.id); return stamp; }
    catch (e) { await queueOfflineState(state); throw e; }
  }
  window.addEventListener('online', function () {
    clearTimeout(offlineQueueTimer);
    offlineQueueTimer = setTimeout(function () { flushOfflineQueue().catch(function () {}); }, 300);
  });
  window.BandPlanCloud = {
    load: offlineAwareLoad,
    saveNow: offlineAwareSave,
    joinGroup: joinGroup,
    leaveGroup: leaveGroup,
    getActiveGroupId: activeGroupId,
    schedule: function (state) {
      if (!currentSession) return;
      /* Сразу фиксируем последнюю версию в IndexedDB и очереди.
         Если страницу закроют до сетевого запроса, она отправится при следующем запуске. */
      const snapshot = JSON.parse(JSON.stringify(state || {}));
      cacheOfflineState(snapshot).catch(function () {});
      queueOfflineState(snapshot).catch(function () {});
      clearTimeout(window.__bandPlanCloudTimer);
      window.__bandPlanCloudTimer = setTimeout(function () {
        flushOfflineQueue().catch(function (e) { console.warn('BandPlan cloud save queued:', e); });
      }, 350);
    },
    subscribe,
    retry: flushOfflineQueue,
    isOffline: function () { return !navigator.onLine; }
  };
})();
