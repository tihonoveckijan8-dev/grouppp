                              /* ═══════════════════════════════════════════════════════════════════════
   BandPlan — Music Group OS · v6.0 (editorial clay)
   Файл 3/3 · логика
   Расписание (месяц/неделя/день) · репертуар с динамикой партий по роли ·
   сет-листы (drag&drop) · сцена · оформление · офлайн · доступность
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const Boot = (() => {
  const el = document.getElementById('boot');
  const app = document.getElementById('app');
  const stageEl = () => document.getElementById('bootStage');
  const barEl = () => document.getElementById('bootBar');
  const slowEl = () => document.getElementById('bootSlow');
  const t0 = performance.now();
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const warm = nav.type === 'reload' || nav.type === 'back_forward';
  const MIN = 0;
  let lastAnnounce = 0, slowT = 0, finished = false, slowShown = false;

  function stage(text, pct) {
    if (!el || finished) return;
    const now = performance.now(), next = Math.max(0, Math.min(100, Number(pct) || 0));
    const label = stageEl();
    if (label) {
      label.style.opacity = '0';
      setTimeout(() => { if (!finished && label) { label.textContent = text; label.style.opacity = '1'; } }, 80);
    }
    if (barEl()) barEl().style.transform = 'scaleX(' + Math.max(.08, next / 100) + ')';
    if (now - lastAnnounce >= 800 || next >= 100) { if (el) el.setAttribute('aria-label', text); lastAnnounce = now; }
    clearTimeout(slowT);
    slowT = setTimeout(slow, 8000);
  }
  function slow() {
    if (!el || finished || slowShown) return;
    slowShown = true;
    const x = slowEl(); if (x) x.hidden = false;
  }
  function fail(opts) {
    if (!el) return;
    // WHY: a late auth/network failure must remain visible even if startup already called done() and detached the boot surface.
    if (!el.isConnected && document.body) document.body.prepend(el);
    clearTimeout(slowT);
    finished = false;
    el.classList.remove('is-leaving');
    el.classList.add('is-error');
    let core = el.querySelector('.boot-core');
    // WHY: keep failure rendering resilient if markup is stale in a cached PWA shell.
    if (!core) { core = document.createElement('div'); core.className = 'boot-core'; el.replaceChildren(core); }
    const title = opts && opts.title || 'Не удалось запустить BandPlan';
    const body = opts && opts.text || 'Попробуйте ещё раз. Ваши локальные данные не удалены.';
    const actions = opts && opts.actions || '<button type="button" id="bootRetry">Повторить</button>';
    if (core) core.innerHTML = '<div class="boot-error-ic" aria-hidden="true">' + ic('alert', 24) + '</div><div class="boot-error-title">' + esc(title) + '</div><div class="boot-error-text">' + esc(body) + '</div><div class="boot-acts">' + actions + '</div>';
    el.setAttribute('aria-label', title + '. ' + body);
    const retry = document.getElementById('bootRetry'); if (retry) retry.addEventListener('click', () => location.reload(), {once:true});
  }
  function done() {
    if (!el || finished) return;
    finished = true;
    clearTimeout(slowT);
    const label = stageEl();
    if (label) { label.style.opacity = '0'; setTimeout(() => { if (label) { label.textContent = 'Всё готово'; label.style.opacity = '1'; } }, 60); }
    if (barEl()) barEl().style.transform = 'scaleX(1)';
    const wait = Math.max(0, MIN - (performance.now() - t0));
    setTimeout(() => {
      if (!el || !el.isConnected) return;
      el.classList.add('is-leaving');
      const rm = () => { if (el.isConnected) el.remove(); };
      el.addEventListener('transitionend', rm, {once:true});
      setTimeout(rm, 600);
      if (app) { app.removeAttribute('inert'); app.setAttribute('aria-busy', 'false'); }
      const main = document.querySelector('main') || document.getElementById('view');
      if (main) { main.setAttribute('tabindex', '-1'); try { main.focus({preventScroll:true}); } catch(e) { try { main.focus(); } catch(_) {} } }
    }, wait + 120);
  }
  if (el) {
    const offline = document.getElementById('bootOffline');
    const retry = document.getElementById('bootRetry');
    if (offline) offline.addEventListener('click', () => {
      window.__bandplanOfflineRequested = true;
      window.__bandplanBootAttempt = (window.__bandplanBootAttempt || 0) + 1;
      startBandPlan(true);
    });
    if (retry) retry.addEventListener('click', () => location.reload());
    if (navigator.onLine === false) stage('Нет сети — проверяем сохранённый вход', 60);
  }
  return {stage, slow, fail, done};
})();

/* ═══ 1. HELPERS ═══ */
const cloneValue = value => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const uid = p => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
const today = () => iso(new Date());
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONF = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const WDF = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const DOW = s => (new Date(s + 'T00:00:00').getDay() + 6) % 7;
function pdate(s) { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.getDate() + ' ' + MON[d.getMonth()]; }
function pdateFull(s) { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return WDF[DOW(s)] + ', ' + d.getDate() + ' ' + MONF[d.getMonth()] + ' ' + d.getFullYear(); }
function pdateShort(s) { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return WD[DOW(s)] + ', ' + d.getDate() + ' ' + MON[d.getMonth()]; }
function daysTo(s) { return Math.round((new Date(s + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000); }
function plural(n, a, b, c) { const m = n % 10, h = n % 100; if (m === 1 && h !== 11) return a; if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return b; return c; }
function countdown(s) { const n = daysTo(s); if (n === 0) return 'сегодня'; if (n === 1) return 'завтра'; if (n === -1) return 'вчера'; return n > 0 ? 'через ' + n + ' ' + plural(n, 'день', 'дня', 'дней') : Math.abs(n) + ' ' + plural(Math.abs(n), 'день', 'дня', 'дней') + ' назад'; }
function fmtDur(sec) { sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
function durParse(v) { const m = /^(\d+):(\d{1,2})$/.exec(String(v || '').trim()); if (m) return (+m[1]) * 60 + (+m[2]); const n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
function mins(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim()); return m ? (+m[1]) * 60 + (+m[2]) : 0; }
function debounce(fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 250); }; }
async function copyTextReliable(value) {
  const text = String(value == null ? '' : value);
  if (!text) return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);
    const ok = document.execCommand('copy');
    area.remove();
    return !!ok;
  } catch (e) {
    return false;
  }
}

/* ═══ 2. ICONS (единая толщина линии 1.7) ═══ */
const ICONS = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 17 17"/>',
  filter: '<path d="M3.5 5.5h17l-6.6 7.6v5.6l-3.8 2v-7.6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  play: '<path d="M7.5 4.8v14.4L19 12z"/>', pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  trash: '<path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14.5 5.5 18.5 9.5"/>',
  star: '<path d="M12 3.6l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.9l6-.8z"/>',
  print: '<path d="M7 9V3.8h10V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="2"/><path d="M7 14h10v6.2H7z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.4 2"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M17.6 14.4A6.2 6.2 0 0 1 21.2 20"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2.4"/><path d="M8.5 21h7M12 17v4"/>',
  dl: '<path d="M12 3v12M7.5 11 12 15.5 16.5 11M4 20.5h16"/>', ul: '<path d="M12 20V8M7.5 12 12 7.5 16.5 12M4 3.5h16"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 20 6.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.7 2.7L16 9.6"/>',
  alert: '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  wifiOff: '<path d="M2 3l20 20M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 4-2.5M19 12a10 10 0 0 0-6.5-2.9M2.5 8.5A15 15 0 0 1 8 5.6M21.5 8.5a15 15 0 0 0-6.2-3"/>',
  grip: '<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/>',
  mic: '<rect x="9" y="2.6" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.4M8.6 21.4h6.8"/>',
  repeat: '<path d="M17 2.5 21 6l-4 3.5"/><path d="M21 6H7.5A3.5 3.5 0 0 0 4 9.5V11"/><path d="M7 21.5 3 18l4-3.5"/><path d="M3 18h13.5a3.5 3.5 0 0 0 3.5-3.5V13"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 5.5h-9a2.5 2.5 0 0 0-2.5 2.5v9"/>',
  bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  link: '<path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
  wave: '<path d="M2 12h2.5l2-6 3 13 3-9 2 4H22"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  rows: '<rect x="3" y="4.5" width="18" height="5" rx="2"/><rect x="3" y="14.5" width="18" height="5" rx="2"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.7-1.2-2.9 0-.8.7-1.3 1.6-1.3H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z"/><circle cx="7.8" cy="11" r="1.1" fill="currentColor"/><circle cx="11" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15.6" cy="8.4" r="1.1" fill="currentColor"/>',
  sparkles: '<path d="M12 2.8l1.4 4.8L18.2 9l-4.8 1.4L12 15.2l-1.4-4.8L5.8 9l4.8-1.4z"/><path d="M19 14.8l.7 2.5 2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7z"/><path d="M5 16.2l.5 1.8 1.8.5-1.8.5L5 20.8l-.5-1.8-1.8-.5 1.8-.5z"/>',
      inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  userX: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="m16 9 5 5M21 9l-5 5"/>'
};
function ic(n, s) { s = s || 18; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }

