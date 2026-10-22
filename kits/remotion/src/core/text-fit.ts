import { fontModuleOf, type FontKey } from "./fonts";

/**
 * Deterministic text fitting. Widths are estimated from character classes with per-font average
 * advances measured from the packaged font files (Latin upper / lower / digit / space / punctuation,
 * in em); CJK and full-width characters count one em. No DOM measurement, so every render tab and
 * every frame gets the same size. Estimates carry a small safety margin, so a fitted line never
 * overflows its box; short CJK names are far below any box and keep their designed size.
 */
type Advances = [upper: number, lower: number, digit: number, space: number, punct: number];
const ADVANCE: Record<string, Advances> = {
  NotoSerifSC: [0.696, 0.548, 0.535, 0.259, 0.297],
  NotoSansSC: [0.603, 0.494, 0.521, 0.22, 0.403],
  Caveat: [0.509, 0.359, 0.45, 0.242, 0.205],
  Lora: [0.668, 0.524, 0.534, 0.263, 0.289],
  NunitoSans: [0.646, 0.491, 0.6, 0.246, 0.25],
  PlayfairDisplay: [0.642, 0.509, 0.476, 0.249, 0.293],
  BodoniModa: [0.695, 0.533, 0.54, 0.25, 0.235],
  Tangerine: [0.721, 0.242, 0.291, 0.15, 0.14],
  ZhiMangXing: [0.474, 0.328, 0.366, 0.202, 0.371],
  MaShanZheng: [0.474, 0.328, 0.366, 0.212, 0.371],
  BarlowCondensed: [0.477, 0.423, 0.437, 0.2, 0.244],
  ZCOOLKuaiLe: [0.698, 0.533, 0.621, 0.25, 0.429],
  CormorantGaramond: [0.635, 0.44, 0.431, 0.234, 0.215],
  JetBrainsMono: [0.6, 0.6, 0.6, 0.6, 0.6],
  LongCang: [0.451, 0.396, 0.378, 0.5, 0.352],
  KleeOne: [0.652, 0.515, 0.6, 0.35, 0.35],
  Inter: [0.681, 0.536, 0.593, 0.281, 0.325],
  Silkscreen: [0.865, 0.865, 0.863, 0.5, 0.575],
};
const FALLBACK: Advances = [0.7, 0.55, 0.58, 0.27, 0.32];

const isWide = (cp: number) =>
  (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
  (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6);
const isEmoji = (cp: number) => cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf);

/** Estimated advance of one line in px (letter-spacing trails every glyph, as in CSS). */
export function textWidth(text: string, font: FontKey, size: number, opts: { weight?: number; tracking?: number } = {}): number {
  return moduleTextWidth(text, fontModuleOf(font) ?? "", size, opts);
}

/** As textWidth, for a packaged font module named directly (e.g. "LongCang"). */
export function moduleTextWidth(text: string, module: string, size: number, opts: { weight?: number; tracking?: number } = {}): number {
  const [up, low, dig, sp, pun] = ADVANCE[module] ?? FALLBACK;
  // the variable fonts were measured at their default weight; bold Latin runs a little wider
  const bold = 1 + Math.max(0, (opts.weight ?? 400) - 400) / 400 * 0.08;
  let em = 0;
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    n++;
    if (isWide(cp)) em += 1;
    else if (isEmoji(cp)) em += 1.15;
    else if (ch >= "A" && ch <= "Z") em += up * bold;
    else if (ch >= "a" && ch <= "z") em += low * bold;
    else if (ch >= "0" && ch <= "9") em += dig * bold;
    else if (ch === " ") em += sp;
    else if (ch === "&" || ch === "@" || ch === "%") em += up * bold;
    else if (cp > 0xbf) em += low * bold; // accented Latin, Cyrillic, Greek
    else em += pun * bold;
  }
  return em * size + n * (opts.tracking ?? 0);
}

export interface FitOptions {
  weight?: number;
  /** letter-spacing at the designed size; scaled down with the size */
  tracking?: number;
  /** smallest size as a share of the designed size (default 0.45) */
  minScale?: number;
  /**
   * Allow a second line: when one line would shrink below `wrapBelow` × size, break at the couple
   * separator (" & ", "  ·  ") or the space nearest the middle, then fit the longer line.
   */
  wrap?: boolean;
  wrapBelow?: number;
}

export interface Fitted {
  text: string;
  size: number;
  tracking: number;
  lines: number;
}

const SAFETY = 1.04;

function shrink(lines: string[], font: FontKey, size: number, maxWidth: number, o: FitOptions): { size: number; tracking: number; need: number } {
  const tracking = o.tracking ?? 0;
  const widest = Math.max(...lines.map((l) => textWidth(l, font, size, { weight: o.weight, tracking }))) * SAFETY;
  if (widest <= maxWidth) return { size, tracking, need: 1 };
  /** the scale the text would need to fit, before the minimum clamps it */
  const need = maxWidth / widest;
  const k = Math.max(o.minScale ?? 0.45, need);
  return { size: Math.floor(size * k * 10) / 10, tracking: tracking * k, need };
}

/** Break a line once, at the most balanced separator. */
export function splitLine(text: string): [string, string] | null {
  for (const sep of [" & ", "  ·  ", " · ", " + "]) {
    const at = text.indexOf(sep);
    if (at > 0) return [text.slice(0, at + sep.trimEnd().length).trimEnd(), text.slice(at + sep.length).trimStart()];
  }
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (!spaces.length) return null;
  const mid = text.length / 2;
  const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  return [text.slice(0, at), text.slice(at + 1)];
}

/** Largest size ≤ `size` at which `text` fits `maxWidth` (optionally on two lines). */
export function fitText(text: string, font: FontKey, size: number, maxWidth: number, o: FitOptions = {}): Fitted {
  const pick = (t: string, f: { size: number; tracking: number }, lines: number): Fitted => ({ text: t, size: f.size, tracking: f.tracking, lines });
  const one = shrink(text.split("\n"), font, size, maxWidth, o);
  if (!o.wrap || one.need >= (o.wrapBelow ?? 0.8) || text.includes("\n")) return pick(text, one, text.split("\n").length);
  const parts = splitLine(text);
  if (!parts) return pick(text, one, 1);
  // two lines are already a concession to a long text; let them shrink further before overflowing
  const two = shrink(parts, font, size, maxWidth, { ...o, minScale: Math.min(o.minScale ?? 0.45, 0.34) });
  return two.need > one.need ? pick(parts.join("\n"), two, 2) : pick(text, one, 1);
}

/** Size only (single line). */
export const fitSize = (text: string, font: FontKey, size: number, maxWidth: number, o: FitOptions = {}) => {
  const { size: s, tracking } = shrink(text.split("\n"), font, size, maxWidth, o);
  return { size: s, tracking };
};
