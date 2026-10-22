import React, { useMemo } from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { Glitter } from "../../components/Glitter";
import { Music, type MusicProps } from "../../components/Music";
import { Box } from "../../components/Shapes";
import { beatsPathFor, makeWarp, useBeatMap, type Anchor } from "../../core/beats";
import { coverFit } from "../../core/crop";
import { eIo3, eOut3, fadeRise, lerp, ramp } from "../../core/ease";
import { getPhoto, photoSrc } from "../../core/manifest";
import { useT } from "../../core/time";
import { Film, type FilmSegment, type FilmTransition } from "../../engine/Film";
import { gallerySegments, placeShots, planShots, type CaptionArgs, type GallerySkin, type Palette } from "../../engine/Gallery";
import { fontFor } from "../../core/fonts";
import { fitText } from "../../core/text-fit";
import { C, T } from "../shared/kit";

/**
 * Album 9:16 short: the album's look (warm paper, rounded cards, gold rule, set captions) arranged
 * for a phone screen in under a minute — opening card, a beat-cut selection of the wedding gallery
 * with one shot from every outfit first, and the closing card. The 16:9 film keeps the full story.
 */

/** Same design grid as the 16:9 film: Skyline's first downbeat + 84 BPM; music warps onto it. */
const B = (n: number) => 2.86 + (n * 60) / 84;
const OPEN_BEATS = 8;
const BEATS_PER_SHOT = 4;
const MAX_SHOTS = 12;
/** The closing card: names in by ~3 s, a short hold while it keeps moving, then the fade. */
const END_BEATS = 8;
const G0 = OPEN_BEATS;

export interface ShortCtx {
  opening: string;
  ending: string;
  gallery: string[];
  names: string;
  date: string;
  tagline: string;
  copy: Record<string, string>;
}

/** A photo filling the frame, cropped around its faces; zoom z. */
const Fill: React.FC<{ id: string; z: number; dim?: number }> = ({ id, z, dim = 0 }) => {
  const { width, height } = useVideoConfig();
  const photo = getPhoto(id);
  const fit = coverFit(photo, width, height);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition, transform: `scale(${z})`, transformOrigin: fit.transformOrigin }} />
      {dim > 0 ? <AbsoluteFill style={{ background: `rgba(14,10,20,${dim})` }} /> : null}
    </AbsoluteFill>
  );
};

/**
 * A rounded print of a photo at its own proportions on a soft wash of the same photo. `p` (0→1 over
 * the scene) drives visible, continuous motion: the picture pans across the card while pushing in,
 * the card drifts up and turns slightly, and the wash drifts the other way (parallax), so a card
 * never reads as a held still frame.
 */
const Card: React.FC<{ id: string; x: number; y: number; w: number; z: number; p: number; op?: number; dy?: number }> = ({ id, x, y, w, z, p, op = 1, dy = 0 }) => {
  const { width, height } = useVideoConfig();
  const photo = getPhoto(id);
  const h = w * (photo.height / photo.width);
  const fit = coverFit(photo, w, h);
  const pan = lerp(-6, 6, p);
  const lift = lerp(36, -36, p);
  const turn = lerp(-1.4, 1.0, p);
  return (
    <>
      <AbsoluteFill style={{ overflow: "hidden", opacity: op }}>
        <Img src={photoSrc(photo)} style={{ position: "absolute", left: -120, top: -120, width: width + 240, height: height + 240, objectFit: "cover",
          filter: "blur(40px) saturate(1.05)", opacity: 0.42, transform: `translate(${lerp(50, -50, p)}px, ${lerp(-40, 40, p)}px) scale(${lerp(1.0, 1.12, p)})` }} />
        {/* keep the lower part, where the dark type sits, close to the paper colour */}
        <AbsoluteFill style={{ background: `linear-gradient(to bottom, rgba(252,251,248,0.25) 0%, rgba(252,251,248,0.55) 45%, rgba(252,251,248,0.88) 68%, rgba(252,251,248,0.92) 100%)` }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y + dy + lift, width: w, height: h, opacity: op, borderRadius: 22, overflow: "hidden",
        transform: `rotate(${turn}deg)`, boxShadow: "0 22px 50px rgba(40,30,20,0.22), 0 4px 12px rgba(40,30,20,0.10)", border: "10px solid #FFFFFF" }}>
        <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition,
          transform: `scale(${z + 0.12}) translateX(${pan}%)`, transformOrigin: fit.transformOrigin }} />
      </div>
    </>
  );
};

/** Couple names fitted to the phone width; a long Latin pair breaks once at " & ". */
const fitNames = (names: string, size: number, maxW: number) => {
  const fit = fitText(names, "songti", size, maxW, { weight: 700, tracking: size * 0.09, wrap: true });
  return { ...fit, extra: fit.lines > 1 ? fit.size * 1.18 : 0 };
};

