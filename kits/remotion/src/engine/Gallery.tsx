import React from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { travel } from "../components/Photo";
import { coverFit } from "../core/crop";
import { eIo3, eOut3, lerp, ramp } from "../core/ease";
import { getPhoto, photoSrc } from "../core/manifest";
import { useT } from "../core/time";
import { useHalfShutter, type Dir, type FilmSegment, type FilmTransition, type TransitionKind } from "./Film";

/**
 * Wedding-photo gallery — the main part of every template.
 *
 * planShots() groups the photos of each wedding set (outfits stay together) into shots, choosing
 * from nine layouts so that no two consecutive shots look alike; each shot also cycles a camera
 * move and an entrance. placeShots() lands every shot change on a beat. gallerySegments() turns
 * them into Film segments with a varied, non-repeating transition palette. The look (background,
 * frames, decorations, captions) comes from each template's skin.
 */

export type ShotKind = "full" | "inset" | "solo" | "pair" | "trio" | "hero" | "mixed" | "offset" | "strip";
export type Move = "in" | "out" | "panL" | "panR" | "rise";
export type Enter = "rise" | "slide" | "pop" | "reveal" | "fade";

export interface Shot {
  kind: ShotKind;
  ids: string[];
  set: string;
  /** first shot of its set (where the set's caption goes) */
  first: boolean;
  /** shot boundaries on the beat grid (design seconds) */
  from: number;
  to: number;
  index: number;
  move: Move;
  enter: Enter;
  /** mirror the layout (hero/offset/mixed big side on the right) */
  flip: boolean;
}
type Plan = Pick<Shot, "kind" | "ids" | "set" | "first">;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const NEEDS: Record<ShotKind, (L: number, P: number) => boolean> = {
  full: (L) => L >= 1,
  inset: (L, P) => L + P >= 1,
  solo: (_L, P) => P >= 1,
  pair: (_L, P) => P >= 2,
  trio: (_L, P) => P >= 3,
  hero: (L, P) => L >= 1 && P >= 2,
  mixed: (L, P) => L >= 1 && P >= 1,
  offset: (_L, P) => P >= 2,
  strip: (_L, P) => P >= 4,
};
/** how many landscapes / portraits a layout takes */
const TAKES: Record<ShotKind, [number, number]> = {
  full: [1, 0],
  inset: [1, 0],
  solo: [0, 1],
  pair: [0, 2],
  trio: [0, 3],
  hero: [1, 2],
  mixed: [1, 1],
  offset: [0, 2],
  strip: [0, 4],
};
/** layouts with room for a caption */
const CAPTIONABLE: ShotKind[] = ["full", "inset", "offset", "mixed"];

export const ALL_LAYOUTS: ShotKind[] = ["full", "pair", "hero", "inset", "trio", "mixed", "offset", "solo", "strip"];

/**
 * Group photos into shots. Within each set, layouts rotate through `layouts` (allowed kinds,
 * preference order): the least-used satisfiable layout wins, never the same as the previous shot
 * and preferably not the one before that. The first shot of a set prefers a captionable layout.
 */
