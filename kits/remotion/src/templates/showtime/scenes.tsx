import React, { type CSSProperties } from "react";
import { AbsoluteFill, Img } from "remotion";
import { coverFit } from "../../core/crop";
import { clamp01, eBack, eIn3, eIo3, eOut3, lerp, ramp } from "../../core/ease";
import { fontFor } from "../../core/fonts";
import { getPhoto, photoSrc } from "../../core/manifest";
import { useT } from "../../core/time";
import { Couple } from "./toon";

/**
 * Showtime's drawing pieces: the red stage with gold fireworks, heavy gold 3D type, red-on-white flash
 * cards, countdown digits, the TV-signal opening, photo frames, the wrong-person gag, magazine
 * spreads, framed slides and the round-frame finale. All sizes are for a 1920×1080 frame.
 */

export const RED = "#B5101F";
export const RED_D = "#6E0612";
export const GOLD = "#FFD36B";
export const CREAM = "#FFF6E4";

/** A seeded generator so every layout is the same on every frame. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Context every scene gets: its card window, the beat clock and the copy. */
export interface Ctx {
  /** design seconds of beat n */
  B: (n: number) => number;
  /** card start / end beat */
  b0: number;
  b1: number;
  copy: Record<string, string>;
}

export const lines = (s: string | undefined) => (s ?? "").split("｜").map((x) => x.trim()).filter(Boolean);

/** Show children only inside [from, to). */
export const Window: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const t = useT();
  return t >= from && t < to ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

// ---------------------------------------------------------------- backgrounds
const Firework: React.FC<{ x: number; y: number; r: number; t: number; period: number; phase: number; color?: string }> = ({ x, y, r, t, period, phase, color = GOLD }) => {
  const p = (((t + phase) % period) + period) % period / period;
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

/** Drifting gold specks. */
const Specks: React.FC<{ seed: number; n: number; color?: string; t: number }> = ({ seed, n, color = "#FFE7A8", t }) => {
  const r = rng(seed);
  const dots = Array.from({ length: n }, () => ({ x: r() * 1920, y: r() * 1080, s: 2 + r() * 5, sp: 0.5 + r(), ph: r() * 6.28 }));
  return (
    <>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x + Math.sin(t * 0.4 + d.ph) * 20} cy={((d.y - t * 26 * d.sp) % 1080 + 1080) % 1080} r={d.s} fill={color} opacity={0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3 * d.sp + d.ph))} />
      ))}
    </>
  );
};

/** The festive red screen: deep red with a warm center, gold fireworks in the top corners, specks. */
export const RedStage: React.FC<{ beat: number; fireworks?: boolean }> = ({ beat, fireworks = true }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 50% 42%, #D3162A 0%, ${RED} 48%, ${RED_D} 100%)` }}>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="st-diag" width={46} height={46} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width={46} height={46} fill="transparent" />
            <rect width={2} height={46} fill="#FFFFFF" opacity={0.035} />
          </pattern>
        </defs>
        <rect width={1920} height={1080} fill="url(#st-diag)" />
        {fireworks && (
          <>
            <Firework x={190} y={170} r={150} t={beat} period={4} phase={0} />
            <Firework x={330} y={110} r={90} t={beat} period={4} phase={1.6} color="#FFB347" />
            <Firework x={1730} y={160} r={150} t={beat} period={4} phase={2} />
            <Firework x={1590} y={100} r={90} t={beat} period={4} phase={3.1} color="#FFB347" />
          </>
        )}
        <Specks seed={7} n={40} t={t} />
      </svg>
    </AbsoluteFill>
  );
};

