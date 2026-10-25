/**
 * Showtime's running order in beats of its own soundtrack (showtime-party.ogg, 128 BPM, beat 0 at
 * 0.5 s). scripts/make-showtime-audio.py writes the music to the same plan: keep the two in step.
 *
 * A card is one screen: a line of the host's copy over the red stage with the dancing couple, a
 * countdown number, a gag, or a photo. Cards run back to back; every cut lands on a beat.
 */

export type CardKind =
  | "ident" // TV static → colour bars → wedding channel ident → "high energy ahead"
  | "gold" // gold lines over the red stage, couple either side
  | "split" // two words left and right, couple in the middle
  | "white" // red text on a white flash card
  | "number" // countdown digit
  | "date" // wedding date
  | "names" // the couple's names
  | "snap" // camera viewfinder snapping a photo
  | "gag" // a comic beat (pointing, applause, food, drunk groom)
  | "fake" // the wrong-person gag (childhood photo, record scratch, rewind)
  | "hero" // groom / bride photo with name plate
  | "photo" // a couple photo full screen
  | "witness" // "let's witness our happy moment"
  | "magazine" // white magazine spread, three photos
  | "sparkle" // gold sparkle title
  | "slide" // a wedding photo in a white rounded frame, small couple dancing below
  | "finale"; // round frame, couple, petals, thanks

export interface Card {
  id: string;
  b: number;
  len: number;
  kind: CardKind;
  /** copy key(s) of the text on this card */
  text?: string;
  /** what the couple does on this card (moves in toon.tsx) */
  groom?: string;
  bride?: string;
  /** extra detail per kind */
  v?: string | number;
}

let at = 0;
const cards: Card[] = [];
const card = (id: string, len: number, kind: CardKind, extra: Partial<Card> = {}) => {
  cards.push({ id, b: at, len, kind, ...extra });
  at += len;
};

// 0–32 opening
card("ident", 32, "ident");
// 32–116 the host's welcome, house rules and gags
card("w1", 4, "gold", { text: "w1", groom: "wave", bride: "wave" });
card("w2", 4, "gold", { text: "w2", groom: "dance", bride: "dance" });
card("w3", 4, "gold", { text: "w3", groom: "bounce", bride: "bounce" });
card("w4", 4, "gold", { text: "w4", groom: "point", bride: "pointR" });
card("w5", 4, "gold", { text: "w5", groom: "idle", bride: "idle" });
card("g1", 4, "gag", { text: "g1", groom: "point", bride: "pointR", v: "point" });
card("w6", 4, "gold", { text: "w6", groom: "dance", bride: "dance" });
card("w7", 4, "gold", { text: "w7", groom: "phone", bride: "phone" });
card("snap", 4, "snap", { text: "snap" });
card("w8", 4, "gold", { text: "w8", groom: "heart", bride: "heart" });
card("w9", 4, "gold", { text: "w9", groom: "bounce", bride: "bounce" });
card("w10", 4, "gold", { text: "w10", groom: "clap", bride: "clap" });
card("g2", 4, "gag", { text: "g2", groom: "cheer", bride: "cheer", v: "applause" });
card("w11", 4, "gold", { text: "w11", groom: "idle", bride: "idle" });
card("w12", 4, "split", { text: "w12", groom: "dance", bride: "dance" });
card("w13", 4, "split", { text: "w13", groom: "kick", bride: "bounce" });
card("w14", 4, "split", { text: "w14", groom: "cheer", bride: "cheer" });
card("g3", 4, "gag", { text: "g3", groom: "clap", bride: "clap", v: "food" });
card("w15", 4, "gold", { text: "w15", groom: "shrug", bride: "pointR" });
card("w16", 4, "gold", { text: "w16", groom: "think", bride: "shrug" });
card("g4", 4, "gag", { text: "g4", groom: "idle", bride: "shrug", v: "drunk" });
// 116–160 countdown
card("c0", 4, "gold", { text: "c0", groom: "bounce", bride: "bounce" });
card("n3", 4, "number", { v: 3, groom: "up", bride: "up" });
card("n2", 4, "number", { v: 2, groom: "vL", bride: "vR" });
["x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8"].forEach((k, i) =>
  card(k, 2, i % 2 ? "white" : "gold", { text: k, groom: ["dance", "kick", "bounce", "dance"][i % 4], bride: ["dance", "bounce", "kick", "dance"][i % 4] }),
);
card("n1", 4, "number", { v: 1, groom: "cheer", bride: "cheer" });
card("date", 4, "date", { groom: "wave", bride: "wave" });
card("names", 4, "names", { groom: "heart", bride: "heart" });
card("hl", 4, "white", { text: "hl", groom: "cheer", bride: "cheer" });
// 160–200 the groom
card("gi1", 2, "gold", { text: "gi1", groom: "wave" });
card("gi2", 2, "gold", { text: "gi2", groom: "pointR" });
card("gi3", 2, "split", { text: "gi3", groom: "vL" });
card("gi4", 2, "split", { text: "gi4", groom: "kick" });
card("gi5", 2, "split", { text: "gi5", groom: "cheer" });
card("gi6", 2, "split", { text: "gi6", groom: "dance" });
card("gcall", 4, "gold", { text: "gcall", groom: "clap", bride: "clap" });
card("gfake", 8, "fake", { text: "gfake", v: "groom" });
card("greal", 4, "gold", { text: "greal", groom: "cheer" });
card("ghero", 8, "hero", { v: "groom" });
card("coupleA", 4, "photo", { v: "coupleA" });
// 200–240 the bride
card("bi1", 2, "gold", { text: "bi1", bride: "wave" });
card("bi2", 2, "gold", { text: "bi2", bride: "pointR" });
card("bi3", 2, "split", { text: "bi3", bride: "vR" });
card("bi4", 2, "split", { text: "bi4", bride: "dance" });
card("bi5", 2, "split", { text: "bi5", bride: "heart" });
card("bi6", 2, "split", { text: "bi6", bride: "bounce" });
card("bi7", 2, "split", { text: "bi7", bride: "cheer" });
card("bname", 2, "gold", { text: "bname", bride: "heart" });
card("bcall", 4, "gold", { text: "bcall", groom: "clap", bride: "clap" });
card("bfake", 8, "fake", { text: "bfake", v: "bride" });
card("bhero", 8, "hero", { v: "bride" });
card("coupleB", 4, "photo", { v: "coupleB" });
// 240–248 into the photos
card("witness", 8, "witness", { text: "witness", groom: "heart", bride: "heart" });
// 248–272 three magazine spreads
card("mag0", 8, "magazine", { v: 0 });
card("mag1", 8, "magazine", { v: 1 });
card("mag2", 8, "magazine", { v: 2 });
// 272–276 countdown title, 276–324 twelve photo slides
card("count", 4, "sparkle", { text: "count", groom: "heart", bride: "heart" });
for (let i = 0; i < 12; i++) card(`slide${i}`, 4, "slide", { v: i, groom: ["dance", "bounce", "kick", "cheer"][i % 4], bride: ["dance", "kick", "bounce", "heart"][i % 4] });
// 324–356 ending
card("finale", 32, "finale", { text: "finale", groom: "wave", bride: "wave" });

export const CARDS: readonly Card[] = cards;
export const TOTAL_BEATS = at; // 356
export const BPM = 128;
export const BEAT0 = 0.5;
/** design seconds of beat n (also the fallback when the beat map is missing) */
export const beatSec = (n: number) => BEAT0 + (n * 60) / BPM;
export const cardById = (id: string) => cards.find((c) => c.id === id)!;
