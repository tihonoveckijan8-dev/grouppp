/**
 * Essentia.js experimental BPM benchmark (development-only).
 * WHY: compare a second, independent beat tracker without bundling its AGPL-3.0
 * package into the BandPlan production app. Review licensing before shipping it.
 * Run: npm run test:tempo:essentia
 */
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { detect, beatTrack, tempo, combTempo } from '@audio/beat';

const require = createRequire(import.meta.url);
const pkg = require('essentia.js');
const essentia = new pkg.Essentia(pkg.EssentiaWASM);
const FS = 44100; // RhythmExtractor2013 expects 44.1 kHz input.
const DURATION = 18;
const BPMS = [55, 67, 80, 93, 110, 120, 137, 160, 180, 200];

function makeClickTrack(bpm) {
  // WHY: realistic, deterministic transient shapes are a better stress test than
  // isolated sine tones: kick pitch sweeps, snare noise, and short noisy hi-hats.
  // This remains synthetic test data, not evidence of accuracy on commercial songs.
  const samples = new Float32Array(FS * DURATION);
  const beatPeriod = 60 * FS / bpm;
  const phase = 0.137;
  let seed = 0x12345678;
  function rand() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  }
  function addHit(time, kind, amplitude) {
    const start = Math.round(time * FS);
    if (start < 0 || start >= samples.length) return;
    const seconds = kind === 'kick' ? 0.16 : kind === 'snare' ? 0.105 : 0.035;
    const length = Math.min(Math.round(FS * seconds), samples.length - start);
    let phaseAcc = 0;
    for (let i = 0; i < length; i++) {
      const t = i / FS;
      let value;
      if (kind === 'kick') {
        const frequency = 42 + 105 * Math.exp(-t * 28);
        phaseAcc += 2 * Math.PI * frequency / FS;
        value = Math.sin(phaseAcc) * Math.exp(-t * 17) * 0.82;
        if (i < FS * 0.006) value += rand() * Math.exp(-t * 850) * 0.22;
      } else if (kind === 'snare') {
        value = (rand() * 0.68 + Math.sin(2 * Math.PI * 190 * t) * 0.32) * Math.exp(-t * 24);
      } else {
        value = rand() * Math.exp(-t * 105) * 0.28;
      }
      samples[start + i] += value * amplitude;
    }
  }
  for (let beat = 0, time = phase; time < DURATION; beat++, time = phase + beat * beatPeriod) {
    const barBeat = beat % 4;
    if (barBeat === 0 || barBeat === 2) addHit(time, 'kick', barBeat === 0 ? 1 : 0.78);
    if (barBeat === 1 || barBeat === 3) addHit(time, 'snare', 0.72);
    addHit(time, 'hat', 0.42);
    addHit(time + beatPeriod * 0.5, 'hat', 0.28);
  }
  // Quiet deterministic room/noise bed prevents unrealistic digital silence.
  for (let i = 0; i < samples.length; i++) samples[i] += rand() * 0.00012;
  return samples;
}

function runCurrentEngine(samples, expectedBpm) {
  const opts = { fs: FS, minBpm: 40, maxBpm: 240, candidates: 5 };
  return [
    ['@audio/beat:detect', detect],
    ['@audio/beat:beatTrack', beatTrack],
    ['@audio/beat:tempo', tempo],
    ['@audio/beat:combTempo', combTempo]
  ].map(([algorithm, fn]) => {
    const started = performance.now();
    try {
      const result = fn(samples, opts);
      const bpm = Number(result?.bpm);
      const valid = Number.isFinite(bpm);
      const variants = [expectedBpm / 2, expectedBpm, expectedBpm * 2].filter(v => v >= 40 && v <= 240);
      const octaveAwareError = valid ? Math.min(...variants.map(v => Math.abs(bpm - v))) : null;
      return {
        algorithm, bpm: valid ? Number(bpm.toFixed(2)) : null,
        absError: valid ? Number(Math.abs(bpm - expectedBpm).toFixed(2)) : null,
        octaveAwareError: valid ? Number(octaveAwareError.toFixed(2)) : null,
        within2Bpm: valid && Math.abs(bpm - expectedBpm) <= 2,
        octaveError: valid && Math.abs(bpm - expectedBpm) > 2 && octaveAwareError <= 2,
        elapsedMs: Number((performance.now() - started).toFixed(1)),
        error: null
      };
    } catch (error) {
      return { algorithm, bpm: null, absError: null, octaveAwareError: null, within2Bpm: false, octaveError: false, elapsedMs: null, error: String(error?.message || error) };
    }
  });
}

