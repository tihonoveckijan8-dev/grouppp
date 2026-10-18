import { build } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
  'apple-touch-icon.png',
  'icon-bandplan.svg',
  'icon-splash.svg',
  'icon-maskable-splash.svg'
];

for (const file of staticFiles) {
  const source = path.join(root, file);
  if (existsSync(source)) await cp(source, path.join(out, file));
}


 // WHY: generate matching raster icons from the single source-of-truth SVG so
 // installed browsers and iOS home-screen links never keep an older artwork.
 const iconSvg = await readFile(path.join(out, 'icon-bandplan.svg'), 'utf8');
 for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
   const png = new Resvg(iconSvg, { fitTo: { mode: 'width', value: size } }).render().asPng();
   await writeFile(path.join(out, file), png);
 }

for (const dir of ['assets', 'fonts', 'vendor']) {
  const source = path.join(root, dir);
  if (existsSync(source)) await cp(source, path.join(out, dir), {recursive:true});
}

for (const file of ['bandplan.js','bandplan-core.js','config.js','supabase.js','sw.js','bandplan.css','bandplan-depth.css']) {
  // WHY: generate a fresh shell cache namespace on every build instead of relying on manual SW edits.
  if (file === 'sw.js') {
    const source = await readFile(path.join(root, file), 'utf8');
    const version = `${new Date().toISOString().slice(0,10).replaceAll('-', '')}-${Date.now()}`;
    await build({
      stdin: { contents: source.replaceAll('__BANDPLAN_CACHE_VERSION__', version), resolveDir: root, sourcefile: file, loader: 'js' },
      outfile: path.join(out, file), bundle: false, minify: true,
      target: ['es2020', 'safari15'], legalComments: 'none', charset: 'utf8'
    });
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
