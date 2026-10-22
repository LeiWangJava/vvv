import React, { type CSSProperties } from "react";
import { AbsoluteFill, Freeze, Img, OffthreadVideo, random, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Falling } from "../../components/Falling";
import { Glitter } from "../../components/Glitter";
import { FilmGrain, Vignette } from "../../components/Overlays";
import { coverFit, coverStyle } from "../../core/crop";
import { eBack, eIn3, eIo3, eOut3, lerp, ramp } from "../../core/ease";
import { fontFor } from "../../core/fonts";
import { getPhoto, photoSrc } from "../../core/manifest";
import { useT } from "../../core/time";
import { textWidth } from "../../core/text-fit";
import { Art, swing, T, type Face } from "../shared/kit";
import { GoldCorners, RedBackdrop } from "../../effects/papercut-frame";

/**
 * XY-61 喜剧开场 · 婚礼即将开始 — the comic warm-up opening a host would give: an over-the-top
 * studio ident, the couple "dubbing" a welcome in rhyme, the guests' house rules on festive red
 * cards, a wrong-clip gag for each of them, a love story that gets stuck loading at 99%, the
 * wedding photos, and a countdown that waits for the guests' applause before the ceremony starts.
 *
 * Every gag beat can show a clip instead of its photo or graphic (a couple's own funny video,
 * friends' wishes, or footage the studio has licensed) — see the clip_* copy keys.
 *
 * Two tracks: Fun and Games (99.9 BPM) for the comedy, When in Love (94.8 BPM) for the photos.
 */

export const BPM_A = 99.9;
export const A0 = 0.306;
/** beat n of the comedy track (film seconds) */
export const BA = (n: number) => A0 + (n * 60) / BPM_A;
/** n beats of the comedy track as a duration */
export const Bt = (n: number) => (n * 60) / BPM_A;
/** 1 on each beat of the comedy track after `from`, decaying to 0 before the next. */
export const beatPulse = (t: number, from: number) => {
  if (t < from) return 0;
  const beat = (t - A0) / Bt(1);
  return Math.exp(-(beat - Math.floor(beat)) * 5);
};
/** where the second track's second 0 lands in the film */
export const START_B = 109.9;
export const BPM_B = 94.8;
const B0 = 0.527;
/** beat n of the photo track (film seconds) */
export const BB = (n: number) => START_B + B0 + (n * 60) / BPM_B;

export const RED = "#C8102E";
export const DEEP = "#7E0A18";
export const GOLD = "#F6C453";
export const CREAM = "#FFF4DF";
export const INK = "#24140F";
const YELLOW = "#FFD84D";
const XY39 = (name: string) => `assets/xy39/${name}.png`;

export interface Clip {
  src: string;
  start: number;
  /** play the picture only (its own sound is unsuitable); narration and music carry on */
  mute: boolean;
}

/** "clips/a.mp4@12.5" (or "…@12.5#mute") → { src, start, mute }; empty → null */
export const parseClip = (text: string | undefined): Clip | null => {
  const s = (text ?? "").trim();
  if (!s) return null;
  const [body, flag] = s.split("#");
  const [src, at] = body.split("@");
  return { src: src.trim(), start: Number(at) || 0, mute: (flag ?? "").trim() === "mute" };
};

export interface Ctx {
  ph: {
    groomKid: string;
    groomHero: string;
    brideKid: string;
    brideHero: string;
    love: string[];
    proposal: string;
    finale: string;
    gallery: string[];
  };
  groom: string;
  bride: string;
  names: string;
  date: string;
  copy: Record<string, string>;
  clip: (key: string) => Clip | null;
  /** design seconds → film frame (where a clip has to start) */
  frameOf: (t: number) => number;
}
type Seg = React.FC<{ c: Ctx }>;

const lines = (s: string) => s.split("｜").map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------- type & stickers

/** 1.6× → 1× pop with a little overshoot. */
const pop = (t: number, t0: number, d = 0.3) => ({ op: eOut3(ramp(t, t0, t0 + 0.08)), sc: 1 + 0.6 * (1 - eBack(ramp(t, t0, t0 + d), 1.7)) });

const GOLD_FILL: CSSProperties = {
  backgroundImage: "linear-gradient(180deg, #FFF8DA 0%, #FFE08A 36%, #F2B544 62%, #FFE7A3 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 5px 0 #5E0610) drop-shadow(0 16px 24px rgba(30,0,0,0.5))",
};

/** Gold calligraphy that pops in on its beat. */
export const Gold: React.FC<{ s: string; x?: number; y: number; size: number; t0: number; f?: Face; tr?: number; out?: number; maxW?: number }> = ({ s, x = 960, y, size, t0, f = "brush", tr = 10, out, maxW }) => {
  const t = useT();
  const { op, sc } = pop(t, t0);
  const o = op * (out === undefined ? 1 : 1 - eIo3(ramp(t, out - 0.12, out)));
  if (o <= 0.002) return null;
  return <T s={s} f={f} size={size} tr={tr} c={GOLD} x={x} y={y} a="cm" op={o} sc={sc} style={GOLD_FILL} maxW={maxW} />;
};

/** Variety-show subtitle: heavy type, thick dark outline, pops on its beat. */
export const Meme: React.FC<{ s: string; t0: number; t1: number; y?: number; size?: number; fill?: string; x?: number }> = ({ s, t0, t1, y = 1000, size = 76, fill = "#FFFFFF", x = 960 }) => {
  const t = useT();
  const inP = ramp(t, t0, t0 + 0.14);
  const op = eOut3(inP) * (1 - eIo3(ramp(t, t1 - 0.1, t1)));
  if (op <= 0.002 || t < t0) return null;
  const sc = 1.28 - 0.28 * eOut3(inP);
  const base: CSSProperties = { whiteSpace: "pre", fontFamily: fontFor("heiti", s, 900), fontWeight: 900, fontSize: size, letterSpacing: 4, lineHeight: 1.1 };
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -100%) scale(${sc})`, transformOrigin: "50% 100%", opacity: op, filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.35))" }}>
      <div style={{ position: "relative" }}>
        <div style={{ ...base, color: "#151515", WebkitTextStroke: `${Math.round(size * 0.22)}px #151515` }}>{s}</div>
        <div style={{ ...base, position: "absolute", left: 0, top: 0, color: fill }}>{s}</div>
      </div>
    </div>
  );
};

