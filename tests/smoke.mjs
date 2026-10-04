import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const root = process.cwd();
const mime = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json',
  '.png':'image/png',
  '.svg':'image/svg+xml'
};

const server = createServer(async (req, res) => {
  try {
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safePath = normalize(rawPath).replace(/^([.][.][/\\])+/, '');
    const filePath = join(root, safePath === '/' ? 'index.html' : safePath);
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, {'Content-Type': mime[extname(filePath)] || 'application/octet-stream'});
    createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500); res.end(String(error));
  }
});

await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({headless: true});
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];

page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window.BandPlanCloud !== 'undefined', null, {timeout: 15000});
  await page.waitForSelector('#bpAuthGate', {state:'visible', timeout: 15000});

  const result = await page.evaluate(() => ({
    cloud: typeof window.BandPlanCloud !== 'undefined',
    authForm: !!document.querySelector('#bpAuthForm'),
    email: !!document.querySelector('#bpAuthEmail'),
    password: !!document.querySelector('#bpAuthPassword'),
    submit: !!document.querySelector('#bpAuthSubmit'),
    title: document.querySelector('#bpAuthGate h1')?.textContent?.trim() || ''
  }));

  assert.equal(result.cloud, true, 'window.BandPlanCloud is not defined');
  assert.equal(result.authForm, true, 'Auth form was not rendered');
  assert.equal(result.email, true, 'Email field was not rendered');
  assert.equal(result.password, true, 'Password field was not rendered');
  assert.equal(result.submit, true, 'Login button was not rendered');
  assert.equal(result.title, 'С возвращением', 'Unexpected auth gate title');

  assert.deepEqual(pageErrors, [], 'Browser pageerror detected');
  assert.deepEqual(consoleErrors, [], 'Browser console.error detected');

  console.log('BandPlan auth smoke: PASS');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