export function planShots(
  ids: string[],
  opts: {
    layouts?: ShotKind[];
    captions?: boolean;
    /** layouts that can carry the set caption (default: full, inset, offset, mixed) */
    captionKinds?: ShotKind[];
    /** layouts only allowed as the first shot of a set (e.g. a title page) */
    onlyFirst?: ShotKind[];
  } = {},
): Plan[] {
  const allowed = opts.layouts ?? ALL_LAYOUTS;
  const capKinds = opts.captionKinds ?? CAPTIONABLE;
  const bySet = new Map<string, string[]>();
  for (const id of ids) {
    const p = getPhoto(id);
    const key = p.set ?? p.stage ?? "project";
    bySet.set(key, [...(bySet.get(key) ?? []), id]);
  }
  const used = new Map<ShotKind, number>();
  const recent: ShotKind[] = [];
  const out: Plan[] = [];
  for (const [set, list] of bySet) {
    const L = list.filter((id) => getPhoto(id).orientation === "landscape");
    const P = list.filter((id) => getPhoto(id).orientation !== "landscape");
    let first = true;
    while (L.length || P.length) {
      const fits = allowed.filter((k) => NEEDS[k](L.length, P.length) && (first || !opts.onlyFirst?.includes(k)));
      // inset of a portrait when no landscapes are left
      const pool = fits.length ? fits : (["inset"] as ShotKind[]);
      const score = (k: ShotKind) => {
        let s = (used.get(k) ?? 0) * 10 + allowed.indexOf(k);
        if (recent[recent.length - 1] === k) s += 1000;
        if (recent[recent.length - 2] === k) s += 40;
        if (first && opts.captions !== false && !capKinds.includes(k)) s += 25;
        if (first && opts.onlyFirst?.includes(k)) s -= 30;
        // don't strand a single portrait when a pair/trio could take it
        const [, tp] = TAKES[k];
        const leftP = P.length - tp;
        if (leftP === 1 && !allowed.includes("solo") && !allowed.includes("inset")) s += 30;
        return s;
      };
      const kind = [...pool].sort((a, b) => score(a) - score(b))[0];
      let [tl, tp] = TAKES[kind];
      if (kind === "inset" && L.length === 0) [tl, tp] = [0, 1];
      const ids = [...L.splice(0, tl), ...P.splice(0, tp)];
      out.push({ kind, ids, set, first });
      used.set(kind, (used.get(kind) ?? 0) + 1);
      recent.push(kind);
      first = false;
    }
  }
  return out;
}

/** @deprecated use planShots */
export const groupShots = (ids: string[], _opts?: unknown) => planShots(ids);

const WEIGHT: Record<ShotKind, number> = { full: 1, inset: 1, solo: 1, pair: 1.25, mixed: 1.25, offset: 1.25, trio: 1.5, hero: 1.5, strip: 1.6 };
const MOVES: Move[] = ["in", "panR", "out", "panL", "rise"];
const ENTERS: Enter[] = ["rise", "slide", "pop", "reveal", "fade"];

/** Lay shots on the beat grid between beats `b0` and `b1`; each shot gets at least `minBeats`. */
export function placeShots(
  plans: Plan[],
  B: (n: number) => number,
  b0: number,
  b1: number,
  minBeats = 2,
  opts: { enters?: Enter[]; moves?: Move[] } = {},
): Shot[] {
  const total = b1 - b0;
  if (!plans.length) throw new Error("VVV_TIMELINE_INVALID: a gallery needs at least one shot.");
  if (!Number.isInteger(total) || !Number.isInteger(minBeats) || minBeats < 1 || total < plans.length * minBeats) {
    throw new Error(`VVV_TIMELINE_INVALID: ${plans.length} shots at ${minBeats} minimum beats do not fit the ${total}-beat window.`);
  }
  const W = plans.reduce((s, g) => s + WEIGHT[g.kind], 0);
  const beats = plans.map((g) => Math.max(minBeats, Math.round((WEIGHT[g.kind] / W) * total)));
  let diff = total - beats.reduce((s, v) => s + v, 0);
  for (let i = 0; diff !== 0 && i < 10000; i++) {
    const k = i % beats.length;
    if (diff > 0) {
      beats[k]++;
      diff--;
    } else if (beats[k] > minBeats) {
      beats[k]--;
      diff++;
    }
  }
  const enters = opts.enters ?? ENTERS;
  const moves = opts.moves ?? MOVES;
  let at = b0;
  return plans.map((g, index) => {
    const from = B(at);
    at += beats[index];
    return { ...g, from, to: B(at), index, move: moves[index % moves.length], enter: enters[(index * 2 + 1) % enters.length], flip: index % 2 === 1 };
  });
}

export interface CaptionArgs {
  shot: Shot;
  title: string;
  line: string;
  t: number;
  /** a free area for the caption in this layout */
  area: Box;
  /** the caption sits over a photo (needs a scrim / light text) */
  overPhoto: boolean;
}

