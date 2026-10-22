import React, { useId, type CSSProperties } from "react";
import { Img, useVideoConfig } from "remotion";
import { EASE, clamp01, mix } from "../core/anim";
import { coverFit } from "../core/crop";
import { getPhoto, photoSrc } from "../core/manifest";
import { useT } from "../core/time";
import { RADIUS, SHADOW } from "../core/theme";

export type Rect = [x0: number, y0: number, x1: number, y1: number];

export interface PhotoProps {
  /** Pool photo id (from a template slot). */
  id: string;
  /** Box by top-left corner, in design px on the 1920×1080 frame … */
  x?: number;
  y?: number;
  /** … or by center. Omit position entirely to fill the parent. */
  cx?: number;
  cy?: number;
  w?: number;
  h?: number;
  radius?: number;
  shadow?: boolean | string;
  /** Crop focus 0–1. Default: face-aware (core/crop.ts). */
  focus?: [number, number];
  /** Fixed zoom, or Ken Burns [from, to] over `kb`. */
  zoom?: number | [number, number];
  /** Ken Burns window [start, end] in seconds. Default: the whole scene. */
  kb?: [number, number];
  /** Image drift in % of the box, [[fromX, fromY], [toX, toY]], over the same window. */
  pan?: [[number, number], [number, number]];
  /** Only this part of the box is visible (design px). Rounded corners follow the visible part. */
  clip?: Rect;
  /** Slide the picture inside its (clipped) box, for parallax reveals. */
  offset?: [number, number];
  /** Rotation in degrees around the box center. */
  angle?: number;
  /** Motion blur: how far the photo travels (px) while the shutter is open, [x, y]. */
  motion?: [number, number];
  opacity?: number;
  style?: CSSProperties;
  imgStyle?: CSSProperties;
  /** Overlays clipped to the photo (captions, grain). */
  children?: React.ReactNode;
}

/** Cover-cropped pool photo: rounded corners, Ken Burns, clip reveals, rotation. */
export const Photo: React.FC<PhotoProps> = ({
  id,
  x,
  y,
  cx,
  cy,
  w = 0,
  h = 0,
  radius = RADIUS,
  shadow = false,
  focus,
  zoom = 1,
  kb,
  pan,
  clip,
  offset = [0, 0],
  angle = 0,
  motion,
  opacity,
  style,
  imgStyle,
  children,
}) => {
  const photo = getPhoto(id);
  const blur = useDirectionalBlur(motion);
  const t = useT();
  const { fps, durationInFrames } = useVideoConfig();
  const [k0, k1] = kb ?? [0, durationInFrames / fps];
  const p = EASE.soft(clamp01((t - k0) / Math.max(0.001, k1 - k0)));
  const z = Array.isArray(zoom) ? mix(zoom[0], zoom[1], p) : zoom;
  const [px, py] = pan ? [mix(pan[0][0], pan[1][0], p), mix(pan[0][1], pan[1][1], p)] : [0, 0];
  if (opacity !== undefined && opacity <= 0.002) return null;

  // explicit focus wins; otherwise crop around the faces for this box's shape
  const explicit = focus ?? photo.focus;
  const fit = explicit
    ? { objectPosition: `${explicit[0] * 100}% ${explicit[1] * 100}%`, transformOrigin: `${explicit[0] * 100}% ${explicit[1] * 100}%` }
    : coverFit(photo, w || 1920, h || 1080);
  const img = (
    <Img
      src={photoSrc(photo)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: fit.objectPosition,
        transform: `translate(${px}%, ${py}%) scale(${z})`,
        transformOrigin: fit.transformOrigin,
        ...imgStyle,
      }}
    />
  );
  const common: CSSProperties = {
    position: "absolute",
    borderRadius: radius,
    overflow: "hidden",
    boxShadow: shadow === true ? SHADOW : shadow || undefined,
    opacity,
    filter: blur.filter,
  };

  const positioned = x !== undefined || cx !== undefined;
  if (!positioned) {
    return (
      <div style={{ ...common, inset: 0, ...style }}>
        {img}
        {children}
        {blur.defs}
      </div>
    );
  }

  const bx = cx !== undefined ? cx - w / 2 : (x as number);
  const by = cy !== undefined ? (cy as number) - h / 2 : (y as number);
  // visible part = box ∩ clip; the picture itself may be offset inside it
  const vx0 = clip ? Math.max(bx, clip[0]) : bx;
  const vy0 = clip ? Math.max(by, clip[1]) : by;
  const vx1 = clip ? Math.min(bx + w, clip[2]) : bx + w;
  const vy1 = clip ? Math.min(by + h, clip[3]) : by + h;
  if (vx1 - vx0 < 0.5 || vy1 - vy0 < 0.5) return null;

  return (
    <div
      style={{
        ...common,
        left: vx0,
        top: vy0,
        width: vx1 - vx0,
        height: vy1 - vy0,
        transform: angle ? `rotate(${angle}deg)` : undefined,
        transformOrigin: `${bx + w / 2 - vx0}px ${by + h / 2 - vy0}px`,
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: bx + offset[0] - vx0, top: by + offset[1] - vy0, width: w, height: h }}>
        {img}
      </div>
      {children}
      {blur.defs}
    </div>
  );
};

/**
 * Directional (anisotropic Gaussian) blur for an element moving [x, y] px during the shutter.
 * Only moving elements get it, so static parts of the frame stay pixel-exact.
 */
export function useDirectionalBlur(motion?: [number, number]): { filter?: string; defs: React.ReactNode } {
  const id = "mb" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sx = Math.abs(motion?.[0] ?? 0) / 2.5;
  const sy = Math.abs(motion?.[1] ?? 0) / 2.5;
  if (sx < 0.35 && sy < 0.35) return { defs: null };
  return {
    filter: `url(#${id})`,
    defs: (
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sx.toFixed(2)} ${sy.toFixed(2)}`} />
        </filter>
      </svg>
    ),
  };
}

/** Shutter-interval travel of a moving point: evaluate its path half a shutter before and after t. */
export const travel = (path: (t: number) => [number, number], t: number, halfShutter: number): [number, number] => {
  const [x0, y0] = path(t - halfShutter);
  const [x1, y1] = path(t + halfShutter);
  return [x1 - x0, y1 - y0];
};
