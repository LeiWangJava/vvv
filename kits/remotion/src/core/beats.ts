import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/** Output of scripts/analyze-music.mjs (times in seconds from the start of the audio file). */
export interface BeatMap {
  source: string;
  duration: number;
  bpm: number;
  meter: number;
  beats: number[];
  downbeats: number[];
  energy: number[];
  accents: { t: number; strength: number }[];
  phrases: { t: number; change: number }[];
}

/** "music/foo.mp3" → "music/foo.beats.json" */
export const beatsPathFor = (musicSrc: string) => (musicSrc ? musicSrc.replace(/\.[^.]+$/, "") + ".beats.json" : "");

/** Load a beat map from public/. Returns null when there is none (the film then runs unwarped). */
export function useBeatMap(src: string): BeatMap | null {
  const [data, setData] = useState<BeatMap | null>(null);
  const [handle] = useState(() => (src ? delayRender(`加载节拍 ${src}`) : null));
  useEffect(() => {
    if (handle === null) return;
    fetch(staticFile(src))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => continueRender(handle));
  }, [src, handle]);
  return data;
}

/**
 * Where a design-time moment should land in the music:
 *   cut  — a scene change: the nearest strong beat (1 or 3 of the bar) if one is near, else the nearest beat
 *   beat — an entrance or move: the nearest beat
 *   half — a small accent: the nearest half beat
 */
export type AnchorKind = "cut" | "beat" | "half";
export interface Anchor {
  t: number;
  kind: AnchorKind;
}

export interface Warp {
  /** music seconds (from the start of the film) → design seconds */
  toDesign: (tau: number) => number;
  /** design seconds → music seconds */
  toMusic: (t: number) => number;
  /** [design, music] knots actually used, for debugging */
  knots: [number, number][];
}

const identity: Warp = { toDesign: (x) => x, toMusic: (x) => x, knots: [] };

const interp = (knots: [number, number][], x: number, from: 0 | 1) => {
  const to = from === 0 ? 1 : 0;
  if (knots.length < 2) return x;
  let i = 1;
  while (i < knots.length - 1 && knots[i][from] < x) i++;
  const [a, b] = [knots[i - 1], knots[i]];
  const span = b[from] - a[from] || 1;
  return a[to] + ((x - a[from]) / span) * (b[to] - a[to]);
};

/**
 * Piecewise-linear time warp so that each anchor lands on the music grid. Choreography keeps its
 * authored seconds between anchors; tempo changes of more than ±25% locally are refused
 * (that anchor is skipped) so motion never visibly speeds up or crawls.
 */
export function makeWarp(
  anchors: Anchor[],
  opts: { beats: BeatMap | null; designSeconds: number; musicSeconds: number; musicOffset?: number },
): Warp {
  const { beats, designSeconds, musicSeconds, musicOffset = 0 } = opts;
  if (!beats || beats.beats.length < 4) return identity;
  const scale = musicSeconds / designSeconds;
  const inRange = (b: number) => b > 0 && b < musicSeconds;
  const grid = beats.beats.map((b) => b - musicOffset).filter(inRange);
  // strong beats: every other beat counted from the bar lines (1 and 3 in 4/4)
  const first = beats.beats.indexOf(beats.downbeats[0] ?? beats.beats[0]);
  const strong = beats.beats
    .filter((_, i) => i >= first && (i - first) % 2 === 0)
    .map((b) => b - musicOffset)
    .filter(inRange);
  const period = 60 / beats.bpm;
  const halves = grid.flatMap((b, i) => (i < grid.length - 1 ? [b, (b + grid[i + 1]) / 2] : [b]));
  const nearest = (list: number[], x: number) =>
    list.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), Number.POSITIVE_INFINITY);

  const knots: [number, number][] = [[0, 0]];
  for (const a of [...anchors].sort((p, q) => p.t - q.t)) {
    const [lt, lm] = knots[knots.length - 1];
    // snap from the anchor's own place in the music, so shifts never accumulate
    const guess = a.t * scale;
    const pool = a.kind === "half" ? halves : grid;
    const byDistance = [...pool].sort((p, q) => Math.abs(p - guess) - Math.abs(q - guess)).slice(0, 2);
    const candidates: number[] = [];
    if (a.kind === "cut") {
      const s = nearest(strong, guess);
      if (Math.abs(s - guess) <= 0.75 * period) candidates.push(s);
    }
    candidates.push(...byDistance);
    // first candidate that keeps the local speed change within ±30%
    const fits = (target: number) => {
      const slope = (target - lm) / Math.max(1e-6, a.t - lt) / scale;
      return Number.isFinite(target) && a.t - lt >= 0.08 && target - lm >= 0.08 && slope >= 0.75 && slope <= 1.33;
    };
    const target = candidates.find(fits);
    if (target === undefined) continue;
    knots.push([a.t, target]);
  }
  knots.push([designSeconds, musicSeconds]);
  return {
    toDesign: (tau) => interp(knots, tau, 1),
    toMusic: (t) => interp(knots, t, 0),
    knots,
  };
}

/** A measured visual hit (scripts/calibrate.mjs → hits.json), in design seconds. */
export interface Hit {
  t: number;
  s: number;
  kind: AnchorKind;
}
export const anchorsFromHits = (hits: Hit[]): Anchor[] => hits.map((h) => ({ t: h.t, kind: h.kind }));

/**
 * Measured hits decide where the big moments are; hand-set "beat" anchors keep the gentler
 * authored moments (entrances, blooms) on the grid, unless a measured hit is already nearby.
 */
export function mergeAnchors(hits: Hit[], manual: Anchor[], minGap = 0.3): Anchor[] {
  if (!hits.length) return manual;
  const measured = anchorsFromHits(hits);
  const extra = manual.filter((a) => a.kind === "beat" && measured.every((m) => Math.abs(m.t - a.t) > minGap));
  return [...measured, ...extra].sort((a, b) => a.t - b.t);
}

/**
 * One beat map for a soundtrack of several tracks played one after another in the film: each part's
 * beats are shifted to film time (`at` = where the file's second 0 lands) and kept only inside
 * [from, to). Times in the result are film seconds, so makeWarp is used with musicOffset 0.
 */
export function chainBeatMaps(parts: { map: BeatMap | null; at: number; from: number; to: number }[]): BeatMap | null {
  const ok = parts.filter((p) => p.map);
  if (ok.length === 0) return null;
  const pick = (key: "beats" | "downbeats") => ok.flatMap((p) => p.map![key].map((b) => b + p.at).filter((b) => b >= p.from && b < p.to));
  const beats = pick("beats");
  const energy = ok.flatMap((p) => p.map!.beats.map((b, i) => [b + p.at, p.map!.energy[i] ?? 0] as const).filter(([b]) => b >= p.from && b < p.to).map(([, e]) => e));
  const spans = ok.map((p) => p.to - p.from);
  const bpm = ok.reduce((s, p, i) => s + p.map!.bpm * spans[i], 0) / spans.reduce((a, b) => a + b, 0);
  return {
    source: ok.map((p) => p.map!.source).join(" + "),
    duration: Math.max(...ok.map((p) => p.to)),
    bpm,
    meter: ok[0].map!.meter,
    beats,
    downbeats: pick("downbeats"),
    energy,
    accents: ok.flatMap((p) => p.map!.accents.map((a) => ({ ...a, t: a.t + p.at })).filter((a) => a.t >= p.from && a.t < p.to)),
    phrases: ok.flatMap((p) => p.map!.phrases.map((a) => ({ ...a, t: a.t + p.at })).filter((a) => a.t >= p.from && a.t < p.to)),
  };
}
