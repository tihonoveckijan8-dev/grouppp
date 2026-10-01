/* BandPlan — Supabase Auth + isolated per-account cloud state */
(function () {
  'use strict';
  const URL = 'https://oczcjphvzoadfqntoqlc.supabase.co';
  const KEY = 'sb_publishable_EOBM5JQZQvtXcph4JNFA4w_LjfOjkiY';
  const TABLE = 'bandplan_user_state';
  const client = window.supabase.createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let currentSession = null, timer = null, pending = null, channel = null, lastUpdated = '';
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
    if(!email || (mode!=='reset' && password.length<8)){setMessage('Укажите почту и пароль не короче 8 символов.',true);return;}
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
    const {data,error}=await client.from(TABLE).select('state,updated_at').eq('user_id',currentSession.user.id).maybeSingle();
    if(error) throw error;
    lastUpdated=data?.updated_at || '';
    return data ? {state:data.state || {},updatedAt:data.updated_at || ''} : null;
  }
  async function saveNow(state) {
    if(!currentSession?.user) throw new Error('Требуется вход в аккаунт.');
    const snapshot=JSON.parse(JSON.stringify(state || {})), updatedAt=new Date().toISOString();
    pending=null;
    const {data,error}=await client.from(TABLE).upsert({user_id:currentSession.user.id,state:snapshot,updated_at:updatedAt},{onConflict:'user_id'}).select('updated_at').single();
    if(error){pending=snapshot;throw error;}
    lastUpdated=data?.updated_at || updatedAt;return lastUpdated;
  }
  function schedule(state) {
    if(!currentSession?.user)return;
    pending=JSON.parse(JSON.stringify(state||{}));clearTimeout(timer);
    timer=setTimeout(()=>{if(pending && navigator.onLine!==false)saveNow(pending).catch(e=>console.warn('BandPlan account save failed:',e));},350);
  }
  function subscribe(onState) {
    if(!currentSession?.user)return ()=>{};
    const userId=currentSession.user.id;
    channel=client.channel('bandplan-user-'+userId).on('postgres_changes',{event:'UPDATE',schema:'public',table:TABLE,filter:'user_id=eq.'+userId},payload=>{
      const row=payload?.new;if(!row?.state || (row.updated_at && row.updated_at===lastUpdated))return;
      lastUpdated=row.updated_at || '';onState(row.state,row.updated_at||'');
    }).subscribe();
    return ()=>{if(channel){client.removeChannel(channel);channel=null;}};
  }
  async function signOut(){clearTimeout(timer);pending=null;await client.auth.signOut();}
  window.BandPlanCloud={client,initialize, user:()=>currentSession?.user||null, load,saveNow,schedule,subscribe,signOut};
})();
