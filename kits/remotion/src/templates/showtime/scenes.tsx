import React, { type CSSProperties } from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { coverFit } from "../../core/crop";
import { clamp01, eBack, eIn3, eIo3, eOut3, lerp, ramp } from "../../core/ease";
import { fontFor } from "../../core/fonts";
import { getPhoto, photoSrc } from "../../core/manifest";
import { useT } from "../../core/time";
import { MAG } from "./plan";
import { Couple } from "./toon";

/**
 * Showtime's drawing pieces, all for a 1920×1080 screen: the red stage with gold fireworks, heavy
 * gold type, red-on-white flash cards, countdown digits and balloons, film-clip slots, photo frames,
 * the magazine pages, framed slides and the round-frame finale.
 */

export const RED = "#B5101F";
export const RED_D = "#6E0612";
export const GOLD = "#FFD36B";
export const CREAM = "#FFF6E4";

export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every scene gets its card window (seconds), the copy and the dance beat. */
export interface Ctx {
  t0: number;
  t1: number;
  copy: Record<string, string>;
  beat: (t: number) => number;
}

export const lines = (s: string | undefined) => (s ?? "").split("｜").map((x) => x.trim()).filter(Boolean);

export const Window: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const t = useT();
  return t >= from && t < to ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

// ---------------------------------------------------------------- backgrounds
const Firework: React.FC<{ x: number; y: number; r: number; t: number; period: number; phase: number; color?: string }> = ({ x, y, r, t, period, phase, color = GOLD }) => {
  const p = ((((t + phase) % period) + period) % period) / period;
  const grow = eOut3(clamp01(p / 0.55));
  const fade = 1 - eIn3(clamp01((p - 0.35) / 0.65));
  const rays = 18;
  return (
    <g transform={`translate(${x} ${y})`} opacity={fade}>
      {Array.from({ length: rays }, (_, k) => {
        const a = (k / rays) * Math.PI * 2;
        const r0 = r * 0.18 * grow;
        const r1 = r * grow * (k % 2 ? 0.82 : 1);
        return (
          <g key={k}>
            <line x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={color} strokeWidth={4} strokeLinecap="round" />
            <circle cx={Math.cos(a) * r1} cy={Math.sin(a) * r1 + 10 * p * p} r={5} fill="#FFF2C2" />
          </g>
        );
      })}
    </g>
  );
};

const Specks: React.FC<{ seed: number; n: number; color?: string; t: number }> = ({ seed, n, color = "#FFE7A8", t }) => {
  const r = rng(seed);
  const dots = Array.from({ length: n }, () => ({ x: r() * 1920, y: r() * 1080, s: 2 + r() * 5, sp: 0.5 + r(), ph: r() * 6.28 }));
  return (
    <>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x + Math.sin(t * 0.4 + d.ph) * 20} cy={(((d.y - t * 26 * d.sp) % 1080) + 1080) % 1080} r={d.s} fill={color} opacity={0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3 * d.sp + d.ph))} />
      ))}
    </>
  );
};

/** The festive red screen: deep red, gold fireworks in the top corners, specks of light. */
export const RedStage: React.FC<{ beat: number; fireworks?: boolean }> = ({ beat, fireworks = true }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 50% 42%, #C8132A 0%, ${RED} 52%, #8E0A18 100%)` }}>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {fireworks && (
          <>
            <Firework x={200} y={180} r={150} t={beat} period={4} phase={0} />
            <Firework x={340} y={120} r={90} t={beat} period={4} phase={1.6} color="#FFB347" />
            <Firework x={1720} y={170} r={150} t={beat} period={4} phase={2} />
            <Firework x={1580} y={110} r={90} t={beat} period={4} phase={3.1} color="#FFB347" />
          </>
        )}
        <Specks seed={7} n={36} t={t} />
      </svg>
    </AbsoluteFill>
  );
};

export const WhiteStage: React.FC = () => <AbsoluteFill style={{ background: "#FFFFFF" }} />;

// ---------------------------------------------------------------- type
const HEI = (s: string) => fontFor("heiti", s, 700);

