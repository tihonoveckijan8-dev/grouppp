/* BandPlan offline app shell — resilient cache install and safe updates */
const V = 'bandplan-v54';
const SHELL = ['./', 'index.html', 'bandplan.css', 'bandplan.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'supabase.js'];
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
  const shell = /(?:^|\/)(?:index\.html|bandplan\.js|supabase\.js|bandplan\.css|manifest\.webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith((async () => {
    const cached = await caches.match(request, {ignoreSearch:true});
    if (shell) {
      try {
        const response = await fetch(request, {cache:'no-cache'});
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
