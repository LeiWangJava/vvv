import { makeClock, type BeatGrid } from "./clock.ts";
import { buildStory } from "./story.ts";

export interface StoryTimingProps {
  copy: Record<string, string>;
  photos: Record<string, string>;
  proposalFirst?: boolean;
  endingBeats: number;
  fps: number;
  music: { trimBeforeSec: number };
}

/** Rebase the measured song grid into the actual trimmed audio's time space. */
export function trimBeatGrid(grid: BeatGrid | null, trim: number): BeatGrid | null {
  if (!Number.isFinite(trim) || trim < 0) throw new Error("music.trimBeforeSec must be finite and non-negative");
  if (grid === null) return null;
  if (!Array.isArray(grid.beats) || !Array.isArray(grid.downbeats)) throw new Error("Invalid beat grid");
  for (const list of [grid.beats, grid.downbeats]) {
    if (list.some((n, i) => !Number.isFinite(n) || n < 0 || (i > 0 && n <= list[i - 1]))) {
      throw new Error("Beat times must be finite, non-negative and strictly increasing");
    }
  }
  if (grid.downbeats.some((n) => !grid.beats.includes(n))) throw new Error("Downbeats must exist in the beat grid");
  if (grid.beats.length === 0) throw new Error("Beat grid is empty");
  const beats = grid.beats.filter((n) => n >= trim).map((n) => n - trim);
  const downbeats = grid.downbeats.filter((n) => n >= trim).map((n) => n - trim);
  if (beats.length < 2) throw new Error("Audio trim leaves fewer than two measured beats");
  return { beats, downbeats };
}

export function calculateStoryMetadata(props: StoryTimingProps, grid: BeatGrid | null) {
  if (!Number.isInteger(props.fps) || props.fps < 24 || props.fps > 60) throw new Error("fps must be an integer from 24 to 60");
  if (!Number.isInteger(props.endingBeats) || props.endingBeats < 4 || props.endingBeats > 32) throw new Error("endingBeats must be an integer from 4 to 32");
  const beatGrid = trimBeatGrid(grid, props.music.trimBeforeSec);
  const clock = makeClock(beatGrid);
  const story = buildStory(props.copy, props.photos, props);
  const seconds = clock.at(story[story.length - 1].b1);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("Story has an invalid duration");
  return { fps: props.fps, durationInFrames: Math.ceil(seconds * props.fps), seconds, beatGrid };
}