/** Heavy gold type with a deep 3D edge, as on the reference screens. */
export const Gold3D: React.FC<{ s: string; size: number; style?: CSSProperties; depth?: number }> = ({ s, size, style, depth = 9 }) => {
  const base: CSSProperties = { fontFamily: HEI(s), fontWeight: 700, fontSize: size, lineHeight: 1.1, whiteSpace: "pre", letterSpacing: size * 0.04 };
  const stroke = Math.round(size * 0.05);
  const extrude = Array.from({ length: depth }, (_, k) => `0 ${k + 1}px 0 ${k < depth - 2 ? "#9A4A10" : "#5A1406"}`).join(", ");
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span style={{ ...base, color: "#C77A22", WebkitTextStroke: `${stroke}px #7A2A0C`, textShadow: `${extrude}, 0 ${depth + 10}px 26px rgba(40,0,0,0.5)` }}>{s}</span>
      <span
        style={{
          ...base, position: "absolute", left: 0, top: 0, WebkitTextStroke: `${Math.round(stroke * 0.35)}px #FFF6D2`,
          backgroundImage: "linear-gradient(180deg, #FFFCEB 0%, #FFEDB0 40%, #F7C76A 70%, #FFE7A8 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}
      >
        {s}
      </span>
    </span>
  );
};

/** Bold red type for the white flash cards. */
export const Red3D: React.FC<{ s: string; size: number; style?: CSSProperties; soft?: boolean }> = ({ s, size, style, soft }) => (
  <span
    style={{
      fontFamily: HEI(s), fontWeight: 700, fontSize: size, lineHeight: 1.1, whiteSpace: "pre", letterSpacing: size * 0.04, color: soft ? "#F2A6B0" : "#E01E35",
      WebkitTextStroke: `${Math.round(size * 0.025)}px ${soft ? "#E88E9A" : "#C0001C"}`, display: "inline-block", ...style,
    }}
  >
    {s}
  </span>
);

export type Entrance = "pop" | "drop" | "zoom" | "type";

/** One line of text. "type": characters appear one by one over `spread` seconds, like the reference's sung words. */
export const Typed: React.FC<{ s: string; size: number; t0: number; spread?: number; entrance?: Entrance; red?: boolean }> = ({ s, size, t0, spread = 0.6, entrance = "type", red = false }) => {
  const t = useT();
  const chars = [...s];
  if (entrance === "zoom") {
    const p = ramp(t, t0, t0 + 0.28);
    return (
      <span style={{ display: "inline-block", transform: `scale(${lerp(3, 1, eOut3(p))})`, filter: `blur(${lerp(14, 0, eOut3(p))}px)`, opacity: eOut3(ramp(t, t0, t0 + 0.1)) }}>
        {red ? <Red3D s={s} size={size} /> : <Gold3D s={s} size={size} />}
      </span>
    );
  }
  const step = chars.length > 1 ? spread / (chars.length - 1) : 0;
  return (
    <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
      {chars.map((ch, i) => {
        const a = t0 + i * step;
        const p = ramp(t, a, a + 0.22);
        const op = eOut3(ramp(t, a, a + 0.06));
        const tr = entrance === "drop" ? `translateY(${lerp(-140, 0, eBack(p, 1.6))}px)` : `scale(${1 + 0.6 * (1 - eBack(p, 1.8))})`;
        return (
          <span key={i} style={{ display: "inline-block", opacity: op, transform: tr, transformOrigin: "50% 70%" }}>
            {red ? <Red3D s={ch} size={size} /> : <Gold3D s={ch} size={size} depth={Math.max(5, Math.round(size / 16))} />}
          </span>
        );
      })}
    </span>
  );
};

export const fitSize = (ls: string[], w: number, max: number) => Math.min(max, Math.floor(w / Math.max(1, ...ls.map((l) => [...l].length)) / 1.08));

export const Lines: React.FC<{ ls: string[]; t0: number; t1: number; x?: number; y: number; w?: number; max?: number; entrance?: Entrance; red?: boolean }> = ({ ls, t0, t1, x = 960, y, w = 1000, max = 160, entrance = "type", red = false }) => {
  const size = fitSize(ls, w, max);
  const total = ls.reduce((n, l) => n + [...l].length, 0);
  const spread = Math.min(0.6, Math.max(0.15, (t1 - t0) * 0.35));
  let done = 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.08 }}>
      {ls.map((l, i) => {
        const n = [...l].length;
        const start = t0 + (spread * done) / Math.max(1, total);
        done += n;
        return <Typed key={i} s={l} size={size} t0={start} spread={(spread * Math.max(0, n - 1)) / Math.max(1, total)} entrance={entrance} red={red} />;
      })}
    </div>
  );
};

// ---------------------------------------------------------------- photos
export const Pic: React.FC<{ id: string; w: number; h: number; zoom?: number; style?: CSSProperties }> = ({ id, w, h, zoom = 1, style }) => {
  const photo = getPhoto(id);
  const fit = coverFit(photo, w, h);
  return (
    <div style={{ width: w, height: h, overflow: "hidden", position: "relative", ...style }}>
      <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: fit.transformOrigin }} />
    </div>
  );
};

