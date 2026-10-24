/**
 * Reproducible synthetic benchmark for the BandPlan BPM detector.
 *
 * Run after installing dependencies:
 *   node tests/tempo-benchmark.mjs
 *
 * WHY: generated signals have known BPM and beat timestamps, so algorithm
 * changes can be compared without relying on subjective listening tests.
 * Synthetic clicks are a smoke benchmark, not a substitute for real songs.
 */
import { performance } from 'node:perf_hooks';
import { detect, beatTrack, tempo, combTempo } from '@audio/beat';

const FS = 22050;
const DURATION = 24;
const MIN_BPM = 40;
const MAX_BPM = 240;

function makeClickTrack(bpm, seconds = DURATION, opts = {}) {
  const samples = new Float32Array(Math.floor(FS * seconds));
  const beatPeriod = 60 / bpm;
  const swing = Number(opts.swing || 0);
  const subdivision = opts.subdivision !== false;
  const phase = Number(opts.phase || 0.137);

  function addClick(time, amplitude, frequency = 1500) {
    const start = Math.round(time * FS);
    const length = Math.min(Math.round(FS * 0.045), samples.length - start);
    if (start < 0 || start >= samples.length) return;
    for (let i = 0; i < length; i++) {
      const t = i / FS;
      // Short, damped broadband-ish click with several partials.
      const envelope = Math.exp(-t * 95);
      const click = Math.sin(2 * Math.PI * frequency * t)
        + 0.48 * Math.sin(2 * Math.PI * frequency * 1.73 * t)
        + 0.22 * Math.sin(2 * Math.PI * frequency * 2.41 * t);
      samples[start + i] += amplitude * envelope * click;
    }
  }

  let beat = 0;
  for (let time = phase; time < seconds; beat++) {
    const swingOffset = beat % 2 ? swing * beatPeriod * 0.25 : 0;
    const accent = beat % 4 === 0 ? 1 : beat % 2 === 0 ? 0.72 : 0.52;
    addClick(time + swingOffset, accent, beat % 4 === 0 ? 1100 : 1650);
    if (subdivision) addClick(time + beatPeriod * 0.5 + swingOffset * 0.5, 0.11, 3100);
    time += beatPeriod;
  }

  // A low-level deterministic noise bed prevents an unrealistically silent background.
  let seed = 0x12345678;
  for (let i = 0; i < samples.length; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    samples[i] += (((seed / 0xffffffff) * 2) - 1) * 0.0012;
  }
  return samples;
}

function makeTempoChangeTrack(firstBpm, secondBpm, seconds = DURATION) {
  const half = seconds / 2;
  const a = makeClickTrack(firstBpm, half, { phase: 0.137 });
  const b = makeClickTrack(secondBpm, seconds - half, { phase: 0.137 });
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function safeCall(name, fn, samples) {
  const started = performance.now();
  try {
    const result = fn(samples, { fs: FS, minBpm: MIN_BPM, maxBpm: MAX_BPM, candidates: 5 });
    const elapsedMs = performance.now() - started;
    const bpm = Number(result?.bpm);
    return {
      algorithm: name,
      bpm: Number.isFinite(bpm) ? Number(bpm.toFixed(2)) : null,
      confidence: Number.isFinite(Number(result?.confidence)) ? Number(result.confidence) : null,
      beatCount: result?.beats?.length ?? null,
      elapsedMs: Number(elapsedMs.toFixed(1)),
      error: null
    };
  } catch (error) {
    return { algorithm: name, bpm: null, confidence: null, beatCount: null, elapsedMs: null, error: String(error?.message || error) };
  }
}

function errorMetrics(actual, expected) {
  if (!Number.isFinite(actual)) return { absError: null, octaveAwareError: null, within2Bpm: false, octaveError: false };
  const absError = Math.abs(actual - expected);
  const variants = [expected / 2, expected, expected * 2].filter(v => v >= MIN_BPM && v <= MAX_BPM);
  const octaveAwareError = Math.min(...variants.map(v => Math.abs(actual - v)));
  return {
    absError: Number(absError.toFixed(2)),
    octaveAwareError: Number(octaveAwareError.toFixed(2)),
    within2Bpm: absError <= 2,
    octaveError: octaveAwareError <= 2 && absError > 2
  };
}

function runCase(name, expected, samples) {
  const opts = { fs: FS, minBpm: MIN_BPM, maxBpm: MAX_BPM, candidates: 5 };
  const rows = [
    safeCall('detect', detect, samples),
    safeCall('beatTrack', beatTrack, samples),
    safeCall('tempo', tempo, samples),
    safeCall('combTempo', combTempo, samples)
  ].map(row => ({ ...row, ...errorMetrics(row.bpm, expected) }));
  return { case: name, expectedBpm: expected, rows };
}

const cases = [];
for (const bpm of [55, 67, 80, 93, 110, 120, 137, 160, 180, 200]) {
  cases.push(runCase(`steady-${bpm}`, bpm, makeClickTrack(bpm)));
}

// Test local tempo tracking independently, avoiding a misleading single average BPM.
for (const [first, second] of [[80, 120], [95, 145]]) {
  const samples = makeTempoChangeTrack(first, second);
  const split = Math.floor(samples.length / 2);
  const left = samples.subarray(0, split);
  const right = samples.subarray(split);
  cases.push(runCase(`change-${first}-to-${second}-first-half`, first, left));
  cases.push(runCase(`change-${first}-to-${second}-second-half`, second, right));
}

const rows = cases.flatMap(c => c.rows.map(r => ({ ...r, case: c.case, expectedBpm: c.expectedBpm })));
const summary = {};
for (const algorithm of ['detect', 'beatTrack', 'tempo', 'combTempo']) {
  const valid = rows.filter(r => r.algorithm === algorithm && Number.isFinite(r.absError));
  const exactish = valid.filter(r => r.within2Bpm).length;
  const octave = valid.filter(r => r.octaveError).length;
  const errors = valid.map(r => r.absError).sort((a, b) => a - b);
  summary[algorithm] = {
    successfulCases: valid.length,
    totalCases: cases.length,
    within2Bpm: exactish,
    octaveErrors: octave,
    medianAbsoluteErrorBpm: errors.length ? errors[Math.floor(errors.length / 2)] : null,
    medianRuntimeMs: (() => {
      const times = valid.map(r => r.elapsedMs).filter(Number.isFinite).sort((a, b) => a - b);
      return times.length ? times[Math.floor(times.length / 2)] : null;
    })()
  };
}

console.log(JSON.stringify({
  benchmark: 'BandPlan synthetic tempo benchmark',
  sampleRate: FS,
  durationSeconds: DURATION,
  note: 'Synthetic click-track results are diagnostic only; test real licensed audio before choosing a production engine.',
  summary,
  cases
}, null, 2));
