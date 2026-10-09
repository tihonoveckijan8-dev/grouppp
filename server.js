import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// WHY: cache immutable static assets aggressively, but always revalidate HTML and the service worker.
app.use((req, res, next) => {
  const pathname = req.path || '/';
  if (pathname === '/' || pathname.endsWith('.html') || pathname === '/sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (pathname.startsWith('/fonts/') || /^\/icon-/.test(pathname)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// WHY: static assets must return their own status; never turn a missing .js/.png into HTML.
app.use(express.static(__dirname, {
  etag: false,
  maxAge: 0,
  index: 'index.html',
  setHeaders: (res, filePath) => {
    const pathname = filePath.replaceAll('\\\\', '/');
    if (/\/fonts\//.test(pathname) || /\/icon-/.test(pathname)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else if (/\.html$/.test(pathname) || /\/sw\.js$/.test(pathname)) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// WHY: SPA fallback applies only to GET navigation paths without a file extension.
app.use((req, res, next) => {
  if (req.method !== 'GET' || path.extname(req.path)) return res.status(404).type('text').send('Not Found');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`BandPlan running on http://${HOST}:${PORT}`);
});
