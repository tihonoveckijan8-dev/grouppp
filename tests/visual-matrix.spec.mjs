import { test, expect } from 'playwright/test';

const BASE = 'http://127.0.0.1:4174';
const SIZES = [[360, 800], [390, 844], [1280, 800]];
const THEMES = ['light', 'dark', 'amoled'];
const ACCENTS = ['blue', 'red', 'amber'];
const ROUTES = [
  ['calendar', '#/calendar'],
  ['songs', '#/songs'],
  ['song', '#/song/visual-s1'],
  ['setlists', '#/setlists'],
  ['setlist', '#/setlist/visual-sl1'],
  ['tools', '#/tools'],
  ['settings', '#/settings']
];

async function auditViewport(page, label) {
  const metrics = await page.evaluate(() => {
    const width = innerWidth;
    const visibleOutside = [];
    for (const el of document.querySelectorAll('button, input, select, textarea, .card, .song-card, .sl-item, .ev-row, .page-head, .toolbar')) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.left < -1 || rect.right > width + 1) {
        visibleOutside.push({
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className.slice(0, 70) : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right)
        });
      }
    }
    return { viewportWidth: width, documentWidth: document.documentElement.scrollWidth, visibleOutside };
  });
  expect(metrics.documentWidth, label + ': document horizontal overflow').toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.visibleOutside, label + ': visible controls/cards outside viewport').toEqual([]);
}

test('BandPlan visual matrix: responsive routes, themes, accents and key forms', async ({ browser }, testInfo) => {
  // WHY: 27 viewport/theme/accent combinations intentionally run sequentially to keep CI stable.
  test.setTimeout(20 * 60 * 1000);
  let screenshotIndex = 0;
  for (const [width, height] of SIZES) {
    for (const theme of THEMES) {
      for (const accent of ACCENTS) {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          if (message.type() === 'error') errors.push(message.text());
        });
        try {
          await page.goto(BASE + '/?bandplan-test=visual', { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => typeof window.__bandplanEnsureCore === 'function', { timeout: 15000 });
          await page.evaluate(() => window.__bandplanEnsureCore());
          await page.waitForFunction(() => typeof window.__bandplanTestHooks?.seedVisualState === 'function', { timeout: 15000 });
          await page.evaluate(({ theme, accent }) => {
            // WHY: the deterministic visual fixture has no real signed-in account; release the production auth-visibility lock only inside this isolated test page.
            document.documentElement.classList.remove('bp-auth-required');
            window.__bandplanTestHooks.seedVisualState();
            window.__bandplanTestHooks.visualPrefs(theme, accent);
          }, { theme, accent });

          for (const [name, hash] of ROUTES) {
            if (name === 'tools' && width <= 767) {
              // WHY: tools is intentionally nested under the "Ещё" drawer on mobile; use the real navigation control so the test covers the same delegated route flow as users.
              await page.locator('[data-act="more-menu-toggle"]').click();
              await page.locator('#bottomMoreMenu [data-to="tools"]').click();
            } else if (name === 'tools') {
              // WHY: desktop users reach tools from the persistent side navigation; the mobile drawer is hidden at this viewport.
              await page.locator('#sideNav [data-to="tools"]').click();
            } else {
              await page.evaluate(hash => { location.hash = hash; }, hash);
            }
            await page.waitForTimeout(100);
            await auditViewport(page, width + 'x' + height + ' ' + theme + '/' + accent + '/' + name);
            if (name === 'setlist' && width === 360 && theme === 'light' && accent === 'blue') {
              // WHY: stage mode is a separate full-screen surface; exercise its real open/close flow once to catch regressions without adding fullscreen churn to every matrix combination.
              // WHY: the fixture can render the same setlist action in multiple responsive surfaces; choose the first visible action to avoid Playwright strict-mode ambiguity.
              await page.locator('[data-act="scene-setlist"]:visible').first().click();
              await expect(page.locator('#scene')).toHaveClass(/on/);
              await expect(page.locator('#scBody'), 'Stage lyrics must render when a setlist is opened on stage').toBeVisible();
              await expect(page.locator('[data-act="scene-prev"]')).toBeVisible();
              await expect(page.locator('[data-act="scene-next"]')).toBeVisible();
              await expect(page.locator('[data-act="scene-close"]')).toBeVisible();
              await page.locator('[data-act="scene-close"]').click();
              await expect(page.locator('#scene')).not.toHaveClass(/on/);
            }
            if (name === 'tools') {
              // WHY: tools can follow a skeleton-rendered route transition in the fixture, so wait for the route's deferred render before checking its UI.
              await expect(page.locator('body')).toHaveAttribute('data-route', 'tools');
              await expect(page.locator('.tools-page'), 'Music tools page should render in the visual fixture').toBeVisible();
              await expect(page.locator('[data-act="tool-tab"]'), 'All instrument-tool tabs should be available').toHaveCount(5);
              await page.locator('[data-act="tool-tab"][data-v="metronome"]').click();
              await expect(page.locator('[data-bp-am-tool-host]'), 'Metronome host should mount when its tab is selected').toBeVisible();
              await auditViewport(page, width + 'x' + height + ' ' + theme + '/' + accent + '/tools-metronome');
            }
            if (name === 'calendar') {
              // WHY: only assert the removed duplicate day panel and per-day count badge; overview metrics may be intentionally hidden at compact breakpoints.
              await expect(page.locator('.cal-selected-day')).toBeHidden();
              const dayWithEvents = page.locator('.cal-grid > .cal-cell.cal-has-events').first();
              if (await dayWithEvents.count()) {
                const badgeDisplay = await dayWithEvents.evaluate(el => getComputedStyle(el, '::after').display);
                expect(badgeDisplay, 'Calendar day count badge should be hidden').toBe('none');
              }
              const tomorrow = await page.evaluate(() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                const pad = n => String(n).padStart(2, '0');
                return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
              });
              const tomorrowCell = page.locator('[data-act="cal-day"][data-date="' + tomorrow + '"]');
              await expect(tomorrowCell, 'Tomorrow must remain selectable in the calendar grid').toHaveCount(1);
              await tomorrowCell.locator('.cal-num').click();
              await expect(page.locator('.cal-selected-day')).toBeHidden();
            }
          }

          await page.evaluate(() => { location.hash = '#/calendar'; });
          await page.waitForTimeout(100);
          await page.screenshot({
            path: testInfo.outputPath('matrix-' + String(++screenshotIndex).padStart(2, '0') + '-' + width + 'x' + height + '-' + theme + '-' + accent + '.png'),
            fullPage: true
          });

          const formChecks = [
            { route: '#/calendar', selector: '[data-act="new-event"]', label: 'event form', close: '[data-act="modal-close"]' },
            { route: '#/songs', selector: '[data-act="new-song"]', label: 'song form', close: '[data-act="modal-close"]' },
            { route: '#/setlists', selector: '[data-act="new-setlist"]', label: 'setlist form', close: '[data-act="modal-close"]' }
          ];
          for (const form of formChecks) {
            await page.evaluate(route => { location.hash = route; }, form.route);
            await page.waitForTimeout(100);
            const trigger = page.locator(form.selector + ':visible').first();
            if (await trigger.count()) {
              await trigger.click();
              await page.waitForTimeout(100);
              await auditViewport(page, width + 'x' + height + ' ' + theme + '/' + accent + '/' + form.label);
              const close = page.locator(form.close + ':visible').first();
              if (await close.count()) await close.click();
            }
          }
          expect(errors, width + 'x' + height + ' ' + theme + '/' + accent + ' browser errors').toEqual([]);
        } finally {
          await context.close();
        }
      }
    }
  }
});
