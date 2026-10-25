/**
 * Showtime's running order, second by second as in the owner's reference film (197 s). Every card
 * starts and ends where the reference cuts. Film clips ("clip" cards) are slots: the project puts a
 * video file there (see copy keys clip_*); the template shows a placeholder when it is empty.
 */

export type CardKind =
  | "clip" // a film-clip slot
  | "bars" // colour bars between the opening clip and the welcome
  | "gold" // gold lines over the red stage, couple either side
  | "split" // two words left and right of the dancing couple (or of one of them)
  | "spread" // single words scattered round the couple
  | "white" // red text on a white flash card
  | "number" // giant countdown digit
  | "balloons" // 3 · 2 · 1 balloons rising past the bride
  | "date" // wedding date
  | "names" // the couple's names
  | "marquee" // one line scrolling right to left past the groom
  | "photo" // a couple photo, full screen
  | "hearts" // "下面一起见证" with the couple and floating hearts
  | "glitter" // glittering line ("我们的幸福时刻吧")
  | "magazine" // the white magazine pages
  | "burst" // golden burst title with the couple sitting together
  | "pair" // two wedding photos in one white rounded frame, tiny couples below
  | "single" // one wedding photo in a white rounded frame, tiny couples below
  | "finale"; // round gold frame, couple with gifts, petals, thanks

export interface Card {
  id: string;
  /** seconds */
  a: number;
  b: number;
  kind: CardKind;
  text?: string;
  groom?: string;
  bride?: string;
  v?: string | number;
}

const cards: Card[] = [];
const add = (id: string, a: number, b: number, kind: CardKind, extra: Partial<Card> = {}) => cards.push({ id, a, b, kind, ...extra });
const both = (g: string, br: string = g) => ({ groom: g, bride: br });

