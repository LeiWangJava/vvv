// Beat analysis for 卡点 (cutting on the beat).
//
//   node scripts/analyze-music.mjs <audio-or-video> [out.json] [--meter=4] [--bpm-min=60] [--bpm-max=180]
//
// Writes <audio>.beats.json next to the input (or to out.json): tempo, every beat, bar starts
// (downbeats), strong accents, per-beat loudness and phrase boundaries. Templates read this to
// put cuts, entrances and flashes on the music instead of on guessed seconds.
//
// Method (same family as librosa): log band-energy spectral flux → onset envelope; tempo from the
// envelope's autocorrelation with a prior around 110 BPM; beats by dynamic programming (Ellis 2007);
// downbeat phase = the beat position in the bar with the strongest low-frequency attacks.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [input, outArg] = args.filter((a) => !a.startsWith("--"));
if (!input) {
  console.error("用法：node scripts/analyze-music.mjs <音频或视频> [输出.json] [--meter=4]");
  process.exit(1);
}
const METER = Number(opt.meter ?? 4);
const BPM_MIN = Number(opt["bpm-min"] ?? 60);
const BPM_MAX = Number(opt["bpm-max"] ?? 180);
const SR = 22050;
const N_FFT = 1024;
const HOP = 128;
// flux peaks while the attack is still in the window's leading half, so frame centers read early;
// measured on synthetic click tracks and removed here
const BIAS = Number(opt.bias ?? 0.016);
const FPS = SR / HOP; // envelope frames per second

// ---------------------------------------------------------------- decode (Remotion's bundled ffmpeg)
// (Remotion's minimal ffmpeg has no raw-PCM muxer, so decode to 16-bit WAV and skip to the data chunk.)
const dec = spawnSync(
  "npx",
  ["remotion", "ffmpeg", "-v", "error", "-i", input, "-vn", "-ac", "1", "-ar", String(SR), "-acodec", "pcm_s16le", "-f", "wav", "-"],
  { maxBuffer: 1 << 30 },
);
if (dec.status !== 0) {
  console.error(dec.stderr.toString());
  process.exit(1);
}
const wav = dec.stdout;
let dataAt = 12;
while (dataAt + 8 <= wav.length && wav.toString("ascii", dataAt, dataAt + 4) !== "data") {
  const size = wav.readUInt32LE(dataAt + 4);
  dataAt += 8 + size + (size % 2);
}
const pcm = wav.subarray(dataAt + 8);
const x = new Float32Array(Math.floor(pcm.length / 2));
for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
const duration = x.length / SR;

// ---------------------------------------------------------------- STFT → log band energies
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

const NB = 48; // log-spaced bands 30 Hz – 11 kHz
const edges = Array.from({ length: NB + 1 }, (_, i) => Math.round((30 * Math.pow(11000 / 30, i / NB) * N_FFT) / SR));
const LOW_BANDS = edges.findIndex((e) => (e * SR) / N_FFT > 180); // kick / bass region
const win = Float64Array.from({ length: N_FFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT));
const nFrames = Math.max(0, Math.floor((x.length - N_FFT) / HOP) + 1);
const bands = [];
const rms = new Float64Array(nFrames);
const re = new Float64Array(N_FFT);
const im = new Float64Array(N_FFT);
for (let f = 0; f < nFrames; f++) {
  let e = 0;
  for (let i = 0; i < N_FFT; i++) {
    const v = x[f * HOP + i];
    re[i] = v * win[i];
    im[i] = 0;
    e += v * v;
  }
  rms[f] = Math.sqrt(e / N_FFT);
  fft(re, im);
  const b = new Float64Array(NB);
  for (let k = 0; k < NB; k++) {
    let s = 0;
    for (let j = edges[k]; j < Math.max(edges[k] + 1, edges[k + 1]); j++) s += re[j] * re[j] + im[j] * im[j];
    b[k] = Math.log1p(1000 * s);
  }
  bands.push(b);
}

// ---------------------------------------------------------------- onset envelope (spectral flux)
const flux = new Float64Array(nFrames);
const lowFlux = new Float64Array(nFrames);
for (let f = 1; f < nFrames; f++) {
  let s = 0;
  let lo = 0;
  for (let k = 0; k < NB; k++) {
    const d = Math.max(0, bands[f][k] - bands[f - 1][k]);
    s += d;
    if (k < LOW_BANDS) lo += d;
  }
  flux[f] = s;
  lowFlux[f] = lo;
}
const detrend = (a, halfWin) => {
  const out = new Float64Array(a.length);
  let acc = 0;
  const q = [];
  for (let i = 0; i < a.length + halfWin; i++) {
    if (i < a.length) {
      acc += a[i];
      q.push(a[i]);
    }
    if (q.length > 2 * halfWin + 1) acc -= q.shift();
    const c = i - halfWin;
    if (c >= 0) out[c] = Math.max(0, a[c] - acc / q.length);
  }
  const sd = Math.sqrt(out.reduce((s, v) => s + v * v, 0) / out.length) || 1;
  return out.map((v) => v / sd);
};
const onset = detrend(flux, Math.round(FPS * 0.5));
const lowOnset = detrend(lowFlux, Math.round(FPS * 0.5));

