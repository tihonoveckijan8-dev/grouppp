/* BandPlan service worker: оболочка в кэше, работает офлайн */
const V = 'bandplan-v26';
const SHELL = ['./', 'index.html', 'bandplan.css', 'bandplan.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'supabase.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  const appShell = /(?:^|\/)(?:index\.html|bandplan\.js|supabase\.js|bandplan\.css|manifest\.webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    const hit = await caches.match(r, { ignoreSearch: true });
    if (appShell && hit) return hit;
    try {
      const fresh = await fetch(r);
      if (fresh && (fresh.ok || fresh.type === 'opaque')) {
        const copy = fresh.clone();
        caches.open(V).then(cache => cache.put(r, copy)).catch(() => {});
      }
      return fresh;
    } catch (err) {
      return hit || caches.match('index.html');
    }
  })());
});