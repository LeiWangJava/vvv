import type { Clock } from "./clock";
import type { Scene } from "./story";
import { KEY_SAMPLES } from "./keys";

const SEG = new Intl.Segmenter("zh", { granularity: "grapheme" });
const KEYCAP = (digit: string) => `${digit}\uFE0F\u20E3`;

/** Resolve the copy's keycap markup before counting any visible characters. */
export const resolveMarkup = (text: string) => text.replace(/\[(\d+)\]/g, (_, digits: string) => [...digits].map(KEYCAP).join(""));
export const graphemes = (text: string) => [...SEG.segment(resolveMarkup(text))].map((part) => part.segment);
export const splitLines = (text: string) => text.split("｜").map((line) => line.trim()).filter(Boolean);

/** Shared visual reveal: a whole grapheme lands at each beat subdivision, starting with one. */
export function typeProgress(lines: string[], lb: number, start: number, rate: number) {
  const counts = lines.map((line) => graphemes(line).length);
  let k = Math.max(0, Math.floor((lb - start) * rate + 1e-6) + (lb >= start ? 1 : 0));
  const shown: number[] = [];
  let cursorLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const s = Math.min(counts[i], k);
    shown.push(s);
    k -= s;
    if (s > 0 || i === 0) cursorLine = i;
    if (s < counts[i]) break;
  }
  while (shown.length < lines.length) shown.push(0);
  const total = counts.reduce((a, b) => a + b, 0);
  const typed = shown.reduce((a, b) => a + b, 0);
  return { shown, cursorLine, done: typed >= total, total };
}

const RATES = [2, 2.5, 3, 3.5, 4, 5, 6];
export const TYPE_START_BEAT = 0.5;
export const NARRATIVE_START_BEAT = 0.25;
export const KEY_TAP_SECONDS = Math.max(...KEY_SAMPLES.map((sample) => sample.durationSeconds));

/** Existing DV pacing: slowest rate that leaves ~2.5 beats to read the completed text. */
export const typeRate = (lines: string[], beats: number) => {
  const count = lines.reduce((sum, line) => sum + graphemes(line).length, 0);
  const available = Math.max(1, beats - TYPE_START_BEAT - 2.5);
  return RATES.find((rate) => count / rate <= available) ?? 6;
};

/** Existing narrative pacing, including compact four-beat cards and the faster ending. */
export function typingSettings(kind: "type" | "card" | "ending", lines: string[], beats: number) {
  if (kind === "type") return { start: TYPE_START_BEAT, rate: typeRate(lines, beats) };
  const count = lines.reduce((sum, line) => sum + graphemes(line).length, 0);
  const window = Math.max(0.5, Math.min(3, beats - 2.1));
  const rate = Math.max(kind === "ending" ? 6 : 2, Math.ceil((count / window) * 2) / 2);
  return { start: NARRATIVE_START_BEAT, rate };
}

export function narrativeTyping(lb: number, beats: number, lines: string[], ending = false) {
  const { start, rate } = typingSettings(ending ? "ending" : "card", lines, beats);
  const progress = typeProgress(lines, lb, start, rate);
  return {
    ...progress,
    cursorOn: lb >= start && (!progress.done || Math.floor(lb * 2) % 2 === 0),
  };
}

export interface TypingEvent {
  sceneId: string;
  frame: number;
  /** The displayed frame starts here; visibility itself is sampled at its center. */
  time: number;
  line: number;
  index: number;
  glyph: string;
  variant: number;
}

/**
 * Walk actual rendered frame samples, using exactly the same reveal as the text. This handles
 * irregular song beats, scene boundaries, and the first/last glyph without a separate timer.
 * Cursor blinks cannot create events. Whitespace consumes its existing visual step silently.
 */
export function typingEvents(story: Scene[], clock: Clock, fps: number, cardsEnabled: boolean): TypingEvent[] {
  const events: TypingEvent[] = [];
  for (const scene of story) {
    if (scene.kind !== "type" && scene.kind !== "card" && scene.kind !== "ending") continue;
    if (scene.kind !== "type" && !cardsEnabled) continue;
    const lines = splitLines(scene.text);
    const glyphs = lines.map(graphemes);
    const { start, rate } = typingSettings(scene.kind, lines, scene.b1 - scene.b0);
    const end = clock.at(scene.b1);
    let previous = lines.map(() => 0);
    for (let frame = Math.max(0, Math.ceil(clock.at(scene.b0) * fps - 0.5)); (frame + 0.5) / fps < end; frame++) {
      const t = (frame + 0.5) / fps;
      const { shown, done } = typeProgress(lines, clock.beatOf(t) - scene.b0, start, rate);
      for (let line = 0; line < shown.length; line++) {
        for (let index = previous[line]; index < shown[line]; index++) {
          const glyph = glyphs[line][index];
          if (/^\s+$/u.test(glyph)) continue;
          events.push({ sceneId: scene.id, frame, time: frame / fps, line, index, glyph, variant: events.length % KEY_SAMPLES.length });
        }
      }
      previous = shown;
      if (done) break;
    }
  }
  return events;
}