/** A colour emoji used as a sticker. */
export const Em: React.FC<{ ch: string; x: number; y: number; size: number; rot?: number; op?: number; sc?: number; flip?: boolean }> = ({ ch, x, y, size, rot = 0, op = 1, sc = 1, flip = false }) =>
  op <= 0.002 ? null : (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -sc : sc}, ${sc})`,
        fontFamily: fontFor("emoji", ch),
        fontSize: size,
        lineHeight: 1,
        opacity: op,
        whiteSpace: "pre",
        filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.25))",
      }}
    >
      {ch}
    </div>
  );

/** Manga focus lines around a point: the "look here!" of variety shows. */
export const SpeedLines: React.FC<{ op: number; color?: string; cx?: number; cy?: number; inner?: number }> = ({ op, color = "#FFFFFF", cx = 960, cy = 540, inner = 440 }) => {
  const frame = useCurrentFrame();
  if (op <= 0.002) return null;
  const n = 72;
  const slot = Math.floor(frame / 2);
  const d = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + random(`sl-a-${i}`) * 0.07;
    const r0 = inner + 220 * random(`sl-r-${i}-${slot}`);
    const w = 0.006 + 0.014 * random(`sl-w-${i}`);
    const R = 1500;
    const P = (r: number, ang: number) => `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`;
    return `M${P(r0, a)} L${P(R, a - w)} L${P(R, a + w)} Z`;
  }).join(" ");
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: op, pointerEvents: "none" }}>
      <path d={d} fill={color} />
    </svg>
  );
};

/** White flash that fades over `d` seconds. */
export const Flash: React.FC<{ t0: number; d?: number; color?: string }> = ({ t0, d = 0.35, color = "#FFFFFF" }) => {
  const t = useT();
  const a = t < t0 ? 0 : 1 - eOut3(ramp(t, t0, t0 + d));
  return a > 0.002 ? <AbsoluteFill style={{ background: color, opacity: a }} /> : null;
};

// ---------------------------------------------------------------- backgrounds

/** Festive red card: red ground, gold clouds, a gold double frame with paper-cut corners. */
export const FestiveCard: React.FC<{ children?: React.ReactNode; t0?: number }> = ({ children, t0 = 0 }) => {
  const t = useT();
  return (
    <AbsoluteFill>
      <RedBackdrop drift={(t - t0) * 6} />
      <div style={{ position: "absolute", inset: 56, border: `4px solid ${GOLD}`, borderRadius: 10, opacity: 0.95 }} />
      <div style={{ position: "absolute", inset: 74, border: `1.5px solid ${GOLD}`, borderRadius: 6, opacity: 0.6 }} />
      <GoldCorners x={56} y={56} w={1808} h={968} size={200} />
      {children}
    </AbsoluteFill>
  );
};

/** Bright variety-show stage: yellow, slowly turning sunburst, halftone dots. */
export const Stage: React.FC<{ children?: React.ReactNode; color?: string; t0?: number }> = ({ children, color = YELLOW, t0 = 0 }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: color, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 960 - 1400,
          top: 600 - 1400,
          width: 2800,
          height: 2800,
          background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.32) 0deg 7.5deg, rgba(255,255,255,0) 7.5deg 15deg)",
          transform: `rotate(${(t - t0) * 8}deg)`,
        }}
      />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(200,16,46,0.16) 3px, transparent 3.5px)", backgroundSize: "26px 26px", maskImage: "linear-gradient(to bottom, #000 0%, transparent 45%)", WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 45%)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%, rgba(170,80,0,0.18) 100%)" }} />
      {children}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- photos & clips

/** Zoom levels hit on beats: [time, zoom] — each step snaps in over 0.12 s with a small overshoot. */
const zoomAt = (t: number, steps: [number, number][]) => {
  let z = 1;
  for (const [ts, zs] of steps) {
    if (t < ts) break;
    const p = ramp(t, ts, ts + 0.14);
    z = lerp(z, zs, eBack(p, 2.2));
  }
  return z;
};

/**
 * A photo filling the screen (landscape: cover; portrait: centred over a blurred copy), with a slow
 * push, beat-hit zooms toward the faces, an optional shake and a freeze grade.
 */
export const Snap: React.FC<{
  id: string;
  t0: number;
  t1: number;
  zooms?: [number, number][];
  push?: number;
  shake?: [number, number];
  gray?: number;
  target?: [number, number];
  start?: number;
}> = ({ id, t0, t1, zooms = [], push = 0.06, shake, gray = 0, target = [0.5, 0.42], start = 1.06 }) => {
  const t = useT();
  const photo = getPhoto(id);
  const portrait = photo.width / photo.height < 1.2;
  const w = portrait ? Math.round((1080 * photo.width) / photo.height) : 1920;
  const fit = coverFit(photo, w, 1080, portrait ? [0.5, 0.4] : target);
  const ox = (portrait ? 960 - w / 2 : 0) + (fit.face ? fit.face[0] : 0.5) * w;
  const oy = (fit.face ? fit.face[1] : 0.42) * 1080;
  // cut in slightly large and settle, then push slowly; beat zooms on top
  const settle = lerp(start, 1, eOut3(ramp(t, t0, t0 + 0.35)));
  const z = settle * (1 + push * eIo3(ramp(t, t0, t1))) * zoomAt(t, zooms);
  let sx = 0;
  let sy = 0;
  if (shake && t >= shake[0] && t < shake[1]) {
    const k = 1 - ramp(t, shake[0], shake[1]);
    const f = Math.floor(t * 60);
    sx = (random(`sx-${f}`) - 0.5) * 34 * k;
    sy = (random(`sy-${f}`) - 0.5) * 24 * k;
  }
  const filter = gray > 0 ? `grayscale(${gray}) contrast(${1 + 0.15 * gray}) brightness(${1 - 0.08 * gray})` : undefined;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px`, filter }}>
        {portrait ? (
          <>
            <Img src={photoSrc(photo)} style={{ position: "absolute", left: -80, top: -80, width: 2080, height: 1240, objectFit: "cover", filter: "blur(42px) brightness(0.55) saturate(1.15)" }} />
            <div style={{ position: "absolute", left: 960 - w / 2, top: 0, width: w, height: 1080, overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.45)" }}>
              <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", ...coverStyle(photo, w, 1080) }} />
            </div>
          </>
        ) : (
          <Img src={photoSrc(photo)} style={{ width: 1920, height: 1080, ...coverStyle(photo, 1920, 1080, target) }} />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A user clip in place of a gag's picture (muted here — its sound is played by the soundtrack). */
export const ClipView: React.FC<{ clip: Clip; t0: number; c: Ctx; freezeAt?: number }> = ({ clip, t0, c, freezeAt }) => {
  const t = useT();
  const { fps } = useVideoConfig();
  const frozen = freezeAt !== undefined && t >= freezeAt;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={c.frameOf(t0)} layout="none">
        <Freeze frame={freezeAt === undefined ? 0 : c.frameOf(freezeAt) - c.frameOf(t0)} active={frozen}>
          <OffthreadVideo
            src={staticFile(clip.src)}
            trimBefore={Math.round(clip.start * fps)}
            muted
            style={{ width: 1920, height: 1080, objectFit: "cover", filter: frozen ? "grayscale(0.85) contrast(1.12) brightness(0.92)" : undefined }}
          />
        </Freeze>
      </Sequence>
      {/* film clips often carry burned-in subtitles at the bottom: blur them away under our caption */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 240,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0) 100%)",
          maskImage: "linear-gradient(to top, #000 0%, #000 70%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 70%, transparent 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** The clip for `key` if the studio set one, else the built-in gag. */
const Either: React.FC<{ c: Ctx; k: string; t0: number; freezeAt?: number; children: React.ReactNode }> = ({ c, k, t0, freezeAt, children }) => {
  const clip = c.clip(k);
  return clip ? <ClipView clip={clip} t0={t0} c={c} freezeAt={freezeAt} /> : <>{children}</>;
};

/** Variety-show name card sliding in from the left: role chip + name. */
export const Nameplate: React.FC<{ role: string; name: string; t0: number }> = ({ role, name, t0 }) => {
  const t = useT();
  const p = eBack(ramp(t, t0, t0 + 0.5), 1.4);
  if (t < t0) return null;
  // Springs out from its own left edge (never cut by the frame), with a short slide and a beat bounce.
  const x = lerp(30, 110, eOut3(ramp(t, t0, t0 + 0.4)));
  const sc = (0.35 + 0.65 * p) * (1 + 0.025 * beatPulse(t, t0 + 0.6));
  const op = eOut3(ramp(t, t0, t0 + 0.15));
  return (
    <div style={{ position: "absolute", left: x, top: 772, display: "flex", alignItems: "center", gap: 0, filter: "drop-shadow(0 16px 26px rgba(0,0,0,0.4))",
      transform: `scale(${sc})`, transformOrigin: "0% 50%", opacity: op }}>
      <div style={{ padding: "18px 30px", background: GOLD, borderRadius: "18px 0 0 18px", border: `4px solid ${GOLD}` }}>
        <T s={role} f="kuaile" size={54} c={DEEP} />
      </div>
      <div style={{ padding: "14px 46px 18px 34px", background: `linear-gradient(180deg, #E0233C 0%, ${RED} 45%, ${DEEP} 100%)`, borderRadius: "0 18px 18px 0", border: `4px solid ${GOLD}`, borderLeft: "none" }}>
        <T s={name} f="heiB" size={84} tr={10} c="#FFFFFF" maxW={1700 - 110 - 80 - textWidth(role, "heiti", 54) - 140} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 0 · studio ident and title
export const Ident: Seg = ({ c }) => {
  const t = useT();
  const logo = eOut3(ramp(t, BA(0), BA(0) + 0.6)) * (1 - eIo3(ramp(t, BA(3.6), BA(4))));
  const shine = ramp(t, BA(0.5), BA(3));
  const names = [
    { s: `新郎  ${c.groom}`, n: 5 },
    { s: `新娘  ${c.bride}`, n: 6 },
  ];
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, #2A1A10 0%, #0B0705 70%)" }}>
      <div style={{ opacity: logo }}>
        <Art src={XY39("medallion-gold")} cx={960} cy={420} w={300} h={300} sc={0.9 + 0.1 * eOut3(ramp(t, BA(0), BA(2)))} op={0.9} />
        <div style={{ position: "absolute", inset: 0, maskImage: `linear-gradient(110deg, #000 ${shine * 140 - 40}%, rgba(0,0,0,0.75) ${shine * 140 - 20}%, #000 ${shine * 140}%)`, WebkitMaskImage: `linear-gradient(110deg, #000 ${shine * 140 - 40}%, rgba(0,0,0,0.75) ${shine * 140 - 20}%, #000 ${shine * 140}%)` }}>
          <T s={c.copy.studio} f="songB" size={110} tr={40} c={GOLD} x={960} y={680} a="cm" style={GOLD_FILL} />
        </div>
        <T s={c.copy.studio_en} f="serif" size={34} tr={18} c={GOLD} x={960} y={790} a="cm" op={0.8} />
      </div>
      {t >= BA(4) ? (
        <>
          <Gold s={c.copy.presents} y={330} size={64} t0={BA(4)} f="kuaile" tr={12} />
          {names.map(({ s, n }) => (
            <Gold key={s} s={s} y={330 + (n - 4) * 150} size={92} t0={BA(n)} f="heiB" tr={10} maxW={1700} />
          ))}
          <Gold s={c.copy.starring} y={810} size={64} t0={BA(7)} f="kuaile" tr={12} />
        </>
      ) : null}
      <FilmGrain opacity={0.06} />
    </AbsoluteFill>
  );
};

export const TitleCard: Seg = ({ c }) => {
  const t = useT();
  const S = BA(8);
  return (
    <FestiveCard t0={S}>
      {[300, 1620].map((x, k) => (
        <Art key={x} src={XY39("lantern-gold")} cx={x} cy={300} w={230} h={345} origin="50% 0%" rot={swing(t, S, 9, 1.4, 6) * (k ? -1 : 1)} op={eOut3(ramp(t, S, S + 0.4))} />
      ))}
      {/* the title pulses on every beat once it has landed, like a variety-show caption */}
      <AbsoluteFill style={{ transformOrigin: "960px 500px", transform: `scale(${1 + 0.04 * beatPulse(t, S + Bt(2))})` }}>
        <Gold s={c.copy.title} y={500} size={170} t0={S + 0.1} tr={24} />
      </AbsoluteFill>
      <T s={`${c.names}  ·  ${c.date}`} f="kuaile" size={50} tr={8} c={CREAM} x={960} y={700} a="cm" op={eOut3(ramp(t, S + 0.8, S + 1.3))} maxW={1640} wrap />
      <Glitter
        bursts={[{ seed: 611, n: 70, t0: S, t1: S + 0.6, path: (u) => [560 + 800 * u, 500], jit: 60, vel: [0, -60], grav: 140 }]}
        ambient={[{ seed: 612, n: 60, t0: S + 0.6, t1: BA(16), box: [240, 380, 1680, 760], inten: 0.6 }]}
      />
    </FestiveCard>
  );
};

// ---------------------------------------------------------------- 1 · the host's welcome in rhyme
export const WELCOME_FROM = 16;
const W0 = (k: number) => BA(WELCOME_FROM + 4 * k);
/** "a  b" or "a｜b" → two lines */
const twoLines = (s: string) => s.split(/｜|\s{2,}/).map((x) => x.trim()).filter(Boolean);

/** A hanging red scroll that unrolls from its top rod; the characters pop in one by one. */
const Scroll: React.FC<{ text: string; cx: number; t0: number }> = ({ text, cx, t0 }) => {
  const t = useT();
  const top = 140;
  const full = 800;
  const w = 210;
  const open = eOut3(ramp(t, t0, t0 + 0.5));
  if (t < t0) return null;
  const h = full * open;
  const chars = [...text.replace(/\s/g, "")];
  const step = Math.min(104, (full - 110) / Math.max(1, chars.length));
  const rod = (y: number) => (
    <div style={{ position: "absolute", left: cx - w / 2 - 22, top: y - 13, width: w + 44, height: 26, borderRadius: 13, background: "linear-gradient(180deg, #8A4A22 0%, #5A2E14 55%, #3E1E0C 100%)", boxShadow: "0 6px 12px rgba(30,0,0,0.4)" }}>
      {[0, 1].map((e) => (
        <div key={e} style={{ position: "absolute", [e ? "right" : "left"]: -8, top: -3, width: 32, height: 32, borderRadius: 16, background: `radial-gradient(circle at 35% 35%, #FFF1B8, ${GOLD} 55%, #A87818)` }} />
      ))}
    </div>
  );
  return (
    <>
      <div style={{ position: "absolute", left: cx - w / 2, top, width: w, height: h, overflow: "hidden", background: "linear-gradient(90deg, #A30E1B 0%, #CF1B2E 50%, #A30E1B 100%)", boxShadow: "0 16px 34px rgba(40,0,0,0.45)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,214,120,0.35) 1.2px, transparent 1.6px)", backgroundSize: "18px 22px" }} />
        <div style={{ position: "absolute", left: 12, right: 12, top: 14, height: full - 28, border: `3px solid ${GOLD}`, opacity: 0.9 }} />
      </div>
      {chars.map((ch, i) => {
        const y = top + 70 + step * (i + 0.5);
        if (y > top + h - 20) return null;
        return <Gold key={i} s={ch} x={cx} y={y} size={Math.min(96, step * 0.9)} t0={t0 + 0.25 + i * 0.1} tr={0} />;
      })}
      {rod(top)}
      {rod(top + h)}
    </>
  );
};

/** Lines 1–2 are a couplet: two scrolls unroll either side of the 囍 medallion (right line first). */
const Couplet: React.FC<{ c: Ctx }> = ({ c }) => {
  const t = useT();
  const S = W0(0);
  const m = eBack(ramp(t, S, S + 0.6), 1.5);
  return (
    <FestiveCard t0={S}>
      <Art src={XY39("medallion-gold")} cx={960} cy={540} w={500} h={500} sc={0.4 + 0.6 * m} op={eOut3(ramp(t, S, S + 0.3))} rot={(t - S) * 5} style={{ filter: "drop-shadow(0 0 30px rgba(255,200,110,0.45))" }} />
      <Scroll text={c.copy.welcome_1} cx={1500} t0={S} />
      <Scroll text={c.copy.welcome_2} cx={420} t0={W0(1)} />
      <Glitter ambient={[{ seed: 621, n: 40, t0: S, t1: W0(2), box: [600, 200, 1320, 880], inten: 0.35 }]} />
    </FestiveCard>
  );
};

/** Lines 3–6: big words on the variety stage or the red card, each with its own little gag. */
const WelcomeWords: React.FC<{ c: Ctx; k: number }> = ({ c, k }) => {
  const t = useT();
  const S = W0(k);
  const ls = twoLines(c.copy[`welcome_${k + 1}`]);
  if (k === 2) {
    return (
      <Stage t0={S}>
        {ls.map((s, i) => (
          <Meme key={i} s={s} t0={S + i * 0.45} t1={W0(k + 1) + 0.3} y={ls.length === 1 ? 640 : 470 + i * 260} size={150} fill={i ? YELLOW : "#FFFFFF"} />
        ))}
        {[300, 1620].map((x, i) => (
          <Em key={x} ch="🎉" x={x} y={330} size={200} rot={i ? 14 : -14} flip={!!i} op={pop(t, S + 0.2).op} sc={pop(t, S + 0.2).sc} />
        ))}
        <Falling specs={[{ seed: 631, n: 90, t0: S, t1: S + 0.6, kind: "paper", colors: [RED, GOLD, "#FF5C8A", "#FFFFFF"], x: [200, 1720], y0: 380, burst: 800, speed: [160, 280], size: [14, 24] }]} />
      </Stage>
    );
  }
  if (k === 3) {
    const m = eBack(ramp(t, S, S + 0.5), 1.6);
    return (
      <FestiveCard t0={S}>
        <Art src={XY39("medallion-gold")} cx={960} cy={380} w={400} h={400} sc={0.3 + 0.7 * m} op={eOut3(ramp(t, S, S + 0.2))} />
        <Gold s={ls.join("")} y={720} size={130} t0={S + 0.3} tr={16} />
        <T s={c.names} f="kuaile" size={50} tr={8} c={CREAM} x={960} y={870} a="cm" op={eOut3(ramp(t, S + 0.8, S + 1.2))} maxW={1600} />
      </FestiveCard>
    );
  }
  if (k === 4) {
    return (
      <Stage t0={S} color="#FFE36A">
        {[-2, -1, 0, 1, 2].map((i) => {
          const p = pop(t, S + 0.08 * (i + 2));
          return <Em key={i} ch="👏" x={960 + i * 330} y={400} size={210} op={p.op} sc={p.sc * (1 + 0.14 * Math.max(0, Math.sin((t - S) * 16 + i * 1.3)))} />;
        })}
        <Meme s={ls.join("  ")} t0={S + 0.3} t1={W0(k + 1) + 0.3} y={840} size={128} fill={YELLOW} />
      </Stage>
    );
  }
  return (
    <FestiveCard t0={S}>
      {[300, 1620].map((x, i) => (
        <Art key={x} src={XY39("lantern-gold")} cx={x} cy={300} w={220} h={330} origin="50% 0%" rot={swing(t, S, 9, 1.4, 6) * (i ? -1 : 1)} op={eOut3(ramp(t, S, S + 0.3))} />
      ))}
      {ls.map((s, i) => (
        <Gold key={i} s={s} y={ls.length === 1 ? 540 : 440 + i * 210} size={150} t0={S + i * 0.4} tr={22} />
      ))}
      <Falling specs={[{ seed: 641, n: 140, t0: S, t1: W0(k + 1), kind: "paper", colors: [GOLD, "#FFE7A3", "#FF5C8A", "#FFFFFF"], x: [0, 1920], speed: [140, 260], size: [12, 22] }]} />
    </FestiveCard>
  );
};

export const Welcome: React.FC<{ c: Ctx; k: number }> = ({ c, k }) => {
  const clip = c.clip(`clip_welcome_${k + 1}`);
  if (!clip) return k < 2 ? <Couplet c={c} /> : <WelcomeWords c={c} k={k} />;
  // with a clip the line becomes its "dubbed" caption
  return (
    <AbsoluteFill>
      <ClipView clip={clip} t0={W0(k)} c={c} />
      <Meme s={twoLines(c.copy[`welcome_${k + 1}`]).join("  ")} t0={W0(k) + 0.05} t1={W0(k + 1) + 0.2} fill={k % 2 ? YELLOW : "#FFFFFF"} size={84} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 2 · thanks, and how everyone got here
export const Thanks: Seg = ({ c }) => (
  <FestiveCard t0={BA(40)}>
    <Gold s={c.copy.thanks} y={520} size={160} t0={BA(40)} tr={22} />
  </FestiveCard>
);

/** Each traveller dashes in, shows off in the middle (bob / bounce / sway), and dashes out. */
const ARRIVALS: { ch: string; flip: boolean; from: [number, number]; mid: [number, number]; to: [number, number]; wiggle: (s: number) => [number, number, number] }[] = [
  { ch: "🏃", flip: true, from: [-260, 640], mid: [960, 640], to: [2180, 640], wiggle: (s) => [0, -Math.abs(Math.sin(s * 14)) * 46, Math.sin(s * 14) * 6] },
  { ch: "🚗", flip: false, from: [2200, 660], mid: [960, 660], to: [-280, 660], wiggle: (s) => [Math.sin(s * 30) * 3, -Math.abs(Math.sin(s * 22)) * 14, Math.sin(s * 22) * 2] },
  { ch: "✈️", flip: false, from: [-260, 900], mid: [960, 620], to: [2180, 260], wiggle: (s) => [0, Math.sin(s * 6) * 26, Math.sin(s * 6) * 6] },
];

export const Arrival: React.FC<{ c: Ctx; k: number }> = ({ c, k }) => {
  const t = useT();
  const t0 = BA(44 + 3 * k);
  const t1 = BA(47 + 3 * k);
  const a = ARRIVALS[k];
  const pin = eOut3(ramp(t, t0, t0 + 0.4));
  const pout = eIn3(ramp(t, t1 - 0.35, t1 + 0.05));
  const [wx, wy, wr] = a.wiggle(t - t0);
  const x = lerp(lerp(a.from[0], a.mid[0], pin), a.to[0], pout) + wx;
  const y = lerp(lerp(a.from[1], a.mid[1], pin), a.to[1], pout) + wy;
  const rot = wr;
  const dx = a.to[0] - a.from[0];
  const moving = pin < 1 || pout > 0;
  return (
    <AbsoluteFill>
      <Either c={c} k={`clip_arrive_${k + 1}`} t0={t0}>
      <Stage t0={t0}>
        {/* speed streaks behind the traveller */}
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: dx > 0 ? x - 520 - i * 40 : x + 160 + i * 40, top: y - 40 + i * 40, width: 360, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.85)", opacity: (moving ? 0.8 : 0.35) - i * 0.2 }} />
        ))}
        <Em ch={a.ch} x={x} y={y} size={300} rot={rot} flip={a.flip} />
      </Stage>
      </Either>
      <Meme s={c.copy[`arrive_${k + 1}`]} t0={t0 + 0.05} t1={t1 + 0.2} y={300} size={110} fill={k === 2 ? YELLOW : "#FFFFFF"} />
    </AbsoluteFill>
  );
};

export const ArriveEnd: Seg = ({ c }) => {
  const t = useT();
  const S = BA(53);
  const { op, sc } = pop(t, S + 0.1);
  return (
    <FestiveCard t0={S}>
      <Gold s={c.copy.arrive_end} y={470} size={150} t0={S} tr={20} />
      <Em ch="🙏" x={960} y={760} size={170} op={op} sc={sc} />
    </FestiveCard>
  );
};

// ---------------------------------------------------------------- 3 · house rules
export const RULES_FROM = 56;
export const RulesTitle: Seg = ({ c }) => {
  const t = useT();
  const S = BA(RULES_FROM);
  const stamp = eBack(ramp(t, S + 1.1, S + 1.35), 2);
  return (
    <FestiveCard t0={S}>
      <Gold s={c.copy.rules_title} y={500} size={200} t0={S} tr={40} />
      {t >= S + 1.1 ? (
        <div style={{ position: "absolute", left: 1330, top: 610, transform: `rotate(-14deg) scale(${2.4 - 1.4 * stamp})`, opacity: Math.min(1, ramp(t, S + 1.1, S + 1.18)), border: "8px solid #FFE7A3", borderRadius: 14, padding: "10px 24px" }}>
          <T s={c.copy.rules_stamp} f="heiB" size={70} tr={8} c="#FFE7A3" />
        </div>
      ) : null}
    </FestiveCard>
  );
};

const ORDINAL = ["第一条", "第二条", "第三条", "第四条", "第五条"];
export const RuleCard: React.FC<{ c: Ctx; k: number }> = ({ c, k }) => {
  const S = BA(RULES_FROM + 4 + 8 * k);
  const ls = lines(c.copy[`rule_${k + 1}`]);
  return (
    <FestiveCard t0={S}>
      <Gold s={ORDINAL[k]} y={250} size={70} t0={S} f="kuaile" tr={16} />
      {ls.map((s, i) => (
        <Gold key={i} s={s} y={(ls.length === 1 ? 560 : 470 + i * 190)} size={150} t0={S + 0.15 + i * 0.3} tr={18} />
      ))}
    </FestiveCard>
  );
};

/** The punchline after each rule. */
export const RuleGag: React.FC<{ c: Ctx; k: number }> = ({ c, k }) => {
  const t = useT();
  const S = BA(RULES_FROM + 8 + 8 * k);
  const E = S + BA(4) - BA(0);
  const gag = c.copy[`gag_${k + 1}`];
  let art: React.ReactNode = null;
  if (k === 0) {
    // work and worries get thrown into the bin
    const items = [
      { ch: "💼", x0: 520, y0: 520, d: 0.2 },
      { ch: "📱", x0: 760, y0: 380, d: 0.5 },
      { ch: "😩", x0: 1000, y0: 560, d: 0.8 },
    ];
    art = (
      <>
        <Em ch="🗑️" x={1460} y={650} size={300} />
        {items.map(({ ch, x0, y0, d }) => {
          const p = ramp(t, S + d + 0.3, S + d + 1.0);
          const x = lerp(x0, 1460, eIn3(p));
          const y = lerp(y0, 600, p) - Math.sin(p * Math.PI) * 260;
          return <Em key={ch} ch={ch} x={x} y={y} size={190 * (1 - 0.45 * p)} rot={p * 540} op={p < 0.98 ? pop(t, S + d).op : 0} sc={pop(t, S + d).sc} />;
        })}
      </>
    );
  } else if (k === 1) {
    const b = Math.abs(Math.sin((t - S) * 7)) * 40;
    art = <Em ch="😄" x={960} y={500 - b} size={420} sc={pop(t, S, 0.4).sc} op={pop(t, S).op} rot={Math.sin((t - S) * 5) * 8} />;
  } else if (k === 2) {
    const foods = ["🍗", "🦞", "🥟", "🍰", "🍤", "🥂", "🍜", "🦀"];
    art = (
      <>
        {Array.from({ length: 22 }, (_, i) => {
          const ch = foods[i % foods.length];
          const x = 100 + random(`fx-${i}`) * 1720;
          const born = S + random(`fb-${i}`) * 1.4;
          const y = -160 + (t - born) * (520 + 260 * random(`fv-${i}`));
          return t < born ? null : <Em key={i} ch={ch} x={x} y={y} size={130 + 70 * random(`fs-${i}`)} rot={(t - born) * (random(`fr-${i}`) - 0.5) * 300} />;
        })}
      </>
    );
  } else if (k === 3) {
    const p = pop(t, S + 0.2);
    art = (
      <>
        <Em ch="🍺" x={720} y={520} size={260} op={pop(t, S).op} sc={pop(t, S).sc} />
        <Em ch="🚗" x={1200} y={540} size={280} op={pop(t, S + 0.1).op} sc={pop(t, S + 0.1).sc} />
        {p.op > 0.01 ? (
          <div style={{ position: "absolute", left: 960 - 330, top: 530 - 330, width: 660, height: 660, borderRadius: "50%", border: `36px solid ${RED}`, opacity: p.op, transform: `scale(${p.sc})` }}>
            <div style={{ position: "absolute", left: "50%", top: "50%", width: 700, height: 36, background: RED, transform: "translate(-50%, -50%) rotate(-45deg)" }} />
          </div>
        ) : null}
      </>
    );
  } else {
    art = (
      <>
        {[-1, 0, 1].map((i) => (
          <Em key={i} ch="👏" x={960 + i * 380} y={520} size={260} sc={pop(t, S + 0.15 * (i + 1)).sc * (1 + 0.12 * Math.max(0, Math.sin((t - S) * 18 + i)))} op={pop(t, S + 0.15 * (i + 1)).op} />
        ))}
      </>
    );
  }
  return (
    <AbsoluteFill>
      <Either c={c} k={`clip_rule_${k + 1}`} t0={S}>
        <Stage t0={S}>{art}</Stage>
      </Either>
      <Meme s={gag} t0={S + 0.4} t1={E + 0.2} y={1000} size={86} fill={YELLOW} />
    </AbsoluteFill>
  );
};

export const RulesEnd: Seg = ({ c }) => (
  <FestiveCard t0={BA(RULES_FROM + 44)}>
    <Gold s={c.copy.rules_end} y={540} size={140} t0={BA(RULES_FROM + 44)} tr={20} />
  </FestiveCard>
);

// ---------------------------------------------------------------- 4 · the groom (wrong clip first)
export const GROOM_FROM = 104;
export const G = (n: number) => BA(GROOM_FROM + n);

const Call: React.FC<{ text: string; S: number }> = ({ text, S }) => {
  const t = useT();
  const ls = lines(text);
  // drum roll: the card trembles a little more every beat
  const k = ramp(t, S, S + 2.4);
  const f = Math.floor(t * 60);
  const jx = (random(`cx-${f}`) - 0.5) * 8 * k;
  const jy = (random(`cy-${f}`) - 0.5) * 6 * k;
  // the call builds: a steady push towards the name, a punch on every beat, lanterns swinging in
  const push = 1 + 0.16 * ramp(t, S, S + Bt(6.5));
  const punch = 0.05 * beatPulse(t, S + 0.45);
  return (
    <FestiveCard t0={S}>
      {[300, 1620].map((x, i) => (
        <Art key={x} src={XY39("lantern-gold")} cx={x} cy={260} w={210} h={315} origin="50% 0%" rot={swing(t, S, 12, 0.9, 5) * (i ? -1 : 1)} op={eOut3(ramp(t, S, S + 0.3))} />
      ))}
      <SpeedLines op={(0.12 + 0.26 * k) * (1 + beatPulse(t, S))  / 2 + 0.06} color={GOLD} inner={560 - 120 * k} />
      <AbsoluteFill style={{ transform: `translate(${jx}px, ${jy}px) scale(${push + punch})`, transformOrigin: "960px 540px" }}>
        {ls.map((s, i) => (
          <Gold key={i} s={s} y={ls.length === 1 ? 540 : 440 + i * 210} size={i === ls.length - 1 ? 190 : 110} t0={S + i * 0.45} tr={22} />
        ))}
      </AbsoluteFill>
      <Glitter ambient={[{ seed: 691, n: 70, t0: S, t1: S + Bt(7), box: [200, 160, 1720, 920], inten: 0.7 }]} />
    </FestiveCard>
  );
};

export const GroomCall: Seg = ({ c }) => <Call text={c.copy.groom_call} S={G(0)} />;

export const GroomWrong: Seg = ({ c }) => {
  const t = useT();
  // Imported photos carry no age unless the project records one; then the line says "小时候的".
  const age = getPhoto(c.ph.groomKid).age?.groom;
  const wrongLine = age === undefined ? c.copy.groom_wrong_c.replace(/\s*\{age\}\s*岁的?/, "小时候的") : c.copy.groom_wrong_c.replace("{age}", String(age));
  const frozen = t >= G(6);
  return (
    <AbsoluteFill>
      <Either c={c} k="clip_groom" t0={G(4)} freezeAt={G(6)}>
        <Snap id={c.ph.groomKid} t0={G(4)} t1={G(9)} push={0.04} gray={frozen ? 0.85 : 0} start={1.15} />
        <SpeedLines op={frozen ? 0 : eOut3(ramp(t, G(4), G(4.4))) * 0.75} />
      </Either>
      {frozen ? (
        <AbsoluteFill style={{ border: "14px solid rgba(255,255,255,0.9)", boxShadow: "inset 0 0 0 4px rgba(0,0,0,0.4)" }}>
          <T s="⏸ 定格" f="heiB" size={40} tr={6} c="#FFFFFF" x={70} y={60} />
        </AbsoluteFill>
      ) : null}
      <Meme s={c.copy.groom_wrong_a} t0={G(4.1)} t1={G(6)} size={110} fill={YELLOW} />
      <Meme s={c.copy.groom_wrong_b} t0={G(6)} t1={G(7.5)} size={92} />
      <Meme s={wrongLine} t0={G(7.5)} t1={G(9.05)} size={92} fill={YELLOW} />
    </AbsoluteFill>
  );
};

/** "重来！": VHS rewind — rolling bars, a jump, the label. */
export const Rewind: React.FC<{ c: Ctx; S: number; E: number; id: string; text: string }> = ({ S, E, id, text }) => {
  const t = useT();
  const p = ramp(t, S, E);
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Snap id={id} t0={S - 2} t1={E} push={0} gray={0.9} start={1} />
      <AbsoluteFill style={{ transform: `translateY(${((frame * 37) % 1080) - 540}px)`, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.0) 0px, rgba(255,255,255,0.0) 18px, rgba(255,255,255,0.35) 18px, rgba(255,255,255,0.35) 26px)" }} />
      <AbsoluteFill style={{ background: `rgba(10,10,30,${0.25 + 0.2 * Math.sin(p * 20)})` }} />
      <T s={`◀◀  ${text}`} f="heiB" size={120} tr={10} c="#FFFFFF" x={960} y={540} a="cm" shadow="0 0 24px rgba(0,0,0,0.6)" />
    </AbsoluteFill>
  );
};

export const GroomHero: Seg = ({ c }) => {
  const t = useT();
  const praise = lines(c.copy.groom_praise);
  return (
    <AbsoluteFill>
      <Snap id={c.ph.groomHero} t0={G(10)} t1={G(24)} push={0.04} start={1.0} zooms={[[G(11), 1.3], [G(12), 1.65], [G(13), 2.1], [G(14), 1.0]]} />
      <Flash t0={G(10)} d={0.3} />
      <SpeedLines op={t >= G(11) && t < G(14) ? 0.6 : 0} color="#FFFFFF" inner={560} />
      {praise.map((s, i) => {
        const at = G(14 + 2 * i);
        const side = i % 2 ? 1 : -1;
        return <Meme key={s} s={s} t0={at} t1={G(20)} x={960 + side * 520} y={320 + i * 230} size={92} fill={i === 1 ? YELLOW : "#FFFFFF"} />;
      })}
      <Nameplate role={c.copy.groom_role} name={c.groom} t0={G(20)} />
      <Glitter bursts={[{ seed: 641, n: 90, t0: G(20.2), t1: G(21), path: (u) => [180 + 820 * u, 850], jit: 70, vel: [0, -120], grav: 160 }]} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 5 · the bride ("don't believe it? look")
export const BRIDE_FROM = 128;
export const R = (n: number) => BA(BRIDE_FROM + n);

export const BrideCall: Seg = ({ c }) => <Call text={c.copy.bride_call} S={R(0)} />;
export const BrideLegend: Seg = ({ c }) => {
  const ls = lines(c.copy.bride_legend);
  return (
    <FestiveCard t0={R(4)}>
      {ls.map((s, i) => (
        <Gold key={i} s={s} y={ls.length === 1 ? 540 : 440 + i * 210} size={i === ls.length - 1 ? 180 : 110} t0={R(4) + i * 0.4} tr={22} />
      ))}
    </FestiveCard>
  );
};
export const BrideProof: Seg = ({ c }) => {
  const t = useT();
  const eyes = pop(t, R(7.4));
  const headline = pop(t, R(7));
  return (
    <Stage t0={R(7)} color="#FFE36A">
      <T s={c.copy.bride_proof} f="brush" c={INK} x={960} y={540} a="cm" size={190} tr={26} op={headline.op} sc={headline.sc} />
      <Em ch="👀" x={1500} y={300} size={180} op={eyes.op} sc={eyes.sc} />
    </Stage>
  );
};

/** A magnifying glass searches the childhood photo, then settles on her face. */
export const BrideKid: Seg = ({ c }) => {
  const t = useT();
  const S = R(9);
  const E = R(14);
  const photo = getPhoto(c.ph.brideKid);
  const w = Math.round((1080 * photo.width) / photo.height);
  const portrait = w < 1500;
  const bw = portrait ? w : 1920;
  const fit = coverFit(photo, bw, 1080, [0.5, 0.42]);
  const fx = (portrait ? 960 - bw / 2 : 0) + (fit.face ? fit.face[0] : 0.5) * bw;
  const fy = (fit.face ? fit.face[1] : 0.4) * 1080;
  // search path: wander left, right, then land on the face
  const pts: [number, number][] = [
    [520, 300],
    [1400, 380],
    [700, 760],
    [fx, fy],
  ];
  const q = eIo3(ramp(t, S + 0.2, S + 1.4)) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(q));
  const u = eIo3(q - i);
  const lx = lerp(pts[i][0], pts[i + 1][0], u);
  const ly = lerp(pts[i][1], pts[i + 1][1], u);
  const Rr = lerp(170, 230, eOut3(ramp(t, S + 1.4, S + 1.8)));
  const base = <Snap id={c.ph.brideKid} t0={S} t1={E} push={0.02} start={1} />;
  const clip = c.clip("clip_bride");
  const captions = (
    <>
      <Meme s={c.copy.bride_kid_a} t0={S + 0.3} t1={S + 1.5} size={96} />
      <Meme s={c.copy.bride_kid_b} t0={S + 1.5} t1={E + 0.05} size={96} fill={YELLOW} />
    </>
  );
  if (clip)
    return (
      <AbsoluteFill>
        <ClipView clip={clip} t0={S} c={c} />
        {captions}
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: "brightness(0.72)" }}>{base}</div>
      <div style={{ position: "absolute", inset: 0, clipPath: `circle(${Rr}px at ${lx}px ${ly}px)` }}>
        <AbsoluteFill style={{ transform: "scale(1.9)", transformOrigin: `${lx}px ${ly}px` }}>{base}</AbsoluteFill>
      </div>
      {/* lens ring and handle */}
      <div style={{ position: "absolute", left: lx - Rr - 18, top: ly - Rr - 18, width: 2 * Rr + 36, height: 2 * Rr + 36, borderRadius: "50%", border: "18px solid #2C2420", boxShadow: `inset 0 0 0 6px ${GOLD}, 0 14px 30px rgba(0,0,0,0.45)` }} />
      <div style={{ position: "absolute", left: lx + Rr * 0.68, top: ly + Rr * 0.68, width: 210, height: 44, borderRadius: 22, background: "linear-gradient(180deg, #6B4A33, #3B2618)", transform: "rotate(45deg)", transformOrigin: "0 50%" }} />
      <div style={{ position: "absolute", left: lx - Rr * 0.55, top: ly - Rr * 0.7, width: Rr * 0.5, height: Rr * 0.16, borderRadius: "50%", background: "rgba(255,255,255,0.45)", transform: "rotate(-35deg)" }} />
      {captions}
    </AbsoluteFill>
  );
};

