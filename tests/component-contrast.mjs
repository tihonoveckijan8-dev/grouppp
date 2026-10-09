import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('bandplan.css', 'utf8');
function token(name) {
  const match = css.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':([^;}]+)'));
  assert.ok(match, 'Missing design token ' + name);
  return match[1].trim();
}
function resolve(value) {
  const raw = value.match(/^var\((--[\w-]+)\)$/);
  return raw ? resolve(token(raw[1])) : value;
}
function parseColor(value, background) {
  value = resolve(value);
  if (/^#[\da-f]{6}$/i.test(value)) {
    return [1,3,5].map(i => parseInt(value.slice(i,i+2),16));
  }
  const rgba = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  assert.ok(rgba, 'Unsupported token color format: ' + value);
  const foreground = [Number(rgba[1]),Number(rgba[2]),Number(rgba[3])];
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  if (alpha === 1) return foreground;
  const bg = parseColor(background);
  return foreground.map((channel,i) => Math.round(channel*alpha + bg[i]*(1-alpha)));
}
function luminance(rgb) {
  const [r,g,b] = rgb.map(v => {v/=255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
  return .2126*r + .7152*g + .0722*b;
}
function contrast(a,b) {
  const x=luminance(a), y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
const themes = [
  {id:'light',bg:'#F4F6F8',surface:'#FFFFFF',text:'#111827',text2:'#344054',muted:'#667085',border:'--control-border-light'},
  {id:'dark',bg:'#14161C',surface:'#191C23',text:'#ECEEF3',text2:'#C8CDD8',muted:'#98A2B3',border:'--control-border-dark'},
  {id:'amoled',bg:'#000000',surface:'#0B0B0E',text:'#ECEEF3',text2:'#C8CDD8',muted:'#98A2B3',border:'--control-border-amoled'}
];
for (const theme of themes) {
  for (const [label, color] of [['text',theme.text],['secondary text',theme.text2],['muted text',theme.muted]]) {
    for (const [surfaceName,surface] of [['background',theme.bg],['surface',theme.surface]]) {
      const ratio=contrast(parseColor(color),parseColor(surface));
      assert.ok(ratio>=4.5,theme.id+' '+label+' on '+surfaceName+' is '+ratio.toFixed(2)+':1 (needs 4.5:1)');
    }
  }
  const border = parseColor(token(theme.border), theme.bg);
  for (const [surfaceName,surface] of [['background',theme.bg],['surface',theme.surface]]) {
    const ratio=contrast(border,parseColor(surface));
    assert.ok(ratio>=3,theme.id+' control border on '+surfaceName+' is '+ratio.toFixed(2)+':1 (needs 3:1)');
  }
}
assert.match(css, /#f_members \.chip[\s\S]*?white-space:normal/,'Participant chips must wrap');
assert.match(css, /\.data-action-danger \.data-action-buttons \.btn[\s\S]*?white-space:normal/,'Destructive action labels must not be clipped');
assert.match(css, /#libQ::placeholder[^\{]*\{[^}]*opacity:1/,'Setlist library search placeholder must remain visible');
assert.match(css, /:focus-visible\{outline:2px solid var\(--accent-ring/,'Focus outline must use the accent color token');
assert.match(css, /@media \(max-width:767px\)\{\s*\.cal-selected-day\{display:block/,'Selected-day list must appear throughout the mobile breakpoint');
console.log('BandPlan component contrast audit: PASS');
console.log('Matrix: 3 themes × 3 text roles × 2 surfaces + 3 control-border checks per theme');
