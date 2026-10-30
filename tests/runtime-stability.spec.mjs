import { test, expect } from 'playwright/test';

// WHY: keep the stability loop isolated from real accounts and cloud data while exercising the production DOM, router and Web Audio controls.
const BASE = 'http://127.0.0.1:4175';

test('runtime stability: repeated navigation and metronome start/stop', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto(BASE + '/?bandplan-test=visual', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__bandplanEnsureCore === 'function', { timeout: 15_000 });
    await page.evaluate(() => window.__bandplanEnsureCore());
    await page.waitForFunction(() => typeof window.__bandplanTestHooks?.seedVisualState === 'function', { timeout: 15_000 });
    await page.evaluate(() => {
      // WHY: the fixture has no signed-in account; release only its isolated auth visibility lock.
      document.documentElement.classList.remove('bp-auth-required');
      window.__bandplanTestHooks.seedVisualState();
      window.__bandplanTestHooks.visualPrefs('dark', 'blue');
    });

    const routes = ['#/calendar', '#/songs', '#/setlists', '#/settings'];
    for (let cycle = 0; cycle < 8; cycle++) {
      for (const route of routes) {
        await page.evaluate(hash => { location.hash = hash; }, route);
        await expect.poll(() => page.evaluate(() => location.hash)).toBe(route);
        await page.waitForTimeout(120);
      }
      // WHY: on phones, Tools lives inside the More drawer; use the real user navigation path instead of forcing a hidden route.
      await page.locator('[data-act="more-menu-toggle"]').click();
      await page.locator('#bottomMoreMenu [data-to="tools"]').click();
      await expect(page.locator('body')).toHaveAttribute('data-route', 'tools');
      await expect(page.locator('.tools-page')).toBeVisible();
      await page.locator('[data-act="tool-tab"][data-v="metronome"]').click();
      const host = page.locator('[data-bp-am-tool-host]');
      await expect(host).toBeVisible();
      const metro = host.locator('[data-bp-metro]');
      await expect(metro).toBeVisible();

      // WHY: rapid user-like start/stop cycles expose duplicate scheduler loops and stale audio state.
      for (let tap = 0; tap < 3; tap++) {
        const start = metro.locator('[data-bpm-action="start"]');
        await start.click();
        await expect(start).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(90);
        await start.click();
        await expect(start).toHaveAttribute('aria-pressed', 'false');
      }

      // WHY: leaving the tools route while active must release the scheduler before the panel is detached.
      const start = metro.locator('[data-bpm-action="start"]');
      await start.click();
      await expect(start).toHaveAttribute('aria-pressed', 'true');
      await page.evaluate(() => { location.hash = '#/calendar'; });
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/calendar');
      await page.waitForTimeout(120);
      await page.waitForTimeout(80);
      expect(await page.locator('#view [data-bp-metro]').count()).toBe(0);
    }

    expect(pageErrors, 'Unhandled browser exceptions during stability loop').toEqual([]);
  } finally {
    await context.close();
  }
});
