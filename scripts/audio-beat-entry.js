// BandPlan vendors the MIT-licensed @audio/beat DSP engine into the offline PWA bundle.
// Upstream: https://github.com/audiojs/beat
import { detect, beatTrack, combTempo } from '@audio/beat';
window.BandPlanBeat = Object.freeze({ detect, beatTrack, combTempo });
