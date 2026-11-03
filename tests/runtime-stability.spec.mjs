import { test, expect } from 'playwright/test';

// WHY: keep the stability loop isolated from real accounts and cloud data while exercising the production DOM, router and Web Audio controls.
const BASE = 'http://127.0.0.1:4175';

test('runtime stability: repeated navigation and metronome start/stop', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  // WHY: count only pending timeouts scheduled by the metronome module, so the test measures visual-timer retention directly without counting unrelated app timers.
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const metronomeTimers = new Set();
    window.__bpMetronomePendingTimers = () => metronomeTimers.size;
    window.setTimeout = (callback, delay, ...args) => {
      const stack = new Error().stack || '';
      const isMetronomeTimer = stack.includes('metronome-audio.js');
      let timerId;
      const wrapped = (...callbackArgs) => {
        if (isMetronomeTimer) metronomeTimers.delete(timerId);
        return callback(...callbackArgs);
      };
      timerId = nativeSetTimeout(wrapped, delay, ...args);
      if (isMetronomeTimer) metronomeTimers.add(timerId);
      return timerId;
    };
    window.clearTimeout = timerId => {
      metronomeTimers.delete(timerId);
      return nativeClearTimeout(timerId);
    };
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    // WHY: track adaptive buttons held by ResizeObserver so route churn catches detached-DOM retention, not just visible UI errors.
    await page.addInitScript(() => {
      const observed = new Set();
      const originalObserve = ResizeObserver.prototype.observe;
      const originalUnobserve = ResizeObserver.prototype.unobserve;
      ResizeObserver.prototype.observe = function (target, options) {
        // WHY: scope the assertion to BandPlan's adaptive-button observer, not unrelated ResizeObserver consumers.
        if (this === window.__bandplanAdaptiveResizeObserver && target instanceof HTMLButtonElement) observed.add(target);
        return originalObserve.call(this, target, options);
      };
      ResizeObserver.prototype.unobserve = function (target) {
        if (this === window.__bandplanAdaptiveResizeObserver) observed.delete(target);
        return originalUnobserve.call(this, target);
      };
      window.__bandplanObservedButtons = observed;
    });
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
        const detachedObservedButtons = await page.evaluate(() =>
          Array.from(window.__bandplanObservedButtons || []).filter(button => !button.isConnected).length
        );
        expect(detachedObservedButtons, 'ResizeObserver must release adaptive buttons removed by route rendering').toBe(0);
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
        await page.waitForTimeout(400);
        const pendingVisualTimers = await page.evaluate(() => window.__bpMetronomePendingTimers());
        expect(pendingVisualTimers, 'Metronome visual timers must remain bounded while running').toBeLessThanOrEqual(12);
        await start.click();
        await expect(start).toHaveAttribute('aria-pressed', 'false');
        await page.waitForTimeout(100);
        const retainedVisualTimers = await page.evaluate(() => window.__bpMetronomePendingTimers());
        expect(retainedVisualTimers, 'Stopping the metronome must release every visual timeout').toBe(0);
      }

      // WHY: leaving the tools route while active must release the scheduler before the panel is detached.
      const start = metro.locator('[data-bpm-action="start"]');
      await start.click();
      await expect(start).toHaveAttribute('aria-pressed', 'true');
      await page.evaluate(() => { location.hash = '#/calendar'; });
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/calendar');
      await page.waitForTimeout(120);
      await page.waitForTimeout(80);
      const activeSchedulers = await page.locator('#view [data-bp-metro] [data-bpm-action=start][aria-pressed="true"]').count();
      expect(activeSchedulers, 'Metronome must stop when leaving its route').toBe(0);
    }

    expect(pageErrors, 'Unhandled browser exceptions during stability loop').toEqual([]);
  } finally {
    await context.close();
  }
});