export interface GallerySkin {
  /** page behind the photos */
  background: (shot: Shot) => React.ReactNode;
  /** outer margin and gap between photos, px (marginY: top/bottom, defaults to margin) */
  margin: number;
  marginY?: number;
  gap: number;
  radius: number;
  shadow?: string;
  /** frame drawn around each photo (border, mat …) */
  frame?: { width: number; color: string; inner?: { width: number; color: string } };
  /** camera move amount (zoom / pan) */
  kb?: number;
  /** entrance style(s); a list rotates per shot (default: all five) */
  enter?: Enter | Enter[];
  /** decoration on top of each grouped photo (tape, corner ornaments …) */
  decorate?: (args: { id: string; box: Box; k: number; shot: Shot; t: number }) => React.ReactNode;
  /** overlay over the whole shot (letterbox, grain …) */
  overlay?: (args: { shot: Shot; t: number }) => React.ReactNode;
  /** set caption, drawn on the first shot of each set */
  caption?: (args: CaptionArgs) => React.ReactNode;
  /** drawn on every shot with the photo boxes, to dress the page's empty space (text, ornaments) */
  filler?: (args: { shot: Shot; t: number; boxes: Box[]; caption?: [string, string] }) => React.ReactNode;
  /** landscape photos as framed prints within the margins instead of full bleed */
  frameFull?: boolean;
  /** angle jitter for grouped photos, degrees */
  tilt?: number;
  /** behind solo / inset photos: blurred copy of the photo (default) or the skin's background */
  soloFill?: "blur" | "background";
  /** where a solo portrait goes (default: centered, full height) */
  soloBox?: (shot: Shot) => Box;
  /** image fit inside a box; smart contains photos when the box would crop too much */
  fit?: "cover" | "contain" | "smart";
  /** crop target for cover-fit photos, expressed as a fraction of the card */
  cropTarget?: [number, number];
  /** portrait-friendly width caps for grouped cards */
  pairAspect?: number;
  trioAspect?: number;
  heroPortraitAspect?: number;
}

/**
 * Boxes for a layout in a portrait frame (height > width). Groups stack vertically instead of
 * sitting side by side, so portrait photos keep a readable size on a phone-shaped screen.
 */
function portraitBoxes(kind: ShotKind, n: number, margin: number, gap: number, W: number, H: number, marginY: number, flip: boolean, aspect: number): Box[] {
  const h = H - 2 * marginY;
  const aw = W - 2 * margin;
  const mirror = (b: Box[]) => (flip ? b.map((x) => ({ ...x, x: W - x.x - x.w })) : b);
  /** stack boxes of the given heights, centered vertically as one group */
  const centered = (rows: Box[]): Box[] => {
    const top = Math.min(...rows.map((r) => r.y));
    const bottom = Math.max(...rows.map((r) => r.y + r.h));
    const dy = (H - (bottom - top)) / 2 - top;
    return rows.map((r) => ({ ...r, y: r.y + dy }));
  };
  const half = (aw - gap) / 2;
  switch (kind) {
    case "full":
      return [{ x: margin, y: marginY, w: aw, h }];
    case "inset": {
      let iw = aw * 0.92;
      let ih = iw / aspect;
      if (ih > h * 0.9) {
        ih = h * 0.9;
        iw = ih * aspect;
      }
      return [{ x: (W - iw) / 2, y: (H - ih) / 2, w: iw, h: ih }];
    }
    case "solo": {
      const sh = Math.min(h, aw / 0.68);
      return [{ x: margin, y: (H - sh) / 2, w: aw, h: sh }];
    }
    case "pair": {
      // Two portrait prints on a diagonal, each about 60% of the width: side by side they would be
      // too small to read on a phone, stacked they would crop to strips.
      const pw = aw * 0.6;
      const ph = Math.min(pw / 0.72, (h - gap) / 1.6);
      const w = ph * 0.72;
      return mirror(centered([
        { x: margin, y: 0, w, h: ph },
        { x: margin + aw - w, y: ph * 0.6 + gap, w, h: ph },
      ]));
    }
    case "trio": {
      const top = (h - gap) * 0.55;
      const low = Math.min(h - gap - top, half / 0.66);
      return mirror(centered([
        { x: margin, y: 0, w: aw, h: top },
        { x: margin, y: top + gap, w: half, h: low },
        { x: margin + half + gap, y: top + gap, w: half, h: low },
      ]));
    }
    case "hero": {
      const lh = aw / 1.5;
      const ph = Math.min(h - lh - gap, half / 0.7);
      return mirror(centered([
        { x: margin, y: 0, w: aw, h: lh },
        { x: margin, y: lh + gap, w: half, h: ph },
        { x: margin + half + gap, y: lh + gap, w: half, h: ph },
      ]));
    }
    case "mixed": {
      const lh = aw / 1.5;
      const ph = Math.min(h - lh - gap, aw / 0.72);
      const pw = Math.min(aw, ph * 0.72);
      return mirror(centered([
        { x: margin, y: 0, w: aw, h: lh },
        { x: margin + (aw - pw) / 2, y: lh + gap, w: pw, h: ph },
      ]));
    }
    case "offset": {
      const bw = aw * 0.76;
      const bh = Math.min(h * 0.6, bw / 0.72);
      const sw = aw * 0.52;
      const sh = Math.min(h - bh + gap * 3, sw / 0.72);
      return mirror(centered([
        { x: margin, y: 0, w: bw, h: bh },
        { x: margin + aw - sw, y: bh - gap * 3, w: sw, h: sh },
      ]));
    }
    case "strip": {
      const ch = Math.min((h - gap) / 2, half / 0.72);
      const cells = [0, 1, 2, 3].map((i) => ({ x: margin + (i % 2) * (half + gap), y: Math.floor(i / 2) * (ch + gap), w: half, h: ch }));
      return centered(cells.slice(0, Math.min(4, n)));
    }
  }
}