export const Flash: React.FC<{ t0: number; d?: number; color?: string }> = ({ t0, d = 0.3, color = "#FFFFFF" }) => {
  const t = useT();
  const o = t < t0 ? 0 : 1 - eOut3(ramp(t, t0, t0 + d));
  return o > 0.002 ? <AbsoluteFill style={{ background: color, opacity: o }} /> : null;
};

// ---------------------------------------------------------------- film-clip slots
export interface Clip {
  src: string;
  start: number;
  sound: boolean;
}
/** "clips/open.mp4" · "clips/open.mp4@12.5" (start at 12.5 s) · "…#sound" (play its own audio) → Clip; empty → null */
export const parseClip = (text: string | undefined): Clip | null => {
  const s = (text ?? "").trim();
  if (!s) return null;
  const [body, flag] = s.split("#");
  const [src, at] = body.split("@");
  return { src: src.trim(), start: Number(at) || 0, sound: (flag ?? "").trim() === "sound" };
};

/** Static with the slot's name: shown when a clip slot is empty. */
const Static: React.FC<{ t: number }> = ({ t }) => {
  const seed = Math.floor(t * 30) % 97;
  return (
    <svg viewBox="0 0 960 540" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <filter id={`noise-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={seed} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={960} height={540} fill="#777" />
      <rect width={960} height={540} filter={`url(#noise-${seed})`} />
    </svg>
  );
};

export const ClipCard: React.FC<{ c: Ctx; clip: Clip | null; label: string }> = ({ c, clip, label }) => {
  const t = useT();
  const { fps } = useVideoConfig();
  if (!clip) {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <Static t={t} />
        <div style={{ position: "absolute", left: 960, top: 540, transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.72)", padding: "24px 54px", borderRadius: 14, fontFamily: HEI(label), fontWeight: 700, fontSize: 58, color: "#FFFFFF", letterSpacing: 4, textAlign: "center" }}>
          {label}
          <div style={{ fontSize: 30, fontWeight: 400, opacity: 0.75, marginTop: 10 }}>{`${c.t0.toFixed(2)}–${c.t1.toFixed(2)} 秒 · ${(c.t1 - c.t0).toFixed(1)} 秒`}</div>
        </div>
      </AbsoluteFill>
    );
  }
  // the clip plays from its own start at the card's first frame
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={Math.round(c.t0 * fps)} layout="none">
        <OffthreadVideo src={staticFile(clip.src)} trimBefore={Math.round(clip.start * fps)} muted={!clip.sound} style={{ width: 1920, height: 1080, objectFit: "cover" }} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the couple
export interface CoupleCue {
  groom?: string;
  bride?: string;
  layout?: "sides" | "middle" | "solo" | "small" | "below";
}

export const CoupleOn: React.FC<{ c: Ctx; cue: CoupleCue }> = ({ c, cue }) => {
  const t = useT();
  const beat = c.beat(t);
  const layout = cue.layout ?? "sides";
  if (layout === "middle") return <Couple t={t} beat={beat} groom={cue.groom ? { move: cue.groom, x: 830, y: 1075, h: 720 } : null} bride={cue.bride ? { move: cue.bride, x: 1090, y: 1075, h: 700 } : null} />;
  if (layout === "solo")
    return <Couple t={t} beat={beat} groom={cue.groom ? { move: cue.groom, x: 960, y: 1075, h: 800 } : null} bride={cue.bride && !cue.groom ? { move: cue.bride, x: 960, y: 1075, h: 790 } : null} />;
  return <Couple t={t} beat={beat} groom={cue.groom ? { move: cue.groom, x: 300, y: 1075, h: 780 } : null} bride={cue.bride ? { move: cue.bride, x: 1620, y: 1075, h: 760 } : null} />;
};

/** Rows of tiny dancing couples along the bottom corners (the photo section). */
export const TinyCrowd: React.FC<{ c: Ctx }> = ({ c }) => {
  const t = useT();
  const beat = c.beat(t);
  const spots = [[90, 1075, 300], [230, 1080, 260], [1700, 1080, 260], [1830, 1075, 300]];
  return (
    <>
      {spots.map(([x, y, h], i) => (
        <Couple key={i} t={t + i} beat={beat + i * 0.5} groom={i % 2 ? null : { move: ["dance", "bounce", "kick"][i % 3], x, y, h }} bride={i % 2 ? { move: ["dance", "kick", "bounce"][i % 3], x, y, h: h * 0.97 } : null} />
      ))}
    </>
  );
};

// ---------------------------------------------------------------- cards
export const BarsCard: React.FC = () => {
  const BARS = ["#C0C0C0", "#C0C000", "#00C0C0", "#00C000", "#C000C0", "#C00000", "#0000C0"];
  return (
    <AbsoluteFill>
      <div style={{ display: "flex", height: "68%" }}>{BARS.map((col) => <div key={col} style={{ flex: 1, background: col }} />)}</div>
      <div style={{ display: "flex", height: "9%" }}>{["#0000C0", "#131313", "#C000C0", "#131313", "#00C0C0", "#131313", "#C0C0C0"].map((col, i) => <div key={i} style={{ flex: 1, background: col }} />)}</div>
      <div style={{ display: "flex", height: "23%" }}>{["#00214C", "#FFFFFF", "#32006A", "#131313", "#090909", "#131313", "#1D1D1D", "#131313"].map((col, i) => <div key={i} style={{ flex: i < 3 ? 1.25 : 0.6, background: col }} />)}</div>
    </AbsoluteFill>
  );
};

export const GoldCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue; entrance?: Entrance; flash?: boolean }> = ({ c, text, cue, entrance = "type", flash = false }) => {
  const t = useT();
  const ls = lines(text);
  const solo = !(cue.groom && cue.bride);
  const empty = !cue.groom && !cue.bride;
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      {empty ? (
        <Lines ls={ls} t0={c.t0} t1={c.t1} y={500} w={1500} max={200} entrance={entrance} />
      ) : solo ? (
        <>
          <Lines ls={ls} t0={c.t0} t1={c.t1} x={cue.groom ? 1260 : 660} y={ls.length > 1 ? 440 : 470} w={940} max={180} entrance={entrance} />
          <Couple t={t} beat={c.beat(t)} groom={cue.groom ? { move: cue.groom, x: 420, y: 1075, h: 820 } : null} bride={cue.bride && !cue.groom ? { move: cue.bride, x: 1500, y: 1075, h: 800 } : null} />
        </>
      ) : cue.layout === "below" ? (
        <>
          <Lines ls={ls} t0={c.t0} t1={c.t1} y={ls.length > 1 ? 250 : 200} w={1500} max={160} entrance={entrance} />
          <Couple t={t} beat={c.beat(t)} groom={{ move: cue.groom!, x: 760, y: 1080, h: 640 }} bride={{ move: cue.bride!, x: 1160, y: 1080, h: 620 }} />
        </>
      ) : (
        <>
          <Lines ls={ls} t0={c.t0} t1={c.t1} y={ls.length > 1 ? 400 : 430} w={1080} max={170} entrance={entrance} />
          <CoupleOn c={c} cue={cue} />
        </>
      )}
      {flash && <Flash t0={c.t0} d={0.15} />}
    </AbsoluteFill>
  );
};

/** "现在婚礼进入倒计时": one line across the screen, the bride dancing in the middle in front of it. */
export const BrideLineCard: React.FC<{ c: Ctx; text: string }> = ({ c, text }) => {
  const t = useT();
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      <Lines ls={lines(text)} t0={c.t0} t1={c.t1} y={470} w={1600} max={150} />
      <Couple t={t} beat={c.beat(t)} bride={{ move: "dance", x: 1010, y: 1075, h: 860 }} groom={t > c.t0 + 1.3 ? { move: "cheerA", x: 880, y: 1075, h: 860, opacity: eOut3(ramp(t, c.t0 + 1.3, c.t0 + 1.5)) } : null} />
    </AbsoluteFill>
  );
};

