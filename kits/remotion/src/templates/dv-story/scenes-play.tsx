import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { eBack, eIn3, eOut3, ramp } from "../../core/ease";
import { fontFor } from "../../core/fonts";
import stripMeta from "../../../public/assets/dvstory/filmstrip.json";
import type { SceneCtx } from "./ctx";
import { sinceBeat } from "./ctx";
import { Flicker } from "./fx";
import { art, aspectOf, Pic, Sticker, type StickerName } from "./media";
import type { SubPage } from "./story";
import { HandBlock, HandLine, lineEm } from "./text";
import { narrativeTyping, splitLines } from "./typing";

/** Sticker wiggle on the beat: a small alternating tilt and a hop on each beat. */
const wiggle = (lb: number, amp = 3.5) => {
  const ph = lb - Math.floor(lb);
  const side = Math.floor(lb) % 2 === 0 ? 1 : -1;
  const hop = Math.exp(-ph * 6);
  return `translateY(${-14 * hop}px) rotate(${side * amp * (1 - 0.5 * hop)}deg) scale(${1 + 0.025 * hop}, ${1 - 0.035 * hop})`;
};

/** Pop-in: 0 → overshoot → 1 over `dur` seconds. */
/** Sticker pop; it starts at half its size so the first frame after a cut is never empty. */
const pop = (since: number, dur = 0.42) => (since <= 0 ? 0 : 0.5 + 0.5 * eBack(ramp(since, 0, dur), 1.6));

/** Fade + soft blur-in for a line of copy. */
const fadeIn = (since: number, dur = 0.32) => {
  const p = eOut3(ramp(since, 0, dur));
  return { opacity: p, filter: p < 1 ? `blur(${(1 - p) * 9}px)` : undefined, transform: `translate(-50%, -50%) translateY(${(1 - p) * 14}px)` };
};

/**
 * Last `beats` of a scene: blur out (the reference's card exits). It stops at 60%, so the card is
 * still a soft ghost on the cut instead of leaving a black frame before the next scene.
 */
const exitAmount = (ctx: SceneCtx, beats = 0.35) => 0.6 * eIn3(ramp(ctx.lb, ctx.beats - beats, ctx.beats));

// ---------------------------------------------------------------- sticker cards

/**
 * Sticker (or the couple's own illustration, `art`) above one or two centered lines — the
 * reference's in-between cards. With stickers off and no art, the words sit alone, centered.
 */