/* ═══ 3. CHORDS ═══ */
const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD_RE = /^[A-G](?:#|b)?(?:m(?:aj|in)?|sus[24]?|dim|aug|add\d+)?\d*(?:(?:b|#)\d+)?(?:\/[A-G](?:#|b)?)?$/;
const KEY_LIST = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm'];
const isChord = t => CHORD_RE.test(String(t || '').trim());
function transposeChord(c, n) {
  n = n || 0;
  return String(c).split('/').map(function (p) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(p); if (!m) return p;
    const base = m[1] + m[2]; if (NOTE_IDX[base] == null) return p;
    const mode = state.settings.notation;
    const tbl = (mode === 'flat' || (mode === 'auto' && m[2] === 'b')) ? FLAT : SHARP;
    return tbl[(NOTE_IDX[base] + n + 120) % 12] + m[3];
  }).join('/');
}
const transposeKey = (k, n) => !k ? k : String(k).split(/\s+/).map(t => isChord(t) ? transposeChord(t, n) : t).join(' ');
function parseSectionHeading(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const bracketed = /^\[([^\]]+)\]$/.exec(raw);
  if (bracketed) {
    const source = bracketed[1].trim();
    return source && !isChord(source) ? { source: source, bracketed: true } : null;
  }
  // Normalize common headings from pasted lyric sheets:
  // "# Куплет 1", "1. Куплет", "Куплет 1:", "(Bridge)", "CHORUS 2 (x2)".
  let plain = raw.replace(/^#{1,3}\s*/, '');
  const leadingNumber = /^(\d{1,2})(?:[.)]|[-:]|\s+)\s*(.+)$/.exec(plain);
  if (leadingNumber) plain = leadingNumber[2].trim();
  // Accept common lyric-sheet variants such as "1 Куплет", "Куплет №1",
  // "Куплет (1)" and unbracketed headings pasted from notes.
  plain = plain.replace(/^(куплет|verse|стих)\s*(?:№|#)?\s*[([]?\s*(\d{1,2})\s*[)\]]?$/i, '$1 $2');
  plain = plain.replace(/^\((.*)\)$/, '$1').replace(/\s*\((?:x|х)\s*\d+\)$/i, '').replace(/[：:]\s*$/, '').trim();
  if (!plain || plain.length > 48) return null;
  const parsed = classifySongSection(plain);
  if (parsed.custom) return null;
  // Keep numeric prefixes as part of the displayed section label:
  // "1. Куплет", "2) Куплет", "Куплет 1" all become "Куплет 1".
  const label = leadingNumber && parsed.type === 'Куплет' && !/\d+/.test(plain)
    ? 'Куплет ' + leadingNumber[1]
    : (parsed.label || plain);
  return { source: label, bracketed: false };
}
function isSection(l) { return !!parseSectionHeading(l); }
function isChordLine(l) {
  const t = String(l || '').trim(); if (!t || t.charAt(0) === '[') return false;
  const a = t.split(/\s+/); for (let i = 0; i < a.length; i++) if (!isChord(a[i])) return false; return true;
}
function transposeLyrics(text, n) {
  if (!n) return text || '';
  return String(text || '').split('\n').map(function (l) {
    if (isSection(l)) return l;
    if (isChordLine(l)) return l.replace(/[^\s]+/g, t => isChord(t) ? transposeChord(t, n) : t);
    return l.replace(/\[([A-G][^\]\s]*)\]/g, (m, c) => isChord(c) ? '[' + transposeChord(c, n) + ']' : m);
  }).join('\n');
}
function renderLyrics(text, n) {
  const out = [];
  String(text || '').split('\n').forEach(function (line) {
    if (state.settings.showChords === false) line = line.replace(/\[([A-G][^\]\s]*)\]/g, (m, c) => isChord(c) ? '' : m);
    if (!line.trim()) { out.push('<span class="ln"> </span>'); return; }
    const sectionHeading = parseSectionHeading(line);
    if (sectionHeading) { out.push('<span class="ln sec">' + esc(sectionHeading.source) + '</span>'); return; }
    if (isChordLine(line)) {
      if (state.settings.showChords === false) return;
      out.push('<span class="ln">' + line.split(/(\s+)/).map(function (p) {
        if (/^\s+$/.test(p)) return p;
        return isChord(p) ? '<b class="ch">' + esc(transposeChord(p, n)) + '</b>' : esc(p);
      }).join('') + '</span>'); return;
    }
    out.push('<span class="ln">' + esc(line).replace(/\[([A-G][^\]\s]*)\]/g, (m, c) => isChord(c) ? '<b class="ch inl">' + esc(transposeChord(c, n)) + '</b>' : m) + '</span>');
  });
  return out.join('');
}
function extractChords(text) {
  const out = [], seen = {};
  String(text || '').split('\n').forEach(function (l) {
    if (isSection(l)) return;
    if (isChordLine(l)) { l.trim().split(/\s+/).forEach(t => { if (isChord(t) && !seen[t]) { seen[t] = 1; out.push(t); } }); return; }
    const re = /\[([A-G][^\]\s]*)\]/g; let m;
    while ((m = re.exec(l)) !== null) if (isChord(m[1]) && !seen[m[1]]) { seen[m[1]] = 1; out.push(m[1]); }
  });
  return out;
}
function classifySongSection(value) {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  const lower = raw.toLocaleLowerCase('ru');
  const patterns = [
    { type: 'Вступление', re: /^(?:intro|интро|вступлени(?:е|я)|opening)(?:\s*\d+)?$/i },
    { type: 'Куплет', re: /^(?:verse|куплет|стих)(?:\s*\d+)?$/i },
    { type: 'Предприпев', re: /^(?:pre[ -]?chorus|предприпев|предприпевная часть|подводка к припеву)(?:\s*\d+)?$/i },
    { type: 'Припев', re: /^(?:chorus|refrain|hook|припев|рефрен|хук)(?:\s*\d+)?$/i },
    { type: 'Бридж', re: /^(?:bridge|бридж|переход|связка)(?:\s*\d+)?$/i },
    { type: 'Проигрыш', re: /^(?:instrumental|instrumental break|проигрыш|инструментал|инструментальная часть)(?:\s*\d+)?$/i },
    { type: 'Соло', re: /^(?:solo|гитарное соло|соло)(?:\s*\d+)?$/i },
    { type: 'Финал', re: /^(?:outro|финал|окончание|концовка|кода|coda)(?:\s*\d+)?$/i },
    { type: 'Постприпев', re: /^(?:post[ -]?chorus|постприпев)(?:\s*\d+)?$/i },
    { type: 'Брейк', re: /^(?:break|брейк|пауза|stop time)(?:\s*\d+)?$/i }
  ];
  for (const item of patterns) {
    const match = item.re.exec(raw);
    if (match) {
      const number = /\d+/.exec(raw);
      return { type: item.type, label: number ? item.type + ' ' + number[0] : item.type, numbered: !!number };
    }
  }
  return { type: raw, label: raw, numbered: /\d+/.test(raw), custom: true };
}
function extractSectionOccurrences(text) {
  const lines = String(text || '').split('\n');
  const out = [], counts = Object.create(null), used = Object.create(null);
  lines.forEach(function (line, lineIndex) {
    const heading = parseSectionHeading(line);
    if (!heading) return;
    const parsed = classifySongSection(heading.source);
    if (!parsed.label) return;
    const count = (counts[parsed.type] || 0) + 1;
    counts[parsed.type] = count;
    let label = parsed.label;
    // Repeated unnumbered section headings get independent dynamics entries.
    if (!parsed.numbered && count > 1) label = parsed.type + ' ' + count;
    if (used[label]) {
      let suffix = Math.max(count, 2);
      while (used[parsed.type + ' ' + suffix]) suffix++;
      label = parsed.type + ' ' + suffix;
    }
    used[label] = true;
    out.push({ source: heading.source, type: parsed.type, label: label, lineIndex: lineIndex, explicit: true });
  });
  if (out.length) return out;

  // If headings are absent, scan blank-line-separated stanzas. A repeated stanza
  // is a strong chorus signal; only then infer verse/chorus labels to avoid guessing
  // structure from arbitrary lyric lines.
  const stanzas = [];
  let start = -1, chunk = [];
  function finishStanza() {
    if (start < 0) return;
    const raw = chunk.join('\n').trim();
    const normalized = chunk.filter(line => !isChordLine(line))
      .join(' ').replace(/\[[A-G](?:#|b)?[^\]]*\]/g, ' ')
      .toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
    if (normalized) stanzas.push({ startLine: start, source: raw, normalized: normalized });
    start = -1; chunk = [];
  }
  lines.forEach((line, index) => {
    if (!line.trim()) { finishStanza(); return; }
    if (start < 0) start = index;
    chunk.push(line);
  });
  finishStanza();
  if (!stanzas.length) return [];
  const frequency = Object.create(null);
  stanzas.forEach(stanza => { frequency[stanza.normalized] = (frequency[stanza.normalized] || 0) + 1; });
  // Repeated stanzas are the strongest chorus signal. If there are no repeated
  // stanzas, expose each lyric stanza as a sequential verse instead of leaving
  // the dynamics panel empty; musicians can refine labels with explicit headings.
  const hasRepeated = stanzas.some(stanza => frequency[stanza.normalized] > 1);
  let verse = 0, chorus = 0;
  return stanzas.map(stanza => {
    if (hasRepeated && frequency[stanza.normalized] > 1) {
      chorus++;
      return { source: 'Припев', type: 'Припев', label: chorus === 1 ? 'Припев' : 'Припев ' + chorus, lineIndex: stanza.startLine, explicit: false };
    }
    verse++;
    return { source: 'Куплет ' + verse, type: 'Куплет', label: 'Куплет ' + verse, lineIndex: stanza.startLine, explicit: false };
  });
}
function extractSections(text) {
  return extractSectionOccurrences(text).map(section => section.label);
}

/* ═══ 4. ROLES / DYNAMICS / TYPES ═══ */
const ROLES = [
  { k: 'vocal', label: 'Вокал', icon: 'mic' }, { k: 'guitar', label: 'Гитара', icon: 'music' },
  { k: 'bass', label: 'Бас-гитара', icon: 'music' }, { k: 'drums', label: 'Ударные', icon: 'bolt' },
  { k: 'keys', label: 'Клавиши', icon: 'monitor' }, { k: 'violin', label: 'Скрипка', icon: 'wave' },
  { k: 'sax', label: 'Саксофон', icon: 'mic' }, { k: 'backing', label: 'Бэк-вокал', icon: 'users' },
  { k: 'sound', label: 'Звукорежиссёр', icon: 'gear' }, { k: 'other', label: 'Другое', icon: 'target' }
];
const myRoles = () => { const p = state.profile; return Array.isArray(p.roles) && p.roles.length ? p.roles : (p.role ? [p.role] : []); };
const rolesOf = m => Array.isArray(m.roles) && m.roles.length ? m.roles : (m.role ? [m.role] : []);
const rolesLabel = list => { const a = (list || []).map(k => roleLabel(k)); return a.length ? a.join(', ') : '—'; };
let deferredInstall = null;
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function isIOSDevice() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function installButtonVisible() {
  // Show a clear install entry on every supported platform; where the browser
  // has no install prompt, the action opens platform-specific instructions.
  return !isStandalone();
}
function syncInstallButton() {
  const b = $('#pwaBtn');
  if (b) b.hidden = !installButtonVisible();
}
function doInstall() {
  if (isStandalone()) { syncInstallButton(); return; }
  if (deferredInstall) {
    const promptEvent = deferredInstall;
    promptEvent.prompt();
    promptEvent.userChoice.then(choice => {
      if (choice && choice.outcome === 'accepted') {
        deferredInstall = null;
        syncInstallButton();
      } else {
        // Пользователь закрыл системный диалог: установку можно предложить снова.
        deferredInstall = null;
        syncInstallButton();
      }
    }).catch(() => syncInstallButton());
    return;
  }
  if (isIOSDevice()) {
    openModal({title:'Установка на iPhone и iPad',sub:'Добавьте BandPlan на экран «Домой»',guard:false,body:'<div class="ios-install-steps"><div class="ios-install-step"><span>1</span><p>Откройте сайт именно в <strong>Safari</strong>.</p></div><div class="ios-install-step"><span>2</span><p>Нажмите кнопку <strong>Поделиться</strong> внизу экрана (квадрат со стрелкой вверх).</p></div><div class="ios-install-step"><span>3</span><p>Прокрутите меню и выберите <strong>На экран «Домой»</strong>.</p></div><div class="ios-install-step"><span>4</span><p>Подтвердите добавление кнопкой <strong>Добавить</strong>.</p></div></div><p class="sub mt-s">После этого запускайте BandPlan с нового значка. Для первого запуска и загрузки данных потребуется интернет.</p>'});
  } else {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isEdge = /Edg\//i.test(ua);
    const isChrome = /Chrome\//i.test(ua) && !isEdge;
    const isFirefox = /Firefox\//i.test(ua);
    let steps;
    if (isAndroid) {
      steps = '<p>Откройте меню браузера (⋮) и выберите <strong>Установить приложение</strong> или <strong>Добавить на главный экран</strong>. Название пункта зависит от браузера.</p>';
    } else if (isChrome || isEdge) {
      steps = '<p>Откройте меню браузера и выберите <strong>Установить BandPlan</strong> или <strong>Приложения → Установить этот сайт как приложение</strong>. Также рядом с адресной строкой может быть значок установки.</p>';
    } else if (isFirefox) {
      steps = '<p>В этом браузере установка PWA может быть недоступна. На Android попробуйте меню браузера и пункт добавления на главный экран; на компьютере откройте BandPlan в Chrome или Edge.</p>';
    } else {
      steps = '<p>Откройте меню браузера и найдите пункт <strong>Установить приложение</strong> или <strong>Добавить на главный экран</strong>. Если такого пункта нет, откройте сайт в Chrome, Edge или Safari (на iPhone/iPad).</p>';
    }
    openModal({title:'Установка BandPlan',sub:'Установите приложение на это устройство',guard:false,body:steps + '<p class="sub mt-s">Если пункт установки не отображается, проверьте, что сайт открыт по HTTPS и манифест приложения загружен.</p>'});
  }
}
window.addEventListener('beforeinstallprompt', e => {
  if (isStandalone()) return;
  e.preventDefault();
  deferredInstall = e;
  syncInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  syncInstallButton();
});
// Состояние может измениться, пока вкладка открыта или после возврата из установки.
window.addEventListener('pageshow', syncInstallButton);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncInstallButton(); });
if (window.matchMedia) {
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  if (standaloneQuery.addEventListener) standaloneQuery.addEventListener('change', syncInstallButton);
  else if (standaloneQuery.addListener) standaloneQuery.addListener(syncInstallButton);
}
function syncSceneChords() { const b = $('#scChords'); if (b) { const on = state.settings.showChords !== false; b.setAttribute('aria-pressed', on); b.classList.toggle('off', !on); } }
const roleLabel = k => (ROLES.find(r => r.k === k) || { label: k || '—' }).label;
const DYN_LEVELS = ['', 'pp', 'p', 'mp', 'mf', 'f', 'ff'];
const DYN_LABEL = { '': 'не задано', pp: 'очень тихо', p: 'тихо', mp: 'умеренно тихо', mf: 'умеренно громко', f: 'громко', ff: 'очень громко' };
const dynCls = v => ({ pp: 'd1', p: 'd2', mp: 'd3', mf: 'd4', f: 'd5', ff: 'd6' }[v] || 'd0');
const EV_TYPES = {
  gig: { label: 'Выступление', cls: 'b-info', ic: 'mic' },
  rehearsal: { label: 'Репетиция', cls: 'b-ok', ic: 'music' },
  recording: { label: 'Запись', cls: 'b-brand', ic: 'monitor' },
  meeting: { label: 'Встреча', cls: 'b-warn', ic: 'users' }
};
const REPEATS = { none: 'Без повтора', weekly: 'Каждую неделю', biweekly: 'Каждые 2 недели', monthly: 'Каждый месяц' };
const PALETTE = Object.freeze(['--palette-1','--palette-2','--palette-3','--palette-4','--palette-5','--palette-6','--palette-7','--palette-8']);
const ACCENTS = Object.freeze(['red','orange','amber','green','teal','blue','indigo','purple','pink']);
const ACCENT_LABELS = Object.freeze({red:'Красный',orange:'Оранжевый',amber:'Янтарный',green:'Зелёный',teal:'Бирюзовый',blue:'Синий',indigo:'Индиго',purple:'Фиолетовый',pink:'Розовый'});

/* ═══ 5. STATE ═══ */
let KEY = 'bandplan.premium.v6';
function defaults() {
  const bootTheme = ['light','dark','amoled'].includes(document.documentElement.dataset.theme)
    ? document.documentElement.dataset.theme : 'light';
  const boot = (() => { try { return JSON.parse(localStorage.getItem('bandplan.boot') || 'null') || {}; } catch (e) { return {}; } })();
  const storedAccent = localStorage.getItem('accent') || '';
  const storedPreset = ACCENTS.includes(String(storedAccent).toLowerCase()) ? String(storedAccent).toLowerCase() : '';
  const bootPreset = ACCENTS.includes(boot.accentPreset) ? boot.accentPreset : storedPreset;
  const bootAccent = /^#[0-9a-fA-F]{6}$/.test(storedAccent) ? storedAccent.toUpperCase() : (bootPreset ? presetAccentColor(bootPreset, bootTheme) : tokenColor('--accent-default'));
  return {
    profile: { name: '', role: '', bandName: 'Моя группа', bandDesc: '', defaultParticipation: 'yes', roles: [] },
    members: [], events: [], songs: [], setlists: [],
    settings: {
      theme: bootTheme, accent: bootAccent, accentPreset: bootPreset || null, notation: 'auto', weekStart: 1,
      lyricsSize: 15, sceneSize: 26, sceneSpeed: 60, autoscroll: true, reduced: false, calView: 'month', toastMode: 'off', showChords: true,
      offlineSongsAutoSave: true, offlineSongsDays: 30, offlineSongsNearestCount: 3, offlineSongsSaveMaybe: false
    },
    onboardingDone: false
  };
}
let state = defaults(), uiInitialized = false;
const ui = {
  month: new Date(), selDate: today(), calView: 'month',
  evQuery: '', evTypes: [], evMine: false, evMineMode: 'yes', evRepeat: false,
  songQuery: '', setlistQuery: '', songKey: '', songTag: '', songSort: 'title', songFav: false, songSelectedId: '', setlistSelectedId: '',
  libQuery: '', detailTrans: {}, searchQ: '', searchIdx: 0, searchFlat: [], skeleton: false, skeletonTimer: 0, skeletonToken: 0, skeletonShownAt: 0
};
const participationPending = new Set();
const participationPrevious = new Map();
let offlineSongSyncTimer = 0;
let offlineSongSyncBusy = false;
const offlineSongIndex = new Map();
let offlineSongStorageWarned = false;
function offlineSongSettings() {
  const s=state.settings||{};
  return {
    auto:s.offlineSongsAutoSave !== false,
    days:clamp(Number(s.offlineSongsDays||30),1,90),
    count:clamp(Number(s.offlineSongsNearestCount||3),1,10),
    maybe:s.offlineSongsSaveMaybe === true
  };
}
function eventStartMs(ev) {
  if (!ev?.date) return NaN;
  const time=ev.time || '00:00';
  const ms=Date.parse(String(ev.date)+'T'+String(time));
  return Number.isFinite(ms) ? ms : NaN;
}
function eventEndMs(ev) {
  const start=eventStartMs(ev);
  if(!Number.isFinite(start))return NaN;
  if(ev.end) {
    const ms=Date.parse(String(ev.date)+'T'+String(ev.end));
    if(Number.isFinite(ms) && ms>=start)return ms;
  }
  return start+3*60*60*1000;
}
/*
 * Automatically remove expired one-off events. For repeating events, expire only
 * the past occurrence so the rest of the series remains intact. Cleanup is
 * persisted through the existing local snapshot/cloud queue.
 */
function cleanupExpiredEvents() {
  const now = Date.now();
  const todayKey = today();
  let changed = false;
  const kept = [];

  state.events.forEach(ev => {
    if (!ev || !ev.date) { kept.push(ev); return; }
    const repeat = ev.repeat && ev.repeat !== 'none';
    if (!repeat) {
      if (eventEndMs(ev) <= now) changed = true;
      else kept.push(ev);
      return;
    }

    const start = new Date(String(ev.date) + 'T00:00:00');
    if (!Number.isFinite(start.getTime()) || iso(start) > todayKey) {
      kept.push(ev);
      return;
    }

    const until = ev.repeatUntil ? new Date(String(ev.repeatUntil) + 'T00:00:00') : new Date(todayKey + 'T00:00:00');
    const stop = until < new Date(todayKey + 'T00:00:00') ? until : new Date(todayKey + 'T00:00:00');
    const except = Array.isArray(ev.except) ? ev.except.slice() : [];
    const originalCount = except.length;
    const d = new Date(start);
    let guard = 0;
    while (d <= stop && guard++ < 400) {
      const occurrenceDate = iso(d);
      if (except.indexOf(occurrenceDate) < 0 && eventEndMs({ ...ev, date: occurrenceDate }) <= now) {
        except.push(occurrenceDate);
      }
      if (ev.repeat === 'weekly') d.setDate(d.getDate() + 7);
      else if (ev.repeat === 'biweekly') d.setDate(d.getDate() + 14);
      else if (ev.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
      else break;
    }
    if (except.length !== originalCount) {
      ev.except = except;
      changed = true;
    }
    kept.push(ev);
  });

  if (!changed) return false;
  state.events = kept;
  expandCache.clear();
  searchCorpus = null;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('BandPlan expired-event cleanup local persistence failed:', e); }
  if (window.BandPlanCloud && typeof window.BandPlanCloud.schedule === 'function') {
    window.BandPlanCloud.schedule(state);
  }
  scheduleOfflineSongSync();
  return true;
}

function eligibleOfflineEvents() {
  const cfg=offlineSongSettings(), now=Date.now(), limit=now+cfg.days*86400000;
  return state.events
    .filter(ev => ev && (ev.status||'upcoming')==='upcoming' && eventStartMs(ev)>=now && eventStartMs(ev)<=limit && ev.setlistId)
    .filter(ev => ['yes'].includes(eventStatusFor(ev)) || (cfg.maybe && eventStatusFor(ev)==='maybe'))
    .sort((a,b)=>eventStartMs(a)-eventStartMs(b))
    .slice(0,cfg.count);
}
function offlineSongsForEvent(ev) {
  const sl=ev?.setlistId ? slById(ev.setlistId) : null;
  if(!sl)return [];
  return (sl.items||[]).map(item=>{
    const song=songById(item.songId);
    if(!song)return null;
    const copy=cloneValue(song);
    copy.offlineSetlistShift=Number(item.shift||0);
    copy.offlineSetlistNote=String(item.note||'');
    copy.offlineSetlistItemId=String(item.id||'');
    return copy;
  }).filter(Boolean);
}
function rebuildOfflineSongIndex(rows) {
  offlineSongIndex.clear();
  (rows || []).forEach(row => (row.songs || []).forEach(song => {
    if (song?.id && !offlineSongIndex.has(String(song.id))) offlineSongIndex.set(String(song.id), cloneValue(song));
  }));
}
async function hydrateOfflineSongsIntoState() {
  if(!window.BandPlanCloud?.listOfflineEventSongs)return;
  try {
    const rows=await window.BandPlanCloud.listOfflineEventSongs();
    rebuildOfflineSongIndex(Array.isArray(rows) ? rows : []);
  } catch(error) { console.warn('BandPlan offline song hydration failed:',error); }
}
function shouldCleanupOfflineEventSongRow(row, ev, now, cfg, keep) {
  if (!ev) return true;
  const status = eventStatusFor(ev);
  const participating = status === 'yes' || (cfg.maybe && status === 'maybe');
  const stillActive = (ev.status || 'upcoming') === 'upcoming' && !!ev.setlistId &&
    participating && eventEndMs(ev) + 6 * 60 * 60 * 1000 >= now;
  if (!stillActive) return true;
  return !keep.has(String(row.eventId)) && eventStartMs(ev) >= now;
}
async function cleanupEventOfflineSongs() {
  if(!window.BandPlanCloud?.listOfflineEventSongs)return;
  try {
    const rows=await window.BandPlanCloud.listOfflineEventSongs(), now=Date.now(), keep=new Set(eligibleOfflineEvents().map(e=>String(e.id))), cfg=offlineSongSettings();
    for(const row of rows||[]) {
      const ev=state.events.find(e=>String(e.id)===String(row.eventId));
      if(shouldCleanupOfflineEventSongRow(row, ev, now, cfg, keep)) {
        await window.BandPlanCloud.deleteOfflineEventSongs(String(row.eventId));
      }
    }
    const remaining=await window.BandPlanCloud.listOfflineEventSongs();
    rebuildOfflineSongIndex(Array.isArray(remaining) ? remaining : []);
  } catch(error) { console.warn('BandPlan offline song cleanup failed:',error); }
}
async function syncEventOfflineSongs() {
  if(offlineSongSyncBusy || !window.BandPlanCloud?.saveOfflineEventSongs)return;
  const cfg=offlineSongSettings();
  offlineSongSyncBusy=true;
  try {
    await cleanupEventOfflineSongs();
    if(!cfg.auto) return;
    const eligible=eligibleOfflineEvents();
    for(const ev of eligible) {
      const songs=offlineSongsForEvent(ev);
      const ok=await window.BandPlanCloud.saveOfflineEventSongs({
        eventId:String(ev.id),setlistId:String(ev.setlistId),eventDate:String(ev.date||''),
        eventEnd:new Date(eventEndMs(ev)).toISOString(),songs,savedAt:new Date().toISOString(),version:1
      });
      if(ok !== false) songs.forEach(song => { if(song?.id) offlineSongIndex.set(String(song.id), cloneValue(song)); });
      if(ok===false && !offlineSongStorageWarned) {
        offlineSongStorageWarned=true;
        toast('Не удалось сохранить песни на устройстве. Приложение продолжит работать без офлайн-копии.','warn',5000);
      }
    }
  } catch(error) {
    console.warn('BandPlan offline song sync failed:',error);
    if(!offlineSongStorageWarned){offlineSongStorageWarned=true;toast('Не удалось обновить офлайн-копии песен.','warn',5000);}
  } finally { offlineSongSyncBusy=false; }
}
function scheduleOfflineSongSync(delay=900) {
  clearTimeout(offlineSongSyncTimer);
  offlineSongSyncTimer=setTimeout(()=>{syncEventOfflineSongs().catch(()=>{});},delay);
}
async function refreshOfflineEventInfo(eventId) {
  const box=document.querySelector('[data-offline-event-songs="' + CSS.escape(String(eventId)) + '"]');
  if(!box || !window.BandPlanCloud?.getOfflineEventSongs)return;
  try {
    const row=await window.BandPlanCloud.getOfflineEventSongs(String(eventId));
    if(!row){ box.innerHTML=''; box.hidden=true; return; }
    const count=Array.isArray(row.songs)?row.songs.length:0;
    const stamp=row.savedAt?new Date(row.savedAt):null;
    const when=stamp && !Number.isNaN(stamp.getTime()) ? stamp.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'недавно';
    box.hidden=false;
    box.innerHTML='<div class="offline-song-copy"><strong>' + ic('download',13) + 'Песни сохранены на устройстве</strong><span>' + count + ' ' + plural(count,'песня','песни','песен') + ' · обновлено ' + esc(when) + '</span></div>' +
      '<div class="offline-song-actions"><button class="btn btn-tertiary btn-sm" type="button" data-act="offline-songs-refresh" data-id="' + esc(String(eventId)) + '">Обновить</button><button class="btn btn-tertiary btn-sm" type="button" data-act="offline-songs-delete" data-id="' + esc(String(eventId)) + '">Удалить с устройства</button></div>';
  } catch(error) { console.warn('BandPlan offline event info failed:',error); }
}
async function forceOfflineEventSongs(eventId) {
  const ev=evById(String(eventId||''));
  if(!ev || !offlineSongsForEvent(ev).length || !window.BandPlanCloud?.saveOfflineEventSongs)return;
  const ok=await window.BandPlanCloud.saveOfflineEventSongs({
    eventId:String(ev.id),setlistId:String(ev.setlistId||''),eventDate:String(ev.date||''),
    eventEnd:new Date(eventEndMs(ev)).toISOString(),songs:offlineSongsForEvent(ev),savedAt:new Date().toISOString(),version:1
  });
  if(ok===false) throw new Error('IndexedDB недоступна или заполнена.');
  await refreshOfflineEventInfo(ev.id);
  toast('Офлайн-копия песен обновлена','ok',2200);
}
function offlineSongsStorageText(bytes) {
  const n=Number(bytes||0);
  if(n<1024)return n+' Б';
  if(n<1048576)return (n/1024).toFixed(1)+' КБ';
  return (n/1048576).toFixed(2)+' МБ';
}

function personalParticipationMap() {
  const map = state.profile && state.profile.eventParticipation;
  return map && typeof map === 'object' ? map : {};
}
function eventStatusFor(ev) {
  if (!ev) return '';
  const id=String(ev.id||'');
  const me=currentMemberForParticipation();
  const shared=ev.participation && typeof ev.participation==='object' ? ev.participation : {};
  const key=me && (me.accountId||me.id);
  if(key && Object.prototype.hasOwnProperty.call(shared,String(key))) return shared[String(key)]||'';
  const map=personalParticipationMap();
  const legacy = Object.prototype.hasOwnProperty.call(map,id) ? (map[id]||'') : String(ev.myStatus||'');
  if (legacy && key && ['yes','maybe','no'].includes(legacy)) {
    setEventParticipantStatus(ev, me, legacy, ev.participationUpdatedAt?.[String(key)] || new Date().toISOString());
    return legacy;
  }
  return legacy || '';
}
function currentMemberForParticipation() {
  const uid = window.BandPlanCloud && window.BandPlanCloud.user ? window.BandPlanCloud.user()?.id : '';
  if (!uid) return null;
  return state.members.find(m => String(m.accountId || '') === String(uid) || String(m.id || '') === String(uid)) || null;
}
function participantStatusFor(ev, member) {
  const key = member && (member.accountId || member.id);
  const map = ev && ev.participation && typeof ev.participation === 'object' ? ev.participation : {};
  const shared = key ? map[String(key)] || '' : '';
  const me = currentMemberForParticipation();
  return !shared && me && member && String(me.accountId||me.id) === String(member.accountId||member.id) ? eventStatusFor(ev) : shared;
}
function participantStatusLabel(v) {
  return ({yes:'Участвует', maybe:'Под вопросом', no:'Не участвует'}[v] || 'Не отмечено');
}
function myRoleLabel() {
  const me=currentMemberForParticipation();
  const roles = me ? rolesOf(me) : myRoles();
  const label = rolesLabel(roles);
  return label === '—' ? '' : label;
}
function renderMyPositionBadge(ev, options) {
  const o=options||{}, status=eventStatusFor(ev)||'unset', role=myRoleLabel();
  return '<span class="event-my-state my-position status-' + status + '" data-event-my-state="' + esc(String(ev?.id||'')) + '">' +
    '<span class="my-position-status">' + esc(participantStatusLabel(status)) + '</span>' +
    (role ? '<span class="my-position-role">' + (o.compact===false ? '' : ' · ') + esc(role) + '</span>' : '') +
  '</span>';
}
function participationSummary(ev) {
  const counts = {yes:0, maybe:0, no:0, unset:0};
  const members = (ev?.memberIds || []).map(memById).filter(Boolean);
  members.forEach(member => {
    const status = participantStatusFor(ev, member) || 'unset';
    counts[Object.prototype.hasOwnProperty.call(counts, status) ? status : 'unset']++;
  });
  return counts;
}
function participationMutable(ev) {
  return !!ev && (ev.status || 'upcoming') === 'upcoming' && String(ev.date || '') >= today();
}
function renderParticipationSwitch(ev, options) {
  const o = options || {};
  const draft = !!o.draft;
  const status = draft ? String(o.status || '') : (eventStatusFor(ev) || '');
  const size = o.size || 'md', variant = o.variant || 'inline';
  const pending = !draft && ev && participationPending.has(String(ev.id));
  const disabled = !!o.disabled || (!draft && !participationMutable(ev));
  const states = [
    ['yes','Участвую','check','main','✓'],
    ['maybe','Под вопросом','info','secondary','?'],
    ['no','Не участвую','x','main','×']
  ];
  let html = '<div class="part-switch part-switch-' + esc(size) + ' part-switch-' + esc(variant) + '" data-event-switch="' + esc(String(ev?.id || '')) + '" role="group" aria-label="Ваше участие"' + (disabled ? ' aria-disabled="true"' : '') + '>';
  states.forEach(p => {
    const active = status === p[0];
    html += '<button class="part-btn part-btn-' + p[3] + (p[1] === 'Под вопросом' ? ' part-btn-secondary' : '') + (active ? ' on status-' + p[0] : '') + '" type="button" data-v="' + p[0] + '" data-act="my-status" data-id="' + esc(ev?.id || '') + '"' +
      (draft ? ' data-draft="1"' : '') + ' aria-pressed="' + active + '"' + (disabled ? ' disabled' : '') + ' aria-label="' + p[1] + (active ? ' — выбрано' : '') + '">' + '<span class="part-symbol" aria-hidden="true">' + p[4] + '</span></button>';
  });
  if (status) {
    html += '<button class="part-reset" type="button" data-v="" data-act="my-status" data-id="' + esc(ev?.id || '') + '"' +
      (draft ? ' data-draft="1"' : '') + (disabled ? ' disabled' : '') + ' aria-label="Сбросить отметку участия">' + ic('x', 13) + '<span>Сбросить</span></button>';
  }
  if (pending) html += '<span class="participation-pending" data-participation-pending="' + esc(String(ev.id)) + '">' + ic('clock', 12) + '<span>Ожидает отправки</span></span>';
  return html + '</div>';
}
function memberParticipationSummary(member) {
  const events = state.events
    .filter(e => e && (e.status || 'upcoming') === 'upcoming' && (e.memberIds || []).indexOf(member.id) >= 0)
    .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || '')));
  if (events.length) {
    const ev = events[0];
    return { status: participantStatusFor(ev, member), event: ev };
  }
  return { status: 'unset', event: null };
}
function setPersonalEventStatus(id, value) {
  state.profile.eventParticipation = Object.assign({}, personalParticipationMap(), { [String(id)]: value || '' });
  if (!value) delete state.profile.eventParticipation[String(id)];
}
function setEventParticipantStatus(ev, member, value, updatedAt) {
  if (!ev || !member) return;
  const key = String(member.accountId || member.id || '');
  if (!key) return;
  ev.participation = Object.assign({}, ev.participation || {});
  ev.participationUpdatedAt = Object.assign({}, ev.participationUpdatedAt || {});
  if (value) {
    ev.participation[key] = value;
    ev.participationUpdatedAt[key] = updatedAt || new Date().toISOString();
  } else {
    delete ev.participation[key];
    delete ev.participationUpdatedAt[key];
  }
}
function setMyParticipation(ev, value, updatedAt) {
  if (!ev || !participationMutable(ev)) return {status:eventStatusFor(ev), updatedAt:''};
  const me = currentMemberForParticipation();
  const key = String(me?.accountId || me?.id || '');
  if (!key) throw new Error('Не удалось определить ваш профиль в группе.');
  const stamp = updatedAt || new Date().toISOString();
  const clean = String(value || '');
  if (clean && !['yes','maybe','no'].includes(clean)) throw new Error('Некорректный статус участия.');
  ev.participation = Object.assign({}, ev.participation || {});
  ev.participationUpdatedAt = Object.assign({}, ev.participationUpdatedAt || {});
  if (clean) {
    ev.participation[key] = clean;
    ev.participationUpdatedAt[key] = stamp;
  } else {
    delete ev.participation[key];
    delete ev.participationUpdatedAt[key];
  }
  setPersonalEventStatus(ev.id, clean);
  return {status:clean, updatedAt:stamp};
}
function stripSharedEventPersonalFields(events) {
  return (events || []).map(ev => {
    const copy = Object.assign({}, ev);
    delete copy.myStatus;
    return copy;
  });
}
function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem('bandplan.premium.v5') || localStorage.getItem('bandplan.premium.v4');
    if (!raw) return false;
    const d = JSON.parse(raw);
    state = Object.assign(defaults(), d);
    state.profile = Object.assign(defaults().profile, d.profile || {});
    state.settings = Object.assign(defaults().settings, d.settings || {});
    if (!state.settings.accent) { state.settings.accentPreset = state.settings.accentPreset || 'blue'; state.settings.accent = presetAccentColor(state.settings.accentPreset, state.settings.theme); }
    state.members = d.members || []; state.events = d.events || [];
    state.songs = d.songs || []; state.setlists = d.setlists || [];
    return true;
  } catch (e) { return false; }
}
function save() { expandCache.clear(); searchCorpus = null; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Не удалось сохранить: хранилище браузера недоступно', 'err'); } if (window.BandPlanCloud) window.BandPlanCloud.schedule(state); scheduleOfflineSongSync(); }
function commit() { save(); render(); }

function persistParticipationLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

function refreshMemberParticipationUI() {
  document.querySelectorAll('.memb-row[data-member-key]').forEach(row => {
    const member = memById(row.getAttribute('data-member-key'));
    if (!member) return;
    const summary = memberParticipationSummary(member);
    const status = summary.status || 'unset';
    const label = participantStatusLabel(status);
    const title = summary.event ? label + ' · ' + summary.event.title : label;
    row.querySelectorAll('.participation-dot').forEach(dot => {
      dot.className = 'participation-dot participation-dot-avatar status-' + status;
      dot.title = title;
      dot.setAttribute('aria-label', title);
    });
    const badge = row.querySelector('.member-participation');
    if (badge) {
      badge.className = 'member-participation status-' + status;
      badge.title = title;
      badge.setAttribute('aria-label', title);
      const text = badge.querySelector('.member-participation-text');
      if (text) text.textContent = label;
    }
  });
}

window.addEventListener('bandplan:participation-synced', event => {
  const d=event.detail||{}, ev=evById(String(d.eventId||''));
  if(!ev)return;
  const status=String(d.status||'');
  setMyParticipation(ev,status,String(d.updatedAt||new Date().toISOString()));
  participationPrevious.delete(String(ev.id));
  participationPending.delete(String(ev.id));
  persistParticipationLocal();
  refreshParticipationUI(ev.id);
});
window.addEventListener('bandplan:participation-error', event => {
  const d=event.detail||{}, ev=evById(String(d.eventId||''));
  if(!ev)return;
  const key=String(ev.id), previous=participationPrevious.get(key)||'';
  setMyParticipation(ev,previous,new Date().toISOString());
  participationPrevious.delete(key);
  participationPending.delete(key);
  persistParticipationLocal();
  refreshParticipationUI(ev.id);
  toast('Не удалось отправить отметку: ' + String(d.message||'Сервер отклонил запрос.'),'err',5200);
});
function applyRealtimeParticipation(change) {
  const eventId=String(change?.event_id||'').trim();
  const userId=String(change?.user_id||'').trim();
  if(!eventId||!userId)return;
  const ev=evById(eventId);
  if(!ev)return;
  ev.participation=Object.assign({},ev.participation||{});
  const incomingAt = String(change.updated_at || '');
  const currentAt = String((ev.participationUpdatedAt || {})[userId] || '');
  if (currentAt && incomingAt && incomingAt < currentAt) return;
  setEventParticipantStatus(ev, {accountId:userId,id:userId}, change.deleted ? '' : String(change.status || ''), incomingAt || new Date().toISOString());
  const me=window.BandPlanCloud?.user ? window.BandPlanCloud.user() : null;
  if(me?.id && String(me.id)===userId) setPersonalEventStatus(eventId,change.deleted?'':String(change.status||''));
  persistParticipationLocal();
  refreshParticipationUI(eventId);
  refreshMemberParticipationUI();
  scheduleOfflineSongSync(150);
}

function refreshParticipationUI(evId) {
  const ev = evById(evId);
  if (!ev) return;
  const my = eventStatusFor(ev) || '';

  // Обновляем только связанные с событием элементы. Полный render() здесь
  // намеренно не вызывается: это убирает визуальный лаг при переключении участия.
  document.querySelectorAll('[data-act="event-info"][data-id="' + CSS.escape(String(ev.id)) + '"]').forEach(row => {
    row.querySelectorAll('.part-avatar[data-member-key]').forEach(avatar => {
      const member = memById(avatar.getAttribute('data-member-key'));
      if (!member) return;
      const ps = participantStatusFor(ev, member) || 'unset';
      const title = member.name + ' — ' + participantStatusLabel(ps);
      avatar.className = 'part-avatar part-' + ps;
      avatar.title = title;
      avatar.setAttribute('aria-label', title);
      const dot = avatar.querySelector('.participation-dot');
      if (dot) {
        dot.className = 'participation-dot participation-dot-avatar status-' + ps;
        dot.title = participantStatusLabel(ps);
        dot.setAttribute('aria-label', participantStatusLabel(ps));
      }
    });

    row.querySelectorAll('[data-act="my-status"][data-id="' + CSS.escape(String(ev.id)) + '"]').forEach(btn => {
      const v = btn.getAttribute('data-v');
      const on = !!my && v === my;
      btn.classList.toggle('on', on);
      ['yes','maybe','no'].forEach(status => btn.classList.toggle('status-' + status, on && v === status));
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const labels = {yes:'Участвую', maybe:'Под вопросом', no:'Не участвую'};
      if (v && labels[v]) btn.setAttribute('aria-label', labels[v] + (on ? ' — выбрано' : ''));
    });
  });

  document.querySelectorAll('[data-event-my-state="' + CSS.escape(String(ev.id)) + '"]').forEach(node => {
    node.className = 'event-my-state my-position status-' + (my || 'unset');
    const statusNode = node.querySelector('.my-position-status');
    if (statusNode) statusNode.textContent = participantStatusLabel(my);
    else node.textContent = participantStatusLabel(my);
    const roleNode = node.querySelector('.my-position-role');
    if (roleNode) roleNode.textContent = myRoleLabel() ? ' · ' + myRoleLabel() : '';
  });
  const sum = participationSummary(ev);
  document.querySelectorAll('[data-event-participation-summary="' + CSS.escape(String(ev.id)) + '"]').forEach(node => {
    node.innerHTML = '<span class="status-yes">' + sum.yes + ' · Участвуют</span><span class="status-maybe">' + sum.maybe + ' · Под вопросом</span><span class="status-no">' + sum.no + ' · Не участвуют</span><span class="status-unset">' + sum.unset + ' · Не ответили</span>';
  });
  const pendingNode = document.querySelectorAll('[data-participation-pending="' + CSS.escape(String(ev.id)) + '"]');
  pendingNode.forEach(node => node.remove());
  if (participationPending.has(String(ev.id))) {
    document.querySelectorAll('.part-switch[data-event-switch="' + CSS.escape(String(ev.id)) + '"]').forEach(sw => {
      if (!sw.querySelector('[data-participation-pending]')) sw.insertAdjacentHTML('beforeend', '<span class="participation-pending" data-participation-pending="' + esc(String(ev.id)) + '">' + ic('clock', 12) + '<span>Ожидает отправки</span></span>');
    });
  }

  const overlay = document.querySelector('#modalOverlay');
  if (overlay) {
    overlay.querySelectorAll('[data-act="my-status"][data-id="' + CSS.escape(String(ev.id)) + '"]').forEach(btn => {
      const v = btn.getAttribute('data-v');
      const on = !!my && v === my;
      btn.classList.toggle('on', on);
      ['yes','maybe','no'].forEach(status => btn.classList.toggle('status-' + status, on && v === status));
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const myLabel = overlay.querySelector('.event-info-my .event-info-section-head .participation-label');
    if (myLabel) {
      myLabel.className = 'participation-label status-' + (my || 'unset');
      myLabel.textContent = participantStatusLabel(my);
    }
    overlay.querySelectorAll('[data-participant-key]').forEach(person => {
      const key = String(person.getAttribute('data-participant-key') || '');
      if (!key) return;
      const member = memById(key);
      const ps = member ? participantStatusFor(ev, member) : String((ev.participation || {})[key] || '');
      const dot = person.querySelector('.participation-dot');
      const label = person.querySelector('.participation-label');
      if (dot) {
        dot.className = 'participation-dot participation-dot-avatar status-' + (ps || 'unset');
        dot.title = participantStatusLabel(ps);
        dot.setAttribute('aria-label', participantStatusLabel(ps));
      }
      if (label) {
        label.className = 'participation-label status-' + (ps || 'unset');
        label.textContent = participantStatusLabel(ps);
      }
    });
  }
}

const songById = id => {
  const key = String(id || '');
  if (navigator.onLine === false && offlineSongIndex.has(key)) return offlineSongIndex.get(key);
  return state.songs.find(s => String(s.id) === key);
};
const evById = id => state.events.find(e => e.id === id);
const slById = id => state.setlists.find(s => s.id === id);
const memById = id => state.members.find(m => m.id === id);

/* ═══ 6. DEMO ═══ */
function seedDemo() {
  const d0 = new Date();
  const off = (n, h, m) => { const x = new Date(d0); x.setDate(x.getDate() + n); return { date: iso(x), time: pad(h) + ':' + pad(m || 0) }; };
  state.members = [
    { id: uid('m'), name: 'Аня Соколова', role: 'vocal', color: tokenColor(PALETTE[0]), note: 'Основной вокал' },
    { id: uid('m'), name: 'Марк Гринёв', role: 'guitar', color: tokenColor(PALETTE[1]), note: 'Соло и ритм' },
    { id: uid('m'), name: 'Тимур Валеев', role: 'bass', color: tokenColor(PALETTE[2]), note: '' },
    { id: uid('m'), name: 'Лена Ким', role: 'drums', color: tokenColor(PALETTE[3]), note: '' }
  ];
  if (!state.profile.name) state.profile.name = 'Аня Соколова';
  if (!state.profile.role) state.profile.role = 'vocal';
  state.songs = [
    { id: uid('s'), title: 'Город не спит', artist: 'Neon Coast', key: 'Em', bpm: 104, duration: 225, tags: ['рок', 'сингл'], fav: true, addedAt: today(),
      lyrics: '[Куплет 1]\nEm            G\nОгни витрин, пустой проспект\nC             D\nМы ловим этот странный свет\nEm            G\nИ город шепчет нам в ответ\n\n[Припев]\nC     G       D     Em\nМы не спим, мы горим\nC     G       D\nДо рассвета, до зари\nC     G       D     Em\nНеон по венам, бит в груди\nC     D       Em\nПопробуй нас остановить',
      dynamics: { instruments: ['vocal', 'guitar', 'bass', 'drums'], sections: ['Куплет 1', 'Припев'],
        levels: { vocal: { 'Куплет 1': 'mp', 'Припев': 'f' }, guitar: { 'Куплет 1': 'p', 'Припев': 'ff' }, bass: { 'Куплет 1': 'mp', 'Припев': 'f' }, drums: { 'Куплет 1': 'p', 'Припев': 'ff' } } } },
    { id: uid('s'), title: 'Северный ветер', artist: 'Neon Coast', key: 'Am', bpm: 88, duration: 252, tags: ['баллада'], fav: false, addedAt: today(),
      lyrics: '[Куплет 1]\nAm      F       C       G\nВетер с севера несёт соль\nAm      F       G\nНаших несказанных слов\n\n[Припев]\nF       G       Em      Am\nДержи мою руку сквозь туман\nF       G       C\nМы вернёмся к берегам',
      dynamics: { instruments: ['vocal', 'guitar', 'keys'], sections: ['Куплет 1', 'Припев'], levels: { vocal: { 'Куплет 1': 'p', 'Припев': 'mf' }, guitar: { 'Куплет 1': 'pp', 'Припев': 'mp' }, keys: { 'Куплет 1': 'mp', 'Припев': 'mf' } } } },
    { id: uid('s'), title: 'Эхо', artist: 'Neon Coast', key: 'D', bpm: 120, duration: 198, tags: ['рок', 'энергично'], fav: true, addedAt: today(),
      lyrics: '[Интро]\nD   A   Bm  G\n\n[Куплет 1]\nD           A\nКаждый шаг отдаётся в стенах\nBm          G\nКаждый вдох превращается в эхо\n\n[Припев]\nG     A       D       Bm\nГромче, ещё громче\nG     A       D\nПусть услышат все',
      dynamics: { instruments: ['vocal', 'guitar', 'bass', 'drums'], sections: ['Интро', 'Куплет 1', 'Припев'], levels: { vocal: { 'Интро': '', 'Куплет 1': 'mp', 'Припев': 'ff' }, guitar: { 'Интро': 'mf', 'Куплет 1': 'mp', 'Припев': 'ff' }, bass: { 'Интро': 'mp', 'Куплет 1': 'mf', 'Припев': 'f' }, drums: { 'Интро': 'p', 'Куплет 1': 'mf', 'Припев': 'ff' } } } },
    { id: uid('s'), title: 'Тише воды', artist: 'Neon Coast', key: 'G', bpm: 72, duration: 270, tags: ['баллада', 'акустика'], fav: false, addedAt: today(),
      lyrics: '[Куплет 1]\nG       Em      C       D\nТише воды, ниже травы\nG       Em      C       D\nМы с тобою до поры\n\n[Припев]\nC       D       G       Em\nНе буди этот сон до утра\nC       D       G\nПусть нам снятся острова',
      dynamics: { instruments: ['vocal', 'guitar'], sections: ['Куплет 1', 'Припев'], levels: { vocal: { 'Куплет 1': 'pp', 'Припев': 'mp' }, guitar: { 'Куплет 1': 'pp', 'Припев': 'p' } } } },
    { id: uid('s'), title: '220 вольт', artist: 'Neon Coast', key: 'E', bpm: 140, duration: 184, tags: ['рок', 'энергично'], fav: false, addedAt: today(),
      lyrics: '[Куплет 1]\nE       A       E       B\nТок по проводам, искра по губам\nE       A       B       E\nДвести двадцать вольт — я не верю тормозам\n\n[Припев]\nA       E       B       C#m\nБей в барабаны, жги усилитель\nA       B       E\nЭто наш последний выключатель',
      dynamics: { instruments: ['vocal', 'guitar', 'bass', 'drums'], sections: ['Куплет 1', 'Припев'], levels: { vocal: { 'Куплет 1': 'f', 'Припев': 'ff' }, guitar: { 'Куплет 1': 'ff', 'Припев': 'ff' }, bass: { 'Куплет 1': 'f', 'Припев': 'ff' }, drums: { 'Куплет 1': 'ff', 'Припев': 'ff' } } } },
    { id: uid('s'), title: 'Маршрут построен', artist: 'Neon Coast', key: 'C', bpm: 96, duration: 233, tags: ['инди'], fav: true, addedAt: today(),
      lyrics: '[Куплет 1]\nC       G       Am      F\nМаршрут построен, но мы свернём\nC       G       F\nТуда, где нас никто не ждёт\n\n[Припев]\nF       G       C       Am\nДорога длиннее, чем кажется\nF       G       C\nНо мы доедем обязательно',
      dynamics: { instruments: ['vocal', 'guitar', 'keys', 'drums'], sections: ['Куплет 1', 'Припев'], levels: { vocal: { 'Куплет 1': 'mp', 'Припев': 'f' }, guitar: { 'Куплет 1': 'mp', 'Припев': 'mf' }, keys: { 'Куплет 1': 'p', 'Припев': 'mf' }, drums: { 'Куплет 1': 'p', 'Припев': 'f' } } } }
  ];
  const S = state.songs;
  state.setlists = [
    { id: uid('sl'), name: 'Основной сет · 45 минут', note: 'Начинаем тихо, к третьему номеру разгон.', eventId: '',
      items: [{ id: uid('i'), songId: S[5].id, shift: 0, note: 'Вступление — акустика' }, { id: uid('i'), songId: S[0].id, shift: 0, note: '' },
      { id: uid('i'), songId: S[4].id, shift: 0, note: 'Без паузы' }, { id: uid('i'), songId: S[2].id, shift: 0, note: '' },
      { id: uid('i'), songId: S[3].id, shift: -2, note: 'Понижаем для вокала' }] },
    { id: uid('sl'), name: 'Квартирник · акустика', note: 'Камерный формат, две гитары.', eventId: '',
      items: [{ id: uid('i'), songId: S[3].id, shift: 0, note: '' }, { id: uid('i'), songId: S[1].id, shift: 0, note: '' }] }
  ];
  const a = off(2, 19, 0), b = off(6, 20, 0), c = off(11, 14, 0), e = off(19, 18, 30), f = off(4, 12, 0), g = off(-5, 19, 0);
  state.events = [
    { id: uid('e'), type: 'rehearsal', title: 'Репетиция основного сета', date: a.date, time: a.time, end: '21:30', location: 'База на Лиговском', notes: 'Прогоняем финал и переходы.', status: 'upcoming', repeat: 'weekly', setlistId: state.setlists[0].id, except: [] },
    { id: uid('e'), type: 'gig', title: 'Концерт в «Портах»', date: b.date, time: b.time, end: '22:00', location: 'Клуб «Порты»', notes: 'Саундчек в 17:00.', status: 'upcoming', repeat: 'none', setlistId: state.setlists[0].id, except: [] },
    { id: uid('e'), type: 'recording', title: 'Запись сингла «Эхо»', date: c.date, time: c.time, end: '19:00', location: 'Студия K-Rec', notes: 'Живьём, 3 дубля.', status: 'upcoming', repeat: 'none', setlistId: '', except: [] },
    { id: uid('e'), type: 'gig', title: 'Фестиваль «Северный звук»', date: e.date, time: e.time, end: '19:15', location: 'Парк 300-летия', notes: 'Слот 45 минут, сцена B.', status: 'upcoming', repeat: 'none', setlistId: state.setlists[0].id, except: [] },
    { id: uid('e'), type: 'meeting', title: 'Созвон по мерчу', date: f.date, time: f.time, end: '13:00', location: 'Онлайн', notes: '', status: 'upcoming', repeat: 'none', setlistId: '', except: [] },
    { id: uid('e'), type: 'gig', title: 'Квартирник у друзей', date: g.date, time: g.time, end: '21:00', location: 'Лофт «Тихий»', notes: '', status: 'done', repeat: 'none', setlistId: state.setlists[1].id, except: [] }
  ];
  save();
}

/* ═══ 7. EVENTS ENGINE ═══ */
const expandCache = new Map();
function expand(from, to) {
  const out = [], f = typeof from === 'string' ? from : iso(from), t = typeof to === 'string' ? to : iso(to);
  const cacheKey = f + '|' + t;
  const cached = expandCache.get(cacheKey);
  if (cached) return cached.map(x => ({ ev:x.ev, date:x.date }));
  state.events.forEach(function (ev) {
    if (ev.status === 'cancelled') return;
    const ex = ev.except || [];
    if (!ev.repeat || ev.repeat === 'none') { if (ev.date >= f && ev.date <= t) out.push({ ev: ev, date: ev.date }); return; }
    const d = new Date(ev.date + 'T00:00:00');
    const until = ev.repeatUntil ? new Date(ev.repeatUntil + 'T00:00:00') : new Date(t + 'T00:00:00');
    const stop = until < new Date(t + 'T00:00:00') ? until : new Date(t + 'T00:00:00');
    let guard = 0;
    while (d <= stop && guard++ < 400) {
      const k = iso(d);
      if (k >= f && ex.indexOf(k) < 0) out.push({ ev: ev, date: k });
      if (ev.repeat === 'weekly') d.setDate(d.getDate() + 7);
      else if (ev.repeat === 'biweekly') d.setDate(d.getDate() + 14);
      else if (ev.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
      else break;
    }
  });
  out.sort((a, b) => (a.date + (a.ev.time || '')).localeCompare(b.date + (b.ev.time || '')));
  expandCache.set(cacheKey, out.map(x => ({ ev:x.ev, date:x.date })));
  if (expandCache.size > 24) expandCache.delete(expandCache.keys().next().value);
  return out;
}
const upcoming = n => expand(today(), iso(new Date(Date.now() + 86400000 * 400))).filter(o => o.date >= today()).slice(0, n || 999);
const evType = t => EV_TYPES[t] || EV_TYPES.meeting;
const setlistDur = sl => (sl.items || []).reduce((a, it) => { const s = songById(it.songId); return a + (s ? s.duration || 0 : 0); }, 0);
const finalKey = (s, sh) => s && s.key ? transposeKey(s.key, sh || 0) : '—';

/* ═══ 8. TOASTS / MODAL / CONFIRM ═══ */
const TOAST_ICONS = { ok: 'checkCircle', err: 'alert', warn: 'alert', info: 'info' };
function toastAllowed(t) { const m = state.settings.toastMode || 'off'; return m === 'all' || (m === 'important' && (t === 'err' || t === 'warn')); }
function toast(msg, type, ms) {
  if (!msg || !toastAllowed(type)) return;
  const w = $('#toasts'); if (!w) return;
  const t = type || 'info', life = ms || 4200;
  const el = document.createElement('div');
  el.className = 'toast ' + t; el.setAttribute('role', t === 'err' ? 'alert' : 'status');
  el.innerHTML = '<span class="ti">' + ic(TOAST_ICONS[t] || 'info', 18) + '</span><span class="tt">' + esc(msg) + '</span>' +
    '<button class="tc" type="button" aria-label="Закрыть уведомление">' + ic('x', 15) + '</button>' +
    '<i class="tbar" style="animation-duration:' + life + 'ms"></i>';
  w.appendChild(el);
  while (w.children.length > 3) dismiss(w.firstElementChild);
  const kill = () => dismiss(el);
  $('.tc', el).addEventListener('click', kill);
  el.addEventListener('click', e => { if (!e.target.closest('.tc')) kill(); });
  const timer = setTimeout(kill, life);
  el.addEventListener('mouseenter', () => { clearTimeout(timer); el.classList.remove('run'); });
  requestAnimationFrame(() => el.classList.add('run'));
  function dismiss(node) {
    if (!node || node.dataset.closed) return;
    node.dataset.closed = '1'; clearTimeout(timer);
    node.classList.add('out'); setTimeout(() => node.remove(), 220);
  }
}
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  console.error('BandPlan unhandled rejection:', reason);
  event.preventDefault();
  const message = reason?.name === 'AbortError'
    ? 'Запрос превысил время ожидания. Попробуйте ещё раз.'
    : 'Произошла непредвиденная ошибка. Данные не удалены.';
  try { toast(message, 'err', 5200); } catch (_) {}
});
window.addEventListener('error', event => {
  if (!event?.error) return;
  console.error('BandPlan uncaught error:', event.error);
});
window.addEventListener('popstate', () => {
  if (!modalHistoryPushed) return;
  modalHistoryPushed = false;
  if (modalRoot) hardClose(modalRoot, {keepHistory:true});
});
document.addEventListener('focusin', event => {
  const target = event.target;
  if (!target || !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || window.innerWidth > 640) return;
  if ($('#scene').classList.contains('on')) return;
  const scrollIntoView = () => {
    if (!target.isConnected || document.activeElement !== target) return;
    try {
      target.scrollIntoView({
        block:'center', inline:'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    } catch (_) {}
  };
  setTimeout(scrollIntoView, 60);
  if (window.visualViewport) {
    const once = () => {
      window.visualViewport.removeEventListener('resize', once);
      setTimeout(scrollIntoView, 40);
    };
    window.visualViewport.addEventListener('resize', once, {once:true});
  }
});
let modalRoot = null, confirmCb = null, lastFocus = null, modalDirty = false, trapHandler = null, modalScrollY = 0;
let modalHistoryPushed = false;
function closeModal(force) {
  if (!modalRoot) return;
  if (modalDirty && !force) {
    const keep = modalRoot; modalDirty = false;
    confirmBox('Закрыть без сохранения?', 'Внесённые изменения будут потеряны.', function () { modalDirty = false; hardClose(keep); }, 'Закрыть без сохранения', true);
    return;
  }
  hardClose(modalRoot);
}
function hardClose(node, opts) {
  const keepHistory = !!(opts && opts.keepHistory);
  const ov = $('#modalOverlay');
  if (node && node.parentNode === ov) node.remove();
  if (!ov.children.length) {
    ov.classList.remove('on', 'is-fullscreen', 'fullscreen', 'is-sheet');
    ov.innerHTML = '';
    ov.removeAttribute('style');
  }
  modalRoot = ov.querySelector('.modal-card') || null;
  confirmCb = null; modalDirty = false;
  if (trapHandler) { document.removeEventListener('keydown', trapHandler); trapHandler = null; }
  if (!modalRoot && !$('#scene').classList.contains('on')) { document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.top = ''; document.body.style.width = ''; if (modalScrollY) { const y = modalScrollY; modalScrollY = 0; requestAnimationFrame(() => window.scrollTo(0, y)); } }
  if (lastFocus && lastFocus.focus && !modalRoot) { try { lastFocus.focus(); } catch (e) { } lastFocus = null; }
  updateDirtyNote();
  if (!modalRoot && modalHistoryPushed && !keepHistory) {
    modalHistoryPushed = false;
    try { history.back(); } catch (_) {}
  }
}
function updateDirtyNote() { const n = $('.dirty-note'); if (n) n.classList.toggle('on', modalDirty); }
function openModal(o) {
  if (modalRoot) hardClose(modalRoot, {keepHistory:true});
  lastFocus = document.activeElement; modalDirty = false;
  const ov = $('#modalOverlay');
  const isFullscreen = o.fullscreen === true || o.editor === true;
  ov.innerHTML = '<div class="modal-card ' + (o.size || '') + (isFullscreen ? ' modal-fullscreen' : '') + (o.sheet ? ' modal-sheet' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
    '<div class="modal-head"><div style="min-width:0"><h3 id="mTitle">' + esc(o.title || '') + '</h3>' +
    (o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '') + '</div>' +
    '<button class="icon-btn" type="button" data-act="modal-close" aria-label="Закрыть окно">' + ic('x', 18) + '</button></div>' +
    '<div class="modal-body">' + (o.body || '') + '</div>' +
    (o.footer ? '<div class="modal-foot">' + (o.guard === false ? '' : '<span class="dirty-note">' + ic('info', 14) + 'Есть несохранённые изменения</span>') + o.footer + '</div>' : '') + '</div>';
  ov.classList.toggle('fullscreen', isFullscreen);
  ov.classList.toggle('is-fullscreen', isFullscreen);
  ov.classList.toggle('is-sheet', !!o.sheet);
  ov.classList.toggle('is-sheet', !!o.sheet);
  ov.classList.add('on');
  modalRoot = ov.firstElementChild;
  if (isFullscreen && modalRoot) {
    // Editor dialogs are true full-screen surfaces, independent of theme/mobile modal rules.
    ov.style.cssText += ';position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;padding:0!important;margin:0!important;display:flex!important;align-items:stretch!important;justify-content:stretch!important;';
    modalRoot.style.cssText += ';position:fixed!important;inset:0!important;width:100vw!important;max-width:none!important;height:100dvh!important;min-height:100dvh!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;';
  }
  modalScrollY = window.scrollY || window.pageYOffset || 0;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + modalScrollY + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  if (!modalHistoryPushed) {
    try { history.pushState({__bandplanModal:true}, '', location.href); modalHistoryPushed = true; } catch (_) {}
  }
  ov.onmousedown = e => { if (e.target === ov) closeModal(); };
  let modalTouchY = 0, modalTouchX = 0, modalTouching = false;
  modalRoot.addEventListener('touchstart', function (e) {
    if (window.innerWidth > 640 || !e.touches[0]) return;
    const target = e.target;
    if (target.closest('button,input,textarea,select,a')) return;
    modalTouchY = e.touches[0].clientY; modalTouchX = e.touches[0].clientX; modalTouching = true;
  }, {passive:true});
  modalRoot.addEventListener('touchend', function (e) {
    if (!modalTouching || window.innerWidth > 640 || !e.changedTouches[0]) return;
    modalTouching = false;
    const dy = e.changedTouches[0].clientY - modalTouchY;
    const dx = e.changedTouches[0].clientX - modalTouchX;
    const body = $('.modal-body', modalRoot);
    if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.25 && (!body || body.scrollTop <= 2)) closeModal();
  }, {passive:true});
  trapHandler = function (e) {
    if (e.key !== 'Tab' || !modalRoot) return;
    const f = $$('a[href],button:not([disabled]),input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])', modalRoot).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', trapHandler);
  modalRoot.addEventListener('input', function (e) { if (e.target.closest('[data-no-dirty]')) return; modalDirty = true; updateDirtyNote(); });
  modalRoot.addEventListener('change', function () { modalDirty = true; updateDirtyNote(); });
  if (o.onMount) setTimeout(() => o.onMount(modalRoot), 20);
  setTimeout(() => { const f = $('input:not([type=hidden]),select,textarea', modalRoot); if (f && f.focus) f.focus(); }, 90);
  return modalRoot;
}
function confirmBox(title, text, onYes, yesLabel, danger) {
  confirmCb = onYes;
  openModal({
    title: title, body: '<p class="confirm-copy">' + esc(text) + '</p>', guard: false,
    footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Отмена</button><button class="btn ' + (danger ? 'btn-danger-solid' : 'btn-primary') + '" type="button" data-act="confirm-yes">' + esc(yesLabel || 'Подтвердить') + '</button>'
  });
  modalDirty = false;
}
const fv = id => { const e = $('#' + id, modalRoot || document); return e ? String(e.value).trim() : ''; };
function fieldError(inputId, msg) {
  const inp = $('#' + inputId, modalRoot);
  if (inp) {
    const f = inp.closest('.field');
    if (f) { f.classList.add('invalid'); const e = $('.err', f); if (e) e.innerHTML = ic('alert', 13) + '<span>' + esc(msg) + '</span>'; }
    inp.focus();
  }
  toast(msg, 'warn');
}

/* ═══ 9. ROUTER / NAV ═══ */
const TABS = [
  { k: 'calendar', t: 'Календарь', i: 'calendar', h: '#/calendar' },
  { k: 'songs', t: 'Песни', i: 'music', h: '#/songs' },
  { k: 'setlists', t: 'Сет-листы', i: 'list', h: '#/setlists' },
  { k: 'settings', t: 'Настройки', i: 'gear', h: '#/settings' }
];
const HEADERS = {
  calendar: ['Расписание', 'Выступления, репетиции и записи группы · месяц, неделя и день'],
  songs: ['Репертуар', 'Тексты с аккордами, тональности, темп и динамика партий по инструментам'],
  song: ['Песня', 'Текст с аккордами, транспонирование и динамика вашей партии'],
  setlists: ['Сет-листы', 'Программы выступлений: порядок песен, тональности, переходы и заметки'],
  setlist: ['Сет-лист', 'Перетащите песни в нужном порядке и задайте параметры каждого номера'],
  settings: ['Настройки', 'Профиль, состав группы, оформление интерфейса и данные']
};
function parseHash() {
  const h = (location.hash || '#/calendar').replace(/^#\/?/, '');
  const p = h.split('/').filter(Boolean);
  return { name: p[0] || 'calendar', id: p[1] || null };
}
function go(h) {
  if (location.hash === h) { routeTransition(); return; }
  location.hash = h;
}
function renderWithTransition(fn) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reduced) {
    try { document.startViewTransition(fn); return; } catch (e) {}
  }
  fn();
}

function routeTransition() {
  const view = $('#view');
  if (!view) { render(); return; }
  /*
    A navigation click must never be swallowed by an animation that is
    already running. Previously the guard returned while transitioning,
    leaving location.hash changed but the old screen rendered until a
    second click. Cancel the previous transition and render the new route
    immediately instead.
  */
  if (view.dataset.transitioning === '1') {
    view.classList.remove('route-enter', 'route-enter-active');
    delete view.dataset.transitioning;
  }
  view.dataset.transitioning = '1';
  view.classList.remove('route-enter');
  void view.offsetWidth;
  view.classList.add('route-enter');
  renderWithTransition(render);
  requestAnimationFrame(() => {
    view.classList.add('route-enter-active');
    setTimeout(() => {
      view.classList.remove('route-enter', 'route-enter-active');
      delete view.dataset.transitioning;
    }, 170);
  });
}
const navKey = n => n === 'song' ? 'songs' : n === 'setlist' ? 'setlists' : n;

function buildChrome() {
  const up = upcoming().length, cur = navKey(parseHash().name);
  $('#sideNav').innerHTML = TABS.map(n =>
    '<a class="nav-item" href="' + n.h + '" data-nav="' + n.k + '" data-act="nav" data-to="' + n.k + '"' + (cur === n.k ? ' aria-current="page"' : '') + '>' + ic(n.i, 19) +
    '<span>' + n.t + '</span>' + (n.k === 'calendar' && up ? '<span class="nb">' + up + '</span>' : '') + '</a>').join('');
  $('#botNav').innerHTML = TABS.map(n =>
    '<a href="' + n.h + '" data-nav="' + n.k + '" data-act="nav" data-to="' + n.k + '"' + (cur === n.k ? ' aria-current="page"' : '') + '>' + ic(n.i, 21) +
    '<span>' + n.t + '</span>' + (n.k === 'calendar' && up ? '<span class="nb">' + up + '</span>' : '') + '</a>').join('');

  const p = state.profile;
  $('#brandBand').textContent = p.bandName || 'Моя группа';
  $('#sideProfile').innerHTML = '<div class="av" aria-hidden="true">' + esc(((p.name || 'B').charAt(0)).toUpperCase()) + '</div>' +
    '<div style="min-width:0"><div class="nm">' + esc(p.name || 'Профиль не заполнен') + '</div><div class="rl">' + esc(rolesLabel(myRoles())) + '</div></div>';

  const nextTheme = nextThemeMeta(state.settings.theme);
  const thIco = ic(nextTheme.icon, 18);
  const thLbl = nextTheme.label;
  $('#themeQuick').innerHTML = thIco + '<span>' + esc(thLbl) + '</span>';
  $('#themeQuick').setAttribute('aria-label', 'Переключить тему: ' + esc(thLbl));
  $('#sceneQuick').innerHTML = ic('monitor', 18) + '<span>Сценический режим</span>';
  $('[data-act="scene-prev"]').innerHTML = ic('left', 20);
  $('[data-act="scene-close"]').innerHTML = ic('x', 20);
  $('[data-act="scene-next"]').innerHTML = ic('right', 20);
  $('[data-act="scene-fs"]').innerHTML = ic('fs', 19);
  $('[data-act="scene-auto"]').innerHTML = ic(scene.auto ? 'pause' : 'play', 19);
}
function updateNav(k) { $$('[data-nav]').forEach(a => a.classList.toggle('active', a.getAttribute('data-nav') === k)); }

/* ═══ 10. RENDER ROOT + STATES ═══ */
function stateHTML(kind, title, text, actions) {
  const icons = { empty: 'inbox', err: 'alert', ok: 'checkCircle', search: 'search', offline: 'wifiOff' };
  return '<div class="state' + (kind === 'err' ? ' state-err' : kind === 'ok' ? ' state-ok' : '') + '">' +
    '<div class="state-ic">' + ic(icons[kind] || 'inbox', 24) + '</div>' +
    '<h4>' + esc(title) + '</h4>' + (text ? '<p>' + esc(text) + '</p>' : '') +
    (actions ? '<div class="acts">' + actions + '</div>' : '') + '</div>';
}
function skeletonFor(routeName) {
  const line = (w) => '<div class="skel skel-line" style="width:' + w + '%"></div>';
  const card = (extra) => '<div class="skel-card"><div class="skel skel-title"></div>' + line(76) + (extra || '') + '</div>';
  if (routeName === 'calendar') {
    return '<div class="skel-calendar"><div class="skel-hero">' + line(34) + '<div class="skel skel-heading"></div>' + line(62) + '<div class="skel-actions"><div class="skel skel-btn"></div><div class="skel skel-btn"></div></div><div class="skel-metrics">' +
      [1,2,3,4].map(() => '<div class="skel-metric">' + line(42) + '<div class="skel skel-num"></div></div>').join('') +
      '</div></div><div class="skel skel-heading"></div><div class="skel-month-grid">' + Array.from({length:35},(_,i)=>'<div class="skel skel-cell">' + (i%3===0?'<i></i>':'') + '</div>').join('') + '</div></div>';
  }
  if (routeName === 'songs') {
    return '<div class="skel-stack"><div class="skel skel-search"></div>' + [1,2,3,4,5,6].map(() => '<div class="skel-song-row"><div class="skel skel-badge"></div><div class="skel-copy">' + line(58) + line(32) + '</div><div class="skel skel-btn"></div></div>').join('') + '</div>';
  }
  if (routeName === 'song') {
    return '<div class="skel-detail"><div class="skel skel-crumb"></div><div class="skel skel-heading"></div><div class="skel-detail-grid"><div class="skel-card skel-lyrics">' + Array.from({length:9},(_,i)=>line(55+(i%4)*9)).join('') + '</div><div class="skel-card">' + line(62) + line(48) + line(72) + '</div></div></div>';
  }
  if (routeName === 'setlists') {
    return '<div class="skel-stack">' + [1,2,3].map((_,i) => '<div class="skel-list-row"><span class="skel skel-num"></span><div class="skel-copy">' + line(54) + line(30) + '</div><div class="skel skel-btn"></div><div class="skel skel-icon"></div></div>').join('') + '</div>';
  }
  if (routeName === 'setlist') {
    return '<div class="skel-detail-grid"><div class="skel-card">' + [1,2,3,4,5].map(() => line(70)).join('') + '</div><div class="skel-card"><div class="skel skel-heading"></div>' + line(80) + line(55) + '</div></div>';
  }
  if (routeName === 'settings') {
    return '<div class="skel-settings"><div class="skel skel-tabs"></div><div class="skel-detail-grid"><div class="skel-card">' + line(68) + line(84) + line(58) + '</div><div class="skel-card">' + line(64) + line(76) + '</div></div></div>';
  }
  return card();
}let actionBarHTML = '';
/* Prevent the delegated nav click and the following native hashchange from
   rendering the same route twice. */
let skipNextHashRoute = false;
function render() {
  cleanupExpiredEvents();
  expandCache.clear(); searchCorpus = null;
  const r = parseHash(), hd = HEADERS[r.name] || HEADERS.calendar;
  document.body.setAttribute('data-route', r.name);
  buildChrome(); updateNav(navKey(r.name));
  let acts = '', crumb = '';
  actionBarHTML = '';
  if (r.name === 'calendar') acts = '<button class="btn btn-secondary" type="button" data-act="cal-today">' + ic('target', 17) + 'Сегодня</button><button class="btn btn-primary" type="button" data-act="new-event">' + ic('plus', 17) + 'Новое событие</button>';
  else if (r.name === 'songs') acts = '';
  else if (r.name === 'setlists') acts = '';
  else if (r.name === 'song') {
    crumb = '<nav class="crumb" aria-label="Хлебные крошки"><a href="#/songs">Репертуар</a>' + ic('right', 12) + '<span class="nowrap">' + esc((songById(r.id) || {}).title || '') + '</span></nav>';
    acts = '<button class="btn btn-primary" type="button" data-act="edit-song" data-id="' + esc(r.id) + '">' + ic('edit', 17) + 'Изменить песню</button>';
    actionBarHTML = '';
  } else if (r.name === 'setlist') {
    crumb = '<nav class="crumb" aria-label="Хлебные крошки"><a href="#/setlists">Сет-листы</a>' + ic('right', 12) + '<span class="nowrap">' + esc((slById(r.id) || {}).name || '') + '</span></nav>';
    acts = '<button class="btn btn-primary" type="button" data-act="scene-setlist" data-id="' + esc(r.id) + '">' + ic('monitor', 17) + 'Открыть на сцене</button>';
    actionBarHTML = '';
  } else if (r.name === 'settings') acts = '<button class="btn btn-secondary" type="button" data-act="export">' + ic('dl', 17) + 'Скачать копию</button>';
  $('#pageHead').innerHTML = (r.name === 'songs' || r.name === 'setlists') ? '' :
    '<div style="min-width:0;flex:1">' + crumb + '<h1>' + esc(hd[0]) + '</h1></div>' +
    (acts ? '<div class="ph-acts">' + acts + '</div>' : '');
  document.body.setAttribute('data-actionbar', actionBarHTML ? '1' : '0');

  const v = $('#view');
  if (ui.skeleton) {
    const token = ++ui.skeletonToken;
    clearTimeout(ui.skeletonTimer);
    ui.skeletonTimer = setTimeout(function () {
      if (token !== ui.skeletonToken) return;
      v.setAttribute('aria-busy', 'true');
      v.innerHTML = skeletonFor(r.name);
      ui.skeletonShownAt = performance.now();
      setTimeout(function () {
        if (token !== ui.skeletonToken) return;
        ui.skeleton = false;
        render();
      }, Math.max(250, 250 - (performance.now() - ui.skeletonShownAt)));
    }, 120);
    return;
  }
  try {
    let html = '';
    if (r.name === 'calendar') html = vCalendar();
    else if (r.name === 'songs') html = vSongs();
    else if (r.name === 'song') html = vSong(r.id);
    else if (r.name === 'setlists') html = vSetlists();
    else if (r.name === 'setlist') html = vSetlist(r.id);
    else if (r.name === 'settings') html = vSettings();
    else html = '<div class="card">' + stateHTML('err', 'Раздел не найден', 'Проверьте адрес или вернитесь в расписание.', '<a class="btn btn-primary" href="#/calendar">Открыть расписание</a>') + '</div>';
    v.innerHTML = html + (actionBarHTML || '');
    v.setAttribute('aria-busy', 'false');
  } catch (err) {
    v.setAttribute('aria-busy', 'false');
    v.innerHTML = '<div class="card">' + stateHTML('err', 'Не удалось отобразить раздел', 'Данные сохранены локально. Повторите попытку или вернитесь в расписание.', '<button class="btn btn-primary" type="button" data-act="reload-view">Повторить</button>') + '</div>';
  }
  afterRender(r);
  scheduleOfflineSongSync(1400);
}
function renderViewOnly() {
  expandCache.clear();
  searchCorpus = null;
  const r = parseHash(), v = $('#view');
  if (!v) return;
  try {
    let html = '';
    if (r.name === 'calendar') html = vCalendar();
    else if (r.name === 'songs') html = vSongs();
    else if (r.name === 'song') html = vSong(r.id);
    else if (r.name === 'setlists') html = vSetlists();
    else if (r.name === 'setlist') html = vSetlist(r.id);
    else if (r.name === 'settings') html = vSettings();
    else return;
    v.innerHTML = html + (actionBarHTML || '');
    v.setAttribute('aria-busy', 'false');
    // Search/filter changes do not need to rebuild the global chrome or
    // scroll the calendar time-grid back to "now".
    if (r.name === 'setlist' && r.id) bindDnD(r.id);
    if (r.name === 'settings') { bindSettings(); refreshOfflineSettingsUI(); }
    scheduleOfflineSongSync(1400);
  } catch (err) {
    console.warn('BandPlan partial view render failed:', err);
    render();
  }
}
function afterRender(r) {
  if (r.name === 'setlist' && r.id) bindDnD(r.id);
  if (r.name === 'settings') { bindSettings(); refreshOfflineSettingsUI(); }
  if (r.name === 'calendar') scrollTimeGrid();
}
function scrollTimeGrid() { const sc = $('#tgScroll'); if (sc) { const n = new Date(); sc.scrollTop = clamp((n.getHours() - 8) * 48, 0, 800); } }

/* ═══ 11. CALENDAR + HERO ═══ */
function heroHTML() {
  const next = upcoming()[0], p = state.profile, my = next ? (eventStatusFor(next.ev) || '') : '';
  const meta = next ? [pdateFull(next.date), next.ev.time ? next.ev.time + (next.ev.end ? '–' + next.ev.end : '') : '', next.ev.location || ''].filter(Boolean).join(' · ') : '';
  return '<section class="nearest-event rise" aria-labelledby="nearestEventTitle">' +
    '<div class="nearest-event-main"><span class="eyebrow">Ближайшее событие</span>' +
    '<h1 id="nearestEventTitle">' + esc(next ? next.ev.title : 'Событий пока нет') + '</h1>' +
    (meta ? '<p class="nearest-event-meta">' + esc(meta) + '</p>' : '<p class="nearest-event-meta">Добавьте первое событие в календарь.</p>') +
    (next ? '<div class="nearest-event-status">' + renderMyPositionBadge(next.ev, {compact:false}) + '</div>' : '') +
    '</div><div class="nearest-event-actions">' +
    (next ? '<button class="btn btn-primary" type="button" data-act="event-info" data-id="' + esc(next.ev.id) + '" data-date="' + esc(next.date) + '">' + ic('calendar', 17) + 'Открыть событие</button>' : '<button class="btn btn-primary" type="button" data-act="new-event">' + ic('plus', 17) + 'Добавить событие</button>') +
    '<button class="btn btn-tertiary" type="button" data-act="scene-quick">' + ic('monitor', 17) + 'Сцена</button>' +
    '</div></section>';
}
function heroMetric(v, l) { return '<div class="hero-metric"><div class="v">' + v + '</div><div class="l">' + esc(l) + '</div></div>'; }
function vCalendar() {
  const m = ui.month, y = m.getFullYear(), mo = m.getMonth();
  let h = heroHTML();
  h += '<section class="card rise" style="animation-delay:.04s" aria-labelledby="calH"><div class="cal-head">' +
    '<div class="row-ns" style="gap:var(--s2)">' +
    '<button class="icon-btn lg" type="button" data-act="cal-nav" data-d="-1" aria-label="Предыдущий период">' + ic('left', 18) + '</button>' +
    '<h2 class="cal-title" id="calH" aria-live="polite">' + esc(calTitle()) + '</h2>' +
    '<button class="icon-btn lg" type="button" data-act="cal-nav" data-d="1" aria-label="Следующий период">' + ic('right', 18) + '</button>' +
    '<button class="btn btn-tertiary btn-sm" type="button" data-act="cal-today">Сегодня</button></div>' +
    '<div class="seg" role="tablist" aria-label="Вид расписания">' +
    [['month', 'Месяц', 'grid'], ['week', 'Неделя', 'rows'], ['day', 'День', 'target']].map(v =>
      '<button role="tab" aria-selected="' + (ui.calView === v[0]) + '" type="button" data-act="cal-view" data-v="' + v[0] + '" class="' + (ui.calView === v[0] ? 'on' : '') + '" data-accent="1">' + ic(v[2], 14) + v[1] + '</button>').join('') +
    '</div></div>';
  if (ui.calView === 'month') h += monthHTML(y, mo);
  else if (ui.calView === 'week') h += weekHTML(weekStart(ui.month));
  else h += dayHTML(ui.selDate || today());
  h += '</section>';

  const list = filteredUpcoming(), ac = evFilterActive();
  h += '<div class="toolbar mt">' +
    '<div class="tb-search grow">' + ic('search', 18) +
    '<label class="sr-only" for="evQ">Поиск участий</label>' +
    '<input id="evQ" class="bare-input" type="search" placeholder="Поиск по названию, месту или заметке" value="' + esc(ui.evQuery) + '">' +
    (ui.evQuery ? '<button class="icon-btn" type="button" data-act="ev-clear" aria-label="Очистить поиск" style="width:var(--tap);height:var(--tap)">' + ic('x', 15) + '</button>' : '') + '</div>' +
    '<button class="btn ' + (ac ? 'btn-primary' : 'btn-secondary') + '" type="button" data-act="ev-filter-open">' + ic('filter', 17) + '<span class="btn-lbl">Фильтры' + (ac ? ' · ' + evFilterCount() : '') + '</span></button></div>';
  if (ac || ui.evQuery) h += '<div class="active-chips"><span class="lbl">Активные фильтры:</span>' +
    (ui.evQuery ? '<button class="chip" type="button" data-act="ev-clear">' + ic('search', 13) + '«' + esc(ui.evQuery) + '»<span class="rm">×</span></button>' : '') +
    ui.evTypes.map(t => '<button class="chip" type="button" data-act="ev-type" data-v="' + t + '">' + esc(evType(t).label) + '<span class="rm">×</span></button>').join('') +
    (ui.evMine ? '<button class="chip" type="button" data-act="ev-mine">Только я ' + (ui.evMineMode === 'maybe' ? 'участвую или под вопросом' : 'участвую') + '<span class="rm">×</span></button>' : '') +
    (ui.evRepeat ? '<button class="chip" type="button" data-act="ev-repeat">Повторяющиеся<span class="rm">×</span></button>' : '') +
    '<button class="btn btn-tertiary btn-sm" type="button" data-act="ev-reset">Сбросить</button></div>';

  h += '<section class="card rise" style="animation-delay:.07s" aria-labelledby="upH"><div class="card-h"><div><h2 id="upH">Ближайшие участия</h2>' +
    '<div class="sub">' + list.length + ' ' + plural(list.length, 'событие', 'события', 'событий') + ' · отметьте ваше участие</div></div>' +
    '<button class="btn btn-secondary btn-sm" type="button" data-act="new-event" aria-label="Добавить событие">' + ic('plus', 15) + '<span class="btn-lbl">Добавить событие</span></button></div>';
  if (!list.length) h += stateHTML(ui.evQuery || ac ? 'search' : 'empty',
    ui.evQuery || ac ? 'Ничего не найдено' : 'Событий пока нет',
    ui.evQuery || ac ? 'Попробуйте изменить запрос или сбросить фильтры — возможно, события запланированы на другие даты.' : 'Создайте первую репетицию или выступление: укажите дату, время, место и состав.',
    (ui.evQuery || ac ? '<button class="btn btn-secondary" type="button" data-act="ev-reset">Сбросить фильтры</button>' : '') +
    '<button class="btn btn-primary" type="button" data-act="new-event">Создать событие</button>');
  else { h += '<div class="participation-collection collection-blocks">'; list.slice(0, 12).forEach(o => { h += evRow(o, true); }); h += '</div>'; }
  return h + '</section>';
}
function calTitle() {
  const d = ui.month;
  if (ui.calView === 'month') return MONF[d.getMonth()] + ' ' + d.getFullYear();
  if (ui.calView === 'week') { const s = weekStart(d), e = new Date(s); e.setDate(s.getDate() + 6); return pdate(iso(s)) + ' — ' + pdate(iso(e)); }
  return pdateFull(ui.selDate || today());
}
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 7 - (state.settings.weekStart === 0 ? 7 : 1)) % 7); return x; }
function evFilterActive() { return !!(ui.evTypes.length || ui.evMine || ui.evRepeat); }
function evFilterCount() { return ui.evTypes.length + (ui.evMine ? 1 : 0) + (ui.evRepeat ? 1 : 0); }
function filteredUpcoming() {
  const q = ui.evQuery.toLowerCase().trim();
  return upcoming().filter(function (o) {
    const e = o.ev;
    if (ui.evTypes.length && ui.evTypes.indexOf(e.type) < 0) return false;
    if (ui.evMine && (ui.evMineMode === 'maybe' ? !['yes','maybe'].includes(eventStatusFor(e)) : eventStatusFor(e) !== 'yes')) return false;
    if (ui.evRepeat && (!e.repeat || e.repeat === 'none')) return false;
    if (q && ((e.title || '') + ' ' + (e.location || '') + ' ' + (e.notes || '')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function openEventFilters() {
  openModal({
    title: 'Фильтры расписания', sub: 'Применяются сразу к списку ближайших событий', guard: false, sheet: true,
    body: '<div class="field"><span class="field-label">Тип события</span><div class="row" style="gap:6px">' +
      Object.keys(EV_TYPES).map(t => '<button class="chip' + (ui.evTypes.indexOf(t) >= 0 ? ' on' : '') + '" type="button" data-act="ev-type" data-v="' + t + '" data-no-dirty="1" aria-pressed="' + (ui.evTypes.indexOf(t) >= 0) + '">' + ic(EV_TYPES[t].ic, 14) + esc(EV_TYPES[t].label) + '</button>').join('') + '</div></div>' +
      '<div class="field"><span class="field-label">Показывать</span><div class="row" style="gap:6px">' +
      '<button class="chip' + (ui.evMine ? ' on' : '') + '" type="button" data-act="ev-mine" data-no-dirty="1" aria-pressed="' + ui.evMine + '">' + ic('target', 14) + 'Только я</button>' +
      (ui.evMine ? '<button class="chip" type="button" data-act="ev-mine-mode" data-no-dirty="1" aria-label="Режим фильтра участия">' + (ui.evMineMode === 'maybe' ? 'Участвую или под вопросом' : 'Только участвую') + '</button>' : '') +
      '<button class="chip' + (ui.evRepeat ? ' on' : '') + '" type="button" data-act="ev-repeat" data-no-dirty="1" aria-pressed="' + ui.evRepeat + '">' + ic('repeat', 14) + 'Повторяющиеся</button></div></div>' +
      '<div class="field"><span class="field-label">Первый день недели</span><div class="seg">' +
      '<button type="button" data-act="weekstart-set" data-v="1" class="' + (state.settings.weekStart !== 0 ? 'on' : '') + '" data-no-dirty="1" data-accent="1">Понедельник</button>' +
      '<button type="button" data-act="weekstart-set" data-v="0" class="' + (state.settings.weekStart === 0 ? 'on' : '') + '" data-no-dirty="1" data-accent="1">Воскресенье</button></div></div>',
    footer: '<button class="btn btn-secondary" type="button" data-act="ev-reset">Сбросить фильтры</button>' +
      '<button class="btn btn-primary" type="button" data-act="modal-close" id="evFilterDone">Показать ' + filteredUpcoming().length + '</button>',
    onMount: function (w) {
      const upd = () => { const b = $('#evFilterDone', w); if (b) b.textContent = 'Показать ' + filteredUpcoming().length; };
      w.addEventListener('click', e => { if (e.target.closest('[data-act^="ev-"],[data-act="weekstart-set"]')) setTimeout(upd, 0); });
    }
  });
}
function dayCellModal(date) {
  const occ = expand(date, date);
  const title = pdateFull(date);
  const items = occ.map(function(o) {
    const e = o.ev, t = evType(e.type);
    return '<button class="day-modal-event" type="button" data-act="event-info" data-id="' + esc(e.id) + '" data-date="' + esc(date) + '">' +
      '<span class="day-modal-event-main"><strong>' + esc(e.title) + '</strong>' +
      '<span>' + esc(e.time || 'Без времени') + (e.end ? '–' + esc(e.end) : '') + (e.location ? ' · ' + esc(e.location) : '') + '</span></span>' +
      '<span class="badge ' + t.cls + '">' + ic(t.ic, 12) + esc(t.label) + '</span></button>';
  }).join('');
  openModal({
    title: title,
    sub: '',
    guard: false,
    body: '<div class="day-modal-list">' + (items || '<div class="day-modal-empty">Событий нет</div>') + '</div>',
    footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Закрыть</button>' +
      '<button class="btn btn-primary" type="button" data-act="new-event" data-date="' + esc(date) + '">' + ic('plus', 16) + 'Добавить событие</button>'
  });
}
function monthHTML(y, mo) {
  const occ = expand(iso(new Date(y, mo, 1)), iso(new Date(y, mo + 1, 0)));
  const byDay = {}; occ.forEach(o => { (byDay[o.date] = byDay[o.date] || []).push(o); });
  const ws = state.settings.weekStart === 0 ? 1 : 0;
  let h = '<div class="cal-grid" role="grid" aria-label="Календарь на месяц">';
  for (let i = 0; i < 7; i++) h += '<div class="cal-wd" role="columnheader">' + WD[(ws + i) % 7] + '</div>';
  const first = new Date(y, mo, 1);
  const off = (first.getDay() + 7 - (state.settings.weekStart === 0 ? 7 : 1)) % 7;
  const gs = new Date(y, mo, 1 - off);
  for (let i = 0; i < 42; i++) {
    const d = new Date(gs); d.setDate(gs.getDate() + i);
    const k = iso(d), list = byDay[k] || [];
    const cls = ['cal-cell'];
    if (d.getMonth() !== mo) cls.push('out');
    if (k === today()) cls.push('today');
    if (k === ui.selDate) cls.push('sel');
    if (list.length) { cls.push('cal-has-events'); cls.push('cal-type-' + String(list[0].ev.type || 'other')); }
    const nearest = list.find(o => (o.ev.status || 'upcoming') === 'upcoming' && o.date >= today()) || list[0];
    const nearestStatus = nearest ? eventStatusFor(nearest.ev) : '';
    h += '<div class="' + cls.join(' ') + '" role="gridcell" tabindex="0" aria-label="' + esc(d.getDate() + ' ' + MONF[d.getMonth()] + ', событий: ' + list.length) + '" data-act="cal-day" data-date="' + k + '">' +
      '<div class="cal-num">' + d.getDate() + (k === today() ? '<i class="cal-dot-today" aria-hidden="true"></i>' : '') +
      '</div>';
    if (list.length) {
      h += '<div class="cal-events">';
      list.slice(0, 3).forEach(o => {
        const type = evType(o.ev.type);
        const label = [o.ev.title, o.ev.time, type.label].filter(Boolean).join(', ');
        h += '<div class="cal-ev ce-' + o.ev.type + '" data-act="event-info" data-id="' + esc(o.ev.id) + '" data-date="' + esc(o.date) + '" role="button" tabindex="0" aria-label="' + esc(label) + '"><span class="cal-ev-icon" aria-hidden="true">' + ic(type.ic, 12) + '</span><span class="cal-ev-label">' + esc(o.ev.time || '') + (o.ev.time ? ' ' : '') + esc(o.ev.title) + '</span></div>';
      });
      if (list.length > 3) {
        const remaining = list.length - 3;
        h += '<div class="cal-more" data-count="' + remaining + '" aria-hidden="true">ещё ' + remaining + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  h += '<div class="cal-legend">' + Object.keys(EV_TYPES).map(t =>
    '<span><i class="event-type-dot type-' + t + '" aria-hidden="true"></i>' + EV_TYPES[t].label + '</span>').join('') + '</div>';
  const selectedKey = ui.selDate || today();
  const selectedItems = expand(selectedKey, selectedKey);
  h += '<section class="cal-selected-day" aria-labelledby="calSelectedTitle">' +
    '<div class="card-h"><div><h3 id="calSelectedTitle">' + esc(pdateFull(selectedKey)) + '</h3><div class="sub">' + selectedItems.length + ' ' + plural(selectedItems.length, 'событие', 'события', 'событий') + '</div></div>' +
    '<button class="btn btn-primary btn-sm" type="button" data-act="new-event" data-date="' + esc(selectedKey) + '">' + ic('plus', 15) + 'Добавить</button></div>' +
    (selectedItems.length ? selectedItems.map(o => evRow(o, true)).join('') : stateHTML('empty', 'На этот день ничего нет', 'Выберите другой день или добавьте событие.')) +
    '</section>';
  return h;
}
const H0 = 7, H1 = 24, HPH = 48;
function timeGrid(days) {
  const n = days.length;
  const from = new Date(days[0]); from.setHours(H0, 0, 0, 0);
  const to = new Date(days[n - 1]); to.setHours(H1, 0, 0, 0);
  const occ = expand(from, to), height = (H1 - H0) * HPH, todayK = today(), colMin = n > 2 ? 92 : 0;
  let h = '<div class="tg-wrap"><div class="tg-scroll" id="tgScroll"><div class="tg-grid" style="--cols:' + n + ';grid-template-columns:48px repeat(' + n + ',minmax(' + colMin + 'px,1fr))">';
  h += '<div class="tg-corner"></div>';
  days.forEach(function (d) {
    const k = iso(d);
    h += '<div class="tg-hc' + (k === todayK ? ' now' : '') + '" role="button" tabindex="0" data-act="tg-day" data-date="' + k + '" aria-label="Открыть день ' + esc(pdate(k)) + '">' + WD[(d.getDay() + 6) % 7] + '<b>' + d.getDate() + '</b></div>';
  });
  h += '<div class="tg-times" style="height:' + height + 'px" aria-hidden="true">';
  for (let i = H0; i < H1; i++) h += '<div class="tg-h">' + pad(i) + ':00</div>';
  h += '</div>';
  days.forEach(function (d) {
    const k = iso(d);
    h += '<div class="tg-col' + (k === todayK ? ' now' : '') + '" style="height:' + height + 'px" data-act="tg-col" data-date="' + k + '">';
    for (let i = H0; i < H1; i++) h += '<div class="tg-line"></div>';
    occ.filter(o => o.date === k).forEach(function (o) {
      const e = o.ev, t = evType(e.type);
      const sm = clamp(mins(e.time), H0 * 60, H1 * 60), em = clamp(mins(e.end) || sm + 90, sm + 30, H1 * 60);
      const eventTop = (sm - H0 * 60) / 60 * HPH, hh = Math.max(24, (em - sm) / 60 * HPH - 3);
      h += '<div class="tg-ev type-' + e.type + '" style="top:' + eventTop + 'px;height:' + hh + 'px" data-act="event-info" data-id="' + e.id + '" data-date="' + o.date + '" role="button" tabindex="0" aria-label="' + esc(e.title + ', ' + (e.time || '') + '–' + (e.end || '')) + '">' +
        '<b>' + esc(e.title) + '</b><span>' + esc(e.time || '') + (e.end ? '–' + esc(e.end) : '') + '</span></div>';
    });
    if (k === todayK) {
      const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
      if (nm >= H0 * 60 && nm <= H1 * 60) h += '<div class="tg-nowline" style="top:' + ((nm - H0 * 60) / 60 * HPH) + 'px" aria-hidden="true"></div>';
    }
    h += '</div>';
  });
  return h + '</div></div></div>';
}
function weekHTML(start) {
  const days = []; for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
  return timeGrid(days) + '<p class="t-sm t-muted mt-s">Нажмите на день в шапке, чтобы открыть расписание на день. Пустая ячейка создаёт событие в это время.</p>';
}
function dayHTML(k) {
  const occ = expand(k, k);
  let h = timeGrid([new Date(k + 'T00:00:00')]);
  h += '<div class="card-h mt"><div><h2 style="font-size:var(--fs-body)">' + esc(pdateFull(k)) + '</h2>' +
    '<div class="sub">' + occ.length + ' ' + plural(occ.length, 'событие', 'события', 'событий') + (k === today() ? ' · сегодня' : '') + '</div></div>' +
    '<button class="btn btn-primary btn-sm" type="button" data-act="new-event" data-date="' + k + '" aria-label="Добавить событие">' + ic('plus', 15) + '<span class="btn-lbl">Добавить событие</span></button></div>';
  if (!occ.length) h += stateHTML('empty', 'Свободный день', 'Событий на эту дату нет. Добавьте репетицию или выступление.', '<button class="btn btn-primary" type="button" data-act="new-event" data-date="' + k + '">Добавить событие</button>');
  else occ.forEach(o => { h += evRow(o, true); });
  return h;
}
function evRow(o, withPart) {
  const e = o.ev, t = evType(e.type), d = new Date(o.date + 'T00:00:00');
  const done = e.status === 'done', sl = e.setlistId ? slById(e.setlistId) : null;
  const mems = (e.memberIds || []).map(memById).filter(Boolean);
  return '<article class="ev-row ev-type-' + String(e.type || 'other') + (done ? ' ev-done' : '') + '" data-act="event-info" data-id="' + e.id + '" data-date="' + o.date + '" role="button" tabindex="0">' +
    '<div class="ev-date" aria-hidden="true"><div class="d">' + d.getDate() + '</div><div class="m">' + MON[d.getMonth()] + '</div></div>' +
    '<div class="ev-body">' +
    '<h3 class="ev-title"><span class="ev-title-main"><span class="ev-name">' + esc(e.title) + '</span><span class="badge ev-category ' + t.cls + '">' + ic(t.ic, 11) + esc(t.label) + '</span>' +
    (e.repeat && e.repeat !== 'none' ? '<span class="badge b-muted">' + ic('repeat', 11) + esc(REPEATS[e.repeat]) + '</span>' : '') +
    (done ? '<span class="badge b-ok">' + ic('check', 11) + 'Проведено</span>' : '') +
    '</span><span class="ev-title-state">' + renderMyPositionBadge(e) + '</span></h3>' +
    '<div class="ev-meta">' +
    (e.time ? '<span>' + ic('clock', 12) + esc(e.time) + (e.end ? '–' + esc(e.end) : '') + '</span>' : '') +
    (e.location ? '<span class="ev-location">' + ic('pin', 12) + esc(e.location) + '</span>' : '') +
    (!done && o.date >= today() ? '<span>' + ic('bolt', 12) + esc(countdown(o.date)) + '</span>' : '') +
    (sl ? '<span>' + ic('list', 12) + esc(sl.name) + '</span>' : '') + '</div>' +
    (mems.length ? '<div class="avatars" aria-label="Состав">' + mems.slice(0, 5).map(m => { const ps = participantStatusFor(e, m); return '<i class="part-avatar part-' + (ps || 'unset') + '" data-member-key="' + esc(m.id) + '" title="' + esc(m.name + ' — ' + participantStatusLabel(ps)) + '" aria-label="' + esc(m.name + ' — ' + participantStatusLabel(ps)) + '">' + esc(m.name.charAt(0).toUpperCase()) + '</i>'; }).join('') + (mems.length > 5 ? '<i class="more">+' + (mems.length - 5) + '</i>' : '') + '</div>' : '') +
    (withPart ? '<div data-event-switch="' + esc(String(e.id)) + '">' + renderParticipationSwitch(e, {size:'sm', variant:'row'}) + '</div>' : '') +
    '</div>' +
    '<div class="ev-acts">' +
    (sl ? '<button class="icon-btn" type="button" data-act="scene-setlist" data-id="' + sl.id + '" aria-label="Открыть сцену" title="Сцена" aria-label="Открыть сет-лист на сцене">' + ic('monitor', 16) + '<span class="ia-t">Сцена</span></button>' : '') +
    '<button class="icon-btn" type="button" data-act="event-edit" data-id="' + e.id + '" aria-label="Изменить событие">' + ic('edit', 16) + '<span class="ia-t">Изменить</span></button>' +
    (done ? '<button class="icon-btn" type="button" data-act="event-undone" data-id="' + e.id + '" aria-label="Вернуть в план">' + ic('repeat', 16) + '<span class="ia-t">В план</span></button>'
      : '<button class="icon-btn" type="button" data-act="event-done" data-id="' + e.id + '" aria-label="Отметить проведённым">' + ic('check', 16) + '<span class="ia-t">Готово</span></button>') +
    '<button class="icon-btn ia-danger" type="button" data-act="event-del" data-id="' + e.id + '" data-date="' + o.date + '" aria-label="Удалить событие">' + ic('trash', 16) + '<span class="ia-t">Удалить</span></button>' +
    '</div></article>';
}

/* ═══ 12. SONGS ═══ */
function allTags() { const s = {}; state.songs.forEach(x => (x.tags || []).forEach(t => { if (t) s[t] = 1; })); return Object.keys(s).sort(); }
function filteredSongs() {
  let l = state.songs.slice();
  const q = ui.songQuery.toLowerCase().trim();
  if (q) l = l.filter(s => ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.tags || []).join(' ') + ' ' + (s.lyrics || '')).toLowerCase().indexOf(q) >= 0);
  if (ui.songKey) l = l.filter(s => s.key === ui.songKey);
  if (ui.songTag) l = l.filter(s => (s.tags || []).indexOf(ui.songTag) >= 0);
  if (ui.songFav) l = l.filter(s => s.fav);
  const cmp = {
    title: (a, b) => a.title.localeCompare(b.title, 'ru'),
    artist: (a, b) => (a.artist || '').localeCompare(b.artist || '', 'ru'),
    key: (a, b) => String(a.key || 'z').localeCompare(String(b.key || 'z')),
    bpm: (a, b) => (b.bpm || 0) - (a.bpm || 0),
    added: (a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || ''))
  }[ui.songSort] || ((a, b) => a.title.localeCompare(b.title, 'ru'));
  return l.sort(cmp);
}
function songFilterActive() { return !!(ui.songKey || ui.songTag || ui.songFav || ui.songSort !== 'title'); }
function vSongs() {
  const list = filteredSongs(), tags = allTags();
  let h = '<div class="songs-head-row">' +
    '<h1>Репертуар</h1>' +
    '<button class="btn btn-primary" type="button" data-act="new-song">' + ic('plus', 17) + 'Добавить песню</button>' +
  '</div>' +
  '<div class="toolbar songs-search-row">' +
    '<div class="tb-search">' + ic('search', 18) + '<label class="sr-only" for="songQ">Поиск песен</label>' +
    '<input id="songQ" class="bare-input" type="search" placeholder="Название, автор, текст, тег" value="' + esc(ui.songQuery) + '">' +
    (ui.songQuery ? '<button class="icon-btn" type="button" data-act="song-clear" aria-label="Очистить поиск" style="width:var(--tap);height:var(--tap)">' + ic('x', 15) + '</button>' : '') + '</div>' +
    '<button class="btn ' + (songFilterActive() ? 'btn-primary' : 'btn-secondary') + '" type="button" data-act="song-filter-open" aria-label="Фильтры">' + ic('filter', 17) + '<span class="btn-lbl">Фильтры</span></button>' +
  '</div>';
  if (songFilterActive() || ui.songQuery) {
    h += '<div class="active-chips"><span class="lbl">Активные фильтры:</span>' +
      (ui.songQuery ? '<button class="chip" type="button" data-act="song-clear">' + ic('search', 13) + '«' + esc(ui.songQuery) + '»<span class="rm">×</span></button>' : '') +
      (ui.songKey ? '<button class="chip" type="button" data-act="song-key-clear">' + esc(ui.songKey) + '<span class="rm">×</span></button>' : '') +
      (ui.songTag ? '<button class="chip" type="button" data-act="tag" data-v="">' + esc(ui.songTag) + '<span class="rm">×</span></button>' : '') +
      (ui.songFav ? '<button class="chip" type="button" data-act="fav-filter">' + ic('star', 13) + 'Избранные<span class="rm">×</span></button>' : '') +
      (ui.songSort !== 'title' ? '<button class="chip" type="button" data-act="song-sort-reset">' + esc({ artist: 'по исполнителю', key: 'по тональности', bpm: 'по темпу', added: 'недавние' }[ui.songSort] || 'сортировка') + '<span class="rm">×</span></button>' : '') +
      '<button class="btn btn-tertiary btn-sm" type="button" data-act="song-reset">Сбросить</button></div>';
  }
  h += '<p class="t-sm t-muted mb">' + list.length + ' ' + plural(list.length, 'песня', 'песни', 'песен') + ' из ' + state.songs.length + '</p>';
  if (!list.length) {
    return h + '<div class="card">' + stateHTML(state.songs.length ? 'search' : 'empty',
      state.songs.length ? 'Ничего не найдено' : 'В репертуаре пока нет песен',
      state.songs.length ? 'Попробуйте короткий запрос, снимите часть фильтров или сбросьте их полностью.' : 'Добавьте первую песню: текст, аккорды отдельной строкой, тональность, темп и динамику партий по инструментам.',
      state.songs.length ? '<button class="btn btn-secondary" type="button" data-act="song-reset">Сбросить фильтры</button><button class="btn btn-primary" type="button" data-act="new-song">Добавить песню</button>'
        : '<button class="btn btn-primary" type="button" data-act="new-song">' + ic('plus', 17) + 'Добавить первую песню</button>') + '</div>';
  }
  const desktopMaster = window.matchMedia && window.matchMedia('(min-width:1100px)').matches;
  const selectedSong = desktopMaster && list.length ? (list.find(s => s.id === ui.songSelectedId) || list[0]) : null;
  if (selectedSong) ui.songSelectedId = selectedSong.id;
  h += '<div class="master-detail-shell' + (desktopMaster ? ' is-desktop' : '') + '"><div class="master-list"><div class="collection-grid collection-list songs-list">';
  list.forEach(function (s, i) {
    const used = state.setlists.filter(sl => (sl.items || []).some(it => it.songId === s.id)).length;
    h += '<article class="song-card rise" style="animation-delay:' + Math.min(i * 22, 180) + 'ms" data-act="open-song" data-id="' + s.id + '" role="link" tabindex="0" aria-label="Открыть песню ' + esc(s.title) + '">' +
      '<div class="song-top"><div class="key-badge" aria-hidden="true">' + esc(s.key || '—') + '</div>' +
      '<div class="song-title-wrap"><h3 class="song-name">' + esc(s.title) + '</h3></div>' +
      '<div class="song-open-wrap">' +
      '<button class="fav' + (s.fav ? ' on' : '') + '" type="button" data-act="fav" data-id="' + s.id + '" aria-pressed="' + !!s.fav + '" aria-label="' + (s.fav ? 'Убрать из избранного' : 'В избранное') + '">' + ic('star', 18) + '</button>' +
      '<span class="card-chevron" aria-hidden="true">›</span>' +
      '</div></div>' +
      '<div class="song-meta">' +
      (s.bpm ? '<span class="badge b-muted num">' + s.bpm + ' BPM</span>' : '') +
      (s.duration ? '<span class="badge b-muted num">' + ic('clock', 11) + fmtDur(s.duration) + '</span>' : '') +
      (s.tags || []).slice(0, 2).map(t => '<span class="badge b-muted">' + esc(t) + '</span>').join('') +
      (used ? '<span class="badge b-ok">' + ic('list', 11) + used + '</span>' : '') + '</div>' +
      '<div class="song-acts">' +
      '<button class="btn btn-secondary btn-sm" type="button" data-act="print-song" data-id="' + s.id + '" aria-label="Печать песни" title="Печать">' + ic('print', 15) + '<span class="btn-txt">Печать</span></button>' +
      '<button class="btn btn-secondary btn-sm" type="button" data-act="scene-song" data-id="' + s.id + '" aria-label="Сцена" title="Сцена">' + ic('monitor', 15) + '<span class="btn-txt">Сцена</span></button>' +
      
      '<button class="btn btn-secondary btn-sm" type="button" data-act="to-setlist" data-id="' + s.id + '" aria-label="Добавить в сетлист" title="Сетлист">' + ic('list', 15) + '<span class="btn-txt">Сетлист</span></button></div></article>';
  });
  h += '</div></div>';
  if (selectedSong) h += '<aside class="master-detail-panel" aria-label="Карточка выбранной песни">' + vSong(selectedSong.id) + '</aside>';
  return h + '</div>';
}
function openSongFilters() {
  const tags = allTags();
  openModal({
    title: 'Фильтры репертуара', sub: 'Сортировка, тональность, теги и избранное', guard: false, sheet: true,
    body: '<div class="field"><label class="field-label" for="fSort">Сортировка</label><select class="select" id="fSort" data-no-dirty="1">' +
      [['title', 'По названию (А–Я)'], ['artist', 'По исполнителю'], ['key', 'По тональности'], ['bpm', 'По темпу (быстрые сначала)'], ['added', 'Недавно добавленные']]
        .map(o => '<option value="' + o[0] + '"' + (ui.songSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label class="field-label" for="fKey">Тональность</label><select class="select" id="fKey" data-no-dirty="1"><option value="">Все тональности</option>' +
      KEY_LIST.map(k => '<option value="' + k + '"' + (ui.songKey === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></div>' +
      '<div class="field"><span class="field-label">Теги</span><div class="row" style="gap:6px">' +
      '<button class="chip' + (ui.songTag ? '' : ' on') + '" type="button" data-act="tag" data-v="" data-no-dirty="1">Все</button>' +
      tags.map(t => '<button class="chip' + (ui.songTag === t ? ' on' : '') + '" type="button" data-act="tag" data-v="' + esc(t) + '" data-no-dirty="1">' + esc(t) + '</button>').join('') +
      (tags.length ? '' : '<span class="t-sm t-muted">Тегов пока нет — добавьте их в карточке песни.</span>') + '</div></div>' +
      '<div class="field"><span class="field-label">Прочее</span><div class="row" style="gap:6px">' +
      '<button class="chip' + (ui.songFav ? ' on' : '') + '" type="button" data-act="fav-filter" data-no-dirty="1" aria-pressed="' + ui.songFav + '">' + ic('star', 14) + 'Только избранные</button></div></div>' +
      '<p class="t-sm t-muted">Найдено: <b class="num" id="fCount">' + filteredSongs().length + '</b> ' + plural(filteredSongs().length, 'песня', 'песни', 'песен') + '</p>',
    footer: '<button class="btn btn-secondary" type="button" data-act="song-reset">Сбросить фильтры</button><button class="btn btn-primary" type="button" data-act="modal-close">Показать результаты</button>',
    onMount: function (w) {
      const upd = () => { const c = $('#fCount', w); if (c) c.textContent = filteredSongs().length; };
      $('#fSort', w).addEventListener('change', e => { ui.songSort = e.target.value; save(); render(); upd(); });
      $('#fKey', w).addEventListener('change', e => { ui.songKey = e.target.value; render(); upd(); });
      w.addEventListener('click', e => {
        if (e.target.closest('[data-act="tag"],[data-act="fav-filter"]')) setTimeout(function () {
          $$('#modalOverlay .chip[data-act="tag"]').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === ui.songTag));
          const f = $('#modalOverlay .chip[data-act="fav-filter"]'); if (f) { f.classList.toggle('on', ui.songFav); f.setAttribute('aria-pressed', ui.songFav); }
          upd();
        }, 0);
      });
    }
  });
}
function normalizeDynamics(dynamics) {
  const d = dynamics && typeof dynamics === 'object' ? cloneValue(dynamics) : {};
  d.instruments = Array.isArray(d.instruments) ? d.instruments : [];
  d.sections = Array.isArray(d.sections) ? d.sections : [];
  d.levels = d.levels && typeof d.levels === 'object' ? d.levels : {};
  d.notes = String(d.notes || d.overall || '');
  d.sectionNotes = d.sectionNotes && typeof d.sectionNotes === 'object' ? d.sectionNotes : {};
  d.instrumentNotes = d.instrumentNotes && typeof d.instrumentNotes === 'object' ? d.instrumentNotes : {};
  return d;
}
function syncDynamicsSections(draft, lyrics) {
  const names = extractSections(lyrics), previous = draft.sectionNotes || {};
  const oldNames = Array.isArray(draft.sections) ? draft.sections : [];
  const aliasFor = name => {
    const match = /^(Куплет|Припев|Бридж|Вступление|Предприпев|Проигрыш|Соло|Финал)(?:\s+(\d+))?$/i.exec(String(name || '').trim());
    if (!match) return [];
    const type = match[1], number = match[2];
    return number ? [type + ' ' + number, type, type.toLocaleLowerCase('ru') + ' ' + number, type.toLocaleLowerCase('ru')]
      : [type, type.toLocaleLowerCase('ru')];
  };
  const findPrevious = (map, name, oldList) => {
    if (map[name] != null) return map[name];
    for (const alias of aliasFor(name)) if (map[alias] != null) return map[alias];
    const sameType = oldList.find(old => {
      const a = classifySongSection(String(old).replace(/\s+\d+$/, '')).type;
      const b = classifySongSection(String(name).replace(/\s+\d+$/, '')).type;
      return a === b && map[old] != null;
    });
    return sameType ? map[sameType] : '';
  };
  draft.sections = names;
  draft.sectionNotes = {};
  names.forEach(name => { draft.sectionNotes[name] = String(findPrevious(previous, name, oldNames) || ''); });
  draft.instruments = Array.isArray(draft.instruments) ? draft.instruments : [];
  draft.levels = draft.levels && typeof draft.levels === 'object' ? draft.levels : {};
  draft.instrumentNotes = draft.instrumentNotes && typeof draft.instrumentNotes === 'object' ? draft.instrumentNotes : {};
  draft.instruments.forEach(ins => {
    draft.levels[ins] = draft.levels[ins] || {};
    const oldInstrumentNotes = draft.instrumentNotes[ins] || {};
    draft.instrumentNotes[ins] = {};
    names.forEach(name => {
      draft.instrumentNotes[ins][name] = String(findPrevious(oldInstrumentNotes, name, oldNames) || '');
      if (!(name in draft.levels[ins])) draft.levels[ins][name] = '';
    });
  });
  return names;
}
function dynamicsInstrumentLabel(key) {
  const role = ROLES.find(r => r.k === key);
  return role ? role.label : String(key || 'Инструмент');
}
function dynamicsRoleKey(value) {
  const raw = String(value == null ? '' : value).trim().toLocaleLowerCase('ru');
  const role = ROLES.find(r => r.k.toLocaleLowerCase('ru') === raw || r.label.toLocaleLowerCase('ru') === raw);
  return role ? role.k : raw;
}
function dynamicsVisibleInstruments(d, userRoles) {
  const roles = (Array.isArray(userRoles) ? userRoles : (typeof myRoles === 'function' ? myRoles() : []))
    .map(dynamicsRoleKey).filter(Boolean);
  // Instrument cues in lyrics and song details are visible only to matching profile roles.
  // Empty/unrecognized roles intentionally reveal no instrument-specific notes.
  return d.instruments.filter(ins => roles.includes(dynamicsRoleKey(ins)));
}
function dynamicsHTML(song, userRoles) {
  const d = normalizeDynamics(song && song.dynamics);
  const visibleInstruments = dynamicsVisibleInstruments(d, userRoles);
  const sections = d.sections.filter(name =>
    visibleInstruments.some(ins => String((d.instrumentNotes[ins] || {})[name] || '').trim())
  );
  if (!sections.length) return '';
  return '<div class="song-dynamics-text">' + sections.map(name => {
    const instruments = visibleInstruments.map(ins => {
      const note = String((d.instrumentNotes[ins] || {})[name] || '').trim();
      return note ? '<div class="song-dynamics-instrument"><span>' + esc(dynamicsInstrumentLabel(ins)) + '</span><p>' + esc(note).replace(/\n/g, '<br>') + '</p></div>' : '';
    }).join('');
    return '<div class="song-dynamics-section"><strong>' + esc(name) + '</strong>' + instruments + '</div>';
  }).join('') + '</div>';
}
function renderSceneLyrics(song, shift, userRoles) {
  const d = normalizeDynamics(song && song.dynamics);
  const lines = String(song && song.lyrics || '').split('\n');
  const occurrences = extractSectionOccurrences(song && song.lyrics || '');
  const inferred = occurrences.length && !occurrences[0].explicit;
  const byLine = Object.create(null);
  if (inferred) occurrences.forEach(section => { byLine[section.lineIndex] = section; });
  let sectionIndex = 0;
  function renderNotes(key) {
    const cues = dynamicsVisibleInstruments(d, userRoles).map(ins => {
      const noteText = String((d.instrumentNotes[ins] || {})[key] || '').trim();
      return noteText ? '<span class="ln scene-dyn-note scene-instrument-note"><b>' + esc(dynamicsInstrumentLabel(ins)) + '</b> ' + esc(noteText).replace(/\n/g, '<br>') + '</span>' : '';
    }).join('');
    return cues;
  }
  return lines.map(function(line, lineIndex) {
    const heading = parseSectionHeading(line);
    if (heading) {
      const occurrence = occurrences[sectionIndex++];
      const key = occurrence ? occurrence.label : heading.source;
      return '<span class="ln sec">' + esc(heading.source) + '</span>' + renderNotes(key);
    }
    const inferredSection = byLine[lineIndex];
    if (inferredSection) {
      return '<span class="ln sec">' + esc(inferredSection.label) + '</span>' + renderNotes(inferredSection.label) + renderLyrics(line, shift);
    }
    return renderLyrics(line, shift);
  }).join('');
}
function vSong(id) {
  const s = songById(id);
  if (!s) return '<div class="card">' + stateHTML('err', 'Песня не найдена', 'Возможно, она была удалена или ссылка устарела.', '<a class="btn btn-primary" href="#/songs">Вернуться в репертуар</a>') + '</div>';
  const tr = ui.detailTrans[s.id] || 0;
  const chords = extractChords(s.lyrics).map(c => transposeChord(c, tr));
  const used = state.setlists.filter(sl => (sl.items || []).some(it => it.songId === s.id));
  const myRole = myRoles()[0] || '';
  const mine = s.dynamics ? myRoles().filter(r => (s.dynamics.instruments || []).indexOf(r) >= 0) : [];
  const hasMy = mine.length > 0;
  let h = '<div class="split setlist-detail"><div class="stack">'
  h += '<section class="card rise"><div class="card-h"><div style="min-width:0"><h2 style="font-size:var(--fs-h3);overflow-wrap:anywhere">' + esc(s.title) + '</h2>' +
    '<div class="sub">' + esc(s.artist || 'Исполнитель не указан') + '</div></div>' +
    '<div class="row song-detail-actions"><button class="icon-btn fav' + (s.fav ? ' on' : '') + '" type="button" data-act="fav" data-id="' + s.id + '" aria-pressed="' + !!s.fav + '" aria-label="Избранное" title="Избранное">' + ic('star', 17) + '</button>' +
    '<button class="icon-btn danger" type="button" data-act="song-del" data-id="' + s.id + '" aria-label="Удалить песню" title="Удалить песню">' + ic('trash', 17) + '</button>' +
    '<button class="icon-btn" type="button" data-act="print-song" data-id="' + s.id + '" aria-label="Печать песни" title="Печать">' + ic('print', 17) + '</button></div></div>' +
    '<div class="trans-box"><div><div class="cap" style="margin-bottom:6px">Транспонирование</div>' +
    '<div class="row" style="gap:var(--s2)"><button class="icon-btn" type="button" data-act="song-trans" data-id="' + s.id + '" data-d="-1" aria-label="Опустить на полутон">♭</button>' +
    '<div class="trans-val" aria-live="polite">' + (tr > 0 ? '+' : '') + tr + '</div>' +
    '<button class="icon-btn" type="button" data-act="song-trans" data-id="' + s.id + '" data-d="1" aria-label="Поднять на полутон">♯</button>' +
    '<button class="btn btn-tertiary btn-sm" type="button" data-act="song-trans-reset" data-id="' + s.id + '">Сбросить</button></div></div>' +
    '<div style="margin-left:auto;text-align:right"><div class="cap" style="margin-bottom:6px">Тональность сейчас</div>' +
    '<div style="font-size:var(--fs-h3);font-weight:700;letter-spacing:-.03em">' + esc(transposeKey(s.key || '—', tr)) + '</div>' +
    (s.key && tr ? '<div class="t-xs t-muted">оригинал: ' + esc(s.key) + '</div>' : '') + '</div></div>' +
    '<div class="row mt"><button class="chip' + (state.settings.showChords !== false ? ' on' : '') + '" type="button" data-act="toggle-chords" aria-pressed="' + (state.settings.showChords !== false) + '">' + ic('music', 14) + 'Аккорды в тексте</button></div>' +
    (String(s.lyrics || '').split(String.fromCharCode(10)).length > 10 || String(s.lyrics || '').length > 420
      ? '<div class="lyrics-expand-shell is-collapsed"><div class="lyrics mt" id="songLyrics-' + esc(s.id) + '" style="--lsize:' + state.settings.lyricsSize + 'px">' + renderSceneLyrics(s, tr) + '</div><button class="btn btn-tertiary btn-sm lyrics-expand-btn" type="button" data-act="toggle-lyrics" aria-label="Показать весь текст" title="Показать весь текст" aria-expanded="false" aria-controls="songLyrics-' + esc(s.id) + '"><span class="lyrics-expand-chevron" aria-hidden="true"></span></button></div>'
      : '<div class="lyrics mt" style="--lsize:' + state.settings.lyricsSize + 'px">' + renderSceneLyrics(s, tr) + '</div>') + '</section>';
  h += '</div><div class="stack">';
  h += '<section class="card rise" style="animation-delay:.04s"><div class="card-h"><div><h2>' + ic('wave', 17) + ' Ваша динамика</h2>' +
    '<div class="sub">Роль в профиле: ' + esc(rolesLabel(myRoles())) + '</div></div>' +
    '<button class="icon-btn" type="button" data-act="edit-song" data-id="' + s.id + '" aria-label="Изменить песню">' + ic('edit', 16) + '</button></div>';
  const dynamicsView = dynamicsHTML(s);
  h += dynamicsView || stateHTML('empty', 'Динамика ещё не расписана', 'Алгоритм автоматически ищет названия частей песни в тексте. Добавь заголовки вроде «Куплет 1», «Припев», «Бридж» — они появятся здесь в том же порядке; указания по инструментам будут показаны рядом с соответствующими частями.', '<button class="btn btn-primary btn-sm" type="button" data-act="edit-song" data-id="' + s.id + '">Заполнить динамику</button>');
  h += '<div class="row mt song-detail-work-actions"><button class="btn btn-primary btn-block" type="button" data-act="scene-song" data-id="' + s.id + '" aria-label="Сцена" title="Сцена">' + ic('monitor', 16) + 'Открыть на сцене</button>' +
    '<button class="btn btn-secondary btn-block" type="button" data-act="to-setlist" data-id="' + s.id + '" aria-label="Добавить в сетлист" title="Сетлист">' + ic('list', 16) + 'Добавить в сет-лист</button></div>';
  h += '</section>';

  return h + '</div></div></div>';
}
const infoRow = (l, v) => '<div class="info-row"><span class="l">' + esc(l) + '</span><span class="v">' + (v || '—') + '</span></div>';

/* ═══ 13. SETLISTS ═══ */
function filteredSetlists() {
  const q = String(ui.setlistQuery || '').toLowerCase().trim();
  let list = state.setlists.slice();
  if (q) list = list.filter(sl => String(sl.name || '').toLowerCase().indexOf(q) >= 0);
  return list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}
function vSetlists() {
  const list = filteredSetlists();
  let h = '<div class="songs-head-row setlists-head-row">' +
    '<h1>Сет-листы</h1>' +
    '<button class="btn btn-primary" type="button" data-act="new-setlist">' + ic('plus', 17) + 'Создать сет-лист</button>' +
  '</div>' +
  '<div class="toolbar songs-search-row setlists-search-row">' +
    '<div class="tb-search">' + ic('search', 18) +
    '<label class="sr-only" for="setlistQ">Поиск сет-листов</label>' +
    '<input id="setlistQ" class="bare-input" type="search" placeholder="Название сет-листа" value="' + esc(ui.setlistQuery) + '">' +
    (ui.setlistQuery ? '<button class="icon-btn" type="button" data-act="setlist-clear" aria-label="Очистить поиск" style="width:var(--tap);height:var(--tap)">' + ic('x', 15) + '</button>' : '') +
    '</div>' +
  '</div>';

  h += '<p class="t-sm t-muted mb">' + list.length + ' ' + plural(list.length, 'сет-лист', 'сет-листа', 'сет-листов') + ' из ' + state.setlists.length + '</p>';

  if (!list.length) {
    return h + '<div class="card">' + stateHTML(
      state.setlists.length ? 'search' : 'empty',
      state.setlists.length ? 'Ничего не найдено' : 'Сет-листов пока нет',
      state.setlists.length ? 'Попробуйте изменить запрос или очистить поиск.' : 'Создайте первый сет-лист и соберите программу выступления из песен.',
      state.setlists.length
        ? '<button class="btn btn-secondary" type="button" data-act="setlist-clear">Очистить поиск</button><button class="btn btn-primary" type="button" data-act="new-setlist">' + ic('plus', 17) + 'Создать сет-лист</button>'
        : '<button class="btn btn-primary" type="button" data-act="new-setlist">' + ic('plus', 17) + 'Создать первый сет-лист</button>'
    ) + '</div>';
  }

  const desktopMaster = window.matchMedia && window.matchMedia('(min-width:1100px)').matches;
  const selectedSetlist = desktopMaster && list.length ? (list.find(sl => sl.id === ui.setlistSelectedId) || list[0]) : null;
  if (selectedSetlist) ui.setlistSelectedId = selectedSetlist.id;
  h += '<div class="master-detail-shell' + (desktopMaster ? ' is-desktop' : '') + '"><div class="master-list"><div class="collection-grid collection-list songs-list setlists-list">';
  list.forEach(function (sl, i) {
    const ev = sl.eventId ? evById(sl.eventId) : null, n = (sl.items || []).length;
    h += '<article class="song-card rise" style="animation-delay:' + Math.min(i * 30, 200) + 'ms" data-act="open-setlist" data-id="' + sl.id + '" role="link" tabindex="0" aria-label="Открыть сет-лист ' + esc(sl.name) + '">' +
      '<div class="song-top"><div class="key-badge" aria-hidden="true">' + n + '</div>' +
      '<div class="song-title-wrap"><h3 class="song-name">' + esc(sl.name) + '</h3></div>' +
      '<span class="card-chevron" aria-hidden="true">›</span></div>' +
      '<div class="song-acts setlist-quick-actions">' +
      '<button class="icon-btn setlist-quick-action" type="button" data-act="print-setlist" data-id="' + sl.id + '" aria-label="Печать сет-листа" title="Печать">' + ic('print', 16) + '</button>' +
      '<button class="icon-btn setlist-quick-action" type="button" data-act="dup-setlist" data-id="' + sl.id + '" aria-label="Дублировать сет-лист" title="Дублировать">' + ic('copy', 16) + '</button>' +
      '<button class="icon-btn danger setlist-quick-action" type="button" data-act="sl-del" data-id="' + sl.id + '" aria-label="Удалить сет-лист" title="Удалить">' + ic('trash', 16) + '</button>' +
      '<button class="btn btn-primary btn-sm setlist-scene setlist-quick-action" type="button" data-act="scene-setlist" data-id="' + sl.id + '" aria-label="Открыть на сцене" title="Открыть на сцене">' + ic('monitor', 15) + '<span class="btn-txt">Открыть на сцене</span></button></div></article>';
  });
  h += '</div></div>';
  if (selectedSetlist) h += '<aside class="master-detail-panel" aria-label="Выбранный сет-лист">' + vSetlist(selectedSetlist.id) + '</aside>';
  return h + '</div>';
}
function vSetlist(id) {
  const sl = slById(id);
  if (!sl) return '<div class="card">' + stateHTML('err', 'Сет-лист не найден', 'Возможно, он был удалён.', '<a class="btn btn-primary" href="#/setlists">Вернуться к сет-листам</a>') + '</div>';

  const linkedEvent = sl.eventId ? evById(sl.eventId) : state.events.find(e => e.setlistId === sl.id && (e.status || 'upcoming') === 'upcoming');
  const count = (sl.items || []).length;
  const duration = setlistDur(sl);

  let h = '<div class="split setlist-detail"><div class="stack">';

  /* Primary detail card follows the same hierarchy as the song detail page:
     title/actions -> useful metadata -> main working content -> summary actions. */
  h += '<section class="card rise"><div class="card-h"><div style="min-width:0"><h2 style="font-size:var(--fs-h3);overflow-wrap:anywhere">' + esc(sl.name) + '</h2>' +
    '<div class="sub">' + count + ' ' + plural(count, 'песня', 'песни', 'песен') + (duration ? ' · ' + fmtDur(duration) : '') + '</div>' +
    (linkedEvent ? '<div class="setlist-my-position">' + renderMyPositionBadge(linkedEvent, {compact:false}) + '</div>' : '') +
    '</div><div class="row setlist-detail-actions">' +
    '<button class="icon-btn" type="button" data-act="sl-rename" data-id="' + sl.id + '" aria-label="Название и заметки" title="Редактировать">' + ic('edit', 16) + '</button>' +
    '<button class="icon-btn danger" type="button" data-act="sl-del" data-id="' + sl.id + '" aria-label="Удалить сет-лист" title="Удалить сет-лист">' + ic('trash', 16) + '</button>' +
    '<button class="icon-btn" type="button" data-act="print-setlist" data-id="' + sl.id + '" aria-label="Печать сет-листа" title="Печать">' + ic('print', 16) + '</button>' +
    '<button class="icon-btn" type="button" data-act="dup-setlist" data-id="' + sl.id + '" aria-label="Дублировать сет-лист" title="Дублировать">' + ic('copy', 16) + '</button>' +
    '</div></div>' +

    '<div class="row mt" style="gap:6px">' +
    '<span class="badge b-brand num">' + count + ' ' + plural(count, 'песня', 'песни', 'песен') + '</span>' +
    '<span class="badge b-muted num">' + ic('clock', 11) + fmtDur(duration) + '</span>' +
    (linkedEvent ? '<span class="badge b-muted">' + ic('calendar', 11) + esc(linkedEvent.title) + '</span>' : '') +
    '</div>' +
    '<div class="row mt setlist-scene-action"><button class="btn btn-primary btn-sm" type="button" data-act="scene-setlist" data-id="' + sl.id + '">' + ic('monitor', 16) + 'Открыть на сцене</button></div>' +
    '<div class="card-h mt" style="align-items:end"><div><h3>Репертуар</h3><div class="sub">Ищите песню и выбирайте её из списка</div></div>' +
    '<span class="cap num">' + count + ' ' + plural(count, 'трек', 'трека', 'треков') + '</span></div>' +
    '<div class="setlist-library-search mt"><div class="tb-search">' + ic('search', 17) +
    '<label class="sr-only" for="libQ">Поиск песни в репертуаре</label>' +
    '<input id="libQ" class="bare-input" type="search" autocomplete="off" placeholder="Найти песню в репертуаре…" value="' + esc(ui.libQuery) + '"></div>' +
    '<div class="setlist-song-suggestions" id="setlistSongSuggestions" role="listbox" aria-label="Найденные песни">';
 
  const q = String(ui.libQuery || '').toLowerCase().trim();
  if (q) {
    const matches = state.songs.filter(s => ((s.title || '') + ' ' + (s.artist || '')).toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru')).slice(0, 8);
    if (!matches.length) h += '<div class="setlist-song-empty">Ничего не найдено</div>';
    matches.forEach(function (song) {
      const alreadyAdded = (sl.items || []).some(item => item.songId === song.id);
      const meta = [song.artist || '', song.key || ''].filter(Boolean).join(' · ');
      h += '<button class="setlist-song-suggestion" type="button" role="option" data-act="sl-search-add" data-sl="' + sl.id + '" data-song="' + song.id + '"' +
        (alreadyAdded ? ' disabled aria-disabled="true"' : '') + '><span class="setlist-song-suggestion-main"><b>' + esc(song.title) + '</b>' +
        (meta ? '<small>' + esc(meta) + '</small>' : '') + '</span><span class="setlist-song-suggestion-action">' +
        (alreadyAdded ? 'Уже в программе' : ic('plus', 15) + ' Добавить') + '</span></button>';
    });
  }
  h += '</div></div><div class="dropzone mt" id="dropZone">';


  if (!count) {
    h += stateHTML('empty', 'Программа пуста', 'Найдите песню по названию в поле поиска выше.');
  } else {
    (sl.items || []).forEach(function (it, i) {
      const s = songById(it.songId);
      if (!s) {
        h += '<div class="sl-item sl-item-missing"><div class="sl-num">' + (i + 1) + '</div><div class="sl-info"><div class="sl-name t-muted">Песня удалена из репертуара</div></div>' +
          '<button class="icon-btn" type="button" data-act="sl-item-del" data-sl="' + sl.id + '" data-item="' + it.id + '" aria-label="Убрать">' + ic('x', 16) + '</button></div>';
        return;
      }
      h += '<div class="sl-item sl-item-song" draggable="true" data-item="' + it.id + '">' +
        '<span class="grip" title="Перетащить" aria-hidden="true">' + ic('grip', 18) + '</span>' +
        '<div class="sl-num" aria-hidden="true">' + (i + 1) + '</div>' +
        '<div class="sl-info" data-act="open-song" data-id="' + s.id + '" role="link" tabindex="0" style="cursor:pointer">' +
        '<div class="sl-name">' + esc(s.title) + '</div>' +
        '<div class="sl-sub"><span class="num">' + esc(finalKey(s, it.shift)) + (it.shift ? ' <i class="transpose-shift">(' + (it.shift > 0 ? '+' : '') + it.shift + ')</i>' : '') + '</span>' +
        (s.bpm ? '<span class="num">' + s.bpm + ' BPM</span>' : '') +
        (s.duration ? '<span class="num">' + fmtDur(s.duration) + '</span>' : '') +
        (it.note ? '<span>' + esc(it.note) + '</span>' : '') + '</div></div>' +
        '<div class="sl-row-actions" role="group" aria-label="Управление песней в сет-листе">' +
        '<div class="mini-stepper" role="group" aria-label="Транспонирование">' +
        '<button type="button" data-act="sl-shift" data-sl="' + sl.id + '" data-item="' + it.id + '" data-d="-1" aria-label="Опустить">♭</button>' +
        '<span aria-live="polite">' + (it.shift > 0 ? '+' : '') + (it.shift || 0) + '</span>' +
        '<button type="button" data-act="sl-shift" data-sl="' + sl.id + '" data-item="' + it.id + '" data-d="1" aria-label="Поднять">♯</button></div>' +
        '<button class="icon-btn" type="button" data-act="sl-item-move" data-sl="' + sl.id + '" data-item="' + it.id + '" data-d="-1" aria-label="Переместить выше"' + (i === 0 ? ' disabled' : '') + '>' + ic('up', 16) + '</button>' +
        '<button class="icon-btn" type="button" data-act="sl-item-move" data-sl="' + sl.id + '" data-item="' + it.id + '" data-d="1" aria-label="Переместить ниже"' + (i === sl.items.length - 1 ? ' disabled' : '') + '>' + ic('down', 16) + '</button>' +
        '<button class="icon-btn" type="button" data-act="sl-item-note" data-sl="' + sl.id + '" data-item="' + it.id + '" aria-label="Заметка к песне">' + ic('edit', 16) + '</button>' +
        '<button class="icon-btn" type="button" data-act="sl-item-del" data-sl="' + sl.id + '" data-item="' + it.id + '" aria-label="Убрать из программы">' + ic('x', 16) + '</button></div></div>';
    });
  }

  h += '</div><div class="row mt" style="gap:var(--s3)">' +
    '<span class="badge b-brand num">' + count + ' ' + plural(count, 'песня', 'песни', 'песен') + '</span>' +
    '<span class="badge b-muted num">' + ic('clock', 11) + fmtDur(duration) + '</span>' +
    '<button class="btn btn-danger btn-sm" type="button" data-act="sl-clear" data-id="' + sl.id + '">Очистить программу</button>' +
    '</div></section>';

  return h + '</div></div>';
}
function bindDnD(slId) {
  const zone = $('#dropZone'); if (!zone) return;
  let dragItem = null;
  const idxOf = iid => { const sl = slById(slId); return sl ? (sl.items || []).findIndex(x => x.id === iid) : -1; };
  const dataOf = e => {
    let t = ''; try { t = e.dataTransfer.getData('text/plain'); } catch (err) { }
    if (t && t.indexOf('item:') === 0) return { item: t.slice(5) };
    if (dragItem) return { item: dragItem };
    return {};
  };
  $$('.sl-item[draggable]', zone).forEach(function (el) {
    el.addEventListener('dragstart', function (e) { dragItem = el.getAttribute('data-item'); el.classList.add('drag'); try { e.dataTransfer.setData('text/plain', 'item:' + dragItem); } catch (err) { } e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', function () { el.classList.remove('drag'); dragItem = null; $$('.sl-item', zone).forEach(x => x.classList.remove('over')); });
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', function () { el.classList.remove('over'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault(); el.classList.remove('over');
      const src = dataOf(e), at = idxOf(el.getAttribute('data-item'));
      if (src.item && src.item !== el.getAttribute('data-item')) moveItem(slId, src.item, at);
    });
  });
  zone.addEventListener('dragover', function (e) { if (!dragItem) return; e.preventDefault(); zone.classList.add('hot'); });
  zone.addEventListener('dragleave', function (e) { if (e.target === zone) zone.classList.remove('hot'); });
  zone.addEventListener('drop', function (e) {
    const src = dataOf(e);
    if (!src.item) return;
    e.preventDefault(); zone.classList.remove('hot');
    moveItem(slId, src.item, -1);
  });
}
function addItem(slId, songId, at) {
  const sl = slById(slId); if (!sl) return;
  sl.items = sl.items || [];
  const item = { id: uid('i'), songId: songId, shift: 0, note: '' };
  if (at >= 0 && at <= sl.items.length) sl.items.splice(at, 0, item); else sl.items.push(item);
  sl.updatedAt = new Date().toISOString(); save(); render();
}
function moveItem(slId, itemId, at) {
  const sl = slById(slId); if (!sl) return;
  const arr = sl.items || [], i = arr.findIndex(x => x.id === itemId);
  if (i < 0) return;
  const it = arr.splice(i, 1)[0];
  if (at < 0 || at > arr.length) arr.push(it); else arr.splice(at, 0, it);
  sl.updatedAt = new Date().toISOString(); save(); render();
}

/* ═══ 14. SETTINGS ═══ */
function vSettings() {
  const s = state.settings, p = state.profile;
  const settingsTab = ui.settingsTab || 'profile';
  let h = '<div class="settings-shell" data-settings-tab="' + esc(settingsTab) + '">' + '<div class="settings-tabs" role="tablist" aria-label="Разделы настроек">' + [['profile','Профиль'],['group','Группа'],['interface','Интерфейс'],['data','Данные'],['app','Приложение']].map(t => '<button type="button" class="settings-tab' + (settingsTab === t[0] ? ' on' : '') + '" data-act="settings-tab" data-v="' + t[0] + '" role="tab" aria-selected="' + (settingsTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div><div class="settings-tab-content">';
  h += '<section class="card rise settings-card" data-settings-panel="profile"><div class="card-h"><div><h2>Профиль и роль</h2></div></div>' +
    '<div class="profile-settings-grid">' +
    '<div class="profile-settings-main">' +
      '<div class="field"><label class="field-label" for="setName">Ваше имя</label><input class="input" id="setName" maxlength="50" value="' + esc(p.name) + '" placeholder="Имя и фамилия"></div>' +
      '<div class="field"><label class="field-label" for="setBand">Название группы</label><input class="input" id="setBand" maxlength="50" value="' + esc(p.bandName || '') + '" placeholder="Название группы"></div>' +
    '</div>' +
    '<div class="profile-settings-side">' +
      '<div class="profile-role-box">' +
        '<div class="profile-role-identity"><span class="profile-role-avatar">' + esc((p.name || '?').charAt(0).toUpperCase()) + '</span><div><strong>' + esc(p.name || 'Имя не указано') + '</strong></div></div>' +
        '<span class="field-label">Роли и инструменты</span>' +
        '<details class="profile-roles-dropdown">' +
          '<summary><span class="profile-roles-selected">' + (myRoles().length ? myRoles().map(k => '<span class="profile-role-selected-chip">' + esc(roleLabel(k)) + '</span>').join('') : '<span class="profile-roles-placeholder">Выберите роли</span>') + '</span><span class="profile-roles-chevron" aria-hidden="true">' + ic('chevronDown', 16) + '</span></summary>' +
          '<div class="profile-role-options">' +
            ROLES.map(r => '<button class="profile-role-option' + (myRoles().indexOf(r.k) >= 0 ? ' on' : '') + '" type="button" data-act="role-set" data-v="' + r.k + '" aria-pressed="' + (myRoles().indexOf(r.k) >= 0) + '"><span class="profile-role-option-check">' + (myRoles().indexOf(r.k) >= 0 ? ic('check', 14) : '') + '</span><span class="profile-role-option-icon">' + ic(r.icon, 14) + '</span><span>' + esc(r.label) + '</span></button>').join('') +
          '</div>' +
        '</details>' +
      '</div>' +
      '<div class="profile-account-box"><div class="card-h"><div><h3>Аккаунт</h3></div></div>' +
        '<div class="account-settings"><div class="account-settings-row"><div><span class="field-label">Электронная почта</span><strong>' + esc(String(window.BandPlanCloud?.user?.()?.email || '').trim() || 'Почта не указана') + '</strong></div><button class="btn btn-danger" type="button" data-act="account-logout">' + ic('x',16) + '<span>Выйти из аккаунта</span></button></div></div>' +
        '<div class="profile-account-danger"><span>Удаление аккаунта необратимо.</span><button class="btn btn-danger-solid" type="button" data-act="account-delete">' + ic('userX',16) + 'Удалить аккаунт</button></div>' +
      '</div>' +
    '</div></div>' +
    '</section>';

  h += '<section class="card rise settings-card" data-settings-panel="group" style="animation-delay:.04s"><div class="card-h"><div><h2>Состав группы</h2><div class="sub">' + state.members.length + ' ' + plural(state.members.length, 'участник', 'участника', 'участников') + '</div></div>' +
    '</div>';
  h += '<div class="group-settings-controls">' +
    '<div class="profile-actions"><button class="btn btn-secondary" type="button" data-act="invite">' + ic('link', 16) + 'Код приглашения</button><button class="btn btn-secondary" type="button" data-act="group-join">' + ic('users', 16) + 'Вступить в группу</button></div>' +
    '</div>';
  if (!state.members.length) h += stateHTML('empty', 'Состав пока пуст', 'После приглашения участники появятся здесь автоматически. Имя и роли каждого участника управляются его собственным аккаунтом.');
  state.members.forEach(function (m) {
    const summary = memberParticipationSummary(m);
    const statusTitle = summary.event ? participantStatusLabel(summary.status) + ' · ' + summary.event.title : participantStatusLabel(summary.status);
    h += '<div class="memb-row" data-member-key="' + esc(String(m.accountId || m.id || '')) + '">' +
      '<div class="avatar" aria-hidden="true">' + esc((m.name || '?').charAt(0).toUpperCase()) + '</div>' +
      '<div class="grow"><div style="font-weight:600;font-size:var(--fs-body-s)">' + esc(m.name) + (window.BandPlanCloud?.user?.()?.id && String(m.accountId || m.id) === String(window.BandPlanCloud.user().id) ? ' <span class="member-you">Вы</span>' : '') + '</div>' +
      '<div class="t-xs t-muted">' + esc(rolesLabel(rolesOf(m))) + (m.note ? ' · ' + esc(m.note) : '') + '</div></div>' +
      '<div class="member-status-wrap">' +
        '<span class="member-event-context">' + (summary.event ? esc(summary.event.title || 'Событие') + ' · ' + esc(pdate(summary.event.date)) : 'Нет ближайших событий') + '</span></div>' +
      (!m.accountId ? '<span class="member-actions"><button class="icon-btn" type="button" data-act="mem-edit" data-id="' + m.id + '" aria-label="Изменить участника">' + ic('edit', 15) + '</button><button class="icon-btn" type="button" data-act="mem-del" data-id="' + m.id + '" aria-label="Удалить участника">' + ic('trash', 15) + '</button></span>' : '') +
      '</div>';
  });
  if (window.BandPlanCloud?.user?.() && state.members.some(m => m.accountId === window.BandPlanCloud.user().id)) {
    h += '<div class="settings-member-footer"><button class="btn btn-danger settings-leave" type="button" data-act="group-leave">' + ic('x', 16) + '<span>Выйти из группы</span></button></div>';
  }
  h += '</section>';

  h += '<section class="card rise settings-card" data-settings-panel="interface" style="animation-delay:.07s;grid-column:1/-1"><div class="card-h"><div><h2>' + ic('palette', 18) + ' Оформление интерфейса</h2></div></div>' +
    '<div class="split2"><div>' +
    '<div class="field settings-inline-field"><span class="field-label">Тема</span><div class="seg settings-one-line">' +
    THEMES.map(t => '<button type="button" data-act="theme-set" data-v="' + t.id + '" class="' + (s.theme === t.id ? 'on' : '') + '" aria-pressed="' + (s.theme === t.id) + '" data-accent="1">' + ic(t.icon, 14) + esc(t.label) + '</button>').join('') + '</div></div>' +
    '<div class="field settings-inline-field"><span class="field-label">Акцентный цвет</span><details class="accent-dropdown">' +
    '<summary><span class="accent-dropdown-current"><span class="accent-dot" data-preset="' + esc(s.accentPreset || 'custom') + '" aria-hidden="true"></span><span>' + esc(ACCENT_LABELS[s.accentPreset] || 'Свой цвет') + '</span></span><span class="accent-dropdown-chevron">' + ic('chevronDown', 15) + '</span></summary>' +
    '<div class="accent-dropdown-menu">' +
    ACCENTS.map(a => '<button class="accent-dropdown-option' + (s.accentPreset === a ? ' on' : '') + '" type="button" data-act="accent-set" data-v="' + a + '" aria-pressed="' + (s.accentPreset === a) + '"><span class="accent-dot" data-preset="' + a + '" aria-hidden="true"></span><span>' + esc(ACCENT_LABELS[a]) + '</span>' + (s.accentPreset === a ? ic('check', 14) : '') + '</button>').join('') +
    '<label class="accent-dropdown-option accent-dropdown-custom"><span class="accent-dot accent-dot-custom" data-preset="custom" aria-hidden="true"></span><span>Свой цвет</span><input type="color" id="accentCustom" value="' + esc(s.accent) + '" aria-label="Выбрать свой цвет"></label><button class="accent-dropdown-option accent-dropdown-reset" type="button" data-act="accent-reset">Сбросить</button>' +
    '</div></details></div>' +
    '<div class="field settings-inline-field"><span class="field-label">Запись аккордов</span><div class="seg settings-one-line">' +
    [['auto', 'Как в оригинале'], ['sharp', 'Диезы (C#)'], ['flat', 'Бемоли (Db)']].map(o => '<button type="button" data-act="notation-set" data-v="' + o[0] + '" class="' + (s.notation === o[0] ? 'on' : '') + '" data-accent="1">' + o[1] + '</button>').join('') + '</div></div>' +
    '<div class="f2"><div class="field"><label class="field-label" for="setWeekStart">Первый день недели</label><select class="select" id="setWeekStart"><option value="1"' + (s.weekStart !== 0 ? ' selected' : '') + '>Понедельник</option><option value="0"' + (s.weekStart === 0 ? ' selected' : '') + '>Воскресенье</option></select></div>' +
    '<div class="field"><label class="field-label" for="setDefView">Вид календаря</label><select class="select" id="setDefView">' + [['month', 'Месяц'], ['week', 'Неделя'], ['day', 'День']].map(o => '<option value="' + o[0] + '"' + (s.calView === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div></div>' +
    '</div><div>' +
    '<div class="field"><label class="field-label" for="lsRange">Шрифт текста песни: <b class="num" id="lsVal">' + s.lyricsSize + 'px</b></label><input class="range" id="lsRange" type="range" min="12" max="26" step="1" value="' + s.lyricsSize + '"></div>' +
    '<div class="field"><label class="field-label" for="scRange">Шрифт на сцене: <b class="num" id="scValS">' + s.sceneSize + 'px</b></label><input class="range" id="scRange" type="range" min="16" max="52" step="1" value="' + s.sceneSize + '"></div>' +
    '<div class="field"><label class="field-label" for="spRange">Скорость автопрокрутки: <b class="num" id="spValS">' + s.sceneSpeed + ' px/с</b></label><input class="range" id="spRange" type="range" min="10" max="200" step="5" value="' + s.sceneSpeed + '"></div>' +
    '<div class="field"><span class="field-label">Поведение</span><div class="settings-switches">' +
    '<button class="switch-control" type="button" data-act="toggle-auto" role="switch" aria-checked="' + !!s.autoscroll + '"><span class="switch-track"><i></i></span><span>Автопрокрутка на сцене</span></button>' +
    '<button class="switch-control" type="button" data-act="toggle-reduced" role="switch" aria-checked="' + !!s.reduced + '"><span class="switch-track"><i></i></span><span>Меньше анимации</span></button>' +
    '<button class="switch-control" type="button" data-act="toggle-chords" role="switch" aria-checked="' + (s.showChords !== false) + '"><span class="switch-track"><i></i></span><span>Показывать аккорды</span></button></div></div>' +
    '<div class="field settings-inline-field"><span class="field-label">Уведомления о действиях</span><div class="seg settings-one-line">' + [['off', 'Выключены'], ['important', 'Только важные'], ['all', 'Все действия']].map(o => '<button type="button" data-act="toast-mode" data-v="' + o[0] + '" class="' + ((s.toastMode || 'off') === o[0] ? 'on' : '') + '" aria-pressed="' + ((s.toastMode || 'off') === o[0]) + '" data-accent="1">' + o[1] + '</button>').join('') + '</div></div></div></div></section>';

  if (!isStandalone()) h += '<section class="card rise settings-card" data-settings-panel="app"><div class="card-h"><div><h2>Установка на устройство</h2></div></div><button class="btn btn-primary btn-block" type="button" id="pwaBtn" data-act="pwa-install">' + ic('dl', 16) + 'Установить приложение</button></section>';
  h += '<section class="card rise settings-card" data-settings-panel="data" style="animation-delay:.1s"><div class="card-h"><div><h2>Данные</h2></div></div>' +
    '<div class="data-stats-grid">' +
      '<div class="data-stat"><span class="data-stat-icon">' + ic('music', 17) + '</span><strong>' + state.songs.length + '</strong><span>Песен</span></div>' +
      '<div class="data-stat"><span class="data-stat-icon">' + ic('calendar', 17) + '</span><strong>' + state.events.length + '</strong><span>Событий</span></div>' +
      '<div class="data-stat"><span class="data-stat-icon">' + ic('list', 17) + '</span><strong>' + state.setlists.length + '</strong><span>Сет-листов</span></div>' +
      '<div class="data-stat"><span class="data-stat-icon">' + ic('users', 17) + '</span><strong>' + state.members.length + '</strong><span>Участников</span></div>' +
    '</div>' +
    '<div class="data-actions">' +
      '<div class="data-action-group"><div class="data-action-title">Резервная копия</div><div class="data-action-buttons"><button class="btn btn-secondary" type="button" data-act="export">' + ic('dl', 16) + 'Скачать JSON</button><button class="btn btn-secondary" type="button" data-act="import">' + ic('ul', 16) + 'Загрузить файл</button></div><div class="data-meta">Объём: <span class="num">' + kb() + ' КБ</span> · последняя копия: ' + esc(s.lastBackup ? pdate(s.lastBackup) : 'не создавалась') + '</div></div>' +
      '<div class="data-action-group offline-song-settings"><div class="data-action-title">Песни ближайших событий офлайн</div>' +
        '<div class="data-meta">Песни сет-листов сохраняются на устройстве для работы без сети. Очистка не затрагивает облако.</div>' +
        '<div class="offline-song-settings-grid">' +
          '<label class="check"><input type="checkbox" id="offlineSongAuto" ' + (s.offlineSongsAutoSave !== false ? 'checked' : '') + '><span>Автосохранение</span></label>' +
          '<label class="field compact"><span class="field-label">Окно, дней</span><input class="input" id="offlineSongDays" type="number" min="1" max="90" inputmode="numeric" value="' + esc(String(s.offlineSongsDays || 30)) + '"></label>' +
          '<label class="field compact"><span class="field-label">Ближайших событий</span><input class="input" id="offlineSongCount" type="number" min="1" max="10" inputmode="numeric" value="' + esc(String(s.offlineSongsNearestCount || 3)) + '"></label>' +
          '<label class="check"><input type="checkbox" id="offlineSongMaybe" ' + (s.offlineSongsSaveMaybe === true ? 'checked' : '') + '><span>Сохранять при «Под вопросом»</span></label>' +
        '</div>' +
        '<div class="offline-song-storage"><span>Занято на устройстве: <strong id="offlineSongBytes">—</strong></span><span>По умолчанию: 3 события / 30 дней</span></div>' +
        '<div class="data-action-buttons"><button class="btn btn-secondary" type="button" data-act="offline-song-refresh-all">' + ic('refresh', 16) + 'Обновить сейчас</button><button class="btn btn-danger" type="button" data-act="offline-song-clear-all">' + ic('trash', 16) + 'Очистить всё</button></div>' +
      '</div>' +
      '<div class="data-action-danger"><div><strong>Удаление данных</strong><span>Удаляет данные аккаунта и доступ к BandPlan без возможности восстановления.</span></div><div class="data-action-buttons"><button class="btn btn-danger" type="button" data-act="wipe">' + ic('trash', 16) + 'Удалить данные</button></div></div>' +
    '</div></section>';

  h += '<section class="card rise settings-card" data-settings-panel="app" style="animation-delay:.13s"><div class="card-h"><div><h2>О BandPlan</h2></div></div>' +
    '' +
    '<div class="row mt" style="gap:6px;flex-wrap:wrap"><span class="badge b-muted">offline-first</span><span class="badge b-muted">localStorage</span><span class="badge b-muted">печать / PDF</span><span class="badge b-muted">wake lock</span></div>' +
    '<hr class="divider"><span class="field-label">Горячие клавиши</span>' +
    '<div class="row mt-s" style="gap:var(--s2)"><kbd class="badge b-muted mono">Ctrl K</kbd></div>' +
    '<div class="row mt-s" style="gap:var(--s2)"><kbd class="badge b-muted mono">N</kbd><kbd class="badge b-muted mono">E</kbd><kbd class="badge b-muted mono">S</kbd></div>' +
    '<div class="row mt-s" style="gap:var(--s2)"><kbd class="badge b-muted mono">← →</kbd></div>' +
    '<div class="row mt-s" style="gap:var(--s2)"><kbd class="badge b-muted mono">Space</kbd></div>' +
    '<div class="row mt-s" style="gap:var(--s2)"><kbd class="badge b-muted mono">Esc</kbd></div></section>';
  return h + '</div></div>';
}
function mini(v, l) { return '<div class="stat-mini"><div class="v">' + v + '</div><div class="l">' + esc(l) + '</div></div>'; }
function kb() { try { return (new Blob([JSON.stringify(state)]).size / 1024).toFixed(1); } catch (e) { return '0'; } }
function bindSettings() {
  const on = (id, ev, fn) => { const e = $('#' + id); if (e) e.addEventListener(ev, fn); };
  on('setName', 'input', debounce(e => { state.profile.name = e.target.value; save(); buildChrome(); }));
  on('setBand', 'input', debounce(e => { state.profile.bandName = e.target.value || 'Моя группа'; save(); buildChrome(); }));
  on('lsRange', 'input', e => { state.settings.lyricsSize = +e.target.value; $('#lsVal').textContent = e.target.value + 'px'; document.documentElement.style.setProperty('--lsize', e.target.value + 'px'); save(); });
  on('scRange', 'input', e => { state.settings.sceneSize = +e.target.value; $('#scValS').textContent = e.target.value + 'px'; save(); });
  on('spRange', 'input', e => { state.settings.sceneSpeed = +e.target.value; $('#spValS').textContent = e.target.value + ' px/с'; scene.speed = +e.target.value; save(); });
  on('accentCustom', 'input', e => applyAccent(e.target.value));
  on('setWeekStart', 'change', e => { state.settings.weekStart = +e.target.value; save(); render(); });
  on('setDefView', 'change', e => { state.settings.calView = e.target.value; ui.calView = e.target.value; save(); render(); });
  on('offlineSongAuto', 'change', e => { state.settings.offlineSongsAutoSave = !!e.target.checked; save(); render(); });
  on('offlineSongMaybe', 'change', e => { state.settings.offlineSongsSaveMaybe = !!e.target.checked; save(); render(); });
  on('offlineSongDays', 'change', e => { state.settings.offlineSongsDays = clamp(+e.target.value || 30, 1, 90); save(); render(); });
  on('offlineSongCount', 'change', e => { state.settings.offlineSongsNearestCount = clamp(+e.target.value || 3, 1, 10); save(); render(); });
}
async function refreshOfflineSettingsUI() {
  const node=$('#offlineSongBytes');
  if(!node || !window.BandPlanCloud?.offlineEventSongsBytes)return;
  try { node.textContent=offlineSongsStorageText(await window.BandPlanCloud.offlineEventSongsBytes()); } catch(_) { node.textContent='—'; }
}

/* ═══ 15. FORM MODALS ═══ */
function eventInfoModal(evId, occurrenceDate) {
  const ev = evId ? evById(evId) : null;
  if (!ev) return;
  const t = evType(ev.type), date = occurrenceDate || ev.date;
  const sl = ev.setlistId ? slById(ev.setlistId) : null;
  const members = (ev.memberIds || []).map(memById).filter(Boolean);
  const my = eventStatusFor(ev) || '';
  const myLabel = participantStatusLabel(my);
  const participants = members.length ? members.map(m => {
    const ps = participantStatusFor(ev, m);
    return '<div class="event-info-person" data-participant-key="' + esc(String(m.accountId || m.id || '')) + '">' +
      '<div class="event-info-person-main">' +
        '<span class="event-info-avatar">' + esc(m.name.charAt(0).toUpperCase()) +
          '<span class="participation-dot participation-dot-avatar status-' + (ps || 'unset') + '" title="' + esc(participantStatusLabel(ps)) + '" aria-label="' + esc(participantStatusLabel(ps)) + '"></span>' +
        '</span>' +
        '<div class="event-info-person-copy"><strong>' + esc(m.name) + '</strong><span>' + esc(rolesLabel(rolesOf(m))) + '</span></div>' +
      '</div>' +
      '<span class="participation-label status-' + (ps || 'unset') + '">' + esc(participantStatusLabel(ps)) + '</span>' +
    '</div>';
  }).join('') : '<div class="day-modal-empty">Участники не добавлены</div>';
  const body =
    '<div class="event-info-card">' +
      '<div class="event-info-top">' +
        '<span class="badge ' + t.cls + '">' + ic(t.ic, 12) + esc(t.label) + '</span>' +
        (ev.status === 'done' ? '<span class="badge b-ok">' + ic('check', 11) + 'Проведено</span>' : '') +
        (ev.repeat && ev.repeat !== 'none' ? '<span class="badge b-muted">' + ic('repeat', 11) + esc(REPEATS[ev.repeat]) + '</span>' : '') +
      '</div>' +
      '<h4 class="event-info-title">' + esc(ev.title) + '</h4>' +
      '<div class="event-info-meta-grid">' +
        '<div><span class="event-info-label">Дата</span><strong>' + esc(pdateFull(date)) + '</strong></div>' +
        (ev.time ? '<div><span class="event-info-label">Время</span><strong>' + esc(ev.time) + (ev.end ? '–' + esc(ev.end) : '') + '</strong></div>' : '') +
        (ev.location ? '<div><span class="event-info-label">Место</span><strong>' + esc(ev.location) + '</strong></div>' : '') +
        (sl ? '<div><span class="event-info-label">Сет-лист</span><strong>' + esc(sl.name) + '</strong></div>' : '') +
      '</div>' +
      (ev.notes ? '<div class="event-info-notes"><span class="event-info-label">Заметки</span><p>' + esc(ev.notes).replace(/\n/g, '<br>') + '</p></div>' : '') +
      (function(){ const s=participationSummary(ev); return '<div class="event-participation-summary" data-event-participation-summary="' + esc(String(ev.id)) + '">' +
        '<span class="status-yes">' + s.yes + ' · Участвуют</span><span class="status-maybe">' + s.maybe + ' · Под вопросом</span><span class="status-no">' + s.no + ' · Не участвуют</span><span class="status-unset">' + s.unset + ' · Не ответили</span></div>'; })() +
      '<div class="offline-event-songs" data-offline-event-songs="' + esc(String(ev.id)) + '" hidden></div>' +
      '<div class="event-info-section"><div class="event-info-section-head"><strong>Участники</strong><span>' + members.length + '</span></div><div class="event-info-people">' + participants + '</div></div>' +
      '<div class="event-info-section event-info-my"><div class="event-info-section-head"><strong>Ваше участие</strong><span class="participation-label status-' + (my || 'unset') + '">' + esc(myLabel) + '</span>' + (myRoleLabel() ? '<span class="my-position-role event-info-role">' + esc(myRoleLabel()) + '</span>' : '') + '</div>' +
        '<div data-event-switch="' + esc(String(ev.id)) + '">' + renderParticipationSwitch(ev, {size:'lg', variant:'card'}) + '</div></div>' +
    '</div>';
  openModal({
    title: 'Событие',
    sub: '',
    size: 'lg',
    guard: false,
    body: body,
    footer:
      (sl ? '<button class="btn btn-secondary" type="button" data-act="scene-setlist" data-id="' + esc(sl.id) + '">' + ic('monitor', 16) + 'Сцена</button>' : '') +
      '<button class="btn btn-secondary" type="button" data-act="modal-close">Закрыть</button>' +
      '<button class="btn btn-primary" type="button" data-act="event-edit" data-id="' + esc(ev.id) + '">' + ic('edit', 16) + 'Изменить</button>'
  });
  refreshOfflineEventInfo(ev.id);
}
function eventModal(evId, date) {
  const ev = evId ? evById(evId) : null;
  const d = ev || { type: 'gig', title: '', date: date || ui.selDate || today(), time: '19:00', end: '', location: '', notes: '', status: 'upcoming', repeat: 'none', repeatUntil: '', setlistId: '', memberIds: state.members.map(m => m.id), except: [] };
  const body =
    '<div class="field"><span class="field-label">Тип события</span><div class="seg" id="evTypeSeg" style="flex-wrap:wrap">' +
    Object.keys(EV_TYPES).map(k => '<button type="button" data-t="' + k + '" class="' + (d.type === k ? 'on' : '') + '" data-accent="1">' + ic(EV_TYPES[k].ic, 14) + esc(EV_TYPES[k].label) + '</button>').join('') + '</div></div>' +
    '<div class="field"><label class="field-label" for="f_title">Название *</label><input class="input" id="f_title" maxlength="80" value="' + esc(d.title) + '" placeholder="Например: Концерт в «Портах»"><span class="err"></span></div>' +
    '<div class="f2"><div class="field"><label class="field-label" for="f_date">Дата *</label><input class="input" id="f_date" type="date" value="' + esc(d.date) + '"><span class="err"></span></div>' +
    '<div class="field"><label class="field-label" for="f_time">Начало</label><input class="input" id="f_time" type="time" value="' + esc(d.time || '') + '"></div></div>' +
    '<div class="f2"><div class="field"><label class="field-label" for="f_end">Окончание</label><input class="input" id="f_end" type="time" value="' + esc(d.end || '') + '"><span class="hint">Необязательно</span><span class="err"></span></div>' +
    '<div class="field"><label class="field-label" for="f_loc">Место</label><input class="input" id="f_loc" maxlength="120" value="' + esc(d.location || '') + '" placeholder="Клуб, студия, адрес"></div></div>' +
    '<div class="f2"><div class="field"><label class="field-label" for="f_sl">Сет-лист</label><select class="select" id="f_sl"><option value="">— не выбран —</option>' +
    state.setlists.map(s => '<option value="' + s.id + '"' + (d.setlistId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="f_status">Статус</label><select class="select" id="f_status">' +
    [['upcoming', 'Запланировано'], ['done', 'Проведено'], ['cancelled', 'Отменено']].map(o => '<option value="' + o[0] + '"' + (d.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div></div>' +
    '<div class="f2"><div class="field"><label class="field-label" for="f_repeat">Повторение</label><select class="select" id="f_repeat">' +
    Object.keys(REPEATS).map(k => '<option value="' + k + '"' + (d.repeat === k ? ' selected' : '') + '>' + REPEATS[k] + '</option>').join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="f_until">Повторять до</label><input class="input" id="f_until" type="date" value="' + esc(d.repeatUntil || '') + '"><span class="err"></span></div></div>' +
    '<div class="field"><span class="field-label">Участники события</span><div class="event-participants" id="f_participants">' +
    (state.members.length ? state.members.map(m => {
      const included = (d.memberIds || []).indexOf(m.id) >= 0, ps = participantStatusFor(d, m);
      return '<div class="event-participant' + (included ? ' is-in' : '') + '" data-member="' + esc(m.id) + '">' +
        '<div class="event-part-main"><span class="event-part-avatar">' + esc(m.name.charAt(0).toUpperCase()) + '<span class="participation-dot participation-dot-avatar status-' + (ps || 'unset') + '" title="' + esc(participantStatusLabel(ps)) + '" aria-label="' + esc(participantStatusLabel(ps)) + '"></span></span><div class="event-part-copy"><strong>' + esc(m.name) + '</strong><span>' + esc(rolesLabel(rolesOf(m))) + '</span></div></div></div>';
    }).join('') : '<span class="t-sm t-muted">Участники не добавлены.</span>') + '</div></div>' +
    '<div class="field"><span class="field-label">Ваше участие</span><div id="f_my">' +
      renderParticipationSwitch(d, {size:'lg', variant:'editor', draft:true, status:eventStatusFor(d) || (ev ? '' : state.profile.defaultParticipation || '')}) +
    '</div></div>' +
    '<div class="field"><span class="field-label">Состав события</span><div class="row" id="f_members" style="gap:6px">' +
    (state.members.length ? state.members.map(m => '<button type="button" class="chip' + ((d.memberIds || []).indexOf(m.id) >= 0 ? ' on' : '') + '" data-m="' + m.id + '" aria-pressed="' + ((d.memberIds || []).indexOf(m.id) >= 0) + '">' + esc(m.name.split(' ')[0]) + ' · ' + esc(rolesLabel(rolesOf(m))) + '</button>').join('') : '<span class="t-sm t-muted">Участники не добавлены.</span>') + '</div></div>' +
    '<div class="field"><label class="field-label" for="f_notes">Заметки</label><textarea class="input" id="f_notes" rows="3" style="font-family:var(--font);min-height:80px" placeholder="Саундчек, райдер, договорённости">' + esc(d.notes || '') + '</textarea></div>';
  openModal({
    title: ev ? 'Изменить событие' : 'Новое событие', sub: ev ? pdateFull(ev.date) : 'Заполните название, дату и время', size: 'lg', fullscreen: true, editor: true, body: body,
    footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Отмена</button><button class="btn btn-primary" type="button" id="evSaveBtn" data-act="event-save" data-id="' + (ev ? ev.id : '') + '">' + ic('check', 16) + (ev ? 'Сохранить изменения' : 'Создать событие') + '</button>',
    onMount: function (w) {
      $$('#evTypeSeg button', w).forEach(b => b.addEventListener('click', () => $$('#evTypeSeg button', w).forEach(x => x.classList.toggle('on', x === b))));
      $$('#f_members .chip', w).forEach(b => b.addEventListener('click', () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); }));
    }
  });
}
function readEventForm(id) {
  const w = modalRoot; if (!w) return null;
  const t = $('#evTypeSeg button.on', w), my = $('#f_my button.on', w);
  const title = fv('f_title'); if (!title) { fieldError('f_title', 'Введите название события'); return null; }
  const date = fv('f_date'); if (!date) { fieldError('f_date', 'Укажите дату события'); return null; }
  const time = fv('f_time'), end = fv('f_end');
  if (time && end && mins(end) <= mins(time)) { fieldError('f_end', 'Окончание должно быть позже начала'); return null; }
  const until = fv('f_until');
  if ($('#f_repeat', w).value !== 'none' && until && until < date) { fieldError('f_until', 'Дата окончания повтора раньше начала события'); return null; }
  const old = id ? evById(id) : null;
  return {
    id: id || uid('e'), type: t ? t.getAttribute('data-t') : 'gig', title: title, date: date, time: time, end: end,
    location: fv('f_loc'), notes: fv('f_notes'), status: $('#f_status', w).value, repeat: $('#f_repeat', w).value, repeatUntil: until,
    setlistId: $('#f_sl', w).value, personalStatus: my ? my.getAttribute('data-v') : '',
    participation: cloneValue(old && old.participation || {}),
    participationUpdatedAt: cloneValue(old && old.participationUpdatedAt || {}),
    memberIds: Array.prototype.map.call(w.querySelectorAll('#f_members .chip.on'), b => b.getAttribute('data-m')), except: (old && old.except) || []  };
}
let dynDraft = null;
function songModal(id) {
  const s = id ? songById(id) : null;
  const d = s || { title: '', artist: '', key: 'Am', bpm: '', duration: '', tags: [], lyrics: '', fav: false };
  dynDraft = normalizeDynamics(s && s.dynamics);
  const tpl = '[Куплет 1]\nAm      F       C       G\nСтрока текста песни\nAm      F       G\nВторая строка\n\n[Припев]\nF       G       Em      Am\nТекст припева';
  const body =
    '<div class="field"><label class="field-label" for="f_stitle">Название *</label><input class="input" id="f_stitle" maxlength="90" value="' + esc(d.title) + '" placeholder="Название песни"><span class="err"></span></div>' +
    '<div class="field"><label class="field-label" for="f_skey">Тональность</label><select class="select" id="f_skey">' +
    KEY_LIST.map(k => '<option value="' + k + '"' + (d.key === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="f_stags">Теги через запятую</label><input class="input" id="f_stags" value="' + esc((d.tags || []).join(', ')) + '" placeholder="рок, баллада, сет"></div>' +
    '<div class="song-editor-grid">' +
    '<section class="song-lyrics-pane"><div class="field song-lyrics-field">' +
    '<div class="song-section-quick"><span class="field-label">Быстро вставить часть песни</span><div class="song-section-actions">' +
    [['Вступление','Вступление'],['Куплет 1','Куплет'],['Куплет 2','Куплет 2'],['Предприпев','Предприпев'],['Припев','Припев'],['Бридж','Бридж'],['Проигрыш','Проигрыш'],['Соло','Соло'],['Финал','Финал']].map(([label, value]) => '<button class="chip song-section-chip" type="button" data-act="insert-song-section" data-section="' + esc(value) + '">' + esc(label) + '</button>').join('') +
    '</div></div>' +
    '<label class="field-label" for="f_slyr">Текст песни</label><textarea class="textarea song-lyrics-textarea" id="f_slyr" rows="18" spellcheck="false" placeholder="' + esc(tpl) + '">' + esc(d.lyrics || '') + '</textarea>' +
    '<span class="hint">Нажми кнопку выше — заголовок вставится в текст в позиции курсора и появится в панели динамики и сценическом режиме.</span></div></section>' +
    '<section class="song-dynamics-pane"><div class="song-dynamics-panel">' +
    '<div class="song-dynamics-panel-head">' + ic('wave', 16) + '<div><h3>Динамика инструментов</h3><p>Добавляй партии и задавай указания для каждого инструмента по частям песни</p></div></div>' +
    '<div class="song-dynamics-sections"><span class="field-label">Динамика по частям песни</span><div id="dynBlock"></div></div>' +
    '</div></section></div>';
  openModal({
    title: s ? 'Изменить песню' : 'Новая песня', size: 'lg', fullscreen: true, editor: true, body: body,
    footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Отмена</button><button class="btn btn-primary" type="button" id="songSaveBtn" data-act="song-save" data-id="' + (s ? s.id : '') + '">' + ic('check', 16) + (s ? 'Сохранить изменения' : 'Добавить песню') + '</button>',
    onMount: function () { syncDynamicsSections(dynDraft, $('#f_slyr', modalRoot)?.value || ''); renderDynBlock(); }
  });
}
function renderDynBlock() {
  const box = $('#dynBlock'); if (!box || !dynDraft) return;
  const sections = dynDraft.sections || [];
  const available = ROLES.filter(r => !dynDraft.instruments.includes(r.k));
  const previousSelect = $('#dynInstrumentFocus');
  const active = dynDraft.activeInstrument || (previousSelect && previousSelect.value) || dynDraft.instruments[0] || '';
  const selectedInstrument = dynDraft.instruments.includes(active) ? active : (dynDraft.instruments[0] || '');
  let html = '<div class="dyn-editor">';
  html += '<details class="dyn-instrument-dropdown" open><summary><span class="dyn-instrument-summary-icon">' + ic('music', 16) + '</span><span><strong>Добавить динамику для инструмента</strong><small>Добавь инструмент и настрой его партию по каждой части песни</small></span><span class="dyn-dropdown-chevron" aria-hidden="true">⌄</span></summary>' +
    '<div class="dyn-instrument-picker"><label class="field-label" for="dynInstrumentFocus">Настраиваемая партия</label>' +
    '<div class="dyn-instrument-add-row"><select class="select" id="dynInstrumentFocus">' +
    (dynDraft.instruments.length ? dynDraft.instruments.map(ins => '<option value="' + esc(ins) + '"' + (ins === selectedInstrument ? ' selected' : '') + '>' + esc(dynamicsInstrumentLabel(ins)) + '</option>').join('') : '<option value="">Сначала добавь инструмент</option>') +
    '</select><button class="btn btn-secondary btn-sm" type="button" data-act="dyn-instrument-remove-active"' + (selectedInstrument ? '' : ' disabled') + ' title="Убрать выбранный инструмент">' + ic('x', 14) + 'Убрать</button></div>' +
    '<label class="field-label dyn-add-label" for="dynInstrumentSelect">Добавить ещё инструмент</label><div class="dyn-instrument-add-row"><select class="select" id="dynInstrumentSelect">' +
    available.map(r => '<option value="' + esc(r.k) + '">' + esc(r.label) + '</option>').join('') +
    '</select><button class="btn btn-primary btn-sm" type="button" data-act="dyn-instrument-add"' + (available.length ? '' : ' disabled') + '>' + ic('plus', 15) + 'Добавить</button></div>' +
    (!dynDraft.instruments.length ? '<p class="t-sm t-muted">Каждый инструмент хранит собственные указания по каждой части песни — переключение не перезаписывает другие партии.</p>' : '') +
    '</div></details>';
  if (!sections.length) {
    html += '<div class="dyn-empty-state"><strong>Сначала добавь части песни</strong><span>Нажми «Куплет», «Припев» или другую кнопку над текстом песни — здесь появятся отдельные поля динамики.</span></div>';
  } else {
    html += sections.map(function(name, index) {
      const instrumentNote = selectedInstrument
        ? String((dynDraft.instrumentNotes[selectedInstrument] || {})[name] || '')
        : '';
      return '<section class="dyn-section-editor"><div class="dyn-section-heading"><span class="dyn-section-index">' + (index + 1) + '</span><label class="field-label" for="dyn_ins_' + index + '">' + esc(name) + '</label></div>' +
        (selectedInstrument ? '<div class="dyn-instrument-section-field"><label class="dyn-sub-label" for="dyn_ins_' + index + '">' + esc(dynamicsInstrumentLabel(selectedInstrument)) + '</label><textarea class="textarea dyn-section-text" id="dyn_ins_' + index + '" rows="3" data-dyn-instrument="' + esc(selectedInstrument) + '" data-sec="' + esc(name) + '" placeholder="Когда вступить, играть тише или громче, где сделать акцент…">' + esc(instrumentNote) + '</textarea></div>' : '<p class="t-sm t-muted">Сначала добавь инструмент, чтобы указать динамику его партии.</p>') +
        '</section>';
    }).join('');
  }

  box.innerHTML = html + '</div>';
}
function readSongForm(id) {
  const w = modalRoot; if (!w) return null;
  const title = fv('f_stitle'); if (!title) { fieldError('f_stitle', 'Введите название песни'); return null; }
  const old = id ? songById(id) : null;
  return {
    id: id || uid('s'), title: title, artist: old ? (old.artist || '') : '', key: $('#f_skey', w).value,
    bpm: old ? (old.bpm ?? null) : null, duration: old ? (old.duration ?? 0) : 0,
    tags: fv('f_stags').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 8),
    lyrics: $('#f_slyr', w).value, fav: old ? !!old.fav : false, addedAt: old ? old.addedAt : today(),
    dynamics: dynDraft ? cloneValue(dynDraft) : (old ? old.dynamics : null)
  };
}
function setlistModal(id) {
  const sl = id ? slById(id) : null;
  const body = '<div class="field"><label class="field-label" for="f_slname">Название *</label><input class="input" id="f_slname" maxlength="80" value="' + esc(sl ? sl.name : '') + '" placeholder="Например: Основной сет · 45 минут"><span class="err"></span></div>' +
    '<div class="field"><label class="field-label" for="f_slnote">Заметки к программе</label><textarea class="input" id="f_slnote" rows="3" style="font-family:var(--font);min-height:84px" placeholder="Динамика программы, переходы, финал">' + esc(sl ? sl.note || '' : '') + '</textarea></div>' +
    (!sl && state.songs.length ? '<div class="field"><span class="field-label">Добавить песни сразу</span><div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;-webkit-overflow-scrolling:touch">' +
      state.songs.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru')).map(s => '<label class="check setlist-song-option"><input type="checkbox" class="f_slsong" value="' + s.id + '"><span class="grow nowrap">' + esc(s.title) + '</span><span class="badge b-muted mono">' + esc(s.key || '') + '</span></label>').join('') + '</div></div>'
      : (!state.songs.length ? '<p class="t-sm t-muted">В репертуаре пока нет песен — их можно добавить позже.</p>' : ''));
  openModal({
    title: sl ? 'Название и заметки' : 'Новый сет-лист', fullscreen: true, editor: true, body: body,
    footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Отмена</button><button class="btn btn-primary" type="button" data-act="sl-save" data-id="' + (sl ? sl.id : '') + '">' + ic('check', 16) + (sl ? 'Сохранить изменения' : 'Создать сет-лист') + '</button>'
  });
}
function memberModal(id) {
  const m = id ? memById(id) : null;
  const d = m || { name: '', role: '', note: '' };
  openModal({
    title: m ? 'Участник' : 'Новый участник',
    body: '<div class="field"><label class="field-label" for="f_mname">Имя *</label><input class="input" id="f_mname" maxlength="50" value="' + esc(d.name) + '" placeholder="Имя и фамилия"><span class="err"></span></div>' +
      '<div class="field"><span class="field-label">Роль / инструмент</span><div class="row" style="gap:6px" id="f_mrole">' +
      ROLES.map(r => '<button type="button" class="chip' + (rolesOf(d).indexOf(r.k) >= 0 ? ' on' : '') + '" data-r="' + r.k + '" aria-pressed="' + (rolesOf(d).indexOf(r.k) >= 0) + '">' + ic(r.icon, 13) + esc(r.label) + '</button>').join('') + '</div></div>' +
      '<div class="field"><label class="field-label" for="f_mnote">Заметка</label><input class="input" id="f_mnote" maxlength="80" value="' + esc(d.note || '') + '" placeholder="Свой инструмент, бэк-вокал"></div>',    footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Отмена</button><button class="btn btn-primary" type="button" data-act="mem-save" data-id="' + (m ? m.id : '') + '">' + ic('check', 16) + (m ? 'Сохранить изменения' : 'Добавить участника') + '</button>',
    onMount: function (w) {
      $$('#f_mrole .chip', w).forEach(b => b.addEventListener('click', () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }));
    }
  });
}
function addToSetlistModal(songId) {
  const s = songById(songId);
  if (!state.setlists.length) { confirmBox('Сет-листов пока нет', 'Чтобы добавить песню в программу, сначала создайте сет-лист. Создать сейчас?', () => setlistModal(null), 'Создать сет-лист'); return; }
  openModal({
    title: 'Добавить в сет-лист', sub: s ? s.title : '', guard: false,
    body: '<div style="display:flex;flex-direction:column;gap:6px">' + state.setlists.map(sl => {
      const has = (sl.items || []).some(i => i.songId === songId);
      return '<button class="chip" style="justify-content:flex-start;border-radius:var(--r-14);padding:13px var(--s4);width:100%" type="button" data-act="sl-add-go" data-sl="' + sl.id + '" data-song="' + songId + '"' + (has ? ' disabled' : '') + '>' +
        ic('list', 16) + '<b class="grow nowrap" style="text-align:left;font-weight:600">' + esc(sl.name) + '</b><span class="badge b-muted num">' + (has ? 'уже добавлена' : (sl.items || []).length) + '</span></button>';
    }).join('') + '</div>',
    footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Закрыть</button><button class="btn btn-primary" type="button" data-act="new-setlist">' + ic('plus', 16) + 'Новый сет-лист</button>'
  });
}

/* ═══ 16. SCENE ═══ */
const scene = { list: [], i: 0, shift: 0, size: 26, speed: 60, auto: false, raf: null, last: 0, wake: null, eventId: '' };
const buildList = sl => (sl.items || []).map(it => ({ songId: it.songId, shift: it.shift || 0, note: it.note || '' }));
function openScene(list, i, shift, eventId) {
  if (!list || !list.length) { toast('Нет песен для сценического режима', 'warn'); return; }
  scene.list = list; scene.i = clamp(i || 0, 0, list.length - 1); scene.shift = shift || 0; scene.eventId = String(eventId || '');
  scene.size = state.settings.sceneSize || 26; scene.speed = state.settings.sceneSpeed || 60;
  $('#scene').classList.add('on'); $('#scene').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  drawScene();
  if (state.settings.autoscroll) setAuto(true);
  reqWake();
  const el = $('#scene'); if (el.requestFullscreen) el.requestFullscreen().catch(() => { });
  setTimeout(() => { const b = $('[data-act="scene-close"]'); if (b) b.focus(); }, 120);
}
function closeScene() {
  setAuto(false);
  $('#scene').classList.remove('on'); $('#scene').setAttribute('aria-hidden', 'true');
  if (!$('#modalOverlay').classList.contains('on')) document.body.style.overflow = '';
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { });
  relWake();
}
function drawScene() {
  const it = scene.list[scene.i]; if (!it) return;
  const s = songById(it.songId);
  if (!s) { scene.i++; if (scene.i >= scene.list.length) { closeScene(); return; } drawScene(); return; }
  const shift = (it.shift || 0) + scene.shift;
  $('#scTitle').textContent = s.title;
  $('#scMeta').textContent = [transposeKey(s.key || '—', shift), s.bpm ? s.bpm + ' BPM' : '', fmtDur(s.duration), (scene.i + 1) + ' / ' + scene.list.length].filter(Boolean).join(' · ');
  const sceneEvent = scene.eventId ? evById(scene.eventId) : null;
  const scenePos = $('#scPosition');
  if (scenePos) scenePos.innerHTML = sceneEvent ? renderMyPositionBadge(sceneEvent, {compact:false}) : '';
  const d = normalizeDynamics(s.dynamics), dyn = String(d.notes || '').trim();
  $('#scDyn').innerHTML = dyn ? '<div class="scene-dynamics-overview"><strong>ДИНАМИКА ПЕСНИ</strong><div>' + esc(dyn).replace(/\n/g, '<br>') + '</div></div>' : '';
  $('#scDyn').style.display = dyn ? 'block' : 'none';
  const body = $('#scBody');
  body.style.setProperty('--scsize', scene.size + 'px');
  body.innerHTML = renderSceneLyrics(s, shift) + (it.note ? '<span class="ln sec">Заметка</span><span class="ln" style="font-family:var(--font);font-size:.5em;opacity:.75">' + esc(it.note) + '</span>' : '');
  body.scrollTop = 0;
  syncSceneChords();
  $('#scFont').textContent = scene.size; $('#scSpeed').textContent = scene.speed;
  $('#scTrans').textContent = (scene.shift > 0 ? '+' : '') + scene.shift;
  updateBar();
}
function setAuto(v) {
  scene.auto = v;
  const b = $('[data-act="scene-auto"]');
  if (b) { b.innerHTML = ic(v ? 'pause' : 'play', 19); b.classList.toggle('act', v); b.setAttribute('aria-label', v ? 'Остановить автопрокрутку' : 'Запустить автопрокрутку'); }
  if (v) { scene.last = performance.now(); loop(); } else if (scene.raf) { cancelAnimationFrame(scene.raf); scene.raf = null; }
}
function loop() {
  if (!scene.auto) return;
  const now = performance.now(), dt = (now - scene.last) / 1000; scene.last = now;
  const el = $('#scBody');
  el.scrollTop += scene.speed * dt;
  updateBar();
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
    if (scene.i < scene.list.length - 1) { scene.i++; drawScene(); scene.last = performance.now(); }
    else { setAuto(false); return; }
  }
  scene.raf = requestAnimationFrame(loop);
}
function updateBar() {
  const el = $('#scBody'), max = el.scrollHeight - el.clientHeight;
  const p = max > 0 ? el.scrollTop / max : 0, total = scene.list.length || 1;
  $('#scBar').style.width = clamp(((scene.i + p) / total) * 100, 0, 100) + '%';
}
function reqWake() { if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(s => { scene.wake = s; }).catch(() => { }); }
function relWake() { if (scene.wake) { try { scene.wake.release(); } catch (e) { } scene.wake = null; } }

/* ═══ 17. PRINT ═══ */
function doPrint(html) { $('#printArea').innerHTML = '<div>' + html + '</div>'; setTimeout(() => window.print(), 80); }
function printSong(id, shift) {
  const s = songById(id); if (!s) return;
  const extra = dynamicsHTML(s);
  doPrint('<div class="print-song"><h2>' + esc(s.title) + '</h2><div class="pk">' +
    esc([transposeKey(s.key || '', shift || 0), s.bpm ? s.bpm + ' BPM' : '', s.duration ? fmtDur(s.duration) : '', s.artist || ''].filter(Boolean).join(' · ')) +
    '</div><pre>' + esc(transposeLyrics(s.lyrics, shift || 0)) + '</pre>' + extra + '</div>');
}
function printSetlist(id) {
  const sl = slById(id); if (!sl) return;
  const ev = sl.eventId ? evById(sl.eventId) : null;
  let rows = '', total = 0;
  (sl.items || []).forEach(function (it, i) {
    const s = songById(it.songId); if (!s) return;
    total += s.duration || 0;
    rows += '<tr><td>' + (i + 1) + '</td><td>' + esc(s.title) + '</td><td>' + esc(finalKey(s, it.shift)) + '</td><td>' + (s.bpm || '—') + '</td><td>' + fmtDur(s.duration || 0) + '</td><td>' + esc(it.note || '') + '</td></tr>';
  });
  doPrint('<h1>' + esc(sl.name) + '</h1><div class="pmeta">' +
    esc([state.profile.bandName, ev ? pdate(ev.date) + ' · ' + ev.title : '', (sl.items || []).length + ' песен · ' + fmtDur(total)].filter(Boolean).join(' — ')) +
    (sl.note ? '<br>' + esc(sl.note) : '') + '</div>' +
    '<table><thead><tr><th>№</th><th>Песня</th><th>Тональность</th><th>BPM</th><th>Время</th><th>Заметка</th></tr></thead><tbody>' + rows + '</tbody></table>');
}

/* ═══ 18. GLOBAL SEARCH (только главная) ═══ */
let searchCorpus = null;
function getSearchCorpus() {
  if (searchCorpus) return searchCorpus;
  searchCorpus = {
    songs: state.songs.map(s => ({s, hay: ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.tags || []).join(' ') + ' ' + (s.lyrics || '')).toLowerCase()})),
    setlists: state.setlists.map(sl => ({sl, hay:(sl.name + ' ' + (sl.note || '')).toLowerCase()})),
    members: state.members.map(m => ({m, hay:(m.name + ' ' + rolesLabel(rolesOf(m)) + ' ' + (m.note || '')).toLowerCase()})),
    events: expand(iso(new Date(Date.now() - 86400000 * 365)), iso(new Date(Date.now() + 86400000 * 400))).map(o => ({o, hay:((o.ev.title || '') + ' ' + (o.ev.location || '') + ' ' + (o.ev.notes || '')).toLowerCase()}))
  };
  return searchCorpus;
}
function searchAll(q) {
  q = String(q || '').toLowerCase().trim();
  const out = [];
  const add = (group, icon, title, meta, key, act) => out.push({ group: group, icon: icon, title: title, meta: meta, key: key, act: act });
  if (!q) {
    add('Быстрые действия', 'plus', 'Новое событие', 'Календарь · клавиша E', 'E', () => eventModal(null));
    add('Быстрые действия', 'music', 'Новая песня', 'Репертуар · клавиша N', 'N', () => songModal(null));
    add('Быстрые действия', 'list', 'Новый сет-лист', 'Программы · клавиша S', 'S', () => setlistModal(null));
    add('Быстрые действия', 'monitor', 'Сценический режим', 'Полный экран с автопрокруткой', '', () => quickScene());
    add('Быстрые действия', 'palette', 'Оформление', 'Тема, акцент, шрифты', '', () => go('#/settings'));
    state.songs.slice(0, 4).forEach(s => add('Песни', 'music', s.title, [s.key, s.artist].filter(Boolean).join(' · ') || '—', s.key || '', () => go('#/song/' + s.id)));
    upcoming(4).forEach(o => add('Ближайшие события', 'calendar', o.ev.title, pdateShort(o.date) + ' · ' + (o.ev.time || '') + ' · ' + evType(o.ev.type).label, '', () => eventModal(o.ev.id)));
    return out;
  }
  const corpus = getSearchCorpus();
  corpus.songs.forEach(({s,hay}) => {
    if (hay.indexOf(q) >= 0) add('Песни', 'music', s.title, [s.key, s.bpm ? s.bpm + ' BPM' : '', s.artist].filter(Boolean).join(' · ') || '—', s.key || '', () => go('#/song/' + s.id));
  });
  corpus.events.forEach(({o,hay}) => {
    if (hay.indexOf(q) >= 0) add('События', 'calendar', o.ev.title, pdateShort(o.date) + ' · ' + (o.ev.time || '') + ' · ' + evType(o.ev.type).label, '', () => eventModal(o.ev.id));
  });
  corpus.setlists.forEach(({sl,hay}) => {
    if (hay.indexOf(q) >= 0) add('Сет-листы', 'list', sl.name, (sl.items || []).length + ' ' + plural((sl.items || []).length, 'песня', 'песни', 'песен') + ' · ' + fmtDur(setlistDur(sl)), '', () => go('#/setlist/' + sl.id));
  });
  corpus.members.forEach(({m,hay}) => {
    if (hay.indexOf(q) >= 0) add('Участники', 'users', m.name, rolesLabel(rolesOf(m)), '', () => memberModal(m.id));
  });
  [['Календарь', 'calendar', '#/calendar'], ['Репертуар', 'music', '#/songs'], ['Сет-листы', 'list', '#/setlists'], ['Настройки', 'gear', '#/settings']].forEach(function (t) {
    if (t[0].toLowerCase().indexOf(q) >= 0) add('Разделы', t[1], 'Перейти: ' + t[0], 'Навигация', '', () => go(t[2]));
  });
  const seen = {}, uniq = [];
  out.forEach(function (it) { const k = it.group + '|' + it.title + '|' + it.meta; if (!seen[k]) { seen[k] = 1; uniq.push(it); } });
  return uniq.slice(0, 40);
}
function drawSearch() {
  const dd = $('#searchDrop'), q = ui.searchQ, res = searchAll(q);
  ui.searchFlat = res; ui.searchIdx = 0;
  if (!res.length) dd.innerHTML = '<div class="sd-empty">' + ic('search', 22) + '<p style="margin-top:8px">Ничего не найдено по запросу «' + esc(q) + '».<br>Проверьте раскладку или попробуйте более короткий запрос.</p></div>';
  else {
    let h = '', lastG = '';
    res.forEach(function (r, i) {
      if (r.group !== lastG) { h += '<div class="sd-group">' + esc(r.group) + '</div>'; lastG = r.group; }
      h += '<div class="sd-item' + (i === 0 ? ' sel' : '') + '" data-sr="' + i + '" role="option" aria-selected="' + (i === 0) + '">' +
        '<span class="sd-ic">' + ic(r.icon, 17) + '</span>' +
        '<span class="sd-tx"><span class="sd-t">' + esc(r.title) + '</span><span class="sd-m">' + esc(r.meta || '') + '</span></span>' +
        (r.key ? '<span class="sd-k">' + esc(r.key) + '</span>' : '') + '</div>';
    });
    h += '<div class="sd-foot"><span><b>↑↓</b> навигация</span><span><b>Enter</b> открыть</span><span><b>Esc</b> закрыть</span></div>';
    dd.innerHTML = h;
  }
  dd.classList.add('open');
  $('#globalSearch').setAttribute('aria-expanded', 'true');
  $('#searchWrap').classList.toggle('has-q', !!q);
}
function closeSearch() {
  const d = $('#searchDrop');
  const inp = $('#globalSearch');
  if (d) d.classList.remove('open');
  if (inp) inp.setAttribute('aria-expanded', 'false');
  const wrap = $('#searchWrap');
  if (wrap) wrap.classList.remove('has-q');
}
function moveSearch(d) {
  const items = $$('#searchDrop .sd-item'); if (!items.length) return;
  items.forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-selected', 'false'); });
  ui.searchIdx = (ui.searchIdx + d + items.length) % items.length;
  items[ui.searchIdx].classList.add('sel'); items[ui.searchIdx].setAttribute('aria-selected', 'true');
  items[ui.searchIdx].scrollIntoView({ block: 'nearest' });
}
function runSearch(i) {
  const r = ui.searchFlat[i]; if (!r) return;
  closeSearch();
  const inp = $('#globalSearch'); inp.value = ''; ui.searchQ = ''; $('#searchWrap').classList.remove('has-q'); inp.blur();
  try { r.act(); } catch (e) { toast('Не удалось выполнить действие', 'err'); }
}
function quickScene() {
  const sl = state.setlists.find(x => (x.items || []).length);
  if (sl) return openScene(buildList(sl), 0, 0);
  if (state.songs.length) return openScene(state.songs.slice(0, 12).map(s => ({ songId: s.id, shift: 0, note: '' })), 0, 0);
  toast('Сначала добавьте песни или сет-лист', 'warn');
}

/* ═══ 19. THEME / ACCENT ═══ */
const THEMES = Object.freeze([{id:'light',label:'Светлая',icon:'sun'},{id:'dark',label:'Тёмная',icon:'moon'},{id:'amoled',label:'AMOLED',icon:'bolt'}]);
const THEME_IDS=Object.freeze(THEMES.map(t=>t.id));
const themeById=id=>THEMES.find(t=>t.id===id)||THEMES[0];
function tokenColor(name,fallback=''){try{return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback}catch(e){return fallback}}
function themeTokenColor(id){return tokenColor('--theme-color-'+id,tokenColor('--theme-color-light'))}
function presetAccentColor(preset,themeId){return ACCENTS.includes(preset)?tokenColor('--accent-preset-'+preset+'-'+themeId,tokenColor('--accent-default')):tokenColor('--accent-default')}
function themeMeta(id){const t=themeById(id);return Object.assign({},t,{themeColor:themeTokenColor(t.id)})}
function nextThemeMeta(id){const i=Math.max(0,THEME_IDS.indexOf(id));return THEMES[(i+1)%THEMES.length]}
function colorLuminance(hex){const n=parseInt(String(hex).slice(1),16),rgb=[(n>>16)&255,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
function colorContrast(a,b){const la=colorLuminance(a),lb=colorLuminance(b);return (Math.max(la,lb)+.05)/(Math.min(la,lb)+.05)}
function onAccentFor(hex){const white=tokenColor('--token-white'),black=tokenColor('--token-black');return colorContrast(hex,white)>=colorContrast(hex,black)?white:black}
function rgbToOklch(hex){const n=parseInt(String(hex).slice(1),16),srgb=[(n>>16)&255,(n>>8)&255,n&255].map(v=>v/255),lin=srgb.map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)),l=.4122214708*lin[0]+.5363325363*lin[1]+.0514459929*lin[2],m=.2119034982*lin[0]+.6806995451*lin[1]+.1073969566*lin[2],s=.0883024619*lin[0]+.2817188376*lin[1]+.6299787005*lin[2],l3=Math.cbrt(l),m3=Math.cbrt(m),s3=Math.cbrt(s),L=.2104542553*l3+.793617785*m3-.0040720468*s3,A=1.9779984951*l3-2.428592205*m3+.4505937099*s3,B=.0259040371*l3+.7827717662*m3-.8086757662*s3;return{L,C:Math.hypot(A,B),H:Math.atan2(B,A)}}
function oklchToHex(L,C,H){const A=C*Math.cos(H),B=C*Math.sin(H),l3=L+.3963377774*A+.2158037573*B,m3=L-.1055613458*A-.0638541728*B,s3=L-.0894841775*A-1.291485548*B,l=l3**3,m=m3**3,s=s3**3,lr=4.0767416621*l-3.3077115913*m+.2309699292*s,lg=-1.2684380046*l+2.6097574011*m-.3413193965*s,lb=-.0041960863*l-.7034186147*m+1.707614701*s,toSrgb=v=>{const x=Math.max(0,Math.min(1,v));return Math.round(255*(x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055))};return'#'+[toSrgb(lr),toSrgb(lg),toSrgb(lb)].map(v=>v.toString(16).padStart(2,'0')).join('')}
function accentOnBackground(hex,bg){const base=rgbToOklch(hex),dir=colorLuminance(bg)>.179?-1:1,ratio=L=>colorContrast(oklchToHex(L,base.C,base.H),bg);if(ratio(base.L)>=4.5)return oklchToHex(base.L,base.C,base.H);let lo=dir<0?0:base.L,hi=dir<0?base.L:1;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(ratio(mid)>=4.5){if(dir<0)lo=mid;else hi=mid}else{if(dir<0)hi=mid;else lo=mid}}return oklchToHex(dir<0?lo:hi,base.C,base.H)}
function accessibleAccent(input,themeId){const base=/^#[0-9a-fA-F]{6}$/.test(input||'')?input.toUpperCase():presetAccentColor('blue',themeId);return accentOnBackground(base,themeTokenColor(themeId))}
function hueDistance(a,b){const d=Math.abs(a-b)%(Math.PI*2);return Math.min(d,Math.PI*2-d)}
let semanticBase={};
function captureSemanticBase(){semanticBase={ok:tokenColor('--ok'),warn:tokenColor('--warn'),danger:tokenColor('--danger'),info:tokenColor('--semantic-info-base'),plum:tokenColor('--plum')}}
function shiftedSemantic(hex,accent){if(!/^#[0-9a-fA-F]{6}$/.test(hex)||!/^#[0-9a-fA-F]{6}$/.test(accent))return hex;const a=rgbToOklch(hex),b=rgbToOklch(accent);return hueDistance(a.H,b.H)>Math.PI/6?hex:oklchToHex(a.L,a.C,a.H+Math.PI*2/3)}
function applySemanticSeparation(accent){const r=document.documentElement.style;for(const key of ['ok','warn','danger','info','plum']){const base=semanticBase[key]||'';if(base)r.setProperty('--'+key,shiftedSemantic(base,accent))}}
function applyThemeMeta(id){const meta=themeMeta(id);document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.setAttribute('content',meta.themeColor));return meta}
function persistBootPrefs(){try{const st=state.settings||{},theme=THEME_IDS.includes(st.theme)?st.theme:'light',accent=/^#[0-9a-fA-F]{6}$/.test(st.accent||'')?st.accent.toUpperCase():presetAccentColor(st.accentPreset||'blue',theme),applied=document.documentElement.style.getPropertyValue('--accent')||accent,onAccent=tokenColor('--accent-contrast');localStorage.setItem('bandplan.boot',JSON.stringify({theme,accent,accentApplied:applied.trim(),onAccent:onAccent.trim(),accentPreset:ACCENTS.includes(st.accentPreset)?st.accentPreset:null,density:st.density||'comfortable'}))}catch(e){}}
function applyTheme(){const s=state.settings;if(!THEME_IDS.includes(s.theme))s.theme='light';const meta=themeMeta(s.theme);document.documentElement.setAttribute('data-theme',meta.id);document.documentElement.setAttribute('data-reduced',s.reduced?'true':'false');document.documentElement.style.setProperty('--lsize',(s.lyricsSize||15)+'px');applyThemeMeta(meta.id);captureSemanticBase();applyAccentVars();persistBootPrefs()}
function cycleTheme(){setTheme(nextThemeMeta(state.settings.theme).id)}
function setTheme(t){const next=themeMeta(t);state.settings.theme=next.id;applyTheme();save();renderWithTransition(render);toast('Тема: '+next.label,'info',2000)}
function applyAccent(value){const themeId=THEME_IDS.includes(state.settings.theme)?state.settings.theme:'light';if(ACCENTS.includes(value)){state.settings.accentPreset=value;state.settings.accent=accessibleAccent(presetAccentColor(value,themeId),themeId)}else if(/^#[0-9a-fA-F]{6}$/.test(value||'')){state.settings.accentPreset=null;state.settings.accent=accessibleAccent(value,themeId)}else return;try{localStorage.setItem('accent',state.settings.accent)}catch(e){}applyAccentVars();save();renderWithTransition(render)}
function applyAccentVars(){const themeId=THEME_IDS.includes(state.settings.theme)?state.settings.theme:'light',base=ACCENTS.includes(state.settings.accentPreset)?presetAccentColor(state.settings.accentPreset,themeId):(/^#[0-9a-fA-F]{6}$/.test(state.settings.accent||'')?state.settings.accent.toUpperCase():presetAccentColor('blue',themeId)),hex=accessibleAccent(base,themeId),onAccent=onAccentFor(hex),onBg=accentOnBackground(hex,themeTokenColor(themeId)),r=document.documentElement.style;state.settings.accent=hex;r.setProperty('--accent',hex);r.setProperty('--accent-contrast',onAccent);r.setProperty('--accent-on-bg',onBg);r.setProperty('--accent-text',onBg);applySemanticSeparation(hex);r.setProperty('--info-bg','color-mix(in srgb,var(--info) 14%,transparent)');r.setProperty('--part-yes',tokenColor('--ok'));r.setProperty('--part-maybe',tokenColor('--warn'));r.setProperty('--part-no',tokenColor('--danger'));r.setProperty('--part-unset',tokenColor('--muted'));try{localStorage.setItem('accent',hex)}catch(e){}persistBootPrefs()}
/* ═══ 20. ONBOARDING ═══ */
let onbStep = 0, onbData = null;
function openOnboarding() {
  onbStep = 0;
  onbData = {
    name: '', role: '', roles: [], bandName: '', bandDesc: '', participation: 'yes',
    members: [{ name: '', role: 'vocal' }],
    theme: THEME_IDS.includes(state.settings.theme) ? state.settings.theme : 'light',
    accentPreset: ACCENTS.includes(state.settings.accentPreset) ? state.settings.accentPreset : 'blue',
    accent: /^#[0-9a-fA-F]{6}$/.test(state.settings.accent || '') ? state.settings.accent : presetAccentColor(state.settings.accentPreset || 'blue', state.settings.theme),
    demo: false
  };
  drawOnb(); $('#onb').classList.add('on');
}
function drawOnb() {
  const el = $('#onb'), steps = ['Профиль', 'Группа', 'Состав', 'Старт'];
  let h = '<div class="onb-card"><div class="onb-steps" aria-hidden="true">' + steps.map((s, i) => '<i class="' + (i <= onbStep ? 'on' : '') + '"></i>').join('') + '</div>' +
    '<p class="cap" style="margin-bottom:var(--s2)">Шаг ' + (onbStep + 1) + ' из 4 — ' + steps[onbStep] + '</p>';
  if (onbStep === 0) {
    h += '<div class="onb-hero">' + ic('mic', 28) + '</div><h2>Расскажите о себе</h2>' +
      '<p class="lead">Роль нужна, чтобы в каждой песне подсвечивалась динамика именно вашей партии, а участие в событиях отмечалось одним нажатием.</p>' +
      '<div class="field"><label class="field-label" for="ob_name">Как вас зовут *</label><input class="input" id="ob_name" maxlength="50" value="' + esc(onbData.name) + '" placeholder="Имя и фамилия"><span class="err"></span></div>' +
      '<div class="field"><span class="field-label">Ваши роли в группе * (можно несколько)</span><div class="row" style="gap:6px" id="ob_roles">' +
      ROLES.map(r => '<button type="button" class="chip' + ((onbData.roles || []).indexOf(r.k) >= 0 ? ' on' : '') + '" data-r="' + r.k + '" aria-pressed="' + ((onbData.roles || []).indexOf(r.k) >= 0) + '">' + ic(r.icon, 13) + esc(r.label) + '</button>').join('') + '</div></div>' +
      '<div class="field"><span class="field-label">Участие в событиях по умолчанию</span><div id="ob_part">' +
      renderParticipationSwitch({id:'__onboarding__'}, {size:'lg', variant:'onboarding', draft:true, status:onbData.participation}) +
    '</div></div>';
  } else if (onbStep === 1) {
    h += '<div class="onb-hero">' + ic('users', 28) + '</div><h2>Ваш коллектив</h2>' +
      '<p class="lead">Название появится в шапке, на главном экране и в печатных сет-листах.</p>' +
      '<div class="field"><label class="field-label" for="ob_band">Название группы *</label><input class="input" id="ob_band" maxlength="50" value="' + esc(onbData.bandName) + '" placeholder="Neon Coast"><span class="err"></span></div>' +
      '<div class="field"><label class="field-label" for="ob_banddesc">О группе</label><textarea class="input" id="ob_banddesc" rows="3" style="font-family:var(--font);min-height:84px" placeholder="Направление, состав, задачи">' + esc(onbData.bandDesc) + '</textarea></div>' +
      '<div class="field"><span class="field-label">Акцентный цвет интерфейса</span><div class="swatches">' +
      ACCENTS.map(a => '<button type="button" class="sw' + (onbData.accentPreset === a ? ' on' : '') + '" data-a="' + a + '" aria-label="Акцент ' + esc(ACCENT_LABELS[a] || a) + '"><span class="sw-dot" data-preset="' + a + '" aria-hidden="true"></span><span class="sw-name">' + esc(ACCENT_LABELS[a] || a) + '</span>' + (onbData.accentPreset === a ? ic('check', 14) : '') + '</button>').join('') + '</div></div>';
  } else if (onbStep === 2) {
    h += '<div class="onb-hero">' + ic('wave', 28) + '</div><h2>Состав группы</h2>' +
      '<p class="lead">Группа создастся с вашим аккаунтом. Остальных участников не нужно вводить вручную: пригласите их кодом после запуска, и их имена и роли появятся у всех автоматически.</p>' +
      '<div class="onb-callout"><strong>Сейчас вы добавляете только себя.</strong><br>Другие участники присоединяются через «Код приглашения».</div>';
  } else {
    h += '<div class="onb-hero">' + ic('check', 28) + '</div><h2>Всё готово</h2>' +
      '<p class="lead">Оформление, роли и данные можно изменить в любой момент в разделе «Настройки».</p>' +
      '<div class="field"><span class="field-label">Тема</span><div class="seg" id="ob_theme">' +
      THEMES.map(t => '<button type="button" data-v="' + t.id + '" class="' + (onbData.theme === t.id ? 'on' : '') + '" data-accent="1">' + ic(t.icon, 14) + esc(t.label) + '</button>').join('') + '</div></div>';
  }
  h += '<div class="onb-foot">' + (onbStep > 0 ? '<button class="btn btn-secondary" type="button" id="ob_back">' + ic('left', 16) + 'Назад</button>' : '<span></span>') +
    (onbStep < 3 ? '<button class="btn btn-primary" type="button" id="ob_next">Продолжить' + ic('right', 16) + '</button>' : '<button class="btn btn-primary" type="button" id="ob_done">' + ic('check', 16) + 'Начать работу</button>') + '</div></div>';
  el.innerHTML = h; el.setAttribute('aria-hidden', 'false');
  const bind = (id, ev, fn) => { const e = $('#' + id, el); if (e) e.addEventListener(ev, fn); };
  if (onbStep === 0) {
    $$('#ob_roles .chip', el).forEach(b => b.addEventListener('click', () => { const k = b.getAttribute('data-r'), i = onbData.roles.indexOf(k); if (i >= 0) onbData.roles.splice(i, 1); else onbData.roles.push(k); onbData.role = onbData.roles[0] || ''; b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0); const rb = $('#ob_roles', el); if (rb) rb.classList.remove('invalid'); }));
    bind('ob_name', 'input', e => { onbData.name = e.target.value; });
  }
  if (onbStep === 1) {
    bind('ob_band', 'input', e => { onbData.bandName = e.target.value; });
    bind('ob_banddesc', 'input', e => { onbData.bandDesc = e.target.value; });
    $$('.sw', el).forEach(b => b.addEventListener('click', () => { onbData.accentPreset = b.getAttribute('data-a'); $$('.sw', el).forEach(x => x.classList.toggle('on', x === b)); }));
  }
  if (onbStep === 2) {
    // Membership is account-driven. No local roster editing is performed during onboarding.
  }
  if (onbStep === 3) {
    $$('#ob_theme button', el).forEach(b => b.addEventListener('click', () => { onbData.theme = b.getAttribute('data-v'); $$('#ob_theme button', el).forEach(x => x.classList.toggle('on', x === b)); }));
  }
  bind('ob_back', 'click', () => { collectStep(el); onbStep = Math.max(0, onbStep - 1); drawOnb(); });
  bind('ob_next', 'click', () => {
    collectStep(el);
    if (onbStep === 0) { if (!onbData.name.trim()) { onbErr(el, 'ob_name', 'Введите имя — оно используется в профиле и составе'); return; } if (!onbData.role) { const rb = $('#ob_roles', el); if (rb) rb.classList.add('invalid'); return; } }
    if (onbStep === 1 && !onbData.bandName.trim()) { onbErr(el, 'ob_band', 'Введите название группы'); return; }
    onbStep++; drawOnb();
  });
  bind('ob_done', 'click', () => { collectStep(el); finishOnboarding(); });
}
function onbErr(el, id, msg) {
  const inp = $('#' + id, el);
  if (inp) { const f = inp.closest('.field'); if (f) { f.classList.add('invalid'); const e = $('.err', f); if (e) e.innerHTML = ic('alert', 13) + '<span>' + esc(msg) + '</span>'; } inp.focus(); }
  toast(msg, 'warn');
}
function memberRowHTML(m, i) {
  return '<div class="ob-member" data-ob-row="' + i + '">' +
    '<div class="avatar" aria-hidden="true">' + esc((m.name || '?').charAt(0).toUpperCase()) + '</div>' +
    '<div class="grow"><label class="sr-only" for="ob_mn_' + i + '">Имя участника</label><input class="input mb-s" id="ob_mn_' + i + '" data-ob-name="' + i + '" maxlength="50" value="' + esc(m.name) + '" placeholder="Имя участника">' +
    '<div class="row" style="gap:6px" data-ob-role="' + i + '">' +
    ROLES.map(r => '<button type="button" class="chip' + (m.role === r.k ? ' on' : '') + '" data-r="' + r.k + '" style="padding:7px 11px;font-size:11.5px;min-height:var(--tap)" aria-pressed="' + (m.role === r.k) + '">' + esc(r.label) + '</button>').join('') + '</div></div>' +
    (i > 0 ? '<button class="icon-btn" type="button" data-ob-del="' + i + '" aria-label="Удалить участника">' + ic('x', 15) + '</button>' : '') + '</div>';
}
function bindMemberInputs(el) {
  onbData.members.forEach(function (m, i) {
    const inp = $('[data-ob-name="' + i + '"]', el);
    if (inp) inp.addEventListener('input', e => { m.name = e.target.value; });
    $$('[data-ob-role="' + i + '"] .chip', el).forEach(b => b.addEventListener('click', function () {
      m.role = b.getAttribute('data-r');
      $$('[data-ob-role="' + i + '"] .chip', el).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    }));
  });
}
function collectMembers(el) { onbData.members.forEach(function (m, i) { const inp = $('[data-ob-name="' + i + '"]', el); if (inp) m.name = inp.value; }); }
function collectStep(el) {
  if (onbStep === 0) { const n = $('#ob_name', el); if (n) onbData.name = n.value; }
  if (onbStep === 1) { const b = $('#ob_band', el); if (b) onbData.bandName = b.value; const d = $('#ob_banddesc', el); if (d) onbData.bandDesc = d.value; }
  if (onbStep === 2) { /* roster is account-driven */ }
}
async function finishOnboarding() {
  state.profile.name = onbData.name.trim() || 'Участник';
  state.profile.roles = (onbData.roles || []).slice();
  state.profile.role = state.profile.roles[0] || onbData.role;
  state.profile.bandName = onbData.bandName.trim() || 'Моя группа';
  state.profile.bandDesc = onbData.bandDesc;
  state.profile.defaultParticipation = onbData.participation;
  state.settings.theme = onbData.theme;
  state.settings.accentPreset = onbData.accentPreset || 'blue'; state.settings.accent = presetAccentColor(state.settings.accentPreset, state.settings.theme);
  state.members = [{ id: uid('m'), accountId: window.BandPlanCloud?.user?.()?.id || '', name: state.profile.name, role: state.profile.role, roles: myRoles(), note: 'это вы' }];
  state.onboardingDone = true;

  let cloudConfirmed = false;
  applyTheme();
  applyAccentVars();

  /*
    Provision the server account/group before writing the Auth onboarding marker.
    The marker must never suppress onboarding on another device while the
    authoritative Supabase account row is still missing.
  */
  if(window.BandPlanCloud?.saveNow && navigator.onLine !== false) {
    try {
      await window.BandPlanCloud.saveNow(state);
      cloudConfirmed = true;
    } catch(error) {
      console.warn('BandPlan onboarding remote save deferred:', error);
      save();
    }
  } else {
    save();
  }

  if(cloudConfirmed && window.BandPlanCloud?.markOnboardingComplete) {
    await window.BandPlanCloud.markOnboardingComplete();
  }
  if(cloudConfirmed && window.BandPlanCloud?.clearJustRegistered) {
    window.BandPlanCloud.clearJustRegistered();
  }
  $('#onb').classList.remove('on');
  $('#onb').setAttribute('aria-hidden', 'true');
  go('#/calendar');
  render();
  toast('BandPlan готов · роль: ' + roleLabel(state.profile.role), 'ok');
}

/* ═══ 21. ACTIONS ═══ */
document.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act="open-song"],[data-act="open-setlist"]') && !e.target.closest('button,input,select,textarea,a')) {
    e.preventDefault(); e.target.click();
  }
});
document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-act]');
  if (!el) { if (!e.target.closest('#searchWrap')) closeSearch(); return; }
  const a = el.getAttribute('data-act'), id = el.getAttribute('data-id');
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const btnLoading = b => { if (b) { b.classList.add('loading'); setTimeout(() => b.classList.remove('loading'), 500); } };
  switch (a) {
    case 'modal-close': stop(); closeModal(); break;
    case 'account-logout': {
      stop();
      const b=el;
      b.disabled=true;
      window.BandPlanCloud.signOut()
        .catch(err=>{b.disabled=false;toast('Не удалось выйти: '+(err.message||''),'err');});
      break;
    }
    case 'group-leave': {
      stop();
      confirmBox('Выйти из группы?', 'Вы потеряете доступ к её песням, событиям и сет-листам.', async function () {
        try {
          await window.BandPlanCloud.leaveGroup();
          state.songs = [];
          state.events = [];
          state.setlists = [];
          state.members = [];
          state.profile.bandName = 'Моя группа';
          state.profile.bandDesc = '';
          state.profile.eventParticipation = {};
          state.profile.groupDetached = true;
          state.onboardingDone = true;
          if (!syncIsCurrent()) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
          hardClose(modalRoot);
          render();
          toast('Вы вышли из группы', 'ok');
        } catch (err) {
          toast('Не удалось выйти из группы: ' + (err.message || 'Ошибка'), 'err');
        }
      }, 'Выйти', true);
      break;
    }
    case 'confirm-yes': { stop(); const cb = confirmCb; hardClose(modalRoot); if (cb) cb(); break; }
    case 'reload-view': stop(); ui.skeleton = true; render(); break;
    case 'nav': {
      /* Native anchor navigation is allowed, but the new route is rendered
         synchronously from the first click so no second click is ever needed. */
      e.preventDefault();
      e.stopPropagation();
      const target = '#/' + el.getAttribute('data-to');
      ui.skeleton = false;
      if (location.hash === target) {
        routeTransition();
      } else {
        skipNextHashRoute = true;
        location.hash = target;
        routeTransition();
      }
      break;
    }
    case 'theme-toggle': stop(); cycleTheme(); break;
    case 'settings-tab': {
      stop();
      const tabs = el.closest('.settings-tabs');
      const scrollLeft = tabs ? tabs.scrollLeft : 0;
      ui.settingsTab = el.getAttribute('data-v') || 'profile';
      render();
      // Rendering replaces the settings markup. Restore the horizontal
      // position so selecting a tab never jumps the tab strip forward.
      requestAnimationFrame(() => {
        const nextTabs = $('.settings-tabs');
        if (nextTabs) nextTabs.scrollLeft = scrollLeft;
      });
      break;
    }
    case 'theme-set': stop(); setTheme(el.getAttribute('data-v')); break;
    case 'accent-set': stop(); applyAccent(el.getAttribute('data-v')); break;
    case 'accent-reset': stop(); applyAccent('blue'); break;
    case 'notation-set': stop(); state.settings.notation = el.getAttribute('data-v'); commit(); break;
    case 'weekstart-set': stop(); state.settings.weekStart = +el.getAttribute('data-v'); save(); render(); $$('#modalOverlay [data-act="weekstart-set"]').forEach(b => b.classList.toggle('on', +b.getAttribute('data-v') === state.settings.weekStart)); break;
    case 'toggle-auto': stop(); state.settings.autoscroll = !state.settings.autoscroll; commit(); break;
    case 'toggle-reduced': stop(); state.settings.reduced = !state.settings.reduced; applyTheme(); commit(); break;
    case 'toast-mode': stop(); state.settings.toastMode = el.getAttribute('data-v'); save(); render(); break;
    case 'toggle-chords': stop(); state.settings.showChords = state.settings.showChords === false; save(); render(); break;
    case 'toggle-lyrics': {
      stop();
      const shell = el.closest('.lyrics-expand-shell');
      if (!shell) break;
      const expanded = shell.classList.toggle('is-expanded');
      shell.classList.toggle('is-collapsed', !expanded);
      el.setAttribute('aria-expanded', String(expanded));
      const label = expanded ? 'Свернуть текст' : 'Показать весь текст';
      el.setAttribute('aria-label', label);
      el.setAttribute('title', label);
      break;
    }
    case 'scene-chords': stop(); state.settings.showChords = state.settings.showChords === false; save(); drawScene(); break;
    case 'offline-song-refresh-all': { stop(); syncEventOfflineSongs().then(refreshOfflineSettingsUI).catch(()=>{}); toast('Офлайн-копии обновляются','info',1800); break; }
    case 'offline-song-clear-all': { stop(); confirmBox('Очистить офлайн-копии?', 'Песни будут удалены только с этого устройства. Облачные песни и сет-листы останутся без изменений.', async function(){ try{ await window.BandPlanCloud?.clearOfflineEventSongs?.(); await refreshOfflineSettingsUI(); render(); toast('Офлайн-копии очищены','ok'); }catch(error){toast(error.message||'Не удалось очистить копии','err',5000);} }, 'Очистить всё', true); break; }
    case 'pwa-install': stop(); doInstall(); break;
    case 'dyn-ramp': { stop(); const k = el.getAttribute('data-ins'), up = el.getAttribute('data-d') === 'up', ss = dynDraft.sections || []; dynDraft.levels[k] = dynDraft.levels[k] || {}; ss.forEach((x, i) => { const f = ss.length > 1 ? i / (ss.length - 1) : 1; dynDraft.levels[k][x] = DYN_LEVELS[1 + Math.round((up ? f : 1 - f) * 5)]; }); renderDynBlock(); break; }
    case 'dyn-copy': { stop(); const k = el.getAttribute('data-ins'); dynDraft.instruments.forEach(o => { if (o !== k) dynDraft.levels[o] = Object.assign({}, dynDraft.levels[k] || {}); }); renderDynBlock(); break; }
    case 'dyn-del-section': { stop(); const x = el.getAttribute('data-sec'); dynDraft.sections = (dynDraft.sections || []).filter(y => y !== x); Object.keys(dynDraft.levels || {}).forEach(k => { delete dynDraft.levels[k][x]; }); renderDynBlock(); break; }
    case 'role-set': { stop(); const k = el.getAttribute('data-v'), a2 = myRoles().slice(), i = a2.indexOf(k); if (i >= 0) a2.splice(i, 1); else a2.push(k); state.profile.roles = a2; state.profile.role = a2[0] || ''; commit(); break; }
    case 'part-def': stop(); state.profile.defaultParticipation = el.getAttribute('data-v'); commit(); break;
    case 'cal-nav': {
      stop();
      const d = +el.getAttribute('data-d');
      if (ui.calView === 'month') ui.month.setMonth(ui.month.getMonth() + d);
      else if (ui.calView === 'week') ui.month.setDate(ui.month.getDate() + d * 7);
      else { const x = new Date((ui.selDate || today()) + 'T00:00:00'); x.setDate(x.getDate() + d); ui.selDate = iso(x); ui.month = new Date(x); }
      render(); break;
    }
    case 'cal-today': stop(); ui.month = new Date(); ui.selDate = today(); if (parseHash().name !== 'calendar') go('#/calendar'); else render(); break;
    case 'cal-view': stop(); ui.calView = el.getAttribute('data-v'); state.settings.calView = ui.calView; save(); render(); break;
    case 'cal-day': { stop(); ui.selDate = el.getAttribute('data-date'); ui.month = new Date(ui.selDate + 'T00:00:00'); render(); break; }
    case 'tg-day': stop(); ui.selDate = el.getAttribute('data-date'); ui.calView = 'day'; render(); break;
    case 'tg-col': stop(); if (e.target.closest('.tg-ev')) break; ui.selDate = el.getAttribute('data-date'); eventModal(null, el.getAttribute('data-date')); break;
    case 'new-event': stop(); eventModal(null, el.getAttribute('data-date') || ui.selDate); break;
    case 'event-info': stop(); eventInfoModal(id, el.getAttribute('data-date') || ''); break;
    case 'event-edit': stop(); eventModal(id); break;
    case 'event-save': {
      stop();
      const button = el;
      if (button) button.disabled = true;
      let data;
      try {
        data = readEventForm(id);
      } catch (formError) {
        console.error('BandPlan event form read failed:', formError);
        if (button) button.disabled = false;
        toast('Не удалось прочитать данные события. Проверьте поля и попробуйте ещё раз.', 'err', 5000);
        break;
      }
      if (!data) {
        if (button) button.disabled = false;
        break;
      }

      /*
        Save the event immediately to the local account snapshot and let the
        existing cloud queue send the same snapshot to Supabase in the
        background. Do not await the network here: a slow/hanging Supabase
        request must never leave the editor stuck in a loading state.
      */
      const previous = id ? state.events.find(x => x.id === id) : null;
      const personalStatus = data.personalStatus || '';
      delete data.personalStatus;

      try {
        if (id) {
          const index = state.events.findIndex(x => x.id === id);
          if (index >= 0) state.events[index] = data;
          else state.events.push(data);
        } else {
          state.events.push(data);
        }

        try {
          setMyParticipation(data, personalStatus, new Date().toISOString());
        } catch (participationError) {
          console.warn('BandPlan event participation write deferred:', participationError);
        }

        ui.selDate = data.date;
        ui.month = new Date(data.date + 'T00:00:00');
        modalDirty = false;

        /*
          Close and redraw first. localStorage/queue serialization can be
          expensive on large workspaces, so it must never keep the Save button
          or modal visibly stuck.
        */
        hardClose(modalRoot);
        try {
          render();
        } catch (renderError) {
          console.error('BandPlan event saved; view refresh failed:', renderError);
          const view = $('#view');
          if (view) view.innerHTML = stateHTML(
            'err',
            'Событие сохранено',
            'Данные сохранены. Откройте расписание повторно.',
            '<button class="btn btn-primary" type="button" data-act="cal-today">Открыть расписание</button>'
          );
          document.body.style.overflow = '';
        }
        toast(id ? 'Изменения события сохранены' : 'Событие сохранено', 'ok');

        // Persist the local snapshot immediately after the UI is responsive.
        // Send this event snapshot to Supabase directly instead of waiting for
        // the normal 350ms debounce: realtime can otherwise refresh the old
        // server state before the newly created event reaches the database.
        setTimeout(() => {
          try {
            expandCache.clear();
            searchCorpus = null;
            try { localStorage.setItem(KEY, JSON.stringify(state)); }
            catch (storageError) {
              console.warn('BandPlan event local persistence failed:', storageError);
            }
            if (window.BandPlanCloud && typeof window.BandPlanCloud.saveNow === 'function') {
              window.__bandplanEventSavePending = true;
              Promise.resolve(window.BandPlanCloud.saveNow(state))
                .catch(saveError => {
                  console.error('BandPlan event cloud save failed:', saveError);
                  window.dispatchEvent(new CustomEvent('bandplan:sync-error', {
                    detail: saveError?.message || 'Не удалось синхронизировать событие с сервером.'
                  }));
                })
                .finally(() => {
                  window.__bandplanEventSavePending = false;
                });
            }
            scheduleOfflineSongSync();
          } catch (saveError) {
            console.error('BandPlan deferred event save failed:', saveError);
            window.dispatchEvent(new CustomEvent('bandplan:sync-error', {
              detail: saveError?.message || 'Не удалось сохранить событие.'
            }));
          }
        }, 0);
      } catch (error) {
        console.error('BandPlan event save failed:', error);
        if (id && previous) {
          const index = state.events.findIndex(x => x.id === id);
          if (index >= 0) state.events[index] = previous;
        } else if (!id) {
          state.events = state.events.filter(x => x.id !== data.id);
        }
        save();
        try { render(); } catch (e) {}
        toast('Не удалось сохранить событие: ' + (error?.message || 'неизвестная ошибка'), 'err', 5000);
      } finally {
        if (button) button.disabled = false;
      }
      break;
    }
    case 'event-del': {
      stop();
      const ev = evById(id); if (!ev) break;
      const occ = el.getAttribute('data-date');
      if (ev.repeat && ev.repeat !== 'none' && occ && occ !== ev.date) {
        confirmBox('Удалить одно вхождение?', 'Убрать только «' + ev.title + '» на ' + pdate(occ) + '? Остальные повторения серии останутся в расписании.', function () {
          ev.except = (ev.except || []).concat([occ]); commit(); toast('Дата ' + pdate(occ) + ' убрана из серии', 'ok');
        }, 'Удалить эту дату', true);
      } else {
        confirmBox('Удалить событие?', '«' + ev.title + '» будет удалено' + (ev.repeat && ev.repeat !== 'none' ? ' вместе со всеми повторениями серии' : '') + '. Отменить удаление можно будет только через резервную копию.', function () {
          state.events = state.events.filter(x => x.id !== id); commit(); toast('Событие удалено', 'ok');
        }, 'Удалить событие', true);
      }
      break;
    }
    case 'event-done': { stop(); const ev = evById(id); if (ev) { ev.status = 'done'; commit(); toast('Событие отмечено как проведённое', 'ok'); } break; }
    case 'event-undone': { stop(); const ev = evById(id); if (ev) { ev.status = 'upcoming'; commit(); toast('Событие возвращено в план', 'info'); } break; }
    case 'my-status': {
      stop();
      const eventId=String(id||'');
      let value=String(el.getAttribute('data-v')||'');
      const isDraft=el.getAttribute('data-draft')==='1';
      const ev=evById(eventId);
      if (el.getAttribute('aria-pressed') === 'true') value='';
      if (isDraft && !ev) {
        if (eventId === '__onboarding__') onbData.participation = value;
        const roots = [modalRoot && $('#f_my', modalRoot), $('#ob_part')].filter(Boolean);
        roots.forEach(root => {
          $('[data-act="my-status"]', root).forEach(btn => {
            const active=btn.getAttribute('data-v')===value;
            btn.classList.toggle('on',active);
            btn.classList.toggle('status-yes',active&&value==='yes');
            btn.classList.toggle('status-maybe',active&&value==='maybe');
            btn.classList.toggle('status-no',active&&value==='no');
            btn.setAttribute('aria-pressed',String(active));
          });
        });
        return;
      }
      if(!ev || !participationMutable(ev))break;
      if(participationPending.has(eventId))break;
      const previous=eventStatusFor(ev)||'';
      const stamp=new Date().toISOString();
      participationPrevious.set(eventId,previous);
      setMyParticipation(ev,value,stamp);
      participationPending.add(eventId);
      persistParticipationLocal();
      refreshParticipationUI(eventId);
      const buttons=document.querySelectorAll('[data-act="my-status"][data-id="'+CSS.escape(eventId)+'"]');
      buttons.forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-busy','true');});
      const queue=async()=>{ try{ await window.BandPlanCloud?.queueEventParticipation?.(eventId,value,stamp); toast('Ответ сохранён на устройстве · ждёт отправки','info',2600); }catch(queueError){ 
        participationPrevious.delete(eventId); participationPending.delete(eventId);
        setMyParticipation(ev,previous,new Date().toISOString()); persistParticipationLocal(); refreshParticipationUI(eventId);
        console.warn('Participation queue failed:',queueError); toast('Не удалось сохранить ответ офлайн. Попробуйте ещё раз.','err',5000);
      } };
      const rollback=(message)=>{
        setMyParticipation(ev,previous,new Date().toISOString());
        participationPrevious.delete(eventId);
        participationPending.delete(eventId);
        persistParticipationLocal(); refreshParticipationUI(eventId);
        buttons.forEach(btn=>{btn.disabled=false;btn.removeAttribute('aria-busy');});
        toast(message,'err',5200);
      };
      if (navigator.onLine === false || !window.BandPlanCloud?.setEventParticipation) {
        queue().finally(()=>buttons.forEach(btn=>{btn.disabled=false;btn.removeAttribute('aria-busy');}));
        break;
      }
      window.BandPlanCloud.setEventParticipation(eventId,value,stamp).then(remote=>{
        const remoteStatus=remote&&typeof remote==='object' ? String(remote.status||'') : value;
        const remoteAt=remote&&typeof remote==='object' ? String(remote.updated_at||stamp) : stamp;
        setMyParticipation(ev,remoteStatus,remoteAt);
        participationPrevious.delete(eventId);
        participationPending.delete(eventId);
        persistParticipationLocal();
        refreshParticipationUI(eventId);
      }).catch(err=>{
        const msg=String(err?.message||err||'Ошибка сети');
        const retryable=!/EVENT_NOT_FOUND|GROUP_REQUIRED|AUTH_REQUIRED|INVALID_PARTICIPATION_STATUS|permission denied|row-level security/i.test(msg);
        if(retryable) queue().finally(()=>buttons.forEach(btn=>{btn.disabled=false;btn.removeAttribute('aria-busy');}));
        else rollback('Сервер отклонил отметку: событие больше недоступно или нет прав.');
      }).finally(()=>{
        if(!navigator.onLine) return;
        buttons.forEach(btn=>{btn.disabled=false;btn.removeAttribute('aria-busy');});
      });
      break;
    }
    case 'ev-filter-open': stop(); openEventFilters(); break;
    case 'ev-type': {
      stop();
      const v = el.getAttribute('data-v'), i = ui.evTypes.indexOf(v);
      if (i >= 0) ui.evTypes.splice(i, 1); else ui.evTypes.push(v);
      render();
      if ($('#modalOverlay').classList.contains('on')) {
        $$('#modalOverlay [data-act="ev-type"]').forEach(b => { const on = ui.evTypes.indexOf(b.getAttribute('data-v')) >= 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        const c = $('#evFilterDone'); if (c) c.textContent = 'Показать ' + filteredUpcoming().length;
      }
      break;
    }
    case 'ev-mine': stop(); ui.evMine = !ui.evMine; render(); if ($('#modalOverlay').classList.contains('on')) { const b = $('#modalOverlay [data-act="ev-mine"]'); if (b) { b.classList.toggle('on', ui.evMine); b.setAttribute('aria-pressed', ui.evMine); } const c = $('#evFilterDone'); if (c) c.textContent = 'Показать ' + filteredUpcoming().length; } break;
    case 'ev-mine-mode': stop(); ui.evMineMode = ui.evMineMode === 'yes' ? 'maybe' : 'yes'; render(); if ($('#modalOverlay').classList.contains('on')) { const b = $('#modalOverlay [data-act="ev-mine-mode"]'); if (b) b.textContent = ui.evMineMode === 'maybe' ? 'Участвую или под вопросом' : 'Только участвую'; const d = $('#evFilterDone'); if (d) d.textContent = 'Показать ' + filteredUpcoming().length; } break;
    case 'ev-repeat': stop(); ui.evRepeat = !ui.evRepeat; render(); if ($('#modalOverlay').classList.contains('on')) { const b = $('#modalOverlay [data-act="ev-repeat"]'); if (b) { b.classList.toggle('on', ui.evRepeat); b.setAttribute('aria-pressed', ui.evRepeat); } const c = $('#evFilterDone'); if (c) c.textContent = 'Показать ' + filteredUpcoming().length; } break;
    case 'ev-clear': stop(); ui.evQuery = ''; render(); break;
    case 'ev-reset': stop(); ui.evTypes = []; ui.evMine = false; ui.evMineMode = 'yes'; ui.evRepeat = false; ui.evQuery = ''; render(); if ($('#modalOverlay').classList.contains('on')) { const c = $('#evFilterDone'); if (c) c.textContent = 'Показать ' + filteredUpcoming().length; } break;
    case 'new-song': stop(); songModal(null); break;
    case 'edit-song': stop(); songModal(id); break;
    case 'song-save': {
      stop(); btnLoading(el);
      const data = readSongForm(id); if (!data) break;
      if (id) { const i = state.songs.findIndex(x => x.id === id); if (i >= 0) state.songs[i] = data; } else state.songs.push(data);
      modalDirty = false; hardClose(modalRoot); save(); go(id ? '#/song/' + id : '#/songs'); render();
      toast(id ? 'Изменения песни сохранены' : 'Песня добавлена в репертуар', 'ok');
      break;
    }
    case 'song-del': {
      stop();
      const s = songById(id); if (!s) break;
      confirmBox('Удалить песню?', '«' + s.title + '» будет удалена из репертуара и из всех сет-листов, где она используется.', function () {
        state.songs = state.songs.filter(x => x.id !== id);
        state.setlists.forEach(sl => { sl.items = (sl.items || []).filter(it => it.songId !== id); });
        save(); go('#/songs'); render(); toast('Песня удалена', 'ok');
      }, 'Удалить песню', true);
      break;
    }
    case 'open-song': { stop(); if (parseHash().name === 'songs' && window.matchMedia && window.matchMedia('(min-width:1100px)').matches) { ui.songSelectedId = id; render(); } else go('#/song/' + id); break; }
    case 'fav': { stop(); const s = songById(id); if (!s) break; s.fav = !s.fav; save(); render(); toast(s.fav ? 'Песня в избранном' : 'Песня убрана из избранного', 'info', 2000); break; }
    case 'fav-filter': stop(); ui.songFav = !ui.songFav; render(); break;
    case 'tag': stop(); ui.songTag = el.getAttribute('data-v'); render(); if ($('#modalOverlay').classList.contains('on')) $$('#modalOverlay [data-act="tag"]').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === ui.songTag)); break;
    case 'song-filter-open': stop(); openSongFilters(); break;
    case 'song-clear': stop(); ui.songQuery = ''; render(); break;
    case 'setlist-clear': stop(); ui.setlistQuery = ''; render(); break;
    case 'song-key-clear': stop(); ui.songKey = ''; render(); break;
    case 'song-sort-reset': stop(); ui.songSort = 'title'; render(); break;
    case 'song-reset': stop(); ui.songQuery = ''; ui.songKey = ''; ui.songTag = ''; ui.songFav = false; ui.songSort = 'title'; render(); if ($('#modalOverlay').classList.contains('on')) hardClose(modalRoot); break;
    case 'song-trans': { stop(); ui.detailTrans[id] = clamp((ui.detailTrans[id] || 0) + (+el.getAttribute('data-d')), -11, 11); render(); break; }
    case 'song-trans-reset': stop(); ui.detailTrans[id] = 0; render(); break;
    case 'print-song': stop(); printSong(id, ui.detailTrans[id] || 0); break;
    case 'scene-song': stop(); openScene([{ songId: id, shift: ui.detailTrans[id] || 0, note: '' }], 0, 0); break;
    case 'to-setlist': stop(); addToSetlistModal(id); break;
    case 'dyn-clear': {
      stop(); dynDraft.notes = ''; dynDraft.sectionNotes = {};
      syncDynamicsSections(dynDraft, $('#f_slyr', modalRoot)?.value || '');
      const overall = $('#dynOverall', modalRoot); if (overall) overall.value = '';
      renderDynBlock(); break;
    }
    case 'new-setlist': stop(); setlistModal(null); break;
    case 'open-setlist': { stop(); if (parseHash().name === 'setlists' && window.matchMedia && window.matchMedia('(min-width:1100px)').matches) { ui.setlistSelectedId = id; render(); } else go('#/setlist/' + id); break; }
    case 'sl-rename': stop(); setlistModal(id); break;
    case 'sl-save': {
      stop(); btnLoading(el);
      const setlistName = fv('f_slname'); if (!setlistName) { fieldError('f_slname', 'Введите название сет-листа'); break; }
      let sl = id ? slById(id) : null;
      const picks = $$('.f_slsong:checked', modalRoot).map(c => c.value);
      if (sl) { sl.name = setlistName; sl.note = fv('f_slnote'); }
      else { sl = { id: uid('sl'), name: setlistName, note: fv('f_slnote'), eventId: '', items: picks.map(sid => ({ id: uid('i'), songId: sid, shift: 0, note: '' })) }; state.setlists.push(sl); }
      sl.updatedAt = new Date().toISOString();
      modalDirty = false; hardClose(modalRoot); save(); go('#/setlist/' + sl.id); render();
      toast(id ? 'Сет-лист обновлён' : 'Сет-лист создан', 'ok');
      break;
    }
    case 'sl-del': {
      stop();
      const sl = slById(id); if (!sl) break;
      confirmBox('Удалить сет-лист?', '«' + sl.name + '» будет удалён. Песни в репертуаре останутся, привязанное событие — без программы.', function () {
        state.setlists = state.setlists.filter(x => x.id !== id);
        state.events.forEach(ev => { if (ev.setlistId === id) ev.setlistId = ''; });
        save(); go('#/setlists'); render(); toast('Сет-лист удалён', 'ok');
      }, 'Удалить сет-лист', true);
      break;
    }
    case 'dup-setlist': {
      stop();
      const sl = slById(id); if (!sl) break;
      const c = cloneValue(sl);
      c.id = uid('sl'); c.name = sl.name + ' (копия)'; c.eventId = ''; c.updatedAt = new Date().toISOString();
      (c.items || []).forEach(it => { it.id = uid('i'); });
      state.setlists.push(c); save(); go('#/setlist/' + c.id); render(); toast('Копия сет-листа создана', 'ok');
      break;
    }
    case 'sl-add': { stop(); const slId = el.getAttribute('data-sl'); const songId = el.getAttribute('data-song'); const sl = slById(slId); if (!sl || !songId) { toast('Не удалось добавить песню', 'err'); break; } const alreadyAdded = (sl.items || []).some(item => item.songId === songId); if (alreadyAdded) { toast('Эта песня уже есть в сет-листе', 'info'); break; } addItem(slId, songId, -1); toast('Песня добавлена в сет-лист', 'ok', 2000); break; }
    case 'sl-search-add': { stop(); const slId = el.getAttribute('data-sl'); const songId = el.getAttribute('data-song'); const sl = slById(slId); if (!sl || !songId) break; if ((sl.items || []).some(item => item.songId === songId)) { toast('Эта песня уже есть в сет-листе', 'info'); break; } ui.libQuery = ''; addItem(slId, songId, -1); toast('Песня добавлена в сет-лист', 'ok', 1800); break; }
    case 'sl-add-go': { stop(); const slId = el.getAttribute('data-sl'); addItem(slId, el.getAttribute('data-song'), -1); hardClose(modalRoot); go('#/setlist/' + slId); toast('Песня добавлена в сет-лист', 'ok'); break; }
    case 'sl-item-del': { stop(); const sl = slById(el.getAttribute('data-sl')); if (!sl) break; sl.items = (sl.items || []).filter(x => x.id !== el.getAttribute('data-item')); sl.updatedAt = new Date().toISOString(); commit(); break; }
    case 'sl-item-move': {
      stop();
      const sl = slById(el.getAttribute('data-sl')); if (!sl) break;
      const arr = sl.items || [], i = arr.findIndex(x => x.id === el.getAttribute('data-item')), j = i + (+el.getAttribute('data-d'));
      if (i < 0 || j < 0 || j >= arr.length) break;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      sl.updatedAt = new Date().toISOString(); save(); render(); break;
    }
    case 'sl-shift': {
      stop();
      const sl = slById(el.getAttribute('data-sl')); if (!sl) break;
      const it = (sl.items || []).find(x => x.id === el.getAttribute('data-item')); if (!it) break;
      it.shift = clamp((it.shift || 0) + (+el.getAttribute('data-d')), -11, 11);
      sl.updatedAt = new Date().toISOString(); save(); render(); break;
    }
    case 'sl-item-note': {
      stop();
      const sl = slById(el.getAttribute('data-sl')); if (!sl) break;
      const it = (sl.items || []).find(x => x.id === el.getAttribute('data-item')); if (!it) break;
      const s = songById(it.songId);
      openModal({
        title: 'Заметка к песне', sub: s ? s.title : '',
        body: '<div class="field"><label class="field-label" for="f_inote">Что важно помнить</label><input class="input" id="f_inote" maxlength="120" value="' + esc(it.note || '') + '" placeholder="Например: вступление 8 тактов, без паузы"><span class="hint">Заметка видна в программе, на сцене и в печати</span></div>',
        footer: '<button class="btn btn-secondary" type="button" data-act="modal-close">Отмена</button><button class="btn btn-primary" type="button" data-act="sl-note-save" data-sl="' + sl.id + '" data-item="' + it.id + '">Сохранить заметку</button>'
      });
      break;
    }
    case 'sl-note-save': {
      stop();
      const sl = slById(el.getAttribute('data-sl')); if (!sl) break;
      const it = (sl.items || []).find(x => x.id === el.getAttribute('data-item')); if (!it) break;
      it.note = fv('f_inote'); sl.updatedAt = new Date().toISOString();
      modalDirty = false; hardClose(modalRoot); commit(); toast('Заметка сохранена', 'ok', 2000);
      break;
    }
    case 'sl-clear': {
      stop();
      const sl = slById(id); if (!sl) break;
      confirmBox('Очистить программу?', 'Все песни будут убраны из сет-листа «' + sl.name + '». Сам сет-лист и его заметки останутся.', function () {
        sl.items = []; sl.updatedAt = new Date().toISOString(); commit(); toast('Программа очищена', 'ok');
      }, 'Очистить программу', true);
      break;
    }
    case 'sl-meta-save': {
      stop(); btnLoading(el);
      const sl = slById(id); if (!sl) break;
      const newEv = $('#slEventSel') ? $('#slEventSel').value : '';
      if (sl.eventId && sl.eventId !== newEv) { const old = evById(sl.eventId); if (old && old.setlistId === sl.id) old.setlistId = ''; }
      sl.eventId = newEv;
      if (newEv) { const ev = evById(newEv); if (ev) ev.setlistId = sl.id; }
      sl.note = $('#slNoteInp') ? $('#slNoteInp').value.trim() : sl.note;
      sl.updatedAt = new Date().toISOString(); commit(); toast('Изменения сет-листа сохранены', 'ok');
      break;
    }
    case 'print-setlist': stop(); printSetlist(id); break;
    case 'offline-songs-refresh': { stop(); forceOfflineEventSongs(id).catch(error => toast(error.message || 'Не удалось обновить офлайн-копию','err',5000)); break; }
    case 'offline-songs-delete': {
      stop();
      window.BandPlanCloud?.deleteOfflineEventSongs?.(id).then(async()=>{
        const rows=await window.BandPlanCloud?.listOfflineEventSongs?.();
        rebuildOfflineSongIndex(Array.isArray(rows) ? rows : []);
        refreshOfflineEventInfo(id);
        toast('Песни удалены с устройства','info',2200);
      });
      break;
    }
    case 'scene-setlist': { stop(); const sl = slById(id); if (!sl) break; if (!(sl.items || []).length) { toast('В сет-листе нет песен — добавьте их в программу', 'warn'); break; } openScene(buildList(sl), 0, 0, sl.eventId || ''); break; }
    case 'scene-quick': stop(); quickScene(); break;
    case 'mem-add': stop(); memberModal(null); break;
    case 'mem-edit': stop(); memberModal(id); break;
    case 'mem-save': {
      stop(); btnLoading(el);
      const memberName = fv('f_mname'); if (!memberName) { fieldError('f_mname', 'Введите имя участника'); break; }
      const roleEls = $$('#f_mrole .chip.on', modalRoot);
      const data = { id: id || uid('m'), name: memberName, roles: roleEls.length ? roleEls.map(x => x.getAttribute('data-r')) : ['other'], role: roleEls.length ? roleEls[0].getAttribute('data-r') : 'other', note: fv('f_mnote') };
      if (id) { const i = state.members.findIndex(x => x.id === id); if (i >= 0) { data.accountId = state.members[i].accountId || ''; state.members[i] = data; } }
      else state.members.push(data);
      modalDirty = false; hardClose(modalRoot); commit(); toast(id ? 'Данные участника обновлены' : 'Участник добавлен в состав', 'ok');
      break;
    }
    case 'mem-del': {
      stop();
      const m = memById(id); if (!m) break;
      confirmBox('Удалить участника?', '«' + m.name + '» будет удалён из состава группы и из отметок участия в событиях.', function () {
        state.members = state.members.filter(x => x.id !== id); commit(); toast('Участник удалён', 'ok');
      }, 'Удалить участника', true);
      break;
    }
    case 'invite': {
      stop();
      const btn=el;
      btn.disabled=true;
      const cloud=window.BandPlanCloud;
      if(!cloud || typeof cloud.getInviteCode!=='function'){
        btn.disabled=false;
        openModal({
          title:'Облачное подключение недоступно',
          sub:'Невозможно создать группу без соединения с Supabase.',
          body:'<div class="state-box"><strong>BandPlan работает в локальном режиме.</strong><br><span class="t-muted">Обновите страницу и убедитесь, что вы вошли в аккаунт. После подключения Supabase кнопка создаст группу и код автоматически.</span></div>',
          footer:'<button class="btn btn-primary" type="button" data-act="modal-close">Понятно</button>'
        });
        break;
      }
      Promise.resolve().then(async()=>{
        const result=await cloud.getInviteCode(state.profile?.bandName||'Моя группа',myRoles());
        const code=typeof result==='string'?result:result?.code;
        if(!code)throw new Error('Сервер не вернул код приглашения.');
        if(result?.groupName)state.profile.bandName=result.groupName;
        state.profile.groupDetached=false;
        state.onboardingDone=true;
        try{await cloud.saveNow(state);}catch(syncError){console.warn('BandPlan invite state sync deferred:',syncError);}
        try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}
        const copied=await copyTextReliable(code);
        openModal({
          title:'Код приглашения',
          sub:'Отправьте этот код ребятам — они смогут вступить в вашу группу со своих аккаунтов.',
          body:'<div class="field"><label class="field-label" for="f_invite_code">Код группы</label><div class="row" style="gap:8px"><input class="input" id="f_invite_code" value="'+esc(code)+'" readonly spellcheck="false" style="font-weight:700;letter-spacing:.14em;text-transform:uppercase"><button class="btn btn-secondary" type="button" data-act="invite-copy">'+ic('copy',16)+'Скопировать</button></div><span class="hint">Код хранится в Supabase и действителен для вступления до 500 участников.</span></div>',
          footer:'<button class="btn btn-primary" type="button" data-act="modal-close">Готово</button>'
        });
        if(copied) toast('Код приглашения скопирован: '+code,'ok',5000);
        else toast('Код создан. Нажмите «Скопировать» рядом с кодом.','warn',6500);
      }).catch(err=>{
        console.error('BandPlan invite creation failed:',err);
        openModal({
          title:'Не удалось создать группу',
          sub:'Сервер вернул ошибку при создании группы или приглашения.',
          body:'<div class="state-box"><strong>'+esc(err?.message||'Неизвестная ошибка')+'</strong><br><span class="t-muted">Группа не была создана частично: операция выполняется одной транзакцией. Нажмите «Закрыть» и повторите попытку.</span></div>',
          footer:'<button class="btn btn-primary" type="button" data-act="modal-close">Закрыть</button>'
        });
      }).finally(()=>{btn.disabled=false;});
      break;
    }
    case 'invite-copy': {
      stop();
      const code=fv('f_invite_code');
      copyTextReliable(code).then(ok=>{
        if(ok) toast('Код приглашения скопирован: '+code,'ok',5000);
        else toast('Браузер не разрешил автоматическое копирование. Выделите код и скопируйте его вручную.','warn',6500);
      });
      break;
    }
    case 'group-join': {
      stop();
      openModal({title:'Вступить в группу',sub:'Введите код приглашения, который вам отправил участник группы.',body:'<div class="field"><label class="field-label" for="f_group_code">Код приглашения</label><input class="input" id="f_group_code" maxlength="20" autocomplete="off" placeholder="Например, 7A2F91C0B4"><span class="hint">После вступления песни, события и состав группы загрузятся из общего пространства.</span></div>',footer:'<button class="btn btn-secondary" type="button" data-act="modal-close">Отмена</button><button class="btn btn-primary" type="button" data-act="group-join-confirm">Вступить</button>'});
      break;
    }
    case 'group-join-confirm': {
      stop();
      const code=String(fv('f_group_code')||'').toUpperCase().replace(/[^0-9A-F]/g,'');
      if(!code){fieldError('f_group_code','Введите код приглашения');break;}
      el.disabled=true;el.classList.add('loading');
      window.BandPlanCloud.joinGroup(code,state.profile.name,myRoles()).then(async result=>{
        if(!result)throw new Error('Группа не найдена.');
        const loaded=await window.BandPlanCloud.load();if(!loaded?.state)throw new Error('Не удалось загрузить данные группы.');
        normalizeCloudState(loaded.state);
        state.profile.bandName=result.group_name||state.profile.bandName;
        state.profile.groupDetached=false;
        state.onboardingDone=true;
        modalDirty=false;hardClose(modalRoot);
        try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}
        applyTheme();applyAccentVars();render();
        toast('Вы вступили в группу «'+(result.group_name||'')+'». Данные группы загружены.','ok',4500);
      }).catch(err=>toast('Не удалось вступить: '+(err.message||'проверьте код'),'err',7000)).finally(()=>{el.disabled=false;el.classList.remove('loading');});
      break;
    }
    case 'account-delete': {
      stop();
      confirmBox('Удалить аккаунт?', 'Аккаунт, профиль, настройки, участие в группах и локальные данные будут удалены без возможности восстановления.', async function () {
        const button = el;
        try {
          if (button) { button.disabled = true; button.classList.add('loading'); }
          if (!window.BandPlanCloud?.deleteAccount) throw new Error('Сервис удаления аккаунта недоступен.');
          await window.BandPlanCloud.deleteAccount();
          state = defaults();
          try { localStorage.clear(); } catch (e) {}
          hardClose(modalRoot);
          if (window.BandPlanCloud?.signOut) {
            try { await window.BandPlanCloud.signOut(); } catch (e) {}
          }
          renderGate();
          toast('Аккаунт и связанные данные удалены', 'ok', 5000);
        } catch (err) {
          if (button) { button.disabled = false; button.classList.remove('loading'); }
          toast('Не удалось удалить аккаунт: ' + (err.message || 'Ошибка'), 'err', 7000);
        }
      }, 'Удалить аккаунт', true);
      break;
    }
    case 'export': stop(); exportData(); break;
    case 'import': stop(); $('#fileIn').click(); break;
    case 'demo': {
      stop();
      confirmBox('Загрузить демо-данные?', 'Текущие песни, события и сет-листы будут заменены демонстрационными. Профиль, состав и настройки сохранятся.', function () {
        const keepP = state.profile, keepM = state.members, keepS = state.settings, keepO = state.onboardingDone;
        state = defaults();
        state.profile = keepP; state.members = keepM; state.settings = keepS; state.onboardingDone = keepO;
        seedDemo(); state.profile = keepP; if (keepM.length) state.members = keepM;
        applyTheme(); applyAccentVars(); save(); hardClose(modalRoot); ui.skeleton = true; go('#/calendar');
        toast('Демо-данные загружены', 'ok');
      }, 'Загрузить демо');
      break;
    }
    case 'wipe': {
      stop();
      confirmBox('Удалить все данные?', 'Будут удалены песни, события, сет-листы, участники и настройки. Действие необратимо — сначала скачайте резервную копию.', function () {
        state = defaults(); state.onboardingDone = true; save(); applyTheme(); applyAccentVars(); hardClose(modalRoot); go('#/calendar'); toast('Все данные удалены', 'ok');
      }, 'Удалить все данные', true);
      break;
    }
    case 'scene-close': stop(); closeScene(); break;
    case 'scene-prev': stop(); if (scene.i > 0) { scene.i--; drawScene(); setAuto(scene.auto); } break;
    case 'scene-next': stop(); if (scene.i < scene.list.length - 1) { scene.i++; drawScene(); setAuto(scene.auto); } else toast('Это последняя песня в программе', 'info', 2000); break;
    case 'scene-auto': stop(); setAuto(!scene.auto); break;
    case 'scene-speed': stop(); scene.speed = clamp(scene.speed + (+el.getAttribute('data-d')), 10, 240); $('#scSpeed').textContent = scene.speed; break;
    case 'scene-font': stop(); scene.size = clamp(scene.size + (+el.getAttribute('data-d')), 14, 64); $('#scBody').style.setProperty('--scsize', scene.size + 'px'); $('#scFont').textContent = scene.size; break;
    case 'scene-trans': stop(); scene.shift = clamp(scene.shift + (+el.getAttribute('data-d')), -11, 11); drawScene(); break;
    case 'scene-fs': {
      stop();
      const s2 = $('#scene');
      if (!document.fullscreenElement) { if (s2.requestFullscreen) s2.requestFullscreen().catch(() => toast('Полноэкранный режим недоступен в этом браузере', 'warn')); }
      else if (document.exitFullscreen) document.exitFullscreen();
      break;
    }
  }
});
document.addEventListener('change', function (e) {
  const t = e.target;
  if (t && t.id === 'dynInstrumentFocus' && dynDraft) {
    dynDraft.activeInstrument = t.value || '';
    renderDynBlock();
    const details = $('#dynBlock .dyn-instrument-dropdown');
    if (details) details.open = true;
    return;
  }
  if (t.getAttribute && t.getAttribute('data-act') === 'dyn-lv' && dynDraft) {
    const ins = t.getAttribute('data-ins'), sec = t.getAttribute('data-sec');
    dynDraft.levels[ins] = dynDraft.levels[ins] || {};
    dynDraft.levels[ins][sec] = t.value;
    save();
  }
});
document.addEventListener('click', function (e) {
  const button = e.target.closest && e.target.closest('[data-act="insert-song-section"],[data-act="dyn-instrument-add"],[data-act="dyn-instrument-remove"],[data-act="dyn-instrument-remove-active"]');
  if (!button || !dynDraft) return;
  const action = button.getAttribute('data-act');
  if (action === 'insert-song-section') {
    const input = $('#f_slyr');
    if (!input) return;
    let section = button.getAttribute('data-section') || 'Припев';
    if (section === 'Куплет') {
      const used = extractSections(input.value);
      let number = 1;
      while (used.includes('Куплет ' + number)) number++;
      section = 'Куплет ' + number;
    }
    const start = input.selectionStart == null ? input.value.length : input.selectionStart;
    const end = input.selectionEnd == null ? start : input.selectionEnd;
    const before = input.value.slice(0, start), after = input.value.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    const insertion = prefix + '[' + section + ']\n';
    input.value = before + insertion + after;
    const cursor = (before + insertion).length;
    input.focus();
    input.setSelectionRange(cursor, cursor);
    syncDynamicsSections(dynDraft, input.value);
    renderDynBlock();
    return;
  }
  if (action === 'dyn-instrument-add') {
    const select = $('#dynInstrumentSelect');
    const ins = select && select.value;
    if (!ins || dynDraft.instruments.includes(ins)) return;
    dynDraft.instruments.push(ins);
    dynDraft.activeInstrument = ins;
    dynDraft.instrumentNotes[ins] = dynDraft.instrumentNotes[ins] || {};
    (dynDraft.sections || []).forEach(name => { if (!(name in dynDraft.instrumentNotes[ins])) dynDraft.instrumentNotes[ins][name] = ''; });
    renderDynBlock();
    const details = $('#dynBlock .dyn-instrument-dropdown');
    if (details) details.open = true;
    return;
  }
  if (action === 'dyn-instrument-remove' || action === 'dyn-instrument-remove-active') {
    const ins = action === 'dyn-instrument-remove-active' ? ($('#dynInstrumentFocus') && $('#dynInstrumentFocus').value) : button.getAttribute('data-ins');
    if (!ins) return;
    dynDraft.instruments = dynDraft.instruments.filter(key => key !== ins);
    if (dynDraft.activeInstrument === ins) dynDraft.activeInstrument = dynDraft.instruments[0] || '';
    renderDynBlock();
    const details = $('#dynBlock .dyn-instrument-dropdown');
    if (details) details.open = true;
    return;
  }
});
document.addEventListener('input', function (e) {
  const t = e.target;
  if (t.id === 'dynOverall' && dynDraft) { dynDraft.notes = t.value; return; }
  if (t.hasAttribute('data-dyn-instrument') && dynDraft) {
    const ins = t.getAttribute('data-dyn-instrument'), sec = t.getAttribute('data-sec');
    dynDraft.instrumentNotes[ins] = dynDraft.instrumentNotes[ins] || {};
    dynDraft.instrumentNotes[ins][sec] = t.value;
    return;
  }
  if (t.hasAttribute('data-dyn-section') && dynDraft) { dynDraft.sectionNotes[t.getAttribute('data-dyn-section')] = t.value; return; }
  if (t.id === 'f_slyr' && dynDraft) {
    const before = JSON.stringify(dynDraft.sections || []);
    syncDynamicsSections(dynDraft, t.value);
    if (before !== JSON.stringify(dynDraft.sections || [])) renderDynBlock();
  }
  const refocus = sel => { const n = $(sel); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (err) { } } };
  const soft = (sel, fn) => { clearTimeout(t._d); t._d = setTimeout(function () { const sc = $('#view').scrollTop; fn(); renderViewOnly(); refocus(sel); $('#view').scrollTop = sc; }, 220); };
  if (t.id === 'evQ') { ui.evQuery = t.value; soft('#evQ', () => { }); }
  if (t.id === 'songQ') { ui.songQuery = t.value; soft('#songQ', () => { }); }
  if (t.id === 'setlistQ') { ui.setlistQuery = t.value; soft('#setlistQ', () => { }); }
  if (t.id === 'libQ') { ui.libQuery = t.value; soft('#libQ', () => { }); }
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  const el = e.target.closest && e.target.closest('[role="link"][data-act]');
  if (el && el.getAttribute('tabindex') === '0') { e.preventDefault(); el.click(); }
});

/* ═══ 22. SEARCH WIRING ═══ */
function wireSearch() {
  const inp = $('#globalSearch'), dd = $('#searchDrop');
  if (!inp) return;
  inp.addEventListener('focus', function () { ui.searchQ = inp.value; drawSearch(); });
  inp.addEventListener('input', debounce(function () { ui.searchQ = inp.value; drawSearch(); }, 130));
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSearch(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearch(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runSearch(ui.searchIdx); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); inp.blur(); }
  });
  dd.addEventListener('click', function (e) { const it = e.target.closest('[data-sr]'); if (it) runSearch(+it.getAttribute('data-sr')); });
  dd.addEventListener('mousemove', function (e) {
    const it = e.target.closest('[data-sr]'); if (!it) return;
    const i = +it.getAttribute('data-sr');
    if (i !== ui.searchIdx) { ui.searchIdx = i; $$('#searchDrop .sd-item').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-selected', 'false'); }); it.classList.add('sel'); it.setAttribute('aria-selected', 'true'); }
  });
  /* Mobile search sheet can be dismissed with a vertical swipe. */
  let sx = 0, sy = 0, tracking = false;
  dd.addEventListener('touchstart', function (e) {
    if (window.innerWidth > 640 || !e.touches[0]) return;
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true;
    dd.classList.remove('search-swipe-out');
  }, { passive: true });
  dd.addEventListener('touchend', function (e) {
    if (!tracking || window.innerWidth > 640 || !e.changedTouches[0]) return;
    tracking = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.25) {
      closeSearch();
      dd.classList.remove('search-swipe-out');
      const inp = $('#globalSearch');
      if (inp) inp.blur();
    }
  }, { passive: true });

  document.addEventListener('click', function (e) { if (!e.target.closest('#searchWrap')) closeSearch(); });
}

/* Навигация между вкладками выполняется только через меню.
   Горизонтальный свайп отключён намеренно. */

/* ═══ 24. KEYBOARD ═══ */
document.addEventListener('keydown', function (e) {
  const sceneOn = $('#scene').classList.contains('on');
  const modalOn = $('#modalOverlay').classList.contains('on');
  const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
  if (sceneOn) {
    if (e.key === 'Escape') { e.preventDefault(); closeScene(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (scene.i < scene.list.length - 1) { scene.i++; drawScene(); setAuto(scene.auto); } return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (scene.i > 0) { scene.i--; drawScene(); setAuto(scene.auto); } return; }
    if (e.key === ' ' && !typing) { e.preventDefault(); setAuto(!scene.auto); return; }
    if ((e.key === '+' || e.key === '=') && !typing) { e.preventDefault(); scene.size = clamp(scene.size + 2, 14, 64); $('#scBody').style.setProperty('--scsize', scene.size + 'px'); $('#scFont').textContent = scene.size; return; }
    if (e.key === '-' && !typing) { e.preventDefault(); scene.size = clamp(scene.size - 2, 14, 64); $('#scBody').style.setProperty('--scsize', scene.size + 'px'); $('#scFont').textContent = scene.size; return; }
    return;
  }
  if (e.key === 'Escape') {
    if (modalOn) { e.preventDefault(); closeModal(); return; }
    const searchDrop = $('#searchDrop');
    if (searchDrop && searchDrop.classList.contains('open')) { closeSearch(); return; }
  }
  if (typing || modalOn) return;
  const r = parseHash();
  if (r.name === 'calendar') {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      if (ui.calView === 'month') ui.month.setMonth(ui.month.getMonth() + d);
      else if (ui.calView === 'week') ui.month.setDate(ui.month.getDate() + d * 7);
      else { const x = new Date((ui.selDate || today()) + 'T00:00:00'); x.setDate(x.getDate() + d); ui.selDate = iso(x); ui.month = new Date(x); }
      render(); return;
    }
    if (e.key === 't' || e.key === 'е' || e.key === 'T') { ui.month = new Date(); ui.selDate = today(); render(); e.preventDefault(); return; }
    if (e.key === 'e' || e.key === 'у' || e.key === 'E') { e.preventDefault(); eventModal(null); return; }
  }
  const k = e.key.toLowerCase();
  if (k === 'n' || k === 'т') { e.preventDefault(); songModal(null); }
  else if (k === 's' || k === 'ы') { e.preventDefault(); setlistModal(null); }
});

/* ═══ 25. EXPORT / IMPORT / NET / STICKY ═══ */
function exportData() {
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bandplan-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    state.settings.lastBackup = today(); save(); render();
    toast('Резервная копия сохранена в загрузки', 'ok');
  } catch (e) { toast('Не удалось создать файл копии', 'err'); }
}
function wireImport() {
  $('#fileIn').addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = function () {
      try {
        const d = JSON.parse(String(rd.result));
        if (!d || typeof d !== 'object' || !Array.isArray(d.songs)) throw new Error('bad');
        const prev = JSON.stringify(state);
        state = Object.assign(defaults(), d);
        state.profile = Object.assign(defaults().profile, d.profile || {});
        state.settings = Object.assign(defaults().settings, d.settings || {});
        state.members = d.members || []; state.events = d.events || [];
        state.songs = d.songs || []; state.setlists = d.setlists || [];
        state.onboardingDone = true;
        applyTheme(); applyAccentVars(); save(); ui.skeleton = true; go('#/calendar');
        toast('Импорт завершён: ' + state.songs.length + ' песен, ' + state.events.length + ' событий', 'ok');
        setTimeout(function () {
          if (confirm('Вернуть данные, которые были до импорта?')) {
            try { state = JSON.parse(prev); applyTheme(); applyAccentVars(); save(); render(); toast('Данные восстановлены до импорта', 'info'); } catch (err) { toast('Не удалось откатить импорт', 'err'); }
          }
        }, 1200);
      } catch (err) { toast('Файл повреждён или не является копией BandPlan', 'err'); }
      e.target.value = '';
    };
    rd.onerror = function () { toast('Не удалось прочитать файл', 'err'); e.target.value = ''; };
    rd.readAsText(f);
  });
}
function setSyncStatus(kind, text, hideAfter) {
  const el = $('#syncStatus');
  if (!el) return;
  clearTimeout(el._hideTimer);
  el.className = 'sync-status ' + (kind || '');
  const labels = {syncing:'Синхронизация',ok:'Синхронизировано',offline:'Офлайн',err:'Ошибка синхронизации',update:'Доступна новая версия'};
  const icons = {syncing:'repeat',ok:'checkCircle',offline:'wifiOff',err:'alert',update:'bolt'};
  el.innerHTML = ic(icons[kind] || 'info', 15) + '<span class="sync-label">' + esc(text || labels[kind] || '') + '</span>';
  el.hidden = false;
  el.title = text || labels[kind] || '';
  if (hideAfter) el._hideTimer = setTimeout(() => { if (el) el.hidden = true; }, hideAfter);
}

function wireNet() {
  const bar = $('#netBar');
  // The old top network banner was intentionally removed from the UI.
  // Keep the network lifecycle hook safe for existing sync code.
  if (!bar) return; 
  const upd = () => {
    if (!bar) return;
    if (navigator.onLine) { bar.hidden = true; bar.innerHTML = ''; if (!bar.classList.contains('sync-error')) setSyncStatus('', '', 0); }
    else { bar.hidden = false; bar.innerHTML = ic('wifiOff', 16) + '<span>Нет сети. BandPlan работает офлайн — все изменения сохраняются на устройстве.</span><button class="netbar-close" type="button" aria-label="Закрыть уведомление">×</button>'; bar.classList.remove('sync-error'); setSyncStatus('offline','Офлайн',0); }
  };
  bar.addEventListener('click', e => { if (e.target.closest('.netbar-close')) bar.hidden = true; });
  // Network events are only UI hints. Do not run an initial offline check:
  // authenticated cloud sync is the authority and will report its real result.
  window.addEventListener('online', upd); window.addEventListener('offline', upd);
  window.addEventListener('bandplan:sync-error', e => { setSyncStatus('err', e.detail || 'Ошибка синхронизации', 0); if (bar && navigator.onLine) { bar.hidden = false; bar.innerHTML = ic('alert', 16) + '<span>Ошибка синхронизации. Данные сохранены локально.</span><button class="netbar-close" type="button" aria-label="Закрыть уведомление">×</button>'; bar.classList.add('sync-error'); } });
  // Intentionally no initial upd(): navigator.onLine can be false even when
  // Supabase is reachable, which previously showed a false "Офлайн" badge.
}
function wireStickyHeader() {
  const c = $('#view'), tb = $('#topbar');
  if (!c || !tb) return;
  /* Шапка и закреплённые элементы остаются на месте при прокрутке. */
  const update = () => tb.classList.toggle('stuck', c.scrollTop > 6);
  c.addEventListener('scroll', update, { passive: true });
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('hdr-hide');
    update();
  });
  document.body.classList.remove('hdr-hide');
  update();
}
/* ═══ 26. INIT ═══ */
function normalizeCloudState(d) {
  // Cloud hydration/realtime can replace the event collection without going
  // through save(). Invalidate the recurrence cache first, otherwise the
  // calendar may keep rendering deleted events from a previous calculation.
  if (typeof expandCache !== 'undefined' && expandCache && typeof expandCache.clear === 'function') expandCache.clear();
  const base = defaults(), x = d && typeof d === 'object' ? d : {};
  // Display mode is a local UI preference. Preserve it when shared cloud
  // state refreshes, while still accepting it from cloud if no local choice exists.
  state = Object.assign(base, x);
  state.profile = Object.assign(base.profile, x.profile || {});
  state.settings = Object.assign(base.settings, x.settings || {});
  try {
    const localAccent = localStorage.getItem('accent');
    if (/^#[0-9a-fA-F]{6}$/.test(localAccent || '')) state.settings.accent = localAccent.toUpperCase();
  } catch (e) {}
  state.members = Array.isArray(x.members) ? x.members : [];
  state.events = Array.isArray(x.events) ? x.events : [];
  state.songs = Array.isArray(x.songs) ? x.songs : [];
  state.setlists = Array.isArray(x.setlists) ? x.setlists : [];
  return state;
}
function hasMeaningfulState(s) {
  return !!(s && (
    (Array.isArray(s.songs) && s.songs.length) ||
    (Array.isArray(s.events) && s.events.length) ||
    (Array.isArray(s.members) && s.members.length) ||
    (Array.isArray(s.setlists) && s.setlists.length) ||
    (s.profile && (s.profile.name || (s.profile.bandName && s.profile.bandName !== 'Моя группа'))) ||
    s.onboardingDone
  ));
}
function isKnownDemoState(s) {
  if (!s || typeof s !== 'object') return false;
  const titles = ['Город не спит', 'Северный ветер', 'Эхо', 'Тише воды', '220 вольт', 'Маршрут построен'];
  const members = ['Аня Соколова', 'Марк Гринёв', 'Тимур Валеев', 'Лена Ким'];
  const songs = Array.isArray(s.songs) ? s.songs : [];
  const mems = Array.isArray(s.members) ? s.members : [];
  return songs.some(x => titles.indexOf(String(x && x.title || '')) >= 0 || String(x && x.artist || '') === 'Neon Coast') ||
    mems.some(x => members.indexOf(String(x && x.name || '')) >= 0);
}
async function shouldOpenAccountOnboarding() {
  // The profile wizard is a post-registration step, never a login step.
  if (state.onboardingDone) return false;

  try {
    const user = window.BandPlanCloud?.user?.();
    const meta = user?.user_metadata || {};

    // A durable marker always wins: this account has already completed setup.
    if (meta.bandplan_onboarding_done === true) {
      state.onboardingDone = true;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      return false;
    }

    // Registration intent is stored in Supabase metadata, not only in
    // sessionStorage, so email-confirmation flows can finish onboarding even
    // after the confirmation link opens a new tab/device.
    const onboardingRequired = meta.bandplan_onboarding_required === true;

    if (window.BandPlanCloud?.hasAccountIdentity) {
      const hasIdentity = await window.BandPlanCloud.hasAccountIdentity();
      if (hasIdentity) {
        state.onboardingDone = true;
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
        return false;
      }
    }

    // If authentication succeeded but no durable account profile exists,
    // this is an unprovisioned account and must complete the profile wizard.
    // Existing accounts have already returned above through hasAccountIdentity().
    if (onboardingRequired) return true;
    if (window.BandPlanCloud?.isJustRegistered && window.BandPlanCloud.isJustRegistered()) {
      return true;
    }
    // Do not infer "new account" from generic Auth metadata such as full_name.
    // Existing accounts legitimately have full_name; only the explicit
    // registration marker or the durable account row may open onboarding.
  } catch (e) {
    console.warn('BandPlan onboarding identity check failed:', e);
  }

  return false;
}

async function bootCloudSync(hadLocal, durableInfo) {
  const syncGeneration = (window.__bandplanCloudSyncGeneration || 0) + 1;
  window.__bandplanCloudSyncGeneration = syncGeneration;
  const expectedUserId = window.BandPlanCloud?.user?.()?.id || null;
  const syncIsCurrent = () =>
    syncGeneration === window.__bandplanCloudSyncGeneration &&
    !!window.BandPlanCloud?.user?.()?.id &&
    window.BandPlanCloud.user().id === expectedUserId;
  // Do not use navigator.onLine as the source of truth for cloud state.
  // It is only a browser hint and can report false in PWAs while Supabase is
  // reachable. The successful cloud load below decides whether we are online.
  setSyncStatus('syncing', 'Синхронизация', 0);
  if (!window.BandPlanCloud) {
    if (await shouldOpenAccountOnboarding()) openOnboarding();
    return;
  }
  try {
    const local = cloneValue(state);
    /*
      If IndexedDB contains a pending snapshot, it is newer than the last
      confirmed cloud state. Never overwrite it with remote data on boot.
    */
    if (!syncIsCurrent()) return;
    if (durableInfo?.pendingSync && durableInfo.state) {
      normalizeCloudState(durableInfo.state);
      let pendingConfirmed = false;
      if (navigator.onLine !== false) {
        try {
          await window.BandPlanCloud.saveNow(state);
          if (!syncIsCurrent()) return;
          pendingConfirmed = true;
        } catch (syncError) {
          console.warn('BandPlan pending offline sync deferred:', syncError);
        }
      }
      if (pendingConfirmed) {
        try {
          if (!syncIsCurrent()) return;
          const confirmed = await window.BandPlanCloud.load();
          if (!syncIsCurrent()) return;
          if (confirmed?.state && hasMeaningfulState(confirmed.state)) normalizeCloudState(confirmed.state);
        } catch (loadError) {
          console.warn('BandPlan remote confirmation deferred:', loadError);
        }
      }
    } else {
      if (!syncIsCurrent()) return;
      const remote = await window.BandPlanCloud.load();
      const remoteState = remote && remote.state && typeof remote.state === 'object' ? remote.state : null;
      if (remoteState && hasMeaningfulState(remoteState)) {
        if (isKnownDemoState(remoteState) && hasMeaningfulState(local) && !isKnownDemoState(local)) {
          normalizeCloudState(local);
          await window.BandPlanCloud.saveNow(state);
          if (!syncIsCurrent()) return;
        } else if (!isKnownDemoState(remoteState)) {
          normalizeCloudState(remoteState);
        } else {
          normalizeCloudState(defaults());
          await window.BandPlanCloud.saveNow(state);
          if (!syncIsCurrent()) return;
        }
      } else if (hasMeaningfulState(local) && !isKnownDemoState(local)) {
        normalizeCloudState(local);
        await window.BandPlanCloud.saveNow(state);
        if (!syncIsCurrent()) return;
      } else {
        normalizeCloudState(defaults());
        await window.BandPlanCloud.saveNow(state);
        if (!syncIsCurrent()) return;
      }
    }
    if (!syncIsCurrent()) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    applyTheme();
    applyAccentVars();
    ui.calView = state.settings.calView || 'month';
    render();
    await hydrateOfflineSongsIntoState();
    scheduleOfflineSongSync(300);
    if (!syncIsCurrent()) return;
    if (await shouldOpenAccountOnboarding()) {
      if (!syncIsCurrent()) return;
      openOnboarding();
    }
    if (!syncIsCurrent()) return;
    setSyncStatus('ok', 'Синхронизировано', 2200);
    if (!syncIsCurrent()) return;
    window.BandPlanCloud.subscribe(function (incoming) {
      // A newly created/edited event is persisted in the background. Do not
      // let a realtime refresh with the previous server snapshot overwrite
      // the just-rendered local event while that save is in flight.
      if (window.__bandplanEventSavePending) return;
      if (!syncIsCurrent()) return;
      if (!incoming || typeof incoming !== 'object' || isKnownDemoState(incoming)) return;

      const beforeEvents = cloneValue(state.events || []);
      const before = JSON.stringify({
        profile: state.profile,
        settings: state.settings,
        members: state.members,
        songs: state.songs,
        setlists: state.setlists,
        events: beforeEvents.map(ev => {
          const copy = Object.assign({}, ev);
          delete copy.participation;
          return copy;
        })
      });

      normalizeCloudState(incoming);

      const after = JSON.stringify({
        profile: state.profile,
        settings: state.settings,
        members: state.members,
        songs: state.songs,
        setlists: state.setlists,
        events: (state.events || []).map(ev => {
          const copy = Object.assign({}, ev);
          delete copy.participation;
          return copy;
        })
      });

      if (before === after) {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
        (state.events || []).forEach(ev => {
          const oldEv = beforeEvents.find(x => String(x.id) === String(ev.id));
          if (oldEv && JSON.stringify(oldEv.participation || {}) !== JSON.stringify(ev.participation || {})) {
            refreshParticipationUI(ev.id);
          }
        });
        refreshMemberParticipationUI();
        return;
      }

      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      applyTheme();
      applyAccentVars();
      ui.calView = state.settings.calView || 'month';
      render();
    }, function (change) {
      if (!change || typeof change !== 'object') return;
      applyRealtimeParticipation(change);
    });
  } catch (e) {
    console.warn('BandPlan cloud sync unavailable:', e);
    // Do not turn a Supabase/Auth/database error into an "Офлайн" state just
    // because navigator.onLine is false. That value is advisory and is known
    // to be unreliable in PWAs. A real offline state is entered explicitly
    // by the offline boot path or the browser offline event.
    setSyncStatus('err', 'Ошибка синхронизации', 0);
    if (await shouldOpenAccountOnboarding()) openOnboarding();
    if (!window.__bandplanSyncRetryBound) {
      window.__bandplanSyncRetryBound = true;
      window.addEventListener('online', () => { window.__bandplanSyncRetryBound = false; bootCloudSync(true, window.__bandplanDurable || null); }, {once:true});
    }
  }
}

function showUpdateBoot() {
  if (document.getElementById('boot-update')) return;
  const el = document.createElement('div');
  el.id = 'boot-update'; el.className = 'boot'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
  el.innerHTML = '<div class="boot-core"><div class="boot-mark" aria-hidden="true"><span>BP</span></div><div class="boot-name">BandPlan</div><div class="boot-stage">Обновляем BandPlan</div><div class="boot-bar" aria-hidden="true"><b style="transform:scaleX(1)"></b></div></div><div class="boot-foot">Music Group OS</div>';
  document.body.appendChild(el);
}

function resetForLogout() {
  window.__bandplanCloudSyncGeneration = (window.__bandplanCloudSyncGeneration || 0) + 1;
  try { stop(); } catch (_) {}
  try { closeModal(true); } catch (_) {
    try { hardClose(modalRoot); } catch (__) {}
  }
  try { if (scene.raf) cancelAnimationFrame(scene.raf); relWake(); } catch (_) {}
  state = defaults();
  ui.skeleton = false;
  uiInitialized = true;
  window.__bandplanAppReady = false;
  window.__bandplanActiveUserId = null;
  window.__bandplanDurable = null;
  const view = $('#view');
  if (view) view.innerHTML = '';
  const app = document.getElementById('app');
  if (app) {
    app.setAttribute('inert', '');
    app.setAttribute('aria-busy', 'true');
  }
  const sceneEl = $('#scene');
  if (sceneEl) {
    sceneEl.classList.remove('on');
    sceneEl.setAttribute('aria-hidden', 'true');
  }
  const onb = $('#onb');
  if (onb) {
    onb.classList.remove('on');
    onb.setAttribute('aria-hidden', 'true');
  }
  // Supabase's SIGNED_OUT event is the only authority for leaving the
  // authenticated shell. The login gate already exists from initial boot;
  // reveal it here instead of reloading or creating a second auth flow.
  offlineSongIndex.clear();
  const authGate = document.getElementById('bpAuthGate');
  if (authGate) authGate.hidden = false;
  if (window.location.hash !== '#/calendar') {
    history.replaceState(null, '', '#/calendar');
  }
  render();
}

if (location.search.includes('bandplan-test=1')) {
  window.__bandplanTestHooks = {
    shouldCleanupOfflineEventSongRow,
    rebuildOfflineSongIndex,
    offlineSongLookup: id => offlineSongIndex.get(String(id || '')) || null,
    dynamicsHTML,
    renderSceneLyrics
  };
}

window.__bandplanHandleSignedOut = resetForLogout;

function init() {
  if (uiInitialized) return;
  window.addEventListener('bandplan:sync-error', e => toast('Не удалось синхронизировать данные: ' + (e.detail || 'проверьте подключение'), 'err', 6500));
  const had = load();
  applyTheme(); applyAccentVars();
  ui.calView = state.settings.calView || 'month';
  if (!location.hash) location.hash = '#/calendar';
  window.addEventListener('hashchange', function () {
    if (skipNextHashRoute) {
      skipNextHashRoute = false;
      return;
    }
    ui.skeleton = false;
    routeTransition();
  });
  wireSearch(); wireImport(); wireNet(); wireStickyHeader();
  $('#scBody').addEventListener('scroll', updateBar, { passive: true });
  $('#scBody').addEventListener('wheel', () => { if (scene.auto) setAuto(false); }, { passive: true });
  $('#scBody').addEventListener('touchstart', () => { if (scene.auto) setAuto(false); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && $('#scene').classList.contains('on') && !scene.wake) reqWake();
    if (!document.hidden) scheduleOfflineSongSync(150);
  });
  window.addEventListener('online', () => scheduleOfflineSongSync(150));
  window.setInterval(() => scheduleOfflineSongSync(150), 15 * 60 * 1000);
  window.addEventListener('beforeunload', () => { if (scene.raf) cancelAnimationFrame(scene.raf); relWake(); });
  // WHY: service-worker lifecycle is owned by index.html only, preventing duplicate registrations/reload handlers.
  ui.skeleton = false;
  render();
  if (window.BandPlanCloud) bootCloudSync(had, window.__bandplanDurable || null);
  uiInitialized = true;
}
/*
  Auth handoff: Supabase is the only auth source of truth. The auth module
  calls this resume hook after a successful login; the application boot itself
  remains single-instance and is never started through a second auth listener.
*/
window.__bandplanResumeAuthenticated = async function (user) {
  if (!user?.id) return;
  if (window.__bandplanAppReady && window.__bandplanActiveUserId === user.id) {
    const gate = document.getElementById('bpAuthGate');
    if (gate) gate.hidden = true;
    return;
  }
  // WHY: all startup paths share one mutex so DOM readiness and Auth callbacks cannot boot twice.
  return startBandPlan(false);
};

function startBandPlan(forceOffline = false) {
  if (window.__bandplanAuthResumePromise) return window.__bandplanAuthResumePromise;
  window.__bandplanAuthResumePromise = startBandPlanInternal(forceOffline).finally(() => {
    window.__bandplanAuthResumePromise = null;
  });
  return window.__bandplanAuthResumePromise;
}

async function startBandPlanInternal(forceOffline) {
  const attempt = (window.__bandplanBootAttempt || 0) + 1;
  window.__bandplanBootAttempt = attempt;
  if (!forceOffline && navigator.onLine !== false) Boot.stage('Запускаем BandPlan', 8);
  window.__bandplanStarted = true;
  Boot.stage(forceOffline || navigator.onLine === false ? 'Нет сети — проверяем сохранённый вход' : 'Запускаем BandPlan', forceOffline || navigator.onLine === false ? 60 : 8);
  /*
    The UI must never remain a blank shell when the optional cloud SDK fails
    to load. Start the local application first; cloud sync is attached when
    the Supabase client is available.
  */
  /*
    Authentication is mandatory even for offline/local operation.
    The local cache is an account-scoped workspace, not an authentication
    mechanism. Never open the application from the generic legacy key merely
    because the browser/network is offline.
  */
  if (forceOffline) {
    if (!window.BandPlanCloud || typeof window.BandPlanCloud.initialize !== 'function') {
      Boot.fail({
        title:'Не удалось подключить вход в аккаунт',
        text:'Для открытия BandPlan сначала нужно проверить аккаунт. Проверьте подключение и повторите запуск.',
        actions:'<button type="button" id="bootRetry">Повторить</button>'
      });
      return;
    }
    let offlineUser = null;
    try {
      Boot.stage('Проверяем вход в аккаунт', 35);
      offlineUser = await window.BandPlanCloud.initialize();
    } catch (error) {
      console.error('BandPlan offline auth initialization failed:', error);
      Boot.fail({
        title:'Не удалось проверить вход',
        text:String(error?.message || 'Не удалось проверить сессию аккаунта.'),
        actions:'<button type="button" id="bootRetry">Повторить</button>'
      });
      return;
    }
    if (!offlineUser?.id) {
      Boot.done();
      return;
    }

    /*
      The account is known, so an explicitly requested offline launch may use
      only that user's account-scoped local cache.
    */
    KEY = 'bandplan.premium.v6:' + offlineUser.id;
    const hadLocal = load();
    try { init(); } catch (e) {
      Boot.fail({title:'Не удалось открыть локальные данные',text:'Сохранённые данные аккаунта не изменены. Повторите запуск.'});
      return;
    }
    window.__bandplanActiveUserId = offlineUser.id;
    window.__bandplanAppReady = true;
    await hydrateOfflineSongsIntoState();
    render();
    scheduleOfflineSongSync(300);
    setSyncStatus('offline', 'Офлайн', 0);
    Boot.done();
    if (await shouldOpenAccountOnboarding()) openOnboarding();
    if (!window.__bandplanOfflineResumeBound) {
      window.__bandplanOfflineResumeBound = true;
      window.addEventListener('online', () => {
        window.__bandplanOfflineResumeBound = false;
        startBandPlan(false);
      }, {once:true});
    }
    return;
  }
  if (!window.BandPlanCloud || typeof window.BandPlanCloud.initialize !== 'function') {
    if (attempt !== window.__bandplanBootAttempt) return;
    // Offline PWA startup must not wait for an external Supabase CDN.
    // Authentication remains mandatory when online; offline mode only opens
    // the already cached local workspace.
    // navigator.onLine is only a browser hint and can be false while the
    // device still has working connectivity (especially in installed PWAs,
    // VPN/proxy environments and after network handoffs). Never bypass Auth
    // solely because that hint says offline. initialize() must be allowed to
    // restore the persisted Supabase session first.
    Boot.stage('Подключаем вход в аккаунт', 25);
    // The Supabase script tags are blocking dependencies, so BandPlan must not
    // poll with timers waiting for the auth client. If the client is absent at
    // this point, report the dependency failure immediately.
    Boot.fail({
      title:'Не удалось подключить вход в аккаунт',
      text:'Сервис авторизации не загрузился. Проверьте подключение и повторите запуск.',
      actions:'<button type="button" id="bootRetry">Повторить</button>'
    });
    return;
  }
  let user = null;
  try {
    Boot.stage('Проверяем сессию', 25);
    user = await window.BandPlanCloud.initialize();
    if (attempt !== window.__bandplanBootAttempt) return;
  } catch (error) {
    console.error('BandPlan authentication initialization failed:', error);
    Boot.fail({
      title: 'Не удалось проверить вход',
      text: String(error?.message || 'Supabase не ответил. Вход не был пропущен.'),
      actions: '<button type="button" id="bootRetry">Повторить</button>'
    });
    return;
  }
  if (!user) { Boot.done(); return; }

  /*
    One-time migration for installations that stored the user's real work in
    the pre-account local key. We only seed the new account-scoped key when
    the account has no durable snapshot yet; remote cloud data remains the
    source of truth when it already exists.
  */
  let legacyState = null;
  const previousActiveUserId = window.__bandplanActiveUserId || null;
  const switchingAccount = !!(uiInitialized && previousActiveUserId && previousActiveUserId !== user.id);
  /*
    A localStorage key from a previous authenticated user must never seed the
    next account. Legacy migration is allowed only during the very first boot.
  */
  if (!uiInitialized) try {
    for (const legacyKey of ['bandplan.premium.v6', 'bandplan.premium.v5', 'bandplan.premium.v4']) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (!legacyRaw) continue;
      const parsed = JSON.parse(legacyRaw);
      if (hasMeaningfulState(parsed) && !isKnownDemoState(parsed)) {
        legacyState = parsed;
        break;
      }
    }
  } catch (e) {}
  if (switchingAccount) {
    /*
      The DOM wiring is reusable, but authenticated application state is not.
      Reset it before init/bootCloudSync so the previous user's songs/events/
      members can never be treated as this user's local state.
    */
    state = defaults();
    ui.skeleton = true;
    window.__bandplanDurable = null;
  }

  KEY = 'bandplan.premium.v6:' + user.id;
  try {
    Boot.stage('Загружаем ваши данные', 60);
    window.__bandplanDurable = await window.BandPlanCloud.hydrateLocalCache();
    if (attempt !== window.__bandplanBootAttempt) return;
    if (window.__bandplanDurable?.state) {
      try { localStorage.setItem(KEY, JSON.stringify(window.__bandplanDurable.state)); } catch (e) {}
    } else if (legacyState) {
      try { localStorage.setItem(KEY, JSON.stringify(legacyState)); } catch (e) {}
    }
    // WHY: remove account-agnostic state only after a per-account snapshot exists, including when durable state was restored instead of migrated.
    if (window.__bandplanDurable?.state || legacyState) {
      for (const legacyKey of ['bandplan.premium.v6', 'bandplan.premium.v5', 'bandplan.premium.v4']) {
        try { localStorage.removeItem(legacyKey); } catch (e) {}
      }
    }
  } catch (e) {
    window.__bandplanDurable = null;
    if (legacyState) {
      try {
        localStorage.setItem(KEY, JSON.stringify(legacyState));
        // WHY: cleanup follows successful account-scoped migration even when cloud hydration failed.
        for (const legacyKey of ['bandplan.premium.v6', 'bandplan.premium.v5', 'bandplan.premium.v4']) localStorage.removeItem(legacyKey);
      } catch (storageError) {}
    }
    console.warn('BandPlan durable offline hydration unavailable:', e);
  }
  Boot.stage('Готовим интерфейс', 85);
  try {
    const alreadyInitialized = uiInitialized;
    init();
    /*
      Mark the authenticated owner before starting cloud hydration. This also
      makes stale async work from the previous account fail its generation/user
      guard.
    */
    window.__bandplanActiveUserId = user.id;
    // After logout the DOM wiring intentionally remains reusable. Every
    // subsequent authenticated handoff must therefore rehydrate the current
    // account, even when it is the same account as before logout. This avoids
    // blank/default state and prevents the previous user's state from leaking
    // into a new session.
    if (alreadyInitialized) {
      ui.skeleton = false;
      render();
      bootCloudSync(true, window.__bandplanDurable || null);
    }
  } catch (e) {
    Boot.fail({title:'Не удалось подготовить интерфейс',text:'Сохранённые данные не удалены. Повторите запуск.'});
    return;
  }
  Boot.done();
  window.__bandplanActiveUserId = user.id;
  window.__bandplanAppReady = true;
}
// WHY: install the PWA error consumer before any auth-gated early return, so login screens also report service-worker failures.
if (!window.__bandplanPwaErrorListener) {
  window.__bandplanPwaErrorListener = true;
  window.addEventListener('bandplan:pwa-error', event => {
    const previousMode = state.settings.toastMode;
    state.settings.toastMode = 'all';
    toast(String(event.detail || 'Не удалось обновить офлайн-режим'), 'warn', 6000);
    state.settings.toastMode = previousMode;
  });
  if (window.__bandplanPwaError) window.dispatchEvent(new CustomEvent('bandplan:pwa-error', {detail:window.__bandplanPwaError}));
}
// WHY: passing the DOM Event as forceOffline accidentally bypassed the normal online startup path.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startBandPlan(false), {once:true}); else startBandPlan(false);
})();


              
