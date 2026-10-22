import React, { type CSSProperties } from "react";
import { Photo, type Rect } from "../../components/Photo";
import { Text, type Anchor } from "../../components/Text";
import { fadeRise, lerp } from "../../core/ease";
import type { FontKey } from "../../core/fonts";
import { textWidth } from "../../core/text-fit";

/**
 * Shared drawing kit for templates on the Film engine: Python-engine style shorthands
 * (T = draw_text, Pic = draw_photo) plus common pieces (quote block, print card, bezier).
 */

/** Palette of the XY-01 Python film (legacy-xy01-engine/film.py). */
export const C = {
  dark: "#2B2B2B",
  grey: "#737373",
  lgrey: "#B8B8B8",
  gold: "#BD945C",
  qgold: "#DEA13D",
  white: "#FFFFFF",
  seal: "#B8211C",
  bg: "#FCFBF8",
  warm: "#F6F3EF",
};
export const RADIUS = 22;
export const SHADOW_SOFT = "0 2px 5px rgba(0,0,0,0.30)";

/** Python font keys → OFL web fonts and weights. */
const F = {
  songB: ["songti", 700],
  songR: ["songti", 400],
  avHeavy: ["avenir", 800],
  avDemi: ["avenir", 600],
  avMed: ["avenir", 500],
  avReg: ["avenir", 400],
  didot: ["display", 400],
  bodoni: ["bodoni", 500],
  bodoniB: ["bodoni", 800],
  futura: ["condensed", 800],
  savoye: ["scriptThin", 400],
  xingkai: ["running", 400],
  baskI: ["baskervilleItalic", 400],
  xiaowei: ["xiaowei", 400],
  brush: ["brush", 400],
  hand: ["hand", 400],
  kuaile: ["kuaile", 400],
  hei: ["heiti", 400],
  heiB: ["heiti", 700],
  serif: ["serif", 500],
  serifI: ["serifItalic", 500],
  caveat: ["caveat", 600],
  lora: ["lora", 500],
  loraI: ["loraItalic", 400],
} as const satisfies Record<string, readonly [FontKey, number]>;
export type Face = keyof typeof F;
/** Font key and weight behind a kit face, for core/text-fit. */
export const faceOf = (f: Face): { font: FontKey; weight: number } => ({ font: F[f][0], weight: F[f][1] });

/** draw_text / draw_sprite equivalent. */
export const T: React.FC<{
  s: string;
  f: Face;
  size: number;
  x?: number;
  y?: number;
  c?: string;
  a?: Anchor;
  tr?: number;
  op?: number;
  wipe?: number;
  wdir?: "lr" | "tb";
  wsoft?: number;
  blur?: number;
  vertical?: boolean;
  sideways?: boolean;
  shadow?: boolean | string;
  sc?: number;
  /** fit into this width (design px); see Text.maxWidth */
  maxW?: number;
  /** with maxW: allow one line break before shrinking far */
  wrap?: boolean;
  style?: CSSProperties;
}> = ({ s, f, size, x, y, c = C.dark, a = "lt", tr = 0, op, wipe, wdir, wsoft, blur, vertical, sideways, shadow, sc, maxW, wrap, style }) => (
  <Text
    font={F[f][0]}
    weight={F[f][1]}
    size={size}
    x={x}
    y={y}
    color={c}
    anchor={a}
    tracking={tr}
    opacity={op}
    wipe={wipe}
    wipeDir={wdir}
    wipeSoft={wsoft}
    blur={blur}
    vertical={vertical}
    sideways={sideways}
    shadow={shadow}
    scale={sc}
    lineHeight={1}
    maxWidth={maxW}
    wrap={wrap}
    style={style}
  >
    {s}
  </Text>
);

/** draw_photo equivalent: box by center, zoom, focus, clip window, inner offset, rotation, motion blur. */
export const Pic: React.FC<{
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  z?: number;
  fx?: number;
  fy?: number;
  op?: number;
  clip?: Rect;
  off?: [number, number];
  ang?: number;
  r?: number;
  mv?: [number, number];
  style?: CSSProperties;
}> = ({ id, cx, cy, w, h, z = 1, fx, fy, op, clip, off, ang, r = RADIUS, mv, style }) => (
  <Photo
    id={id}
    cx={cx}
    cy={cy}
    w={w}
    h={h}
    zoom={z}
    focus={fx !== undefined || fy !== undefined ? [fx ?? 0.5, fy ?? 0.4] : undefined}
    opacity={op}
    clip={clip}
    offset={off}
    angle={ang}
    radius={r}
    motion={mv}
    style={style}
  />
);