add("clip_open", 0, 22.8, "clip");
add("bars", 22.8, 23.77, "bars");
add("w1", 23.77, 25.67, "gold", { text: "w1", ...both("vL", "vR") });
add("w2", 25.67, 26.9, "gold", { text: "w2", ...both("pointL", "pointR") });
add("w3", 26.9, 28.87, "gold", { text: "w3", ...both("dance") });
add("w4", 28.87, 30.83, "gold", { text: "w4", ...both("bounce") });
add("w5", 30.83, 32.4, "gold", { text: "w5", ...both("bow") });
add("clip_1", 32.4, 35.87, "clip");
add("w6", 35.87, 37.87, "gold", { text: "w6", ...both("dance") });
add("w7", 37.87, 38.83, "gold", { text: "w7", groom: "phone", bride: "phone" });
add("couple1", 38.83, 40.77, "photo", { v: "couple1" });
add("w8", 40.77, 43.07, "gold", { text: "w8", groom: "selfie", bride: "selfie" });
add("w9", 43.07, 44.87, "gold", { text: "w9", ...both("bounce") });
add("w10", 44.87, 46.17, "gold", { text: "w10", ...both("clap") });
add("clip_2", 46.17, 48.83, "clip");
add("w11", 48.83, 50.4, "spread", { text: "w11", ...both("idle") });
add("w12", 50.4, 51.87, "split", { text: "w12", ...both("dance") });
add("w13", 51.87, 53.2, "split", { text: "w13", ...both("kick", "bounce") });
add("w14", 53.2, 54.4, "split", { text: "w14", ...both("bounce", "kick") });
add("w15", 54.4, 55.97, "split", { text: "w15", ...both("cheer") });
add("clip_3", 55.97, 57.77, "clip");
add("w16", 57.77, 60.47, "gold", { text: "w16", ...both("pointL", "pointR") });
add("w17", 60.47, 61.53, "gold", { text: "w17", ...both("shrug") });
add("clip_4", 61.53, 64.85, "clip");
add("c0", 64.85, 67.17, "gold", { text: "c0", bride: "dance", v: "bride" });
add("balloons", 67.17, 70.43, "balloons");
const flashes: [string, number, number, "gold" | "white"][] = [
  ["x1", 70.43, 71.4, "gold"], ["x2", 71.4, 72.03, "white"], ["x3", 72.03, 72.63, "gold"], ["x4", 72.63, 73.3, "white"],
  ["x5", 73.3, 73.9, "white"], ["x6", 73.9, 75.13, "gold"], ["x7", 75.13, 75.73, "white"], ["x8", 75.73, 76.3, "gold"],
  ["x9", 76.3, 76.97, "white"], ["x10", 76.97, 77.53, "gold"], ["x11", 77.53, 78.13, "white"], ["x12", 78.13, 78.77, "gold"],
];
flashes.forEach(([id, a, b, kind], i) => add(id, a, b, kind, { text: id, groom: ["dance", "kick", "vL", "up"][i % 4], bride: ["dance", "bounce", "vR", "up"][i % 4], v: "flash" }));
add("n3", 78.77, 79.0, "number", { v: 3, groom: "bow", bride: "bow", text: "white" });
add("n2", 79.0, 79.3, "number", { v: 2, groom: "bow", bride: "bow" });
add("n1", 79.3, 79.7, "number", { v: 1, groom: "up", bride: "up", text: "white" });
add("x13", 79.7, 80.27, "gold", { text: "x13", v: "flash" });
add("date", 80.27, 80.87, "date");
add("names", 80.87, 81.8, "names", { groom: "wave", bride: "wave" });
add("x14", 81.8, 82.1, "white", { text: "x14", v: "flash" });
add("x15", 82.1, 82.47, "gold", { text: "x15", v: "flash" });
add("x16", 82.47, 83.07, "white", { text: "x16", v: "flash" });
const praise: [string, number, number, string][] = [["gi1", 83.07, 84.03, "hipL"], ["gi2", 84.03, 84.53, "vL"], ["gi3", 84.53, 85.17, "cheerB"], ["gi4", 85.17, 85.77, "kick"], ["gi5", 85.77, 86.43, "dance"]];
praise.forEach(([id, a, b, m]) => add(id, a, b, "split", { text: id, groom: m }));
add("gi6", 86.43, 89.63, "marquee", { text: "gi6", groom: "dance" });
add("clip_groom", 89.63, 98.83, "clip");
add("g1", 98.83, 100.3, "gold", { text: "g1", groom: "sit", bride: "sit" });
add("g2", 100.3, 102.13, "gold", { text: "g2", groom: "pointR" });
add("coupleA", 102.13, 105.93, "photo", { v: "coupleA" });
add("clip_5", 105.93, 109.4, "clip");
add("bi1", 109.4, 111.03, "gold", { text: "bi1", bride: "wave" });
const praiseB: [string, number, number, string][] = [["bi2", 111.03, 112.13, "vR"], ["bi3", 112.13, 112.9, "dance"], ["bi4", 112.9, 114.07, "heart"], ["bi5", 114.07, 114.8, "bounce"], ["bi6", 114.8, 115.53, "cheer"]];
praiseB.forEach(([id, a, b, m]) => add(id, a, b, "split", { text: id, bride: m }));
add("bi7", 115.53, 116.97, "gold", { text: "bi7", bride: "up" });
add("clip_bride", 116.97, 132.23, "clip");
add("coupleB0", 132.23, 134.27, "photo", { v: "coupleB0" });
add("coupleB1", 134.27, 135.83, "photo", { v: "coupleB1" });
add("clip_6", 135.83, 138.97, "clip");
add("h1", 138.97, 140.83, "hearts", { text: "h1", ...both("heart") });
add("h2", 140.83, 142.93, "glitter", { text: "h2", groom: "kick", bride: "dance" });
add("mag", 142.93, 154.53, "magazine");
add("count", 154.53, 158.33, "burst", { text: "count", ...both("heart") });
[158.33, 159.87, 161.83, 163.8, 165.67].forEach((a, i, l) => add(`pair${i}`, a, l[i + 1] ?? 167.33, "pair", { v: i }));
[167.33, 168.6, 169.7, 170.77, 171.83].forEach((a, i, l) => add(`single${i}`, a, l[i + 1] ?? 174.07, "single", { v: i }));
add("finale", 174.07, 197.03, "finale", { text: "finale" });

export const CARDS: readonly Card[] = cards;
export const TOTAL_SECONDS = 197.03;
/** The reference track's beat (129.2 BPM, first beat 0.07 s): the couple dances to it. */
export const BPM = 129.2;
export const BEAT0 = 0.07;
export const beatOf = (t: number) => (t - BEAT0) / (60 / BPM);
/** Where the magazine pages change (seconds). */
export const MAG = { enter: 142.93, pageA: 143.3, swap: 146.9, flip: 150.6, pageB: 151.9, end: 154.53 };