/** White flash card with soft red confetti. */
export const WhiteStage: React.FC = () => {
  const t = useT();
  const r = rng(11);
  const bits = Array.from({ length: 26 }, () => ({ x: r() * 1920, y: r() * 1080, s: 10 + r() * 16, rot: r() * 360, sp: 0.6 + r(), c: r() > 0.5 ? "#E8364B" : "#F7B733" }));
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #FFFFFF 0%, #FFF4F0 80%, #FBE3DF 100%)" }}>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {bits.map((b, i) => (
          <rect key={i} x={b.x} y={((b.y + t * 90 * b.sp) % 1140) - 30} width={b.s} height={b.s * 0.5} fill={b.c} opacity={0.5} transform={`rotate(${b.rot + t * 120 * b.sp} ${b.x} ${((b.y + t * 90 * b.sp) % 1140) - 30})`} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- type
const HEI = (s: string) => fontFor("heiti", s, 700);

/** Heavy gold type with a deep-red 3D extrusion. */
export const Gold3D: React.FC<{ s: string; size: number; style?: CSSProperties; depth?: number }> = ({ s, size, style, depth = 9 }) => {
  const base: CSSProperties = { fontFamily: HEI(s), fontWeight: 700, fontSize: size, lineHeight: 1.08, whiteSpace: "pre", letterSpacing: size * 0.04 };
  const stroke = Math.round(size * 0.05);
  const extrude = Array.from({ length: depth }, (_, k) => `${0} ${k + 1}px 0 ${k < depth - 2 ? "#8A2A0E" : "#4A0A08"}`).join(", ");
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span style={{ ...base, color: "#B8641A", WebkitTextStroke: `${stroke}px #6B1A0A`, textShadow: `${extrude}, 0 ${depth + 10}px 26px rgba(40,0,0,0.55)` }}>{s}</span>
      <span
        style={{
          ...base, position: "absolute", left: 0, top: 0, WebkitTextStroke: `${Math.round(stroke * 0.35)}px #FFF3C4`,
          backgroundImage: "linear-gradient(180deg, #FFFBE6 0%, #FFE58C 32%, #F7B53C 58%, #FFD978 78%, #FFF2BF 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}
      >
        {s}
      </span>
    </span>
  );
};

/** Bold red type with a white rim, for the white flash cards. */
export const Red3D: React.FC<{ s: string; size: number; style?: CSSProperties }> = ({ s, size, style }) => (
  <span
    style={{
      fontFamily: HEI(s), fontWeight: 700, fontSize: size, lineHeight: 1.08, whiteSpace: "pre", letterSpacing: size * 0.04, color: "#E01E35",
      WebkitTextStroke: `${Math.round(size * 0.03)}px #B0001A`, textShadow: "0 6px 0 #FFD1D6, 0 14px 22px rgba(160,0,20,0.25)", display: "inline-block", ...style,
    }}
  >
    {s}
  </span>
);

export type Entrance = "pop" | "drop" | "zoom";

/** Characters pop (or drop, or zoom in from a blur) one after another, starting on t0. */
export const Typed: React.FC<{ s: string; size: number; t0: number; step?: number; entrance?: Entrance; red?: boolean; out?: number }> = ({ s, size, t0, step = 0.05, entrance = "pop", red = false, out }) => {
  const t = useT();
  const chars = [...s];
  const fade = out === undefined ? 1 : 1 - eIn3(ramp(t, out - 0.12, out));
  if (entrance === "zoom") {
    const p = ramp(t, t0, t0 + 0.32);
    const sc = lerp(2.4, 1, eOut3(p));
    const blur = lerp(18, 0, eOut3(p));
    return (
      <span style={{ display: "inline-block", transform: `scale(${sc})`, filter: `blur(${blur}px)`, opacity: eOut3(ramp(t, t0, t0 + 0.12)) * fade }}>
        {red ? <Red3D s={s} size={size} /> : <Gold3D s={s} size={size} />}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-block", opacity: fade, whiteSpace: "nowrap" }}>
      {chars.map((ch, i) => {
        const a = t0 + i * step;
        const p = ramp(t, a, a + 0.26);
        const op = eOut3(ramp(t, a, a + 0.08));
        const tr = entrance === "drop" ? `translateY(${lerp(-160, 0, eBack(p, 1.6))}px)` : `scale(${1 + 0.7 * (1 - eBack(p, 1.8))})`;
        return (
          <span key={i} style={{ display: "inline-block", opacity: op, transform: tr, transformOrigin: "50% 70%" }}>
            {red ? <Red3D s={ch} size={size} /> : <Gold3D s={ch} size={size} depth={Math.max(5, Math.round(size / 16))} />}
          </span>
        );
      })}
    </span>
  );
};

/** Font size that fits the longest line in `w` px. */
export const fitSize = (ls: string[], w: number, max: number) => Math.min(max, Math.floor(w / Math.max(1, ...ls.map((l) => [...l].length)) / 1.08));

/** A block of centred lines at (x, y). */
export const Lines: React.FC<{ ls: string[]; t0: number; x?: number; y: number; w?: number; max?: number; entrance?: Entrance; red?: boolean; lineGap?: number; step?: number; out?: number; align?: "center" | "left" | "right" }> = ({ ls, t0, x = 960, y, w = 900, max = 150, entrance = "pop", red = false, lineGap = 0.18, step, out, align = "center" }) => {
  const size = fitSize(ls, w, max);
  const tx = align === "center" ? "-50%" : align === "right" ? "-100%" : "0";
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(${tx}, -50%)`, textAlign: align, display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", gap: size * 0.1 }}>
      {ls.map((l, i) => (
        <Typed key={i} s={l} size={size} t0={t0 + i * lineGap} entrance={entrance} red={red} step={step} out={out} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- photos
export const Pic: React.FC<{ id: string; w: number; h: number; zoom?: number; style?: CSSProperties; gray?: number }> = ({ id, w, h, zoom = 1, style, gray = 0 }) => {
  const photo = getPhoto(id);
  const fit = coverFit(photo, w, h);
  return (
    <div style={{ width: w, height: h, overflow: "hidden", position: "relative", ...style }}>
      <Img
        src={photoSrc(photo)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: fit.transformOrigin, filter: gray ? `grayscale(${gray}) contrast(${1 + 0.15 * gray})` : undefined }}
      />
    </div>
  );
};

/** Full-screen photo with a slow push-in and a soft vignette. */
export const FullPhoto: React.FC<{ id: string; t0: number; t1: number; children?: React.ReactNode }> = ({ id, t0, t1, children }) => {
  const t = useT();
  const z = lerp(1.0, 1.07, eIo3(ramp(t, t0, t1)));
  return (
    <AbsoluteFill style={{ background: "#120306" }}>
      <Pic id={id} w={1920} h={1080} zoom={z} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(40,0,6,0.55) 100%)" }} />
      {children}
    </AbsoluteFill>
  );
};

/** White flash that fades out from t0. */
export const Flash: React.FC<{ t0: number; d?: number; color?: string }> = ({ t0, d = 0.35, color = "#FFFFFF" }) => {
  const t = useT();
  const o = t < t0 ? 0 : 1 - eOut3(ramp(t, t0, t0 + d));
  return o > 0.002 ? <AbsoluteFill style={{ background: color, opacity: o }} /> : null;
};

/** Emoji sticker (Noto Color Emoji is bundled). */
export const Em: React.FC<{ ch: string; x: number; y: number; size: number; rot?: number; op?: number; sc?: number }> = ({ ch, x, y, size, rot = 0, op = 1, sc = 1 }) =>
  op <= 0.002 ? null : (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${sc})`, fontFamily: fontFor("emoji", ch), fontSize: size, lineHeight: 1, opacity: op }}>{ch}</div>
  );

// ---------------------------------------------------------------- the opening: wedding channel on air
const Static: React.FC<{ t: number; strength?: number }> = ({ t, strength = 1 }) => {
  const seed = Math.floor(t * 30) % 97;
  return (
    <svg viewBox="0 0 960 540" width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: strength }}>
      <filter id={`noise-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={seed} />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope={1} />
        </feComponentTransfer>
      </filter>
      <rect width={960} height={540} fill="#777" />
      <rect width={960} height={540} filter={`url(#noise-${seed})`} />
      {Array.from({ length: 9 }, (_, k) => (
        <rect key={k} x={0} y={((k * 61 + t * 300) % 560) - 10} width={960} height={3 + (k % 3)} fill="#FFFFFF" opacity={0.12} />
      ))}
    </svg>
  );
};

const BARS = ["#C0C0C0", "#C0C000", "#00C0C0", "#00C000", "#C000C0", "#C00000", "#0000C0"];
const ColorBars: React.FC = () => (
  <AbsoluteFill>
    <div style={{ display: "flex", height: "68%" }}>{BARS.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}</div>
    <div style={{ display: "flex", height: "9%" }}>{["#0000C0", "#131313", "#C000C0", "#131313", "#00C0C0", "#131313", "#C0C0C0"].map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}</div>
    <div style={{ display: "flex", height: "23%" }}>{["#00214C", "#FFFFFF", "#32006A", "#131313", "#090909", "#131313", "#1D1D1D", "#131313"].map((c, i) => <div key={i} style={{ flex: i < 3 ? 1.25 : 0.6, background: c }} />)}</div>
  </AbsoluteFill>
);

const pixel = (s: string) => fontFor("heiti", s, 700);

export const Ident: React.FC<{ c: Ctx; names: string; date: string }> = ({ c, names, date }) => {
  const t = useT();
  const { B } = c;
  const lines4 = lines(c.copy.ident_go);
  if (t < B(8)) {
    // TV static, a channel number blinking in the corner
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <Static t={t} />
        <div style={{ position: "absolute", right: 90, top: 70, fontFamily: fontFor("mono", "CH-520"), fontSize: 64, color: "#7CFF7C", textShadow: "0 0 18px #3CFF3C", opacity: Math.floor(t * 2) % 2 ? 1 : 0.35 }}>CH 520</div>
        <div style={{ position: "absolute", left: 90, bottom: 80, fontFamily: pixel(c.copy.ident_search), fontSize: 54, color: "#FFFFFF", textShadow: "0 3px 0 #000" }}>{c.copy.ident_search}</div>
      </AbsoluteFill>
    );
  }
  if (t < B(16)) {
    return (
      <AbsoluteFill>
        <ColorBars />
        <div style={{ position: "absolute", left: 960, top: 470, transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.78)", padding: "22px 60px", borderRadius: 12, fontFamily: pixel(c.copy.ident_bars), fontSize: 76, color: "#FFFFFF", letterSpacing: 6 }}>
          {c.copy.ident_bars}
          <span style={{ opacity: Math.floor(t * 3) % 2 ? 1 : 0 }}>…</span>
        </div>
      </AbsoluteFill>
    );
  }
  if (t < B(24)) {
    // the couple's own channel goes live
    const p = ramp(t, B(16), B(17));
    const live = Math.floor((t - B(16)) * 2) % 2 === 0;
    return (
      <AbsoluteFill>
        <RedStage beat={(t - B(16)) / (B(1) - B(0))} />
        <div style={{ position: "absolute", left: 120, top: 90, display: "flex", alignItems: "center", gap: 18, background: "rgba(0,0,0,0.35)", padding: "12px 26px", borderRadius: 999 }}>
          <div style={{ width: 26, height: 26, borderRadius: 13, background: live ? "#FF3B3B" : "#7A1A1A", boxShadow: live ? "0 0 18px #FF3B3B" : "none" }} />
          <span style={{ fontFamily: fontFor("condensed", "LIVE"), fontWeight: 800, fontSize: 44, color: "#FFFFFF", letterSpacing: 6 }}>LIVE</span>
        </div>
        <div style={{ position: "absolute", left: 960, top: 430, transform: `translate(-50%, -50%) scale(${lerp(0.6, 1, eBack(p, 1.6))})`, opacity: eOut3(p), textAlign: "center" }}>
          <Gold3D s={names} size={120} />
          <div style={{ marginTop: 26 }}>
            <Gold3D s={c.copy.ident_channel} size={96} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 960, top: 800, transform: "translate(-50%, -50%)", fontFamily: fontFor("condensed", date), fontWeight: 800, fontSize: 64, color: CREAM, letterSpacing: 14, opacity: eOut3(ramp(t, B(18), B(19))) }}>{date}</div>
      </AbsoluteFill>
    );
  }
  // "high energy ahead": glitchy gold lines over a pulsing stage, builds into the drop
  const shake = Math.sin(t * 80) * 6 * ramp(t, B(28), B(32));
  return (
    <AbsoluteFill>
      <RedStage beat={(t - B(24)) / (B(1) - B(0))} />
      <AbsoluteFill style={{ transform: `translate(${shake}px, ${-shake / 2}px)` }}>
        <Lines ls={lines4} t0={B(24)} y={540} w={1400} max={170} entrance="zoom" lineGap={B(26) - B(24)} />
      </AbsoluteFill>
      <Static t={t} strength={0.18 * (0.5 + 0.5 * Math.sin(t * 20)) * ramp(t, B(29), B(32))} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the couple on the cards
export interface CoupleCue {
  groom?: string;
  bride?: string;
  /** layout: either side of the text (default), together in the middle, or small at the bottom */
  layout?: "sides" | "middle" | "solo" | "small";
}

export const CoupleOn: React.FC<{ c: Ctx; cue: CoupleCue }> = ({ c, cue }) => {
  const t = useT();
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const layout = cue.layout ?? "sides";
  const enter = eOut3(ramp(t, c.B(c.b0), c.B(c.b0) + 0.18));
  if (layout === "small") {
    return (
      <Couple
        t={t}
        beat={beat}
        groom={cue.groom ? { move: cue.groom, x: 150, y: 1070, h: 330 } : null}
        bride={cue.bride ? { move: cue.bride, x: 1770, y: 1070, h: 320 } : null}
      />
    );
  }
  if (layout === "middle") {
    return (
      <Couple t={t} beat={beat} groom={cue.groom ? { move: cue.groom, x: 840, y: 1070, h: 760 } : null} bride={cue.bride ? { move: cue.bride, x: 1090, y: 1070, h: 740 } : null} />
    );
  }
  if (layout === "solo") {
    // one of them in the middle, the other out of frame
    return (
      <Couple
        t={t}
        beat={beat}
        groom={cue.groom ? { move: cue.groom, x: 960, y: 1070, h: 800 } : null}
        bride={cue.bride && !cue.groom ? { move: cue.bride, x: 960, y: 1070, h: 780 } : null}
      />
    );
  }
  return (
    <AbsoluteFill style={{ transform: `translateY(${(1 - enter) * 40}px)` }}>
      <Couple t={t} beat={beat} groom={cue.groom ? { move: cue.groom, x: 300, y: 1072, h: 780 } : null} bride={cue.bride ? { move: cue.bride, x: 1620, y: 1072, h: 760 } : null} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- cards
export const GoldCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue; entrance?: Entrance }> = ({ c, text, cue, entrance }) => {
  const t = useT();
  const ls = lines(text);
  const t0 = c.B(c.b0);
  const solo = !(cue.groom && cue.bride);
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  return (
    <AbsoluteFill>
      <RedStage beat={beat} />
      {solo ? (
        <>
          <Lines ls={ls} t0={t0} x={cue.groom ? 1290 : 630} y={ls.length > 1 ? 440 : 470} w={880} max={170} entrance={entrance} />
          <Couple t={t} beat={beat} groom={cue.groom ? { move: cue.groom, x: 400, y: 1072, h: 820 } : null} bride={cue.bride && !cue.groom ? { move: cue.bride, x: 1520, y: 1072, h: 800 } : null} />
        </>
      ) : (
        <>
          <Lines ls={ls} t0={t0} y={ls.length > 1 ? 400 : 430} w={1060} max={165} entrance={entrance} />
          <CoupleOn c={c} cue={cue} />
        </>
      )}
    </AbsoluteFill>
  );
};

/** "您的工作 · 您的烦恼": one word either side of the couple in the middle (or of a solo host). */
export const SplitCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const [a, b] = lines(text);
  const t0 = c.B(c.b0);
  const half = (c.B(c.b1) - t0) / 2;
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const size = fitSize([a ?? "", b ?? ""], 600, 150);
  return (
    <AbsoluteFill>
      <RedStage beat={beat} />
      <div style={{ position: "absolute", left: 380, top: 420, transform: "translate(-50%, -50%)" }}>
        <Typed s={a ?? ""} size={size} t0={t0} entrance="drop" />
      </div>
      {b && (
        <div style={{ position: "absolute", left: 1540, top: 520, transform: "translate(-50%, -50%)" }}>
          <Typed s={b} size={size} t0={t0 + Math.min(half, 0.47)} entrance="drop" />
        </div>
      )}
      <CoupleOn c={c} cue={{ ...cue, layout: cue.groom && cue.bride ? "middle" : "solo" }} />
    </AbsoluteFill>
  );
};

export const WhiteCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const ls = lines(text);
  return (
    <AbsoluteFill>
      <WhiteStage />
      <Lines ls={ls} t0={c.B(c.b0)} y={460} w={1000} max={170} red entrance="zoom" />
      <Couple t={t} beat={beat} groom={cue.groom ? { move: cue.groom, x: 290, y: 1072, h: 760 } : null} bride={cue.bride ? { move: cue.bride, x: 1630, y: 1072, h: 740 } : null} />
      <Flash t0={c.B(c.b0)} d={0.18} />
    </AbsoluteFill>
  );
};

