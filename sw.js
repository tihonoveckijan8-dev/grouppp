/* BandPlan offline app shell — resilient cache install and safe updates */
// WHY: scripts/build.mjs replaces this token on every production build to invalidate stale app-shell caches.
const V = '__BANDPLAN_CACHE_VERSION__';
const SHELL = ['./', 'index.html', 'bandplan.css', 'bandplan.js', 'bandplan-core.js', 'manifest.webmanifest', 'icon-192.png?v=3', 'icon-512.png?v=3', 'icon-maskable-512.png?v=3', 'apple-touch-icon.png?v=3', 'icon-splash.svg', 'icon-maskable-splash.svg', 'supabase.js', 'vendor/supabase.min.js', 'fonts/manrope-latin-wght-normal.woff2', 'fonts/manrope-cyrillic-wght-normal.woff2'];
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(V);
    // A single unavailable optional icon must not prevent the whole app from
    // installing its offline shell.
    await Promise.all(SHELL.map(async path => {
      try {
        const response = await fetch(path, {cache:'reload'});
        if (response && response.ok) await cache.put(path, response);
      } catch (_) { return null; }
    }));
    await self.skipWaiting();
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
  const shell = /(?:^|\/)(?:index\.html|bandplan\.js|bandplan-core\.js|supabase\.js|bandplan\.css|manifest\.webmanifest|vendor\/supabase\.min\.js|fonts\/manrope-[^/]+\.woff2)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (shell) {
      // Online: prefer the newest deployed asset immediately.
      // Offline: fall back to the last known-good cached shell.
      try {
        // WHY: a stalled shell request must not hold startup indefinitely; use the last cached shell after 4 seconds.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        let response;
        try { response = await fetch(request, {cache:'no-cache', signal:controller.signal}); }
        finally { clearTimeout(timeout); }
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(V).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      } catch (_) {
        return cached || await caches.match('index.html') || Response.error();
      }
    }
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(V).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    } catch (_) {
      return await caches.match('index.html') || Response.error();
    }
  })());
});
