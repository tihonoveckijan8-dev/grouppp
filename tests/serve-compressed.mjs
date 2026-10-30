import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = path.resolve('dist');
const HOST = '127.0.0.1';
const PORT = 4175;
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
};

function acceptsGzip(header = '') {
  return header.split(',').some(token => {
    const [name, ...params] = token.trim().split(';');
    const quality = params.find(value => value.trim().startsWith('q='));
    return name.trim() === 'gzip' && (!quality || Number(quality.trim().slice(2)) > 0);
  });
}

// WHY: Python's basic test server does not negotiate compression, while GitHub Pages does; emulate gzip so browser transfer metrics are not mistaken for production wire size.
const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    let filePath = path.resolve(ROOT, `.${pathname}`);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let fileInfo;
    try {
      fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) throw new Error('Not a file');
    } catch {
      // WHY: preserve the app's hash-router navigation fallback without turning missing asset requests into HTML.
      if (path.extname(pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
        return;
      }
      filePath = path.join(ROOT, 'index.html');
      fileInfo = await stat(filePath);
    }

    const original = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME[extension] || 'application/octet-stream';
    const compressible = contentType.startsWith('text/') ||
      contentType === 'application/javascript' ||
      contentType === 'application/manifest+json';
    const compressed = compressible && original.length >= 1024 && acceptsGzip(req.headers['accept-encoding']);
    const body = compressed ? gzipSync(original, { level: 6 }) : original;
    const headers = {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': 'no-store'
    };
    if (compressible) headers.Vary = 'Accept-Encoding';
    if (compressed) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Test server error');
    process.stderr.write(String(error) + '\n');
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`BandPlan gzip test server listening on http://${HOST}:${PORT}\n`);
});