export const NumberCard: React.FC<{ c: Ctx; n: number; cue: CoupleCue }> = ({ c, n, cue }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const p = ramp(t, t0, t0 + 0.4);
  const sc = lerp(3.2, 1, eBack(p, 1.4));
  const wob = Math.sin((t - t0) * 9) * 4 * (1 - p);
  return (
    <AbsoluteFill>
      <RedStage beat={(t - c.B(0)) / (c.B(1) - c.B(0))} />
      <div style={{ position: "absolute", left: 960, top: 470, transform: `translate(-50%, -50%) scale(${sc}) rotate(${wob}deg)`, opacity: eOut3(ramp(t, t0, t0 + 0.1)) }}>
        <Gold3D s={String(n)} size={460} depth={22} />
      </div>
      <CoupleOn c={c} cue={cue} />
      <Flash t0={t0} d={0.22} color="#FFE9A8" />
    </AbsoluteFill>
  );
};

export const DateCard: React.FC<{ c: Ctx; iso: string; cue: CoupleCue }> = ({ c, iso, cue }) => {
  const [y, m, d] = iso.split("-");
  return <GoldCard c={c} text={`${y}年｜${m}月${d}日`} cue={cue} entrance="drop" />;
};

export const NamesCard: React.FC<{ c: Ctx; groom: string; bride: string; cue: CoupleCue }> = ({ c, groom, bride, cue }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  return (
    <AbsoluteFill>
      <RedStage beat={beat} />
      <div style={{ position: "absolute", left: 960, top: 330, transform: "translate(-50%, -50%)" }}>
        <Typed s={groom} size={150} t0={t0} entrance="drop" />
      </div>
      <div style={{ position: "absolute", left: 960, top: 470, transform: "translate(-50%, -50%)", opacity: eOut3(ramp(t, t0 + 0.3, t0 + 0.5)) }}>
        <Gold3D s="❤" size={80} />
      </div>
      <div style={{ position: "absolute", left: 960, top: 610, transform: "translate(-50%, -50%)" }}>
        <Typed s={bride} size={150} t0={t0 + 0.47} entrance="drop" />
      </div>
      <CoupleOn c={c} cue={cue} />
    </AbsoluteFill>
  );
};

