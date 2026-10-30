/* BandPlan bootstrap — load the application runtime deterministically after the Supabase client is available. */
(() => {
  'use strict';

  const loadCore = () => {
    if (window.__bandplanCorePromise) return window.__bandplanCorePromise;
    window.__bandplanCorePromise = import('./bandplan-core.js?v=20261028-import-removed-v50').catch(error => {
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

  // WHY: the metronome is only needed on song details or when its Tools tab is opened; defer its DOM observer, audio setup, styles and event handlers until one of those views exists.
  const viewRoot = document.getElementById('view');
  const ensureMetronome = () => {
    if (!viewRoot || !viewRoot.querySelector('.song-detail-work-actions, [data-bp-am-tool-host]')) return;
    if (window.__bandplanMetronomePromise) return;
    const script = document.createElement('script');
    script.src = './metronome-audio.js?v=20261025-manual-metro-v1';
    script.async = true;
    script.dataset.bandplanMetronome = 'lazy';
    const pending = new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error('Не удалось загрузить модуль метронома'));
      document.head.appendChild(script);
    });
    window.__bandplanMetronomePromise = pending.catch(error => {
      // WHY: keep the rest of the workspace usable if an optional tool asset is unavailable; a later route render may retry it.
      window.__bandplanMetronomePromise = null;
      console.warn('BandPlan metronome module failed to load:', error);
    });
  };
  if (viewRoot) {
    const metronomeLoaderObserver = new MutationObserver(ensureMetronome);
    metronomeLoaderObserver.observe(viewRoot, { childList: true, subtree: true });
    ensureMetronome();
    // WHY: hash routing may finish a render through a transition path that replaces the view asynchronously; recheck after the route handler has painted so song/tool entry points cannot miss the lazy-load trigger.
    window.addEventListener('hashchange', () => requestAnimationFrame(ensureMetronome));
  }

  // WHY: INITIAL_SESSION may fire before this deferred script executes; notify Auth waiters instead of failing a valid startup.
  window.dispatchEvent(new Event('bandplan:core-loader-ready'));
  // Core stays deferred until Supabase has resolved authentication.
})();
