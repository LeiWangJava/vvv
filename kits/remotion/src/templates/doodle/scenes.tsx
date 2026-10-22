import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import sizes from "../../../public/assets/xy62/sizes.json";
import { useDirectionalBlur } from "../../components/Photo";
import { coverStyle } from "../../core/crop";
import { eBack, eIn3, eIo3, eOut3, eOut5, ramp } from "../../core/ease";
import { getPhoto, photoSrc } from "../../core/manifest";
import { useT } from "../../core/time";
import { useHalfShutter } from "../../engine/Film";
import { fitText, textWidth } from "../../core/text-fit";
import { Art, faceOf, T, type Face } from "../shared/kit";

/**
 * XY-62 白纸手绘 · 我们结婚啦 — a quiet sheet of white watercolor paper and black marker doodles:
 * a pink watercolor heart blooms behind "We're married!", a little couple dances in, a record player
 * card rolls past, two doodle avatars introduce the groom and the bride, then the wedding photos
 * glide across the paper page by page with small English titles and doodle icons, and the couple
 * bows at the end: "THANK YOU FOR COMING".
 *
 * The paper never moves. Each scene's content glides in from the right and out to the left
 * (one continuous eased move over two beats, with motion blur), so there are no cuts, no black
 * frames and no blend-mode surprises between scenes.
 *
 * Beat grid of the default song (Dance with Me, 85 BPM).
 */

export const BPM = 85;
export const B0 = 0.504;
export const B = (n: number) => B0 + (n * 60) / BPM;
/** n beats as a duration */
export const Bt = (n: number) => (n * 60) / BPM;

export const INK = "#1E1E1E";
export const SOFT = "#7A7772";
const A = (name: string) => `assets/xy62/${name}`;
const SIZE = sizes as Record<string, number[]>;

export interface Ctx {
  ph: {
    thumb: string;
    groomSolo: string;
    brideSolo: string;
    poem: string[];
    camera: string;
    forever: string[];
    loveBig: string;
    loveSmall: string;
    soul: string[];
    oneLove: string[];
    ever: string[];
    us: string;
  };
  groom: string;
  bride: string;
  date: string;
  copy: Record<string, string>;
}

const lines = (s: string) => s.split("｜").map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------- page motion

/** a scene travels this far (px) to be fully off the frame */
const TRAVEL = 2150;
/** Horizontal offset of a scene: glides in from the right over the two beats before `inAt`, out to the left over the two beats before `outAt`. */
export const slideX = (t: number, inAt?: number, outAt?: number) =>
  (inAt === undefined ? 0 : (1 - eIo3(ramp(t, inAt - Bt(2), inAt))) * TRAVEL) - (outAt === undefined ? 0 : eIo3(ramp(t, outAt - Bt(2), outAt)) * TRAVEL);

/** Everything in a scene rides on this: one rigid, eased move with horizontal motion blur. */
export const Slide: React.FC<{ inAt?: number; outAt?: number; children: React.ReactNode }> = ({ inAt, outAt, children }) => {
  const t = useT();
  const hs = useHalfShutter();
  const x = slideX(t, inAt, outAt);
  const blur = useDirectionalBlur([slideX(t + hs, inAt, outAt) - slideX(t - hs, inAt, outAt), 0]);
  if (Math.abs(x) >= TRAVEL - 1) return null;
  return (
    <AbsoluteFill style={{ transform: x ? `translateX(${x}px)` : undefined, filter: blur.filter }}>
      {children}
      {blur.defs}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the paper and the pieces on it

/** The white watercolor paper, never moving. */
export const Paper: React.FC = () => (
  <AbsoluteFill>
    <Img src={staticFile(A("paper.jpg"))} style={{ position: "absolute", width: 1920, height: 1080 }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%, rgba(120,115,105,0.10) 100%)" }} />
  </AbsoluteFill>
);

/** Width of a doodle drawn `h` px tall (the assets are trimmed to their ink, see sizes.json). */
const widthAt = (src: string, h: number) => (h * SIZE[src][0]) / SIZE[src][1];

/** A doodle sticker `h` px tall, centred on (cx, cy); pops in on t0 with a little overshoot. */
export const Doodle: React.FC<{ src: string; cx: number; cy: number; h: number; t0: number; rot?: number; op?: number }> = ({ src, cx, cy, h, t0, rot = 0, op = 1 }) => {
  const t = useT();
  const p = eBack(ramp(t, t0, t0 + Bt(1)), 1.8);
  const o = op * eOut3(ramp(t, t0, t0 + 0.25));
  if (o <= 0.002) return null;
  return <Art src={A(src)} cx={cx} cy={cy} w={widthAt(src, h)} h={h} rot={rot} sc={0.4 + 0.6 * p} op={o} />;
};

/** Text that comes into focus (blur → sharp, a small rise) over one beat. */
export const Focus: React.FC<{ s: string; f: Face; size: number; x: number; y: number; t0: number; c?: string; a?: "lt" | "ct" | "cm" | "lm" | "rt"; tr?: number }> = ({
  s,
  f,
  size,
  x,
  y,
  t0,
  c = INK,
  a = "lt",
  tr = 1,
}) => {
  const t = useT();
  const p = eOut3(ramp(t, t0, t0 + Bt(1)));
  if (p <= 0.002) return null;
  return <T s={s} f={f} size={size} tr={tr} c={c} x={x} y={y + 10 * (1 - p)} a={a} op={p} blur={10 * (1 - p)} />;
};

/**
 * A flat photo on the paper. Once it has landed the print floats a little (a slow bob and tilt, its
 * phase seeded by the photo ID) so a page never holds perfectly still; inside the frame the picture
 * has a slow push with a sideways drift (direction alternates by photo).
 */
export const Print: React.FC<{ id: string; x: number; y: number; w: number; h: number; S: number; target?: [number, number] }> = ({ id, x, y, w, h, S, target }) => {
  const t = useT();
  const photo = getPhoto(id);
  const p = ramp(t, S - Bt(2), S + Bt(18));
  const side = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 2 ? 1 : -1;
  const z = 1.04 + 0.16 * p;
  const pan = side * 3.2 * (p - 0.5);
  const seed = [...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 628;
  const ph = ((t - S) / Bt(6)) * Math.PI * 2 + seed / 100;
  const bob = 7 * Math.sin(ph);
  const tilt = 0.7 * Math.sin(ph * 0.5 + 1.3) * side;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden", boxShadow: "0 6px 18px rgba(40,35,30,0.10)",
      transform: `translateY(${bob}px) rotate(${tilt}deg)` }}>
      <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", ...coverStyle(photo, w, h, target), transform: `scale(${z}) translateX(${pan}%)` }} />
    </div>
  );
};