/** A landscape photo can only fill a 9:16 frame when its faces are known; otherwise it stays a card. */
const canFill = (id: string) => {
  const p = getPhoto(id);
  return p.orientation !== "landscape" || Boolean(p.faces?.length);
};

const Opening: React.FC<{ c: ShortCtx }> = ({ c }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const end = B(OPEN_BEATS) + 0.6;
  const fill = canFill(c.opening);
  // Linear push to the cut, so the title card keeps moving while it is read.
  const z = lerp(1.16, 1.02, ramp(t, 0, end));
  const enter = eOut3(ramp(t, 0.2, 1.4));
  const [en, dn] = fadeRise(t, B(0), B(0) + 0.8, 22);
  const eg = eOut3(ramp(t, B(1), B(2)));
  const [el, dl] = fadeRise(t, B(2), B(2) + 0.7);
  const [ed, dd] = fadeRise(t, B(4), B(4) + 0.7);
  const ink = fill ? C.white : C.dark;
  const sh = fill ? "0 2px 14px rgba(0,0,0,0.45)" : undefined;
  let textY = height * 0.74;
  const nm = fitNames(c.names, 86, width - 120);
  let picture: React.ReactNode;
  if (fill) {
    picture = (
      <>
        <AbsoluteFill style={{ opacity: enter }}><Fill id={c.opening} z={z} /></AbsoluteFill>
        <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(12,10,8,0.66) 0%, rgba(12,10,8,0.3) 34%, rgba(0,0,0,0) 55%)" }} />
      </>
    );
  } else {
    const photo = getPhoto(c.opening);
    const cardW = width - 2 * 72;
    const cardH = Math.min(height * 0.62, cardW * (photo.height / photo.width));
    const w = cardH * (photo.width / photo.height);
    const top = (height * 0.62 - cardH) / 2 + height * 0.06;
    textY = top + cardH + 170;
    picture = <Card id={c.opening} x={(width - w) / 2} y={top} w={w} z={z} p={ramp(t, 0, end)} op={enter} dy={60 * (1 - enter)} />;
  }
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {picture}
      <Glitter ambient={[{ seed: 31, n: 46, t0: 0, t1: end, box: [60, height * 0.5, width - 60, height - 120], inten: 0.35 }]} />
      <T s={nm.text} f="songB" size={nm.size} tr={nm.tracking} c={ink} x={width / 2} y={textY - nm.extra / 2 + dn} a="cm" op={en} shadow={sh} style={{ lineHeight: 1.18 }} />
      <Box cx={width / 2} cy={textY + 80 + nm.extra / 2} w={300 * eg} h={1.8} color={C.gold} op={eg} />
      <T s="WEDDING DAY" f="avDemi" size={38} tr={14} c={fill ? "#F3EBDD" : C.grey} x={width / 2} y={textY + 140 + nm.extra / 2 + dl} a="cm" op={el} shadow={sh} />
      <T s={c.date} f="avMed" size={48} tr={12} c={fill ? C.qgold : C.gold} x={width / 2} y={textY + 212 + nm.extra / 2 + dd} a="cm" op={ed} shadow={sh} />
    </AbsoluteFill>
  );
};

