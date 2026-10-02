/* BandPlan service worker: оболочка в кэше, работает офлайн */
const V = 'bandplan-v27';
const SHELL = ['./', 'index.html', 'bandplan.css', 'bandplan.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'supabase.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;

  const appShell = /(?:^|\/)(?:index\.html|bandplan\.js|supabase\.js|bandplan\.css|manifest\.webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');

  e.respondWith((async () => {
    const cached = await caches.match(r, { ignoreSearch: true });

    /* Network-first for the app shell: new deployments are picked up on the
       next navigation/reload, without forcing a reload or interrupting a
       session. Offline falls back to the last known shell. */
    if (appShell) {
      try {
        const fresh = await fetch(r, { cache: 'no-cache' });
        if (fresh && (fresh.ok || fresh.type === 'opaque')) {
          const copy = fresh.clone();
          caches.open(V).then(cache => cache.put(r, copy)).catch(() => {});
        }
        return fresh;
      } catch (err) {
        return cached || caches.match('index.html');
      }
    }

    if (cached) return cached;
    try {
      const fresh = await fetch(r);
      if (fresh && (fresh.ok || fresh.type === 'opaque')) {
        const copy = fresh.clone();
        caches.open(V).then(cache => cache.put(r, copy)).catch(() => {});
      }
      return fresh;
    } catch (err) {
      return caches.match('index.html');
    }
  })());
});
