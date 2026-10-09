import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve('dist');
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.txt':'text/plain; charset=utf-8'
};
const compressible = /^(text\/|application\/(?:javascript|json|manifest\+json))/;

createServer(async (req,res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {'Allow':'GET, HEAD'}); res.end(); return;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep) || !existsSync(file)) {
      res.writeHead(404, {'Cache-Control':'no-store'}); res.end('Not found'); return;
    }
    const body = await readFile(file);
    const type = mime[extname(file)] || 'application/octet-stream';
    const headers = {'Content-Type':type,'Vary':'Accept-Encoding'};
    if (pathname === '/index.html' || pathname === '/sw.js') headers['Cache-Control']='no-cache, no-store, must-revalidate';
    else if (pathname.startsWith('/fonts/') || /^\/icon-/.test(pathname) || pathname === '/apple-touch-icon.png') headers['Cache-Control']='public, max-age=31536000, immutable';
    else headers['Cache-Control']='no-cache';
    let payload = body;
    if (compressible.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      payload = gzipSync(body, {level:6});
      headers['Content-Encoding']='gzip';
    }
    headers['Content-Length']=payload.length;
    res.writeHead(200,headers);
    res.end(req.method === 'HEAD' ? undefined : payload);
  } catch (error) {
    res.writeHead(500, {'Cache-Control':'no-store'}); res.end('Server error');
  }
}).listen(port,'127.0.0.1',()=>console.log('Lighthouse production-like server listening on '+port));
