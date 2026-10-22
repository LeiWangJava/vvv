import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, random, useVideoConfig } from "remotion";
import { useT } from "../core/time";

/**
 * Canvas port of the Python engine's glitter (sparkle_burst / ambient): additive Gaussian glow
 * with a soft halo, gravity, twinkle, and occasional 4-point stars. Drawn with "lighter" and
 * added onto the frame with plus-lighter, so highlights bloom like light instead of paint.
 */

type Pt = [number, number];

export interface Burst {
  seed: number;
  n: number;
  /** particles are born between t0 and t1, in path order */
  t0: number;
  t1: number;
  /** birth point along the path for u ∈ [0, 1] */
  path: (u: number) => Pt;
  jit?: number;
  life?: [number, number];
  vel?: Pt;
  grav?: number;
  rsize?: [number, number];
  starP?: number;
  starLen?: [number, number];
  inten?: number;
  goldP?: number;
}

export interface Ambient {
  seed: number;
  n: number;
  t0: number;
  t1: number;
  box: [number, number, number, number];
  drift?: Pt;
  rsize?: [number, number];
  inten?: number;
}

const GOLD = "255, 214, 140";
const WHITE = "255, 247, 235";

type Table = Record<"u" | "jx" | "jy" | "vx" | "vy" | "life" | "size" | "star" | "ph" | "fr" | "col" | "rot", Float64Array>;
const TABLES = new Map<string, Table>();

function table(seed: number, n: number): Table {
  const key = `${seed}:${n}`;
  const hit = TABLES.get(key);
  if (hit) return hit;
  const uni = (k: string) => Float64Array.from({ length: n }, (_, i) => random(`${seed}-${k}-${i}`));
  const normal = (k: string) =>
    Float64Array.from({ length: n }, (_, i) => {
      const a = Math.max(1e-9, random(`${seed}-${k}a-${i}`));
      const b = random(`${seed}-${k}b-${i}`);
      return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
    });
  const t: Table = {
    u: uni("u").sort(),
    jx: normal("jx"),
    jy: normal("jy"),
    vx: normal("vx"),
    vy: normal("vy"),
    life: uni("life"),
    size: uni("size").map((v) => v ** 2.2),
    star: uni("star"),
    ph: uni("ph").map((v) => v * 6.28),
    fr: uni("fr").map((v) => 0.8 + v * 2.2),
    col: uni("col"),
    rot: uni("rot"),
  };
  TABLES.set(key, t);
  return t;
}

/** Gaussian dot, sigma r, peak alpha a (additive). */
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
  const s = Math.max(0.35, r);
  const R = s * 3;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(${col},${Math.min(1, a)})`);
  g.addColorStop(1 / 3, `rgba(${col},${Math.min(1, a * 0.607)})`);
  g.addColorStop(2 / 3, `rgba(${col},${Math.min(1, a * 0.135)})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
}

/** 4-point twinkle star (two exponential-falloff arms + core). */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, col: string, a: number, ang: number) {
  const w = Math.max(0.6, 0.06 * L);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  for (const rot of [0, Math.PI / 2]) {
    ctx.save();
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(-1.2 * L, 0, 1.2 * L, 0);
    const k = 0.8 * a;
    const stops: [number, number][] = [[0, 0], [0.15, 0.05], [0.27, 0.14], [0.38, 0.37], [0.5, 1], [0.62, 0.37], [0.73, 0.14], [0.85, 0.05], [1, 0]];
    for (const [o, v] of stops) g.addColorStop(o, `rgba(${col},${Math.min(1, k * v)})`);
    ctx.fillStyle = g;
    ctx.fillRect(-1.2 * L, -w, 2.4 * L, 2 * w);
    ctx.restore();
  }
  ctx.restore();
  glow(ctx, x, y, 0.12 * L, col, a);
}

function drawBurst(ctx: CanvasRenderingContext2D, t: number, b: Burst) {
  const {
    seed, n, t0, t1, path, jit = 40, life = [0.8, 2.2], vel = [40, 30], grav = 25,
    rsize = [0.7, 3.2], starP = 0.12, starLen = [8, 26], inten = 1, goldP = 0.65,
  } = b;
  const d = table(seed, n);
  for (let i = 0; i < n; i++) {
    const tb = t0 + (t1 - t0) * d.u[i];
    const age = t - tb;
    const lf = life[0] + (life[1] - life[0]) * d.life[i];
    if (age < 0 || age > lf) continue;
    const [px, py] = path(d.u[i]);
    const x = px + jit * d.jx[i] + vel[0] * d.vx[i] * age;
    const y = py + jit * d.jy[i] + vel[1] * d.vy[i] * age + 0.5 * grav * age * age;
    const env = Math.min(1, age / 0.12) * (1 - age / lf) ** 1.4;
    const tw = 0.55 + 0.45 * Math.sin(6.28 * d.fr[i] * age + d.ph[i]);
    const col = d.col[i] < goldP ? GOLD : WHITE;
    const a = inten * env * tw;
    if (a < 0.01) continue;
    const r = rsize[0] + (rsize[1] - rsize[0]) * d.size[i];
    glow(ctx, x, y, r, col, a * 0.9);
    glow(ctx, x, y, r * 3.2, col, a * 0.12);
    if (d.star[i] < starP) {
      const L = starLen[0] + (starLen[1] - starLen[0]) * d.size[i];
      star(ctx, x, y, L * (0.6 + 0.4 * tw), col, a * 0.8, d.rot[i] < 0.3 ? Math.PI / 4 : 0);
    }
  }
}

function drawAmbient(ctx: CanvasRenderingContext2D, t: number, m: Ambient) {
  const { seed, n, t0, t1, box, drift = [0, -18], rsize = [2, 7], inten = 0.35 } = m;
  const d = table(seed, n);
  const [x0, y0, x1, y1] = box;
  const env = Math.min(1, Math.max(0, (t - t0) / 0.8)) * (1 - Math.min(1, Math.max(0, (t - (t1 - 0.8)) / 0.8)));
  if (env <= 0) return;
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * d.u[(i * 7) % n] + drift[0] * (t - t0) + 10 * Math.sin(0.7 * t + d.ph[i]);
    const y = y0 + (y1 - y0) * d.life[i] + drift[1] * (t - t0) * (0.5 + d.size[i]);
    const tw = 0.5 + 0.5 * Math.sin(6.28 * 0.35 * d.fr[i] * t + d.ph[i]);
    const a = inten * env * tw;
    if (a < 0.01) continue;
    const r = rsize[0] + (rsize[1] - rsize[0]) * d.size[i];
    glow(ctx, x, y, r, d.col[i] < 0.6 ? GOLD : WHITE, a);
  }
}

export const Glitter: React.FC<{ bursts?: Burst[]; ambient?: Ambient[] }> = ({ bursts = [], ambient = [] }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (const b of bursts) drawBurst(ctx, t, b);
    for (const m of ambient) drawAmbient(ctx, t, m);
  });
  return (
    <AbsoluteFill style={{ mixBlendMode: "plus-lighter", pointerEvents: "none" }}>
      <canvas ref={ref} width={width * dpr} height={height * dpr} style={{ width, height }} />
    </AbsoluteFill>
  );
};
