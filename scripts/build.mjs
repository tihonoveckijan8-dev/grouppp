import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFile } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');

await rm(out, {recursive:true, force:true});
await mkdir(out, {recursive:true});

const staticFiles = [
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

for (const file of staticFiles) {
  const source = path.join(root, file);
  if (existsSync(source)) await cp(source, path.join(out, file));
}

for (const dir of ['assets', 'fonts', 'vendor']) {
  const source = path.join(root, dir);
  if (existsSync(source)) await cp(source, path.join(out, dir), {recursive:true});
}

for (const file of ['bandplan.js','bandplan-core.js','supabase.js','sw.js','bandplan.css']) {
  // WHY: generate a fresh shell cache namespace on every build instead of relying on manual SW edits.
  if (file === 'sw.js') {
    const source = await readFile(path.join(root, file), 'utf8');
    const version = `bandplan-${new Date().toISOString().slice(0,10).replaceAll('-', '')}-${Date.now()}`;
    await writeFile(path.join(out, file), source.replaceAll('__BANDPLAN_CACHE_VERSION__', version));
    continue;
  }
  await build({
    entryPoints:[path.join(root,file)],
    outfile:path.join(out,file),
    bundle:false,
    minify:true,
    target:['es2020','safari15'],
    legalComments:'none',
    charset:'utf8'
  });
}

await writeFile(path.join(out, '.nojekyll'), '');
console.log('BandPlan production build complete:', out);
