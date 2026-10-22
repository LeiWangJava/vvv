import React, { type CSSProperties } from "react";
import { EASE, progress, useSeconds } from "../core/anim";
import { fontFor, fontStyleOf, type FontKey } from "../core/fonts";
import { fitText } from "../core/text-fit";
import { TEXT_SHADOW } from "../core/theme";

export interface RevealSpec {
  /** second when the first character starts */
  start: number;
  /** seconds between characters */
  step?: number;
  /** seconds each character takes */
  dur?: number;
  /** rise distance in px */
  dist?: number;
  /** blur in px at the start */
  blur?: number;
}

/** Which point of the text box sits on (x, y): l/c/r + t/m/b. */
export type Anchor = "lt" | "ct" | "rt" | "lm" | "cm" | "rm" | "lb" | "cb" | "rb";

export interface TextProps {
  children: string;
  font: FontKey;
  size: number;
  weight?: number;
  color?: string;
  /** letter-spacing in px */
  tracking?: number;
  /** Anchor point in design px. Omit to flow inside the parent. */
  x?: number;
  y?: number;
  /** Which part of the box sits on (x, y). Default "lt". */
  anchor?: Anchor;
  /** Shorthand for the horizontal part of `anchor` when y is the top. */
  align?: "left" | "center" | "right";
  /** Upright top-to-bottom Chinese (vertical-rl). */
  vertical?: boolean;
  /** Latin turned 90° clockwise, reading top to bottom. */
  sideways?: boolean;
  lineHeight?: number;
  shadow?: boolean | string;
  opacity?: number;
  scale?: number;
  /** Gaussian blur in px (focus-pull entrances). */
  blur?: number;
  /** Soft-edged wipe reveal 0→1 (handwriting / type-on). */
  wipe?: number;
  wipeDir?: "lr" | "rl" | "tb" | "bt";
  /** width of the soft edge as a share of the text length */
  wipeSoft?: number;
  /** Per-character fade-rise; omit for static text. */
  reveal?: RevealSpec;
  /**
   * Fit horizontal text into this many design px: the size (and tracking) shrink only when the
   * estimated width overflows (core/text-fit), so short CJK names keep their designed size.
   */
  maxWidth?: number;
  /** with maxWidth: a long line may break once (at " & " or the middle space) before shrinking further */
  wrap?: boolean;
  style?: CSSProperties;
}

const ANCHOR_SHIFT = { l: "0%", c: "-50%", r: "-100%", t: "0%", m: "-50%", b: "-100%" } as const;

/** Text with an OFL web font: anchors, tracking that stays centered, wipes and per-character reveals. */
export const Text: React.FC<TextProps> = ({
  children,
  font,
  size,
  weight = 400,
  color = "#2B2B2B",
  tracking = 0,
  x,
  y,
  anchor,
  align = "left",
  vertical = false,
  sideways = false,
  lineHeight = 1.25,
  shadow = false,
  opacity,
  scale,
  blur,
  wipe,
  wipeDir = "lr",
  wipeSoft = 0.25,
  reveal,
  maxWidth,
  wrap,
  style,
}) => {
  const t = useSeconds();
  const columnar = vertical || sideways;
  if (maxWidth !== undefined && !columnar) {
    const fit = fitText(children, font, size, maxWidth, { weight, tracking, wrap });
    children = fit.text;
    size = fit.size;
    tracking = fit.tracking;
    if (fit.lines > 1) lineHeight = Math.max(lineHeight, 1.18);
  }
  if (opacity !== undefined && opacity <= 0.002) return null;
  if (wipe !== undefined && wipe <= 0) return null;

  const family = fontFor(font, children, weight);
  const a = anchor ?? (align === "center" ? "ct" : align === "right" ? "rt" : "lt");
  const transforms = [`translate(${ANCHOR_SHIFT[a[0] as "l"]}, ${ANCHOR_SHIFT[a[1] as "t"]})`];
  if (scale !== undefined && scale !== 1) transforms.push(`scale(${scale})`);

  const positioned: CSSProperties =
    x === undefined
      ? {}
      : { position: "absolute", left: x, top: y, transform: transforms.join(" "), transformOrigin: "center" };

  let mask: string | undefined;
  if (wipe !== undefined && wipe < 1) {
    const to = { lr: "to right", rl: "to left", tb: "to bottom", bt: "to top" }[wipeDir];
    const solid = (wipe * (1 + wipeSoft) - wipeSoft) * 100;
    const clear = wipe * (1 + wipeSoft) * 100;
    mask = `linear-gradient(${to}, #000 ${solid}%, transparent ${clear}%)`;
  }

  const centered = a[0] === "c" || (columnar && a[1] === "m");
  const base: CSSProperties = {
    ...positioned,
    fontFamily: family,
    fontStyle: fontStyleOf(font),
    fontSize: size,
    fontWeight: weight,
    color,
    letterSpacing: tracking,
    // letter-spacing also trails the last glyph; pad the other side so centering stays true
    [columnar ? "paddingTop" : "paddingLeft"]: centered ? tracking : 0,
    lineHeight,
    whiteSpace: "pre",
    textAlign: columnar ? undefined : a[0] === "c" ? "center" : a[0] === "r" ? "right" : "left",
    writingMode: columnar ? "vertical-rl" : undefined,
    textOrientation: sideways ? "sideways" : undefined,
    textShadow: shadow === true ? TEXT_SHADOW : shadow || undefined,
    filter: blur && blur > 0.2 ? `blur(${blur}px)` : undefined,
    WebkitMaskImage: mask,
    maskImage: mask,
    opacity,
    ...style,
  };

  if (!reveal) return <div style={base}>{children}</div>;

  const { start, step = 0.05, dur = 0.7, dist = 14, blur: rb = 6 } = reveal;
  return (
    <div style={base}>
      {[...children].map((ch, i) => {
        if (ch === "\n") return <br key={i} />;
        const p = progress(t, start + i * step, dur, EASE.out);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              transform: columnar ? `translateY(${(1 - p) * -dist}px)` : `translateY(${(1 - p) * dist}px)`,
              filter: p < 1 && rb ? `blur(${(1 - p) * rb}px)` : undefined,
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </div>
  );
};

export interface RuleProps {
  x: number;
  y: number;
  length: number;
  /** 0–1 drawn amount */
  progress?: number;
  thickness?: number;
  color?: string;
  vertical?: boolean;
  /** where the line grows from */
  from?: "start" | "center";
  opacity?: number;
}

/** Thin decorative line that draws itself. */
export const Rule: React.FC<RuleProps> = ({
  x,
  y,
  length,
  progress: p = 1,
  thickness = 1.5,
  color = "#2B2B2B",
  vertical = false,
  from = "center",
  opacity = 1,
}) => {
  const scale = vertical ? `scaleY(${p})` : `scaleX(${p})`;
  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? x - thickness / 2 : x,
        top: vertical ? y : y - thickness / 2,
        width: vertical ? thickness : length,
        height: vertical ? length : thickness,
        background: color,
        opacity,
        transform: scale,
        transformOrigin: from === "center" ? "center" : vertical ? "top" : "left",
      }}
    />
  );
};
