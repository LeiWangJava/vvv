import React from "react";
import { AbsoluteFill } from "remotion";
import { Glitter } from "../../components/Glitter";
import { LightLeak, WARM_LEAK, type LeakBlob } from "../../components/Overlays";
import { travel } from "../../components/Photo";
import { Box, Group, Line } from "../../components/Shapes";
import { eBack, eIn3, eIo3, eOut3, eOutSine, eSine, fadeRise, kb, lerp, ramp } from "../../core/ease";
import { fontFor } from "../../core/fonts";
import { faceCenter } from "../../core/crop";
import { getPhoto } from "../../core/manifest";
import { fitText } from "../../core/text-fit";
import { useT } from "../../core/time";
import { useHalfShutter } from "../../engine/Film";
import { Bleed, bez, C, faceOf, LabelRow, Pic, Quote, SHADOW_SOFT, T, type Face } from "../shared/kit";

/**
 * XY-01 现代留白·圆角画册 — one component per segment of the Python film (legacy-xy01-engine/film.py),
 * same times and easing. Times are *design* seconds; the beat warp moves them onto the music.
 */

export interface Ctx {
  ph: {
    opening: string;
    bride: string;
    groom: string;
    duoWide: string;
    duoTall: string;
    storyWide: string;
    storyTall: string;
    poem: string[];
    beachBig: string;
    beachSmall: string[];
    rise: string[];
    drop: string[];
    pairTall: string;
    pairWide: string;
    panels: string[];
    endless: string[];
    quoteBig: string;
    quoteSmall: string[];
    foreverMid: string;
    foreverLeft: string;
    foreverRight: string;
    glow: string;
    handwriting: string;
    prints: string[];
    vertical: string;
    ending: string;
  };
  groom: string;
  bride: string;
  names: string;
  date: string;
  tagline: string;
  copy: Record<string, string>;
}

type Seg = React.FC<{ c: Ctx }>;
/**
 * Text on a full-bleed photo goes where the photo has room: its tagged textSpace first; an untagged
 * photo (project import) puts the text opposite its detected faces, and without faces on the
 * right, where a shaded gradient keeps it legible over any picture.
 */
const onLeft = (id: string) => {
  const p = getPhoto(id);
  if (p.textSpace) return p.textSpace === "left";
  const fc = faceCenter(p);
  return fc ? fc[0] > 0.5 : false;
};
/**
 * Where a title block goes on a full-bleed photo: a tagged or face-derived side, or — for an
 * untagged photo without faces, where either side may cover the couple — a centred lower third over
 * a bottom gradient (faces sit in the upper half of nearly every wedding photo).
 */
type Place = "left" | "right" | "bottom";
const titlePlace = (id: string): Place => {
  const p = getPhoto(id);
  if (!p.textSpace && !faceCenter(p)) return "bottom";
  return onLeft(id) ? "left" : "right";
};
/** Fit couple names (or other user text) into a column; a long pair of Latin names breaks once at " & ". */
const fitFace = (s: string, f: Face, size: number, maxW: number, tracking = 0, wrap = true) => {
  const { font, weight } = faceOf(f);
  const fit = fitText(s, font, size, maxW, { weight, tracking, wrap });
  /** extra height of a second line, for pushing the lines below down */
  return { ...fit, extra: fit.lines > 1 ? fit.size * 1.18 : 0 };
};

