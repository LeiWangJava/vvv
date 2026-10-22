import { staticFile } from "remotion";
import { beatsPathFor } from "./beats";

/** Measured beats in film seconds (already shifted by the music's trimBeforeSec). */
export type BeatGrid = { beats: number[] };

/**
 * Beat n of the film from a measured grid: the first beat after a short lead-in is beat 0. Fractional
 * n interpolates; past the last measured beat the average period continues. Without a
 * grid (silent drafts) a steady `fallbackBpm` from 0.5 s is used.
 */
export function beatClock(grid: BeatGrid | null | undefined, fallbackBpm = 100, leadIn = 0.35): (n: number) => number {
  const beats = grid?.beats ?? [];
  const first = beats.findIndex((b) => b >= leadIn);
  if (beats.length < 8 || first < 0) return (n) => 0.5 + (n * 60) / fallbackBpm;
  const period = (beats[beats.length - 1] - beats[first]) / Math.max(1, beats.length - 1 - first);
  const at = (i: number) => (i < beats.length ? beats[i] : beats[beats.length - 1] + (i - beats.length + 1) * period);
  return (n) => {
    const i = first + Math.floor(n);
    const frac = n - Math.floor(n);
    return frac === 0 ? at(i) : at(i) + frac * (at(i + 1) - at(i));
  };
}

/** Read a track's beat map from public/ before rendering; null when the track has none. */
export async function loadBeatGrid(music: { src: string; trimBeforeSec: number }): Promise<BeatGrid | null> {
  if (!music.src) return null;
  const response = await fetch(staticFile(beatsPathFor(music.src)));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cannot read beat map for ${music.src} (${response.status})`);
  const map = (await response.json()) as { beats: number[] };
  return { beats: map.beats.map((b) => b - music.trimBeforeSec).filter((b) => b >= 0) };
}
