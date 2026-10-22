import type { Clock } from "./clock";

/** What every scene gets: the video clock and where it is inside its own scene. */
export interface SceneCtx {
  /** video seconds and frame */
  t: number;
  f: number;
  fps: number;
  clock: Clock;
  /** beats since the scene's first beat (fractional) */
  lb: number;
  /** scene length in beats */
  beats: number;
  /** seconds since the scene started */
  ls: number;
  /** unused: photos are project asset IDs (kept for scene signatures) */
  dir: string;
  /** bunny & bear stickers on the PLAY cards, pages, strip and ending; off = words only */
  stickers: boolean;
  /** Type only narrative copy; photo-page headings keep their existing entrances. */
  typewriterCards: boolean;
  /** the opening title, drawn in type */
  title: { cn: string; en: string };
}

/** Seconds since local beat `b` of the scene started (negative before it). */
export const sinceBeat = (ctx: SceneCtx, b: number) => ctx.t - ctx.clock.at(ctx.clock.beatOf(ctx.t) - ctx.lb + b);
