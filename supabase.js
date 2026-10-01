/* BandPlan — Supabase Auth + per-user cloud sync */
(function () {
  'use strict';

  const URL = 'https://oczcjphvzoadfqntoqlc.supabase.co';
  const KEY = 'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY';
  const STATE_TABLE = 'bandplan_user_state';
  const PROFILE_TABLE = 'bandplan_profiles';
  const FRIEND_TABLE = 'bandplan_friendships';
  const REGISTER_FN = URL + '/functions/v1/bandplan-register';

  const client = window.supabase.createClient(URL, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  let currentSession = null;
  let currentProfile = null;
  let realtimeStop = null;
  const listeners = [];

  function usernameEmail(username) {
    return String(username || '').trim().toLowerCase() + '@users.bandplan.local';
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

  async function loadState() {
    if (!currentSession) throw new Error('AUTH_REQUIRED');
    const { data, error } = await client
      .from(STATE_TABLE)
      .select('state,updated_at')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();
    if (error) throw error;
    return data ? { state: data.state || {}, updatedAt: data.updated_at || '' } : null;
  }

  async function saveState(state) {
    if (!currentSession) throw new Error('AUTH_REQUIRED');
    const snapshot = JSON.parse(JSON.stringify(state || {}));
    const { data, error } = await client
      .from(STATE_TABLE)
      .upsert({
        user_id: currentSession.user.id,
        state: snapshot,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select('updated_at')
      .single();
    if (error) throw error;
    return data && data.updated_at;
  }

  function subscribe(onState) {
    if (!currentSession) return function () {};
    const channel = client.channel('bandplan-user-state-' + currentSession.user.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: STATE_TABLE,
        filter: 'user_id=eq.' + currentSession.user.id
      }, function (payload) {
        const row = payload && payload.new;
        if (row && row.state) onState(row.state, row.updated_at || '');
      })
      .subscribe(function (status, err) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('BandPlan Realtime:', status, err || '');
        }
      });

    realtimeStop = function () {
      try { client.removeChannel(channel); } catch (e) {}
    };
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
  }

  let rootAuthMode = 'login';

  function mountAuth() {
    const root = document.getElementById('authScreen');
    if (!root) return;
    renderAuth();
    root.addEventListener('click', function (e) {
      const mode = e.target.closest('[data-auth-mode]');
      if (mode) { e.preventDefault(); switchAuth(mode.getAttribute('data-auth-mode')); }
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
      try { await loadProfile(); } catch (e) { console.warn('BandPlan profile:', e); }
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
    getSession: () => currentSession,
    getProfile: () => currentProfile,
    onChange: fn => { if (typeof fn === 'function') listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    signIn, register, signOut, addFriendByCode, getFriends, loadProfile
  };

  window.BandPlanCloud = {
    load: loadState,
    saveNow: saveState,
    schedule: function (state) {
      if (!currentSession) return;
      clearTimeout(window.__bandPlanCloudTimer);
      window.__bandPlanCloudTimer = setTimeout(function () {
        saveState(state).catch(function (e) { console.warn('BandPlan cloud save failed:', e); });
      }, 350);
    },
    subscribe,
    retry: function () {}
  };
})();