// ---------------------------------------------------------------- tempo
const lagMax = Math.ceil((60 / BPM_MIN) * FPS);
const ac = new Float64Array(lagMax * 2 + 2);
for (let lag = 1; lag < ac.length; lag++) {
  let s = 0;
  for (let i = lag; i < onset.length; i++) s += onset[i] * onset[i - lag];
  ac[lag] = s / (onset.length - lag);
}
const acAt = (lag) => {
  const i = Math.floor(lag);
  const fr = lag - i;
  return ac[i] * (1 - fr) + ac[Math.min(ac.length - 1, i + 1)] * fr;
};
let best = { score: -Infinity, bpm: 120 };
for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm += 0.1) {
  const lag = (60 / bpm) * FPS;
  const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 110) / 0.9, 2));
  const score = (acAt(lag) + 0.5 * acAt(2 * lag) + 0.25 * acAt(lag / 2)) * prior;
  if (score > best.score) best = { score, bpm };
}

// ---------------------------------------------------------------- beats (dynamic programming)
function trackBeats(periodFrames) {
  const TIGHT = 100;
  const score = new Float64Array(nFrames);
  const back = new Int32Array(nFrames).fill(-1);
  for (let t = 0; t < nFrames; t++) {
    let bestPrev = 0;
    let arg = -1;
    for (let tau = Math.max(0, Math.round(t - 2 * periodFrames)); tau <= t - Math.round(periodFrames / 2); tau++) {
      const v = score[tau] - TIGHT * Math.pow(Math.log((t - tau) / periodFrames), 2);
      if (v > bestPrev || arg < 0) {
        bestPrev = v;
        arg = tau;
      }
    }
    score[t] = onset[t] + (arg >= 0 ? Math.max(0, bestPrev) : 0);
    back[t] = arg >= 0 && bestPrev > 0 ? arg : -1;
  }
  const tail = Math.max(0, nFrames - Math.round(2 * periodFrames));
  let end = tail;
  for (let t = tail; t < nFrames; t++) if (score[t] > score[end]) end = t;
  const frames = [];
  for (let t = end; t >= 0; t = back[t]) frames.unshift(t);
  return frames;
}
const localMax = (env, f, r = 4) => {
  let m = 0;
  for (let i = Math.max(0, f - r); i <= Math.min(env.length - 1, f + r); i++) m = Math.max(m, env[i]);
  return m;
};
// spectral-envelope change across a beat (chords and bass notes tend to change on bar lines)
const harmonicChange = (f, span) => {
  const avg = (a, z) => {
    const m = new Float64Array(NB);
    let n = 0;
    for (let i = Math.max(0, a); i < Math.min(nFrames, z); i++, n++) for (let k = 0; k < NB; k++) m[k] += bands[i][k];
    return n ? m.map((v) => v / n) : m;
  };
  const before = avg(f - span, f - 2);
  const after = avg(f + 2, f + span);
  let d = 0;
  for (let k = 0; k < NB; k++) d += Math.abs(after[k] - before[k]);
  return d;
};

let bpm = best.bpm;
let beatFrames = trackBeats((60 / bpm) * FPS);
// octave check: if every other beat is clearly stronger, the real beat is half as fast
const strength = (f) => localMax(onset, f) + localMax(lowOnset, f);
const parity = [0, 1].map((p) => {
  const v = beatFrames.filter((_, i) => i % 2 === p).map(strength);
  return v.reduce((s, x) => s + x, 0) / (v.length || 1);
});
const halved = bpm / 2 >= BPM_MIN && Math.max(...parity) > 1.35 * Math.min(...parity);
if (halved) {
  const strong = parity[0] >= parity[1] ? 0 : 1;
  bpm /= 2;
  beatFrames = beatFrames.filter((_, i) => i % 2 === strong);
}
const period = (60 / bpm) * FPS;
const frameTime = (f) => Math.max(0, (f * HOP + N_FFT / 2) / SR + BIAS);
const beats = beatFrames.map(frameTime);

// ---------------------------------------------------------------- downbeats
const barSpan = Math.round(period);
const hc = beatFrames.map((f) => harmonicChange(f, barSpan));
const hcMean = hc.reduce((s, v) => s + v, 0) / (hc.length || 1) || 1;
const phaseScore = Array.from({ length: METER }, (_, p) => {
  let s = 0;
  let n = 0;
  for (let i = p; i < beatFrames.length; i += METER) {
    s += localMax(lowOnset, beatFrames[i]) + 0.5 * localMax(onset, beatFrames[i]) + hc[i] / hcMean;
    n++;
  }
  return n ? s / n : 0;
});
const phase = phaseScore.indexOf(Math.max(...phaseScore));
const downbeats = beats.filter((_, i) => i >= phase && (i - phase) % METER === 0);