/** Boxes for a layout, honoring margins; `flip` mirrors asymmetric layouts. */
export function layoutBoxes(
  kind: ShotKind,
  n: number,
  margin: number,
  gap: number,
  W = 1920,
  H = 1080,
  marginY = margin,
  flip = false,
  aspect = 1.5,
  pairAspect = 0.9,
  trioAspect = 0.72,
  heroPortraitAspect = 0.72,
): Box[] {
  if (H > W) return portraitBoxes(kind, n, margin, gap, W, H, marginY, flip, aspect);
  const h = H - 2 * marginY;
  const aw = W - 2 * margin;
  const mirror = (b: Box[]) => (flip ? b.map((x) => ({ ...x, x: W - x.x - x.w })) : b);
  switch (kind) {
    case "full":
      return [{ x: margin, y: marginY, w: aw, h }];
    case "inset": {
      // the photo's own proportions, a little smaller than the frame, floating over its blur
      let ih = h * 0.96;
      let iw = ih * aspect;
      if (iw > aw * 0.88) {
        iw = aw * 0.88;
        ih = iw / aspect;
      }
      return [{ x: (W - iw) / 2, y: (H - ih) / 2, w: iw, h: ih }];
    }
    case "solo": {
      const w = Math.min(aw, h * 0.8);
      return [{ x: (W - w) / 2, y: marginY, w, h }];
    }
    case "hero": {
      const bw = (aw - gap) * 0.64;
      const sw = aw - gap - bw;
      const sh = (h - gap) / 2;
      const sideW = Math.min(sw, sh * heroPortraitAspect);
      const sideX = margin + bw + gap + (sw - sideW) / 2;
      return mirror([
        { x: margin, y: marginY, w: bw, h },
        { x: sideX, y: marginY, w: sideW, h: sh },
        { x: sideX, y: marginY + sh + gap, w: sideW, h: sh },
      ]);
    }
    case "mixed": {
      const lw = (aw - gap) * 0.64;
      return mirror([
        { x: margin, y: marginY, w: lw, h },
        { x: margin + lw + gap, y: marginY, w: aw - gap - lw, h },
      ]);
    }
    case "offset": {
      const bw = h * 0.72;
      const sh = h * 0.7;
      const sw = sh * 0.72;
      return mirror([
        { x: margin + aw * 0.06, y: marginY, w: bw, h },
        { x: margin + aw * 0.06 + bw + gap * 1.6, y: marginY + h - sh, w: sw, h: sh },
      ]);
    }
    case "strip": {
      const cols = 4;
      const w = (aw - (cols - 1) * gap) / cols;
      return Array.from({ length: Math.min(cols, n) }, (_, i) => ({ x: margin + i * (w + gap), y: marginY, w, h }));
    }
    default: {
      const cols = kind === "trio" ? 3 : 2;
      const avail = aw - (cols - 1) * gap;
      const w = Math.min(avail / cols, h * (kind === "pair" ? pairAspect : trioAspect));
      const groupW = cols * w + (cols - 1) * gap;
      const x0 = (W - groupW) / 2;
      return Array.from({ length: Math.min(cols, n) }, (_, i) => ({ x: x0 + i * (w + gap), y: marginY, w, h }));
    }
  }
}

