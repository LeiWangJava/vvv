import React, { type CSSProperties } from "react";
import { Img, staticFile } from "remotion";

/** Static artwork from public/ (paper-cuts, textures) by center, with rotation / scale / opacity. */
export const Art: React.FC<{
  src: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  op?: number;
  rot?: number;
  sc?: number;
  /** transform origin, e.g. "50% 0%" to swing from the top */
  origin?: string;
  flip?: "x" | "y" | "xy";
  style?: CSSProperties;
}> = ({ src, cx, cy, w, h, op = 1, rot = 0, sc = 1, origin = "center", flip, style }) => {
  if (op <= 0.002) return null;
  const fx = flip === "x" || flip === "xy" ? -1 : 1;
  const fy = flip === "y" || flip === "xy" ? -1 : 1;
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        opacity: op,
        transform: `rotate(${rot}deg) scale(${sc * fx}, ${sc * fy})`,
        transformOrigin: origin,
        ...style,
      }}
    />
  );
};
