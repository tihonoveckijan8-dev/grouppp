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
            await page.evaluate(hash => { location.hash = hash; }, hash);
            await page.waitForTimeout(100);
            await auditViewport(page, width + 'x' + height + ' ' + theme + '/' + accent + '/' + name);
            if (name === 'calendar' && width <= 767) {
              // WHY: a mobile date tap must reveal that date's events, not leave users with icon-only markers.
              const selectedDay = page.locator('.cal-selected-day');
              const panelDiagnostics = await selectedDay.evaluate(el => {
                const ancestors = [];
                for (let node = el; node && node !== document.body; node = node.parentElement) {
                  const style = getComputedStyle(node);
                  const rect = node.getBoundingClientRect();
                  ancestors.push({ tag: node.tagName, id: node.id, className: typeof node.className === 'string' ? node.className : '', display: style.display, visibility: style.visibility, height: Math.round(rect.height) });
                }
                const stylesheets = Array.from(document.styleSheets).map(sheet => {
                  try {
                    return { href: sheet.href, rules: Array.from(sheet.cssRules).filter(rule => rule.cssText.includes('cal-selected-day')).map(rule => rule.cssText.slice(0, 260)) };
                  } catch { return { href: sheet.href, rules: [] }; }
                }).filter(sheet => sheet.rules.length);
                return { ancestors, stylesheets };
              });
              await expect(selectedDay, 'Mobile calendar selected-day panel must be visible: ' + JSON.stringify(panelDiagnostics)).toBeVisible();
              // Wait for route rendering to settle before asserting fixture content.
              await expect(selectedDay, 'Mobile selected-day panel should show the fixture event').toContainText('Пятничное выступление', { timeout: 5000 });
              // WHY: verifying both directions catches stale selected-day content after a real calendar-cell tap.
              const tomorrow = await page.evaluate(() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                const pad = n => String(n).padStart(2, '0');
                return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
              });
              const tomorrowCell = page.locator('[data-act="cal-day"][data-date="' + tomorrow + '"]');
              await expect(tomorrowCell, 'Tomorrow must be selectable in the mobile month grid').toHaveCount(1);
              await tomorrowCell.click();
              await expect(selectedDay, 'Selected-day panel should show tomorrow\'s rehearsal').toContainText('Репетиция перед концертом', { timeout: 5000 });

              const today = await page.evaluate(() => {
                const d = new Date();
                const pad = n => String(n).padStart(2, '0');
                return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
              });
              await page.locator('[data-act="cal-day"][data-date="' + today + '"]').click();
              await expect(selectedDay, 'Returning to today should restore today\'s event').toContainText('Пятничное выступление', { timeout: 5000 });
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