export const BrideHero: Seg = ({ c }) => {
  const t = useT();
  const S = R(14);
  return (
    <AbsoluteFill>
      <Snap id={c.ph.brideHero} t0={S} t1={R(24)} push={0.06} start={1.12} />
      <Flash t0={S} d={0.5} />
      <SpeedLines op={(1 - eOut3(ramp(t, S + 0.6, S + 1.6))) * 0.7} />
      <Glitter
        bursts={[{ seed: 651, n: 160, t0: S, t1: S + 0.8, path: (u) => [960 + 700 * Math.cos(u * Math.PI * 2), 480 + 380 * Math.sin(u * Math.PI * 2)], jit: 60, vel: [0, -40], grav: 60, inten: 1.2 }]}
        ambient={[{ seed: 652, n: 50, t0: S, t1: R(24), box: [200, 80, 1720, 900], inten: 0.35 }]}
      />
      <Meme s={c.copy.bride_wow} t0={S + 0.5} t1={R(20)} y={300} size={120} fill={YELLOW} />
      <Nameplate role={c.copy.bride_role} name={c.bride} t0={R(20)} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 6 · love story loading bar
export const LOVE_FROM = 152;
export const L = (n: number) => BA(LOVE_FROM + n);

const Bar: React.FC<{ pct: number; label: string; stuck: number }> = ({ pct, label, stuck }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 360, top: 900, width: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <T s={label} f="kuaile" size={44} c="#FFFFFF" shadow="0 2px 10px rgba(0,0,0,0.6)" />
        <T s={`${Math.round(pct)}%`} f="heiB" size={56} c={YELLOW} shadow="0 2px 10px rgba(0,0,0,0.6)" />
      </div>
      <div style={{ height: 40, borderRadius: 20, background: "rgba(255,255,255,0.3)", border: "4px solid #FFFFFF", overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,0.35)" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `repeating-linear-gradient(-45deg, #FF5C8A 0 22px, #FF8FB0 22px 44px)`,
            backgroundPosition: `${(frame * (stuck > 0.5 ? 0 : 3)) % 62}px 0`,
          }}
        />
      </div>
    </div>
  );
};