/** Full-bleed photo. */
export const Bleed: React.FC<{ id: string; z: number; fx?: number; fy?: number }> = ({ id, z, fx, fy }) => (
  <Pic id={id} cx={960} cy={540} w={1920} h={1080} z={z} fx={fx} fy={fy} r={0} />
);

/** Gold condensed quote with Chinese line and optional sub line, left-aligned, block centered on xc. */
export const Quote: React.FC<{ t: number; lines: string[]; xc: number; t0: number; cn: string; sub?: string; step?: number; maxW?: number }> = ({
  t,
  lines,
  xc,
  t0,
  cn,
  sub,
  step = 0.14,
  maxW,
}) => {
  const QL = 60;
  const top = 540 - (lines.length * QL + 70) / 2;
  const [ce, cdy] = fadeRise(t, t0 + 0.75, t0 + 1.35);
  const [se, sdy] = fadeRise(t, t0 + 0.95, t0 + 1.55);
  return (
    <div
      style={{
        position: "absolute",
        left: xc,
        top,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      {lines.map((ln, k) => {
        const [e, dy] = fadeRise(t, t0 + step * k, t0 + 0.7 + step * k, 22);
        return (
          <div key={k} style={{ height: QL, opacity: e, transform: `translateY(${dy}px)` }}>
            <T s={ln} f="futura" size={52} c={C.qgold} tr={1.5} />
          </div>
        );
      })}
      <div style={{ marginTop: 20, marginLeft: 2, opacity: ce, transform: `translateY(${cdy}px)` }}>
        <T s={cn} f="songR" size={34} c={C.grey} tr={4} maxW={maxW} />
      </div>
      {sub ? (
        <div style={{ marginTop: 22, marginLeft: 2, opacity: se, transform: `translateY(${sdy}px)` }}>
          <T s={sub} f="songR" size={30} c={C.grey} tr={4} maxW={maxW} wrap style={{ lineHeight: 1.25 }} />
        </div>
      ) : null}
    </div>
  );
};

/** "THE BRIDE | 许知夏" caption row centered on cx; the name shrinks to fit `maxW` (row width) when long. */
export const LabelRow: React.FC<{ cx: number; y: number; en: string; cn: string; op: number; maxW?: number }> = ({ cx, y, en, cn, op, maxW = 880 }) => (
  <div
    style={{
      position: "absolute",
      left: cx,
      top: y,
      transform: "translate(-50%, -50%)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity: op,
    }}
  >
    <T s={en} f="avDemi" size={32} c={C.grey} tr={5} />
    <div style={{ width: 1.6, height: 30, background: C.grey, opacity: 0.7 }} />
    <T s={cn} f="songB" size={42} c={C.dark} tr={8} maxW={maxW - textWidth(en, "avenir", 32, { weight: 600, tracking: 5 }) * 1.04 - 30} />
  </div>
);

/** Bezier through control points (de Casteljau). */
export const bez =
  (pts: [number, number][]) =>
  (s: number): [number, number] => {
    let p = pts;
    while (p.length > 1) p = p.slice(1).map((b, i): [number, number] => [lerp(p[i][0], b[0], s), lerp(p[i][1], b[1], s)]);
    return p[0];
  };

/** Photo as a printed card: white border, rounded corners, soft drop shadow. */
export const Card: React.FC<{
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  border?: number;
  z?: number;
  fx?: number;
  fy?: number;
  op?: number;
  ang?: number;
  sc?: number;
  mv?: [number, number];
  paper?: string;
}> = ({ id, cx, cy, w, h, border = 12, z = 1, fx, fy, op = 1, ang = 0, sc = 1, mv, paper = "#FFFFFF" }) => {
  if (op <= 0.002) return null;
  const W = w + 2 * border;
  const H = h + 2 * border;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - W / 2,
        top: cy - H / 2,
        width: W,
        height: H,
        opacity: op,
        transform: `rotate(${ang}deg) scale(${sc})`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: paper, borderRadius: 16, boxShadow: "0 16px 38px rgba(60,40,20,0.18), 0 3px 10px rgba(60,40,20,0.10)" }} />
      <Pic id={id} cx={W / 2} cy={H / 2} w={w} h={h} z={z} fx={fx} fy={fy} r={10} mv={mv} />
    </div>
  );
};

/** Fit an aspect ratio into a box. */
export const fit = (aspect: number, maxW: number, maxH: number): [number, number] =>
  aspect > maxW / maxH ? [maxW, maxW / aspect] : [maxH * aspect, maxH];

export { Art } from "../../components/Art";

/** Damped pendulum angle (degrees) for things that drop in and swing. */
export const swing = (t: number, t0: number, amp = 10, damp = 2.2, freq = 8) =>
  t < t0 ? 0 : amp * Math.exp(-damp * (t - t0)) * Math.sin(freq * (t - t0));
