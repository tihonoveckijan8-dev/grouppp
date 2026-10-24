/**
 * Analyze a user-provided WAV file with BandPlan's current BPM algorithms and
 * an optional development-only Essentia.js cross-check.
 *
 * WHY: synthetic benchmarks reveal regressions but cannot prove accuracy on real music.
 * This runner lets developers compare algorithms against a real WAV and optionally
 * provide a known BPM. It does not upload or modify the audio file.
 *
 * Usage:
 *   node tests/tempo-audio-file.mjs ./song.wav
 *   node tests/tempo-audio-file.mjs ./song.wav --expected=120
 * Supported input: RIFF/WAVE PCM (8/16/24/32-bit) or IEEE float32, mono/stereo/multichannel.
 * Essentia RhythmExtractor2013 is run at 44.1 kHz as required by its documentation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { detect, beatTrack, tempo, combTempo } from '@audio/beat';

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('--'));
const expectedArg = args.find(arg => arg.startsWith('--expected='));
const expectedBpm = expectedArg ? Number(expectedArg.split('=')[1]) : null;
if (!file) {
  console.error('Usage: node tests/tempo-audio-file.mjs <audio.wav> [--expected=120]');
  process.exit(2);
}
if (expectedArg && (!Number.isFinite(expectedBpm) || expectedBpm < 30 || expectedBpm > 300)) {
  throw new Error('--expected must be a BPM value from 30 to 300.');
}

function parseWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Unsupported file: expected a RIFF/WAVE .wav file.');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = Math.min(start + size, buffer.length);
    if (id === 'fmt ' && size >= 16) {
      fmt = {
        format: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        blockAlign: buffer.readUInt16LE(start + 12),
        bits: buffer.readUInt16LE(start + 14)
      };
      if (fmt.format === 0xfffe && size >= 40) fmt.format = buffer.readUInt16LE(start + 24);
    } else if (id === 'data') {
      data = buffer.subarray(start, end);
    }
    offset = start + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV is missing its fmt or data chunk.');
  if (![1, 3].includes(fmt.format)) throw new Error('Only PCM and IEEE float WAV files are supported.');
  if (!fmt.channels || !fmt.sampleRate || !fmt.blockAlign) throw new Error('Invalid WAV format metadata.');
  if (fmt.format === 3 && fmt.bits !== 32) throw new Error('Only float32 WAV samples are supported.');
  if (fmt.format === 1 && ![8, 16, 24, 32].includes(fmt.bits)) throw new Error('PCM WAV must use 8, 16, 24, or 32 bits.');
  const bytesPerSample = fmt.bits / 8;
  const frames = Math.floor(data.length / fmt.blockAlign);
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let ch = 0; ch < fmt.channels; ch++) {
      const pos = frame * fmt.blockAlign + ch * bytesPerSample;
      let sample;
      if (fmt.format === 3) sample = data.readFloatLE(pos);
      else if (fmt.bits === 8) sample = (data.readUInt8(pos) - 128) / 128;
      else if (fmt.bits === 16) sample = data.readInt16LE(pos) / 32768;
      else if (fmt.bits === 24) {
        let value = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16);
        if (value & 0x800000) value |= 0xff000000;
        sample = value / 8388608;
      } else sample = data.readInt32LE(pos) / 2147483648;
      sum += Number.isFinite(sample) ? sample : 0;
    }
    mono[frame] = sum / fmt.channels;
  }
  return { samples: mono, sampleRate: fmt.sampleRate, channels: fmt.channels, frames, bits: fmt.bits, format: fmt.format };
}

function resampleLinear(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const outputLength = Math.max(1, Math.round(input.length * toRate / fromRate));
  const output = new Float32Array(outputLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const left = Math.min(input.length - 1, Math.floor(position));
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function errorsFor(bpm) {
  if (!Number.isFinite(bpm) || !Number.isFinite(expectedBpm)) return {};
  const variants = [expectedBpm / 2, expectedBpm, expectedBpm * 2].filter(v => v >= 30 && v <= 300);
  return {
    absoluteErrorBpm: Number(Math.abs(bpm - expectedBpm).toFixed(2)),
    octaveAwareErrorBpm: Number(Math.min(...variants.map(v => Math.abs(bpm - v))).toFixed(2))
  };
}

function release(value) { try { value?.delete?.(); } catch {} }

const absolutePath = path.resolve(file);
const wav = parseWav(fs.readFileSync(absolutePath));
if (wav.samples.length < wav.sampleRate * 5) {
  throw new Error('Audio is shorter than 5 seconds; provide a longer excerpt for tempo analysis.');
}
if (wav.samples.length > wav.sampleRate * 60 * 15) {
  throw new Error('Audio exceeds 15 minutes; trim the file to a shorter excerpt.');
}
const peak = wav.samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
if (peak < 0.00001) throw new Error('Audio is silent or too quiet to analyze.');
const normalized = Float32Array.from(wav.samples, sample => sample / peak);
const currentSamples = resampleLinear(normalized, wav.sampleRate, 22050);
const essentiaSamples = resampleLinear(normalized, wav.sampleRate, 44100);
const rows = [];
const opts = { fs: 22050, minBpm: 40, maxBpm: 240, candidates: 5 };
for (const [algorithm, fn] of [
  ['@audio/beat:detect', detect],
  ['@audio/beat:beatTrack', beatTrack],
  ['@audio/beat:tempo', tempo],
  ['@audio/beat:combTempo', combTempo]
]) {
  const started = performance.now();
  try {
    const result = fn(currentSamples, opts);
    const bpm = Number(result?.bpm);
    rows.push({
      engine: 'Current @audio/beat', algorithm,
      bpm: Number.isFinite(bpm) ? Number(bpm.toFixed(2)) : null,
      elapsedMs: Number((performance.now() - started).toFixed(1)),
      ...errorsFor(bpm), error: null
    });
  } catch (error) {
    rows.push({ engine: 'Current @audio/beat', algorithm, bpm: null, elapsedMs: Number((performance.now() - started).toFixed(1)), error: String(error?.message || error) });
  }
}

let essentia = null;
let input = null;
let result = null;
const essentiaStarted = performance.now();
try {
  const require = createRequire(import.meta.url);
  const pkg = require('essentia.js');
  essentia = new pkg.Essentia(pkg.EssentiaWASM);
  input = essentia.arrayToVector(essentiaSamples);
  result = essentia.RhythmExtractor2013(input, 208, 'multifeature', 40);
  const bpm = Number(result?.bpm);
  rows.push({
    engine: 'Essentia.js (development-only)',
    algorithm: 'RhythmExtractor2013',
    bpm: Number.isFinite(bpm) ? Number(bpm.toFixed(2)) : null,
    confidence: Number.isFinite(Number(result?.confidence)) ? Number(Number(result.confidence).toFixed(3)) : null,
    beatCount: result?.ticks ? essentia.vectorToArray(result.ticks).length : null,
    elapsedMs: Number((performance.now() - essentiaStarted).toFixed(1)),
    ...errorsFor(bpm), error: null
  });
} catch (error) {
  rows.push({ engine: 'Essentia.js (development-only)', algorithm: 'RhythmExtractor2013', bpm: null, elapsedMs: Number((performance.now() - essentiaStarted).toFixed(1)), error: String(error?.message || error) });
} finally {
  release(result?.ticks);
  release(result?.estimates);
  release(result?.bpmIntervals);
  release(input);
  release(essentia);
}
console.log(JSON.stringify({
  file: path.basename(absolutePath),
  input: {
    sampleRate: wav.sampleRate, channels: wav.channels, bitsPerSample: wav.bits,
    durationSeconds: Number((wav.frames / wav.sampleRate).toFixed(2)),
    normalizedForAnalysis: true,
    note: 'Audio stays local; no upload or file modification is performed.'
  },
  expectedBpm: Number.isFinite(expectedBpm) ? expectedBpm : null,
  results: rows,
  caveats: [
    'A WAV can be analyzed without an expected BPM, but accuracy cannot be scored without a reliable reference tempo.',
    'Half-time/double-time interpretations are musically ambiguous; octaveAwareErrorBpm is only a diagnostic.',
    'Essentia.js is a development-only AGPL-3.0 dependency and is not bundled into production.'
  ]
}, null, 2));
