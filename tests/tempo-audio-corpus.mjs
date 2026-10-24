/**
 * Batch-run the WAV tempo analyzer against a local reference corpus.
 *
 * WHY: a single song is not enough to select an algorithm. This runner scores
 * every algorithm over a collection of locally stored WAVs with known BPMs.
 * Audio files and the manifest remain local; only the JSON report is printed.
 *
 * Usage:
 *   node tests/tempo-audio-corpus.mjs ./tempo-corpus.json
 * Manifest format:
 *   { "cases": [{ "file": "./audio/song-a.wav", "expectedBpm": 120 }] }
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const manifestPathArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!manifestPathArg) {
  console.error('Usage: node tests/tempo-audio-corpus.mjs <manifest.json>');
  process.exit(2);
}
const manifestPath = path.resolve(manifestPathArg);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
  throw new Error('Manifest must contain a non-empty "cases" array.');
}
const analyzer = fileURLToPath(new URL('./tempo-audio-file.mjs', import.meta.url));
const caseResults = [];
for (const [index, item] of manifest.cases.entries()) {
  if (!item || typeof item.file !== 'string' || !item.file.trim()) {
    throw new Error(`Case ${index + 1}: "file" must be a non-empty path.`);
  }
  if (!Number.isFinite(Number(item.expectedBpm)) || Number(item.expectedBpm) < 30 || Number(item.expectedBpm) > 300) {
    throw new Error(`Case ${index + 1}: expectedBpm must be between 30 and 300.`);
  }
  const audioPath = path.resolve(path.dirname(manifestPath), item.file);
  const run = spawnSync(process.execPath, [analyzer, audioPath, `--expected=${Number(item.expectedBpm)}`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (run.error || run.status !== 0) {
    caseResults.push({
      file: path.basename(audioPath),
      expectedBpm: Number(item.expectedBpm),
      error: run.error?.message || run.stderr?.trim() || `Analyzer exited with code ${run.status}`
    });
    continue;
  }
  try {
    caseResults.push(JSON.parse(run.stdout));
  } catch {
    caseResults.push({ file: path.basename(audioPath), expectedBpm: Number(item.expectedBpm), error: 'Analyzer returned invalid JSON.' });
  }
}

const metrics = new Map();
for (const testCase of caseResults) {
  for (const result of testCase.results || []) {
    if (!result.algorithm || !Number.isFinite(result.bpm)) continue;
    const key = `${result.engine} / ${result.algorithm}`;
    if (!metrics.has(key)) metrics.set(key, { algorithm: key, samples: 0, scored: 0, failures: 0, within2Bpm: 0, within5Bpm: 0, octaveAwareWithin2Bpm: 0, absoluteErrors: [], octaveAwareErrors: [], runtimes: [] });
    const metric = metrics.get(key);
    metric.samples++;
    metric.runtimes.push(result.elapsedMs);
    if (result.error || !Number.isFinite(result.bpm)) { metric.failures++; continue; }
    if (Number.isFinite(result.absoluteErrorBpm)) {
      metric.scored++;
      metric.absoluteErrors.push(result.absoluteErrorBpm);
      metric.octaveAwareErrors.push(result.octaveAwareErrorBpm);
      if (result.absoluteErrorBpm <= 2) metric.within2Bpm++;
      if (result.absoluteErrorBpm <= 5) metric.within5Bpm++;
      if (result.octaveAwareErrorBpm <= 2) metric.octaveAwareWithin2Bpm++;
    }
  }
}
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Number((sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
};
const summary = [...metrics.values()].map(m => ({
  algorithm: m.algorithm,
  filesAnalyzed: m.samples,
  failures: m.failures,
  scoredFiles: m.scored,
  within2Bpm: m.scored ? Number((m.within2Bpm / m.scored * 100).toFixed(1)) : null,
  within5Bpm: m.scored ? Number((m.within5Bpm / m.scored * 100).toFixed(1)) : null,
  octaveAwareWithin2Bpm: m.scored ? Number((m.octaveAwareWithin2Bpm / m.scored * 100).toFixed(1)) : null,
  medianAbsoluteErrorBpm: median(m.absoluteErrors),
  medianOctaveAwareErrorBpm: median(m.octaveAwareErrors),
  medianRuntimeMs: median(m.runtimes)
}));
console.log(JSON.stringify({
  manifest: path.basename(manifestPath),
  totalFiles: manifest.cases.length,
  successfulFiles: caseResults.filter(item => Array.isArray(item.results)).length,
  failedFiles: caseResults.filter(item => item.error).length,
  summary,
  cases: caseResults,
  caveats: [
    'Use a representative set of songs with independently verified BPM values; results are only as reliable as those references.',
    'Keep the corpus local. This tool does not upload audio or include audio files in its output.',
    'Octave-aware metrics allow half-time/double-time matches and should not replace the strict BPM score.'
  ]
}, null, 2));
if (caseResults.some(item => item.error)) process.exitCode = 1;
