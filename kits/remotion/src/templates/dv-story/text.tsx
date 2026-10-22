import { moduleTextWidth } from "../../core/text-fit";
import React, { type CSSProperties } from "react";
import { fontFor } from "../../core/fonts";
import { localFont } from "../../core/local-fonts";
import { graphemes } from "./typing";
export { graphemes, resolveMarkup, splitLines, typeProgress } from "./typing";

/**
 * Handwritten copy: Long Cang (OFL) for Chinese, Noto Color Emoji for emoji and keycap digits.
 *
 * Long Cang draws 时 as the traditional 時, so 时 is assembled from Long Cang's own 日 and 寸; its
 * 以 and 么 are cursive shorthand ("vく", "ㄙ") that read badly on a big screen, so those come from
 * Klee One 600, the closest pen among the OFL fonts (all checked at full size against Zhi Mang
 * Xing, Ma Shan Zheng and LXGW WenKai). Copy markup: "｜" breaks lines, "[1978]" draws keycaps.
 */

// Packaged local fonts only; no runtime font downloads.
export const handFont = (text: string) => `"${localFont("LongCang", text, 400)}", "Kaiti SC", cursive`;
/** Characters drawn from Klee One instead of Long Cang (see above), with their size. Long Cang's
 * em dash also has wide side bearings, so "——" broke into "— —"; Klee One's dashes join. */
const PATCHED: Record<string, string> = { 以: "0.94em", 么: "0.94em", "—": "1em" };

const pixel = localFont("Silkscreen", "PLAY . 0123456789", 700);
const UI_GLYPHS = "REC HDV Tv 60 1080P AUTO AWB dB 0123456789: / - +";
const inter = localFont("Inter", UI_GLYPHS, 400);
localFont("Inter", UI_GLYPHS, 500);
localFont("Inter", UI_GLYPHS, 600);
export const PIXEL = `"${pixel}", monospace`;
export const SANS = `"${inter}", "Helvetica Neue", Arial, sans-serif`;

const EMOJI = /\p{Extended_Pictographic}|\u20E3/u;
export const isEmoji = (g: string) => EMOJI.test(g);
const isKeycap = (g: string) => g.includes("\u20E3");

const Shi: React.FC = () => (
  <span style={{ display: "inline-block", position: "relative", width: "1em", height: "1em", verticalAlign: "-0.12em" }}>
    <span style={{ position: "absolute", left: "-0.02em", top: 0, transform: "scaleX(0.52)", transformOrigin: "0 50%" }}>日</span>
    <span style={{ position: "absolute", left: "0.4em", top: 0, transform: "scaleX(0.62)", transformOrigin: "0 50%" }}>寸</span>
  </span>
);

const Glyph: React.FC<{ g: string; emoji: string; hidden?: boolean }> = ({ g, emoji, hidden }) => {
  const style: CSSProperties = hidden ? { opacity: 0 } : {};
  if (PATCHED[g]) {
    return <span style={{ ...style, fontFamily: `"${localFont("KleeOne", g, 600)}"`, fontWeight: 600, fontSize: PATCHED[g] }}>{g}</span>;
  }
  if (g === "时") {
    return (
      <span style={style}>
        <Shi />
      </span>
    );
  }
  if (isEmoji(g)) {
    const key = isKeycap(g);
    return (
      <span
        style={{
          ...style,
          fontFamily: emoji,
          fontSize: key ? "1.08em" : "1.02em",
          margin: key ? "0 0.07em" : "0 0.02em",
          display: "inline-block",
          transform: "translateY(-0.04em)",
        }}
      >
        {g}
      </span>
    );
  }
  return <span style={style}>{g}</span>;
};

/** Approximate advance of a line in em (Long Cang: CJK 1, digits/Latin ~0.55, emoji ~1.1). */
export const lineEm = (text: string) =>
  graphemes(text).reduce((w, g) => w + (isKeycap(g) ? 1.22 : isEmoji(g) ? 1.1 : /^[\x20-\x7e]$/.test(g) ? 0.55 : 1), 0);

/** Block cursor that takes no layout width, so a centered line never shifts while it types. */
const Cursor: React.FC<{ on: boolean }> = ({ on }) => (
  <span style={{ display: "inline-block", position: "relative", width: 0, height: "1em", verticalAlign: "-0.12em" }}>
    <span
      style={{
        position: "absolute",
        left: "0.08em",
        top: "-0.1em",
        width: "0.5em",
        height: "1.22em",
        background: "#fff",
        opacity: on ? 1 : 0,
      }}
    />
  </span>
);

export interface HandLineProps {
  text: string;
  size: number;
  /** how many graphemes are visible (typewriter); default all */
  shown?: number;
  /** draw the block cursor after the last visible grapheme */
  cursor?: boolean;
  color?: string;
  style?: CSSProperties;
  /** widest the line may be, in design px (default: the frame minus margins) */
  maxWidth?: number;
}

/** One centered handwritten line. Untyped glyphs keep their space, so typing starts at the line's final left edge. */
export const HandLine: React.FC<HandLineProps> = ({ text, size: designSize, shown, cursor, color = "#fff", style, maxWidth = 1760 }) => {
  const gs = graphemes(text);
  // a long line (long names, a long caption) shrinks to the frame instead of running off it
  const est = moduleTextWidth(text, "LongCang", designSize) * 1.06;
  const size = est > maxWidth ? Math.max(designSize * 0.5, designSize * (maxWidth / est)) : designSize;
  const n = shown ?? gs.length;
  const emoji = fontFor("emoji", gs.filter(isEmoji).join("") || "🙂");
  return (
    <div
      style={{
        fontFamily: handFont(gs.join("") + "日寸"),
        fontSize: size,
        color,
        lineHeight: 1.2,
        whiteSpace: "pre",
        textAlign: "center",
        ...style,
      }}
    >
      {cursor && n === 0 ? <Cursor on /> : null}
      {gs.map((g, i) => (
        <React.Fragment key={i}>
          <Glyph g={g} emoji={emoji} hidden={i >= n} />
          {cursor && i === n - 1 ? <Cursor on /> : null}
        </React.Fragment>
      ))}
    </div>
  );
};

/** Lines stacked around a center point. */
export const HandBlock: React.FC<{
  lines: string[];
  size: number;
  cx: number;
  cy: number;
  /** distance between line centers */
  leading: number;
  /** visible graphemes per line (typewriter) */
  shown?: number[];
  /** index of the line that carries the cursor, or -1 */
  cursorLine?: number;
  cursorOn?: boolean;
  style?: CSSProperties;
  lineStyle?: (i: number) => CSSProperties;
  /** widest a line may be (design px); longer lines shrink */
  maxWidth?: number;
}> = ({ lines, size, cx, cy, leading, shown, cursorLine = -1, cursorOn = true, style, lineStyle, maxWidth }) => {
  const top = cy - ((lines.length - 1) * leading) / 2;
  return (
    <div style={{ position: "absolute", inset: 0, ...style }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{ position: "absolute", left: cx, top: top + i * leading, transform: "translate(-50%, -50%)", ...lineStyle?.(i) }}
        >
          <HandLine text={l} size={size} shown={shown?.[i]} cursor={i === cursorLine && cursorOn} maxWidth={maxWidth} />
        </div>
      ))}
    </div>
  );
};
