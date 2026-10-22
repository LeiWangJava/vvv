import React, { useId } from "react";
import { AbsoluteFill, Img, random } from "remotion";
import { eBack, eIn3, eIo3, eOut3, ramp } from "../../core/ease";
import type { SceneCtx } from "./ctx";
import { sinceBeat } from "./ctx";
import { DVBackground, DVOverlay } from "./frames";
import { Glitch } from "./fx";
import { art, aspectOf, Pic } from "./media";
import { fontFor } from "../../core/fonts";
import { handFont, HandBlock } from "./text";
import { splitLines, typeProgress, typingSettings } from "./typing";
export { typeRate } from "./typing";

/** Horizontal-only Gaussian blur (VHS smear) as an SVG filter; sigma 0 renders nothing. */
export const useSmear = (sigma: number): { filter?: string; defs: React.ReactNode } => {
  const id = "sm" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (sigma < 0.4) return { defs: null };
  return {
    filter: `url(#${id})`,
    defs: (
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <filter id={id} x="-30%" y="-10%" width="160%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sigma.toFixed(2)} 0`} />
        </filter>
      </svg>
    ),
  };
};

// ---------------------------------------------------------------- title

/**
 * Tape glitch → empty viewfinder → chalk title drops in (lands on beat 2) → from beat 3 the
 * camera pushes through the viewfinder: its screen and readouts grow and fade while the title
 * grows on, one continuous move into the clean title on black (no cut).
 */
/**
 * The title drawn in type: a chalk-white hand-lettered Chinese line with a yellow script line
 * across it. A noise displacement roughens the strokes like chalk on a dark board.
 */
const TitleArt: React.FC<{ cn: string; en: string }> = ({ cn, en }) => {
  const chalk = "chalk" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={chalk} x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={5} xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feComponentTransfer in="noise" result="grain"><feFuncA type="linear" slope={1.2} intercept={0.25} /></feComponentTransfer>
          <feComposite in="rough" in2="grain" operator="in" />
        </filter>
      </svg>
      <div style={{ position: "relative", transform: "rotate(-4deg)", filter: `url(#${chalk})` }}>
        <div style={{ fontFamily: handFont(cn), fontSize: 230, color: "#F7F4EC", letterSpacing: 6, whiteSpace: "nowrap", lineHeight: 1 }}>{cn}</div>
        <div style={{ position: "absolute", right: -30, bottom: -140, transform: "rotate(-5deg)", fontFamily: fontFor("caveat", en, 600), fontSize: 175,
          color: "#E9C641", whiteSpace: "nowrap" }}>{en}</div>
      </div>
    </AbsoluteFill>
  );
};

export const TitleScene: React.FC<{ ctx: SceneCtx }> = ({ ctx }) => {
  const { t, f, fps, lb, clock } = ctx;
  const halfShutterBeats = 0.3 / fps / clock.period;
  const drop = (b: number) => -760 * (1 - eBack(ramp(b, 1, 2), 0.9));
  const y = drop(lb);
  const vy = Math.abs(drop(lb + halfShutterBeats) - drop(lb - halfShutterBeats));
  const blurId = "tb" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (t < 0.45) {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <Glitch f={f} />
      </AbsoluteFill>
    );
  }
  // push-through: 0 → 1 over beats 3 … 4.5
  const push = eIo3(ramp(lb, 3, 4.5));
  const scale = lb < 4.5 ? 0.9 + 0.16 * push : 1.06 + 0.035 * ramp(lb, 4.5, 8);
  const k = Math.floor(f / 2);
  const shake = lb >= 2 ? 1.2 * (1 - push) + 0.6 : 0;
  const jx = (random(`tc-${k}`) - 0.5) * 2 * shake;
  const jy = (random(`td-${k}`) - 0.5) * 2 * shake;
  const flick = 1 - push * 0.07 * random(`tf-${k}`);
  const bar = random(`tbar-${Math.floor(f / 3)}`);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {push < 1 ? (
        <AbsoluteFill style={{ opacity: 1 - push, transform: `scale(${1 + 0.35 * push})` }}>
          <DVBackground f={f} />
        </AbsoluteFill>
      ) : null}
      {lb >= 1 ? (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            transform: `translate(${jx}px, ${y + jy}px) scale(${scale})`,
            opacity: flick,
            filter: vy > 1 ? `url(#${blurId})` : undefined,
          }}
        >
          <TitleArt cn={ctx.title.cn} en={ctx.title.en} />
          <svg width={0} height={0} style={{ position: "absolute" }}>
            <filter id={blurId} x="-10%" y="-40%" width="120%" height="180%">
              <feGaussianBlur stdDeviation={`0 ${(vy / 2.5).toFixed(2)}`} />
            </filter>
          </svg>
        </AbsoluteFill>
      ) : null}
      {push < 1 ? (
        <AbsoluteFill style={{ opacity: 1 - push, transform: `scale(${1 + 0.35 * push})` }}>
          <DVOverlay clipSeconds={t} dotOn={Math.floor(clock.beatOf(t)) % 2 === 0} />
        </AbsoluteFill>
      ) : null}
      {push >= 1 && bar > 0.35 ? (
        <div
          style={{
            position: "absolute",
            left: 1862 + bar * 10,
            top: 260 + bar * 260,
            width: 16,
            height: 160 + bar * 200,
            overflow: "hidden",
            opacity: 0.75,
            mixBlendMode: "screen",
          }}
        >
          <Img src={art("textures/glitch-2.png")} style={{ position: "absolute", left: -900, top: -200, width: 1920, height: 1080 }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- typewriter

/** Typewriter lines with a block cursor; characters land on the beat subdivisions. */
export const TypeText: React.FC<{ ctx: SceneCtx; text: string; size?: number; leading?: number }> = ({ ctx, text, size = 86, leading = 147 }) => {
  const lines = splitLines(text);
  const { start, rate } = typingSettings("type", lines, ctx.beats);
  const { shown, cursorLine, done } = typeProgress(lines, ctx.lb, start, rate);
  const typing = ctx.lb >= start && !done;
  const blinkOn = Math.floor(ctx.lb * 2) % 2 === 0;
  return <HandBlock lines={lines} size={size} cx={960} cy={540} leading={leading} shown={shown} cursorLine={cursorLine} cursorOn={typing || blinkOn} />;
};

// ---------------------------------------------------------------- birth cards

/** Old print on the left, typed-in lines on the right; enters by a slit-open or a swing. */
export const BirthScene: React.FC<{ ctx: SceneCtx; text: string; photo: string; variant: "slit" | "swing" }> = ({ ctx, text, photo, variant }) => {
  const { lb, beats, dir } = ctx;
  const a = aspectOf(dir, photo);
  const H = a >= 1.2 ? 620 : 650;
  const W = Math.min(900, H * a);
  const x = 357;
  const y = 548 - H / 2;
  const tx = (x + W + 1850) / 2;
  const lines = splitLines(text);
  const leading = lines.length > 2 ? 150 : 172;

  const pin = eOut3(ramp(lb, 0, 0.8));
  const out = eIn3(ramp(lb, beats - 0.6, beats));
  const cardSmear = useSmear(variant === "slit" ? 38 * (1 - pin) + 30 * out : 30 * out);
  let cardStyle: React.CSSProperties;
  if (variant === "slit") {
    const inset = (1 - pin) * 49.5;
    cardStyle = { clipPath: `inset(${inset}% 0 ${inset}% 0)`, transform: `translateX(${40 * (1 - pin) + 50 * out}px)` };
  } else {
    const q = eOut3(ramp(lb, 0, 1));
    cardStyle = {
      transform: `perspective(1500px) translateX(${50 * out}px) rotateY(${-62 * (1 - q)}deg) scale(${0.9 + 0.1 * q})`,
      transformOrigin: "0% 50%",
      opacity: Math.min(1, q * 3),
    };
  }
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: cardSmear.filter, opacity: 1 - out }}>
        <div style={{ position: "absolute", inset: 0, ...cardStyle }}>
          <Pic dir={dir} name={photo} x={x} y={y} w={W} h={H} border={12} shadow="0 18px 40px rgba(0,0,0,0.55)" zoom={1 + 0.025 * ramp(lb, 0, beats)} />
        </div>
      </AbsoluteFill>
      {cardSmear.defs}
      {lines.map((l, i) => (
        <SmearLine key={i} text={l} lb={lb} start={0.5 + 0.5 * i} out={out} cx={tx} maxWidth={1850 - (x + W) - 70} cy={548 - ((lines.length - 1) * leading) / 2 + i * leading} />
      ))}
    </AbsoluteFill>
  );
};

