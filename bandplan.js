/* BandPlan bootstrap — load the application runtime deterministically after the Supabase client is available. */
(() => {
  'use strict';

  const loadCore = () => {
    if (window.__bandplanCorePromise) return window.__bandplanCorePromise;
    window.__bandplanCorePromise = import('./bandplan-core.js').catch(error => {
      console.error('BandPlan core failed to load:', error);
      const boot = document.getElementById('boot');
      if (boot) {
        boot.classList.add('is-error');
        let core = boot.querySelector('.boot-core');
        // WHY: cached or older HTML must still expose a visible bootstrap error if the expected container is missing.
        if (!core) { core = document.createElement('div'); core.className = 'boot-core'; boot.replaceChildren(core); }
        boot.setAttribute('role', 'alert');
        if (core) {
          core.innerHTML =
            '<div class="boot-error-title">Не удалось загрузить BandPlan</div>' +
            '<div class="boot-error-text">Проверьте подключение и повторите запуск. Сохранённые данные не удалены.</div>' +
            '<div class="boot-acts"><button type="button" id="bootRetry">Повторить</button></div>';
          const retry = document.getElementById('bootRetry');
          if (retry) retry.addEventListener('click', () => location.reload(), {once:true});
        }
      }
      throw error;
    });
    return window.__bandplanCorePromise;
  };

  /*
    Do not make core loading depend on the one-shot auth-ready CustomEvent.
    Supabase may restore an existing session before this module's listener is
    attached. The core already treats Supabase Auth as the source of truth and
    waits for initialize(), so loading it deterministically is safer and avoids
    the "login succeeds but the app never opens" race.
  */
  window.__bandplanEnsureCore = loadCore;
  // Core stays deferred until Supabase has resolved authentication.
})();
