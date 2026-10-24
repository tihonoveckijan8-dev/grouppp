# Evaluating BPM algorithms on real audio

BandPlan's local corpus runner compares the four production-side `@audio/beat` methods and the development-only Essentia.js method on the same WAV files.

## 1. Prepare a private corpus

Create a folder outside the repository (recommended) and put WAV files there. Prefer 15–60 second excerpts with a reliably verified tempo. Include a range of genres and arrangements: steady drums, acoustic guitar, sparse intros, syncopation, live recordings, and songs with ambiguous half-time/double-time interpretations.

Create a JSON manifest, for example:

```json
{
  "cases": [
    { "file": "./audio/track-a.wav", "expectedBpm": 120 },
    { "file": "./audio/track-b.wav", "expectedBpm": 93.5 }
  ]
}
```

The file paths are relative to the manifest. BPM references should come from trustworthy annotations or careful independent verification—not from the estimator being evaluated.

## 2. Run the comparison

From the repository root:

```bash
npm install
npm run test:tempo:corpus -- /absolute/path/to/tempo-corpus.json
```

The report is JSON on stdout. It includes per-track estimates and per-algorithm aggregate metrics:
- strict percentage within 2 BPM and 5 BPM;
- octave-aware percentage within 2 BPM (half/double tempo counted as a possible match);
- median absolute BPM error and octave-aware error;
- median runtime and failure counts.

To inspect one file in detail:

```bash
npm run test:tempo:file -- /path/to/track.wav --expected=120
```

## 3. Interpret the report correctly

- Use strict BPM error as the main metric when the reference defines the intended beat level.
- Treat octave-aware scores as a separate diagnostic; they must not hide half-time/double-time errors.
- Compare results by genre and recording type, not only by one overall average.
- Do not select a winner from a tiny corpus. Aim for at least 30–50 diverse excerpts before changing production behavior.
- The generated WAV smoke test verifies the runner and output shape only; it does not demonstrate accuracy on music.

## Privacy and dataset rights

The analyzer reads files locally and does not upload or commit audio. Do not put copyrighted audio in Git or CI. Public MIR datasets can have non-commercial or unclear audio terms even when their annotations are public; review the exact license and intended use before acquiring or redistributing any audio. For product regression tests, prefer recordings you own, public-domain audio, or files whose license explicitly permits your intended use.

Essentia.js is currently development-only and AGPL-3.0. Do not bundle it into the shipped application without a separate licensing review.