const SmearLine: React.FC<{ text: string; lb: number; start: number; out: number; cx: number; cy: number; maxWidth?: number }> = ({ text, lb, start, out, cx, cy, maxWidth }) => {
  const s = eOut3(ramp(lb, start, start + 0.9));
  const smear = useSmear(42 * (1 - s) + 36 * out);
  if (s <= 0) return null;
  return (
    <AbsoluteFill style={{ filter: smear.filter, opacity: s * (1 - out) }}>
      <HandBlock lines={[text]} size={70} cx={cx + 70 * (1 - s) + 60 * out} cy={cy} leading={0} maxWidth={maxWidth} />
      {smear.defs}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- childhood flashes

/**
 * One photo per bar: it appears on the downbeat a little bright and large and settles (no
 * full-screen flash: the warm light-leak version read as an orange flash), is held, and leaves
 * half a beat early so the empty viewfinder breathes before the next one.
 */
export const FlashScene: React.FC<{ ctx: SceneCtx; photos: string[] }> = ({ ctx, photos }) => {
  const { lb, dir } = ctx;
  const i = Math.min(photos.length - 1, Math.floor(lb / 4));
  const li = lb - 4 * i;
  if (li >= 3.5) return null;
  const name = photos[i];
  const since = sinceBeat(ctx, 4 * i);
  const a = aspectOf(dir, name);
  let H = 700;
  let W = H * a;
  if (W > 1200) {
    W = 1200;
    H = W / a;
  }
  const x = 960 - W / 2;
  const y = 548 - H / 2;
  const e = eOut3(ramp(since, 0, 0.3));
  const settle = eOut3(ramp(since, 0, 0.35));
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, since / 0.06), transform: `scale(${1.035 - 0.035 * settle})` }}>
      <Pic
        dir={dir}
        name={name}
        x={x}
        y={y}
        w={W}
        h={H}
        border={12}
        shadow="0 18px 40px rgba(0,0,0,0.55)"
        zoom={1 + 0.03 * ramp(li, 0, 3.5)}
        filter={e < 1 ? `brightness(${1.3 - 0.3 * e})` : undefined}
      />
    </AbsoluteFill>
  );
};

/** Camcorder screen around a scene: textured LCD, the scene, then REC/timecode on top. */
export const DVScreen: React.FC<{ ctx: SceneCtx; children: React.ReactNode }> = ({ ctx, children }) => (
  <AbsoluteFill>
    <DVBackground f={ctx.f} />
    {children}
    <DVOverlay clipSeconds={ctx.t} dotOn={Math.floor(ctx.clock.beatOf(ctx.t)) % 2 === 0} />
  </AbsoluteFill>
);