/** A free area for the caption in each layout, and whether it sits over a photo. */
function captionArea(shot: Shot, boxes: Box[], margin: number, W: number, H: number): { area: Box; overPhoto: boolean } {
  if (H > W) {
    // Portrait: the lower band, above the bottom safe area, over the photo.
    return { area: { x: margin, y: H - 0.24 * H, w: W - 2 * margin, h: 0.16 * H }, overPhoto: true };
  }
  switch (shot.kind) {
    case "offset": {
      const small = boxes[1];
      const x = shot.flip ? margin : small.x;
      const w = shot.flip ? boxes[1].x + boxes[1].w - margin : W - margin - small.x;
      return { area: { x, y: margin, w: Math.max(420, w), h: small.y - margin - 20 }, overPhoto: false };
    }
    case "inset":
      return { area: { x: 90, y: H - 320, w: 760, h: 230 }, overPhoto: true };
    default:
      return { area: { x: 90, y: H - 320, w: 900, h: 230 }, overPhoto: true };
  }
}

const PhotoInBox: React.FC<{
  id: string;
  box: Box;
  skin: GallerySkin;
  z: number;
  pan: [number, number];
  dy: number;
  dx: number;
  op: number;
  ang: number;
  sc: number;
  clip?: string;
  mv?: [number, number];
  fitMode: "cover" | "contain";
}> = ({
  id,
  box,
  skin,
  z,
  pan,
  dy,
  dx,
  op,
  ang,
  sc,
  clip,
  mv,
  fitMode,
}) => {
  const photo = getPhoto(id);
  const f = skin.frame;
  const fw = f ? f.width + (f.inner?.width ?? 0) : 0;
  const fit = coverFit(photo, box.w - 2 * fw, box.h - 2 * fw, skin.cropTarget);
  const sx = Math.abs(mv?.[0] ?? 0) / 2.5;
  const sy = Math.abs(mv?.[1] ?? 0) / 2.5;
  if (op <= 0.002) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x + dx,
        top: box.y + dy,
        width: box.w,
        height: box.h,
        opacity: op,
        transform: `rotate(${ang}deg) scale(${sc})`,
        borderRadius: skin.radius + fw,
        background: f?.color,
        padding: f ? f.width : 0,
        boxShadow: skin.shadow,
        clipPath: clip,
        filter: sx > 0.35 || sy > 0.35 ? `blur(${Math.max(sx, sy).toFixed(1)}px)` : undefined,
      }}
    >
        <div style={{ width: "100%", height: "100%", borderRadius: skin.radius + (f?.inner?.width ?? 0), background: f?.inner?.color, padding: f?.inner?.width ?? 0 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: skin.radius, overflow: "hidden" }}>
            <Img
              src={photoSrc(photo)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: fitMode,
                objectPosition: fitMode === "contain" ? "50% 50%" : fit.objectPosition,
                transform: `scale(${z}) translate(${pan[0]}%, ${pan[1]}%)`,
                transformOrigin: fitMode === "contain" ? "50% 50%" : fit.transformOrigin,
                background: fitMode === "contain" ? "transparent" : undefined,
              }}
            />
        </div>
      </div>
    </div>
  );
};

