import React, { type CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { coverFit } from "../../core/crop";
import { getPhoto, photoSrc, type PoolPhoto } from "../../core/manifest";
import stickerSizes from "../../../public/assets/dvstory/st/sizes.json";

/** Generated art for this template (public/assets/dvstory, see scripts/dvstory-assets.swift). */
export const ART = "assets/dvstory";
export const art = (file: string) => staticFile(`${ART}/${file}`);

export interface PhotoMeta {
  w: number;
  h: number;
  faces: number[][];
}

/**
 * Photos are project assets: "@id" or "id" from assets.json. The folder argument is kept for the
 * scene signatures and ignored; an unknown ID throws instead of falling back to another photo.
 */
export function resolvePhoto(_dir: string, name: string): PhotoMeta & { src: string } {
  const p = getPhoto(name.startsWith("@") ? name.slice(1) : name);
  return { src: photoSrc(p), w: p.width, h: p.height, faces: p.faces ?? [] };
}
export const aspectOf = (dir: string, name: string) => {
  const m = resolvePhoto(dir, name);
  return m.w / m.h;
};

export interface PicProps {
  dir: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** cream print border in px (drawn inside the box) */
  border?: number;
  shadow?: string;
  /** extra zoom of the picture inside its box (Ken Burns) */
  zoom?: number;
  /** CSS filter on the picture (exposure flashes) */
  filter?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}

/** A photo cover-cropped into its box, faces kept in frame (core/crop). */
export const Pic: React.FC<PicProps> = ({ dir, name, x, y, w, h, border = 0, shadow, zoom = 1, filter, style, children }) => {
  const m = resolvePhoto(dir, name);
  const iw = Math.max(1, w - 2 * border);
  const ih = Math.max(1, h - 2 * border);
  const photo = {
    width: m.w,
    height: m.h,
    faces: m.faces as [number, number, number, number][],
    orientation: m.w > m.h ? "landscape" : m.w < m.h ? "portrait" : "square",
  } as unknown as PoolPhoto;
  const fit = coverFit(photo, iw, ih, [0.5, 0.42]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: border ? "#efe6cf" : undefined,
        boxShadow: shadow,
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: border, top: border, width: iw, height: ih, overflow: "hidden" }}>
        <Img
          src={m.src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: fit.objectPosition,
            transformOrigin: fit.transformOrigin,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            filter,
          }}
        />
        {children}
      </div>
    </div>
  );
};

export type StickerName = keyof typeof stickerSizes;
export const stickerAspect = (name: StickerName) => stickerSizes[name][0] / stickerSizes[name][1];

/** A trimmed sticker drawn by height around a center point. */
export const Sticker: React.FC<{
  name: StickerName;
  cx: number;
  cy: number;
  h: number;
  /** extra transform after centering (wiggle, pop) */
  transform?: string;
  opacity?: number;
  style?: CSSProperties;
}> = ({ name, cx, cy, h, transform, opacity, style }) => {
  const w = h * stickerAspect(name);
  return (
    <Img
      src={art(`st/${name}.png`)}
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        transform,
        opacity,
        ...style,
      }}
    />
  );
};
