/* BandPlan offline app shell — resilient cache install and safe updates */
// WHY: scripts/build.mjs replaces this token on every production build to invalidate stale app-shell caches.
const V = 'bandplan-__BANDPLAN_CACHE_VERSION__';
const SHELL = ['https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/622c2f1c32c8cfce4158ddc3eb26e518ddef37e5/samples/guitar-acoustic/A2.mp3', 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/622c2f1c32c8cfce4158ddc3eb26e518ddef37e5/samples/guitar-acoustic/A3.mp3', 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/622c2f1c32c8cfce4158ddc3eb26e518ddef37e5/samples/guitar-acoustic/A4.mp3', './', 'index.html', 'bandplan.css', 'bandplan-depth.css?v=20261028-more-square-cards-v45', 'bandplan.js', 'bandplan-core.js', 'metronome-audio.js', 'chord-library.js', 'manifest.webmanifest', 'icon-bandplan.svg?v=__BANDPLAN_ASSET_VERSION__', 'icon-maskable.svg?v=__BANDPLAN_ASSET_VERSION__', 'logo-bandplan.svg?v=__BANDPLAN_ASSET_VERSION__', 'icon-192.png?v=__BANDPLAN_ASSET_VERSION__', 'icon-512.png?v=__BANDPLAN_ASSET_VERSION__', 'icon-maskable-512.png?v=__BANDPLAN_ASSET_VERSION__', 'apple-touch-icon.png?v=__BANDPLAN_ASSET_VERSION__', 'icon-splash.svg', 'icon-maskable-splash.svg', 'config.js', 'supabase.js', 'vendor/supabase.min.js', 'fonts/manrope-latin-wght-normal.woff2', 'fonts/manrope-cyrillic-wght-normal.woff2'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(V);
    // WHY: limit install-time network and disk pressure so a background app update cannot cause random UI stalls.
    let nextIndex = 0;
    const workers = Array.from({length: 3}, async () => {
      while (nextIndex < SHELL.length) {
        const path = SHELL[nextIndex++];
        try {
          const response = await fetch(path);
          if (response && response.ok) await cache.put(path, response);
        } catch (_) { /* WHY: one unavailable optional asset must not block the offline shell. */ }
      }
    });
    await Promise.all(workers);
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('bandplan-') && key !== V).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const shell = /(?:^|[/])(?:index[.]html|bandplan[.]js|bandplan-core[.]js|metronome-audio[.]js|chord-library[.]js|supabase[.]js|config[.]js|bandplan[.]css|bandplan-depth[.]css|manifest[.]webmanifest|vendor[/]supabase[.]min[.]js|fonts[/]manrope-[^/]+[.]woff2)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith((async () => {
    // WHY: the active worker must never read assets pre-cached by a newer waiting worker; that would mix app versions mid-session.
    const cache = await caches.open(V);
    // WHY: app-shell URLs in index.html carry build query strings, while install precaches canonical paths; ignore query strings to reuse the same-version shell offline.
    const cached = shell
      ? await cache.match(request, {ignoreSearch:true})
      : await cache.match(request);
    if (shell) {
      // WHY: keep one consistent app version for the whole active session.
      // A new build is installed into a versioned cache by the waiting worker;
      // it becomes available after the current clients close and the app is reopened.
      if (cached) return cached;
      // WHY: a missing shell asset must not hold startup indefinitely on a stalled network.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(request, {cache:'no-cache', signal:controller.signal});
        if (response && response.ok) {
          const copy = response.clone();
          cache.put(request, copy).catch(() => {});
        }
        return response;
      } catch (_) {
        return await cache.match('index.html') || Response.error();
      } finally {
        clearTimeout(timeout);
      }
    }
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const copy = response.clone();
        cache.put(request, copy).catch(() => {});
      }
      return response;
    } catch (_) {
      return await cache.match('index.html') || Response.error();
    }
  })());
});