/** Camera move: zoom and pan (in % of the photo) at progress p. */
function camera(move: Move, kb: number, p: number): { z: number; pan: [number, number] } {
  const e = eIo3(p);
  switch (move) {
    case "in":
      return { z: 1 + kb * e, pan: [0, 0] };
    case "out":
      return { z: 1 + kb * (1 - e), pan: [0, 0] };
    case "panL":
      return { z: 1 + kb, pan: [lerp(kb * 30, -kb * 30, e), 0] };
    case "panR":
      return { z: 1 + kb, pan: [lerp(-kb * 30, kb * 30, e), 0] };
    case "rise":
      return { z: 1 + kb, pan: [0, lerp(kb * 25, -kb * 25, e)] };
  }
}

const isBlindLandscape = (id: string) => {
  const p = getPhoto(id);
  return p.orientation === "landscape" && !p.faces?.length;
};

const aspectOf = (id: string) => {
  const p = getPhoto(id);
  return p.width / p.height;
};

const BlurFill: React.FC<{ id: string }> = ({ id }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={photoSrc(getPhoto(id))} style={{ position: "absolute", inset: -80, width: width + 160, height: height + 160, objectFit: "cover", filter: "blur(46px) brightness(0.62) saturate(1.1)" }} />
    </AbsoluteFill>
  );
};

/** One gallery shot, drawn with the template's skin. Times are design seconds. */
export const GalleryShot: React.FC<{ shot: Shot; skin: GallerySkin; caption?: [string, string] }> = ({ shot: planned, skin, caption }) => {
  const t = useT();
  const hs = useHalfShutter();
  const { width: W, height: H } = useVideoConfig();
  // A landscape photo without known faces cannot fill a portrait frame safely (the crop may cut the
  // couple out); it is shown whole, inset on its blurred copy, instead.
  const shot = planned.kind === "full" && H > W && !skin.frameFull && isBlindLandscape(planned.ids[0]) ? { ...planned, kind: "inset" as const } : planned;
  const dur = shot.to - shot.from;
  const kb = skin.kb ?? 0.06;
  const cam = camera(shot.move, kb, ramp(t, shot.from - 0.5, shot.to + 0.5));
  const enters = Array.isArray(skin.enter) ? skin.enter : skin.enter ? [skin.enter] : null;
  const enter: Enter = enters ? enters[shot.index % enters.length] : shot.enter;
  const marginY = skin.marginY ?? skin.margin;

  const fullBleed = shot.kind === "full" && !skin.frameFull;
  const boxes = fullBleed
    ? [{ x: 0, y: 0, w: W, h: H }]
    : shot.kind === "solo" && skin.soloBox
      ? [skin.soloBox(shot)]
      : layoutBoxes(
          shot.kind,
          shot.ids.length,
          skin.margin,
          skin.gap,
          W,
          H,
          marginY,
          shot.flip,
          aspectOf(shot.ids[0]),
          skin.pairAspect ?? 0.9,
          skin.trioAspect ?? 0.72,
          skin.heroPortraitAspect ?? 0.72,
        );
  const blurFill = (shot.kind === "solo" || shot.kind === "inset") && (skin.soloFill ?? "blur") === "blur";
  const cap = caption && shot.first && skin.caption ? captionArea(shot, boxes, skin.margin, W, H) : null;

  // order photos enter in: alternate left→right and right→left
  const order = (k: number) => (shot.index % 2 ? shot.ids.length - 1 - k : k);
  return (
    <AbsoluteFill>
      {fullBleed && !skin.fit ? null : blurFill ? <BlurFill id={shot.ids[0]} /> : skin.background(shot)}
      {shot.ids.map((id, k) => {
        const box = boxes[k] ?? boxes[0];
        // photos settle in *during* the incoming transition (one combined motion on the beat,
        // not a transition followed by a separate entrance)
        const t0 = shot.from - 0.45 + order(k) * Math.min(0.12, dur * 0.035);
        const q = (tt: number) => eOut3(ramp(tt, t0, t0 + 0.8));
        const p = q(t);
        const pos = (tt: number): [number, number] => {
          if (fullBleed) return [0, 0];
          const r = 1 - q(tt);
          if (enter === "rise") return [0, 70 * r];
          if (enter === "slide") return [((k + shot.index) % 2 ? 1 : -1) * 140 * r, 0];
          return [0, 0];
        };
        const [dx, dy] = pos(t);
        const sc = enter === "pop" && !fullBleed ? lerp(1.07, 1, p) : 1;
        const op = fullBleed || enter === "reveal" ? 1 : Math.min(1, p * 1.6);
        const ratio = aspectOf(id);
        const boxRatio = box.w / box.h;
        const mismatch = Math.abs(Math.log(ratio / boxRatio));
        const fitMode: "cover" | "contain" = skin.fit === "contain" || (skin.fit === "smart" && mismatch > 0.12) ? "contain" : "cover";
        // Cover-fit already fills the card. Avoid an extra full-bleed push when the selected
        // fit mode explicitly controls framing, since it can crop the subject's hairline.
        const z = fullBleed ? cam.z + (fitMode === "contain" || skin.fit === "cover" ? 0 : 0.04) : cam.z;
        const fitZoom = fitMode === "contain" ? 1 + (z - 1) * 0.25 : z;
        const clip =
          enter === "reveal" && !fullBleed && p < 1
            ? shot.index % 2
              ? `inset(0 0 0 ${(1 - p) * 100}%)`
              : `inset(0 ${(1 - p) * 100}% 0 0)`
            : undefined;
        const ang = skin.tilt && !fullBleed ? ((k + shot.index) % 2 ? 1 : -1) * skin.tilt * (0.6 + (0.4 * ((shot.index + k) % 3)) / 2) : 0;
        return (
          <React.Fragment key={id}>
            <PhotoInBox
              id={id}
              box={box}
              skin={fullBleed ? { ...skin, frame: undefined, radius: 0, shadow: undefined } : skin}
              z={fitZoom}
              pan={cam.pan}
              dx={dx}
              dy={dy}
              op={op}
              ang={ang}
              sc={sc}
              clip={clip}
              mv={travel(pos, t, hs)}
              fitMode={fitMode}
            />
            {fullBleed ? null : skin.decorate?.({ id, box: { ...box, x: box.x + dx, y: box.y + dy }, k, shot, t })}
          </React.Fragment>
        );
      })}
      {skin.overlay?.({ shot, t })}
      {skin.filler?.({ shot, t, boxes, caption: shot.first ? caption : undefined })}
      {cap && caption ? skin.caption?.({ shot, title: caption[0], line: caption[1], t, area: cap.area, overPhoto: cap.overPhoto }) : null}
    </AbsoluteFill>
  );
};