/** Viewfinder snaps a photo of the couple: REC frame, focus box, shutter flash on the beat. */
export const SnapCard: React.FC<{ c: Ctx; id: string; text: string }> = ({ c, id, text }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const shot = c.B(c.b0 + 1);
  const focus = 1 - eOut3(ramp(t, t0, shot));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: `blur(${focus * 10}px)` }}>
        <Pic id={id} w={1920} h={1080} zoom={lerp(1.12, 1.02, eOut3(ramp(t, t0, c.B(c.b1))))} />
      </AbsoluteFill>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[[80, 80, 1, 1], [1840, 80, -1, 1], [80, 1000, 1, -1], [1840, 1000, -1, -1]].map(([x, y, sx, sy], i) => (
          <path key={i} d={`M ${x} ${y + sy * 90} L ${x} ${y} L ${x + sx * 90} ${y}`} stroke="#FFFFFF" strokeWidth={8} fill="none" />
        ))}
        <rect x={760 - 30 * focus} y={340 - 20 * focus} width={400 + 60 * focus} height={400 + 40 * focus} stroke={t < shot ? "#FFFFFF" : "#7CFF7C"} strokeWidth={5} fill="none" />
        <circle cx={150} cy={150} r={14} fill="#FF3B3B" opacity={Math.floor(t * 2) % 2 ? 1 : 0.3} />
      </svg>
      <div style={{ position: "absolute", left: 180, top: 128, fontFamily: fontFor("condensed", "REC"), fontWeight: 800, fontSize: 44, color: "#FFFFFF" }}>REC</div>
      <div style={{ position: "absolute", left: 960, bottom: 70, transform: "translateX(-50%)", opacity: eOut3(ramp(t, shot, shot + 0.2)) }}>
        <Gold3D s={text} size={110} />
      </div>
      <Flash t0={shot} d={0.4} />
    </AbsoluteFill>
  );
};