// ---------------------------------------------------------------- 1 · "We're married!"
export const Intro: React.FC<{ c: Ctx; outAt: number }> = ({ c, outAt }) => {
  const t = useT();
  const heart = eOut3(ramp(t, B(0.3), B(2.6)));
  const write = eIo3(ramp(t, B(1.2), B(3.4)));
  const walk = eOut3(ramp(t, B(4), B(5.5)));
  const bob = t > B(5) ? Math.abs(Math.sin(((t - B(5)) * Math.PI * BPM) / 60)) * 14 : 0;
  const mask = `linear-gradient(to right, #000 ${write * 120 - 20}%, transparent ${write * 120}%)`;
  const TW = 640;
  const TH = (TW * SIZE["married_text.png"][1]) / SIZE["married_text.png"][0];
  const HW = 600;
  const HH = (HW * SIZE["pink_heart.png"][1]) / SIZE["pink_heart.png"][0];
  return (
    <Slide outAt={outAt}>
      <Art src={A("pink_heart.png")} cx={960} cy={335} w={HW} h={HH} sc={0.55 + 0.45 * heart} op={0.9 * heart} style={{ filter: `blur(${(1 - heart) * 20}px)` }} />
      <div style={{ position: "absolute", left: 960 - TW / 2, top: 330 - TH / 2, width: TW, height: TH, WebkitMaskImage: mask, maskImage: mask }}>
        <Img src={staticFile(A("married_text.png"))} style={{ width: TW, height: TH }} />
      </div>
      {/* sparkles and hearts in the free space around the title (it spans x 640–1280, y 170–490) */}
      <Doodle src="star_a.png" cx={555} cy={215} h={88} t0={B(3)} rot={-8} />
      <Doodle src="pop_l.png" cx={545} cy={395} h={86} t0={B(4)} />
      <Doodle src="heart_b.png" cx={605} cy={510} h={62} t0={B(5)} rot={-12} />
      <Doodle src="heart_a.png" cx={1370} cy={165} h={72} t0={B(3)} rot={10} />
      <Doodle src="star_b.png" cx={1395} cy={305} h={78} t0={B(4)} rot={6} />
      <Doodle src="pop_r.png" cx={1370} cy={455} h={82} t0={B(5)} />
      <Doodle src="star_c.png" cx={960} cy={540} h={50} t0={B(6)} />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - walk) * 260 - bob}px)`, opacity: walk }}>
        <Art src={A("couple_dance.png")} cx={960} cy={775} w={widthAt("couple_dance.png", 400)} h={400} />
      </div>
      <Doodle src="tulips.png" cx={640} cy={890} h={150} t0={B(6)} rot={-4} />
      <Doodle src="tulips.png" cx={1280} cy={890} h={150} t0={B(6)} rot={4} />
      <Focus s={c.copy.intro_line} f="songR" size={38} tr={10} c={SOFT} x={960} y={1010} a="cm" t0={B(7)} />
    </Slide>
  );
};

// ---------------------------------------------------------------- 2 · the record player card (the disc rolls in like a wheel)
const DISC = 330;

/** The tonearm, drawn to match the doodles: a pivot outside the disc, the arm resting near the label. */
const Tonearm: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <svg width={220} height={240} viewBox="0 0 220 240" style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
    <path d="M170 38 C 176 92, 150 132, 96 168" fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round" />
    <circle cx={170} cy={38} r={30} fill="#FFFFFF" stroke={INK} strokeWidth={10} />
    <circle cx={170} cy={38} r={9} fill={INK} />
    <rect x={62} y={154} width={50} height={34} rx={6} fill="#FFFFFF" stroke={INK} strokeWidth={10} transform="rotate(-36 87 171)" />
  </svg>
);

export const Player: React.FC<{ c: Ctx; inAt: number; outAt: number }> = ({ c, inAt, outAt }) => {
  const t = useT();
  const photo = getPhoto(c.ph.thumb);
  const songSubSize = c.copy.song_sub.length > 18 ? 16 : 22;
  const songSubTracking = c.copy.song_sub.length > 18 ? 1 : 2;
  // rolling: the disc turns by its travel / radius, plus a gentle spin while it plays
  const spin = ((slideX(t, inAt, outAt) / (DISC / 2)) * 180) / Math.PI + (t - inAt) * 120;
  // While it plays, the card hops on every beat and the tonearm rocks with it.
  const beat = (t - B0) / Bt(1);
  const hop = t > inAt ? Math.exp(-(beat - Math.floor(beat)) * 5) : 0;
  const rock = (Math.floor(beat) % 2 === 0 ? 1 : -1) * 3 * hop;
  return (
    <Slide inAt={inAt} outAt={outAt}>
      <div style={{ position: "absolute", left: 830, top: 440, width: 660, height: 210, border: `4px solid ${INK}`, borderRadius: 10, background: "rgba(255,255,255,0.6)",
        transform: `translateY(${-10 * hop}px) rotate(${2 + rock * 0.4}deg) scale(${1 + 0.03 * hop})` }}>
        {/* Keep the full names and song title together in the card's open text area. */}
        <T s={c.copy.song_title} f="songB" size={34} tr={3} c={INK} x={230} y={48} a="ct" />
        <T s={c.copy.song_sub} f="songR" size={songSubSize} tr={songSubTracking} c={SOFT} x={230} y={112} a="ct" />
        <div style={{ position: "absolute", right: 22, top: 22, width: 160, height: 160, overflow: "hidden", border: `3px solid ${INK}` }}>
          <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", ...coverStyle(photo, 160, 160) }} />
        </div>
      </div>
      <Art src={A("vinyl_disc.png")} cx={720} cy={545} w={DISC} h={DISC} rot={spin} />
      <div style={{ position: "absolute", inset: 0, transformOrigin: "890px 368px", transform: `rotate(${rock}deg)` }}>
        <Tonearm x={720} y={330} />
      </div>
    </Slide>
  );
};

// ---------------------------------------------------------------- element choreography

type Box = { x: number; y: number; w: number; h: number };
/** How an element comes in. Photos: slide from a side, wipe open, rise, drop, zoom. Text: type, focus. Icons: pop, drop. */
export type Enter = "fromLeft" | "fromRight" | "rise" | "drop" | "wipeRight" | "wipeLeft" | "wipeUp" | "wipeDown" | "zoom" | "focus" | "type" | "pop" | "bounce";
/** How it leaves. */
export type Exit = "toLeft" | "toRight" | "sink" | "lift" | "wipeRight" | "wipeLeft" | "wipeUp" | "wipeDown" | "fade" | "shrink" | "dissolve";

/**
 * One element of a page with its own entrance (starting at `at`) and exit (starting at `out`).
 * Positions are page coordinates; `box` is the element's extent, used for wipes and as the pivot
 * for scaling. Entrances decelerate into place, exits accelerate away; everything is beat-timed.
 */
export const Anim: React.FC<{ box: Box; at: number; out?: number; enter: Enter; exit?: Exit; dur?: number; outDur?: number; dist?: number; children: React.ReactNode }> = ({
  box,
  at,
  out,
  enter,
  exit = "fade",
  dur = Bt(1.5),
  outDur = Bt(1),
  dist = 140,
  children,
}) => {
  const t = useT();
  if (t < at) return null;
  if (out !== undefined && t >= out + outDur) return null;
  const pi = ramp(t, at, at + dur);
  const po = out === undefined ? 0 : ramp(t, out, out + outDur);
  let dx = 0;
  let dy = 0;
  let sc = 1;
  let op = 1;
  let blur = 0;
  // fractions of the box hidden from each side: top, right, bottom, left
  const clip = [0, 0, 0, 0];
  let soft = 0;

  const e = eOut3(pi);
  switch (enter) {
    case "fromLeft":
    case "fromRight":
      dx += (enter === "fromLeft" ? -1 : 1) * dist * (1 - eOut5(pi));
      op *= eOut3(ramp(t, at, at + dur * 0.6));
      break;
    case "rise":
    case "drop":
      dy += (enter === "rise" ? 1 : -1) * dist * (1 - eOut5(pi));
      op *= eOut3(ramp(t, at, at + dur * 0.6));
      break;
    case "wipeRight":
      clip[1] = 1 - eOut3(pi);
      sc *= 1.06 - 0.06 * e;
      break;
    case "wipeLeft":
      clip[3] = 1 - eOut3(pi);
      sc *= 1.06 - 0.06 * e;
      break;
    case "wipeUp":
      clip[0] = 1 - eOut3(pi);
      sc *= 1.06 - 0.06 * e;
      break;
    case "wipeDown":
      clip[2] = 1 - eOut3(pi);
      sc *= 1.06 - 0.06 * e;
      break;
    case "zoom":
      sc *= 0.86 + 0.14 * eOut5(pi);
      op *= eOut3(ramp(t, at, at + dur * 0.5));
      break;
    case "focus":
      blur += 12 * (1 - e);
      dy += 12 * (1 - e);
      op *= e;
      break;
    case "type":
      clip[1] = 1 - pi;
      soft = 0.15;
      break;
    case "pop":
      sc *= 0.3 + 0.7 * eBack(pi, 1.8);
      op *= eOut3(ramp(t, at, at + dur * 0.3));
      break;
    case "bounce": {
      // falls in and bounces twice
      const b = Math.abs(Math.cos(pi * Math.PI * 2.5)) * (1 - pi) ** 2;
      dy -= 160 * (pi < 0.2 ? 1 - pi / 0.2 : 0) + 60 * (pi >= 0.2 ? b : 0);
      op *= eOut3(ramp(t, at, at + dur * 0.2));
      break;
    }
  }

  // Exits accelerate into the next beat, so the biggest change of an exit lands on a beat; entrances
  // decelerate from theirs. (In-out easing would put the peak between two beats.)
  const q = eIn3(po);
  switch (exit) {
    case "toLeft":
    case "toRight":
      dx += (exit === "toLeft" ? -1 : 1) * dist * 1.4 * q;
      op *= 1 - q;
      break;
    case "sink":
    case "lift":
      dy += (exit === "sink" ? 1 : -1) * dist * q;
      op *= 1 - q;
      break;
    case "wipeRight":
      clip[3] = Math.max(clip[3], q);
      break;
    case "wipeLeft":
      clip[1] = Math.max(clip[1], q);
      break;
    case "wipeUp":
      clip[2] = Math.max(clip[2], q);
      break;
    case "wipeDown":
      clip[0] = Math.max(clip[0], q);
      break;
    case "shrink":
      sc *= 1 - 0.7 * q;
      op *= 1 - q;
      break;
    case "dissolve":
      sc *= 1 + 0.05 * q;
      op *= 1 - q;
      blur += 6 * po;
      break;
    case "fade":
      op *= 1 - q;
      blur += 8 * po;
      dy -= 10 * eOut3(po);
      break;
  }
  if (op <= 0.002) return null;

  // clip in page coordinates; across the wipe the box keeps a margin for its shadow, along it the clip
  // sits exactly on the box (otherwise a strip of shadow shows before the photo does)
  const vertical = clip[0] > 0 || clip[2] > 0;
  const side = (f: number, start: number, len: number, far: boolean, along: boolean) => {
    const m = along ? 0 : 40;
    return f > 0 ? start + (far ? len * (1 - f) : len * f) : start + (far ? len + m : -m);
  };
  let clipPath: string | undefined;
  let mask: string | undefined;
  if (soft > 0) {
    const edge = box.x + box.w * (1 - clip[1]);
    mask = `linear-gradient(to right, #000 ${edge - box.w * soft}px, transparent ${edge}px)`;
  } else if (clip.some((f) => f > 0)) {
    const top = side(clip[0], box.y, box.h, false, vertical);
    const right = side(clip[1], box.x, box.w, true, !vertical);
    const bottom = side(clip[2], box.y, box.h, true, vertical);
    const left = side(clip[3], box.x, box.w, false, !vertical);
    clipPath = `inset(${top}px ${1920 - right}px ${1080 - bottom}px ${left}px)`;
  }
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${dx}px, ${dy}px) scale(${sc})`,
        transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
        opacity: op,
        filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
        clipPath,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** After it lands, a doodle hops and tilts on every beat, alternating sides, like a hand-drawn sticker. */
const Wiggle: React.FC<{ cx: number; cy: number; children: React.ReactNode }> = ({ cx, cy, children }) => {
  const t = useT();
  const beat = (t - B0) / Bt(1);
  const ph = beat - Math.floor(beat);
  const side = Math.floor(beat) % 2 === 0 ? 1 : -1;
  const hop = Math.exp(-ph * 5);
  return (
    <AbsoluteFill style={{ transformOrigin: `${cx}px ${cy}px`, transform: `translateY(${-12 * hop}px) rotate(${side * 5 * (1 - 0.4 * hop)}deg) scale(${1 + 0.04 * hop})` }}>
      {children}
    </AbsoluteFill>
  );
};

/** A doodle drawn `h` px tall, centred on (cx, cy), with its box for Anim. */
const ink = (src: string, cx: number, cy: number, h: number) => {
  const w = widthAt(src, h);
  return { box: { x: cx - w / 2, y: cy - h / 2, w, h }, el: <Wiggle cx={cx} cy={cy}><Art src={A(src)} cx={cx} cy={cy} w={w} h={h} /></Wiggle> };
};

/** A line of text and its approximate box (for type-on wipes). */
const txt = (s: string, f: Face, size: number, x: number, y: number, a: "lt" | "ct" | "rt" = "lt", c = INK, tr = 1, maxW?: number) => {
  const { font, weight } = faceOf(f);
  // long names and lines shrink (or break once) to fit their column, so neighbours never overlap
  const fit = maxW === undefined ? { text: s, size, tracking: tr, lines: 1 } : fitText(s, font, size, maxW, { weight, tracking: tr, wrap: true });
  const w = Math.max(...fit.text.split("\n").map((l) => textWidth(l, font, fit.size, { weight, tracking: fit.tracking })));
  const x0 = a === "lt" ? x : a === "ct" ? x - w / 2 : x - w;
  return {
    // the type-on mask fades over the last 15% of the box: keep that fade beyond the last glyph
    box: { x: x0 - 8, y: y - 6, w: w * 1.22 + 24, h: fit.size * 1.4 * fit.lines },
    el: <T s={fit.text} f={f} size={fit.size} tr={fit.tracking} c={c} x={x} y={y} a={a} style={fit.lines > 1 ? { lineHeight: 1.18 } : undefined} />,
  };
};

/**
 * Exits leave in three groups: icons, then words, then photos. The photos are gone half a beat after
 * the next page (started a beat early) brings its first element in, so the paper is never bare.
 */
const exits = (E: number) => ({ icon: E - Bt(4), text: E - Bt(3), photo: E - Bt(1.5) });

// ---------------------------------------------------------------- 3 · groom and bride avatars
export const Avatars: React.FC<{ c: Ctx; E: number }> = ({ c, E }) => {
  const g = ink("groom_avatar.png", 700, 440, 330);
  const b = ink("bride_avatar.png", 1220, 440, 330);
  const gl = txt("groom", "caveat", 64, 700, 650, "ct");
  const bl = txt("bride", "caveat", 64, 1220, 650, "ct");
  const gn = txt(c.groom, "songB", 44, 700, 740, "ct", INK, 8, 470);
  const bn = txt(c.bride, "songB", 44, 1220, 740, "ct", INK, 8, 470);
  const o = exits(E);
  return (
    <>
      <Anim box={g.box} at={B(20)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{g.el}</Anim>
      <Anim box={b.box} at={B(21)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{b.el}</Anim>
      <Anim box={gl.box} at={B(22)} out={o.text} enter="type" dur={Bt(1)}>{gl.el}</Anim>
      <Anim box={bl.box} at={B(23)} out={o.text} enter="type" dur={Bt(1)}>{bl.el}</Anim>
      <Anim box={gn.box} at={B(24)} out={o.text} enter="focus" dur={Bt(1)}>{gn.el}</Anim>
      <Anim box={bn.box} at={B(25)} out={o.text} enter="focus" dur={Bt(1)}>{bn.el}</Anim>
    </>
  );
};

// ---------------------------------------------------------------- 4 · photo pages
/** Page n starts on beat PAGE[n] and has left the paper by PAGE[n + 1]. */
export const PAGE = [30, 44, 60, 76, 94, 110, 126, 144, 160, 176];
export type PageProps = { c: Ctx; S: number; E: number };

/** A photo element: its box and the photo with a very slow push-in. */
const pic = (id: string, x: number, y: number, w: number, h: number, S: number, target?: [number, number]) => ({
  box: { x, y, w, h },
  el: <Print id={id} x={x} y={y} w={w} h={h} S={S} target={target} />,
});

/** Groom and bride — photos first (from either side), then sparkles. */
export const PagePair: React.FC<PageProps> = ({ c, S, E }) => {
  const g = pic(c.ph.groomSolo, 330, 130, 615, 820, S, [0.5, 0.3]);
  const b = pic(c.ph.brideSolo, 975, 130, 615, 820, S, [0.5, 0.3]);
  const s1 = ink("star_a.png", 1715, 215, 80);
  const s2 = ink("heart_a.png", 1745, 345, 62);
  const s3 = ink("pop_l.png", 200, 850, 80);
  // two more doodles drawn in while the photos hold still
  const s4 = ink("heart_b.png", 1730, 760, 60);
  const s5 = ink("star_c.png", 215, 300, 62);
  // a watercolor heart lands on the seam between the two portraits and beats with the music
  const hw = 150;
  const hh = (hw * SIZE["pink_heart.png"][1]) / SIZE["pink_heart.png"][0];
  const heart = { box: { x: 960 - hw / 2, y: 930 - hh / 2, w: hw, h: hh }, el: <Wiggle cx={960} cy={930}><Art src={A("pink_heart.png")} cx={960} cy={930} w={hw} h={hh} op={0.95} /></Wiggle> };
  const o = exits(E);
  return (
    <>
      <Anim box={g.box} at={S} out={o.photo} enter="fromLeft" exit="toLeft">{g.el}</Anim>
      <Anim box={b.box} at={S + Bt(1)} out={o.photo} enter="fromRight" exit="toRight">{b.el}</Anim>
      <Anim box={s1.box} at={S + Bt(3)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{s1.el}</Anim>
      <Anim box={s2.box} at={S + Bt(4)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{s2.el}</Anim>
      <Anim box={s3.box} at={S + Bt(5)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{s3.el}</Anim>
      <Anim box={s4.box} at={S + Bt(8)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{s4.el}</Anim>
      <Anim box={s5.box} at={S + Bt(10)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{s5.el}</Anim>
      <Anim box={heart.box} at={S + Bt(6)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{heart.el}</Anim>
    </>
  );
};

/** Photos → poem → flower: the photos unroll upward, the poem types itself, the flower pops. */
export const PagePoem: React.FC<PageProps> = ({ c, S, E }) => {
  const p0 = pic(c.ph.poem[0], 70, 110, 600, 860, S);
  const p1 = pic(c.ph.poem[1], 690, 110, 600, 860, S);
  const fl = ink("flower.png", 1590, 330, 110);
  const ls = lines(c.copy.poem).map((l, i) => txt(l, "lora", 36, 1590, 440 + i * 70, "ct", i % 2 ? INK : "#3B3936", 0.3, 540));
  const o = exits(E);
  return (
    <>
      <Anim box={p0.box} at={S} out={o.photo} enter="wipeUp" exit="wipeDown">{p0.el}</Anim>
      <Anim box={p1.box} at={S + Bt(1)} out={o.photo} enter="wipeUp" exit="wipeDown">{p1.el}</Anim>
      {ls.map((l, i) => (
        <Anim key={i} box={l.box} at={S + Bt(3 + i)} out={o.text} enter="type" exit="fade">{l.el}</Anim>
      ))}
      <Anim box={fl.box} at={S + Bt(3 + ls.length)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{fl.el}</Anim>
    </>
  );
};

/** Text → photo → camera: the line comes into focus, the photo opens from the left, the camera drops in. */
export const PageCamera: React.FC<PageProps> = ({ c, S, E }) => {
  const [l1, l2] = lines(c.copy.camera_line);
  const t1 = txt(l1 ?? "", "lora", 40, 330, 556, "ct", INK, 1, 540);
  const t2 = txt(l2 ?? "", "loraI", 36, 330, 624, "ct", SOFT, 1, 540);
  const ph = pic(c.ph.camera, 620, 110, 1230, 860, S);
  const cam = ink("camera.png", 330, 430, 120);
  const o = exits(E);
  return (
    <>
      <Anim box={t1.box} at={S} out={o.text} enter="focus">{t1.el}</Anim>
      {l2 ? <Anim box={t2.box} at={S + Bt(1)} out={o.text} enter="focus">{t2.el}</Anim> : null}
      <Anim box={ph.box} at={S + Bt(1)} out={o.photo} enter="wipeRight" exit="toRight" dur={Bt(2)}>{ph.el}</Anim>
      <Anim box={cam.box} at={S + Bt(3)} out={o.icon} enter="bounce" exit="shrink" dur={Bt(1.5)}>{cam.el}</Anim>
    </>
  );
};

/** Title → three photos rising one by one → glasses clinking. */
export const PageForever: React.FC<PageProps> = ({ c, S, E }) => {
  const ti = txt(c.copy.title_forever, "lora", 50, 120, 70, "lt", INK, 1, 1300);
  const ps = [pic(c.ph.forever[0], 90, 170, 560, 800, S), pic(c.ph.forever[1], 680, 170, 560, 620, S), pic(c.ph.forever[2], 1270, 170, 560, 800, S)];
  const ch = ink("cheers.png", 960, 880, 110);
  const o = exits(E);
  return (
    <>
      <Anim box={ti.box} at={S} out={o.text} enter="type">{ti.el}</Anim>
      {ps.map((p, i) => (
        <Anim key={i} box={p.box} at={S + Bt(1 + i)} out={o.photo} enter="rise" exit="sink" dist={120}>{p.el}</Anim>
      ))}
      <Anim box={ch.box} at={S + Bt(6)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{ch.el}</Anim>
    </>
  );
};

/** Photos from both sides → title → rose → a line. */
export const PageLove: React.FC<PageProps> = ({ c, S, E }) => {
  const big = pic(c.ph.loveBig, 110, 160, 1170, 780, S);
  const small = pic(c.ph.loveSmall, 1320, 260, 480, 560, S);
  const ti = txt(c.copy.title_love, "lora", 50, 120, 70, "lt", INK, 1, 1300);
  const ro = ink("rose.png", 1385, 935, 110);
  const li = txt(c.copy.love_line, "songR", 36, 1800, 912, "rt", SOFT, 8, 640);
  const o = exits(E);
  return (
    <>
      <Anim box={big.box} at={S} out={o.photo} enter="fromLeft" exit="toLeft" dist={180}>{big.el}</Anim>
      <Anim box={small.box} at={S + Bt(1)} out={o.photo} enter="fromRight" exit="toRight" dist={180}>{small.el}</Anim>
      <Anim box={ti.box} at={S + Bt(3)} out={o.text} enter="focus">{ti.el}</Anim>
      <Anim box={ro.box} at={S + Bt(4)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{ro.el}</Anim>
      <Anim box={li.box} at={S + Bt(5)} out={o.text} enter="type">{li.el}</Anim>
    </>
  );
};

/** Title → portrait unrolls down → wide photo slides in → stars. */
export const PageSoul: React.FC<PageProps> = ({ c, S, E }) => {
  const ti = txt(c.copy.title_soul, "lora", 50, 120, 70, "lt", INK, 1, 1300);
  const p0 = pic(c.ph.soul[0], 110, 170, 600, 800, S);
  const p1 = pic(c.ph.soul[1], 740, 230, 1070, 713, S);
  const s1 = ink("star_c.png", 1705, 150, 64);
  const s2 = ink("heart_b.png", 1575, 160, 56);
  const o = exits(E);
  return (
    <>
      <Anim box={ti.box} at={S} out={o.text} enter="type">{ti.el}</Anim>
      <Anim box={p0.box} at={S + Bt(1)} out={o.photo} enter="wipeDown" exit="dissolve">{p0.el}</Anim>
      <Anim box={p1.box} at={S + Bt(2)} out={o.photo} enter="fromRight" exit="dissolve" dist={200}>{p1.el}</Anim>
      <Anim box={s1.box} at={S + Bt(5)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{s1.el}</Anim>
      <Anim box={s2.box} at={S + Bt(6)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{s2.el}</Anim>
    </>
  );
};

/** Four portraits drop in one after another → title → names. */
export const PageOneLove: React.FC<PageProps> = ({ c, S, E }) => {
  const ps = c.ph.oneLove.map((id, i) => pic(id, 96 + i * 436, 170, 420, 790, S));
  const ti = txt(c.copy.title_onelove, "lora", 50, 120, 70, "lt", INK, 1, 1300);
  const nm = txt(`${c.groom} & ${c.bride}`, "songR", 36, 1820, 990, "rt", SOFT, 6, 1100);
  const o = exits(E);
  return (
    <>
      {ps.map((p, i) => (
        <Anim key={i} box={p.box} at={S + Bt(i)} out={o.photo} enter="drop" exit="lift" dist={110}>{p.el}</Anim>
      ))}
      <Anim box={ti.box} at={S + Bt(4)} out={o.text} enter="focus">{ti.el}</Anim>
      <Anim box={nm.box} at={S + Bt(5)} out={o.text} enter="type">{nm.el}</Anim>
    </>
  );
};

/** Title → the wide photo zooms in → the side photos slide in → flower. */
export const PageEver: React.FC<PageProps> = ({ c, S, E }) => {
  const ti = txt(c.copy.title_ever, "lora", 50, 1800, 70, "rt", INK, 1, 1300);
  const mid = pic(c.ph.ever[1], 590, 200, 840, 600, S);
  const l = pic(c.ph.ever[0], 110, 290, 450, 600, S);
  const r = pic(c.ph.ever[2], 1460, 250, 350, 466, S);
  const fl = ink("flower.png", 1010, 905, 90);
  const h1 = ink("heart_a.png", 230, 190, 64);
  const h2 = ink("star_b.png", 1640, 850, 70);
  const o = exits(E);
  return (
    <>
      <Anim box={ti.box} at={S} out={o.text} enter="type">{ti.el}</Anim>
      <Anim box={h1.box} at={S + Bt(9)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{h1.el}</Anim>
      <Anim box={h2.box} at={S + Bt(11)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{h2.el}</Anim>
      <Anim box={mid.box} at={S + Bt(1)} out={o.photo} enter="zoom" exit="dissolve">{mid.el}</Anim>
      <Anim box={l.box} at={S + Bt(2)} out={o.photo} enter="fromLeft" exit="toLeft">{l.el}</Anim>
      <Anim box={r.box} at={S + Bt(3)} out={o.photo} enter="fromRight" exit="toRight">{r.el}</Anim>
      <Anim box={fl.box} at={S + Bt(6)} out={o.icon} enter="pop" exit="shrink" dur={Bt(1)}>{fl.el}</Anim>
    </>
  );
};

/** The last page — photo → camera → title → date; everything leaves before the bow. */
export const PageUs: React.FC<PageProps> = ({ c, S, E }) => {
  const ph = pic(c.ph.us, 560, 110, 1260, 860, S);
  const cam = ink("camera.png", 300, 380, 100);
  const ti = txt(c.copy.title_us, "lora", 56, 300, 500, "ct", INK, 1, 480);
  const da = txt(c.date, "lora", 36, 300, 590, "ct", SOFT, 4);
  const o = exits(E);
  return (
    <>
      <Anim box={ph.box} at={S} out={o.photo} enter="wipeLeft" exit="dissolve" dur={Bt(2)}>{ph.el}</Anim>
      <Anim box={cam.box} at={S + Bt(2)} out={o.icon} enter="bounce" exit="shrink" dur={Bt(1.5)}>{cam.el}</Anim>
      <Anim box={ti.box} at={S + Bt(3)} out={o.text} enter="focus">{ti.el}</Anim>
      <Anim box={da.box} at={S + Bt(4)} out={o.text} enter="type">{da.el}</Anim>
    </>
  );
};

/** The pages in order. */
export const PAGES: React.FC<PageProps>[] = [PagePair, PagePoem, PageCamera, PageForever, PageLove, PageSoul, PageOneLove, PageEver, PageUs];

// ---------------------------------------------------------------- 5 · thank you, with a bow
const FLOATERS = ["heart_a.png", "star_b.png", "heart_b.png", "star_a.png", "heart_a.png", "star_c.png", "heart_b.png", "star_b.png"];

/** Small hearts and stars drifting up on both sides of the couple, one new one every two beats. */
const FloatingDoodles: React.FC<{ S: number; E: number }> = ({ S, E }) => {
  const t = useT();
  const life = Bt(10);
  const items = [];
  for (let k = 0; S + Bt(2 + 2 * k) < E - 1; k++) {
    const t0 = S + Bt(2 + 2 * k);
    const u = (t - t0) / life;
    if (u <= 0 || u >= 1) continue;
    const src = FLOATERS[k % FLOATERS.length];
    const left = k % 2 === 0;
    const x = (left ? 420 : 1500) + ((k * 137) % 180) - 90 + 30 * Math.sin(u * Math.PI * 2 + k);
    const y = 1000 - 820 * u;
    const op = Math.min(1, u * 6) * Math.min(1, (1 - u) * 4);
    const h = 58 + ((k * 23) % 30);
    items.push(<Art key={k} src={A(src)} cx={x} cy={y} w={widthAt(src, h)} h={h} rot={18 * Math.sin(u * 5 + k)} op={op} />);
  }
  return <>{items}</>;
};

export const Ending: React.FC<{ c: Ctx; S: number; E: number }> = ({ c, S, E }) => {
  const t = useT();
  const inP = eOut3(ramp(t, S, S + Bt(2)));
  // bow twice: down for two beats, up for four
  const beat = (t - (S + Bt(6))) / Bt(1);
  const bowing = beat >= 0 && beat < 12 && Math.floor(beat / 2) % 3 === 0;
  const fade = eIo3(ramp(t, E - 1.2, E));
  const h = 460;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, opacity: inP, transform: `translateY(${(1 - inP) * 40}px)` }}>
        <Art src={A(bowing ? "couple_bow.png" : "couple_stand.png")} cx={960} cy={470} w={widthAt("couple_stand.png", h)} h={h} />
      </div>
      <FloatingDoodles S={S} E={E} />
      <Focus s={c.copy.thanks} f="lora" size={46} tr={3} x={960} y={790} a="cm" t0={S + Bt(2)} />
      <Focus s={c.date} f="lora" size={36} tr={4} c={SOFT} x={960} y={862} a="cm" t0={S + Bt(3)} />
      {fade > 0 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: fade }} /> : null}
    </AbsoluteFill>
  );
};
