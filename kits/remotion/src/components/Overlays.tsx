import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useT } from "../core/time";

/**
 * Light leak blob (Python engine format): center (bx, by) wandering by (ax, ay) at angular speeds
 * (wx, wy) with phase ph; Gaussian radius r; RGB color 0–1; amplitude amp.
 */
export type LeakBlob = [bx: number, by: number, ax: number, ay: number, wx: number, wy: number, ph: number, r: number, color: [number, number, number], amp: number];

export const WARM_LEAK: LeakBlob[] = [
  [1750, 380, 160, 90, 0.7, 0.5, 0.0, 380, [1.0, 0.55, 0.22], 0.95],
  [1250, 950, 260, 60, 0.45, 0.6, 1.3, 460, [1.0, 0.72, 0.38], 0.5],
  [150, 120, 120, 60, 0.5, 0.4, 2.1, 300, [1.0, 0.45, 0.35], 0.35],
];

/** Drifting warm light, screen-blended (port of the Python light_leak, drawn at 1/10 res and upscaled). */
export const LightLeak: React.FC<{ strength?: number; blobs?: LeakBlob[] }> = ({ strength = 0.5, blobs = WARM_LEAK }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const lw = 192;
  const lh = 108;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, lw, lh);
    ctx.globalCompositeOperation = "lighter";
    const sx = lw / width;
    for (const [bx, by, ax, ay, wx, wy, ph, r, col, amp] of blobs) {
      const cx = (bx + ax * Math.sin(wx * t + ph)) * sx;
      const cy = (by + ay * Math.sin(wy * t + ph * 1.7)) * sx;
      const k = amp * (0.75 + 0.25 * Math.sin(0.9 * t + ph * 2.3)) * strength;
      const R = r * sx * 3;
      const rgb = col.map((c) => Math.round(Math.min(1, c * k) * 255)).join(",");
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `rgba(${rgb},1)`);
      g.addColorStop(1 / 3, `rgba(${rgb},0.607)`);
      g.addColorStop(2 / 3, `rgba(${rgb},0.135)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    }
  });
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      <canvas ref={ref} width={lw} height={lh} style={{ width, height }} />
    </AbsoluteFill>
  );
};

/** Animated film grain (changes every frame). */
export const FilmGrain: React.FC<{ opacity?: number; scale?: number }> = ({ opacity = 0.08, scale = 0.9 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${frame}`}>
          <feTurbulence type="fractalNoise" baseFrequency={scale} numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${frame})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Soft dark edges. */
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.35 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/** Whole-video fade from/to a color at the very start and end. */
export const EdgeFade: React.FC<{ inSec?: number; outSec?: number; color?: string }> = ({
  inSec = 0.6,
  outSec = 1,
  color = "#000",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const total = durationInFrames / fps;
  const a = Math.max(inSec > 0 ? 1 - t / inSec : 0, outSec > 0 ? (t - (total - outSec)) / outSec : 0);
  if (a <= 0) return null;
  return <AbsoluteFill style={{ background: color, opacity: Math.min(1, a), pointerEvents: "none" }} />;
};
