/* BandPlan — Supabase Auth + isolated per-account cloud state */
(function () {
  'use strict';
  const URL = 'https://oczcjphvzoadfqntoqlc.supabase.co';
  const KEY = 'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY';
  const TABLE = 'bandplan_user_state';
  const client = window.supabase.createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let currentSession = null, timer = null, pending = null, channel = null, groupChannel = null, activeGroupId = null, lastUpdated = '', refreshTimer = null, sharedBaseline = {songs:[],events:[],setlists:[]};
  let mode = 'login';
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
        location.reload();
      }
    } catch(err) {
      setMessage(err.message || 'Не удалось выполнить запрос. Попробуйте ещё раз.',true);
      button.disabled=false;button.textContent=mode==='signup'?'Зарегистрироваться':mode==='reset'?'Отправить ссылку':'Войти';
    }
  }
  async function initialize() {
    renderGate('Проверяем сессию…');
    const {data,error}=await client.auth.getSession();
    if(error) {renderGate('Не удалось проверить сессию: '+error.message,true);return null;}
    currentSession=data.session;
    if(currentSession){gate().hidden=true;return currentSession.user;}
    mode='login';renderGate();return null;
  }
  async function load() {
    if(!currentSession?.user) throw new Error('Требуется вход в аккаунт.');
    const uid=currentSession.user.id;
    const [personal,membership]=await Promise.all([
      client.from(TABLE).select('state,updated_at').eq('user_id',uid).maybeSingle(),
      client.from('bandplan_group_members').select('group_id').eq('user_id',uid).limit(1).maybeSingle()
    ]);
    if(personal.error) throw personal.error;if(membership.error) throw membership.error;
    const pstate=personal.data?.state||{};activeGroupId=membership.data?.group_id||null;lastUpdated=personal.data?.updated_at||'';
    if(!activeGroupId){sharedBaseline={songs:[],events:[],setlists:[]};return personal.data?{state:pstate,updatedAt:lastUpdated}:null;}
    const [songs,events,setlists,gs,memberRows]=await Promise.all([
      client.from('bandplan_songs').select('data').eq('group_id',activeGroupId),
      client.from('bandplan_events').select('data').eq('group_id',activeGroupId),
      client.from('bandplan_setlists').select('data').eq('group_id',activeGroupId),
      client.from('bandplan_group_state').select('state').eq('group_id',activeGroupId).maybeSingle(),
      client.from('bandplan_group_members').select('user_id').eq('group_id',activeGroupId)
    ]);
    for(const q of [songs,events,setlists,gs,memberRows])if(q.error)throw q.error;
    sharedBaseline={songs:(songs.data||[]).map(x=>String(x.data?.id||'')).filter(Boolean),events:(events.data||[]).map(x=>String(x.data?.id||'')).filter(Boolean),setlists:(setlists.data||[]).map(x=>String(x.data?.id||'')).filter(Boolean)};
    const shared=gs.data?.state||{}, ids=(memberRows.data||[]).map(x=>x.user_id);
    let accounts=[];
    if(ids.length){const a=await client.from('bandplan_accounts').select('user_id,display_name,roles').in('user_id',ids);if(a.error)throw a.error;accounts=a.data||[];}
    const roster=Array.isArray(shared.members)?shared.members.slice():(pstate.members||[]);
    accounts.forEach(a=>{
      if(!a.display_name)return;
      const existing=roster.find(m=>String(m.name||'').trim().toLowerCase()===a.display_name.trim().toLowerCase());
      if(existing){existing.roles=a.roles||existing.roles;existing.role=(a.roles||[])[0]||existing.role;existing.accountId=a.user_id;}
      else roster.push({id:a.user_id,accountId:a.user_id,name:a.display_name,roles:a.roles||[],role:(a.roles||[])[0]||'',color:'#2547D0',note:''});
    });
    return {state:Object.assign({},pstate,{songs:(songs.data||[]).map(x=>x.data),events:(events.data||[]).map(x=>x.data),setlists:(setlists.data||[]).map(x=>x.data),members:roster}),updatedAt:lastUpdated};
  }
  async function saveNow(state) {
    if(!currentSession?.user)throw new Error('Требуется вход в аккаунт.');
    const snapshot=JSON.parse(JSON.stringify(state||{})),uid=currentSession.user.id,updatedAt=new Date().toISOString();pending=null;
    if(!activeGroupId){const m=await client.from('bandplan_group_members').select('group_id').eq('user_id',uid).limit(1).maybeSingle();if(m.error)throw m.error;activeGroupId=m.data?.group_id||null;}
    if(!activeGroupId&&snapshot.onboardingDone){const made=await client.rpc('bandplan_create_group',{p_name:snapshot.profile?.bandName||'Моя группа',p_display_name:snapshot.profile?.name||'',p_roles:snapshot.profile?.roles||(snapshot.profile?.role?[snapshot.profile.role]:[])});if(made.error)throw made.error;activeGroupId=made.data?.[0]?.group_id||made.data?.group_id||null;}
    if(activeGroupId){
      const songs=snapshot.songs||[],events=snapshot.events||[],setlists=snapshot.setlists||[];
      const removed=(base,current)=>base.filter(id=>!current.some(x=>String(x.id)===id));
      const sync=await client.rpc('bandplan_sync_group',{p_songs:songs,p_events:events,p_setlists:setlists,p_roster:snapshot.members||[],p_display_name:snapshot.profile?.name||'',p_roles:snapshot.profile?.roles||(snapshot.profile?.role?[snapshot.profile.role]:[]),p_personal_settings:snapshot.settings||{},p_delete_songs:removed(sharedBaseline.songs,songs),p_delete_events:removed(sharedBaseline.events,events),p_delete_setlists:removed(sharedBaseline.setlists,setlists)});
      if(sync.error){pending=snapshot;throw sync.error;}
      sharedBaseline={songs:songs.map(x=>String(x.id)),events:events.map(x=>String(x.id)),setlists:setlists.map(x=>String(x.id))};
    }
    const personalState={profile:snapshot.profile||{},settings:snapshot.settings||{},onboardingDone:!!snapshot.onboardingDone};
    const {data,error}=await client.from(TABLE).upsert({user_id:uid,state:personalState,updated_at:updatedAt},{onConflict:'user_id'}).select('updated_at').single();
    if(error){pending=snapshot;throw error;}lastUpdated=data?.updated_at||updatedAt;return lastUpdated;
  }
  function schedule(state) {
    if(!currentSession?.user)return;
    pending=JSON.parse(JSON.stringify(state||{}));clearTimeout(timer);
    timer=setTimeout(()=>{if(pending && navigator.onLine!==false)saveNow(pending).catch(e=>console.warn('BandPlan account save failed:',e));},350);
  }
  function subscribe(onState) {
    if(!currentSession?.user)return ()=>{};const uid=currentSession.user.id;
    channel=client.channel('bp-personal-'+uid).on('postgres_changes',{event:'UPDATE',schema:'public',table:TABLE,filter:'user_id=eq.'+uid},payload=>{const row=payload?.new;if(!row?.state||(row.updated_at&&row.updated_at===lastUpdated))return;lastUpdated=row.updated_at||'';load().then(x=>{if(x?.state)onState(x.state,row.updated_at||'');}).catch(e=>console.warn('Personal sync refresh failed',e));}).subscribe();
    let live=client.channel('bp-shared-'+uid);
    ['bandplan_songs','bandplan_events','bandplan_setlists','bandplan_group_state'].forEach(table=>{live=live.on('postgres_changes',{event:'*',schema:'public',table},payload=>{const gid=payload?.new?.group_id||payload?.old?.group_id;if(!activeGroupId||gid!==activeGroupId)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>load().then(x=>{if(x?.state)onState(x.state,x.updatedAt||'');}).catch(e=>console.warn('Shared sync refresh failed',e)),200);});});
    groupChannel=live.subscribe();
    return ()=>{if(channel){client.removeChannel(channel);channel=null;}if(groupChannel){client.removeChannel(groupChannel);groupChannel=null;}};
  }
  async function joinGroup(code,name,roles){const {data,error}=await client.rpc('bandplan_join_group',{p_code:String(code||'').trim(),p_display_name:name||'',p_roles:roles||[]});if(error)throw error;activeGroupId=data?.[0]?.group_id||null;return data?.[0]||null;}
  async function getInviteCode(){if(!activeGroupId){const m=await client.from('bandplan_group_members').select('group_id').eq('user_id',currentSession.user.id).limit(1).maybeSingle();if(m.error)throw m.error;activeGroupId=m.data?.group_id||null;}if(!activeGroupId)throw new Error('Сначала завершите настройку группы.');const q=await client.from('bandplan_group_invites').select('invite_code').eq('group_id',activeGroupId).order('created_at',{ascending:false}).limit(1).maybeSingle();if(q.error)throw q.error;if(q.data?.invite_code)return q.data.invite_code;throw new Error('Код приглашения не найден.');}
  async function signOut(){clearTimeout(timer);pending=null;await client.auth.signOut();}
  window.BandPlanCloud={client,initialize,user:()=>currentSession?.user||null,load,saveNow,schedule,subscribe,signOut,joinGroup,getInviteCode};
})();