export const LoveLoading: Seg = ({ c }) => {
  const t = useT();
  const labels = lines(c.copy.love_steps);
  const steps = [15, 38, 62, 85];
  const k = Math.min(3, Math.max(0, Math.floor((t - L(0)) / (L(4) - L(0)))));
  const stuck = t >= L(16) && t < L(20) ? 1 : 0;
  const done = t >= L(20);
  const pct = done ? lerp(99, 100, eOut3(ramp(t, L(20), L(20.5)))) : t >= L(16) ? 99 : lerp(k ? steps[k - 1] : 0, steps[k], eOut3(ramp(t, L(4 * k), L(4 * k) + 0.8)));
  const id = done ? c.ph.proposal : c.ph.love[Math.min(k, c.ph.love.length - 1)];
  const t0 = done ? L(20) : t >= L(16) ? L(12) : L(4 * k);
  return (
    <AbsoluteFill>
      <Snap id={id} t0={t0} t1={done ? L(24) : t0 + 2.4} push={0.05} gray={stuck ? 0.6 : 0} start={done ? 1.1 : 1.06} />
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 35%)" }} />
      <T s={c.copy.love_title} f="kuaile" size={50} tr={6} c="#FFFFFF" x={80} y={64} shadow="0 2px 12px rgba(0,0,0,0.6)" />
      <Bar pct={pct} label={done ? labels[labels.length - 1] ?? "" : labels[Math.min(k, labels.length - 1)] ?? ""} stuck={stuck} />
      {stuck ? (
        <>
          <div style={{ position: "absolute", left: 1560 - 48, top: 790 - 48, width: 96, height: 96, borderRadius: "50%", border: "12px solid rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF", transform: `rotate(${t * 400}deg)` }} />
          <Meme s={c.copy.love_stuck} t0={L(16.5)} t1={L(20)} y={850} size={96} />
        </>
      ) : null}
      {done ? (
        <>
          <Flash t0={L(20)} d={0.4} />
          <Meme s={c.copy.love_done} t0={L(20.1)} t1={L(24) + 0.3} y={460} size={120} fill={YELLOW} />
          <Falling specs={[{ seed: 661, n: 120, t0: L(20), t1: L(21), kind: "paper", colors: [GOLD, "#FF5C8A", "#FFFFFF", RED], x: [200, 1720], y0: 520, burst: 900, speed: [160, 300], size: [14, 26] }]} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 7 · "and now, the happy couple"
export const NEXT_FROM = 176;
export const NextUp: Seg = ({ c }) => {
  const S = BA(NEXT_FROM);
  return (
    <FestiveCard t0={S}>
      <Gold s={c.copy.next_a} y={400} size={100} t0={S} f="kuaile" tr={20} />
      <Gold s={c.copy.next_b} y={600} size={150} t0={BA(NEXT_FROM + 4)} tr={18} />
    </FestiveCard>
  );
};

/** Gallery set caption: a red banner with a gold title chip. */
export const BannerCaption: React.FC<{ title: string; line: string; t0: number; t1: number; right: boolean }> = ({ title, line, t0, t1, right }) => {
  const t = useT();
  const p = eBack(ramp(t, t0 + 0.5, t0 + 1.0), 1.3);
  const op = eOut3(ramp(t, t0 + 0.5, t0 + 0.8)) * (1 - eIo3(ramp(t, t1 - 0.6, t1 - 0.15)));
  if (op <= 0.002) return null;
  const dx = (right ? 1 : -1) * 420 * (1 - p);
  return (
    <div
      style={{
        position: "absolute",
        [right ? "right" : "left"]: 80,
        bottom: 80,
        transform: `translateX(${dx}px)`,
        opacity: op,
        display: "flex",
        alignItems: "center",
        filter: "drop-shadow(0 14px 26px rgba(40,0,0,0.5))",
      }}
    >
      <div style={{ padding: "14px 28px", background: GOLD, borderRadius: "16px 0 0 16px" }}>
        <T s={title} f="kuaile" size={56} tr={6} c={DEEP} />
      </div>
      {line ? (
        <div style={{ padding: "18px 34px", background: `linear-gradient(180deg, #E0233C 0%, ${RED} 50%, ${DEEP} 100%)`, borderRadius: "0 16px 16px 0", border: `3px solid ${GOLD}`, borderLeft: "none" }}>
          <T s={line} f="songR" size={36} tr={4} c={CREAM} />
        </div>
      ) : null}
    </div>
  );
};

/**
 * The "offset" layout (a big portrait and a smaller one) leaves an empty band above the small photo
 * and an empty column beside it: the set's title (or a variety-show tag) goes in the band, a vertical
 * blessing with a 囍 seal in the column.
 */
export const OffsetFill: React.FC<{ boxes: { x: number; y: number; w: number; h: number }[]; flip: boolean; t0: number; t1: number; title?: string; line?: string; tag: string; sub: string; blessing: string }> = ({
  boxes,
  flip,
  t0,
  t1,
  title,
  line,
  tag,
  sub,
  blessing,
}) => {
  const t = useT();
  const small = boxes[1];
  if (!small) return null;
  const M = 70;
  const band = flip ? { x: M, y: M, w: small.x + small.w - M, h: small.y - M - 24 } : { x: small.x, y: M, w: 1920 - M - small.x, h: small.y - M - 24 };
  const col = flip ? { x: M, y: small.y, w: small.x - 30 - M, h: small.h } : { x: small.x + small.w + 30, y: small.y, w: 1920 - M - (small.x + small.w + 30), h: small.h };
  const op = eOut3(ramp(t, t0 + 0.25, t0 + 0.75)) * (1 - eIo3(ramp(t, t1 - 0.45, t1 - 0.05)));
  if (op <= 0.002) return null;
  const rise = 24 * (1 - eOut3(ramp(t, t0 + 0.25, t0 + 0.8)));
  const bx = band.x + band.w / 2;
  const by = band.y + band.h / 2 + rise;
  const chars = [...blessing.replace(/\s/g, "")];
  const step = Math.min(150, (col.h - 150) / Math.max(1, chars.length));
  return (
    <div style={{ opacity: op }}>
      {title ? (
        <>
          <T s={title} f="brush" size={118} tr={20} c={GOLD} x={bx} y={by - 34} a="cm" style={GOLD_FILL} />
          <T s={line ?? ""} f="songR" size={40} tr={6} c={CREAM} x={bx} y={by + 70} a="cm" maxW={band.w - 40} />
        </>
      ) : (
        <>
          <T s={tag} f="kuaile" size={104} tr={6} c={GOLD} x={bx} y={by - 30} a="cm" style={GOLD_FILL} />
          <T s={sub} f="kuaile" size={38} tr={6} c={CREAM} x={bx} y={by + 66} a="cm" op={0.9} maxW={band.w - 40} />
        </>
      )}
      {col.w > 180
        ? chars.map((ch, i) => (
            <T key={i} s={ch} f="brush" size={Math.min(130, step * 0.88)} c={GOLD} x={col.x + col.w / 2} y={col.y + 40 + step * (i + 0.5) - rise / 2} a="cm" style={GOLD_FILL} />
          ))
        : null}
      {col.w > 180 ? (
        <div style={{ position: "absolute", left: col.x + col.w / 2 - 46, top: col.y + col.h - 100, width: 92, height: 92, borderRadius: 12, background: "#B3121F", border: `4px solid ${GOLD}`, transform: "rotate(-6deg)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(40,0,0,0.4)" }}>
          <T s="囍" f="brush" size={66} c={GOLD} />
        </div>
      ) : null}
    </div>
  );
};

/** A single portrait on the red page: a four-character blessing on each side, like a couplet. */
export const SideBlessings: React.FC<{ box: { x: number; y: number; w: number; h: number }; t0: number; t1: number; left: string; right: string }> = ({ box, t0, t1, left, right }) => {
  const t = useT();
  const M = 70;
  const sides = [
    { text: right, x0: box.x + box.w + 30, x1: 1920 - M },
    { text: left, x0: M, x1: box.x - 30 },
  ];
  const op = eOut3(ramp(t, t0 + 0.3, t0 + 0.8)) * (1 - eIo3(ramp(t, t1 - 0.45, t1 - 0.05)));
  if (op <= 0.002 || sides.some((s) => s.x1 - s.x0 < 220)) return null;
  return (
    <div style={{ opacity: op }}>
      {sides.map((sd, k) => {
        const chars = [...sd.text.replace(/\s/g, "")];
        const cx = (sd.x0 + sd.x1) / 2;
        const step = Math.min(160, 760 / Math.max(1, chars.length));
        const y0 = 540 - (step * chars.length) / 2;
        const rise = (k ? 1 : -1) * 30 * (1 - eOut3(ramp(t, t0 + 0.3 + k * 0.15, t0 + 0.9 + k * 0.15)));
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: cx - 1, top: y0 - 70 + rise, width: 2, height: 46, background: GOLD, opacity: 0.8 }} />
            {chars.map((ch, i) => (
              <T key={i} s={ch} f="brush" size={Math.min(132, step * 0.86)} c={GOLD} x={cx} y={y0 + step * (i + 0.5) + rise} a="cm" style={GOLD_FILL} />
            ))}
            <div style={{ position: "absolute", left: cx - 1, top: y0 + step * chars.length + 24 + rise, width: 2, height: 46, background: GOLD, opacity: 0.8 }} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- 8 · countdown that waits for the signal
export const COUNT_FROM = 129;
export const K = (n: number) => BB(COUNT_FROM + n);

export const Countdown: Seg = ({ c }) => {
  const t = useT();
  const S = K(0);
  const nums = [10, 9, 8, 7, 6];
  const idx = Math.min(nums.length - 1, Math.max(0, Math.floor((t - K(1)) / (K(2) - K(1)))));
  const frozen = t >= K(6);
  const n = t < K(1) ? null : frozen ? 5 : nums[idx];
  const at = frozen ? K(6) : K(1 + idx);
  const waits = [
    { s: c.copy.wait_2, n: 8 },
    { s: c.copy.wait_3, n: 10 },
    { s: c.copy.wait_4, n: 12 },
  ];
  const clip = c.clip("clip_signal");
  return (
    <FestiveCard t0={S}>
      {clip && t >= K(6) && t < K(14) ? <ClipView clip={clip} t0={K(6)} c={c} /> : null}
      <Gold s={c.copy.count_title} y={200} size={80} t0={S} f="kuaile" tr={16} out={K(16)} />
      {n !== null && t < K(14) && !(clip && frozen) ? (
        <div style={{ filter: frozen ? "grayscale(1) brightness(0.8)" : undefined }}>
          <Gold key={n} s={String(n)} y={560} size={420} t0={at} f="avHeavy" tr={0} />
        </div>
      ) : null}
      <Meme s={c.copy.wait_1} t0={K(6)} t1={K(8)} y={900} size={120} fill={YELLOW} />
      {waits.map((w, i) => (
        <Meme key={i} s={w.s} t0={K(w.n)} t1={K(w.n + 2)} y={930} size={88} fill={i === 2 ? YELLOW : "#FFFFFF"} />
      ))}
      {t >= K(14) && t < K(19) ? (
        <>
          <Meme s={c.copy.wait_5} t0={K(14)} t1={K(19)} y={600} size={110} fill={YELLOW} />
          {[-1, 1].map((d) => (
            <Em key={d} ch="👏" x={960 + d * 640} y={800} size={180} sc={pop(t, K(14.3)).sc * (1 + 0.15 * Math.max(0, Math.sin((t - K(14)) * 18 + d)))} op={pop(t, K(14.3)).op} />
          ))}
        </>
      ) : null}
      {[3, 2, 1].map((v, i) => (t >= K(19 + i) && t < K(20 + i) ? <Gold key={v} s={String(v)} y={540} size={420} t0={K(19 + i)} f="avHeavy" tr={0} /> : null))}
      {t >= K(22) ? <Gold s={c.copy.go} y={540} size={300} t0={K(22)} tr={30} /> : null}
      <SpeedLines op={t >= K(22) ? 0.5 : 0} color={GOLD} inner={420} />
    </FestiveCard>
  );
};

/** Final card: the couple in a gold window ring, "the ceremony starts now". */
export const Finale: React.FC<{ c: Ctx; S: number; E: number }> = ({ c, S, E }) => {
  const t = useT();
  const ring = eBack(ramp(t, S, S + 0.7), 1.3);
  const photo = getPhoto(c.ph.finale);
  const fit = coverFit(photo, 520, 520, [0.5, 0.42]);
  const fade = eIo3(ramp(t, E - 0.9, E));
  return (
    <FestiveCard t0={S}>
      {[200, 1720].map((x, k) => (
        <Art key={x} src={XY39("lantern-gold")} cx={x} cy={230} w={180} h={270} origin="50% 0%" rot={swing(t, S, 8, 1.2, 5) * (k ? -1 : 1)} />
      ))}
      <div style={{ position: "absolute", left: 620 - 260, top: 540 - 260, width: 520, height: 520, borderRadius: "50%", overflow: "hidden", transform: `scale(${ring})` }}>
        <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition }} />
      </div>
      <Art src={XY39("window-ring-gold")} cx={620} cy={540} w={700} h={700} sc={ring} rot={(t - S) * 6} />
      <Gold s={c.copy.final_a} x={1330} y={440} size={120} t0={S + 0.3} tr={20} />
      <Gold s={c.copy.final_b} x={1330} y={610} size={150} t0={S + 0.7} tr={22} />
      <T s={`${c.names}  ·  ${c.date}`} f="kuaile" size={46} tr={6} c={CREAM} x={1330} y={780} a="cm" op={eOut3(ramp(t, S + 1.2, S + 1.7))} maxW={1020} wrap />
      <Falling specs={[{ seed: 671, n: 220, t0: S, t1: E, kind: "paper", colors: [GOLD, "#FFE7A3", "#FF5C8A", "#FFFFFF"], x: [0, 1920], speed: [120, 260], size: [12, 22] }]} />
      <Glitter ambient={[{ seed: 672, n: 60, t0: S, t1: E, box: [260, 120, 1660, 960], inten: 0.4 }]} />
      {fade > 0 ? <AbsoluteFill style={{ background: "#000", opacity: fade }} /> : null}
    </FestiveCard>
  );
};

/** Light grain and vignette over the photo scenes so stills and graphics sit together. */
export const Look: React.FC = () => (
  <>
    <Vignette strength={0.22} />
    <FilmGrain opacity={0.04} />
  </>
);
