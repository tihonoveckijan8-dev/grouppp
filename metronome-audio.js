/* BandPlan metronome — rebuilt as a standalone manual tempo tool.
 * WHY: audio-file BPM detection was unreliable on mobile and is intentionally removed.
 * The metronome now uses a look-ahead Web Audio scheduler and per-song local settings.
 */
(function () {
  'use strict';

  var SETTINGS_KEY = 'bandplan.metronome.settings.v2';
  var audioContext = null;
  var timer = 0;
  var activeRoot = null;
  // WHY: prevent rapid repeated taps during AudioContext.resume() from starting parallel scheduler loops.
  var startingRoot = null;
  var nextNoteTime = 0;
  var step = 0;
  var visualTimers = [];
  var tapTimes = [];
  var stylesInstalled = false;

  var css = [
    '.bp-metro[hidden]{display:none!important}',
    '.bp-metro{--metro-bg:var(--surface,var(--card));--metro-raised:var(--surface-2,var(--card));display:grid;gap:18px;min-width:0;margin-top:16px;padding:clamp(14px,2.4vw,24px);border:0;border-radius:22px;background:var(--metro-bg);color:var(--text);box-shadow:7px 7px 18px color-mix(in srgb,var(--text) 8%,transparent),-7px -7px 18px color-mix(in srgb,var(--surface,var(--card)) 88%,white 12%);}',
    '.bp-metro *{box-sizing:border-box}',
    '.bp-metro-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}',
    '.bp-metro h3{margin:0;font-size:clamp(17px,2vw,20px);font-weight:800;letter-spacing:-.035em;line-height:1.2}',
    '.bp-metro-sub{display:block;margin-top:5px;color:var(--text-2,var(--muted));font-size:12px;line-height:1.45}',
    '.bp-metro-state{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;padding:7px 10px;border-radius:999px;background:var(--metro-raised);box-shadow:inset 1px 1px 3px color-mix(in srgb,var(--text) 5%,transparent),inset -1px -1px 3px color-mix(in srgb,var(--surface,var(--card)) 90%,white 10%);font-size:11px;color:var(--text-2,var(--muted))}',
    '.bp-metro-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:var(--border-2,var(--border))}',
    '.bp-metro-dot.on{background:var(--accent);box-shadow:0 0 0 4px var(--accent-ring,color-mix(in srgb,var(--accent) 16%,transparent))}',
    '.bp-metro-display{display:grid;justify-items:center;gap:13px;padding:24px 14px 20px;border-radius:20px;background:var(--metro-raised);box-shadow:inset 5px 5px 12px color-mix(in srgb,var(--text) 7%,transparent),inset -5px -5px 12px color-mix(in srgb,var(--surface,var(--card)) 90%,white 10%)}',
    '.bp-metro-label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-2,var(--muted));font-weight:800}',
    '.bp-metro-number{display:flex;align-items:baseline;justify-content:center;gap:9px;font-variant-numeric:tabular-nums}',
    '.bp-metro-bpm{font-size:clamp(66px,11vw,92px);line-height:.9;font-weight:850;letter-spacing:-.085em}',
    '.bp-metro-unit{font-size:14px;font-weight:750;color:var(--text-2,var(--muted))}',
    '.bp-metro-slider{display:block;width:min(100%,520px);height:28px;margin:0;accent-color:var(--accent);touch-action:pan-y}',
    '.bp-metro-adjust{display:grid;grid-template-columns:48px minmax(0,1fr) 48px;gap:8px;width:min(100%,380px)}',
    '.bp-metro-adjust button{min-height:44px;border:0;border-radius:13px;background:var(--metro-raised);color:var(--text);font:inherit;font-weight:800;box-shadow:4px 4px 8px color-mix(in srgb,var(--text) 8%,transparent),-4px -4px 8px color-mix(in srgb,var(--surface,var(--card)) 88%,white 12%);cursor:pointer}',
    '.bp-metro-adjust button:active{box-shadow:inset 3px 3px 7px color-mix(in srgb,var(--text) 9%,transparent),inset -3px -3px 7px color-mix(in srgb,var(--surface,var(--card)) 88%,white 12%)}',
    '.bp-metro-beats{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;min-height:34px}',
    '.bp-metro-beat{width:12px;height:12px;border-radius:50%;background:var(--border-2,var(--border));transition:transform .07s,background .07s,box-shadow .07s}',
    '.bp-metro-beat.current{background:var(--accent);transform:scale(1.35);box-shadow:0 0 0 5px var(--accent-ring,color-mix(in srgb,var(--accent) 16%,transparent))}',
    '.bp-metro-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
    '.bp-metro-field{display:grid;gap:8px;min-width:0;color:var(--text-2,var(--muted));font-size:12px;font-weight:750}',
    '.bp-metro select{width:100%;min-width:0;min-height:46px;padding:10px 12px;border:0;border-radius:13px;background:var(--metro-raised);color:var(--text);font:inherit;font-size:14px;box-shadow:inset 3px 3px 7px color-mix(in srgb,var(--text) 7%,transparent),inset -3px -3px 7px color-mix(in srgb,var(--surface,var(--card)) 88%,white 12%)}',
    '.bp-metro-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;padding:10px 12px;border-radius:13px;background:var(--metro-raised);color:var(--text);font-size:13px;font-weight:650;box-shadow:inset 3px 3px 7px color-mix(in srgb,var(--text) 6%,transparent),inset -3px -3px 7px color-mix(in srgb,var(--surface,var(--card)) 88%,white 12%)}',
    '.bp-metro-switch > span{min-width:0;overflow-wrap:anywhere}',
    '.bp-metro-switch input{width:20px;height:20px;margin:0;accent-color:var(--accent);flex:0 0 20px}',
    '.bp-metro-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}',
    '.bp-metro-actions button{min-height:48px;padding:11px 14px;border:0;border-radius:14px;font:inherit;font-weight:800;cursor:pointer}',
    '.bp-metro-start{background:var(--accent);color:#fff;box-shadow:0 5px 13px color-mix(in srgb,var(--accent) 24%,transparent)}',
    '.bp-metro-secondary{background:var(--metro-raised);color:var(--text);box-shadow:4px 4px 8px color-mix(in srgb,var(--text) 7%,transparent),-4px -4px 8px color-mix(in srgb,var(--surface,var(--card)) 88%,white 12%)}',
    '.bp-metro-status{margin:0;padding:11px 13px;border-radius:12px;background:var(--metro-raised);color:var(--text-2,var(--muted));font-size:12px;line-height:1.5}',
    '.bp-metro-status[data-kind=error]{color:var(--danger,#c33)}',
    '.bp-metro button:focus-visible,.bp-metro select:focus-visible,.bp-metro input:focus-visible{outline:3px solid var(--accent-ring,var(--accent));outline-offset:3px}',
    '@media(max-width:600px){.bp-metro{gap:14px;margin-top:13px;padding:13px;border-radius:18px}.bp-metro-head{display:grid;gap:9px}.bp-metro-state{justify-self:start}.bp-metro-display{padding:22px 10px 16px}.bp-metro-bpm{font-size:clamp(60px,18vw,78px)}.bp-metro-options{grid-template-columns:minmax(0,1fr);gap:10px}.bp-metro-actions{grid-template-columns:minmax(0,1fr)}.bp-metro-actions button{min-height:49px}}',
    '@media(prefers-reduced-motion:reduce){.bp-metro *{transition:none!important}}'
  ].join('\n');

  function addStyles() {
    if (stylesInstalled || document.getElementById('bp-metro-css')) return;
    var style = document.createElement('style');
    style.id = 'bp-metro-css';
    style.textContent = css;
    document.head.appendChild(style);
    stylesInstalled = true;
  }

  function settingsAll() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function getSettings(id) {
    var all = settingsAll();
    return Object.assign({ bpm: 100, beats: 4, subdivision: 1, accent: true }, all[id] || {});
  }

  function saveSettings(id, patch) {
    var all = settingsAll();
    all[id] = Object.assign(getSettings(id), patch);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(all)); } catch (e) {}
    return all[id];
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function songId() {
    var match = (location.hash || '').match(/^#\/song\/([^/?#]+)/);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
  }

  function currentContextId() { return songId() || '__tool__'; }

  function getAudioContext() {
    var Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) throw new Error('Браузер не поддерживает Web Audio. Обнови браузер и попробуй ещё раз.');
    if (!audioContext || audioContext.state === 'closed') audioContext = new Constructor();
    return audioContext;
  }

  function tone(at, accent, subdivision) {
    var ctx = getAudioContext();
    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accent ? 1320 : (subdivision ? 620 : 880), at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.26 : (subdivision ? 0.075 : 0.16), at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (subdivision ? 0.025 : 0.055));
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.06);
  }

  function clearVisualTimers() {
    visualTimers.forEach(function (id) { clearTimeout(id); });
    visualTimers = [];
  }

  function setVisual(root, beatIndex, at, ctx) {
    var delay = Math.max(0, (at - ctx.currentTime) * 1000);
    var timeout = setTimeout(function () {
      if (activeRoot !== root) return;
      var dots = root.querySelectorAll('.bp-metro-beat');
      dots.forEach(function (dot, index) {
        dot.classList.toggle('current', index === beatIndex);
      });
      var live = root.querySelector('.bp-metro-dot');
      if (live) live.classList.add('on');
      var off = setTimeout(function () {
        if (live) live.classList.remove('on');
      }, 75);
      visualTimers.push(off);
    }, delay);
    visualTimers.push(timeout);
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = 0;
    activeRoot = null;
    startingRoot = null;
    clearVisualTimers();
    document.querySelectorAll('.bp-metro-dot').forEach(function (dot) { dot.classList.remove('on'); });
    document.querySelectorAll('.bp-metro-beat').forEach(function (dot) { dot.classList.remove('current'); });
    document.querySelectorAll('[data-bpm-action=start]').forEach(function (button) {
      button.textContent = '▶ Запустить';
      button.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('[data-bpm-status]').forEach(function (status) {
      status.textContent = 'Метроном остановлен.';
      status.dataset.kind = '';
    });
  }

  function renderBpm(root, value, persist) {
    var bpm = Math.max(30, Math.min(260, Math.round(Number(value) || 100)));
    root.querySelector('[data-bpm-range]').value = String(bpm);
    root.querySelector('[data-bpm-number]').textContent = String(bpm);
    if (persist !== false) saveSettings(root.dataset.metronomeId, { bpm: bpm });
    return bpm;
  }

  function renderBeats(root, count) {
    var host = root.querySelector('[data-bpm-beats]');
    host.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var dot = document.createElement('i');
      dot.className = 'bp-metro-beat';
      dot.setAttribute('aria-hidden', 'true');
      host.appendChild(dot);
    }
  }

  async function start(root) {
    if (activeRoot === root || startingRoot === root) return;
    stop();
    startingRoot = root;
    var ctx = getAudioContext();
    await ctx.resume();
    if (startingRoot !== root) return;
    if (ctx.state !== 'running') throw new Error('Звук не запустился. Проверь громкость устройства и нажми ещё раз.');
    startingRoot = null;
    activeRoot = root;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    var button = root.querySelector('[data-bpm-action=start]');
    button.textContent = 'Ⅱ Остановить';
    button.setAttribute('aria-pressed', 'true');
    var status = root.querySelector('[data-bpm-status]');
    status.textContent = 'Метроном работает. Темп можно менять на ходу.';
    status.dataset.kind = 'ok';

    function scheduler() {
      if (activeRoot !== root) return;
      var bpm = Number(root.querySelector('[data-bpm-range]').value) || 100;
      var beats = Number(root.querySelector('[data-bpm-meter]').value) || 4;
      var subdivision = Number(root.querySelector('[data-bpm-subdivision]').value) || 1;
      var beatDuration = 60 / bpm;
      var stepDuration = beatDuration / subdivision;
      // WHY: schedule slightly ahead on the audio clock; UI timers alone drift and stutter on mobile.
      while (nextNoteTime < ctx.currentTime + 0.12) {
        var currentStep = step;
        var beatIndex = Math.floor(currentStep / subdivision) % beats;
        var isMainBeat = currentStep % subdivision === 0;
        var isAccent = isMainBeat && beatIndex === 0 && root.querySelector('[data-bpm-accent]').checked;
        tone(nextNoteTime, isAccent, !isMainBeat);
        if (isMainBeat) setVisual(root, beatIndex, nextNoteTime, ctx);
        step++;
        nextNoteTime += stepDuration;
      }
      timer = setTimeout(scheduler, 25);
    }
    scheduler();
  }

  function panel(id, tool) {
    var p = getSettings(id);
    return '<section class="bp-metro" data-bp-metro data-metronome-id="' + esc(id) + '">' +
      '<div class="bp-metro-head"><div><h3>' + (tool ? 'Метроном' : 'Метроном песни') + '</h3><span class="bp-metro-sub">Ручной темп без анализа и загрузки аудио</span></div><span class="bp-metro-state"><i class="bp-metro-dot"></i><span>Работает офлайн</span></span></div>' +
      '<div class="bp-metro-display"><span class="bp-metro-label">Темп</span><div class="bp-metro-number"><span class="bp-metro-bpm" data-bpm-number>' + p.bpm + '</span><span class="bp-metro-unit">BPM</span></div>' +
      '<input class="bp-metro-slider" type="range" min="30" max="260" step="1" value="' + p.bpm + '" data-bpm-range aria-label="Темп в ударах в минуту">' +
      '<div class="bp-metro-adjust"><button type="button" data-bpm-action="minus" aria-label="Уменьшить темп на один удар">−</button><button type="button" data-bpm-action="tap">Tap tempo</button><button type="button" data-bpm-action="plus" aria-label="Увеличить темп на один удар">+</button></div>' +
      '<div class="bp-metro-beats" data-bpm-beats aria-label="Доли такта"></div></div>' +
      '<div class="bp-metro-options"><label class="bp-metro-field">Размер такта<select data-bpm-meter>' +
      [[2,'2/4'],[3,'3/4'],[4,'4/4'],[5,'5/4'],[6,'6/8'],[7,'7/8']].map(function (x) { return '<option value="' + x[0] + '"' + (Number(p.beats) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
      '</select></label><label class="bp-metro-field">Дробление доли<select data-bpm-subdivision>' +
      [[1,'Без дробления'],[2,'Восьмые'],[3,'Триоли'],[4,'Шестнадцатые']].map(function (x) { return '<option value="' + x[0] + '"' + (Number(p.subdivision) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
      '</select></label><label class="bp-metro-field">Акцент первой доли<span class="bp-metro-switch"><span>Выделять начало такта</span><input type="checkbox" data-bpm-accent' + (p.accent ? ' checked' : '') + ' aria-label="Акцент первой доли"></span></label><label class="bp-metro-field">Подсказка<span class="bp-metro-switch"><span>Темп сохраняется отдельно для песни</span><span aria-hidden="true">✓</span></span></label></div>' +
      '<div class="bp-metro-actions"><button type="button" class="bp-metro-start" data-bpm-action="start" aria-pressed="false">▶ Запустить</button><button type="button" class="bp-metro-secondary" data-bpm-action="reset">Сбросить настройки</button></div>' +
      '<p class="bp-metro-status" data-bpm-status aria-live="polite">Выставь темп и нажми «Запустить».</p></section>';
  }

  function addTool() {
    var host = document.querySelector('#view [data-bp-am-tool-host]');
    if (!host || host.querySelector('[data-bp-metro]')) return;
    host.innerHTML = panel('__tool__', true);
    initPanel(host.querySelector('[data-bp-metro]'));
  }

  function addSong() {
    var id = songId();
    if (!id) return;
    var actions = document.querySelector('#view .song-detail-work-actions');
    if (!actions) return;
    var trigger = actions.querySelector('[data-bpm-open-song]');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'btn btn-secondary btn-block';
      trigger.dataset.bpmOpenSong = '1';
      trigger.textContent = 'Метроном';
      trigger.setAttribute('aria-expanded', 'false');
      actions.appendChild(trigger);
    }
    var stack = actions.closest('.stack');
    if (!stack) return;
    var root = Array.from(stack.querySelectorAll('[data-bp-metro]')).find(function (item) { return item.dataset.metronomeId === id; });
    if (!root) {
      stack.insertAdjacentHTML('beforeend', panel(id, false).replace('<section class="bp-metro"', '<section hidden class="bp-metro"'));
      root = Array.from(stack.querySelectorAll('[data-bp-metro]')).find(function (item) { return item.dataset.metronomeId === id; });
      if (root) initPanel(root);
    }
    if (root) trigger.setAttribute('aria-controls', root.id || (root.id = 'bp-metro-song-' + esc(id)));
  }

  function initPanel(root) {
    var settings = getSettings(root.dataset.metronomeId);
    renderBpm(root, settings.bpm, false);
    renderBeats(root, Number(settings.beats) || 4);
  }

  function scan() {
    addStyles();
    addTool();
    addSong();
  }

  document.addEventListener('input', function (event) {
    var range = event.target.closest && event.target.closest('[data-bpm-range]');
    if (!range) return;
    var root = range.closest('[data-bp-metro]');
    if (root) renderBpm(root, range.value, true);
  });

  document.addEventListener('change', function (event) {
    var control = event.target;
    var root = control.closest && control.closest('[data-bp-metro]');
    if (!root) return;
    if (control.matches('[data-bpm-meter]')) {
      saveSettings(root.dataset.metronomeId, { beats: Number(control.value) });
      renderBeats(root, Number(control.value));
    } else if (control.matches('[data-bpm-subdivision]')) {
      saveSettings(root.dataset.metronomeId, { subdivision: Number(control.value) });
    } else if (control.matches('[data-bpm-accent]')) {
      saveSettings(root.dataset.metronomeId, { accent: control.checked });
    }
  });

  document.addEventListener('click', function (event) {
    var openButton = event.target.closest && event.target.closest('[data-bpm-open-song]');
    if (openButton) {
      var id = songId();
      var root = Array.from(document.querySelectorAll('#view [data-bp-metro]')).find(function (item) { return item.dataset.metronomeId === id; });
      if (!root) return;
      root.hidden = !root.hidden;
      openButton.setAttribute('aria-expanded', String(!root.hidden));
      openButton.textContent = root.hidden ? 'Метроном' : 'Скрыть метроном';
      if (root.hidden && activeRoot === root) stop();
      if (!root.hidden) root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    var button = event.target.closest && event.target.closest('[data-bpm-action]');
    if (!button) return;
    var panelRoot = button.closest('[data-bp-metro]');
    if (!panelRoot) return;
    var action = button.dataset.bpmAction;
    var range = panelRoot.querySelector('[data-bpm-range]');
    if (action === 'start') {
      if (activeRoot === panelRoot) stop();
      else start(panelRoot).catch(function (error) {
        // WHY: a stale start failure must not stop a newer metronome started in another panel.
        if (startingRoot === panelRoot || activeRoot === panelRoot) stop();
        var status = panelRoot.querySelector('[data-bpm-status]');
        status.textContent = error && error.message ? error.message : 'Не удалось запустить метроном.';
        status.dataset.kind = 'error';
      });
    } else if (action === 'plus' || action === 'minus') {
      renderBpm(panelRoot, Number(range.value) + (action === 'plus' ? 1 : -1), true);
    } else if (action === 'tap') {
      var now = performance.now();
      tapTimes = tapTimes.filter(function (time) { return now - time < 2200; });
      tapTimes.push(now);
      if (tapTimes.length > 1) {
        var gaps = [];
        for (var i = 1; i < tapTimes.length; i++) gaps.push(tapTimes[i] - tapTimes[i - 1]);
        gaps.sort(function (a, b) { return a - b; });
        var median = gaps[Math.floor(gaps.length / 2)];
        if (median > 0) renderBpm(panelRoot, Math.max(30, Math.min(260, Math.round(60000 / median))), true);
      }
      var status = panelRoot.querySelector('[data-bpm-status]');
      status.textContent = tapTimes.length < 3 ? 'Продолжай нажимать Tap tempo в ритм песни.' : 'Темп задан по нажатию. При необходимости поправь его вручную.';
      status.dataset.kind = 'ok';
    } else if (action === 'reset') {
      if (activeRoot === panelRoot) stop();
      var defaults = { bpm: 100, beats: 4, subdivision: 1, accent: true };
      saveSettings(panelRoot.dataset.metronomeId, defaults);
      panelRoot.querySelector('[data-bpm-meter]').value = '4';
      panelRoot.querySelector('[data-bpm-subdivision]').value = '1';
      panelRoot.querySelector('[data-bpm-accent]').checked = true;
      renderBpm(panelRoot, 100, false);
      renderBeats(panelRoot, 4);
      var status = panelRoot.querySelector('[data-bpm-status]');
      status.textContent = 'Настройки сброшены.';
      status.dataset.kind = '';
      tapTimes = [];
    }
  });

  // WHY: observe only the routed app content, not the whole document.
  // Metronome UI updates (status text and beat dots) must not trigger another full scan.
  var viewRoot = document.getElementById('view');
  var observer = viewRoot ? new MutationObserver(function (records) {
    if (records.some(function (record) {
      return !(record.target.closest && record.target.closest('[data-bp-metro]'));
    })) {
      // WHY: tool tabs can replace #view content without changing the hash; stop active or pending audio when its panel is detached.
      if ((activeRoot && !viewRoot.contains(activeRoot)) || (startingRoot && !viewRoot.contains(startingRoot))) stop();
      scan();
    }
  }) : null;
  if (observer && viewRoot) observer.observe(viewRoot, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () {
    stop();
    tapTimes = [];
    setTimeout(scan, 0);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
  });
  window.addEventListener('pagehide', stop);
  scan();
})();