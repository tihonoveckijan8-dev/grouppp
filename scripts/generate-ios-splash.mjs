#!/usr/bin/env node
// BandPlan iOS startup images — dev-only generator.
// Usage: npm i -D sharp && node scripts/generate-ios-splash.mjs
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('assets/ios-splash');
const sizes = [
  ['se',750,1334],['12-14',1170,2532],['12-14-pro-max',1284,2778],
  ['15-16',1179,2556],['15-16-plus',1290,2796],['15-16-pro-max',1320,2868],
  ['ipad-10-11',1668,2388],['ipad-pro-12-9',2048,2732]
];
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
await fs.mkdir(OUT,{recursive:true});
for (const [theme,bg,fg] of [['light','#F4F6F8','#111827'],['dark','#14161C','#ECEEF3']]) {
  for (const [name,w,h] of sizes) {
    const box=Math.round(Math.min(w,h)*.12), x=Math.round((w-box)/2), y=Math.round((h-box)/2), r=Math.round(box*.24);
    const font=Math.max(72,Math.min(180,Math.round(Math.min(w,h)*.08)));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="100%" height="100%" fill="${bg}"/>
      <rect x="${x}" y="${y}" width="${box}" height="${box}" rx="${r}" fill="#2547D0"/>
      <text x="50%" y="${y+box*.61}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="${font}" font-weight="800" fill="#fff">BP</text>
      <text x="50%" y="${y+box*1.72}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="${Math.max(24,Math.round(font*.55))}" font-weight="700" fill="${esc(fg)}">BandPlan</text>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT,`apple-startup-${theme}-${name}.png`));
  }
}
console.log('Generated', sizes.length*2, 'iOS startup images in', OUT);
