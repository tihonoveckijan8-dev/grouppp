/**
 * Runtime smoke test for the real-WAV tempo analyzer.
 * WHY: syntax checks alone do not catch WAV parsing, decoding, or estimator runtime errors.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sampleRate = 22050;
const seconds = 10;
const bpm = 120;
const pcm = Buffer.alloc(sampleRate * seconds * 2);
for (let beat = 0; beat < seconds * bpm / 60; beat++) {
  const start = Math.round(beat * 60 / bpm * sampleRate);
  for (let i = 0; i < Math.round(sampleRate * 0.035) && start + i < sampleRate * seconds; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 95) * 0.8;
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value * 32767))), (start + i) * 2);
  }
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bandplan-tempo-'));
const wavPath = path.join(dir, 'smoke.wav');
try {
  fs.writeFileSync(wavPath, Buffer.concat([header, pcm]));
  const stdout = execFileSync(process.execPath, ['tests/tempo-audio-file.mjs', wavPath, '--expected=120'], { encoding: 'utf8', timeout: 120000 });
  const report = JSON.parse(stdout);
  if (report.expectedBpm !== 120 || report.results.length !== 5) {
    throw new Error('Unexpected analysis report shape.');
  }
  if (report.results.some(row => !row.algorithm || !row.engine)) {
    throw new Error('One or more BPM engine results are missing metadata.');
  }
  console.log(JSON.stringify({
    test: 'real-WAV analyzer runtime smoke test',
    inputDurationSeconds: report.input.durationSeconds,
    resultCount: report.results.length,
    engines: [...new Set(report.results.map(row => row.engine))],
    passed: true
  }, null, 2));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