/** Comic beats: pointing at the audience, waiting for applause, food rain, the groom tipsy. */
export const GagCard: React.FC<{ c: Ctx; text: string; kind: string; cue: CoupleCue }> = ({ c, text, kind, cue }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const t1 = c.B(c.b1);
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const ls = lines(text);
  const r = rng(kind.length * 31);
  if (kind === "point") {
    const z = lerp(1, 1.18, eOut3(ramp(t, t0, t0 + 0.5)));
    return (
      <AbsoluteFill>
        <RedStage beat={beat} />
        <AbsoluteFill style={{ transform: `scale(${z})` }}>
          <Lines ls={ls} t0={t0} y={420} w={1000} max={150} entrance="zoom" />
          <Em ch="🫵" x={960} y={760} size={220} sc={1 + 0.08 * Math.sin(t * 14)} op={eOut3(ramp(t, t0 + 0.2, t0 + 0.4))} />
          <CoupleOn c={c} cue={cue} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  if (kind === "applause") {
    const hands = Array.from({ length: 16 }, () => ({ x: 200 + r() * 1520, y: 180 + r() * 600, s: 70 + r() * 80, d: r() * 0.8, rot: (r() - 0.5) * 40 }));
    return (
      <AbsoluteFill>
        <RedStage beat={beat} />
        {hands.map((h, i) => {
          const p = ramp(t, t0 + h.d, t0 + h.d + 0.3);
          return <Em key={i} ch="👏" x={h.x} y={h.y - 30 * p} size={h.s} rot={h.rot + Math.sin(t * 18 + i) * 12} op={eOut3(p) * (1 - eIn3(ramp(t, t1 - 0.3, t1)))} sc={lerp(0.4, 1, eBack(p, 2))} />;
        })}
        <Lines ls={ls} t0={t0} y={430} w={1000} max={150} entrance="pop" />
        <CoupleOn c={c} cue={cue} />
      </AbsoluteFill>
    );
  }
  if (kind === "food") {
    const items = ["🍗", "🦞", "🍤", "🥟", "🍰", "🍻", "🍖", "🦀", "🧧", "🍾"];
    const rain = Array.from({ length: 34 }, () => ({ x: r() * 1920, d: r() * 1.2, s: 70 + r() * 70, sp: 700 + r() * 500, rot: r() * 360, ch: items[Math.floor(r() * items.length)] }));
    return (
      <AbsoluteFill>
        <RedStage beat={beat} />
        {rain.map((f, i) => {
          const lt = t - t0 - f.d;
          return lt < 0 ? null : <Em key={i} ch={f.ch} x={f.x} y={-100 + lt * f.sp} size={f.s} rot={f.rot + lt * 200} />;
        })}
        <Lines ls={ls} t0={t0} y={420} w={1000} max={160} entrance="zoom" />
        <CoupleOn c={c} cue={cue} />
      </AbsoluteFill>
    );
  }
  // the groom had a little too much: he spins, stars circle his head, the bride shrugs
  const spin = Math.sin((t - t0) * 5) * 14;
  const stars = Array.from({ length: 5 }, (_, k) => k);
  return (
    <AbsoluteFill>
      <RedStage beat={beat} />
      <Lines ls={ls} t0={t0} x={1120} y={380} w={900} max={140} entrance="pop" />
      <Couple t={t} beat={beat} groom={{ move: "idle", x: 520, y: 1072, h: 800, spin, hold: "glass", mouth: "o" }} bride={{ move: cue.bride ?? "shrug", x: 1560, y: 1072, h: 740 }} />
      {stars.map((k) => {
        const a = (t - t0) * 4 + (k / 5) * Math.PI * 2;
        return <Em key={k} ch="⭐" x={520 + Math.cos(a) * 170 + spin * 3} y={300 + Math.sin(a) * 40} size={56} />;
      })}
      <Em ch="🥴" x={760} y={250} size={120} op={eOut3(ramp(t, t0 + 0.4, t0 + 0.6))} rot={Math.sin(t * 6) * 10} />
    </AbsoluteFill>
  );
};

/** Wrong person on screen: the childhood photo under a spotlight ("就是他！"), the record scratch
 *  freezes it grey with a red cross ("等等……搞错了！"), then a VHS rewind ("再来一次"). */
export const FakeCard: React.FC<{ c: Ctx; id: string; text: string; who: "groom" | "bride" }> = ({ c, id, text, who }) => {
  const t = useT();
  const [a, b, d] = lines(text);
  const t0 = c.B(c.b0);
  const stop = c.B(c.b0 + 4);
  const rew = c.B(c.b0 + 6);
  const t1 = c.B(c.b1);
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const frozen = t >= stop;
  const sc = lerp(0.6, 1, eBack(ramp(t, t0, t0 + 0.4), 1.5));
  const rewinding = t >= rew;
  const rw = ramp(t, rew, t1);
  if (who === "bride") {
    // the bride's gag is kind: a magnifying glass over her childhood photo — "从小就是美人胚子"
    const mx = 960 + Math.sin((t - t0) * 2.2) * 220;
    const my = 470 + Math.cos((t - t0) * 1.7) * 90;
    return (
      <AbsoluteFill>
        <RedStage beat={beat} />
        <div style={{ position: "absolute", left: 960, top: 470, transform: `translate(-50%, -50%) scale(${sc}) rotate(-3deg)`, padding: 22, background: "#FFFFFF", boxShadow: "0 24px 50px rgba(40,0,0,0.5)" }}>
          <Pic id={id} w={620} h={620} />
        </div>
        {t < stop && (
          <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <circle cx={mx} cy={my} r={130} fill="rgba(255,255,255,0.12)" stroke="#2B2B2B" strokeWidth={18} />
            <line x1={mx + 92} y1={my + 92} x2={mx + 210} y2={my + 210} stroke="#5A3A20" strokeWidth={34} strokeLinecap="round" />
          </svg>
        )}
        <div style={{ position: "absolute", left: 960, top: 940, transform: "translate(-50%, -50%)" }}>
          {t < stop ? <Typed s={a ?? ""} size={100} t0={t0 + 0.3} /> : <Typed s={b ?? ""} size={110} t0={stop} entrance="zoom" />}
        </div>
        {t >= stop && <Em ch="✨" x={1350} y={260} size={140} sc={lerp(0.3, 1, eBack(ramp(t, stop, stop + 0.4), 2))} />}
        {t >= stop && <Em ch="💖" x={560} y={300} size={120} sc={lerp(0.3, 1, eBack(ramp(t, stop + 0.15, stop + 0.55), 2))} />}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: "#0B0204" }}>
      {/* spotlight */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 34% 60% at 50% 46%, rgba(255,244,210,0.55) 0%, rgba(255,244,210,0.12) 60%, transparent 100%)" }} />
      <div
        style={{
          position: "absolute", left: 960, top: 450,
          transform: `translate(-50%, -50%) scale(${rewinding ? lerp(1, 0.2, eIn3(rw)) : sc}) rotate(${rewinding ? -720 * eIn3(rw) : frozen ? -4 : 0}deg)`,
          padding: 20, background: "#FFFFFF", boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
        }}
      >
        <Pic id={id} w={640} h={640} gray={frozen ? 1 : 0} />
        {frozen && !rewinding && (
          <svg viewBox="0 0 640 640" width={640} height={640} style={{ position: "absolute", left: 20, top: 20 }}>
            <line x1={60} y1={60} x2={580} y2={580} stroke="#E8132B" strokeWidth={46} strokeLinecap="round" opacity={eOut3(ramp(t, stop, stop + 0.15))} />
            <line x1={580} y1={60} x2={60} y2={580} stroke="#E8132B" strokeWidth={46} strokeLinecap="round" opacity={eOut3(ramp(t, stop + 0.08, stop + 0.23))} />
          </svg>
        )}
      </div>
      <div style={{ position: "absolute", left: 960, top: 930, transform: "translate(-50%, -50%)" }}>
        {!frozen && <Typed s={a ?? ""} size={120} t0={t0 + 0.47} entrance="zoom" />}
        {frozen && !rewinding && <Typed s={b ?? ""} size={120} t0={stop} entrance="zoom" />}
        {rewinding && <Typed s={d ?? ""} size={110} t0={rew} entrance="pop" />}
      </div>
      {rewinding && (
        <AbsoluteFill>
          {Array.from({ length: 6 }, (_, k) => (
            <div key={k} style={{ position: "absolute", left: 0, right: 0, top: ((k * 197 + (t - rew) * 1400) % 1180) - 60, height: 26, background: "rgba(255,255,255,0.18)" }} />
          ))}
          <div style={{ position: "absolute", left: 90, top: 70, fontFamily: fontFor("condensed", "REW"), fontWeight: 800, fontSize: 72, color: "#FFFFFF" }}>◀◀ REW</div>
        </AbsoluteFill>
      )}
      {!frozen && <Em ch="👆" x={1360} y={700} size={160} rot={-12 + Math.sin(t * 10) * 8} op={eOut3(ramp(t, t0 + 0.6, t0 + 0.8))} />}
      {frozen && !rewinding && <Em ch="😱" x={1380} y={330} size={150} sc={lerp(0.3, 1, eBack(ramp(t, stop, stop + 0.35), 2))} />}
    </AbsoluteFill>
  );
};

/** The real groom / bride: photo in a gold frame with a name plate, confetti. */
export const HeroCard: React.FC<{ c: Ctx; id: string; role: string; name: string; cue: CoupleCue }> = ({ c, id, role, name, cue }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const t1 = c.B(c.b1);
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const p = ramp(t, t0, t0 + 0.45);
  const r = rng(role.length * 17);
  const conf = Array.from({ length: 50 }, () => ({ x: r() * 1920, d: r() * 0.6, s: 12 + r() * 14, sp: 300 + r() * 300, c: [GOLD, "#FFFFFF", "#FF8FA3"][Math.floor(r() * 3)], rot: r() * 360 }));
  return (
    <AbsoluteFill>
      <RedStage beat={beat} />
      <div style={{ position: "absolute", left: 960, top: 500, transform: `translate(-50%, -50%) scale(${lerp(0.7, 1, eBack(p, 1.4))})`, opacity: eOut3(p) }}>
        <div style={{ padding: 14, background: "linear-gradient(135deg, #FFF0B8, #E7A93A 45%, #FFE38E 70%, #C98A22)", borderRadius: 20, boxShadow: "0 28px 60px rgba(40,0,0,0.55)" }}>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "6px solid #FFF6DC" }}>
            <Pic id={id} w={640} h={760} zoom={lerp(1.08, 1.0, eOut3(ramp(t, t0, t1)))} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 960, top: 930, transform: `translate(-50%, -50%) scale(${lerp(0.4, 1, eBack(ramp(t, t0 + 0.47, t0 + 0.8), 2))})`, opacity: eOut3(ramp(t, t0 + 0.47, t0 + 0.6)), display: "flex", alignItems: "center", gap: 26, background: "linear-gradient(180deg, #E3283B, #9E0A1A)", border: "4px solid #FFD36B", borderRadius: 999, padding: "14px 54px" }}>
        <span style={{ fontFamily: HEI(role), fontWeight: 700, fontSize: 52, color: "#FFE9A8" }}>{role}</span>
        <span style={{ width: 3, height: 50, background: "#FFD36B" }} />
        <span style={{ fontFamily: HEI(name), fontWeight: 700, fontSize: 64, color: "#FFFFFF", letterSpacing: 6 }}>{name}</span>
      </div>
      {conf.map((f, i) => {
        const lt = t - t0 - f.d;
        return lt < 0 ? null : <div key={i} style={{ position: "absolute", left: f.x + Math.sin(lt * 3 + i) * 30, top: -40 + lt * f.sp, width: f.s, height: f.s * 0.45, background: f.c, transform: `rotate(${f.rot + lt * 300}deg)` }} />;
      })}
      <CoupleOn c={c} cue={{ ...cue, layout: "small" }} />
    </AbsoluteFill>
  );
};

