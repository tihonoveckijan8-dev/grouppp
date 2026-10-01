/* BandPlan cloud sync — Supabase REST + Realtime */
(function () {
  'use strict';

  const URL = 'https://oczcjphvzoadfqntoqlc.supabase.co';
  const KEY = 'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY';
  const TABLE = 'bandplan_state';
  const REST = URL + '/rest/v1/' + TABLE;
  const HEADERS = {
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  let timer = null;
  let pending = null;
  let lastRemoteAt = '';
  let stopPolling = null;
  let realtimeStop = null;

  async function request(path, options) {
    const res = await fetch(REST + path, Object.assign({ headers: HEADERS, cache: 'no-store' }, options || {}));
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const message = data && data.message ? data.message : (text || ('HTTP ' + res.status));
      throw new Error('Supabase ' + res.status + ': ' + message);
    }
    return data;
  }

  async function load() {
    const rows = await request('?id=eq.1&select=state,updated_at&limit=1');
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    lastRemoteAt = row.updated_at || '';
    return { state: row.state || {}, updatedAt: row.updated_at || '' };
  }

  async function saveNow(state) {
    const snapshot = JSON.parse(JSON.stringify(state || {}));
    const updatedAt = new Date().toISOString();
    pending = null;

    try {
      const rows = await request('?on_conflict=id', {
        method: 'POST',
        headers: Object.assign({}, HEADERS, {
          Prefer: 'resolution=merge-duplicates,return=representation'
        }),
        body: JSON.stringify({ id: 1, state: snapshot, updated_at: updatedAt })
      });
      const row = Array.isArray(rows) ? rows[0] : null;
      lastRemoteAt = (row && row.updated_at) || updatedAt;
      return lastRemoteAt;
    } catch (e) {
      pending = snapshot;
      throw e;
    }
  }

  function schedule(state) {
    pending = JSON.parse(JSON.stringify(state || {}));
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (pending && navigator.onLine !== false) {
        saveNow(pending).catch(function (e) {
          console.warn('BandPlan cloud save failed:', e);
        });
      }
    }, 350);
  }

  function retry() {
    if (!pending || navigator.onLine === false) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (pending) saveNow(pending).catch(function (e) { console.warn('BandPlan cloud retry failed:', e); });
    }, 150);
  }

  function applyRemote(row, onState) {
    if (!row || !row.state) return;
    if (row.updated_at && row.updated_at === lastRemoteAt) return;
    lastRemoteAt = row.updated_at || lastRemoteAt;
    onState(row.state, row.updated_at || '');
  }

  function subscribe(onState) {
    if (window.supabase && window.supabase.createClient) {
      const client = window.supabase.createClient(URL, KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const channel = client.channel('bandplan-state-sync').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: 'id=eq.1' },
        function (payload) { applyRemote(payload && payload.new, onState); }
      ).subscribe(function (status, err) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('BandPlan Realtime:', status, err || '');
        }
      });
      realtimeStop = function () { try { client.removeChannel(channel); } catch (e) {} };
      return realtimeStop;
    }

    let active = true;
    const poll = async function () {
      if (!active || navigator.onLine === false) return;
      try {
        const remote = await load();
        if (remote) applyRemote({ state: remote.state, updated_at: remote.updatedAt }, onState);
      } catch (e) {
        console.warn('BandPlan cloud polling failed:', e);
      }
    };
    const id = setInterval(poll, 15000);
    stopPolling = function () { active = false; clearInterval(id); };
    return stopPolling;
  }

  window.addEventListener('online', retry);
  window.BandPlanCloud = { load, saveNow, schedule, subscribe, retry };
})();