test('offline shell serves versioned app assets after a cold network loss', async ({ browser }) => {
  test.setTimeout(45_000);
  // WHY: exercise the real production Service Worker and Cache API in Chromium; source-pattern checks cannot prove query-versioned URLs work offline.
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();

  try {
    await page.goto(BASE + '/?offline-shell-test=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10_000 });

    // WHY: simulate a cold offline request with version strings different from the HTML and precache entries.
    await context.setOffline(true);
    const assets = await page.evaluate(async () => {
      const requests = [
        ['./?offline-shell-test=2', 'text/html', '<title>BandPlan'],
        ['./bandplan.css?v=offline-shell-regression', 'text/css', '@font-face'],
        ['./bandplan-depth.css?v=offline-shell-regression', 'text/css', '--surface-1'],
        ['./bandplan.js?v=offline-shell-regression', 'text/javascript', '__bandplanCorePromise']
      ];
      const results = [];
      for (const [url, expectedType, expectedContent] of requests) {
        const response = await fetch(url, { cache: 'no-store' });
        const body = await response.text();
        const contentType = response.headers.get('content-type') || '';
        results.push({
          url,
          status: response.status,
          ok: response.ok,
          contentType,
          hasExpectedType: contentType.toLowerCase().includes(expectedType),
          hasExpectedContent: body.includes(expectedContent),
          bytes: body.length
        });
      }
      return results;
    });

    for (const asset of assets) {
      expect(asset.ok, `Offline shell request failed: ${asset.url} (${asset.status})`).toBe(true);
      // WHY: an HTML fallback can contain generic tokens like "--" or "BandPlan"; assert the real asset MIME type to catch false-positive cache misses.
      expect(asset.hasExpectedType, `Offline shell returned the wrong content type for ${asset.url}: ${asset.contentType}`).toBe(true);
      expect(asset.hasExpectedContent, `Offline shell returned an unexpected body: ${asset.url}`).toBe(true);
      expect(asset.bytes, `Offline shell response was empty: ${asset.url}`).toBeGreaterThan(100);
    }
  } finally {
    await context.close();
  }
});


test('cold offline launch restores an authenticated workspace from IndexedDB', async ({ browser }) => {
  test.setTimeout(45_000);
  // WHY: a real cold reload verifies the persisted Supabase session and durable account snapshot together, without using a real account or weakening production Auth.
  const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const userId = 'offline-fixture-user-0001';
  const savedSongTitle = 'Offline Fixture Song';

  try {
    await page.goto(BASE + '/?offline-auth-fixture=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.BANDPLAN_CONFIG && !!window.BandPlanCloud, null, { timeout: 15_000 });
    await page.evaluate(async ({ userId, savedSongTitle }) => {
      const projectRef = new URL(window.BANDPLAN_CONFIG.supabaseUrl).hostname.split('.')[0];
      const authKey = 'sb-' + projectRef + '-auth-token';
      // Supabase reads this unexpired persisted session locally; no credentials or real user are involved.
      localStorage.setItem(authKey, JSON.stringify({
        access_token: 'offline-fixture-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 4102444800,
        refresh_token: 'offline-fixture-refresh-token',
        user: {
          id: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'offline-fixture@example.invalid',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { name: 'Offline Fixture' },
          created_at: '2026-01-01T00:00:00.000Z'
        }
      }));

      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('bandplan-cloud-v1', 3);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('snapshots')) database.createObjectStore('snapshots', { keyPath: 'user_id' });
          if (!database.objectStoreNames.contains('sync_queue')) database.createObjectStore('sync_queue', { keyPath: 'user_id' });
          if (!database.objectStoreNames.contains('participation_queue')) {
            const store = database.createObjectStore('participation_queue', { keyPath: 'key' });
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('event_id', 'event_id', { unique: false });
          }
          if (!database.objectStoreNames.contains('event_offline_songs')) {
            const store = database.createObjectStore('event_offline_songs', { keyPath: 'key' });
            store.createIndex('account_id', 'accountId', { unique: false });
            store.createIndex('event_id', 'eventId', { unique: false });
            store.createIndex('event_date', 'eventDate', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put({
          user_id: userId,
          updated_at: '2026-11-03T08:00:00.000Z',
          pending_sync: false,
          state: {
            profile: { name: 'Offline Fixture', bandName: 'Offline Test Band' },
            settings: { theme: 'light', accent: '#1554FF' },
            songs: [{ id: 'offline-song-1', title: savedSongTitle, artist: 'Fixture Artist', lyrics: 'Saved locally' }],
            events: [{ id: 'offline-event-1', title: 'Offline Rehearsal', date: '2026-11-04' }],
            setlists: [],
            members: [],
            personalSongs: [],
            personalSetlists: [],
            groupMemberships: [],
            activeGroupId: null,
            onboardingDone: true
          }
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    }, { userId, savedSongTitle });

    // The service worker must already control the page before the cold offline reload.
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__bandplanAppReady === true, null, { timeout: 20_000 });
    const restored = await page.evaluate(({ userId }) => {
      const raw = localStorage.getItem('bandplan.premium.v6:' + userId);
      const state = raw ? JSON.parse(raw) : null;
      return {
        appReady: window.__bandplanAppReady === true,
        authUserId: window.__bandplanAuthUserId || null,
        authGateHidden: document.querySelector('#bpAuthGate')?.hidden === true,
        networkOffline: navigator.onLine === false,
        restoredSong: state?.songs?.some(song => song.title === 'Offline Fixture Song') || false,
        restoredEvent: state?.events?.some(event => event.title === 'Offline Rehearsal') || false
      };
    }, { userId });

    expect(restored.appReady, 'The authenticated offline workspace did not start').toBe(true);
    expect(restored.authUserId, 'The existing persisted session was not restored').toBe(userId);
    expect(restored.authGateHidden, 'The login gate remained visible after restoring the session').toBe(true);
    expect(restored.networkOffline, 'The browser context did not remain offline during the cold launch').toBe(true);
    expect(restored.restoredSong, 'The song from the IndexedDB snapshot was not restored').toBe(true);
    expect(restored.restoredEvent, 'The event from the IndexedDB snapshot was not restored').toBe(true);

    // WHY: exercise the real durable write path offline, then let the registered online listener flush it against a deterministic PostgREST fixture.
    const offlineEdit = await page.evaluate(async ({ userId }) => {
      const raw = localStorage.getItem('bandplan.premium.v6:' + userId);
      const state = JSON.parse(raw);
      state.songs[0].title = 'Offline Edited Fixture Song';
      try { await window.BandPlanCloud.saveNow(state); } catch (error) {
        // A network failure is expected; saveNow must have committed the snapshot and queue before attempting RPC.
      }
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('bandplan-cloud-v1', 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const records = await new Promise((resolve, reject) => {
        const tx = db.transaction(['sync_queue', 'snapshots'], 'readonly');
        const queueRequest = tx.objectStore('sync_queue').get(userId);
        const snapshotRequest = tx.objectStore('snapshots').get(userId);
        tx.oncomplete = () => resolve({ queue: queueRequest.result || null, snapshot: snapshotRequest.result || null });
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return {
        queued: records.queue?.state?.songs?.[0]?.title === 'Offline Edited Fixture Song',
        snapshotPending: records.snapshot?.pending_sync === true
      };
    }, { userId });
    expect(offlineEdit.queued, 'The offline edit was not written to the durable sync queue').toBe(true);
    expect(offlineEdit.snapshotPending, 'The offline snapshot was not marked pending').toBe(true);

    const supabaseUrl = await page.evaluate(() => window.BANDPLAN_CONFIG.supabaseUrl);
    await page.route(supabaseUrl.replace(/\/$/, '') + '/rest/v1/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/rpc/bandplan_get_my_group')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ group_id: 'offline-fixture-group' }]) });
      } else if (url.pathname.endsWith('/rpc/bandplan_rename_group') || url.pathname.endsWith('/rpc/bandplan_sync_group')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else if (url.pathname.endsWith('/bandplan_user_state')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated_at: '2026-11-03T09:00:00.000Z' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });
    await context.setOffline(false);
    await page.waitForFunction(async ({ userId }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('bandplan-cloud-v1', 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const queue = await new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const request = tx.objectStore('sync_queue').get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return !queue;
    }, { userId }, { timeout: 20_000 });
    const synced = await page.evaluate(async ({ userId }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('bandplan-cloud-v1', 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const snapshot = await new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readonly');
        const request = tx.objectStore('snapshots').get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return {
        pending: snapshot?.pending_sync === true,
        title: snapshot?.state?.songs?.[0]?.title || null
      };
    }, { userId });
    expect(synced.pending, 'The successfully uploaded offline snapshot remained pending').toBe(false);
    expect(synced.title, 'The synced snapshot lost the offline edit').toBe('Offline Edited Fixture Song');
  } finally {
    await context.close();
  }
});
