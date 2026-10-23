import React, { type CSSProperties } from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { coverFit } from "../../core/crop";
import { clamp01, eBack, eIn3, eIo3, eOut3, lerp, ramp } from "../../core/ease";
import { fontFor } from "../../core/fonts";
import { getPhoto, photoSrc } from "../../core/manifest";
import { useT } from "../../core/time";
import { graphemes, HandLine, kuaileFamily } from "./hand";

/** Bright crayon colors for the title and ending characters. */
export const CRAYON = ["#FF4D6D", "#FF8A3D", "#3DA5FF", "#43C59E", "#FFC43D", "#B66DFF", "#FF6FB5", "#4FD1C5"];
const KRAFT = "#EDCB98";
const PRINT = "#E8822A";

/** Small seeded generator so every layout is deterministic across frames and renders. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const useFrameSize = () => {
  const { width: W, height: H } = useVideoConfig();
  return { W, H, u: W / 1920 };
};

/** Show children only inside [from, to). */
export const Window: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const t = useT();
  return t >= from && t < to ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

const aspectOf = (id: string, lo = 0.72, hi = 1.5) => {
  const p = getPhoto(id);
  return Math.min(hi, Math.max(lo, p.width / p.height));
};

/** A photo cropped to a box around its faces, with an optional zoom. */
export const Pic: React.FC<{ id: string; w: number; h: number; zoom?: number; style?: CSSProperties }> = ({ id, w, h, zoom = 1, style }) => {
  const photo = getPhoto(id);
  const fit = coverFit(photo, w, h);
  return (
    <div style={{ width: w, height: h, overflow: "hidden", position: "relative", ...style }}>
      <Img
        src={photoSrc(photo)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: fit.transformOrigin }}
      />
    </div>
  );
};

/** Drifting, twinkling specks of light. `stars` spreads them over the frame as a starfield. */
export const Sparkles: React.FC<{ seed: number; count: number; from: number; stars?: boolean; strength?: number }> = ({ seed, count, from, stars = false, strength = 1 }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const r = rng(seed);
  const dots = Array.from({ length: count }, () => ({ x: r(), y: r(), s: r(), ph: r() * 6.28, sp: 0.4 + r() * 1.2, dx: (r() - 0.5) * 0.02, dy: -0.004 - r() * 0.012 }));
  const lt = t - from;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {dots.map((d, i) => {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(lt * d.sp * 3 + d.ph));
        const size = (stars ? 1.2 + d.s * 3 : 2 + d.s * 5) * u;
        const x = ((d.x + d.dx * lt) % 1 + 1) % 1;
        const y = stars ? d.y : (((d.y + d.dy * lt) % 1) + 1) % 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: x * W, top: y * H, width: size, height: size, borderRadius: "50%",
              background: stars ? "#FFFFFF" : "#FFF3D6", opacity: tw * strength * (stars ? 0.85 : 0.7),
              boxShadow: `0 0 ${size * 2.5}px rgba(255,240,210,${0.6 * tw * strength})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Large soft out-of-focus lights drifting across a dark frame, so text-only scenes keep breathing. */
export const Bokeh: React.FC<{ seed: number; from: number; count?: number; strength?: number }> = ({ seed, from, count = 14, strength = 1 }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const r = rng(seed);
  const lt = t - from;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const x0 = r(), y0 = r(), size = (70 + r() * 150) * u, vx = (r() - 0.5) * 0.05, vy = (r() - 0.5) * 0.04, ph = r() * 6.28, sp = 0.9 + r() * 1.4;
        const hue = r() < 0.5 ? "255,214,150" : r() < 0.5 ? "255,170,200" : "170,210,255";
        const x = (((x0 + vx * lt) % 1) + 1) % 1;
        const y = (((y0 + vy * lt) % 1) + 1) % 1;
        const a = (0.16 + 0.22 * (0.5 + 0.5 * Math.sin(lt * sp + ph))) * strength;
        return (
          <div key={i} style={{ position: "absolute", left: x * W - size / 2, top: y * H - size / 2, width: size, height: size, borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${hue},${a}) 0%, rgba(${hue},${a * 0.6}) 45%, rgba(${hue},0) 70%)` }} />
        );
      })}
    </AbsoluteFill>
  );
};

