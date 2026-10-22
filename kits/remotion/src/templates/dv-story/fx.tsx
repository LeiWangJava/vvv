import React from "react";
import { AbsoluteFill, Img, random } from "remotion";
import { art } from "./media";

/**
 * Film-surface effects built from the generated textures (dust, VHS glitch, projector flicker).
 * `f` is the video frame number; random() keeps every render identical.
 */

/** White dust and hairs that jump every few frames, screen-blended over everything. */
export const Dust: React.FC<{ f: number; fps: number; opacity?: number }> = ({ f, fps, opacity = 0.55 }) => {
  const step = Math.max(1, Math.round(fps / 12));
  const k = Math.floor(f / step);
  const pick = random(`dust-${k}`);
  if (pick < 0.18) return null;
  const file = pick < 0.6 ? "textures/dust-1.png" : "textures/dust-2.png";
  const sx = random(`dust-sx-${k}`) < 0.5 ? -1 : 1;
  const sy = random(`dust-sy-${k}`) < 0.5 ? -1 : 1;
  const dx = (random(`dust-x-${k}`) - 0.5) * 600;
  const dy = (random(`dust-y-${k}`) - 0.5) * 300;
  const s = 1 + random(`dust-s-${k}`) * 0.35;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: opacity * (0.7 + 0.3 * random(`dust-o-${k}`)) }}>
      <Img src={art(file)} style={{ width: "100%", height: "100%", transform: `translate(${dx}px, ${dy}px) scale(${s * sx}, ${s * sy})` }} />
    </AbsoluteFill>
  );
};

/** Projector flicker: the grey film texture shows through for a moment (cuts, idle shimmer). */
export const Flicker: React.FC<{ amount: number }> = ({ amount }) =>
  amount <= 0.01 ? null : (
    <AbsoluteFill style={{ opacity: Math.min(1, amount), mixBlendMode: "screen", pointerEvents: "none" }}>
      <Img src={art("textures/bg-flicker.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );

/** VHS tracking glitch: torn bands of the glitch textures, sliding sideways. */
export const Glitch: React.FC<{ f: number; amount?: number; children?: React.ReactNode }> = ({ f, amount = 1, children }) => {
  const k = Math.floor(f / 2);
  const file = k % 2 ? "textures/glitch-1.png" : "textures/glitch-2.png";
  const bands = Array.from({ length: 7 }, (_, i) => {
    const y0 = random(`gy-${k}-${i}`) * 100;
    const hgt = 3 + random(`gh-${k}-${i}`) * 14;
    const dx = (random(`gx-${k}-${i}`) - 0.5) * 220 * amount;
    return { y0, hgt, dx };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {children ? (
        <AbsoluteFill style={{ opacity: 1 - 0.6 * amount }}>
          {children}
          {bands.map((b, i) => (
            <AbsoluteFill key={i} style={{ clipPath: `inset(${b.y0}% 0 ${Math.max(0, 100 - b.y0 - b.hgt)}% 0)`, transform: `translateX(${b.dx}px)` }}>
              {children}
            </AbsoluteFill>
          ))}
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ opacity: amount, mixBlendMode: children ? "screen" : undefined }}>
        <Img src={art(file)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translateX(${(random(`gt-${k}`) - 0.5) * 80}px)` }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
