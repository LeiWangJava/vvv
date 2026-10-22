import type { CSSProperties } from "react";
import { Easing } from "remotion";
import { useT } from "./time";

/**
 * Timing is written in seconds, not frames, so the same template renders at 30 or 60 fps.
 * All times are local to the enclosing <Sequence> / TransitionSeries scene.
 */

export const EASE = {
  /** entrances: fast start, long soft landing */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** moves and transitions */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** slow drifts such as Ken Burns */
  soft: Easing.bezier(0.33, 0, 0.2, 1),
  /** exits */
  in: Easing.bezier(0.7, 0, 0.84, 0),
  /** small overshoot */
  back: Easing.bezier(0.34, 1.4, 0.64, 1),
  linear: (x: number) => x,
};
export type EaseFn = (x: number) => number;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Seconds elapsed in the current scene (film design time inside <Film>). */
export const useSeconds = useT;

/** Eased 0→1 progress over [start, start + dur] seconds. */
export const progress = (t: number, start: number, dur: number, ease: EaseFn = EASE.out) =>
  ease(clamp01((t - start) / dur));

export function useProgress(start: number, dur: number, ease: EaseFn = EASE.out): number {
  return progress(useSeconds(), start, dur, ease);
}

/** Enter at `start`, leave at `end` (both seconds): 0 → 1 → 0. */
export const inOut = (t: number, start: number, end: number, fadeIn = 0.6, fadeOut = 0.5) =>
  progress(t, start, fadeIn) * (1 - progress(t, end - fadeOut, fadeOut, EASE.in));

export const fadeRise = (p: number, dist = 18): CSSProperties => ({
  opacity: p,
  transform: `translateY(${(1 - p) * dist}px)`,
});

export const fadeBlur = (p: number, blur = 10): CSSProperties => ({
  opacity: p,
  filter: p < 1 ? `blur(${(1 - p) * blur}px)` : undefined,
});

/** Music beat grid: time (s) of beat n, for cutting on the beat. */
export interface BeatGrid {
  bpm: number;
  /** time of beat 0 in seconds */
  offset: number;
}
export const beatAt = (g: BeatGrid, n: number) => g.offset + (n * 60) / g.bpm;