function release(value) {
  try { value?.delete?.(); } catch {}
}

const rows = [];
for (const expectedBpm of BPMS) {
  const samples = makeClickTrack(expectedBpm);
  const currentEngineRows = runCurrentEngine(samples, expectedBpm).map(row => ({ ...row, expectedBpm }));
  let input = null;
  let result = null;
  const started = performance.now();
  try {
    input = essentia.arrayToVector(samples);
    result = essentia.RhythmExtractor2013(input, 208, 'multifeature', 40);
    const bpm = Number(result?.bpm);
    rows.push({
      engine: 'Essentia.js',
      expectedBpm,
      bpm: Number.isFinite(bpm) ? Number(bpm.toFixed(2)) : null,
      absError: Number.isFinite(bpm) ? Number(Math.abs(bpm - expectedBpm).toFixed(2)) : null,
      octaveAwareError: Number.isFinite(bpm) ? Number(Math.min(...[expectedBpm / 2, expectedBpm, expectedBpm * 2].filter(v => v >= 40 && v <= 240).map(v => Math.abs(bpm - v))).toFixed(2)) : null,
      within2Bpm: Number.isFinite(bpm) && Math.abs(bpm - expectedBpm) <= 2,
      octaveError: Number.isFinite(bpm) && Math.abs(bpm - expectedBpm) > 2 && Math.min(...[expectedBpm / 2, expectedBpm, expectedBpm * 2].filter(v => v >= 40 && v <= 240).map(v => Math.abs(bpm - v))) <= 2,
      confidence: Number.isFinite(Number(result?.confidence)) ? Number(result.confidence) : null,
      beatCount: result?.ticks ? essentia.vectorToArray(result.ticks).length : null,
      elapsedMs: Number((performance.now() - started).toFixed(1)),
      error: null
    });
  } catch (error) {
    rows.push({
      engine: 'Essentia.js',
      expectedBpm, bpm: null, absError: null, octaveAwareError: null, within2Bpm: false, octaveError: false,
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
  rows.push(...currentEngineRows.map(row => ({ engine: 'Current @audio/beat', ...row })));
}

const valid = rows.filter(row => Number.isFinite(row.absError));
const errors = valid.map(row => row.absError).sort((a, b) => a - b);
const summary = {
  engines: Object.fromEntries([...new Set(rows.map(row => row.engine))].map(engine => {
    const engineRows = rows.filter(row => row.engine === engine);
    const engineValid = engineRows.filter(row => Number.isFinite(row.absError));
    const engineErrors = engineValid.map(row => row.absError).sort((a, b) => a - b);
    const engineOctaveErrors = engineValid.map(row => row.octaveAwareError).sort((a, b) => a - b);
    const times = engineValid.map(row => row.elapsedMs).filter(Number.isFinite).sort((a, b) => a - b);
    return [engine, {
      successfulCases: engineValid.length, totalCases: engineRows.length,
      within2Bpm: engineValid.filter(row => row.within2Bpm).length,
      octaveErrors: engineValid.filter(row => row.octaveError).length,
      medianAbsoluteErrorBpm: engineErrors.length ? engineErrors[Math.floor(engineErrors.length / 2)] : null,
      medianOctaveAwareErrorBpm: engineOctaveErrors.length ? engineOctaveErrors[Math.floor(engineOctaveErrors.length / 2)] : null,
      medianRuntimeMs: times.length ? times[Math.floor(times.length / 2)] : null
    }];
  }))
};
console.log(JSON.stringify({
  benchmark: 'BandPlan paired synthetic groove BPM benchmark',
  sampleRate: FS,
  durationSeconds: DURATION,
  license: 'AGPL-3.0; development benchmark only, not bundled into production.',
  note: 'Both engines receive the same generated kick/snare/hi-hat patterns. Synthetic results are diagnostic only and do not establish accuracy on real songs.',
  summary,
  cases: rows
}, null, 2));

if (valid.length === 0) {
  throw new Error('Essentia.js benchmark produced no valid BPM results.');
}