/** Two words, one either side: of the dancing couple, or of the groom / bride alone. */
export const SplitCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const parts = lines(text);
  const [a, b] = parts.length > 1 ? parts : [parts[0] ?? "", ""];
  const half = (c.t1 - c.t0) / 2;
  const size = fitSize([a, b], 560, 170);
  const stack = (s: string) => (s.length > 2 && s.length <= 4 ? [s.slice(0, 2), s.slice(2)] : [s]);
  const both = cue.groom && cue.bride;
  const word = (s: string, x: number, y: number, t0: number) => (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {(both ? stack(s) : [s]).map((p, i) => <Typed key={i} s={p} size={size} t0={t0 + i * 0.12} spread={Math.min(0.3, half * 0.5)} />)}
    </div>
  );
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      {word(a, both ? 380 : 470, both ? 440 : 470, c.t0)}
      {b && word(b, both ? 1540 : 1450, both ? 520 : 520, c.t0 + Math.min(half, 0.5))}
      <CoupleOn c={c} cue={{ ...cue, layout: both ? "middle" : "solo" }} />
    </AbsoluteFill>
  );
};

/** "请 暂时 忘记": single words scattered round the couple. */
export const SpreadCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const words = lines(text);
  const n = words.length;
  const spots = words.map((_, i) => [960 + (i - (n - 1) / 2) * 560, 520]);
  const step = (c.t1 - c.t0) * 0.6 / Math.max(1, words.length - 1);
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      {words.map((w, i) => (
        <div key={i} style={{ position: "absolute", left: spots[i % spots.length][0], top: spots[i % spots.length][1], transform: "translate(-50%, -50%)" }}>
          <Typed s={w} size={220} t0={c.t0 + i * step} spread={0.15} entrance="zoom" />
        </div>
      ))}
      <CoupleOn c={c} cue={{ ...cue, layout: "middle" }} />
    </AbsoluteFill>
  );
};

