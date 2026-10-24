/**
 * Essentia.js experimental BPM benchmark (development-only).
 * WHY: compare a second, independent beat tracker without bundling its AGPL-3.0
 * package into the BandPlan production app. Review licensing before shipping it.
 * Run: npm run test:tempo:essentia
 */
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const pkg = require('essentia.js');
const essentia = new pkg.Essentia(pkg.EssentiaWASM);
const FS = 44100; // RhythmExtractor2013 expects 44.1 kHz input.
const DURATION = 18;
const BPMS = [55, 67, 80, 93, 110, 120, 137, 160, 180, 200];

function makeClickTrack(bpm) {
  const samples = new Float32Array(FS * DURATION);
  const period = 60 * FS / bpm;
  let seed = 0x12345678;
  for (let start = Math.round(0.137 * FS); start < samples.length; start += Math.round(period)) {
    const n = Math.min(Math.round(FS * 0.04), samples.length - start);
    for (let i = 0; i < n; i++) {
      const t = i / FS;
      samples[start + i] += Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 100);
    }
  }
  for (let i = 0; i < samples.length; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    samples[i] += ((seed / 0xffffffff) * 2 - 1) * 0.0002;
  }
  return samples;
}

function release(value) {
  try { value?.delete?.(); } catch {}
}

const rows = [];
for (const expectedBpm of BPMS) {
  const samples = makeClickTrack(expectedBpm);
  let input = null;
  let result = null;
  const started = performance.now();
  try {
    input = essentia.arrayToVector(samples);
    result = essentia.RhythmExtractor2013(input, 208, 'multifeature', 40);
    const bpm = Number(result?.bpm);
    rows.push({
      expectedBpm,
      bpm: Number.isFinite(bpm) ? Number(bpm.toFixed(2)) : null,
      absError: Number.isFinite(bpm) ? Number(Math.abs(bpm - expectedBpm).toFixed(2)) : null,
      within2Bpm: Number.isFinite(bpm) && Math.abs(bpm - expectedBpm) <= 2,
      confidence: Number.isFinite(Number(result?.confidence)) ? Number(result.confidence) : null,
      beatCount: result?.ticks ? essentia.vectorToArray(result.ticks).length : null,
      elapsedMs: Number((performance.now() - started).toFixed(1)),
      error: null
    });
  } catch (error) {
    rows.push({
      expectedBpm, bpm: null, absError: null, within2Bpm: false,
      confidence: null, beatCount: null,
      elapsedMs: Number((performance.now() - started).toFixed(1)),
      error: String(error?.message || error)
    });
  } finally {
    release(result?.ticks);
    release(result?.estimates);
    release(result?.bpmIntervals);
    release(input);
  }
}

const valid = rows.filter(row => Number.isFinite(row.absError));
const errors = valid.map(row => row.absError).sort((a, b) => a - b);
const summary = {
  algorithm: 'Essentia.js RhythmExtractor2013 / multifeature',
  successfulCases: valid.length,
  totalCases: rows.length,
  within2Bpm: valid.filter(row => row.within2Bpm).length,
  medianAbsoluteErrorBpm: errors.length ? errors[Math.floor(errors.length / 2)] : null,
  medianRuntimeMs: (() => {
    const times = valid.map(row => row.elapsedMs).sort((a, b) => a - b);
    return times.length ? times[Math.floor(times.length / 2)] : null;
  })()
};
console.log(JSON.stringify({
  benchmark: 'BandPlan Essentia.js synthetic BPM benchmark',
  sampleRate: FS,
  durationSeconds: DURATION,
  license: 'AGPL-3.0; development benchmark only, not bundled into production.',
  note: 'Synthetic click tracks are diagnostic only and do not establish accuracy on real songs.',
  summary,
  cases: rows
}, null, 2));

if (valid.length === 0) {
  throw new Error('Essentia.js benchmark produced no valid BPM results.');
}
