import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, random, useVideoConfig } from "remotion";
import { useT } from "../core/time";

/**
 * Deterministic falling things drawn on a canvas: paper confetti that flutters (flips in 3D),
 * ginkgo leaves that sway, and soft petals. Each particle is born between t0 and t1.
 */
export interface FallSpec {
  seed: number;
  n: number;
  t0: number;
  t1: number;
  kind: "paper" | "ginkgo" | "petal";
  colors: string[];
  /** birth x range */
  x: [number, number];
  /** birth y (default just above the frame) */
  y0?: number;
  /** fall speed px/s */
  speed?: [number, number];
  /** size px */
  size?: [number, number];
  /** sideways sway amplitude px */
  sway?: number;
  /** initial burst: particles also shoot up/out with this speed, then fall */
  burst?: number;
}

function shape(ctx: CanvasRenderingContext2D, kind: FallSpec["kind"], s: number) {
  ctx.beginPath();
  if (kind === "paper") {
    ctx.rect(-s / 2, -s * 0.3, s, s * 0.6);
  } else if (kind === "ginkgo") {
    // fan-shaped leaf with a notch, plus stem
    ctx.moveTo(0, s * 0.45);
    ctx.lineTo(-s * 0.08, 0);
    ctx.arc(0, s * 0.45, s * 0.8, -Math.PI * 0.78, -Math.PI * 0.53);
    ctx.lineTo(0, s * 0.02);
    ctx.lineTo(s * 0.06 * Math.cos(-Math.PI * 0.47), s * 0.45 + s * 0.8 * Math.sin(-Math.PI * 0.47));
    ctx.arc(0, s * 0.45, s * 0.8, -Math.PI * 0.47, -Math.PI * 0.22);
    ctx.closePath();
  } else {
    ctx.moveTo(0, -s / 2);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.1, 0, s / 2);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.1, 0, -s / 2);
  }
  ctx.fill();
}

export const Falling: React.FC<{ specs: FallSpec[]; opacity?: number }> = ({ specs, opacity = 1 }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const sp of specs) {
      const { seed, n, t0, t1, kind, colors, x, y0 = -40, speed = [120, 220], size = [10, 18], sway = 30, burst = 0 } = sp;
      for (let i = 0; i < n; i++) {
        const r = (k: string) => random(`${seed}-${k}-${i}`);
        const tb = t0 + (t1 - t0) * r("t");
        const age = t - tb;
        if (age < 0) continue;
        const v = speed[0] + (speed[1] - speed[0]) * r("v");
        const bx = x[0] + (x[1] - x[0]) * r("x");
        const ang = (r("a") - 0.5) * Math.PI * 1.4 - Math.PI / 2;
        const bv = burst * (0.4 + 0.6 * r("b"));
        // burst: initial velocity that decays, then plain falling
        const decay = 1 - Math.exp(-age * 3);
        const px = bx + (Math.cos(ang) * bv * decay) / 3 + sway * Math.sin((1.2 + 1.6 * r("w")) * age + 6.28 * r("p"));
        const py = y0 + (Math.sin(ang) * bv * decay) / 3 + v * age;
        if (py > height + 60 || px < -80 || px > width + 80) continue;
        const s = size[0] + (size[1] - size[0]) * r("s");
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(px, py);
        ctx.rotate(6.28 * r("r0") + (r("dir") < 0.5 ? -1 : 1) * (1.2 + 2.5 * r("rs")) * age);
        // flutter: flip around one axis
        ctx.scale(1, kind === "petal" ? 0.6 + 0.4 * Math.cos(3 * age + 6.28 * r("f")) : Math.cos((3 + 5 * r("f")) * age + 6.28 * r("f2")));
        ctx.globalAlpha = opacity * Math.min(1, age / 0.2) * (kind === "petal" ? 0.8 : 0.95);
        ctx.fillStyle = colors[Math.floor(r("c") * colors.length)];
        shape(ctx, kind, s);
        ctx.restore();
      }
    }
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas ref={ref} width={width * dpr} height={height * dpr} style={{ width, height }} />
    </AbsoluteFill>
  );
};