const Ending: React.FC<{ c: ShortCtx; S: number; E: number }> = ({ c, S, E }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const fill = canFill(c.ending);
  const X = width / 2;
  const Y = height * 0.66;
  const arc = (u: number): [number, number] => {
    const a = ((200 - 220 * u) * Math.PI) / 180;
    return [X + 430 * Math.cos(a), Y - 40 - 300 * Math.sin(a)];
  };
  const [en, dn] = fadeRise(t, S + 1.6, S + 2.3);
  const eg = eOut3(ramp(t, S + 1.9, S + 2.6));
  const [ed, dd] = fadeRise(t, S + 2.1, S + 2.8);
  const [et, dt] = fadeRise(t, S + 2.3, S + 3.0);
  const fade = eIo3(ramp(t, E - 1.2, E));
  const sh = fill ? "0 2px 14px rgba(0,0,0,0.5)" : undefined;
  const ink = fill ? C.white : C.dark;
  const cardW = width - 2 * 72;
  // An even pull-back keeps the closing card moving until the fade.
  const z = lerp(1.12, 1.0, ramp(t, S, E));
  const nm = fitNames(c.names, 64, width - 120);
  const d2 = nm.extra / 2;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {fill ? (
        <>
          <Fill id={c.ending} z={z} />
          <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(10,8,20,0.62) 0%, rgba(10,8,20,0.28) 45%, rgba(0,0,0,0) 70%)", opacity: eOut3(ramp(t, S + 0.6, S + 1.8)) }} />
        </>
      ) : (
        <Card id={c.ending} x={72} y={height * 0.12} w={cardW} z={z} p={ramp(t, S, E)} />
      )}
      <Glitter
        bursts={[
          { seed: 41, n: 320, t0: S + 0.8, t1: S + 2.4, path: arc, jit: 30, life: [1.2, 3.2], vel: [24, 20], grav: 14, rsize: [0.6, 2.6], starP: 0.16, inten: 1.1, goldP: 0.8 },
          { seed: 42, n: 220, t0: S + 2.2, t1: E - 0.6, path: (u) => arc((u * 7.31) % 1), jit: 50, life: [0.8, 1.8], vel: [10, 10], grav: 6, rsize: [0.6, 2.0], starP: 0.25, inten: 0.9, goldP: 0.8 },
        ]}
      />
      <T s="Happy Wedding" f="savoye" size={132} c={fill ? C.white : C.gold} x={X} y={Y - 150 - d2} a="cm" wipe={eIo3(ramp(t, S + 1.2, S + 2.4))} wsoft={0.35} shadow={sh} />
      <T s={nm.text} f="songB" size={nm.size} tr={nm.tracking} c={ink} x={X} y={Y + dn} a="cm" op={en} shadow={sh} style={{ lineHeight: 1.18 }} />
      <Box cx={X} cy={Y + 74 + d2} w={300 * eg} h={1.8} color={C.gold} op={eg} />
      <T s={c.date} f="avMed" size={48} tr={12} c={fill ? C.qgold : C.gold} x={X} y={Y + 132 + d2 + dd} a="cm" op={ed} shadow={sh} />
      <T s={c.tagline} f="songR" size={42} tr={14} c={ink} x={X} y={Y + 214 + d2 + dt} a="cm" op={et} shadow={sh} maxW={width - 120} />
      {fade > 0 ? <AbsoluteFill style={{ background: "#000", opacity: fade }} /> : null}
    </AbsoluteFill>
  );
};

/** Set title on the paper above the photos: dark ink, the album's gold rule, in after the shot lands. */
const TopCaption: React.FC<{ args: CaptionArgs }> = ({ args }) => {
  const { width } = useVideoConfig();
  const { shot, title, line, t } = args;
  if (!title && !line) return null;
  const e = eOut3(ramp(t, shot.from + 0.4, shot.from + 1.1)) * (1 - eIo3(ramp(t, shot.to - 0.8, shot.to - 0.15)));
  if (e <= 0.002) return null;
  // Full-bleed shots, and solo / inset shots on their blurred, darkened copy, put the title over a picture instead of paper.
  const onPhoto = shot.kind === "full" || shot.kind === "solo" || shot.kind === "inset";
  const ink = onPhoto ? C.white : C.dark;
  const sub = onPhoto ? "#F3EBDD" : C.grey;
  const textShadow = onPhoto ? "0 2px 12px rgba(0,0,0,0.55)" : undefined;
  // phone-size type: the line is at least 36 px, shrinking only for a very long caption
  const tf = fitText(title, "songti", 56, width - 120, { weight: 700, tracking: 10 });
  const lf = fitText(line, "songti", 36, width - 100, { tracking: 3, minScale: 0.75 });
  return (
    <>
      {onPhoto ? <AbsoluteFill style={{
        background: "linear-gradient(to bottom, rgba(12,10,8,0.64) 0%, rgba(12,10,8,0.6) 11%, rgba(12,10,8,0) 27%)",
        opacity: e,
      }} /> : null}
      <div style={{ position: "absolute", left: 0, top: 44, width, textShadow, display: "flex", flexDirection: "column", alignItems: "center", opacity: e, transform: `translateY(${12 * (1 - e)}px)` }}>
        {title ? <div style={{ fontFamily: fontFor("songti", title, 700), fontSize: tf.size, letterSpacing: tf.tracking, color: ink, lineHeight: 1.2 }}>{title}</div> : null}
        <div style={{ width: 56, height: 3, background: C.gold, margin: "14px 0 12px" }} />
        {line ? <div style={{ fontFamily: fontFor("songti", line), fontSize: lf.size, letterSpacing: lf.tracking, color: sub }}>{line}</div> : null}
      </div>
    </>
  );
};

/** The 16:9 album skin with phone margins; set titles sit on the paper above the photos. */
const skin: GallerySkin = {
  background: () => <AbsoluteFill style={{ background: C.bg }} />,
  margin: 60,
  marginY: 220,
  gap: 28,
  radius: 22,
  shadow: "0 18px 42px rgba(40,30,20,0.16), 0 4px 12px rgba(40,30,20,0.08)",
  kb: 0.06,
  caption: (args) => <TopCaption args={args} />,
};

