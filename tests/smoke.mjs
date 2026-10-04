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
  await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window.BandPlanCloud !== 'undefined', null, {timeout: 15000});
  await page.waitForSelector('#bpAuthGate', {state:'visible', timeout: 15000});
  const lazyCore = await page.evaluate(() => ({
    ensureCore: typeof window.__bandplanEnsureCore === 'function',
    coreNotLoadedInitially: !window.__bandplanCorePromise
  }));
  assert.equal(lazyCore.ensureCore, true, 'Lazy core loader missing');
  assert.equal(lazyCore.coreNotLoadedInitially, true, 'Application core should stay deferred on the login gate');
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

  const themes = [
    ['light', '#F4F6F8'],
    ['dark', '#14161C'],
    ['amoled', '#000000'],
    ['glass', '#E9EEF5']
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

  const responsive = [];
  for (const width of [360, 390, 430, 768, 1024, 1280]) {
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