export interface TransitionSpec {
  kind: TransitionKind;
  seconds: number;
  /** for push / wipe / cover: rotate through these directions */
  dirs?: Dir[];
}

/**
 * Transition palettes: `within` cycles between shots of the same set (gentle), `between` marks a
 * new set (stronger). A transition is never the same kind+direction as the previous one.
 */
export interface Palette {
  within: TransitionSpec[];
  between: TransitionSpec[];
}

/** Captions per set: "title｜line" strings keyed `set_<id>` (from the template's editable copy). */
export const setCaption = (copy: Record<string, string> | undefined, set: string): [string, string] | undefined => {
  const v = copy?.[`set_${set}`];
  if (!v || !v.trim()) return undefined;
  const [title, line = ""] = v.split("｜");
  const out: [string, string] = [title.trim(), line.trim()];
  return out[0] || out[1] ? out : undefined;
};

/**
 * Caption of a shot's set: the editable set_<id> copy; for the first run of photos without a set tag
 * (an untagged project import groups them all as one set) the template's fallback caption, if any.
 * Shots without either get no caption, never an empty caption box.
 */
function shotCaption(shot: Shot, copy: Record<string, string> | undefined, fallback: [string, string] | undefined, firstUntagged: number) {
  return setCaption(copy, shot.set) ?? (fallback && shot.index === firstUntagged ? fallback : undefined);
}

/**
 * Film segments + transitions for a gallery; transitions are centered on the shot boundary (the
 * beat). Captions come from `copy` (set_<id> keys).
 */