const PALETTE: Palette = {
  within: [
    { kind: "cross", seconds: 0.8 },
    { kind: "push", seconds: 0.7, dirs: ["up", "left"] },
    { kind: "wipe", seconds: 0.9, dirs: ["up", "left"] },
    { kind: "blur", seconds: 0.8 },
  ],
  between: [
    // No "cover" here: it dims and shrinks the outgoing page, which on a mostly empty 9:16 page reads as a gray block.
    { kind: "push", seconds: 0.8, dirs: ["left"] },
    { kind: "dissolve", seconds: 1.0 },
    { kind: "iris", seconds: 1.0 },
    { kind: "push", seconds: 0.8, dirs: ["up"] },
  ],
};

/** Up to MAX_SHOTS shots: the first shot of every set, then further shots in set order, kept grouped. */
export function selectShots<P extends { set: string }>(plans: P[], max = MAX_SHOTS): P[] {
  const sets = [...new Set(plans.map((p) => p.set))];
  const bySet = new Map(sets.map((s) => [s, plans.filter((p) => p.set === s)]));
  const take = new Map(sets.map((s) => [s, 0]));
  let total = 0;
  for (let round = 0; total < Math.min(max, plans.length); round++) {
    for (const s of sets) {
      if (total >= max) break;
      if ((bySet.get(s)?.length ?? 0) > round) {
        take.set(s, round + 1);
        total++;
      }
    }
  }
  return sets.flatMap((s) => (bySet.get(s) ?? []).slice(0, take.get(s)));
}

/** The gallery shots of the short. The opening and closing photos already fill the screen; skip them when the gallery can spare them. */
function shortPlans(c: Pick<ShortCtx, "opening" | "ending" | "gallery">) {
  const rest = c.gallery.filter((id) => id !== c.opening && id !== c.ending);
  return selectShots(planShots(rest.length ? rest : c.gallery)).map((p, i, all) => ({ ...p, first: i === 0 || all[i - 1].set !== p.set }));
}

const galleryFallback = (copy: Record<string, string>) => {
  const title = (copy.gallery_caption ?? copy.gallery_title ?? "").trim();
  const line = (copy.gallery_subtitle ?? "").trim();
  return title || line ? ([title, line] as [string, string]) : undefined;
};

/** Length follows the shots actually shown, so the closing card keeps its END_BEATS whatever the gallery size. */
export const shortSeconds = (c: Pick<ShortCtx, "opening" | "ending" | "gallery">) =>
  B(G0 + shortPlans(c).length * BEATS_PER_SHOT + END_BEATS) + 1.2;

export const AlbumShort: React.FC<{ c: ShortCtx; music: MusicProps }> = ({ c, music }) => {
  const beats = useBeatMap(beatsPathFor(music.src));
  const trim = music.trimBeforeSec;
  const film = useMemo(() => {
    const plans = shortPlans(c);
    const seconds = B(G0 + plans.length * BEATS_PER_SHOT + END_BEATS) + 1.2;
    const g1 = G0 + plans.length * BEATS_PER_SHOT;
    const shots = placeShots(plans, B, G0, g1, BEATS_PER_SHOT);
    // Untagged project photos share one set without a set_<id> caption; open their run with the gallery title instead.
    const g = gallerySegments(shots, skin, PALETTE, { copy: c.copy, fallback: galleryFallback(c.copy) });
    const S = B(g1);
    const first = g.segments[0];
    const last = g.segments[g.segments.length - 1];
    first.from = B(G0) - 0.5;
    last.to = S + 0.6;
    const segments: FilmSegment[] = [
      { id: "open", from: 0, to: B(G0) + 0.5, render: () => <Opening c={c} /> },
      ...g.segments,
      { id: "end", from: S - 0.6, to: seconds + 0.1, render: () => <Ending c={c} S={S - 0.6} E={seconds} /> },
    ];
    const transitions: FilmTransition[] = [
      { kind: "push", from: B(G0) - 0.5, to: B(G0) + 0.5, a: "open", b: first.id, dir: "up" },
      ...g.transitions,
      { kind: "dissolve", from: S - 0.6, to: S + 0.6, a: last.id, b: "end" },
    ];
    const anchors: Anchor[] = [B(0), B(2), B(4), ...shots.map((s) => s.from), S].map((t) => ({ t, kind: "cut" }));
    return { segments, transitions, anchors, seconds };
  }, [c]);
  const warp = useMemo(
    () => makeWarp(film.anchors, { beats, designSeconds: film.seconds, musicSeconds: film.seconds, musicOffset: trim }),
    [beats, film.anchors, film.seconds, trim],
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Film segments={film.segments} transitions={film.transitions} background={() => C.bg} toDesign={warp.toDesign} />
      <Music music={music} />
    </AbsoluteFill>
  );
};

