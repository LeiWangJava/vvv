import type { CSSProperties } from "react";
import type { PoolPhoto } from "./manifest";

/**
 * Face-aware cover cropping. Given a photo and the box it must fill, returns the CSS
 * object-position (and a transform-origin for zooms) that keeps the faces in frame:
 * the faces' bounding box is placed around `target` (default: centered, slightly high),
 * then clamped so the image still covers the box. Photos without faces fall back to a
 * centered, slightly high crop for portraits.
 */
export interface CoverFit {
  objectPosition: string;
  transformOrigin: string;
  /** where the face center lands in the box, 0–1 */
  face: [number, number] | null;
}

export function faceCenter(photo: PoolPhoto): [number, number] | null {
  const faces = photo.faces ?? [];
  if (!faces.length) return null;
  // all faces at least a third the size of the largest one (the couple, not background people)
  const big = faces[0][2] * faces[0][3];
  const main = faces.filter((f) => f[2] * f[3] >= big / 3);
  const x0 = Math.min(...main.map((f) => f[0]));
  const y0 = Math.min(...main.map((f) => f[1]));
  const x1 = Math.max(...main.map((f) => f[0] + f[2]));
  const y1 = Math.max(...main.map((f) => f[1] + f[3]));
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** object-position percent p so that image point c lands at box point target (cover fit along one axis). */
function axis(c: number, target: number, imgLen: number, boxLen: number): number {
  const slack = boxLen - imgLen; // ≤ 0 when the image overflows the box on this axis
  if (Math.abs(slack) < 0.5) return 0.5;
  return clamp01((target * boxLen - c * imgLen) / slack);
}

export function coverFit(photo: PoolPhoto, boxW: number, boxH: number, target: [number, number] = [0.5, 0.4]): CoverFit {
  const s = Math.max(boxW / photo.width, boxH / photo.height);
  const iw = photo.width * s;
  const ih = photo.height * s;
  const fc = faceCenter(photo);
  const c: [number, number] = fc ?? [0.5, photo.orientation === "portrait" ? 0.32 : 0.45];
  const px = axis(c[0], target[0], iw, boxW);
  const py = axis(c[1], target[1], ih, boxH);
  // where the chosen point actually lands (after clamping) — zoom around it
  const lx = ((boxW - iw) * px + c[0] * iw) / boxW;
  const ly = ((boxH - ih) * py + c[1] * ih) / boxH;
  return {
    objectPosition: `${(px * 100).toFixed(2)}% ${(py * 100).toFixed(2)}%`,
    transformOrigin: `${(clamp01(lx) * 100).toFixed(2)}% ${(clamp01(ly) * 100).toFixed(2)}%`,
    face: fc ? [lx, ly] : null,
  };
}

export const coverStyle = (photo: PoolPhoto, boxW: number, boxH: number, target?: [number, number]): CSSProperties => {
  const f = coverFit(photo, boxW, boxH, target);
  return { objectFit: "cover", objectPosition: f.objectPosition, transformOrigin: f.transformOrigin };
};