export const CardScene: React.FC<{ ctx: SceneCtx; text: string; sticker: StickerName; art?: string }> = ({ ctx, text, sticker, art: artSrc }) => {
  const lines = splitLines(text);
  const s = pop(ctx.ls);
  const out = exitAmount(ctx);
  const typing = ctx.typewriterCards ? narrativeTyping(ctx.lb, ctx.beats, lines) : null;
  const picture = Boolean(artSrc) || ctx.stickers;
  const ys = picture ? (lines.length > 1 ? [632, 802] : [712]) : lines.length > 1 ? [462, 618] : [540];
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: out > 0.01 ? `blur(${out * 10}px)` : undefined }}>
      {artSrc ? (
        <Img
          src={staticFile(artSrc)}
          style={{ position: "absolute", left: 960, top: 322, height: 430, transform: `translate(-50%, -50%) scale(${s}) ${wiggle(ctx.lb, 1.5)}` }}
        />
      ) : ctx.stickers ? (
        <Sticker name={sticker} cx={960} cy={318} h={330} transform={`scale(${s}) ${wiggle(ctx.lb)}`} />
      ) : null}
      {lines.map((l, i) => {
        const st = typing ? { transform: "translate(-50%, -50%)" } : fadeIn(sinceBeat(ctx, 0.25 + 0.5 * i));
        return (
          <div key={i} style={{ position: "absolute", left: 960, top: ys[i], ...st }}>
            <HandLine text={l} size={80} shown={typing?.shown[i]} cursor={Boolean(typing && typing.cursorLine === i && typing.cursorOn)} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- photo left, words right

/** The first chat screenshot pops out of its corner; "loading" sticker and two lines on the right. */
const speakerInitial = (line: string): string | undefined => {
  const m = /(?:我是|我叫)\s*([^\s，,。.!！～~])/.exec(line) ?? /\b(?:I'?m|I am|this is)\s+([A-Za-z])/i.exec(line);
  return m ? m[1].toUpperCase() : undefined;
};

/** A drawn, fictional chat card: the first messages between the two, in place of a screenshot. */
const ChatCard: React.FC<{ x: number; y: number; w: number; h: number; chat: { time: string; a: string; b: string }; ls: number }> = ({ x, y, w, h, chat, ls }) => {
  const font = (t: string) => fontFor("songti", t);
  const bubble = (side: "l" | "r", line: string, since: number) => {
    const q = eOut3(ramp(ls, since, since + 0.3));
    // the avatar shows the speaker's initial from the line itself ("我是林以舟" / "I'm Alex"), never a demo name
    const initial = speakerInitial(line) ?? (side === "l" ? "A" : "B");
    return (
      <div style={{ display: "flex", flexDirection: side === "l" ? "row" : "row-reverse", alignItems: "flex-start", gap: 18, opacity: q, transform: `translateY(${(1 - q) * 16}px)` }}>
        <div style={{ width: 76, height: 76, borderRadius: 16, flex: "0 0 76px", background: side === "l" ? "#9DB4C8" : "#E7B9A8", color: "#fff",
          fontFamily: font(initial), fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>{initial}</div>
        <div style={{ maxWidth: w * 0.72, padding: "16px 22px", borderRadius: 14, background: side === "l" ? "#FFFFFF" : "#D7ECFF", color: "#1F2328",
          fontFamily: font(line), fontSize: 40, lineHeight: 1.35, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>{line}</div>
      </div>
    );
  };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 18, overflow: "hidden", background: "#EDEDED",
      boxShadow: "0 20px 50px rgba(0,0,0,0.6)", padding: "34px 30px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 30 }}>
      <div style={{ alignSelf: "center", fontFamily: font(chat.time), fontSize: 28, color: "#8A8A8A" }}>{chat.time}</div>
      {chat.a ? bubble("l", chat.a, 0.3) : null}
      {chat.b ? bubble("r", chat.b, 0.75) : null}
    </div>
  );
};

export const FateScene: React.FC<{ ctx: SceneCtx; text: string; photo: string; chat: { time: string; a: string; b: string } }> = ({ ctx, text, photo, chat }) => {
  // The drawn chat card is a wide card sized to its three lines.
  const a = photo ? aspectOf(ctx.dir, photo) : 760 / 400;
  const W = photo ? (a >= 1 ? 900 : 560) : 760;
  const H = W / a;
  const x = 180;
  const y = 560 - H / 2;
  const p = eOut3(ramp(ctx.ls, 0, 0.38));
  const lines = splitLines(text);
  const out = exitAmount(ctx);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: out > 0.01 ? `blur(${out * 10}px)` : undefined }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${x}px ${y}px`, transform: `scale(${0.22 + 0.78 * p})`, opacity: Math.min(1, p * 2.5) }}>
        {photo ? (
          <Pic dir={ctx.dir} name={photo} x={x} y={y} w={W} h={H} shadow="0 20px 50px rgba(0,0,0,0.6)" />
        ) : (
          <ChatCard x={x} y={y} w={W} h={H} chat={chat} ls={ctx.ls} />
        )}
      </div>
      {ctx.stickers ? (
        <Sticker name="loading" cx={1450} cy={455} h={200} transform={`scale(${pop(ctx.ls - 0.15)}) translateY(${-6 * Math.abs(Math.sin(Math.PI * ctx.lb))}px)`} />
      ) : null}
      {lines.map((l, i) => (
        <div key={i} style={{ position: "absolute", left: 1450, top: (ctx.stickers ? 640 : 560 - ((lines.length - 1) * 130) / 2) + i * 130, ...fadeIn(sinceBeat(ctx, 0.5 + 0.5 * i)) }}>
          <HandLine text={l} size={72} maxWidth={860} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- title + photos pages

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Photos at their own aspect ratio in one row of equal height, as large as the area allows. */
export function rowLayout(dir: string, names: string[], cx: number, cy: number, maxW: number, maxH: number, gap = 16): Box[] {
  const as = names.map((n) => aspectOf(dir, n));
  const sum = as.reduce((s, a) => s + a, 0);
  const H = Math.min(maxH, (maxW - gap * (names.length - 1)) / sum);
  const total = sum * H + gap * (names.length - 1);
  let x = cx - total / 2;
  return as.map((a) => {
    const b = { x, y: cy - H / 2, w: a * H, h: H };
    x += a * H + gap;
    return b;
  });
}

/** Title on top, photos side by side below; sub-pages cut on the beat with a projector flicker. */
export const PageScene: React.FC<{
  ctx: SceneCtx;
  title: string;
  pages: SubPage[];
  titleSticker?: { name: StickerName; side: "left" | "right" };
}> = ({ ctx, title, pages, titleSticker: sticker }) => {
  const { lb, dir } = ctx;
  const titleSticker = ctx.stickers ? sticker : undefined;
  let start = 0;
  let idx = 0;
  while (idx < pages.length - 1 && lb >= start + pages[idx].beats) {
    start += pages[idx].beats;
    idx++;
  }
  const page = pages[idx];
  const sub = sinceBeat(ctx, start);
  const titleOut = eIn3(ramp(lb, ctx.beats - 0.4, ctx.beats - 0.05));
  const titleIn = eOut3(ramp(ctx.ls, 0, 0.18));
  const dancers = Boolean(page.dancers) && ctx.stickers;
  const boxes = dancers ? rowLayout(dir, page.photos, 960, 610, 1170, 790) : rowLayout(dir, page.photos, 960, 588, 1876, 720);
  const settle = eOut3(ramp(sub, 0, 0.35));
  const lift = 1 - eOut3(ramp(sub, 0, 0.14));
  const stickerH = 176;
  // the title row stays clear of the PLAY label: at most 1320 px wide, centered
  const room = 1320 - (titleSticker ? stickerH * 1.05 + 18 : 0);
  const titleSize = Math.min(68, room / lineEm(title));
  return (
    <AbsoluteFill>
      {boxes.map((b, i) => {
        const at = page.accumulate ? sinceBeat(ctx, start + i * page.accumulate) : sub;
        if (at < 0) return null;
        const p = page.accumulate ? eOut3(ramp(at, 0, 0.24)) : 1;
        const s = page.accumulate ? 0.9 + 0.1 * p : 1.035 - 0.035 * settle;
        return (
          <div key={`${idx}-${i}`} style={{ position: "absolute", inset: 0, opacity: p, transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h / 2}px`, transform: `scale(${s})` }}>
            <Pic dir={dir} name={page.photos[i]} x={b.x} y={b.y} w={b.w} h={b.h} filter={lift > 0.01 ? `brightness(${1 + 0.35 * lift})` : undefined} zoom={1 + 0.02 * ramp(lb - start, 0, page.beats)} />
          </div>
        );
      })}
      {dancers ? (
        <>
          <Sticker name="dance_l" cx={200} cy={800} h={400} transform={`scale(${pop(sub - 0.1)}) ${wiggle(lb, 6)}`} />
          <Sticker name="dance_r" cx={1722} cy={822} h={360} transform={`scale(${pop(sub - 0.2)}) ${wiggle(lb + 1, 6)}`} />
        </>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 18,
          transform: "translateY(-50%)",
          opacity: titleIn * (1 - titleOut),
          flexDirection: titleSticker?.side === "left" ? "row" : "row-reverse",
        }}
      >
        {titleSticker ? (
          <div style={{ position: "relative", width: stickerH * 1.05, height: stickerH }}>
            <Sticker name={titleSticker.name} cx={(stickerH * 1.05) / 2} cy={stickerH / 2} h={stickerH} transform={`scale(${pop(ctx.ls - 0.1)}) ${wiggle(lb)}`} />
          </div>
        ) : null}
        <HandLine text={title} size={titleSize} />
      </div>
      <Flicker amount={0.32 * (1 - ramp(sub, 0, 0.09))} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- film strip

/** Color of the generated strip's film base (sampled from filmstrip.png). */
const FILM_BASE = "#0a090a";

/**
 * Wedding photos on a 35 mm strip that runs to the right one frame per bar (each frame crosses the
 * screen center on a downbeat). The strip opens on a title block (plain film base, no frame
 * windows, carrying the title and the paper-plane sticker) and ends right after the last photo;
 * a white flash runs it out.
 */
export const StripScene: React.FC<{ ctx: SceneCtx; text: string; photos: string[] }> = ({ ctx, text, photos }) => {
  const { lb, beats, dir } = ctx;
  const S = 1080 / stripMeta.height;
  const tile = stripMeta.width * S;
  const P = tile / 3;
  const wx = stripMeta.windows[0][0] * S;
  const ww = (stripMeta.windows[0][1] - stripMeta.windows[0][0]) * S;
  const wy = stripMeta.windowTop * S;
  const wh = (stripMeta.windowBottom - stripMeta.windowTop) * S;
  const X = 960 - P / 2 + (P * lb) / 4;
  // the strip ends at the divider before the last photo, so no empty frame trails it
  const tailFrame = -photos.length;
  const tailX = X + tailFrame * P;
  const tiles = [];
  for (let k = Math.floor((tailFrame - 1) / 3); k <= 2; k++) tiles.push(k);
  const lines = splitLines(text);
  const runOut = lb >= beats - 0.3;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {photos.map((name, j) => {
        const fx = X - (j + 1) * P + wx;
        if (fx > 1920 || fx + ww < 0) return null;
        return <Pic key={name + j} dir={dir} name={name} x={fx} y={wy} w={ww} h={wh} />;
      })}
      {/* title block: film base behind the empty windows, so they read as solid film, not black photos */}
      <div style={{ position: "absolute", left: X, right: 0, top: wy - 4, height: wh + 8, background: FILM_BASE }} />
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${Math.max(0, tailX)}px)` }}>
        {tiles.map((k) => (
          <Img key={k} src={art("filmstrip.png")} style={{ position: "absolute", left: X + k * tile, top: 0, width: tile + 1, height: 1080 }} />
        ))}
      </div>
      {ctx.stickers ? <Sticker name="plane" cx={X + P} cy={400} h={250} transform={wiggle(lb, 2.5)} /> : null}
      <HandBlock lines={lines} size={66} cx={X + P} cy={ctx.stickers ? (lines.length > 1 ? 710 : 690) : 540} leading={112} />
      {runOut ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: wy - 6, background: "#fff" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: wy + wh + 6, bottom: 0, background: "#fff" }} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- ending

export const EndingScene: React.FC<{ ctx: SceneCtx; text: string }> = ({ ctx, text }) => {
  const lines = splitLines(text);
  const typing = ctx.typewriterCards ? narrativeTyping(ctx.lb, ctx.beats, lines, true) : null;
  const st = typing ? { transform: "translate(-50%, -50%)" } : fadeIn(sinceBeat(ctx, 0.75), 0.6);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {ctx.stickers ? (
        <Sticker name="wings" cx={960} cy={420} h={330} transform={`scale(${pop(ctx.ls, 0.55)}) ${wiggle(ctx.lb * 0.5, 2.5)}`} />
      ) : null}
      {lines.map((l, i) => (
        <div key={i} style={{ position: "absolute", left: 960, top: (ctx.stickers ? 730 : 540 - ((lines.length - 1) * 150) / 2) + i * 150, ...st }}>
          <HandLine text={l} size={80} shown={typing?.shown[i]} cursor={Boolean(typing && typing.cursorLine === i && typing.cursorOn)} />
        </div>
      ))}
    </AbsoluteFill>
  );
};
