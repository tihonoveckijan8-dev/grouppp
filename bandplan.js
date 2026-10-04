/* BandPlan bootstrap — the application runtime is loaded only after Supabase confirms an authenticated user. */
(() => {
  'use strict';
  const loadCore = () => {
    if (window.__bandplanCorePromise) return window.__bandplanCorePromise;
    window.__bandplanCorePromise = import('./bandplan-core.js').catch(error => {
      console.error('BandPlan core failed to load:', error);
      const boot = document.getElementById('boot');
      const stage = document.getElementById('bootStage');
      if (stage) stage.textContent = 'Не удалось загрузить приложение';
      if (boot) {
        boot.classList.add('is-error');
        const core = boot.querySelector('.boot-core');
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
  window.__bandplanEnsureCore = loadCore;
  window.addEventListener('bandplan:auth-ready', () => loadCore(), {once:true});
  if (window.__bandplanAuthUserId) loadCore();
})();