export const PhotoCard: React.FC<{ c: Ctx; id: string; caption?: string }> = ({ c, id, caption }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  return (
    <FullPhoto id={id} t0={t0} t1={c.B(c.b1)}>
      {caption && (
        <div style={{ position: "absolute", left: 960, bottom: 90, transform: "translateX(-50%)", opacity: eOut3(ramp(t, t0 + 0.3, t0 + 0.6)) }}>
          <Gold3D s={caption} size={84} />
        </div>
      )}
      <Flash t0={t0} d={0.3} />
    </FullPhoto>
  );
};

export const SparkleTitle: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const r = rng(5);
  const sp = Array.from({ length: 40 }, () => ({ x: 400 + r() * 1120, y: 200 + r() * 300, d: r() * 0.8, s: 6 + r() * 16 }));
  const sweep = ramp(t, t0, t0 + 0.9);
  return (
    <AbsoluteFill>
      <RedStage beat={(t - c.B(0)) / (c.B(1) - c.B(0))} />
      <div style={{ position: "absolute", left: 960, top: 430, transform: "translate(-50%, -50%)", WebkitMaskImage: `linear-gradient(90deg, #000 ${sweep * 120 - 20}%, transparent ${sweep * 120}%)` }}>
        <Gold3D s={lines(text).join("")} size={fitSize([lines(text).join("")], 1000, 140)} />
      </div>
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {sp.map((s, i) => {
          const tw = 0.5 + 0.5 * Math.sin((t - t0) * 10 + i);
          return t > t0 + s.d ? <path key={i} transform={`translate(${s.x} ${s.y}) scale(${s.s / 10 * tw})`} d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z" fill="#FFF3B8" /> : null;
        })}
      </svg>
      <CoupleOn c={c} cue={cue} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- wedding photos
const SCRIPT = (s: string) => fontFor("scriptThin", s, 400);
const SERIF = (s: string) => fontFor("display", s, 400);

/** A white magazine spread: script title, three tall photos sliding up one after another, a caption bar. */
export const MagazineCard: React.FC<{ c: Ctx; ids: string[]; title: string; caption: string; names: string; date: string; k: number }> = ({ c, ids, title, caption, names, date, k }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const t1 = c.B(c.b1);
  const enter = (i: number) => eOut3(ramp(t, t0 + i * 0.35, t0 + i * 0.35 + 0.6));
  const push = 1 - eOut3(ramp(t, t0, t0 + 0.5));
  const widths = k === 1 ? [640, 470, 470] : [470, 470, 640];
  return (
    <AbsoluteFill style={{ background: "#FBF8F3", transform: `translateX(${push * 220}px)` }}>
      <div style={{ position: "absolute", left: 90, top: 52, fontFamily: SCRIPT(title), fontSize: 120, color: "#9C1B26", lineHeight: 1 }}>{title}</div>
      <div style={{ position: "absolute", right: 96, top: 92, textAlign: "right", fontFamily: SERIF(names), fontSize: 34, color: "#5A4A44", letterSpacing: 4 }}>
        {names}
        <div style={{ fontSize: 24, marginTop: 8, color: "#9C7A6A", letterSpacing: 8 }}>{date}</div>
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 210, height: 720, display: "flex", gap: 34 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: widths[i], height: 720, transform: `translateY(${(1 - enter(i)) * 120}px)`, opacity: enter(i), boxShadow: "0 18px 40px rgba(60,20,20,0.22)" }}>
            <Pic id={ids[i % ids.length]} w={widths[i]} h={720} zoom={lerp(1.06, 1, eOut3(ramp(t, t0, t1)))} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, bottom: 60, display: "flex", alignItems: "baseline", gap: 30, borderTop: "3px solid #1E1E1E", paddingTop: 16 }}>
        <span style={{ fontFamily: fontFor("condensed", caption), fontWeight: 800, fontSize: 54, letterSpacing: 6, color: "#1E1E1E" }}>{caption}</span>
        <span style={{ fontFamily: SERIF("love"), fontSize: 26, color: "#8A7A72", letterSpacing: 3 }}>YOU ARE THE ONE I HAVE BEEN LOOKING FOR</span>
      </div>
    </AbsoluteFill>
  );
};