/** Characters that pop in one by one, each in its own crayon color and tilt, then keep bobbing. */
export const PopTitle: React.FC<{ text: string; start: number; size: number; y: number; step?: number }> = ({ text, start, size, y, step = 0.11 }) => {
  const t = useT();
  const { W } = useFrameSize();
  const chars = graphemes(text);
  const family = kuaileFamily(text);
  const tilts = [-8, 6, -4, 7, -6, 5, -7, 4];
  const lifts = [0.02, -0.1, 0.06, -0.16, 0.08, -0.04, 0.1, -0.08];
  return (
    <div style={{ position: "absolute", left: 0, width: W, top: y, transform: "translateY(-50%)", display: "flex", justifyContent: "center", fontFamily: family, fontSize: size, lineHeight: 1 }}>
      {chars.map((g, i) => {
        const a = start + i * step;
        const p = ramp(t, a, a + 0.38);
        if (p <= 0) return <span key={i} style={{ opacity: 0 }}>{g}</span>;
        const bob = Math.sin((t - a) * 2.6 + i * 1.3) * size * 0.035 * clamp01((t - a) / 0.6);
        return (
          <span
            key={i}
            style={{
              display: "inline-block", color: CRAYON[i % CRAYON.length], opacity: clamp01(p * 3),
              transform: `translateY(${lifts[i % lifts.length] * size + bob}px) rotate(${tilts[i % tilts.length] * (1 - 0.4 * eOut3(p))}deg) scale(${eBack(p, 2.2)})`,
              textShadow: `0 ${size * 0.05}px 0 rgba(0,0,0,0.35)`, margin: `0 ${size * 0.02}px`,
            }}
          >
            {g}
          </span>
        );
      })}
    </div>
  );
};

/** A path that draws itself between `a` and `b` seconds. */
const Draw: React.FC<{ d: string; a: number; b: number; color: string; width: number; fill?: string }> = ({ d, a, b, color, width, fill }) => {
  const t = useT();
  const p = eIo3(ramp(t, a, b));
  if (p <= 0) return null;
  return (
    <>
      {fill ? <path d={d} fill={fill} opacity={eOut3(ramp(t, b - 0.1, b + 0.3))} /> : null}
      <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - p} />
    </>
  );
};

// ---------------------------------------------------------------- 1. title
export const TitleScene: React.FC<{ from: number; to: number; title: string; subtitle: string }> = ({ from, to, title, subtitle }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const size = 150 * u;
  const n = graphemes(title).length;
  const done = from + 0.25 + n * 0.11 + 0.35;
  const out = 1 - eIn3(ramp(t, to - 0.45, to));
  const cy = H * 0.44;
  // doodles sit above the title's left and right thirds
  const bx = W / 2 - size * n * 0.18;
  const by = cy - size * 1.05;
  const px = W / 2 + size * n * 0.22;
  const py = cy - size * 0.95;
  const s = u;
  const sub = eOut3(ramp(t, done + 0.3, done + 0.9));
  return (
    <AbsoluteFill style={{ background: "#000", opacity: out, transform: `scale(${lerp(1, 1.05, ramp(t, from, to))})` }}>
      <Bokeh seed={5} from={from} strength={eOut3(ramp(t, from + 0.3, from + 1.5))} />
      <PopTitle text={title} start={from + 0.25} size={size} y={cy} />
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <g transform={`translate(${bx} ${by + Math.sin(t * 2) * 6 * s})`}>
          <Draw d={`M0 ${-48 * s} a ${30 * s} ${36 * s} 0 1 0 0.1 0 Z`} a={done} b={done + 0.6} color="#3DA5FF" width={4 * s} />
          <Draw d={`M${-10 * s} ${-14 * s} m0 0 l0 1 M${10 * s} ${-14 * s} l0 1 M${-11 * s} ${0} q${11 * s} ${12 * s} ${22 * s} 0`} a={done + 0.4} b={done + 0.8} color="#3DA5FF" width={4 * s} />
          <Draw d={`M0 ${24 * s} q${-14 * s} ${22 * s} ${2 * s} ${40 * s} q${14 * s} ${18 * s} ${-4 * s} ${46 * s}`} a={done + 0.5} b={done + 1.0} color="#3DA5FF" width={3 * s} />
        </g>
        <g transform={`translate(${px + Math.sin(t * 1.6) * 8 * s} ${py})`}>
          <Draw d={`M${-34 * s} ${10 * s} L${34 * s} ${-18 * s} L${-6 * s} ${22 * s} Z M${-6 * s} ${22 * s} L${-2 * s} ${4 * s} L${34 * s} ${-18 * s}`} a={done + 0.2} b={done + 0.8} color="#FFC43D" width={4 * s} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: 0, width: W, top: cy + size * 0.72, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 * u, opacity: sub, transform: `translateY(${(1 - sub) * 16 * u}px)` }}>
        <svg width={30 * u} height={30 * u} viewBox="0 0 30 30">
          <circle cx="15" cy="15" r="13" fill="#FFC43D" />
          <circle cx="10.5" cy="12" r="1.8" fill="#3A2A10" />
          <circle cx="19.5" cy="12" r="1.8" fill="#3A2A10" />
          <path d="M9 17.5 q6 6 12 0" stroke="#3A2A10" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: kuaileFamily(subtitle), fontSize: 34 * u, color: "#F5A623", letterSpacing: "0.12em" }}>{subtitle}</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 2. greeting
