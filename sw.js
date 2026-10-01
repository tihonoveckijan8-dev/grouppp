/* BandPlan service worker: оболочка в кэше, работает офлайн */
const V = 'bandplan-v16';
const SHELL = ['./', 'index.html', 'bandplan.css', 'bandplan.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'supabase.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  const appShell = /(?:^|\/)(?:index\.html|bandplan\.js|supabase\.js|bandplan\.css|manifest\.webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    const hit = await caches.match(r, { ignoreSearch: true });
    /* Сетевые версии приложения имеют приоритет: обновления не должны
       застревать в старом cache-first shell. При офлайне используем кэш. */
    if (appShell) {
      try {
        const fresh = await fetch(r, { cache: 'no-store' });
        if (fresh && (fresh.ok || fresh.type === 'opaque')) {
          const copy = fresh.clone();
          caches.open(V).then(c => c.put(r, copy));
        }
        return fresh;
      } catch (err) {
        return hit || caches.match('index.html');
      }
    }
    if (hit) return hit;
    try {
      const fresh = await fetch(r);
      if (fresh && (fresh.ok || fresh.type === 'opaque')) {
        const copy = fresh.clone();
        caches.open(V).then(c => c.put(r, copy));
      }
      return fresh;
    } catch (err) {
      return caches.match('index.html');
    }
  })());
});