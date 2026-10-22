import React, { type CSSProperties } from "react";
import { AbsoluteFill } from "remotion";
import { useDirectionalBlur } from "./Photo";

/**
 * Group transform: everything inside scales about (cx, cy), then shifts by (dx, dy), and fades
 * as one layer. This is how scenes exit (grow + fade, slide away) without touching each child.
 */
export const Group: React.FC<{
  sc?: number;
  dx?: number;
  dy?: number;
  op?: number;
  cx?: number;
  cy?: number;
  /** motion blur for the whole group, px travelled during the shutter */
  motion?: [number, number];
  children: React.ReactNode;
}> = ({ sc = 1, dx = 0, dy = 0, op = 1, cx = 960, cy = 540, motion, children }) => {
  const blur = useDirectionalBlur(motion);
  if (op <= 0.002) return null;
  const identity = sc === 1 && dx === 0 && dy === 0 && op >= 1 && !blur.filter;
  return (
    <AbsoluteFill
      style={
        identity
          ? undefined
          : {
              transform: `translate(${dx}px, ${dy}px) scale(${sc})`,
              transformOrigin: `${cx}px ${cy}px`,
              opacity: op,
              filter: blur.filter,
            }
      }
    >
      {children}
      {blur.defs}
    </AbsoluteFill>
  );
};

/** Rectangle by center, with rotation, rounded corners and optional soft (blurred) edges. */
export const Box: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h: number;
  color: string;
  op?: number;
  angle?: number;
  radius?: number;
  /** blur radius in px for soft shadows */
  soft?: number;
  scale?: number;
  style?: CSSProperties;
  children?: React.ReactNode;
}> = ({ cx, cy, w, h, color, op = 1, angle = 0, radius = 0, soft = 0, scale = 1, style, children }) => {
  if (op <= 0.002 || w <= 0 || h <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        background: color,
        opacity: op,
        borderRadius: radius,
        transform: angle || scale !== 1 ? `rotate(${angle}deg) scale(${scale})` : undefined,
        filter: soft > 0.5 ? `blur(${soft}px)` : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Straight line between two points. */
export const Line: React.FC<{
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width?: number;
  op?: number;
}> = ({ x0, y0, x1, y1, color, width = 1.5, op = 1 }) => {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 0.5) return null;
  const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  return <Box cx={(x0 + x1) / 2} cy={(y0 + y1) / 2} w={len} h={width} color={color} op={op} angle={ang} />;
};
