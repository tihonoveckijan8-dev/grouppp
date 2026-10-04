/* BandPlan — Supabase Auth + isolated per-account cloud state */
(function () {
  'use strict';
  const URL = 'https://oczcjphvzoadfqntoqlc.supabase.co';
  const KEY = 'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY';
  const TABLE = 'bandplan_user_state';
  const client = window.supabase.createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let currentSession = null, timer = null, pending = null, channel = null, groupChannel = null, activeGroupId = null, activeMemberIds = [], lastUpdated = '', refreshTimer = null, realtimePollTimer = null, realtimeSharedReady = false, groupSetupPromise = null, sharedBaseline = {songs:{},events:{},setlists:{}};
  let authSubscription = null;
  let realtimeGeneration = 0;
  let subscriptionCallback = null;
  let participationCallback = null;
  let participationChannel = null;

  /* Durable offline cache: per-account snapshot + latest pending sync. */
  const IDB_NAME='bandplan-cloud-v1', IDB_VERSION=1, IDB_SNAPSHOT='snapshots', IDB_QUEUE='sync_queue';
  let idbPromise=null;
  function openOfflineDb(){
    if(!('indexedDB' in window)) return Promise.resolve(null);
    if(idbPromise) return idbPromise;
    idbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(IDB_NAME,IDB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;
        if(!db.objectStoreNames.contains(IDB_SNAPSHOT))db.createObjectStore(IDB_SNAPSHOT,{keyPath:'user_id'});
        if(!db.objectStoreNames.contains(IDB_QUEUE))db.createObjectStore(IDB_QUEUE,{keyPath:'user_id'});
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
    const record={user_id:userId,state:JSON.parse(JSON.stringify(state||{})),updated_at:updatedAt||new Date().toISOString(),pending_sync:!!pendingSync};
    await idbRequest(IDB_SNAPSHOT,'readwrite',store=>store.put(record));
    if(pendingSync)await idbRequest(IDB_QUEUE,'readwrite',store=>store.put({user_id:userId,state:record.state,updated_at:record.updated_at}));
    else await idbRequest(IDB_QUEUE,'readwrite',store=>store.delete(userId));
  }
  async function hydrateLocalCache(){
    const uid=currentSession?.user?.id;if(!uid)return null;
    const queued=await durableQueue(uid),snapshot=await durableSnapshot(uid),record=queued||snapshot;
    if(!record?.state)return null;
    const state=JSON.parse(JSON.stringify(record.state)),pendingSync=!!queued||!!record.pending_sync;
    if(pendingSync)pending=state;
    return {state,updatedAt:record.updated_at||'',pendingSync};
  }
  async function clearDurableQueue(userId){
    await idbRequest(IDB_QUEUE,'readwrite',store=>store.delete(userId));
    const snapshot=await durableSnapshot(userId);
    if(snapshot)await idbRequest(IDB_SNAPSHOT,'readwrite',store=>store.put(Object.assign({},snapshot,{pending_sync:false})));
  }

  let mode = 'login';
  function disposeRealtime() {
    realtimeGeneration += 1;
    clearTimeout(refreshTimer);
    refreshTimer = null;
    if (channel) { client.removeChannel(channel); channel = null; }
    if (Array.isArray(groupChannel)) { groupChannel.forEach(ch => client.removeChannel(ch)); groupChannel = null; }
    else if (groupChannel) { client.removeChannel(groupChannel); groupChannel = null; }
    participationChannel = null;
  }
  function bindAuthLifecycle() {
    if (authSubscription) return;
    const result = client.auth.onAuthStateChange((event, session) => {
      const previousUserId = currentSession?.user?.id || null;
      currentSession = session || null;
      if (event === 'SIGNED_OUT') {
        clearTimeout(timer);
        pending = null;
        activeGroupId = null;
        lastUpdated = '';
        sharedBaseline = {songs:{},events:{},setlists:{}};
        disposeRealtime();
        mode = 'login';
        renderGate();
        return;
      }
      if (event === 'SIGNED_IN') {
        if (previousUserId && previousUserId !== session?.user?.id) disposeRealtime();
        if (session?.user) {
          gate().hidden = true;
          window.dispatchEvent(new CustomEvent('bandplan:auth-success', { detail: { user: session.user } }));
        }
      }
    });
    authSubscription = result?.data?.subscription || null;
  }
  const $ = (s, root=document) => root.querySelector(s);
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    const el = gate();
    const signup = mode === 'signup', reset = mode === 'reset';
    el.hidden = false;
    el.innerHTML = '<section class="bp-auth-card"><div class="bp-auth-mark">BP</div><div class="bp-auth-brand">BandPlan</div>' +
      '<h1>' + (signup ? 'Создать аккаунт' : reset ? 'Восстановить пароль' : 'С возвращением') + '</h1>' +
      '<p class="bp-auth-desc">' + (signup ? 'Личный профиль для каждого участника коллектива.' : reset ? 'Отправим ссылку для смены пароля на вашу почту.' : 'Войдите, чтобы открыть свои данные и продолжить работу.') + '</p>' +
      '<form id="bpAuthForm" novalidate>' +
      (signup ? '<label class="bp-auth-label" for="bpAuthName">Имя</label><input id="bpAuthName" class="bp-auth-input" type="text" maxlength="60" autocomplete="name" placeholder="Имя и фамилия" required>' : '') +
      '<label class="bp-auth-label" for="bpAuthEmail">Электронная почта</label><input id="bpAuthEmail" class="bp-auth-input" type="email" autocomplete="email" placeholder="name@example.com" required>' +
      (reset ? '' : '<label class="bp-auth-label" for="bpAuthPassword">Пароль</label><input id="bpAuthPassword" class="bp-auth-input" type="password" minlength="8" autocomplete="' + (signup?'new-password':'current-password') + '" placeholder="Не менее 8 символов" required>') +
      '<p class="bp-auth-message ' + (error?'is-error':'') + '" id="bpAuthMessage" role="status">' + escapeHtml(message || '') + '</p>' +
      '<button class="bp-auth-submit" id="bpAuthSubmit" type="submit">' + (signup?'Зарегистрироваться':reset?'Отправить ссылку':'Войти') + '</button></form>' +
      '<div class="bp-auth-links">' +
      (reset ? '<button type="button" data-auth-mode="login">Вернуться ко входу</button>' :
        (signup ? '<span>Уже есть аккаунт?</span><button type="button" data-auth-mode="login">Войти</button>' :
        '<button type="button" data-auth-mode="signup">Создать аккаунт</button><button type="button" data-auth-mode="reset">Забыли пароль?</button>')) +
      '</div></section>';
    $('#bpAuthForm',el).addEventListener('submit',submitAuth);
    el.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.authMode;renderGate();}));
  }
  function setMessage(message,error=false) {
    const el=$('#bpAuthMessage'); if(el){el.textContent=message;el.classList.toggle('is-error',!!error);}
  }
  async function submitAuth(event) {
    event.preventDefault();
    const form=event.currentTarget, button=$('#bpAuthSubmit');
    const email=$('#bpAuthEmail').value.trim(), password=$('#bpAuthPassword')?.value || '';
    const name=$('#bpAuthName')?.value.trim() || '';
    if(!email || (mode==='signup' && !name) || (mode!=='reset' && password.length<8)){setMessage(mode==='signup'?'Укажите имя, почту и пароль не короче 8 символов.':'Укажите почту и пароль не короче 8 символов.',true);return;}
    button.disabled=true;button.textContent='Подождите…';
    try {
      let result;
      if(mode==='signup') result=await client.auth.signUp({email,password,options:{data:{full_name:name}}});
      else if(mode==='reset') result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});
      else result=await client.auth.signInWithPassword({email,password});
      if(result.error) throw result.error;
      if(mode==='signup' && !result.data.session){
        renderGate('Аккаунт создан. Проверьте почту и подтвердите адрес, затем войдите.');
      } else if(mode==='reset') {
        renderGate('Если адрес зарегистрирован, на него отправлена ссылка для восстановления.');
      } else {
        currentSession = result.data?.session || currentSession;
        if (!currentSession?.user) throw new Error('Сессия не создана. Попробуйте войти ещё раз.');
        gate().hidden = true;
        window.dispatchEvent(new CustomEvent('bandplan:auth-success', { detail: { user: currentSession.user } }));
      }
    } catch(err) {
      setMessage(err.message || 'Не удалось выполнить запрос. Попробуйте ещё раз.',true);
      button.disabled=false;button.textContent=mode==='signup'?'Зарегистрироваться':mode==='reset'?'Отправить ссылку':'Войти';
    }
  }
  async function initialize() {
    bindAuthLifecycle();
    renderGate('Проверяем сессию…');
    const {data,error}=await client.auth.getSession();
    if(error) {
      console.warn('BandPlan session check failed:', error);
      currentSession=null;
      mode='login';
      renderGate('Войдите в аккаунт, чтобы продолжить.');
      return null;
    }
    currentSession=data.session;
    if(currentSession){gate().hidden=true;return currentSession.user;}
    mode='login';renderGate();return null;
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
        .select('display_name,roles')
        .eq('user_id', user.id)
        .maybeSingle();
      if(!error && String(data?.display_name || '').trim() &&
        Array.isArray(data?.roles) && data.roles.length > 0) {
        return true;
      }
      if(error) console.warn('BandPlan account identity check failed:', error);
    } catch(error) {
      console.warn('BandPlan account identity check failed:', error);
    }

    // A confirmed personal snapshot is also enough to suppress onboarding.
    // This keeps the login flow stable while the account row is being
    // refreshed/synchronized.
    try {
      const local=await durableSnapshot(user.id);
      const p=local?.state?.profile;
      if(local?.state?.onboardingDone &&
        String(p?.name||'').trim() &&
        ((Array.isArray(p?.roles)&&p.roles.length>0)||String(p?.role||'').trim())) {
        return true;
      }
    } catch(error) {
      console.warn('BandPlan local identity check failed:', error);
    }
    return false;
  }

  async function markOnboardingComplete() {
    if(!currentSession?.user) return;
    try {
      const result=await client.auth.updateUser({
        data:{bandplan_onboarding_done:true}
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
    const hasAccountIdentity=!!String(accountProfile?.display_name||'').trim() && Array.isArray(accountProfile?.roles) && accountProfile.roles.length>0;
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
    const participationByEvent={};
    (participation.data||[]).forEach(row=>{
      const eventId=String(row.event_id||'').trim(),userId=String(row.user_id||'').trim();
      if(!eventId||!userId)return;
      if(!participationByEvent[eventId])participationByEvent[eventId]={};
      if(row.status)participationByEvent[eventId][userId]=String(row.status);
    });
    const baseEvents=(events.data||[]).map(x=>x.data).map(ev=>{
      const copy=Object.assign({},ev);
      // The participation table is the source of truth. Always replace the
      // embedded map, including with an empty map after a user clears a status.
      copy.participation=Object.assign({},participationByEvent[String(ev?.id||'').trim()]||{});
      return copy;
    });
    const hydratedEvents=hydratePersonalEventParticipation(baseEvents,groupProfile);
    return {state:Object.assign({},pstate,{profile:hydratedEvents.profile,songs:(songs.data||[]).map(x=>x.data),events:hydratedEvents.events,setlists:(setlists.data||[]).map(x=>x.data),members:roster}),updatedAt:lastUpdated};
  }
  async function saveNow(state) {
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    const snapshot=JSON.parse(JSON.stringify(state||{})),uid=currentSession.user.id,updatedAt=new Date().toISOString();
    snapshot.events=(snapshot.events||[]).map(ev=>{const copy=Object.assign({},ev);delete copy.myStatus;return copy;});
    clearTimeout(timer);pending=snapshot;
    await writeDurableState(uid,snapshot,updatedAt,true);
    if(!activeGroupId){
      const membership=await client.rpc('bandplan_get_my_group');
      if(membership.error)throw membership.error;
      const row=Array.isArray(membership.data)?membership.data[0]:membership.data;
      activeGroupId=row?.group_id||null;
    }
    if(activeGroupId) snapshot.profile=Object.assign({},snapshot.profile||{}, {groupId:activeGroupId, groupDetached:false});
    if(!activeGroupId&&snapshot.onboardingDone&&!snapshot.profile?.groupDetached){
      if(!groupSetupPromise)groupSetupPromise=(async()=>{
        const made=await client.rpc('bandplan_create_group',{p_name:snapshot.profile?.bandName||'Моя группа',p_display_name:snapshot.profile?.name||'',p_roles:snapshot.profile?.roles||(snapshot.profile?.role?[snapshot.profile.role]:[])});
        if(made.error)throw made.error;
        activeGroupId=made.data?.[0]?.group_id||made.data?.group_id||null;
        return activeGroupId;
      })().finally(()=>{groupSetupPromise=null;});
      await groupSetupPromise;
    }
    if(activeGroupId){
      if(String(snapshot.profile?.bandName||'').trim().length>=3){const renamed=await client.rpc('bandplan_rename_group',{p_name:snapshot.profile.bandName});if(renamed.error){pending=snapshot;throw renamed.error;}}
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
      sharedBaseline={
        songs:Object.fromEntries(songs.map(x=>[String(x.id),JSON.stringify(x)]).filter(([id])=>id)),
        events:Object.fromEntries(events.map(x=>[String(x.id),JSON.stringify(x)]).filter(([id])=>id)),
        setlists:Object.fromEntries(setlists.map(x=>[String(x.id),JSON.stringify(x)]).filter(([id])=>id))
      };
    }
    const personalState={profile:snapshot.profile||{},settings:snapshot.settings||{},onboardingDone:!!snapshot.onboardingDone};
    const {data,error}=await client.from(TABLE).upsert({user_id:uid,state:personalState,updated_at:updatedAt},{onConflict:'user_id'}).select('updated_at').single();
    if(error){pending=snapshot;await writeDurableState(uid,snapshot,updatedAt,true);throw error;}
    lastUpdated=data?.updated_at||updatedAt;
    const latestPending=pending&&JSON.stringify(pending)!==JSON.stringify(snapshot)?JSON.parse(JSON.stringify(pending)):null;
    if(latestPending)await writeDurableState(uid,latestPending,new Date().toISOString(),true);
    else{pending=null;await clearDurableQueue(uid);}
    return lastUpdated;
  }
  function schedule(state) {
    if(!currentSession?.user)return;
    pending=JSON.parse(JSON.stringify(state||{}));clearTimeout(timer);
    timer=setTimeout(()=>{if(pending && navigator.onLine!==false)saveNow(pending).catch(e=>{console.warn('BandPlan account save failed:',e);window.dispatchEvent(new CustomEvent('bandplan:sync-error',{detail:e?.message||'Ошибка синхронизации'}));});},350);
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
  async function setEventParticipation(eventId,status){
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    const uid=String(currentSession.user.id);
    const id=String(eventId||'').trim();
    const cleanStatus=String(status||'');
    if(!id)throw new Error('Не удалось определить событие.');
    if(cleanStatus&&!['yes','maybe','no'].includes(cleanStatus))throw new Error('Некорректный статус участия.');
    const {data,error}=await client.rpc('bandplan_set_event_participation',{
      p_event_id:id,
      p_status:cleanStatus
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
  async function deleteAccount(){
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    clearTimeout(timer);
    pending=null;
    disposeRealtime();
    const uid=currentSession.user.id;
    const {error}=await client.rpc('bandplan_delete_my_account');
    if(error)throw error;
    try{await clearLocalCache();}catch(e){}
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
  async function signOut(){clearTimeout(timer);pending=null;disposeRealtime();await client.auth.signOut();}
  window.BandPlanCloud={client,initialize,user:()=>currentSession?.user||null,load,saveNow,schedule,subscribe,signOut,leaveGroup,clearLocalCache,joinGroup,getInviteCode,setEventParticipation,deleteAccount,hydrateLocalCache,hasAccountIdentity,markOnboardingComplete};
})();
