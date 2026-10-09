import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('bandplan.css', 'utf8');
const escapeRx = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function token(name) {
  const match = css.match(new RegExp(escapeRx(name) + ':([^;}]+)'));
  assert.ok(match, 'Missing design token ' + name);
  return match[1].trim();
}
function lastBlock(selector) {
  const matches = [...css.matchAll(new RegExp(escapeRx(selector) + '\\s*\\{([^}]*)\\}', 'g'))];
  assert.ok(matches.length, 'Missing theme block ' + selector);
  return matches[matches.length - 1][1];
}
function declaration(block, name) {
  const match = block.match(new RegExp('(?:^|;)\\s*' + escapeRx(name) + ':([^;]+)'));
  assert.ok(match, 'Missing declaration ' + name + ' in theme block');
  return match[1].trim();
}
function resolve(value, seen = new Set()) {
  const raw = value.match(/^var\\((--[\\w-]+)\\)$/);
  if (!raw) return value;
  assert.ok(!seen.has(raw[1]), 'Circular token reference: ' + raw[1]);
  seen.add(raw[1]);
  return resolve(token(raw[1]), seen);
}
function parseColor(value, background = '#FFFFFF') {
  value = resolve(value);
  if (/^#[\\da-f]{3}$/i.test(value)) value = '#' + [...value.slice(1)].map(c=>c+c).join('');
  if (/^#[\\da-f]{6}$/i.test(value)) return [1,3,5].map(i => parseInt(value.slice(i,i+2),16));
  const rgba = value.match(/^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*([\\d.]+))?\\s*\\)$/i);
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
const themes = ['light','dark','amoled'].map(id => {
  const block = lastBlock('[data-theme="'+id+'"]');
  const read = name => declaration(block,name);
  return {
    id,
    bg:read('--bg'),
    surface:read('--surf-1'),
    text:read('--text'),
    text2:read('--text-2'),
    muted:read('--muted'),
    border:read('--control-border')
  };
});
for (const theme of themes) {
  const bg = parseColor(theme.bg);
  const surface = parseColor(theme.surface, bg);
  for (const [label, color] of [['text',theme.text],['secondary text',theme.text2],['muted text',theme.muted]]) {
    for (const [surfaceName,surfaceColor] of [['background',bg],['surface',surface]]) {
      const ratio=contrast(parseColor(color,bg),surfaceColor);
      assert.ok(ratio>=4.5,theme.id+' '+label+' on '+surfaceName+' is '+ratio.toFixed(2)+':1 (needs 4.5:1)');
    }
  }
  for (const [surfaceName,surfaceColor] of [['background',bg],['surface',surface]]) {
    const border = parseColor(theme.border, surfaceColor);
    const ratio=contrast(border,surfaceColor);
    assert.ok(ratio>=3,theme.id+' control border on '+surfaceName+' is '+ratio.toFixed(2)+':1 (needs 3:1)');
  }
}
assert.match(css, /#f_members \.chip[\\s\\S]*?white-space:normal/,'Participant chips must wrap');
assert.match(css, /\\.data-action-danger \\.data-action-buttons \\.btn[\\s\\S]*?white-space:normal/,'Destructive action labels must not be clipped');
assert.match(css, /#libQ::placeholder[^\\{]*\\{[^}]*opacity:1/,'Setlist library search placeholder must remain visible');
assert.match(css, /:focus-visible\\{outline:2px solid var\\(--accent-ring/,'Focus outline must use the accent color token');
assert.match(css, /@media \\(max-width:767px\\)\\{\\s*\\.cal-selected-day\\{display:block/,'Selected-day list must appear throughout the mobile breakpoint');
console.log('BandPlan component contrast audit: PASS');
console.log('Matrix: 3 themes × 3 text roles × 2 surfaces + control-border checks against both surfaces');