export function gallerySegments(
  shots: Shot[],
  skin: GallerySkin,
  palette: Palette | ((prev: Shot, next: Shot) => { kind: TransitionKind; seconds: number; dir?: Dir }),
  opts: { prefix?: string; copy?: Record<string, string>; fallback?: [string, string] } = {},
): { segments: FilmSegment[]; transitions: FilmTransition[] } {
  const prefix = opts.prefix ?? "g";
  const tr: FilmTransition[] = [];
  const half: number[] = shots.map(() => 0);
  let last = "";
  const counters = { within: 0, between: 0 };
  for (let i = 1; i < shots.length; i++) {
    let c: { kind: TransitionKind; seconds: number; dir?: Dir };
    if (typeof palette === "function") c = palette(shots[i - 1], shots[i]);
    else {
      const group = shots[i].set !== shots[i - 1].set ? "between" : "within";
      const list = palette[group];
      let pick: { kind: TransitionKind; seconds: number; dir?: Dir } | null = null;
      for (let tries = 0; tries < list.length * 4 && !pick; tries++) {
        const spec = list[counters[group] % list.length];
        const dir = spec.dirs ? spec.dirs[Math.floor(counters[group] / list.length) % spec.dirs.length] : undefined;
        counters[group]++;
        const key = `${spec.kind}:${dir ?? ""}`;
        if (key !== last || list.length === 1) pick = { kind: spec.kind, seconds: spec.seconds, dir };
      }
      c = pick ?? { kind: list[0].kind, seconds: list[0].seconds };
    }
    last = `${c.kind}:${c.dir ?? ""}`;
    const b = shots[i].from;
    const h = c.seconds / 2;
    half[i] = h;
    const base = { from: b - h, to: b + h, a: `${prefix}${i - 1}`, b: `${prefix}${i}` };
    const dir = c.dir ?? "left";
    tr.push(
      c.kind === "push"
        ? { ...base, kind: "push", dir, shutter: 0.8 }
        : c.kind === "wipe" || c.kind === "cover"
          ? { ...base, kind: c.kind, dir }
          : ({ ...base, kind: c.kind } as FilmTransition),
    );
  }
  const firstUntagged = shots.find((s) => !setCaption(opts.copy, s.set) && s.ids.every((id) => !getPhoto(id).set))?.index ?? -1;
  const segments = shots.map((shot, i) => ({
    id: `${prefix}${i}`,
    from: shot.from - (half[i] || 0),
    to: shot.to + (half[i + 1] || 0),
    render: () => <GalleryShot shot={shot} skin={skin} caption={shotCaption(shot, opts.copy, opts.fallback, firstUntagged)} />,
  }));
  return { segments, transitions: tr };
}

/** A default restrained caption: small title + one line, fades in after the shot lands, out before it ends. */
export const SetCaptionText: React.FC<{
  args: CaptionArgs;
  titleFont: string;
  lineFont: string;
  color: string;
  sub: string;
  titleSize?: number;
  lineSize?: number;
  accent?: string;
}> = ({ args, titleFont, lineFont, color, sub, titleSize = 64, lineSize = 38, accent }) => {
  const { shot, title, line, t, area, overPhoto } = args;
  const e = eOut3(ramp(t, shot.from + 0.5, shot.from + 1.3)) * (1 - eIo3(ramp(t, shot.to - 0.9, shot.to - 0.2)));
  if (e <= 0.002) return null;
  const sh = overPhoto ? "0 2px 14px rgba(0,0,0,0.55)" : undefined;
  return (
    <>
      {overPhoto ? (
        <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.18) 26%, rgba(0,0,0,0) 42%)", opacity: e }} />
      ) : null}
      <div style={{ position: "absolute", left: area.x, top: area.y, width: area.w, height: area.h, display: "flex", flexDirection: "column", justifyContent: "flex-end", opacity: e, transform: `translateY(${14 * (1 - e)}px)` }}>
        {accent ? <div style={{ width: 64, height: 4, background: accent, marginBottom: 22 }} /> : null}
        <div style={{ fontFamily: titleFont, fontSize: titleSize, color, letterSpacing: titleSize * 0.18, textShadow: sh, lineHeight: 1.2 }}>{title}</div>
        {line ? <div style={{ fontFamily: lineFont, fontSize: lineSize, color: sub, letterSpacing: 4, marginTop: 14, textShadow: sh, lineHeight: 1.35 }}>{line}</div> : null}
      </div>
    </>
  );
};
