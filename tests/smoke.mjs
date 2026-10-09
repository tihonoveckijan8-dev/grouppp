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
    const render = window.__bandplanTestHooks?.dynamicsHTML;
    if (typeof render !== 'function') return null;
    const song = {
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
      unassigned: render(song, [])
    };
  });
  assert.ok(dynamicsFiltering, 'Instrument dynamics test hook missing');
  assert.match(dynamicsFiltering.guitar, /Гитара вступает после первой строки/, 'Guitar player did not receive guitar dynamics');
  assert.doesNotMatch(dynamicsFiltering.guitar, /Ударные входят на второй такт/, 'Guitar player can see another instrument dynamics');
  assert.match(dynamicsFiltering.drums, /Ударные входят на второй такт/, 'Drummer did not receive drum dynamics');
  assert.doesNotMatch(dynamicsFiltering.drums, /Гитара вступает после первой строки/, 'Drummer can see another instrument dynamics');
  assert.doesNotMatch(dynamicsFiltering.unassigned, /Гитара вступает после первой строки/, 'User without a matching role must not see guitar dynamics');
  assert.doesNotMatch(dynamicsFiltering.unassigned, /Ударные входят на второй такт/, 'User without a matching role must not see drum dynamics');

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
  }

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