export const GreetingScene: React.FC<{ from: number; to: number; text: string }> = ({ from, to, text }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const n = graphemes(text).length;
  const step = Math.min(0.14, ((to - from) * 0.55) / Math.max(1, n));
  const typed = (t - from - 0.15) / step;
  const out = 1 - eIn3(ramp(t, to - 0.35, to));
  return (
    <AbsoluteFill style={{ background: "#000", opacity: out }}>
      <div style={{ position: "absolute", left: 0, width: W, top: H * 0.5, transform: `translateY(-50%) scale(${lerp(1, 1.06, ramp(t, from, to))})`, display: "flex", justifyContent: "center" }}>
        <HandLine text={text} size={76 * u} typed={typed} style={{ letterSpacing: "0.12em" }} />
      </div>
      <Bokeh seed={12} from={from} />
      <Sparkles seed={11} count={26} from={from} strength={0.6 * eOut3(ramp(t, from, from + 1))} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3. letter
export const LetterScene: React.FC<{ from: number; to: number; text: string; lineStep: number; seed?: number }> = ({ from, to, text, lineStep, seed = 21 }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const lines = text.split("\n").filter((l) => l.trim());
  const size = 58 * u;
  const lh = size * 1.65;
  const top = H / 2 - (lines.length * lh) / 2;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${lerp(1.0, 1.06, eIo3(ramp(t, from, to)))})` }}>
        {lines.map((line, i) => {
          const a = from + 0.1 + i * lineStep;
          const p = eOut3(ramp(t, a, a + 0.6));
          if (p <= 0) return null;
          return (
            <div key={i} style={{ position: "absolute", left: 0, width: W, top: top + i * lh + (1 - p) * 14 * u, display: "flex", justifyContent: "center", opacity: p, filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined }}>
              <HandLine text={line} size={size} glow={0.25} style={{ letterSpacing: "0.1em" }} />
            </div>
          );
        })}
      </AbsoluteFill>
      <Bokeh seed={seed + 1} from={from} />
      <Sparkles seed={seed} count={40} from={from} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 4. film strip
export const FilmStripScene: React.FC<{ from: number; to: number; ids: string[] }> = ({ from, to, ids }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const stripTop = H * 0.04;
  const stripH = H * 0.92;
  const band = H * 0.075;
  const frameH = stripH - band * 2;
  const frameW = frameH * 0.72;
  const gap = 36 * u;
  const pitch = frameW + gap;
  const travel = Math.max(ids.length * pitch - W + gap, W * 0.35);
  const x0 = gap * 0.5 - pitch * 0.35;
  const x = x0 - travel * ramp(t, from, to);
  const count = Math.ceil((W + travel + pitch) / pitch) + 1;
  const holeW = 22 * u;
  const holeH = 30 * u;
  const holes = Math.ceil((W + travel + pitch * 2) / (holeW * 2.2));
  const label = fontFor("condensed", "BABY FILM 400 0123456789A▸");
  const bandLine = (y: number) => (
    <div style={{ position: "absolute", left: 0, top: y, height: band, width: count * pitch }}>
      {Array.from({ length: holes }, (_, k) => (
        <div key={k} style={{ position: "absolute", left: k * holeW * 2.2, top: (band - holeH) / 2, width: holeW, height: holeH, borderRadius: 4 * u, background: "#050505" }} />
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", left: x, top: stripTop, width: count * pitch, height: stripH, background: "#1C1A18" }}>
        {bandLine(0)}
        {bandLine(stripH - band)}
        {Array.from({ length: count }, (_, k) => {
          const id = ids[k % ids.length];
          const left = k * pitch + gap / 2;
          return (
            <React.Fragment key={k}>
              <Pic id={id} w={frameW} h={frameH} zoom={1.04} style={{ position: "absolute", left, top: band, borderRadius: 6 * u }} />
              <div style={{ position: "absolute", left: left + 10 * u, top: band - 26 * u, fontFamily: label, fontSize: 18 * u, color: PRINT, letterSpacing: "0.12em", opacity: 0.9 }}>BABY FILM 400</div>
              <div style={{ position: "absolute", left: left + frameW - 60 * u, top: band - 26 * u, fontFamily: label, fontSize: 18 * u, color: PRINT, opacity: 0.9 }}>{k + 1}A</div>
              <div style={{ position: "absolute", left: left + frameW * 0.45, top: stripH - band + 4 * u, fontFamily: label, fontSize: 18 * u, color: PRINT, opacity: 0.8 }}>▸ {k + 1}</div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** A torn, deckled outline for a w × h card, as a CSS clip path. */
function deckle(w: number, h: number, jag: number, seed: number): string {
  const r = rng(seed);
  const pts: string[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(8, Math.round(len / (jag * 2.2)));
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const d = r() * jag;
      pts.push(`${(x0 + (x1 - x0) * p + nx * d).toFixed(1)} ${(y0 + (y1 - y0) * p + ny * d).toFixed(1)}`);
    }
  };
  edge(0, 0, w, 0, 0, 1);
  edge(w, 0, w, h, -1, 0);
  edge(w, h, 0, h, 0, -1);
  edge(0, h, 0, 0, 1, 0);
  return `path('M${pts.join(" L")} Z')`;
}

// ---------------------------------------------------------------- 5. milestone card
export const MilestoneScene: React.FC<{ from: number; to: number; id: string; caption: string; index: number }> = ({ from, to, id, caption, index }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const r = rng(1000 + index * 7);
  const ar = aspectOf(id, 0.78, 1.18);
  const cardH = Math.min(H * 0.86, (W * 0.5) / ar);
  const cardW = cardH * ar;
  const left = W * 0.03 + (W * 0.5 - cardW) * 0.2;
  const top = (H - cardH) / 2;
  const rot = (r() - 0.5) * 3.2;
  const pop = 1 + 0.04 * (1 - eOut3(ramp(t, from, from + 0.32)));
  const m = Math.min(cardW, cardH) * 0.045;
  const lines = caption.split("\n").filter((l) => l.trim());
  const size = 54 * u;
  const lh = size * 1.55;
  let offset = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", left, top, width: cardW, height: cardH, transform: `rotate(${rot}deg) scale(${pop})`, filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.55))" }}>
        <div style={{ position: "absolute", inset: 0, clipPath: deckle(cardW, cardH, 7 * u, 50 + index), background: `radial-gradient(ellipse at 50% 45%, #F6E2BC 55%, ${KRAFT} 78%, #B98A50 100%)` }}>
          <div style={{ position: "absolute", left: m, top: m, width: cardW - 2 * m, height: cardH - 2 * m, clipPath: deckle(cardW - 2 * m, cardH - 2 * m, 3 * u, 90 + index) }}>
            <Pic id={id} w={cardW - 2 * m} h={cardH - 2 * m} zoom={lerp(1.0, 1.07, ramp(t, from, to))} />
            <AbsoluteFill style={{ boxShadow: "inset 0 0 40px rgba(60,35,10,0.35)" }} />
          </div>
        </div>
      </div>
      {lines.map((line, i) => {
        const typed = (t - from - 0.15) / 0.055 - offset;
        offset += graphemes(line).length;
        return (
          <div key={i} style={{ position: "absolute", left: W * 0.55, width: W * 0.42, top: H / 2 - (lines.length * lh) / 2 + i * lh, display: "flex", justifyContent: "center" }}>
            <HandLine text={line} size={size} typed={typed} style={{ letterSpacing: "0.22em" }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 6. scatter collage
export const ScatterScene: React.FC<{ from: number; to: number; ids: string[] }> = ({ from, to, ids }) => {
  const t = useT();
  const { W, H } = useFrameSize();
  const r = rng(77);
  const cols = 4;
  const rows = 3;
  const cells = Array.from({ length: cols * rows }, (_, i) => i).sort(() => r() - 0.5);
  const span = (to - from) * 0.78;
  const out = 1 - eIn3(ramp(t, to - 0.4, to));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: out, transform: `translateX(${-W * 0.03 * ramp(t, from, to)}px) scale(${lerp(1, 1.06, ramp(t, from, to))})` }}>
        {ids.map((id, i) => {
          const cell = cells[i % cells.length];
          const col = cell % cols;
          const row = Math.floor(cell / cols);
          const ar = aspectOf(id);
          const w = W * (0.22 + r() * 0.08) * (ar < 1 ? 0.72 : 1);
          const h = w / ar;
          const cx = ((col + 0.5) / cols) * W * 1.08 - W * 0.04 + (r() - 0.5) * W * 0.06;
          const cy = ((row + 0.5) / rows) * H * 1.08 - H * 0.04 + (r() - 0.5) * H * 0.08;
          const a = from + (i * span) / ids.length;
          const p = eOut3(ramp(t, a, a + 0.45));
          if (p <= 0) return null;
          return (
            <div key={i} style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2 + (1 - p) * 30, opacity: p, transform: `scale(${lerp(1.18, 1, p)})`, boxShadow: "0 12px 30px rgba(0,0,0,0.6)", zIndex: i }}>
              <Pic id={id} w={w} h={h} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 7. second letter
export const Letter2Scene: React.FC<{ from: number; to: number; text: string; leadSec: number; lineStep: number }> = ({ from, to, text, leadSec, lineStep }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const lines = text.split("\n").filter((l) => l.trim());
  const size = 54 * u;
  const lh = size * 1.7;
  const top = H / 2 - (lines.length * lh) / 2;
  const first = graphemes(lines[0] ?? "").length;
  const rest = from + leadSec;
  const glow = eOut3(ramp(t, rest, rest + lineStep * lines.length));
  const last = top + lines.length * lh + 8 * u;
  const swashA = rest + lineStep * (lines.length - 1) + 0.3;
  const sw = eIo3(ramp(t, swashA, swashA + 0.8));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${lerp(1.0, 1.05, eIo3(ramp(t, from, to)))})` }}>
        {lines.map((line, i) => {
          const a = i === 0 ? from : rest + (i - 1) * lineStep;
          const typed = i === 0 ? ((t - from - 0.1) / Math.max(0.05, (leadSec * 0.85) / Math.max(1, first))) : undefined;
          const p = i === 0 ? 1 : eOut3(ramp(t, a, a + 0.55));
          if (p <= 0) return null;
          return (
            <div key={i} style={{ position: "absolute", left: 0, width: W, top: top + i * lh, display: "flex", justifyContent: "center", opacity: p, filter: p < 1 ? `blur(${(1 - p) * 5}px)` : undefined }}>
              <HandLine text={line} size={size} typed={typed} glow={0.3 + 0.7 * glow} style={{ letterSpacing: "0.08em" }} />
            </div>
          );
        })}
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          <path
            d={`M${W * 0.36} ${last} C ${W * 0.45} ${last - 10 * u}, ${W * 0.55} ${last + 6 * u}, ${W * 0.62} ${last - 2 * u} q ${-14 * u} ${10 * u} ${6 * u} ${12 * u}`}
            pathLength={1} fill="none" stroke="#FFFFFF" strokeWidth={3 * u} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - sw} opacity={0.9}
            style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))" }}
          />
        </svg>
      </AbsoluteFill>
      <Bokeh seed={34} from={from} strength={0.8} />
      <Sparkles seed={33} count={36} from={from} strength={0.4 + 0.6 * glow} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 8. floating photos
export const FloatingScene: React.FC<{ from: number; to: number; ids: string[] }> = ({ from, to, ids }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const life = 4.6;
  const span = Math.max(0.5, to - from + 0.6);
  const n = Math.max(ids.length, 24);
  const exit = eIn3(ramp(t, to - 0.45, to));
  const fringe = 14 * u * exit;
  const items = Array.from({ length: n }, (_, i) => ids[i % ids.length]).map((id, i) => {
    const s = from - 2.4 + (i * span) / n;
    const p = ramp(t, s, s + life);
    return { id, i, p, s };
  }).filter((x) => x.p > 0 && x.p < 1).sort((a, b) => a.p - b.p);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sparkles seed={44} count={160} from={from} stars />
      <AbsoluteFill style={{ transform: `scale(${1 + 0.6 * exit})`, filter: exit > 0 ? `drop-shadow(${fringe}px 0 0 rgba(255,0,70,0.6)) drop-shadow(${-fringe}px 0 0 rgba(0,190,255,0.6)) blur(${exit * 6}px)` : undefined }}>
        {items.map(({ id, i, p }) => {
          const theta = i * 2.39996 + 0.6;
          const reach = (0.06 + 0.62 * p ** 1.5) * W;
          const cx = W / 2 + Math.cos(theta) * reach;
          const cy = H / 2 + Math.sin(theta) * reach * 0.62;
          const scale = 0.22 + 1.15 * p * p;
          const ar = aspectOf(id);
          const w = W * 0.24 * scale * (ar < 1 ? 0.8 : 1);
          const h = w / ar;
          const op = Math.min(clamp01(p / 0.12), clamp01((1 - p) / 0.1));
          return (
            <div key={i} style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, opacity: op, border: `${Math.max(2, 7 * u * scale)}px solid #FFFFFF`, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
              <Pic id={id} w={w} h={h} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 9–11. photo wall and ending
export const WallScene: React.FC<{ from: number; to: number; ids: string[]; pulses: number[]; endFrom: number; ending: string; endStep: number }> = ({ from, to, ids, pulses, endFrom, ending, endStep }) => {
  const t = useT();
  const { W, H, u } = useFrameSize();
  const g = 8 * u;
  const rowH = (H - g * 4) / 3;
  const travel = W * 0.55;
  const p = ramp(t, from, to);
  const enter = 1 - ramp(t, from, from + 0.55);
  const flash = enter ** 2;
  let pulse = 0;
  for (const at of pulses) {
    if (t >= at - 0.08 && t < at + 0.9) pulse = Math.max(pulse, t < at ? ramp(t, at - 0.08, at) : Math.exp(-(t - at) / 0.22));
  }
  const scale = lerp(1, 1.3, eIn3(enter)) + 0.07 * pulse;
  const fringe = 16 * u * enter;
  const dim = 0.62 * eOut3(ramp(t, endFrom, endFrom + 1.0));
  const rows = [0, 1, 2].map((row) => {
    const dir = row % 2 === 0 ? -1 : 1;
    const tiles: { id: string; w: number }[] = [];
    let width = 0;
    let k = row * 5;
    while (width < W + travel + rowH * 2) {
      const id = ids[k % ids.length];
      const w = rowH * aspectOf(id, 0.75, 1.5);
      tiles.push({ id, w });
      width += w + g;
      k += 1;
    }
    const start = dir < 0 ? -rowH * 0.3 : -(width - W) + rowH * 0.3;
    return { row, dir, tiles, x: start + dir * travel * p * (dir < 0 ? 1 : 1) };
  });
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `brightness(${1 + 0.85 * pulse + 1.2 * flash})${fringe > 0.5 ? ` drop-shadow(${fringe}px 0 0 rgba(255,0,70,0.55)) drop-shadow(${-fringe}px 0 0 rgba(0,190,255,0.55))` : ""}` }}>
        {rows.map(({ row, tiles, x }) => {
          let left = x;
          return (
            <div key={row} style={{ position: "absolute", left: 0, top: g + row * (rowH + g), width: W, height: rowH }}>
              {tiles.map((tile, i) => {
                const el = <Pic key={i} id={tile.id} w={tile.w} h={rowH} style={{ position: "absolute", left, top: 0 }} />;
                left += tile.w + g;
                return el;
              })}
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: 0.85 * flash }} />
      {dim > 0 ? <AbsoluteFill style={{ background: "#000", opacity: dim }} /> : null}
      {t >= endFrom ? <PopTitle text={ending} start={endFrom + 0.4} size={128 * u} y={H * 0.5} step={endStep} /> : null}
    </AbsoluteFill>
  );
};
