/* BandPlan cloud sync — Supabase */
(function () {
  'use strict';
  if (!window.supabase || !window.supabase.createClient) return;

  const client = window.supabase.createClient(
    'https://oczcjphvzoadfqntoqlc.supabase.co',
    'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const TABLE = 'bandplan_state';
  let timer = null, pending = null, lastRemoteAt = '';

  async function load() {
    const { data, error } = await client.from(TABLE).select('state,updated_at').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    lastRemoteAt = data.updated_at || '';
    return { state: data.state || {}, updatedAt: data.updated_at || '' };
  }

  async function saveNow(state) {
    pending = null;
    const snapshot = JSON.parse(JSON.stringify(state));
    const updatedAt = new Date().toISOString();
    const { data, error } = await client.from(TABLE)
      .upsert({ id: 1, state: snapshot, updated_at: updatedAt }, { onConflict: 'id' })
      .select('updated_at').single();
    if (error) { pending = snapshot; throw error; }
    lastRemoteAt = (data && data.updated_at) || updatedAt;
    return lastRemoteAt;
  }

  function schedule(state) {
    pending = JSON.parse(JSON.stringify(state));
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (pending && navigator.onLine !== false) saveNow(pending).catch(function () {});
    }, 350);
  }

  function retry() {
    if (!pending || navigator.onLine === false) return;
    clearTimeout(timer);
    timer = setTimeout(function () { if (pending) saveNow(pending).catch(function () {}); }, 150);
  }

  function subscribe(onState) {
    const channel = client.channel('bandplan-state-sync').on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE, filter: 'id=eq.1' },
      function (payload) {
        const row = payload && payload.new;
        if (!row || !row.state) return;
        if (row.updated_at && row.updated_at === lastRemoteAt) return;
        lastRemoteAt = row.updated_at || lastRemoteAt;
        onState(row.state, row.updated_at || '');
      }
    ).subscribe();
    return function () { try { client.removeChannel(channel); } catch (e) {} };
  }

  window.addEventListener('online', retry);
  window.BandPlanCloud = { load, saveNow, schedule, subscribe, retry };
})();