// ---------------------------------------------------------------- per-beat loudness, accents, phrases
const beatEnergy = beatFrames.map((a, i) => {
  const z = beatFrames[i + 1] ?? a + Math.round(period);
  let s = 0;
  let n = 0;
  for (let f = Math.max(0, a); f < Math.min(nFrames, z); f++) {
    s += rms[f];
    n++;
  }
  return n ? s / n : 0;
});
const maxE = Math.max(...beatEnergy) || 1;
const energy = beatEnergy.map((e) => Math.round((e / maxE) * 1000) / 1000);

const accents = beatFrames
  .map((f, i) => ({ t: beats[i], strength: strength(f) / 2 }))
  .filter((a) => a.strength > 2.2)
  .map((a) => ({ t: round(a.t), strength: round(a.strength) }));

// phrase boundaries: bar starts where loudness changes most over 4 bars before/after
const barEnergy = downbeats.map((d) => {
  const i = beats.indexOf(d);
  const seg = energy.slice(i, i + METER);
  return seg.reduce((s, v) => s + v, 0) / (seg.length || 1);
});
const phrases = [];
for (let i = 2; i < barEnergy.length - 2; i++) {
  const before = (barEnergy[i - 1] + barEnergy[i - 2]) / 2;
  const after = (barEnergy[i] + barEnergy[i + 1]) / 2;
  phrases.push({ t: downbeats[i], change: after - before });
}
const phraseStarts = phrases
  .filter((p, i, a) => Math.abs(p.change) > 0.08 && a.every((q) => Math.abs(q.t - p.t) > (60 / bpm) * METER * 2 || Math.abs(q.change) <= Math.abs(p.change)))
  .map((p) => ({ t: round(p.t), change: round(p.change) }));

function round(v) {
  return Math.round(v * 1000) / 1000;
}

// ---------------------------------------------------------------- key, brightness (for choosing music by mood)
// chroma from a long-window STFT, matched against Krumhansl–Kessler key profiles
const KN = 8192;
const kwin = Float64Array.from({ length: KN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / KN));
const chroma = new Float64Array(12);
let centroidSum = 0;
let centroidW = 0;
for (let at = 0; at + KN < x.length; at += KN) {
  const kre = new Float64Array(KN);
  const kim = new Float64Array(KN);
  for (let i = 0; i < KN; i++) kre[i] = x[at + i] * kwin[i];
  fft(kre, kim);
  for (let k = 1; k < KN / 2; k++) {
    const f = (k * SR) / KN;
    const mag = Math.hypot(kre[k], kim[k]);
    centroidSum += f * mag;
    centroidW += mag;
    if (f < 55 || f > 2000) continue;
    const pc = ((Math.round(12 * Math.log2(f / 440)) % 12) + 12 + 9) % 12; // 0 = C
    chroma[pc] += mag * mag;
  }
}
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const corr = (a, b) => {
  const ma = a.reduce((s, v) => s + v, 0) / 12;
  const mb = b.reduce((s, v) => s + v, 0) / 12;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db || 1);
};
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
let bestKey = { r: -2, name: "", mode: "" };
for (let tonic = 0; tonic < 12; tonic++) {
  const rot = (p) => p.map((_, i) => p[(i - tonic + 12) % 12]);
  for (const [mode, prof] of [["major", MAJOR], ["minor", MINOR]]) {
    const r = corr([...chroma], rot(prof));
    if (r > bestKey.r) bestKey = { r, name: NAMES[tonic], mode };
  }
}
// loudness per 15 s, 0–9, to see the shape (build-up, drops, ending)
const SEG = 15;
const segs = [];
for (let a = 0; a < duration; a += SEG) {
  const i0 = Math.floor(a * SR);
  const i1 = Math.min(x.length, Math.floor((a + SEG) * SR));
  let e = 0;
  for (let i = i0; i < i1; i++) e += x[i] * x[i];
  segs.push(Math.sqrt(e / Math.max(1, i1 - i0)));
}
const segMax = Math.max(...segs) || 1;

const out = {
  source: path.basename(input),
  duration: round(duration),
  bpm: round(bpm),
  tempoFolded: halved,
  meter: METER,
  beats: beats.map(round),
  downbeats: downbeats.map(round),
  energy,
  accents,
  phrases: phraseStarts,
  key: `${bestKey.name} ${bestKey.mode}`,
  keyConfidence: round(bestKey.r),
  brightnessHz: Math.round(centroidSum / (centroidW || 1)),
  shape: segs.map((v) => Math.round((v / segMax) * 9)).join(""),
};
const outPath = outArg ?? input.replace(/\.[^.]+$/, "") + ".beats.json";
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(
  `[beats] ${out.source}: ${out.duration}s · ${out.bpm} BPM${halved ? "（由双倍速折半）" : ""} · ${out.beats.length} 拍 · ${out.downbeats.length} 小节` +
    ` · 第一个强拍 ${out.downbeats[0]}s · ${out.key}（${out.keyConfidence}）· 亮度 ${out.brightnessHz}Hz · 响度/15s ${out.shape} → ${outPath}`,
);