export const WhiteCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue; soft?: boolean }> = ({ c, text, cue, soft }) => {
  const t = useT();
  const ls = lines(text);
  return (
    <AbsoluteFill>
      <WhiteStage />
      <div style={{ position: "absolute", left: 960, top: 470, transform: "translate(-50%, -50%)", display: "flex", gap: 40 }}>
        {ls.map((l, i) => <Typed key={i} s={l} size={fitSize([ls.join("  ")], 1000, 170)} t0={c.t0 + i * 0.15} entrance="zoom" red />)}
      </div>
      <Couple t={t} beat={c.beat(t)} groom={cue.groom ? { move: cue.groom, x: 300, y: 1075, h: 780 } : null} bride={cue.bride ? { move: cue.bride, x: 1620, y: 1075, h: 760 } : null} />
      {soft && <AbsoluteFill style={{ background: "rgba(255,255,255,0.0)" }} />}
    </AbsoluteFill>
  );
};

export const NumberCard: React.FC<{ c: Ctx; n: number; cue: CoupleCue; white?: boolean }> = ({ c, n, cue, white }) => {
  const t = useT();
  const p = ramp(t, c.t0, c.t0 + 0.12);
  const sc = lerp(3.6, 1, eOut3(p));
  return (
    <AbsoluteFill>
      {white ? <WhiteStage /> : <RedStage beat={c.beat(t)} />}
      <div style={{ position: "absolute", left: 960, top: 500, transform: `translate(-50%, -50%) scale(${sc})`, opacity: eOut3(ramp(t, c.t0, c.t0 + 0.08)) }}>
        {white ? <Red3D s={String(n)} size={300} /> : <Gold3D s={String(n)} size={460} depth={18} />}
      </div>
      <Couple t={t} beat={c.beat(t)} groom={cue.groom ? { move: cue.groom, x: 520, y: 1075, h: 760 } : null} bride={cue.bride ? { move: cue.bride, x: 1400, y: 1075, h: 740 } : null} />
    </AbsoluteFill>
  );
};

/** 3 · 2 · 1 on balloons rising past the bride. */
export const BalloonsCard: React.FC<{ c: Ctx }> = ({ c }) => {
  const t = useT();
  const marks: [string, number, string][] = [["3", 67.85, "#E9F2FF"], ["2", 68.85, "#FFD9E6"], ["1", 69.85, "#FFE4EC"]];
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      {marks.map(([n, at, col], i) => {
        const lt = t - at;
        if (lt < -0.2 || lt > 0.9) return null;
        const y = lerp(1180, -260, clamp01((lt + 0.2) / 1.1));
        const x = 860 + i * 120;
        return (
          <div key={n} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", fontFamily: fontFor("condensed", n), fontWeight: 800, fontSize: 280, color: col, textShadow: "0 8px 0 rgba(0,0,0,0.12), inset 0 0 0 #fff", WebkitTextStroke: "6px #FFFFFF" }}>
            {n}
            <div style={{ position: "absolute", left: "50%", top: "92%", width: 3, height: 260, background: "rgba(255,255,255,0.8)" }} />
          </div>
        );
      })}
      <Couple t={t} beat={c.beat(t)} bride={{ move: "cheer", x: 980, y: lerp(1500, 1075, eOut3(ramp(t, c.t0, c.t0 + 0.6))), h: 760 }} />
    </AbsoluteFill>
  );
};

export const DateCard: React.FC<{ c: Ctx; iso: string }> = ({ c, iso }) => {
  const [y, m, d] = iso.split("-");
  const t = useT();
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      <div style={{ position: "absolute", left: 960, top: 520, transform: "translate(-50%, -50%)", textAlign: "center", fontFamily: HEI("年月日0123456789"), fontWeight: 700, fontSize: 210, lineHeight: 1.15, color: CREAM }}>
        <div>{`${y}年`}</div>
        <div>{`${m}月${d}日`}</div>
      </div>
    </AbsoluteFill>
  );
};