/** One wedding photo in a white rounded frame on the red stage, tilting in from the side. */
export const SlideCard: React.FC<{ c: Ctx; id: string; i: number; cue: CoupleCue }> = ({ c, id, i, cue }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const t1 = c.B(c.b1);
  const photo = getPhoto(id);
  const land = photo.width >= photo.height;
  const w = land ? 1180 : 560;
  const h = land ? 730 : 780;
  const from = i % 2 ? -1 : 1;
  const p = eOut3(ramp(t, t0, t0 + 0.45));
  const rot = (1 - p) * from * 8 + (i % 2 ? -1.5 : 1.5);
  return (
    <AbsoluteFill>
      <RedStage beat={(t - c.B(0)) / (c.B(1) - c.B(0))} fireworks={false} />
      <div style={{ position: "absolute", left: 960 + (1 - p) * from * 900, top: 470, transform: `translate(-50%, -50%) rotate(${rot}deg)`, padding: 20, background: "#FFFFFF", borderRadius: 34, boxShadow: "0 30px 70px rgba(40,0,0,0.5)" }}>
        <div style={{ borderRadius: 20, overflow: "hidden" }}>
          <Pic id={id} w={w} h={h} zoom={lerp(1.0, 1.06, eIo3(ramp(t, t0, t1)))} />
        </div>
      </div>
      <CoupleOn c={c} cue={{ ...cue, layout: "small" }} />
    </AbsoluteFill>
  );
};