// ---------------------------------------------------------------- 0 · opening: full bleed + title
const SpreadTitle: React.FC<{ text: string; x: number; y: number; t: number }> = ({ text, x, y, t }) => {
  const size = 60;
  const spread = 0.22 * (1 - eOut3(ramp(t, 0.6, 2.4)));
  const family = fontFor("display", text, 400);
  const tracking = 11 + spread * size * 0.66;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translateX(-50%)",
        fontFamily: family,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: tracking,
        paddingLeft: tracking,
        whiteSpace: "pre",
        color: C.white,
      }}
    >
      {[...text].map((ch, i) => {
        const ti = 0.6 + i * 0.055;
        const e = eOut3(ramp(t, ti, ti + 0.8));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: e,
              transform: `translateY(${-10 * (1 - e)}px)`,
              filter: e < 1 ? `blur(${7 * (1 - e)}px)` : undefined,
              textShadow: `0 2px ${5 + 6 * (1 - e)}px rgba(0,0,0,${0.28 * e})`,
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </div>
  );
};

export const Seg0: Seg = ({ c }) => {
  const t = useT();
  const place = titlePlace(c.ph.opening);
  const left = place === "left";
  const XC = place === "bottom" ? 960 : left ? 520 : 1400;
  const Y = place === "bottom" ? 640 : 300;
  // the text column stays inside the shaded side of the frame
  const COL = place === "bottom" ? 1500 : 860;
  const nm = fitFace(c.names, "songB", 40, COL, 6);
  const z = lerp(1.15, 1.05, eOut3(ramp(t, 0, 4.2)));
  const focusBlur = 22 * (1 - eOut3(ramp(t, 0, 1.2)));
  const whiteIn = 1 - eOut3(ramp(t, 0, 1.0));
  const path = bez(
    ([[-120, 820], [500, 640], [1100, 260], [1900, 120]] as [number, number][]).map(([x, y]): [number, number] => [left ? 1920 - x : x, y + 150]),
  );
  const [e1, d1] = fadeRise(t, 1.45, 2.25);
  const e2 = eOut3(ramp(t, 1.7, 2.5));
  const [e3, d3] = fadeRise(t, 1.9, 2.7);
  const [e4, d4] = fadeRise(t, 2.1, 2.9);
  return (
    <>
      <AbsoluteFill style={{ filter: focusBlur > 0.3 ? `blur(${focusBlur}px)` : undefined }}>
        <Bleed id={c.ph.opening} z={z} />
      </AbsoluteFill>
      {/* A bright sea or sky needs a quiet, shaded text area as well as a glyph shadow. */}
      <AbsoluteFill style={{
        background: place === "bottom"
          ? "linear-gradient(to top, rgba(12,10,8,0.7) 0%, rgba(12,10,8,0.6) 36%, rgba(12,10,8,0) 62%)"
          : `linear-gradient(${left ? "to right" : "to left"}, rgba(12,10,8,0.62) 0%, rgba(12,10,8,0.58) 46%, rgba(12,10,8,0) 70%)`,
        opacity: eOut3(ramp(t, 0.2, 1.2)),
      }} />
      {whiteIn > 0.002 ? <AbsoluteFill style={{ background: C.white, opacity: whiteIn }} /> : null}
      <Glitter
        bursts={[
          { seed: 11, n: 420, t0: 0.15, t1: 1.9, path: (u) => path(eIo3(u)), jit: 46, life: [0.9, 2.6], vel: [38, 34], grav: 30, rsize: [0.6, 2.8], starP: 0.14, inten: 1.25 },
        ]}
        ambient={[{ seed: 12, n: 46, t0: 0, t1: 4.4, box: [0, 0, 1920, 1080], inten: 0.28 }]}
      />
      <SpreadTitle text="WE ARE MARRIED" x={XC} y={Y} t={t} />
      <T s={c.tagline} f="songR" size={42} tr={18} c={C.white} x={XC} y={Y + 92 + d1} a="ct" op={e1} shadow={SHADOW_SOFT} maxW={COL} />
      <Box cx={XC} cy={Y + 172} w={320 * e2} h={1.6} color={C.white} op={0.9 * e2} />
      <T s={nm.text} f="songB" size={nm.size} tr={nm.tracking} c={C.white} x={XC} y={Y + 198 + d3} a="ct" op={e3} shadow={SHADOW_SOFT} style={{ lineHeight: 1.18 }} />
      <T s={c.date} f="avMed" size={34} tr={10} c={C.white} x={XC} y={Y + 266 + nm.extra + d4} a="ct" op={e4} shadow={SHADOW_SOFT} />
    </>
  );
};

// ---------------------------------------------------------------- 1 · bride / groom portraits
export const Seg1: Seg = ({ c }) => {
  const t = useT();
  const pe = eIo3(ramp(t, 7.28, 7.68));
  const z = kb(t, 3.6, 7.8, 1.12, 1.0);
  const [e, dy] = fadeRise(t, 4.3, 5.0, 12);
  return (
    <Group sc={1 + 0.04 * pe} op={1 - pe}>
      <Pic id={c.ph.bride} cx={492} cy={498} w={912} h={924} z={z} />
      <Pic id={c.ph.groom} cx={1428} cy={498} w={912} h={924} z={z} />
      <LabelRow cx={492} y={1003 + dy} en="THE BRIDE" cn={c.bride} op={e} />
      <LabelRow cx={1428} y={1003 + dy} en="THE GROOM" cn={c.groom} op={e} />
    </Group>
  );
};

// ---------------------------------------------------------------- 2 · wide photo centre → left, tall one in from the right, names
export const Seg2: Seg = ({ c }) => {
  const t = useT();
  const hs = useHalfShutter();
  const out = (tt: number) => eIn3(ramp(tt, 12.35, 12.85));
  const posA = (tt: number): [number, number] => {
    const e2 = eIo3(ramp(tt, 8.9, 9.9));
    return [lerp(960, 596, e2) - 1300 * out(tt), lerp(520, 409.5, e2)];
  };
  const posB = (tt: number): [number, number] => [1532 + 900 * (1 - eOut3(ramp(tt, 9.05, 10.05))) + 900 * out(tt), 540];
  const s1 = 0.9 + 0.1 * eOut3(ramp(t, 7.62, 8.45));
  const [ax, ay] = posA(t);
  const [bx, by] = posB(t);
  const w = eIo3(ramp(t, 9.9, 10.8));
  const [ew, dw] = fadeRise(t, 10.4, 11.0, 14);
  const [ed, dd] = fadeRise(t, 10.55, 11.15, 14);
  const [el, dl] = fadeRise(t, 10.7, 11.3, 14);
  const er = eOut3(ramp(t, 10.6, 11.6));
  return (
    <>
      <Pic id={c.ph.duoWide} cx={ax} cy={ay} w={1120 * s1} h={747 * s1} z={kb(t, 7.6, 12.4, 1.1)} op={eOut3(ramp(t, 7.62, 8.0))} mv={travel(posA, t, hs)} />
      <Pic id={c.ph.duoTall} cx={bx} cy={by} w={704} h={1008} z={kb(t, 9.0, 12.4, 1.1)} op={eOut3(ramp(t, 9.05, 9.4))} mv={travel(posB, t, hs)} />
      <Group op={1 - eOut3(ramp(t, 12.35, 12.6))}>
        <div style={{ position: "absolute", left: 64, top: 832, display: "flex", alignItems: "flex-start" }}>
          <T s={c.names} f="songB" size={56} wipe={w} maxW={740} />
          <div style={{ position: "relative", width: 62, height: 64 }}>
            <Line x0={42} y0={-6} x1={24} y1={64} color={C.dark} width={2} op={eOut3(ramp(t, 10.3, 10.7))} />
          </div>
          <T s="WEDDING DAY" f="avDemi" size={30} tr={5} op={ew} style={{ marginTop: 14 + dw }} />
        </div>
        <T s={c.date} f="avMed" size={36} tr={8} c={C.gold} x={66} y={922 + dd} op={ed} />
        <T s="TWO HEARTS  ·  ONE LOVE  ·  FOREVER" f="avDemi" size={28} tr={6} c={C.grey} x={66} y={984 + dl} op={el} />
        <Box cx={64 + 546 * er} cy={1043} w={1092 * er} h={1.2} color={C.lgrey} op={er} />
      </Group>
    </>
  );
};

// ---------------------------------------------------------------- 3 · wide photo centre → right, tall one in from the left, "Love Story"
export const Seg3: Seg = ({ c }) => {
  const t = useT();
  const hs = useHalfShutter();
  // leaves while the poem panels already rise in (Seg45), so the page is never blank
  const pe = eIo3(ramp(t, 17.25, 17.8));
  const s1 = 0.9 + 0.1 * eOut3(ramp(t, 12.7, 13.5));
  const e2 = eIo3(ramp(t, 13.8, 14.9));
  const posA = (tt: number): [number, number] => {
    const k = eIo3(ramp(tt, 13.8, 14.9));
    return [lerp(960, 1292, k), lerp(540, 649.5, k)];
  };
  const posB = (tt: number): [number, number] => [356 - 720 * (1 - eOut3(ramp(tt, 13.95, 14.95))), 540];
  const [ax, ay] = posA(t);
  const [bx] = posB(t);
  const [ea, da] = fadeRise(t, 15.0, 15.6, 12);
  const [eb, db] = fadeRise(t, 15.15, 15.75, 12);
  const [ec, dc] = fadeRise(t, 15.25, 15.85, 12);
  const er = eOut3(ramp(t, 14.9, 15.9));
  return (
    <Group sc={1 + 0.035 * pe} op={1 - pe}>
      <Pic id={c.ph.storyWide} cx={ax} cy={ay} w={lerp(1000, 1184, e2) * s1} h={lerp(667, 789, e2) * s1} z={kb(t, 12.7, 17.4, 1.1)} op={eOut3(ramp(t, 12.7, 13.1))} mv={travel(posA, t, hs)} />
      <Pic id={c.ph.storyTall} cx={bx} cy={540} w={640} h={1008} z={kb(t, 13.9, 17.4, 1.1)} mv={travel(posB, t, hs)} />
      <T s="Love Story" f="savoye" size={128} x={700} y={206} a="lb" wipe={eIo3(ramp(t, 14.6, 15.7))} wsoft={0.35} />
      <T s="WE GOT MARRIED" f="avHeavy" size={32} tr={6} x={1882} y={86 + da} a="rt" op={ea} />
      <T s={c.copy.story_a} f="songR" size={36} tr={5} c={C.grey} x={1882} y={136 + db} a="rt" op={eb} maxW={740} />
      <T s={c.copy.story_b} f="songR" size={36} tr={5} c={C.grey} x={1882} y={188 + dc} a="rt" op={ec} maxW={740} />
      <Box cx={1882 - 590 * er} cy={246} w={1180 * er} h={1.2} color={C.lgrey} op={er} />
    </Group>
  );
};

// ---------------------------------------------------------------- 4 · vertical poem between two panels, photos swap inside the panels
export const Seg45: Seg = ({ c }) => {
  const t = useT();
  const hs = useHalfShutter();
  const L: [number, number, number, number] = [36, 36, 740, 1044];
  const R: [number, number, number, number] = [1180, 36, 1884, 1044];
  const eL = eOut3(ramp(t, 17.5, 18.5));
  const eR = eOut3(ramp(t, 17.62, 18.62));
  const sL = (tt: number) => eIo3(ramp(tt, 21.8, 22.6));
  const sR = (tt: number) => eIo3(ramp(tt, 21.9, 22.7));
  const zo = kb(t, 17.75, 22.6, 1.12, 1.0);
  const zn = kb(t, 21.8, 26.8, 1.1, 1.0);
  const [l0, l1, r0, r1] = c.ph.poem;
  const yL0 = (tt: number): [number, number] => [388, 540 + 1032 * sL(tt)];
  const yL1 = (tt: number): [number, number] => [388, 540 - 1032 * (1 - sL(tt))];
  const yR0 = (tt: number): [number, number] => [1532, 540 - 1032 * sR(tt)];
  const yR1 = (tt: number): [number, number] => [1532, 540 + 1032 * (1 - sR(tt))];
  const chars: React.ReactNode[] = [];
  let idx = 0;
  const [poemR, poemL = ""] = c.copy.poem.split("｜");
  for (const [colX, s] of [[1004, poemR], [916, poemL]] as [number, string][]) {
    [...s].forEach((ch, i) => {
      const ti = 18.35 + idx++ * 0.07;
      const e = eOut3(ramp(t, ti, ti + 0.55));
      chars.push(<T key={`${colX}-${i}`} s={ch} f="songR" size={56} x={colX} y={340 + i * 76 - 16 * (1 - e)} a="cm" op={e} blur={4 * (1 - e)} />);
    });
  }
  const es = ramp(t, 19.3, 19.75);
  const seal = 1.35 - 0.35 * eBack(es);
  const eg = eOut3(ramp(t, 19.0, 19.9));
  return (
    <>
      {sL(t) < 1 ? <Pic id={l0} cx={yL0(t)[0]} cy={yL0(t)[1]} w={704} h={1008} z={zo} clip={[36, 1044 - 1008 * eL, 740, 1044]} off={[0, 50 * (1 - eL)]} mv={travel(yL0, t, hs)} /> : null}
      {sL(t) > 0 ? <Pic id={l1} cx={yL1(t)[0]} cy={yL1(t)[1]} w={704} h={1008} z={zn} clip={L} mv={travel(yL1, t, hs)} /> : null}
      {sR(t) < 1 ? <Pic id={r0} cx={yR0(t)[0]} cy={yR0(t)[1]} w={704} h={1008} z={zo} clip={[1180, 36, 1884, 36 + 1008 * eR]} off={[0, -50 * (1 - eR)]} mv={travel(yR0, t, hs)} /> : null}
      {sR(t) > 0 ? <Pic id={r1} cx={yR1(t)[0]} cy={yR1(t)[1]} w={704} h={1008} z={zn} clip={R} mv={travel(yR1, t, hs)} /> : null}
      {chars}
      <Box cx={916} cy={760} w={62} h={62} color={C.seal} op={eOut3(es)} scale={seal}>
        <T s="囍" f="songB" size={42} c={C.white} />
      </Box>
      <T s="FOREVER  ·  LOVE" f="avDemi" size={28} tr={8} c={C.grey} x={960} y={50} a="ct" sideways op={eOut3(ramp(t, 18.8, 19.5))} />
      <Box cx={960} cy={830 + 50 * eg} w={1.6} h={100 * eg} color={C.gold} op={eg} />
      <T s={c.date} f="avMed" size={28} tr={6} c={C.grey} x={960} y={1050} a="cb" sideways op={eOut3(ramp(t, 19.4, 20.0))} />
    </>
  );
};

// ---------------------------------------------------------------- 6 · big + quote + two small
export const Seg6: Seg = ({ c }) => {
  const t = useT();
  const pe = eIo3(ramp(t, 32.3, 32.72));
  const [s0, s1] = c.ph.beachSmall;
  return (
    <Group sc={1 + 0.035 * pe} op={1 - pe}>
      <Pic id={c.ph.beachBig} cx={416} cy={540} w={760} h={1008} z={kb(t, 26.8, 32.4, 1.1)} />
      <Pic id={s0} cx={1664} cy={282} w={440} h={492} z={kb(t, 26.8, 32.4, 1.08)} />
      <Pic id={s1} cx={1664} cy={798} w={440} h={492} z={kb(t, 26.8, 32.4, 1.08)} />
      <Quote t={t} lines={["“YOU ARE MY", "TODAY AND ALL", "OF MY TOMORROWS.”"]} xc={1120} t0={27.55} cn={c.copy.quote_a} sub={`${c.names}   ${c.date}`} maxW={600} />
    </Group>
  );
};

// ---------------------------------------------------------------- 7 · three panels rising, header words
const Word: React.FC<{ s: string; x: number; y: number; top: boolean; op: number; line: number }> = ({ s, x, y, top, op, line }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, ${top ? "-100%" : "0"})`, opacity: op }}>
    <T s={s} f="bodoni" size={34} tr={4} style={{ paddingLeft: 4 }} />
    <div
      style={{
        position: "absolute",
        left: 4,
        right: 0,
        [top ? "bottom" : "top"]: -12,
        height: 1.3,
        background: C.dark,
        opacity: 0.6,
        transform: `scaleX(${line})`,
      }}
    />
  </div>
);

export const Seg7: Seg = ({ c }) => {
  const t = useT();
  const hs = useHalfShutter();
  const ho = 1 - ramp(t, 36.8, 37.1);
  const words = ["DESTINY.", "PROMISE.", "FOREVER."];
  return (
    <>
      {([336, 960, 1584] as const).map((x, k) => {
        const pos = (tt: number): [number, number] => [
          x,
          597 + 1100 * (1 - eOut3(ramp(tt, 32.68 + 0.1 * k, 33.58 + 0.1 * k))) + 1100 * eIn3(ramp(tt, 36.8 + 0.08 * k, 37.4 + 0.08 * k)),
        ];
        const e = eOut3(ramp(t, 33.2 + 0.1 * k, 33.8 + 0.1 * k)) * ho;
        return (
          <React.Fragment key={k}>
            <Pic id={c.ph.rise[k]} cx={x} cy={pos(t)[1]} w={600} h={894} z={kb(t, 32.6, 37.4, 1.1)} mv={travel(pos, t, hs)} />
            <Word s={words[k]} x={x} y={112} top op={e} line={eOut3(ramp(t, 33.4 + 0.1 * k, 34.0 + 0.1 * k))} />
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- 8 · three panels dropping, footer words
export const Seg8: Seg = ({ c }) => {
  const t = useT();
  const hs = useHalfShutter();
  const words = ["SWEETHEART.", "TOGETHER.", "ALWAYS."];
  return (
    <>
      {([336, 960, 1584] as const).map((x, k) => {
        const pos = (tt: number): [number, number] => [x, 483 - 1100 * (1 - eOut3(ramp(tt, 37.0 + 0.1 * k, 37.9 + 0.1 * k)))];
        const e = eOut3(ramp(t, 37.8 + 0.1 * k, 38.4 + 0.1 * k));
        return (
          <React.Fragment key={k}>
            <Pic id={c.ph.drop[k]} cx={x} cy={pos(t)[1]} w={600} h={894} z={kb(t, 37.0, 42.0, 1.1)} mv={travel(pos, t, hs)} />
            <Word s={words[k]} x={x} y={978} top={false} op={e} line={eOut3(ramp(t, 38.0 + 0.1 * k, 38.6 + 0.1 * k))} />
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- 9 · header/footer, two panels squeeze shut, three open
export const Seg9: Seg = ({ c }) => {
  const t = useT();
  const ho = 1 - eIo3(ramp(t, 50.95, 51.3));
  const q = eIn3(ramp(t, 46.8, 47.2));
  const pair: [number, number, string, number][] = [
    [336, 600, c.ph.pairTall, 0.35],
    [1272, 1224, c.ph.pairWide, 0.45],
  ];
  return (
    <>
      <div style={{ position: "absolute", left: 960, top: 92, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: 36, opacity: ho }}>
        <div style={{ width: 200, height: 1.2, background: C.dark, opacity: 0.5 }} />
        <T s="OUR WEDDING DAY" f="avHeavy" size={34} tr={12} style={{ paddingLeft: 12 }} />
        <div style={{ width: 200, height: 1.2, background: C.dark, opacity: 0.5 }} />
      </div>
      <T s={c.copy.one_heart} f="songR" size={36} tr={12} c={C.grey} x={960} y={1022} a="cm" op={ho} maxW={1600} />
      {q < 1
        ? pair.map(([cx, w, id, fy]) => {
            const cw = w * (1 - q);
            return <Pic key={id} id={id} cx={cx} cy={560} w={w} h={820} z={kb(t, 41.8, 46.8, 1.1) + 0.12 * q} clip={[cx - cw / 2, 150, cx + cw / 2, 970]} />;
          })
        : null}
      {([336, 960, 1584] as const).map((cx, k) => {
        const o = eOut3(ramp(t, 47.15 + 0.08 * k, 47.65 + 0.08 * k));
        if (o <= 0) return null;
        const pe = eIo3(ramp(t, 50.95 + 0.05 * k, 51.3 + 0.05 * k));
        const cw = 600 * o;
        return (
          <Group key={k} sc={1 - 0.08 * pe} op={1 - pe} cx={cx} cy={560}>
            <Pic id={c.ph.panels[k]} cx={cx} cy={560} w={600} h={820} z={lerp(1.16, 1.0, o) * kb(t, 47.6, 51.0, 1.05)} clip={[cx - cw / 2, 150, cx + cw / 2, 970]} />
          </Group>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- 11 · two portraits wipe open + script column
export const Seg11: Seg = ({ c }) => {
  const t = useT();
  const pe = eIn3(ramp(t, 55.55, 56.05));
  const z = kb(t, 51.2, 55.6, 1.1);
  const w1 = eOut3(ramp(t, 51.33, 52.23));
  const w2 = eOut3(ramp(t, 51.48, 52.38));
  const X = 1662;
  const eg = eOut3(ramp(t, 52.6, 53.2));
  const [en, dn] = fadeRise(t, 53.0, 53.6);
  const [ed, dd] = fadeRise(t, 53.1, 53.7);
  // the script column between the portraits and the frame edge is ~480 px wide
  const nm = fitFace(c.names, "songR", 34, 460, 4);
  return (
    <Group dx={-80 * pe} op={1 - pe}>
      <Pic id={c.ph.endless[0]} cx={372} cy={540} w={672} h={1008} z={z} clip={[36, 36, 36 + 672 * w1, 1044]} off={[-60 * (1 - w1), 0]} />
      <Pic id={c.ph.endless[1]} cx={1068} cy={540} w={672} h={1008} z={z} clip={[732, 36, 732 + 672 * w2, 1044]} off={[-60 * (1 - w2), 0]} />
      <T s="Endless" f="savoye" size={120} x={X} y={250} a="cm" wipe={eIo3(ramp(t, 51.9, 52.8))} wsoft={0.35} />
      <T s="Love" f="savoye" size={120} x={X} y={372} a="cm" wipe={eIo3(ramp(t, 52.3, 53.1))} wsoft={0.35} />
      <Box cx={X} cy={470} w={180 * eg} h={1.4} color={C.gold} op={eg} />
      {c.copy.vow.split("｜").map((ln, k) => {
        const [e, dy] = fadeRise(t, 52.7 + 0.15 * k, 53.3 + 0.15 * k);
        return <T key={ln} s={ln} f="songR" size={40} tr={14} x={X + 7} y={520 + 66 * k + dy} a="ct" op={e} maxW={470} />;
      })}
      <T s={nm.text} f="songR" size={nm.size} tr={nm.tracking} c={C.grey} x={X} y={700 + dn} a="ct" op={en} style={{ lineHeight: 1.18 }} />
      <T s={c.date} f="avMed" size={34} tr={8} c={C.gold} x={X} y={760 + nm.extra + dd} a="ct" op={ed} />
    </Group>
  );
};

// ---------------------------------------------------------------- 12 · two small + quote + big
export const Seg12: Seg = ({ c }) => {
  const t = useT();
  const hs = useHalfShutter();
  const pe = eIn3(ramp(t, 61.0, 61.45));
  const z = kb(t, 55.8, 61.0, 1.1);
  const big = (tt: number): [number, number] => [1504 + 900 * (1 - eOut3(ramp(tt, 55.8, 56.7))), 540];
  const sm0 = (tt: number): [number, number] => [256 - 560 * (1 - eOut3(ramp(tt, 55.95, 56.8))), 282];
  const sm1 = (tt: number): [number, number] => [256 - 560 * (1 - eOut3(ramp(tt, 56.05, 56.9))), 798];
  return (
    <Group sc={1 + 0.035 * pe} op={1 - pe}>
      <Pic id={c.ph.quoteBig} cx={big(t)[0]} cy={540} w={760} h={1008} z={z} mv={travel(big, t, hs)} />
      <Pic id={c.ph.quoteSmall[0]} cx={sm0(t)[0]} cy={282} w={440} h={492} z={z} mv={travel(sm0, t, hs)} />
      <Pic id={c.ph.quoteSmall[1]} cx={sm1(t)[0]} cy={798} w={440} h={492} z={z} mv={travel(sm1, t, hs)} />
      <Quote t={t} lines={["“MORE THAN", "YESTERDAY,", "LESS THAN", "TOMORROW.”"]} xc={800} t0={56.5} cn={c.copy.quote_b} step={0.13} maxW={600} />
    </Group>
  );
};

// ---------------------------------------------------------------- 13 · three photos + FOREVER / LOVE YOU
export const Seg13: Seg = ({ c }) => {
  const t = useT();
  const hs = useHalfShutter();
  const e0 = eOut3(ramp(t, 61.3, 62.1));
  const s = 0.9 + 0.1 * e0;
  const left = (tt: number): [number, number] => [276 - 600 * (1 - eOut3(ramp(tt, 61.9, 62.8))), 396];
  const right = (tt: number): [number, number] => [1560 + 800 * (1 - eOut3(ramp(tt, 62.0, 62.9))), 690];
  const [ed, dd] = fadeRise(t, 62.9, 63.5);
  const [en, dn] = fadeRise(t, 63.05, 63.65);
  const [et, dt] = fadeRise(t, 63.2, 63.8);
  // left column under FOREVER: the names may take a second line (the copy line moves down)
  const nm = fitFace(c.names, "songB", 32, 480, 2);
  return (
    <>
      <Pic id={c.ph.foreverMid} cx={876} cy={540} w={672 * s} h={1008 * s} z={kb(t, 61.3, 66.0, 1.1)} op={eOut3(ramp(t, 61.3, 61.7))} />
      <Pic id={c.ph.foreverLeft} cx={left(t)[0]} cy={396} w={480} h={720} z={kb(t, 61.9, 66.0, 1.08)} mv={travel(left, t, hs)} />
      <Pic id={c.ph.foreverRight} cx={right(t)[0]} cy={690} w={648} h={708} z={kb(t, 62.0, 66.0, 1.08)} mv={travel(right, t, hs)} />
      <T s="FOREVER" f="avHeavy" size={46} tr={12} x={40} y={788} wipe={eIo3(ramp(t, 62.6, 63.3))} />
      <T s={c.date} f="avMed" size={30} tr={7} c={C.gold} x={42} y={862 + dd} op={ed} />
      <T s={nm.text} f="songB" size={nm.size} tr={nm.tracking} x={40} y={916 + dn} op={en} style={{ lineHeight: 1.18 }} />
      <T s={c.copy.forever} f="songR" size={32} tr={8} c={C.grey} x={42} y={976 + nm.extra + dt} op={et} maxW={480} />
      <T s="LOVE YOU" f="avHeavy" size={46} tr={12} x={1240} y={62} wipe={eIo3(ramp(t, 62.8, 63.5))} />
      {c.copy.love_you.split("｜").map((ln, k) => {
        const [e, dy] = fadeRise(t, 63.1 + 0.1 * k, 63.7 + 0.1 * k);
        return <T key={ln} s={ln} f="songR" size={34} tr={4} c={C.grey} x={1242} y={140 + 54 * k + dy} op={e} maxW={640} />;
      })}
    </>
  );
};

// ---------------------------------------------------------------- 14 · full bleed + light leak
export const Seg14: Seg = ({ c }) => {
  const t = useT();
  return (
    <>
      <Bleed id={c.ph.glow} z={lerp(1.0, 1.1, eSine(ramp(t, 66.0, 71.8)))} />
      <LightLeak strength={0.7} blobs={WARM_LEAK} />
    </>
  );
};

// ---------------------------------------------------------------- 15 · full bleed + vertical handwriting
const LEAK15: LeakBlob[] = [
  [220, 100, 130, 80, 0.6, 0.45, 0.5, 440, [1.0, 0.58, 0.24], 0.85],
  [1700, 980, 200, 70, 0.4, 0.55, 2.0, 420, [1.0, 0.75, 0.4], 0.45],
];
export const Seg15: Seg = ({ c }) => {
  const t = useT();
  const pe = eIo3(ramp(t, 76.0, 76.45));
  const left = onLeft(c.ph.handwriting);
  const X = left ? 178 : 1742;
  const w = eIo3(ramp(t, 72.0, 73.6));
  return (
    <Group sc={1 - 0.05 * pe} op={1 - pe}>
      <Bleed id={c.ph.handwriting} z={lerp(1.1, 1.0, eOutSine(ramp(t, 71.2, 76.6)))} />
      <LightLeak strength={0.45} blobs={left ? LEAK15 : LEAK15.map((b): LeakBlob => [1920 - b[0], ...b.slice(1)] as LeakBlob)} />
      <T s={c.copy.rest_of_life} f="xingkai" size={120} vertical tr={6} c={C.white} x={X} y={262} a="ct" wipe={w} wdir="tb" wsoft={0.18} shadow="0 3px 7px rgba(0,0,0,0.35)" />
      <T s="FOR THE REST OF MY LIFE" f="avDemi" size={28} tr={8} c={C.white} x={left ? 268 : 1652} y={280} sideways op={0.85 * eOut3(ramp(t, 73.0, 73.9))} />
    </Group>
  );
};

// ---------------------------------------------------------------- 16 · scattered prints
const PRINTS: [number, number, number, number, number, number][] = [
  // cx, cy, w, h, rotation, t0
  [540, 468, 440, 660, -6.0, 76.2],
  [1380, 468, 440, 660, 5.0, 76.35],
  [960, 450, 480, 720, 1.5, 76.5],
];
export const Seg16: Seg = ({ c }) => {
  const t = useT();
  const b = 14;
  const [e, dy] = fadeRise(t, 77.9, 78.5, 12);
  const groupIn = eOut3(ramp(t, 76.15, 77.05));
  const groupSc = lerp(0.97, 1, eOutSine(ramp(t, 76.15, 78.2)));
  return (
    <>
      <Group sc={groupSc} op={groupIn} cy={500}>
        {PRINTS.map(([cx, cy, w, h, rot], k) => {
          return (
            <div key={k} style={{ position: "absolute", left: cx, top: cy, transform: `rotate(${rot}deg)` }}>
              <div style={{ position: "absolute", left: -(w + 2 * b + 10) / 2 + 8, top: -(h + 2 * b + 10) / 2 + 18, width: w + 2 * b + 10, height: h + 2 * b + 10, background: "rgb(64,51,38)", opacity: 0.2, filter: "blur(30px)" }} />
              <div style={{ position: "absolute", left: -(w + 2 * b) / 2, top: -(h + 2 * b) / 2, width: w + 2 * b, height: h + 2 * b, background: C.white, borderRadius: 22 }} />
              <Pic id={c.ph.prints[k]} cx={0} cy={0} w={w} h={h} z={1.02} r={22 - b * 0.7} />
            </div>
          );
        })}
      </Group>
      <T s="Wedding Day" f="savoye" size={124} x={960} y={940} a="cm" wipe={eIo3(ramp(t, 77.2, 78.3))} wsoft={0.35} />
      <T s={[c.names, c.date].filter(Boolean).join("  ·  ")} f="songR" size={34} tr={4} c={C.grey} x={960} y={1036 + dy} a="cm" op={e} maxW={1760} />
    </>
  );
};

// ---------------------------------------------------------------- 17 · full bleed + vertical text
export const Seg17: Seg = ({ c }) => {
  const t = useT();
  const right = !onLeft(c.ph.vertical);
  const X = right ? 1800 : 120;
  const eg = eOut3(ramp(t, 81.0, 81.7));
  return (
    <>
      <Bleed id={c.ph.vertical} z={lerp(1.0, 1.06, eSine(ramp(t, 80.2, 85.5)))} />
      <Box cx={X} cy={250 + 22 * eg} w={1.4} h={44 * eg} color={C.gold} op={eg} />
      <T s={c.copy.my_love} f="songB" size={66} vertical tr={22} c={C.white} x={X} y={330} a="ct" wipe={eIo3(ramp(t, 81.2, 82.4))} wdir="tb" wsoft={0.25} shadow="0 2px 10px rgba(0,0,0,0.35)" />
      <T s="MY FOREVER LOVE" f="avDemi" size={28} tr={8} c={C.white} x={right ? X - 70 : X + 70} y={338} a="ct" sideways op={eOut3(ramp(t, 81.8, 82.5))} shadow="0 1px 6px rgba(0,0,0,0.35)" />
    </>
  );
};

// ---------------------------------------------------------------- 18 · ending: sparkle arc + names/date, fade to black
/** S = when the ending starts, E = end of the film (the Python film used S 84.6, E 90). */
export const Seg18: React.FC<{ c: Ctx; S: number; E: number }> = ({ c, S, E }) => {
  const t = useT();
  const o = (x: number) => S + (x - 84.6);
  const place = titlePlace(c.ph.ending);
  const left = place === "left";
  const X = place === "bottom" ? 960 : left ? 440 : 1500;
  /** the lower-third block sits 300 px lower */
  const L = place === "bottom" ? 300 : 0;
  const acx = left ? 1150 : 900;
  const arc = (u: number): [number, number] => {
    const a = ((205 - 230 * u) * Math.PI) / 180;
    return [acx + 560 * Math.cos(a), 600 - 500 * Math.sin(a)];
  };
  const [en, dn] = fadeRise(t, o(86.2), o(86.9));
  const eg = eOut3(ramp(t, o(86.5), o(87.2)));
  const [ed, dd] = fadeRise(t, o(86.7), o(87.4));
  const [et, dt] = fadeRise(t, o(86.9), o(87.6));
  const fade = eIo3(ramp(t, E - 1.2, E));
  const sh = "0 2px 14px rgba(0,0,0,0.5)";
  const nm = fitFace(c.names, "songB", 62, place === "bottom" ? 1500 : 820, 6);
  const dy2 = nm.extra * 0.5;
  return (
    <>
      {/* Even pull-back to the last frame: an eased one settles early and leaves the end card frozen. */}
      <Bleed id={c.ph.ending} z={lerp(1.12, 1.0, ramp(t, S, E))} />
      <AbsoluteFill
        style={{
          background: place === "bottom"
            ? "linear-gradient(to top, rgba(10,8,20,0.66) 0%, rgba(10,8,20,0.42) 40%, rgba(0,0,0,0) 66%)"
            : `linear-gradient(${left ? "to right" : "to left"}, rgba(10,8,20,0.5) 0%, rgba(10,8,20,0.2) 38%, rgba(0,0,0,0) 55%)`,
          opacity: eOut3(ramp(t, o(85.4), o(86.6))),
        }}
      />
      <Glitter
        bursts={[
          { seed: 21, n: 380, t0: o(85.1), t1: o(86.7), path: arc, jit: 30, life: [1.2, 3.4], vel: [26, 22], grav: 14, rsize: [0.6, 2.6], starP: 0.16, inten: 1.1, goldP: 0.8 },
          { seed: 22, n: 260, t0: o(86.4), t1: E - 0.6, path: (u) => arc((u * 7.31) % 1), jit: 60, life: [0.8, 1.8], vel: [10, 10], grav: 6, rsize: [0.6, 2.0], starP: 0.25, inten: 0.9, goldP: 0.8 },
        ]}
      />
      <T s="Happy Wedding" f="savoye" size={128} c={C.white} x={X} y={L + 340 - dy2} a="cm" wipe={eIo3(ramp(t, o(85.7), o(86.9)))} wsoft={0.35} shadow={sh} />
      <T s={nm.text} f="songB" size={nm.size} tr={nm.tracking} c={C.white} x={X} y={L + 480 + dn} a="cm" op={en} shadow={sh} style={{ lineHeight: 1.18 }} />
      <Box cx={X} cy={L + 556 + dy2} w={320 * eg} h={1.8} color={C.gold} op={eg} />
      <T s={c.date} f="avMed" size={48} tr={12} c={C.qgold} x={X} y={L + 616 + dy2 + dd} a="cm" op={ed} shadow={sh} />
      <T s={c.tagline} f="songR" size={38} tr={16} c={C.white} x={X} y={L + 700 + dy2 + dt} a="cm" op={et} shadow={sh} maxW={place === "bottom" ? 1500 : 820} />
      {fade > 0 ? <AbsoluteFill style={{ background: "#000", opacity: fade }} /> : null}
    </>
  );
};

// ---------------------------------------------------------------- gallery title card
export const GalleryTitle: React.FC<{ S: number; copy: Record<string, string> }> = ({ S, copy }) => {
  const t = useT();
  const [e1, d1] = fadeRise(t, S + 0.3, S + 1.1, 18);
  const eg = eOut3(ramp(t, S + 0.6, S + 1.4));
  const [e2, d2] = fadeRise(t, S + 0.8, S + 1.6, 14);
  return (
    <>
      <Glitter ambient={[{ seed: 23, n: 50, t0: S, t1: S + 5, box: [300, 200, 1620, 880], inten: 0.35 }]} />
      <T s={copy.gallery_title} f="songR" size={88} tr={30} x={960} y={470 + d1} a="cm" op={e1} />
      <Box cx={960} cy={560} w={360 * eg} h={1.6} color={C.gold} op={eg} />
      <T s={copy.gallery_subtitle ?? "WEDDING GALLERY"} f="avDemi" size={30} tr={16} c={C.gold} x={960} y={620 + d2} a="cm" op={e2} />
    </>
  );
};