export const NamesCard: React.FC<{ c: Ctx; groom: string; bride: string; cue: CoupleCue }> = ({ c, groom, bride, cue }) => {
  const t = useT();
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      <div style={{ position: "absolute", left: 960, top: 360, transform: "translate(-50%, -50%)" }}>
        <Typed s={groom} size={170} t0={c.t0} spread={0.2} entrance="drop" />
      </div>
      <div style={{ position: "absolute", left: 960, top: 640, transform: "translate(-50%, -50%)" }}>
        <Typed s={bride} size={170} t0={c.t0 + 0.2} spread={0.2} entrance="drop" />
      </div>
      <Couple t={t} beat={c.beat(t)} groom={{ move: cue.groom ?? "wave", x: 330, y: 1075, h: 820 }} bride={{ move: cue.bride ?? "wave", x: 1600, y: 1075, h: 800 }} />
    </AbsoluteFill>
  );
};

/** "一表人才于一体": huge type scrolling right to left past the dancing groom. */
export const MarqueeCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const s = lines(text).join("");
  const size = 300;
  const width = [...s].length * size * 1.04;
  const run = c.t1 - c.t0 - 0.5;
  const x = lerp(1920 + 40, -width - 40, clamp01((t - c.t0 - 0.2) / run));
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} fireworks={false} />
      <div style={{ position: "absolute", left: x, top: 330, whiteSpace: "nowrap" }}>
        <Gold3D s={s} size={size} depth={18} />
      </div>
      <Couple t={t} beat={c.beat(t)} groom={{ move: cue.groom ?? "dance", x: 960, y: 1075, h: 860 }} />
    </AbsoluteFill>
  );
};

export const PhotoCard: React.FC<{ c: Ctx; id: string }> = ({ c, id }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: "#2A0508" }}>
      <Pic id={id} w={1920} h={1080} zoom={lerp(1.0, 1.05, eIo3(ramp(t, c.t0, c.t1)))} />
    </AbsoluteFill>
  );
};

/** "下面一起见证": the couple close together in the middle, hearts floating up. */
export const HeartsCard: React.FC<{ c: Ctx; text: string }> = ({ c, text }) => {
  const t = useT();
  const r = rng(3);
  const hearts = Array.from({ length: 10 }, () => ({ x: 640 + r() * 640, d: r() * 1.2, s: 50 + r() * 50 }));
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      <Lines ls={lines(text)} t0={c.t0} t1={c.t1} y={250} w={1300} max={150} />
      <Couple t={t} beat={c.beat(t)} groom={{ move: "heart", x: 860, y: 1100, h: 700 }} bride={{ move: "heart", x: 1060, y: 1100, h: 680 }} />
      {hearts.map((h, i) => {
        const lt = t - c.t0 - h.d;
        return lt < 0 ? null : <div key={i} style={{ position: "absolute", left: h.x, top: 880 - lt * 260, fontFamily: fontFor("emoji", "❤️"), fontSize: h.s, opacity: 1 - clamp01((lt - 0.9) / 0.5) }}>❤️</div>;
      })}
    </AbsoluteFill>
  );
};