/** The ending: a gold ring draws itself, the couple photo inside, the cartoon couple either side, petals. */
export const FinaleCard: React.FC<{ c: Ctx; id: string; text: string; names: string; date: string; cue: CoupleCue }> = ({ c, id, text, names, date, cue }) => {
  const t = useT();
  const t0 = c.B(c.b0);
  const t1 = c.B(c.b1);
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const draw = eIo3(ramp(t, t0, t0 + 1.2));
  const photoIn = eOut3(ramp(t, t0 + 0.6, t0 + 1.4));
  const R = 330;
  const r = rng(99);
  const petals = Array.from({ length: 40 }, () => ({ x: r() * 1920, d: r() * 6, sp: 120 + r() * 120, s: 18 + r() * 18, sw: r() * 6.28 }));
  const thanks = lines(text);
  return (
    <AbsoluteFill>
      <RedStage beat={beat} />
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {petals.map((pt, i) => {
          const lt = (t - t0 - pt.d) % 9;
          if (t - t0 < pt.d) return null;
          const y = -40 + lt * pt.sp;
          return <ellipse key={i} cx={pt.x + Math.sin(lt * 1.5 + pt.sw) * 60} cy={y} rx={pt.s * 0.55} ry={pt.s * 0.35} fill="#FF7FA6" opacity={0.75} transform={`rotate(${lt * 90 + i * 20} ${pt.x} ${y})`} />;
        })}
        <defs>
          <clipPath id="fin-circle">
            <circle cx={960} cy={440} r={R - 14} />
          </clipPath>
        </defs>
        <circle cx={960} cy={440} r={R - 14} fill="#7A0612" />
        <circle cx={960} cy={440} r={R} stroke="#FFD36B" strokeWidth={14} fill="none" strokeDasharray={2 * Math.PI * R} strokeDashoffset={(1 - draw) * 2 * Math.PI * R} transform="rotate(-90 960 440)" />
        <circle cx={960} cy={440} r={R + 22} stroke="#FFE9A8" strokeWidth={3} fill="none" opacity={draw * 0.7} />
      </svg>
      <div style={{ position: "absolute", left: 960 - (R - 14), top: 440 - (R - 14), width: (R - 14) * 2, height: (R - 14) * 2, borderRadius: "50%", overflow: "hidden", opacity: photoIn }}>
        <Pic id={id} w={(R - 14) * 2} h={(R - 14) * 2} zoom={lerp(1.15, 1.02, eOut3(ramp(t, t0, t1)))} />
      </div>
      <div style={{ position: "absolute", left: 960, top: 880, transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <Typed s={thanks[0] ?? ""} size={76} t0={t0 + 1.4} step={0.06} />
      </div>
      <div style={{ position: "absolute", left: 960, top: 990, transform: "translate(-50%, -50%)", fontFamily: HEI(names), fontWeight: 700, fontSize: 40, color: CREAM, letterSpacing: 10, opacity: eOut3(ramp(t, t0 + 2.6, t0 + 3.2)) }}>
        {names}　·　{date}
      </div>
      <Couple t={t} beat={beat} groom={{ move: cue.groom ?? "wave", x: 330, y: 1072, h: 780 }} bride={{ move: cue.bride ?? "wave", x: 1590, y: 1072, h: 760 }} />
      <Flash t0={t0} d={0.5} />
    </AbsoluteFill>
  );
};

export const WitnessCard: React.FC<{ c: Ctx; text: string; cue: CoupleCue }> = ({ c, text, cue }) => {
  const t = useT();
  const [a, b] = lines(text);
  const t0 = c.B(c.b0);
  const beat = (t - c.B(0)) / (c.B(1) - c.B(0));
  const half = c.B(c.b0 + 4);
  return (
    <AbsoluteFill>
      <RedStage beat={beat} />
      <Lines ls={t < half ? [a ?? ""] : [b ?? ""]} t0={t < half ? t0 : half} y={430} w={1000} max={140} entrance="pop" />
      <CoupleOn c={c} cue={cue} />
    </AbsoluteFill>
  );
};
