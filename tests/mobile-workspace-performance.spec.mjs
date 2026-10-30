import { test, expect } from 'playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const BASE = 'http://127.0.0.1:4175';

test('mobile workspace performance: deterministic UI fixture route timings', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  // WHY: measure real production DOM/render work on a phone-sized viewport without using credentials or touching a real account.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];

  await page.addInitScript(() => {
    window.__bpLongTasks = [];
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__bpLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch (_) {}
    }
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto(BASE + '/?bandplan-test=visual', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__bandplanEnsureCore === 'function', null, { timeout: 15_000 });
    await page.evaluate(() => window.__bandplanEnsureCore());
    await page.waitForFunction(() => typeof window.__bandplanTestHooks?.seedVisualState === 'function', null, { timeout: 15_000 });

    await page.evaluate(() => {
      // WHY: the existing visual fixture intentionally has no authenticated session; release only its isolated test visibility lock and seed local demo data.
      document.documentElement.classList.remove('bp-auth-required');
      window.__bandplanTestHooks.seedVisualState();
    });

    // WHY: the manual metronome is an optional tool; its script must stay out of the initial calendar workspace request set.
    const eagerMetronomeLoaded = await page.evaluate(() => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/metronome-audio.js')));
    expect(eagerMetronomeLoaded, 'Metronome module must not load during initial workspace startup').toBe(false);
    // WHY: chord data and SVG renderers should also stay out of the initial calendar download set.
    const eagerChordLibraryLoaded = await page.evaluate(() => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/chord-library.js')));
    expect(eagerChordLibraryLoaded, 'Chord library module must not load during initial workspace startup').toBe(false);

    const routeResults = [];
    const routes = [
      ['songs', '#/songs'],
      ['song', '#/song/visual-s1'],
      ['setlists', '#/setlists'],
      ['setlist', '#/setlist/visual-sl1'],
      ['settings', '#/settings'],
      ['calendar', '#/calendar'],
      ['tools', '#/tools']
    ];

    for (const [name, hash] of routes) {
      const started = Date.now();
      // WHY: the fixture route helper calls the app's real renderer directly, avoiding browser hashchange races while preserving production DOM and rendering work.
      await page.evaluate(nextHash => window.__bandplanTestHooks.navigate(nextHash), hash);
      await page.waitForFunction(expected => document.body.dataset.route === expected, name, { timeout: 10_000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (name === 'song') {
        // WHY: song-specific metronome controls are injected only after the song detail view exists.
        await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/metronome-audio.js')), null, { timeout: 10_000 });
        await expect(page.locator('#view [data-bpm-open-song]')).toBeVisible();
      }
      routeResults.push({
        route: name,
        transitionToPaintMs: Date.now() - started,
        visibleView: await page.locator('#view').isVisible()
      });
    }

    // WHY: entering Tools alone should not fetch the chord catalogue; it is needed only after choosing one of the chord tabs.
    const chordStillDeferred = await page.evaluate(() => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/chord-library.js')));
    expect(chordStillDeferred, 'Chord library module loaded before its tab was selected').toBe(false);

    const chordStarted = Date.now();
    await page.locator('[data-act="tool-tab"][data-v="guitar-chords"]').click();
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/chord-library.js')), null, { timeout: 10_000 });
    await expect(page.locator('#view .chord-picker')).toBeVisible();
    await expect(page.locator('#view .guitar-diagram')).toBeVisible();
    // WHY: moving the renderer must preserve the existing delegated chord selection and selected-chord state.
    await page.locator('#view .chord-pick[data-v="Cmaj7"]').click();
    await expect(page.locator('#view .chord-detail-copy h3')).toHaveText('Cmaj7');
    routeResults.push({
      route: 'tools-guitar-chords',
      transitionToPaintMs: Date.now() - chordStarted,
      visibleView: await page.locator('#view .guitar-diagram').isVisible()
    });

    await page.locator('[data-act="tool-tab"][data-v="piano-chords"]').click();
    await expect(page.locator('#view .piano-diagram')).toBeVisible();
    routeResults.push({
      route: 'tools-piano-chords',
      transitionToPaintMs: 0,
      visibleView: await page.locator('#view .piano-diagram').isVisible()
    });

    const metroStarted = Date.now();
    await page.locator('[data-act="tool-tab"][data-v="metronome"]').click();
    await expect(page.locator('#view [data-bp-am-tool-host] [data-bp-metro]')).toBeVisible();
    routeResults.push({
      route: 'tools-metronome',
      transitionToPaintMs: Date.now() - metroStarted,
      visibleView: await page.locator('#view [data-bp-am-tool-host] [data-bp-metro]').isVisible()
    });

    const report = await page.evaluate(routeResults => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const byType = {};
      const encodedByType = {};
      const decodedByType = {};
      const compressedResources = [];
      for (const entry of resources) {
        const pathname = new URL(entry.name).pathname;
        const ext = pathname.split('.').pop().toLowerCase();
        const type = ['js', 'mjs'].includes(ext) ? 'javascript' : ext === 'css' ? 'css' : ext === 'woff2' ? 'font' : 'other';
        byType[type] = (byType[type] || 0) + (entry.transferSize || 0);
        encodedByType[type] = (encodedByType[type] || 0) + (entry.encodedBodySize || 0);
        decodedByType[type] = (decodedByType[type] || 0) + (entry.decodedBodySize || 0);
        // WHY: compare encoded and decoded body sizes to prove compression was actually applied, rather than estimating gzip from local file sizes.
        if (/\.(css|js|mjs)$/.test(pathname) && entry.encodedBodySize > 0 && entry.decodedBodySize > entry.encodedBodySize) {
          compressedResources.push({
            path: pathname,
            type,
            encodedBytes: entry.encodedBodySize,
            decodedBytes: entry.decodedBodySize
          });
        }
      }
      return {
        fixture: 'visual-seed; no real Supabase session, account data, or cloud sync',
        delivery: 'local gzip negotiation; transfer sizes include compressed response bodies',
        viewport: { width: innerWidth, height: innerHeight },
        navigation: nav ? {
          responseStartMs: Math.round(nav.responseStart),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadEventMs: Math.round(nav.loadEventEnd)
        } : null,
        transferredBytesByType: byType,
        encodedBodyBytesByType: encodedByType,
        decodedBodyBytesByType: decodedByType,
        transferredBytesTotal: Object.values(byType).reduce((sum, value) => sum + value, 0),
        compressedResources,
        longTasks: window.__bpLongTasks,
        routeResults
      };
    }, routeResults);

    const outputPath = testInfo.outputPath('mobile-workspace-performance.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log('BANDPLAN_MOBILE_WORKSPACE_PERFORMANCE ' + JSON.stringify(report));
    expect(routeResults.every(item => item.visibleView), 'Every measured route must render its visible view').toBe(true);
    expect(report.compressedResources.some(item => item.type === 'css'), 'CSS transfer must be gzip-compressed in the measurement server').toBe(true);
    expect(report.compressedResources.some(item => item.type === 'javascript'), 'JavaScript transfer must be gzip-compressed in the measurement server').toBe(true);
    expect(pageErrors, 'Workspace fixture must not throw unhandled browser exceptions').toEqual([]);
  } finally {
    await context.close();
  }
});