/** A line that sweeps in with glitter ("我们的幸福时刻吧"). */
export const GlitterCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const s = lines(text).join("");
  const sweep = ramp(t, c.t0, c.t0 + 0.8);
  const r = rng(5);
  const sp = Array.from({ length: 50 }, () => ({ x: 200 + r() * 1520, y: 200 + r() * 260, s: 6 + r() * 14, ph: r() * 6 }));
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      <div style={{ position: "absolute", left: 960, top: 330, transform: "translate(-50%, -50%)", WebkitMaskImage: `linear-gradient(90deg, #000 ${sweep * 120 - 20}%, transparent ${sweep * 120}%)` }}>
        <Gold3D s={s} size={fitSize([s], 1600, 170)} />
      </div>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {sp.map((p, i) => <path key={i} transform={`translate(${p.x} ${p.y}) scale(${(p.s / 10) * (0.4 + 0.6 * Math.abs(Math.sin((t - c.t0) * 8 + p.ph)))})`} d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z" fill="#FFF3B8" />)}
      </svg>
      <Couple t={t} beat={c.beat(t)} groom={{ move: cue.groom ?? "kick", x: 760, y: 1075, h: 560 }} bride={{ move: cue.bride ?? "dance", x: 1200, y: 1075, h: 560 }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- wedding photos
const SCRIPT = (s: string) => fontFor("scriptThin", s, 400);
const SERIF = (s: string) => fontFor("display", s, 400);

/** The white magazine pages: three tall photos slide in; the first is replaced halfway with the caption
 *  changing; the page turns to a second spread with a line of text along the top. */
export const MagazineCard: React.FC<{ c: Ctx; ids: string[]; captions: string[]; header: string; script: string }> = ({ c, ids, captions, header, script }) => {
  const t = useT();
  const id = (i: number) => ids[i % ids.length];
  const page = (photoIds: string[], t0: number, cap: string | null, top: string | null, swapAt?: number, swapId?: string) => {
    const col = (i: number) => {
      const p = eOut3(ramp(t, t0 + i * 0.18, t0 + i * 0.18 + 0.5));
      const showSwap = swapAt !== undefined && i === 0 && t >= swapAt;
      const sw = showSwap ? eOut3(ramp(t, swapAt!, swapAt! + 0.35)) : 0;
      return (
        <div key={i} style={{ position: "relative", width: 560, height: 820, overflow: "hidden", transform: `translateY(${(1 - p) * (i % 2 ? -900 : 900)}px)` }}>
          <Pic id={photoIds[i]} w={560} h={820} />
          {showSwap && <div style={{ position: "absolute", inset: 0, transform: `translateX(${(1 - sw) * -560}px)` }}><Pic id={swapId!} w={560} h={820} /></div>}
        </div>
      );
    };
    return (
      <AbsoluteFill style={{ background: "#FFFFFF" }}>
        {top && <div style={{ position: "absolute", left: 1000, top: 26, fontFamily: HEI(top), fontWeight: 700, fontSize: 34, color: "#3A2A2A", letterSpacing: 8 }}>{top}</div>}
        <div style={{ position: "absolute", left: 60, top: top ? 90 : 60, display: "flex", gap: 40 }}>{[0, 1, 2].map(col)}</div>
        <div style={{ position: "absolute", left: 150, top: top ? 150 : 120, fontFamily: SCRIPT(script), fontSize: 64, color: "#FFF6E4", textShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>{script}</div>
        {cap && (
          <div style={{ position: "absolute", left: 60, right: 60, bottom: 52, display: "flex", alignItems: "baseline", gap: 26 }}>
            <span style={{ fontFamily: fontFor("condensed", cap), fontWeight: 800, fontSize: 64, letterSpacing: 2, color: "#1A1A1A" }}>{cap}</span>
            <span style={{ fontFamily: SERIF("love"), fontSize: 24, color: "#8A7A72", letterSpacing: 3 }}>I'LL LOVE YOU AS LONG AS I LIVE</span>
          </div>
        )}
      </AbsoluteFill>
    );
  };
  const enter = eOut3(ramp(t, MAG.enter, MAG.pageA + 0.3));
  if (t < MAG.flip) {
    const cap = t < MAG.swap ? captions[0] ?? "" : captions[1] ?? captions[0] ?? "";
    return <AbsoluteFill style={{ transform: `translateX(${(1 - enter) * 1920}px)` }}>{page([id(0), id(1), id(2)], MAG.pageA, cap, null, MAG.swap, id(3))}</AbsoluteFill>;
  }
  // the page turns: a strip slides across, then the second spread
  const turn = eIo3(ramp(t, MAG.flip, MAG.pageB));
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      {t < MAG.pageB ? (
        <div style={{ position: "absolute", left: lerp(1920, 560, turn), top: 120, width: 560, height: 820, overflow: "hidden", transform: `rotate(${(1 - turn) * 6}deg)` }}>
          <Pic id={id(4)} w={560} h={820} />
        </div>
      ) : (
        page([id(5), id(4), id(6)], MAG.pageB - 0.4, null, header)
      )}
    </AbsoluteFill>
  );
};

export const BurstCard: React.FC<{ c: Ctx; text: string }> = ({ c, text }) => {
  const t = useT();
  const s = lines(text).join("");
  const r = rng(13);
  const sparks = Array.from({ length: 60 }, () => ({ a: r() * Math.PI * 2, sp: 300 + r() * 600, s: 4 + r() * 8 }));
  const lt = t - c.t0;
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {sparks.map((p, i) => <circle key={i} cx={420 + Math.cos(p.a) * p.sp * lt} cy={300 + Math.sin(p.a) * p.sp * lt + 200 * lt * lt} r={p.s} fill="#FFE08A" opacity={1 - clamp01(lt / 1.6)} />)}
        <circle cx={420} cy={300} r={120 * (1 - clamp01(lt / 0.8))} fill="#FFF3C0" opacity={0.85} />
      </svg>
      <div style={{ position: "absolute", left: 960, top: 300, transform: "translate(-50%, -50%)", WebkitMaskImage: `linear-gradient(90deg, #000 ${ramp(t, c.t0 + 0.3, c.t0 + 1.2) * 120 - 20}%, transparent ${ramp(t, c.t0 + 0.3, c.t0 + 1.2) * 120}%)` }}>
        <Gold3D s={s} size={fitSize([s], 1400, 170)} />
      </div>
      <Couple t={t} beat={c.beat(t)} groom={{ move: "sit", x: 1060, y: 1000, h: 640 }} bride={{ move: "heart", x: 820, y: 1075, h: 640 }} />
    </AbsoluteFill>
  );
};

/** Wedding photos in a white rounded frame on red: two side by side, or one landscape; tiny couples dance below. */
export const FrameCard: React.FC<{ c: Ctx; ids: string[] }> = ({ c, ids }) => {
  const t = useT();
  const p = eOut3(ramp(t, c.t0, c.t0 + 0.35));
  const pair = ids.length > 1;
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} fireworks={false} />
      <div style={{ position: "absolute", left: 960, top: 520, transform: `translate(-50%, -50%) scale(${lerp(0.92, 1, p)})`, opacity: lerp(0.4, 1, p), padding: 22, background: "#FFFFFF", borderRadius: 40, display: "flex", gap: 22, boxShadow: "0 24px 60px rgba(40,0,0,0.45)" }}>
        {pair ? (
          <>
            <div style={{ borderRadius: 24, overflow: "hidden" }}><Pic id={ids[0]} w={980} h={880} zoom={lerp(1.0, 1.05, eIo3(ramp(t, c.t0, c.t1)))} /></div>
            <div style={{ borderRadius: 24, overflow: "hidden" }}><Pic id={ids[1]} w={620} h={880} zoom={lerp(1.0, 1.05, eIo3(ramp(t, c.t0, c.t1)))} /></div>
          </>
        ) : (
          <div style={{ borderRadius: 24, overflow: "hidden" }}><Pic id={ids[0]} w={1640} h={900} zoom={lerp(1.0, 1.05, eIo3(ramp(t, c.t0, c.t1)))} /></div>
        )}
      </div>
      <TinyCrowd c={c} />
    </AbsoluteFill>
  );
};

/** The ending: a gold ring draws itself round the couple photo, the cartoon couple either side
 *  (with gift bags, then waving), petals, and the thank-you line. */
export const FinaleCard: React.FC<{ c: Ctx; id: string; text: string }> = ({ c, id, text }) => {
  const t = useT();
  const draw = eIo3(ramp(t, c.t0, c.t0 + 1.4));
  const photoIn = eOut3(ramp(t, c.t0 + 0.8, c.t0 + 1.8));
  const R = 330;
  const cx = 960;
  const cy = 430;
  const r = rng(99);
  const petals = Array.from({ length: 36 }, () => ({ x: r() * 1920, d: r() * 8, sp: 120 + r() * 120, s: 18 + r() * 18, sw: r() * 6.28 }));
  const later = t > 185.7;
  return (
    <AbsoluteFill>
      <RedStage beat={c.beat(t)} />
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {petals.map((pt, i) => {
          if (t - c.t0 < pt.d) return null;
          const lt = (t - c.t0 - pt.d) % 9;
          const y = -40 + lt * pt.sp;
          return <ellipse key={i} cx={pt.x + Math.sin(lt * 1.5 + pt.sw) * 60} cy={y} rx={pt.s * 0.55} ry={pt.s * 0.35} fill="#FF8FB4" opacity={0.8} transform={`rotate(${lt * 90 + i * 20} ${pt.x} ${y})`} />;
        })}
        <circle cx={cx} cy={cy} r={R - 10} fill="#8E0A18" />
        <circle cx={cx} cy={cy} r={R} stroke="#F6C453" strokeWidth={16} fill="none" strokeDasharray={2 * Math.PI * R} strokeDashoffset={(1 - draw) * 2 * Math.PI * R} transform={`rotate(-90 ${cx} ${cy})`} />
      </svg>
      <div style={{ position: "absolute", left: cx - (R - 10), top: cy - (R - 10), width: (R - 10) * 2, height: (R - 10) * 2, borderRadius: "50%", overflow: "hidden", opacity: photoIn }}>
        <Pic id={id} w={(R - 10) * 2} h={(R - 10) * 2} zoom={lerp(1.12, 1.02, eOut3(ramp(t, c.t0, c.t0 + 6)))} />
      </div>
      <div style={{ position: "absolute", left: 960, top: 880, transform: "translate(-50%, -50%)", fontFamily: HEI(text), fontWeight: 700, fontSize: 74, color: "#FFFFFF", letterSpacing: 6, textShadow: "0 4px 10px rgba(60,0,0,0.5)", opacity: eOut3(ramp(t, c.t0 + 1.6, c.t0 + 2.2)) }}>{lines(text).join("")}</div>
      <Couple
        t={t}
        beat={c.beat(t)}
        groom={{ move: later ? "wave" : "dance", x: 300, y: 1075, h: 800, hold: later ? null : "glass" }}
        bride={{ move: later ? "wave" : "dance", x: 1620, y: 1075, h: 780 }}
      />
    </AbsoluteFill>
  );
};
