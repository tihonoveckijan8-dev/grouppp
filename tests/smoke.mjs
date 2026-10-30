import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const root = process.cwd();
const mime = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json',
  '.png':'image/png',
  '.svg':'image/svg+xml'
};

const server = createServer(async (req, res) => {
  try {
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safePath = normalize(rawPath).replace(/^([.][.][/\\])+/, '');
    const filePath = join(root, safePath === '/' ? 'index.html' : safePath);
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, {'Content-Type': mime[extname(filePath)] || 'application/octet-stream'});
    createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500); res.end(String(error));
  }
});

await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({headless: true});
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];

page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.goto('http://127.0.0.1:4173/?bandplan-test=1', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window.BandPlanCloud !== 'undefined', null, {timeout: 15000});
  await page.waitForSelector('#bpAuthGate', {state:'visible', timeout: 15000});
  // WHY: auth initialization may legitimately start the core before this assertion; test the public loader contract, not timing/session races.
  const lazyCore = await page.evaluate(() => ({ ensureCore: typeof window.__bandplanEnsureCore === 'function' }));
  assert.equal(lazyCore.ensureCore, true, 'Lazy core loader missing');
  await page.evaluate(() => window.__bandplanEnsureCore());
  await page.waitForFunction(() => typeof window.BandPlanCloud?.queueEventParticipation === 'function', null, {timeout: 15000});
  const cloudApi = await page.evaluate(() => ({
    queueParticipation: typeof window.BandPlanCloud?.queueEventParticipation === 'function',
    flushParticipation: typeof window.BandPlanCloud?.flushEventParticipationQueue === 'function'
  }));
  assert.equal(cloudApi.queueParticipation, true, 'Participation offline queue API missing after core load');
  assert.equal(cloudApi.flushParticipation, true, 'Participation queue flush API missing after core load');
  const offlineStore = await page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('bandplan-cloud-v1');
      req.onsuccess = () => {
        const db = req.result;
        resolve({version: db.version, hasEventOfflineSongs: db.objectStoreNames.contains('event_offline_songs'), hasSyncQueue: db.objectStoreNames.contains('sync_queue')});
        db.close();
      };
      req.onerror = () => reject(req.error);
    });
  });
  assert.equal(offlineStore.hasEventOfflineSongs, true, 'Offline event songs store missing');
  assert.equal(offlineStore.hasSyncQueue, true, 'Existing sync_queue was not preserved');
  assert.ok(offlineStore.version >= 3, 'IndexedDB schema was not upgraded to v3');
  const offlineCleanup = await page.evaluate(() => {
    const fn = window.__bandplanTestHooks?.shouldCleanupOfflineEventSongRow;
    if (typeof fn !== 'function') return null;
    const now = Date.now();
    const cfg = {maybe:false};
    const base = {id:'future-1', date:new Date(now + 86400000).toISOString().slice(0,10), time:'12:00', status:'upcoming', setlistId:'sl-1', myStatus:'yes'};
    return {
      active: fn({eventId:'future-1'}, base, now, cfg, new Set(['future-1'])),
      cancelled: fn({eventId:'cancelled'}, {...base, id:'cancelled', status:'cancelled'}, now, cfg, new Set(['cancelled'])),
      no: fn({eventId:'no'}, {...base, id:'no', myStatus:'no'}, now, cfg, new Set(['no'])),
      missing: fn({eventId:'missing'}, null, now, cfg, new Set()),
      maybeDisabled: fn({eventId:'maybe'}, {...base, id:'maybe', myStatus:'maybe'}, now, cfg, new Set(['maybe']))
    };
  });
  assert.ok(offlineCleanup, 'Offline cleanup test hook missing');
  assert.equal(offlineCleanup.active, false, 'Current eligible offline event was incorrectly marked stale');
  assert.equal(offlineCleanup.cancelled, true, 'Cancelled event was not marked stale');
  assert.equal(offlineCleanup.no, true, 'Event after switching to no was not marked stale');
  assert.equal(offlineCleanup.missing, true, 'Deleted event was not marked stale');
  assert.equal(offlineCleanup.maybeDisabled, true, 'Maybe event should not be kept when maybe-save is disabled');

  const dynamicsFiltering = await page.evaluate(() => {
    const hooks = window.__bandplanTestHooks;
    const render = hooks?.dynamicsHTML;
    const renderLyrics = hooks?.renderSceneLyrics;
    if (typeof render !== 'function' || typeof renderLyrics !== 'function') return null;
    const song = {
      lyrics: 'Куплет 1\nПервая строка песни',
      dynamics: {
        instruments: ['guitar', 'drums'],
        sections: ['Куплет 1'],
        instrumentNotes: {
          guitar: {'Куплет 1': 'Гитара вступает после первой строки'},
          drums: {'Куплет 1': 'Ударные входят на второй такт'}
        }
      }
    };
    return {
      guitar: render(song, ['guitar']),
      drums: render(song, ['drums']),
      unassigned: render(song, []),
      guitarLyrics: renderLyrics(song, 0, ['guitar']),
      drumsLyrics: renderLyrics(song, 0, ['drums']),
      unassignedLyrics: renderLyrics(song, 0, []),
      localizedRoleLyrics: renderLyrics(song, 0, ['Гитара'])
    };
  });
  assert.ok(dynamicsFiltering, 'Instrument dynamics test hook missing');
  assert.match(dynamicsFiltering.guitar, /Гитара вступает после первой строки/, 'Guitar player did not receive guitar dynamics');
  assert.doesNotMatch(dynamicsFiltering.guitar, /Ударные входят на второй такт/, 'Guitar player can see another instrument dynamics');
  assert.match(dynamicsFiltering.drums, /Ударные входят на второй такт/, 'Drummer did not receive drum dynamics');
  assert.doesNotMatch(dynamicsFiltering.drums, /Гитара вступает после первой строки/, 'Drummer can see another instrument dynamics');
  assert.doesNotMatch(dynamicsFiltering.unassigned, /Гитара вступает после первой строки/, 'User without a matching role must not see guitar dynamics');
  assert.doesNotMatch(dynamicsFiltering.unassigned, /Ударные входят на второй такт/, 'User without a matching role must not see drum dynamics');
  assert.match(dynamicsFiltering.guitarLyrics, /Гитара вступает после первой строки/, 'Guitar dynamics missing from song lyrics');
  assert.doesNotMatch(dynamicsFiltering.guitarLyrics, /Ударные входят на второй такт/, 'Foreign drum dynamics leaked into guitar song lyrics');
  assert.match(dynamicsFiltering.drumsLyrics, /Ударные входят на второй такт/, 'Drum dynamics missing from song lyrics');
  assert.doesNotMatch(dynamicsFiltering.drumsLyrics, /Гитара вступает после первой строки/, 'Foreign guitar dynamics leaked into drum song lyrics');
  assert.doesNotMatch(dynamicsFiltering.unassignedLyrics, /Гитара вступает после первой строки|Ударные входят на второй такт/, 'Song lyrics exposed dynamics without a matching role');
  assert.match(dynamicsFiltering.localizedRoleLyrics, /Гитара вступает после первой строки/, 'Localized profile role did not match the guitar instrument');

  const accountIsolation = await page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('bandplan-cloud-v1');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('event_offline_songs','readwrite');
        const store = tx.objectStore('event_offline_songs');
        store.put({key:'account-a:event-a',accountId:'account-a',eventId:'event-a',songs:[{id:'song-a'}]});
        store.put({key:'account-b:event-b',accountId:'account-b',eventId:'event-b',songs:[{id:'song-b'}]});
        tx.oncomplete = () => {
          const readTx = db.transaction('event_offline_songs','readonly');
          const get = readTx.objectStore('event_offline_songs').index('account_id').getAll('account-a');
          get.onsuccess = () => { db.close(); resolve(get.result.map(x => x.eventId)); };
          get.onerror = () => reject(get.error);
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  assert.deepEqual(accountIsolation, ['event-a'], 'Offline songs are not isolated by account');


  const themes = [
    ['light', '#F4F6F8'],
    ['dark', '#14161C'],
    ['amoled', '#000000']
  ];
  for (const [theme, expectedColor] of themes) {
    await page.evaluate(({theme}) => {
      const current = JSON.parse(localStorage.getItem('bandplan.boot') || '{}');
      localStorage.setItem('bandplan.boot', JSON.stringify({
        ...current, theme, accent: '#2547D0', accentApplied: '#2547D0', onAccent: '#FFFFFF'
      }));
    }, {theme});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => typeof window.BandPlanCloud !== 'undefined', null, {timeout: 15000});
    await page.waitForSelector('#bpAuthGate', {state:'visible', timeout: 15000});
    const themeState = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      color: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || '',
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      onAccent: getComputedStyle(document.documentElement).getPropertyValue('--on-accent').trim()
    }));
    assert.equal(themeState.theme, theme, `Boot theme mismatch for ${theme}`);
    assert.equal(themeState.color.toUpperCase(), expectedColor, `Theme color mismatch for ${theme}`);
    assert.match(themeState.accent, /^#[0-9A-Fa-f]{6}$/);
    assert.match(themeState.onAccent, /^#[0-9A-Fa-f]{6}$/);

    // WHY: guard the event-type label regression and verify semantic participation colors in each theme.
    const participationColors = await page.evaluate(() => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.style.cssText = 'position:absolute;left:-10000px;top:0';
      const host = document.createElement('div');
      host.className = 'part-switch';
      host.style.cssText = 'display:flex';
      card.append(host);
      const statuses = ['yes', 'maybe', 'no'];
      const buttons = statuses.map(status => {
        const button = document.createElement('button');
        button.className = 'part-btn on status-' + status;
        button.dataset.v = status;
        button.setAttribute('aria-pressed', 'true');
        button.textContent = status;
        host.append(button);
        return button;
      });
      document.body.append(card);
      const result = buttons.map(button => ({
        status: button.dataset.v,
        background: getComputedStyle(button).backgroundColor,
        border: getComputedStyle(button).borderColor,
        text: getComputedStyle(button).color
      }));
      card.remove();
      return result;
    });
    assert.equal(participationColors.length, 3, 'All three participation states must be styled');
    const expected = [
      { text: 'rgb(22, 163, 74)', background: 'rgba(22, 163, 74, 0.16)', border: 'rgb(22, 163, 74)' },
      { text: 'rgb(234, 179, 8)', background: 'rgba(234, 179, 8, 0.18)', border: 'rgb(234, 179, 8)' },
      { text: 'rgb(220, 38, 38)', background: 'rgba(220, 38, 38, 0.16)', border: 'rgb(220, 38, 38)' }
    ];
    participationColors.forEach((actual, index) => {
      assert.equal(actual.text, expected[index].text, `Wrong fixed text color for ${actual.status} in ${theme}`);
      assert.equal(actual.background, expected[index].background, `Wrong fixed background color for ${actual.status} in ${theme}`);
      assert.equal(actual.border, expected[index].border, `Wrong fixed border color for ${actual.status} in ${theme}`);
    });
  }

  const sourceCore = await readFile(join(root, 'bandplan-core.js'), 'utf8');
  const sourceCss = await readFile(join(root, 'bandplan.css'), 'utf8');
  const sourceDepthCss = await readFile(join(root, 'bandplan-depth.css'), 'utf8');
  const metronomeSource = await readFile(join(root, 'metronome-audio.js'), 'utf8');
  // WHY: the old file-analysis flow failed on phones; lock in the replacement's manual controls and guard against accidentally shipping the upload/analyzer UI again.
  assert.match(metronomeSource, /data-bp-metro/, 'Manual metronome panel is missing');
  assert.match(metronomeSource, /min="30" max="260"/, 'Metronome BPM control must keep the supported 30–260 range');
  assert.match(metronomeSource, /data-bpm-action="tap"/, 'Tap Tempo control is missing');
  assert.match(metronomeSource, /data-bpm-action="start"/, 'Metronome start/stop control is missing');
  assert.match(metronomeSource, /data-bpm-meter/, 'Time-signature control is missing');
  assert.match(metronomeSource, /data-bpm-subdivision/, 'Subdivision control is missing');
  assert.match(metronomeSource, /data-bpm-accent/, 'First-beat accent control is missing');
  assert.match(metronomeSource, /bandplan\.metronome\.settings\.v2/, 'Metronome settings key is missing');
  assert.match(metronomeSource, /AudioContext|webkitAudioContext/, 'Web Audio playback is missing');
  assert.doesNotMatch(metronomeSource, /type=["']file["']|decodeAudioData|audio-beat\.bundle|Определить BPM/i, 'Obsolete audio-file BPM analysis UI or bundle reference has returned');


  // WHY: source checks alone cannot prove the metronome controls reach Web Audio; exercise start/stop and Tap Tempo in the browser with a deterministic audio-clock stub.
  await page.evaluate(() => {
    window.__bpMetroTestAudio = { scheduled: 0 };
    class TestAudioContext {
      constructor() {
        this.state = 'suspended';
        this.destination = {};
        this.startedAt = performance.now();
      }
      get currentTime() { return (performance.now() - this.startedAt) / 1000; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createOscillator() {
        const state = window.__bpMetroTestAudio;
        return {
          type: '',
          frequency: { setValueAtTime() {} },
          connect() {},
          start() { state.scheduled++; },
          stop() {}
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}
        };
      }
    }
    window.AudioContext = TestAudioContext;
    const host = document.createElement('div');
    host.setAttribute('data-bp-am-tool-host', '1');
    document.querySelector('#view').append(host);
    // WHY: the smoke test starts on the logged-out auth gate; disable only its pointer interception while testing the underlying tool panel.
    const authGate = document.querySelector('#bpAuthGate');
    if (authGate) {
      window.__bpMetroAuthGatePointerEvents = { value: authGate.style.getPropertyValue('pointer-events'), priority: authGate.style.getPropertyPriority('pointer-events') };
      authGate.style.setProperty('pointer-events', 'none', 'important');
    }
    // WHY: the app view is hidden behind the auth gate in this unauthenticated smoke-test session.
    for (let node = host; node && node !== document.body; node = node.parentElement) {
      node.style.setProperty('display', 'block', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
    }
  });
  await page.waitForSelector('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-action="start"]', {state:'visible', timeout: 5000});
  const metroStart = page.locator('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-action="start"]');
  // WHY: Playwright's physical pointer hit-test is blocked by the auth gate; DOM click still exercises the actual control handler without changing production auth behavior.
  await metroStart.evaluate(button => button.click());
  await page.waitForFunction(() => window.__bpMetroTestAudio?.scheduled > 0, null, {timeout: 3000});
  assert.equal(await metroStart.getAttribute('aria-pressed'), 'true', 'Start control did not enter the running state');
  assert.match(await page.locator('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-status]').textContent(), /работает/i, 'Running status was not announced');
  await metroStart.evaluate(button => button.click());
  assert.equal(await metroStart.getAttribute('aria-pressed'), 'false', 'Stop control did not return to the stopped state');
  assert.match(await page.locator('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-status]').textContent(), /остановлен/i, 'Stopped status was not announced');
  await page.locator('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-action="tap"]').evaluate(button => button.click());
  await page.waitForTimeout(600);
  await page.locator('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-action="tap"]').evaluate(button => button.click());
  await page.waitForTimeout(600);
  await page.locator('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-action="tap"]').evaluate(button => button.click());
  const tappedBpm = Number(await page.locator('#view [data-bp-metro][data-metronome-id="__tool__"] [data-bpm-number]').textContent());
  assert.ok(tappedBpm >= 85 && tappedBpm <= 115, `Tap Tempo result ${tappedBpm} BPM is outside the expected range for 600ms taps`);
  // WHY: the previous metronome file flow failed on phones; assert the rebuilt manual controls remain inside a narrow mobile viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMetroLayout = await page.locator('#view [data-bp-metro][data-metronome-id="__tool__"]').evaluate(root => ({
    viewportWidth: window.innerWidth,
    panelRight: root.getBoundingClientRect().right,
    panelWidth: root.getBoundingClientRect().width,
    panelClientWidth: root.clientWidth,
    panelScrollWidth: root.scrollWidth,
    overflowingChildren: Array.from(root.querySelectorAll('*')).map(el => ({selector: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().replace(/\\s+/g, '.') : ''), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth})).filter(el => el.scrollWidth > el.clientWidth + 1 || el.right > window.innerWidth + 1).slice(0, 12),
    actionRights: Array.from(root.querySelectorAll('.bp-metro-actions button')).map(button => button.getBoundingClientRect().right),
    controlsVisible: ['[data-bpm-range]', '[data-bpm-action="tap"]', '[data-bpm-action="start"]', '[data-bpm-meter]', '[data-bpm-subdivision]'].every(selector => {
      const control = root.querySelector(selector);
      const rect = control?.getBoundingClientRect();
      return !!control && rect.width > 0 && rect.height > 0 && rect.right <= window.innerWidth + 1;
    })
  }));
  assert.ok(mobileMetroLayout.panelRight <= mobileMetroLayout.viewportWidth + 1, 'Metronome panel overflows the 390px mobile viewport');
  assert.ok(mobileMetroLayout.panelScrollWidth <= mobileMetroLayout.panelClientWidth + 1, 'Metronome panel has horizontal content overflow on mobile: ' + JSON.stringify(mobileMetroLayout.overflowingChildren));
  assert.ok(mobileMetroLayout.actionRights.every(right => right <= mobileMetroLayout.viewportWidth + 1), 'Metronome action button overflows the mobile viewport');
  assert.equal(mobileMetroLayout.controlsVisible, true, 'A core metronome control is hidden or clipped on mobile');
  await page.setViewportSize({ width: 1280, height: 900 });
  const metroSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('bandplan.metronome.settings.v2') || '{}'));
  assert.equal(metroSettings.__tool__.bpm, tappedBpm, 'Tap Tempo result was not persisted');
  await page.evaluate(() => {
    document.querySelector('#view [data-bp-am-tool-host]')?.remove();
    const authGate = document.querySelector('#bpAuthGate');
    if (authGate && window.__bpMetroAuthGatePointerEvents) {
      const previous = window.__bpMetroAuthGatePointerEvents;
      if (previous.value) authGate.style.setProperty('pointer-events', previous.value, previous.priority);
      else authGate.style.removeProperty('pointer-events');
    }
    delete window.__bpMetroAuthGatePointerEvents;
    delete window.__bpMetroTestAudio;
  });
  assert.match(sourceCore, /data-bp-no-collapse="1"/, 'Event type buttons must opt out of adaptive label collapsing');
  assert.match(sourceCss, /#evTypeSeg button \.bp-btn-label\{display:inline!important/, 'Event type labels must remain visible');
  assert.match(sourceCore, /if \(el\.getAttribute\('aria-pressed'\) === 'true'\) value=''/, 'Clicking an active participation state must clear it');
  assert.match(sourceCore, /setEventParticipation\(eventId,value,stamp\)/, 'Participation status must be sent to the cloud API');

  // WHY: show runtime and the linked event in the setlist overview so users can compare programs without opening each one.
  assert.match(sourceCore, /class="song-meta setlist-meta"/, 'Setlist cards must expose planning metadata');
  assert.match(sourceCore, /setlistDur\(sl\)/, 'Setlist cards must calculate their runtime from existing song durations');
  assert.match(sourceCore, /class="badge b-muted setlist-linked-event(?:\\s|")/, 'Linked event metadata is missing from setlist cards');
  assert.match(sourceDepthCss, /\.setlists-list > \.song-card > \.setlist-meta/, 'Setlist card metadata layout styles are missing');
  assert.match(sourceDepthCss, /\.setlist-linked-event[\s\S]*?text-overflow:\s*ellipsis/, 'Long linked event names must not overflow setlist cards');
  // WHY: include the scheduled date and start time with the linked event so the correct upcoming gig is identifiable from the setlist overview.
  assert.match(sourceCore, /esc\(ev\.title \+ \(ev\.date \? ' · ' \+ pdateShort\(ev\.date\) : ''\) \+ \(ev\.time \? ' · ' \+ ev\.time : ''\)\)/, 'Linked event badge must include its available date and start time');

  // WHY: when a user starts "Add to setlist" with an empty setlist library, creating the first setlist must keep the song they chose.
  // WHY: event details should let the band open the linked setlist directly, not force them to close the modal and find it in another section.
  // WHY: show program size and known runtime in the event editor so users can choose the right setlist before saving.
  assert.match(sourceCore, /const n = \(s\.items \|\| \[\]\)\.length, duration = setlistDur\(s\);[\s\S]*?fmtDur\(duration\)[\s\S]*?esc\(label\)/, 'Event setlist picker must show song count and known runtime');
  // WHY: the selected setlist summary should stay visible and refresh whenever users change the event's program.
  assert.match(sourceCore, /id="f_sl_summary" aria-live="polite"/, 'Selected setlist summary region is missing');
  assert.match(sourceCore, /setlistSelect\.addEventListener\('change', updateSetlistSummary\)/, 'Selected setlist summary must update on selection changes');
  assert.match(sourceCore, /setlistSummary\.textContent = count \+ ' ' \+ plural\(count, 'песня', 'песни', 'песен'\)/, 'Selected setlist summary must show song count and known runtime');
  assert.match(sourceCore, /data-act="event-open-setlist" data-id="' \+ esc\(sl\.id\) \+ '"/, 'Event details must offer direct navigation to the linked setlist');
  assert.match(sourceCore, /case 'event-open-setlist': \{ stop\(\); if \(!slById\(id\)\) break; hardClose\(modalRoot\); go\('\#\/setlist\/' \+ id\); break; \}/, 'Opening a linked setlist must close event details and navigate to the setlist');
  // WHY: show useful rehearsal prep at a glance so the band can confirm the linked program size and estimated runtime before opening it.
  assert.match(sourceCore, /plural\(\(sl\.items \|\| \[\]\)\.length, 'песня', 'песни', 'песен'\)[\s\S]*?fmtDur\(setlistDur\(sl\)\)/, 'Event details must show the linked setlist song count and estimated runtime');
  // WHY: event details must expose concrete setup gaps so the band can verify readiness before rehearsal or a show.
  assert.match(sourceCore, /Готовность события[\s\S]*?readinessChecks\.length/, 'Event details must show a readiness checklist and completion count');
  assert.match(sourceCore, /label: 'Время начала указано'[\s\S]*?label: 'Место проведения указано'[\s\S]*?label: 'Сет-лист привязан'[\s\S]*?label: 'В программе есть доступные песни'/, 'Readiness checklist must cover event time, location, and setlist');
  assert.match(sourceCore, /missingDurations = linkedSongs\.filter\(song => !\(song\.duration > 0\)\)\.length/, 'Readiness checklist must warn when song durations are missing');
  assert.match(sourceCore, /event-readiness-item[\s\S]*?event-readiness-icon/, 'Readiness checklist must render individual status rows');
  assert.match(sourceCss, /\.event-readiness-list[\s\S]*?\.event-readiness-item[\s\S]*?@media\(max-width:420px\)/, 'Readiness checklist must have responsive styles');

  // WHY: keep the schedule visible when users open the setlist itself, not only in the overview card.
  assert.match(sourceCore, /esc\(linkedEvent\.title \+ \(linkedEvent\.date \? ' · ' \+ pdateShort\(linkedEvent\.date\) : ''\) \+ \(linkedEvent\.time \? ' · ' \+ linkedEvent\.time : ''\)\)/, 'Setlist detail must show the linked event date and start time when available');
  // WHY: let users move back from a concert program to its event details without returning to the calendar and searching again.
  assert.match(sourceCore, /data-act="event-info" data-id="' \+ esc\(linkedEvent\.id\) \+ '" data-date="' \+ esc\(linkedEvent\.date \|\| ''\) \+ '" aria-label="Открыть связанное событие"/, 'Setlist details must offer direct navigation to the linked event');
  assert.match(sourceCore, /function setlistModal\(id, preselectedSongId\)/, 'Setlist creation must accept a preselected song');
  assert.match(sourceCore, /s\.id === preselectedSongId \? ' checked' : ''/, 'The chosen song must be preselected in the new setlist form');
  assert.match(sourceCore, /confirmBox\('Сет-листов пока нет'[\s\S]*?setlistModal\(null, songId\)/, 'Creating the first setlist from a song must preserve that song');

  // WHY: assert the current shared animated close path, rather than depending on the removed legacy backdrop variable.
  assert.match(sourceCore, /function closeMoreDrawer\([\s\S]*?backdrop\.hidden = true[\s\S]*?classList\.remove\('more-menu-open'\)/, 'More drawer close routine must clear its backdrop and scroll lock');
  assert.match(sourceCore, /if \(e\.key === 'Escape'\)[\s\S]*?closeMoreDrawer\(true\)/, 'Escape must use the shared More drawer close routine');

  // WHY: at phone widths event actions need a dedicated full-width grid row so they stay inside the card and align to the right edge.
  assert.match(sourceDepthCss, /grid-column:\s*1\s*\/\s*-1;/, 'Mobile event actions must span the card instead of being squeezed into a grid column');
  assert.match(sourceDepthCss, /grid-template-columns:\s*44px\s+minmax\(0,\s*1fr\)/, 'Very narrow phones need a compact event date column');

  // WHY: make calendar event density visible without requiring a tap, while keeping out-of-month dates visually quiet.
  assert.match(sourceCore, /data-event-count=/, 'Calendar day event count attribute is missing');
  assert.match(sourceDepthCss, /\.cal-cell\.cal-has-events::after/, 'Calendar event count badge styling is missing');
  const eventCountBadge = await page.evaluate(() => {
    const previousRoute = document.body.dataset.route;
    document.body.dataset.route = 'calendar';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;visibility:hidden;pointer-events:none';
    host.innerHTML = '<div class="cal-grid"><div class="cal-cell cal-has-events" data-event-count="4"><div class="cal-num">12</div></div><div class="cal-cell out cal-has-events" data-event-count="2"><div class="cal-num">31</div></div></div>';
    document.body.append(host);
    const cells = [...host.querySelectorAll('.cal-cell')];
    const result = {
      countContent: getComputedStyle(cells[0], '::after').content,
      countDisplay: getComputedStyle(cells[0], '::after').display,
      outsideDisplay: getComputedStyle(cells[1], '::after').display
    };
    host.remove();
    if (previousRoute) document.body.dataset.route = previousRoute;
    else delete document.body.dataset.route;
    return result;
  });
  // WHY: the selected-day panel and numeric event-count badge were intentionally removed from the calendar UI.
  assert.doesNotMatch(eventCountBadge.countContent, /4/, 'Calendar must not expose a numeric day event count');
  assert.equal(eventCountBadge.countDisplay, 'none', 'Calendar event count badge must remain hidden');
  assert.equal(eventCountBadge.outsideDisplay, 'none', 'Out-of-month cells should not show count badges');

  // WHY: exercise the real mobile lyric CSS against a long unbroken line; checking selectors alone misses overflow regressions.
  await page.setViewportSize({width: 390, height: 844});
  const lyricLayout = await page.evaluate(() => {
    const previousRoute = document.body.dataset.route;
    document.body.dataset.route = 'song';
    const fixture = document.createElement('div');
    fixture.id = 'bp-mobile-lyrics-test';
    fixture.style.cssText = 'position:fixed;left:0;top:0;width:280px;max-width:calc(100vw - 32px);visibility:hidden;pointer-events:none;display:block';
    fixture.innerHTML = '<div id="app" style="display:block;width:100%;min-width:0"><div class="content" style="width:100%;min-width:0"><div class="lyrics" style="width:100%;min-width:0"><div class="ln"></div></div></div></div>';
    const line = fixture.querySelector('.ln');
    line.textContent = 'ОченьДлиннаяСтрокаБезПробелов'.repeat(18);
    document.body.append(fixture);
    const lyrics = fixture.querySelector('.lyrics');
    const metrics = {
      viewport: innerWidth,
      lyricsWidth: lyrics.getBoundingClientRect().width,
      lyricsScrollWidth: lyrics.scrollWidth,
      lineWidth: line.getBoundingClientRect().width,
      lineScrollWidth: line.scrollWidth,
      overflowWrap: getComputedStyle(line).overflowWrap,
      whiteSpace: getComputedStyle(line).whiteSpace,
      horizontalDocumentOverflow: document.documentElement.scrollWidth > innerWidth + 1
    };
    fixture.remove();
    document.body.dataset.route = previousRoute || 'calendar';
    return metrics;
  });
  assert.ok(lyricLayout.lyricsWidth <= 358, 'Mobile lyrics exceed the available viewport width');
  assert.equal(lyricLayout.overflowWrap, 'anywhere', 'Mobile lyric lines must allow long unbroken words to wrap');
  assert.equal(lyricLayout.whiteSpace, 'pre-wrap', 'Mobile lyrics must preserve intentional line breaks while wrapping');
  assert.ok(lyricLayout.lineScrollWidth <= lyricLayout.lineWidth + 1, 'Long unbroken lyric line overflows its line box');
  assert.equal(lyricLayout.horizontalDocumentOverflow, false, 'Mobile lyric fixture causes horizontal page overflow');

  // WHY: validate the shared responsive card rules with real browser layout, not only CSS source matching.
  const compactCards = await page.evaluate(() => {
    const previousRoute = document.body.dataset.route;
    document.body.dataset.route = 'setlists';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:calc(100vw - 24px);max-width:366px;visibility:hidden;pointer-events:none;overflow:hidden';
    host.innerHTML = '<article class="setlist-card"><div class="setlist-name"></div><div class="event-actions"><button class="btn">Длинное действие</button><button class="btn">Ещё одно действие</button></div></article><article class="event-card"><div class="ev-name"></div><div class="event-actions"><button class="btn">Участвую</button><button class="btn">Под вопросом</button><button class="btn">Не участвую</button></div></article>';
    host.querySelector('.setlist-name').textContent = 'ОченьДлинноеНазваниеСетЛистаБезПробелов'.repeat(3);
    host.querySelector('.ev-name').textContent = 'ОченьДлинноеНазваниеСобытияБезПробелов'.repeat(3);
    document.body.append(host);
    const cards = [...host.querySelectorAll('.setlist-card,.event-card')].map(card => ({
      width: card.getBoundingClientRect().width,
      scrollWidth: card.scrollWidth,
      title: card.querySelector('.setlist-name,.ev-name'),
      actions: card.querySelector('.event-actions')
    })).map(card => ({
      width: card.width,
      scrollWidth: card.scrollWidth,
      titleWidth: card.title.getBoundingClientRect().width,
      titleScrollWidth: card.title.scrollWidth,
      actionsWidth: card.actions.getBoundingClientRect().width,
      actionsScrollWidth: card.actions.scrollWidth
    }));
    host.remove();
    document.body.dataset.route = previousRoute || 'calendar';
    return {cards, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1};
  });
  assert.equal(compactCards.documentOverflow, false, 'Long card titles cause horizontal page overflow on mobile');
  compactCards.cards.forEach((card, index) => {
    assert.ok(card.width <= 366, `Card ${index} exceeds compact mobile width`);
    assert.ok(card.scrollWidth <= card.width + 1, `Card ${index} content overflows its card`);
    assert.ok(card.titleWidth <= card.width + 1, `Card ${index} title exceeds its container`);
    assert.ok(card.actionsWidth <= card.width + 1, `Card ${index} action row exceeds its container`);
  });

  // WHY: scene mode must wrap long lyrics too; it uses a separate DOM surface from the song editor.
  const sceneLayout = await page.evaluate(() => {
    const scene = document.querySelector('#scene');
    const body = document.querySelector('#scBody');
    const oldSceneClass = scene.className;
    const oldHidden = scene.getAttribute('aria-hidden');
    const oldBody = body.innerHTML;
    scene.classList.add('on');
    scene.setAttribute('aria-hidden', 'false');
    body.innerHTML = '<span class="ln"></span>';
    body.firstElementChild.textContent = 'СценическаяСтрокаБезПробелов'.repeat(20);
    const line = body.firstElementChild;
    const result = {
      width: body.getBoundingClientRect().width,
      scrollWidth: body.scrollWidth,
      lineWidth: line.getBoundingClientRect().width,
      lineScrollWidth: line.scrollWidth,
      whiteSpace: getComputedStyle(body).whiteSpace,
      overflowWrap: getComputedStyle(line).overflowWrap
    };
    scene.className = oldSceneClass;
    if (oldHidden === null) scene.removeAttribute('aria-hidden'); else scene.setAttribute('aria-hidden', oldHidden);
    body.innerHTML = oldBody;
    return result;
  });
  assert.equal(sceneLayout.whiteSpace, 'pre-wrap', 'Stage mode must preserve line breaks while wrapping');
  assert.ok(sceneLayout.lineScrollWidth <= sceneLayout.lineWidth + 1, 'Long stage-mode lyric line overflows its line box');
  assert.ok(sceneLayout.scrollWidth <= sceneLayout.width + 1, 'Stage-mode lyrics overflow horizontally');

  // WHY: the calendar's event actions need to remain reachable on narrow screens with realistic long event names.
  await page.setViewportSize({width: 390, height: 844});
  const calendarLayout = await page.evaluate(() => {
    const previousRoute = document.body.dataset.route;
    document.body.dataset.route = 'calendar';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:calc(100vw - 24px);max-width:366px;visibility:hidden;pointer-events:none;overflow:hidden';
    host.innerHTML = '<article class="event-card"><div class="ev-name"></div><div class="event-actions"><button class="btn" type="button">✓</button><button class="btn" type="button">?</button><button class="btn" type="button">×</button></div></article>';
    host.querySelector('.ev-name').textContent = 'ДлинноеНазваниеРепетицииИлиКонцертаБезПробелов'.repeat(3);
    document.body.append(host);
    const card = host.querySelector('.event-card');
    const title = card.querySelector('.ev-name');
    const actions = card.querySelector('.event-actions');
    const buttons = [...actions.querySelectorAll('button')];
    const result = {
      viewport: innerWidth,
      hostWidth: host.getBoundingClientRect().width,
      cardWidth: card.getBoundingClientRect().width,
      cardScrollWidth: card.scrollWidth,
      titleWidth: title.getBoundingClientRect().width,
      titleScrollWidth: title.scrollWidth,
      titleOverflowWrap: getComputedStyle(title).overflowWrap,
      actionWidth: actions.getBoundingClientRect().width,
      actionScrollWidth: actions.scrollWidth,
      buttons: buttons.map(button => ({width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height})),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1
    };
    host.remove();
    document.body.dataset.route = previousRoute || 'calendar';
    return result;
  });
  assert.ok(calendarLayout.hostWidth <= 366, 'Calendar fixture exceeds available phone width');
  assert.ok(calendarLayout.cardWidth <= calendarLayout.hostWidth + 1, 'Calendar event card exceeds its container');
  assert.ok(calendarLayout.cardScrollWidth <= calendarLayout.cardWidth + 1, 'Calendar event content overflows its card');
  assert.ok(calendarLayout.titleWidth <= calendarLayout.cardWidth + 1, 'Calendar event title exceeds its card');
  assert.equal(calendarLayout.titleOverflowWrap, 'anywhere', 'Long calendar event names must wrap');
  assert.ok(calendarLayout.actionWidth <= calendarLayout.cardWidth + 1, 'Calendar participation actions exceed event card');
  assert.ok(calendarLayout.buttons.every(button => button.width >= 24 && button.height >= 24), 'Calendar participation controls are too small to interact with');
  assert.equal(calendarLayout.documentOverflow, false, 'Calendar event fixture causes horizontal page overflow');

  const removedUi = await page.evaluate(() => ({
    globalSearch: !!document.querySelector('#globalSearch,#globalSearchbar'),
    glassTheme: !!document.querySelector('[data-theme="glass"]'),
    liquidGlassText: document.body.innerText.includes('Liquid Glass')
  }));
  assert.equal(removedUi.globalSearch, false, 'Obsolete global top search is still mounted');
  assert.equal(removedUi.glassTheme, false, 'Removed Liquid Glass theme is still mounted');
  assert.equal(removedUi.liquidGlassText, false, 'Liquid Glass text is still visible');
  const responsive = [];
  for (const width of [320, 375, 390, 430, 768, 820, 900, 1024, 1100, 1200, 1280, 1366, 1440, 1536, 1600, 1920, 2560, 3440]) {
    await page.setViewportSize({width, height: 900});
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      emailHeight: document.querySelector('#bpAuthEmail')?.getBoundingClientRect().height || 0,
      passwordHeight: document.querySelector('#bpAuthPassword')?.getBoundingClientRect().height || 0,
      submitHeight: document.querySelector('#bpAuthSubmit')?.getBoundingClientRect().height || 0
    }));
    assert.ok(metrics.scrollWidth <= metrics.width + 1, `Horizontal overflow at ${width}px`);
    assert.ok(metrics.emailHeight >= 44, `Email target too small at ${width}px`);
    assert.ok(metrics.passwordHeight >= 44, `Password target too small at ${width}px`);
    assert.ok(metrics.submitHeight >= 44, `Submit target too small at ${width}px`);
    responsive.push(metrics);
  }
  await page.setViewportSize({width: 390, height: 844});
  const landscape = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    emailHeight: document.querySelector('#bpAuthEmail')?.getBoundingClientRect().height || 0,
    passwordHeight: document.querySelector('#bpAuthPassword')?.getBoundingClientRect().height || 0,
    submitHeight: document.querySelector('#bpAuthSubmit')?.getBoundingClientRect().height || 0
  }));
  assert.ok(landscape.scrollWidth <= landscape.width + 1, 'Horizontal overflow before landscape check');
  await page.setViewportSize({width: 844, height: 390});
  const landscapeMetrics = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    emailHeight: document.querySelector('#bpAuthEmail')?.getBoundingClientRect().height || 0,
    passwordHeight: document.querySelector('#bpAuthPassword')?.getBoundingClientRect().height || 0,
    submitHeight: document.querySelector('#bpAuthSubmit')?.getBoundingClientRect().height || 0
  }));
  assert.equal(landscapeMetrics.width, 844, 'Landscape viewport was not applied');
  assert.ok(landscapeMetrics.scrollWidth <= landscapeMetrics.width + 1, 'Horizontal overflow in phone landscape');
  assert.ok(landscapeMetrics.emailHeight >= 44, 'Email target too small in landscape');
  assert.ok(landscapeMetrics.passwordHeight >= 44, 'Password target too small in landscape');
  assert.ok(landscapeMetrics.submitHeight >= 44, 'Submit target too small in landscape');
  await page.setViewportSize({width: 1280, height: 900});

  const result = await page.evaluate(() => ({
    cloud: typeof window.BandPlanCloud !== 'undefined',
    authForm: !!document.querySelector('#bpAuthForm'),
    email: !!document.querySelector('#bpAuthEmail'),
    password: !!document.querySelector('#bpAuthPassword'),
    submit: !!document.querySelector('#bpAuthSubmit'),
    title: document.querySelector('#bpAuthGate h1')?.textContent?.trim() || ''
  }));

  assert.equal(result.cloud, true, 'window.BandPlanCloud is not defined');
  assert.equal(result.authForm, true, 'Auth form was not rendered');
  assert.equal(result.email, true, 'Email field was not rendered');
  assert.equal(result.password, true, 'Password field was not rendered');
  assert.equal(result.submit, true, 'Login button was not rendered');
  assert.equal(result.title, 'С возвращением', 'Unexpected auth gate title');

  assert.deepEqual(pageErrors, [], 'Browser pageerror detected');
  assert.deepEqual(consoleErrors, [], 'Browser console.error detected');

  console.log('BandPlan auth smoke: PASS');
  console.log(JSON.stringify({...result, responsive}));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
