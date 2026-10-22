import React from "react";
import { AbsoluteFill } from "remotion";
import { Art } from "../../components/Art";

/**
 * Paper-cut frame: a red page with drifting gold clouds, and gold paper-cut corners for photo frames.
 * Shared by festive templates (Comedy) and packaged as the @vvv/papercut-frame effect.
 * Artwork lives in public/assets/xy39 (gold variants). The backdrop is laid out on a 1920×1080 page.
 */
const RED = "#B3171E";
const A = (name: string) => `assets/xy39/${name}-gold.png`;

const RedGround: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, #C92A2F 0%, ${RED} 45%, #7E0E13 100%)` }} />
);

/** The red page; `drift` slides the gold clouds apart (px). */
export const RedBackdrop: React.FC<{ drift?: number }> = ({ drift = 0 }) => (
  <>
    <RedGround />
    <Art src={A("clouds")} cx={960 + drift} cy={70} w={1900} h={634} op={0.22} />
    <Art src={A("clouds")} cx={960 - drift} cy={1010} w={1900} h={634} op={0.22} flip="x" />
  </>
);

/** Gold paper-cut corners on a photo box. */
export const GoldCorners: React.FC<{ x: number; y: number; w: number; h: number; size?: number; op?: number }> = ({ x, y, w, h, size = 120, op = 1 }) => {
  const c = (cx: number, cy: number, flip?: "x" | "y" | "xy") => <Art src={A("corner")} cx={cx} cy={cy} w={size} h={size} flip={flip} op={op} />;
  const o = size / 2 - 14;
  return (
    <>
      {c(x + o, y + o)}
      {c(x + w - o, y + o, "x")}
      {c(x + o, y + h - o, "y")}
      {c(x + w - o, y + h - o, "xy")}
    </>
  );
};
