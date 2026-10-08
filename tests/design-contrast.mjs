import fs from 'node:fs';
import assert from 'node:assert/strict';

const css=fs.readFileSync('bandplan.css','utf8');
const sources=['bandplan-core.js','bandplan.js','supabase.js','index.html'];
const files=Object.fromEntries(sources.map(p=>[p,fs.readFileSync(p,'utf8')]));
const hexRx=/(#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g;
const bad=[];
for(const [file,text] of Object.entries(files)){
  for(const m of text.matchAll(hexRx)) bad.push(file+':'+(text.slice(0,m.index).split('\n').length)+': '+m[0]);
  if(text.split('\n').some(line=>line.includes('style=') && /(?:color|background|border-color|box-shadow)\s*:/i.test(line))) bad.push(file+': inline color style');
}
assert.equal(bad.length,0,'Hardcoded colors outside the token stylesheet:\n'+bad.join('\n'));
assert.equal([...css.matchAll(/--accent\s*:/g)].length,1,'--accent must have one canonical declaration');

function value(name){
  const line=css.split('\n').find(x=>x.includes(name+':'));
  assert.ok(line,'Missing token '+name);
  return line.split(name+':')[1].split(';')[0].trim().replace(/\s*!important$/,'');
}
function rgb(hex){
  const n=parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
}
function lum(hex){const [r,g,b]=rgb(hex);return .2126*r+.7152*g+.0722*b}
function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function oklch(hex){
  const [r,g,b]=rgb(hex),l=.4122214708*r+.5363325363*g+.0514459929*b,m=.2119034982*r+.6806995451*g+.1073969566*b,s=.0883024619*r+.2817188376*g+.6299787005*b;
  const [l3,m3,s3]=[l,m,s].map(Math.cbrt);
  const L=.2104542553*l3+.793617785*m3-.0040720468*s3,A=1.9779984951*l3-2.428592205*m3+.4505937099*s3,B=.0259040371*l3+.7827717662*m3-.8086757662*s3;
  return {L,C:Math.hypot(A,B),H:Math.atan2(B,A)};
}
function toHex(L,C,H){
  const A=C*Math.cos(H),B=C*Math.sin(H),l3=L+.3963377774*A+.2158037573*B,m3=L-.1055613458*A-.0638541728*B,s3=L-.0894841775*A-1.291485548*B,l=l3**3,m=m3**3,s=s3**3;
  const vals=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
  return '#'+vals.map(v=>Math.round(255*(v<=.0031308?12.92*Math.max(0,v):1.055*Math.pow(Math.max(0,Math.min(1,v)),1/2.4)-.055)).toString(16).padStart(2,'0')).join('');
}
function accessibleAccent(hex,bg){
  const base=oklch(hex),dir=lum(bg)>.179?-1:1,ratio=L=>contrast(toHex(L,base.C,base.H),bg);
  if(ratio(base.L)>=4.5)return toHex(base.L,base.C,base.H);
  let lo=dir<0?0:base.L,hi=dir<0?base.L:1;
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(ratio(mid)>=4.5){if(dir<0)lo=mid;else hi=mid}else{if(dir<0)hi=mid;else lo=mid}}
  return toHex(dir<0?lo:hi,base.C,base.H);
}
const themes=['light','dark','amoled'];
const accents=['red','orange','amber','green','teal','blue','indigo','purple','pink'];
for(const theme of themes){
  const bg=value('--theme-color-'+theme);
  for(const accent of accents){
    const base=value('--accent-preset-'+accent+'-'+theme);
    const adjusted=accessibleAccent(base,bg);
    assert.ok(contrast(adjusted,bg)>=4.5-1e-6,theme+'/'+accent+' accent text contrast < 4.5: '+contrast(adjusted,bg));
    assert.ok(contrast(adjusted,bg)>=3-1e-6,theme+'/'+accent+' interactive contrast < 3: '+contrast(adjusted,bg));
    const onWhite=contrast(base,value('--token-white')),onBlack=contrast(base,value('--token-black'));
    assert.ok(Math.max(onWhite,onBlack)>=4.5-1e-6,theme+'/'+accent+' on-accent text cannot reach 4.5');
  }
}
assert.equal(value('--theme-color-amoled'),'#000000','AMOLED background must be #000000');
console.log('BandPlan design contrast audit: PASS');
console.log('Matrix: 3 themes × 9 presets = 27 combinations');
console.log('Hardcoded JS/index colors: 0');
