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
    await page.waitForFunction(() => typeof window.__bandplanEnsureCore === 'function', { timeout: 15_000 });
    await page.evaluate(() => window.__bandplanEnsureCore());
    await page.waitForFunction(() => typeof window.__bandplanTestHooks?.seedVisualState === 'function', { timeout: 15_000 });

    await page.evaluate(() => {
      // WHY: the existing visual fixture intentionally has no authenticated session; release only its isolated test visibility lock and seed local demo data.
      document.documentElement.classList.remove('bp-auth-required');
      window.__bandplanTestHooks.seedVisualState();
    });

    const routeResults = [];
    const routes = [
      ['songs', '#/songs'],
      ['song', '#/song/visual-s1'],
      ['setlists', '#/setlists'],
      ['setlist', '#/setlist/visual-sl1'],
      ['settings', '#/settings'],
      ['calendar', '#/calendar']
    ];

    for (const [name, hash] of routes) {
      const started = Date.now();
      await page.evaluate(nextHash => { location.hash = nextHash; }, hash);
      await page.waitForFunction(expected => document.body.dataset.route === expected, name, { timeout: 10_000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      routeResults.push({
        route: name,
        transitionToPaintMs: Date.now() - started,
        visibleView: await page.locator('#view').isVisible()
      });
    }

    const started = Date.now();
    await page.locator('[data-act="more-menu-toggle"]').click();
    await page.locator('#bottomMoreMenu [data-to="tools"]').click();
    await page.waitForFunction(() => document.body.dataset.route === 'tools', null, { timeout: 10_000 });
    await expect(page.locator('.tools-page')).toBeVisible();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    routeResults.push({
      route: 'tools',
      transitionToPaintMs: Date.now() - started,
      visibleView: await page.locator('.tools-page').isVisible()
    });

    const report = await page.evaluate(routeResults => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const byType = {};
      for (const entry of resources) {
        const ext = new URL(entry.name).pathname.split('.').pop().toLowerCase();
        const type = ['js', 'mjs'].includes(ext) ? 'javascript' : ext === 'css' ? 'css' : ext === 'woff2' ? 'font' : 'other';
        byType[type] = (byType[type] || 0) + (entry.transferSize || 0);
      }
      return {
        fixture: 'visual-seed; no real Supabase session, account data, or cloud sync',
        viewport: { width: innerWidth, height: innerHeight },
        navigation: nav ? {
          responseStartMs: Math.round(nav.responseStart),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadEventMs: Math.round(nav.loadEventEnd)
        } : null,
        transferredBytesByType: byType,
        transferredBytesTotal: Object.values(byType).reduce((sum, value) => sum + value, 0),
        longTasks: window.__bpLongTasks,
        routeResults
      };
    }, routeResults);

    const outputPath = testInfo.outputPath('mobile-workspace-performance.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log('BANDPLAN_MOBILE_WORKSPACE_PERFORMANCE ' + JSON.stringify(report));
    expect(routeResults.every(item => item.visibleView), 'Every measured route must render its visible view').toBe(true);
    expect(pageErrors, 'Workspace fixture must not throw unhandled browser exceptions').toEqual([]);
  } finally {
    await context.close();
  }
});
