import React, { type CSSProperties } from "react";
import { localFont } from "../../core/local-fonts";
import { clamp01, eOut3 } from "../../core/ease";

/**
 * Handwritten copy in Long Cang (OFL). Long Cang draws 时 as 時 and its 以 / 么 are cursive
 * shorthand that reads badly large, so 时 is assembled from its own 日 + 寸 and 以 / 么 come from
 * Klee One 600, the closest pen among the packaged fonts.
 */
export const handFamily = (text: string) => `"${localFont("LongCang", text, 400)}", "Kaiti SC", cursive`;
export const kuaileFamily = (text: string) => `"${localFont("ZCOOLKuaiLe", text, 400)}", sans-serif`;

const PATCHED: Record<string, string> = { 以: "0.94em", 么: "0.94em", "—": "1em" };

const Shi: React.FC = () => (
  <span style={{ display: "inline-block", position: "relative", width: "1em", height: "1em", verticalAlign: "-0.12em" }}>
    <span style={{ position: "absolute", left: "-0.02em", top: 0, transform: "scaleX(0.52)", transformOrigin: "0 50%" }}>日</span>
    <span style={{ position: "absolute", left: "0.4em", top: 0, transform: "scaleX(0.62)", transformOrigin: "0 50%" }}>寸</span>
  </span>
);

export const graphemes = (text: string): string[] => {
  const Seg = (Intl as any).Segmenter;
  return Seg ? Array.from(new Seg("zh", { granularity: "grapheme" }).segment(text), (s: any) => s.segment as string) : [...text];
};

const Glyph: React.FC<{ g: string; style: CSSProperties }> = ({ g, style }) => {
  if (PATCHED[g]) {
    return <span style={{ ...style, fontFamily: `"${localFont("KleeOne", g, 600)}"`, fontWeight: 600, fontSize: PATCHED[g] }}>{g}</span>;
  }
  if (g === "时") return <span style={style}><Shi /></span>;
  return <span style={style}>{g === " " ? " " : g}</span>;
};

/**
 * One line of handwriting. `typed` is how many graphemes are visible (fractional: the next one is
 * fading in); omit it to show the whole line.
 */
export const HandLine: React.FC<{
  text: string;
  size: number;
  color?: string;
  typed?: number;
  glow?: number;
  style?: CSSProperties;
}> = ({ text, size, color = "#FFFFFF", typed, glow = 0, style }) => {
  const chars = graphemes(text);
  const family = handFamily(text + "日寸");
  const shadow = glow > 0 ? `0 0 ${size * 0.25}px rgba(255,255,255,${0.75 * glow}), 0 0 ${size * 0.6}px rgba(255,236,200,${0.45 * glow})` : undefined;
  return (
    <div style={{ fontFamily: family, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre", textShadow: shadow, ...style }}>
      {chars.map((g, i) => {
        const p = typed === undefined ? 1 : eOut3(clamp01(typed - i));
        return <Glyph key={i} g={g} style={{ opacity: p, display: "inline-block", transform: `translateY(${(1 - p) * size * 0.12}px)` }} />;
      })}
    </div>
  );
};
