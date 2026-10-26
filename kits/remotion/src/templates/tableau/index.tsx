import React, { useMemo } from "react";
import { AbsoluteFill, Img, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { Music } from "../../components/Music";
import { FilmGrain, Vignette } from "../../components/Overlays";
import { Text } from "../../components/Text";
import { beatClock as sharedBeatClock, loadBeatGrid, type BeatGrid as Grid } from "../../core/beat-clock";
import { coverFit } from "../../core/crop";
import { eOut3, lerp, ramp } from "../../core/ease";
import { getPhoto, photoSrc } from "../../core/manifest";
import { defineTemplate, type TemplateProps } from "../../core/template";
import { useT } from "../../core/time";

/**
 * Tableau (荒诞纪实组图): a short beat-cut film of staged, surreal "documentary" pictures — one
 * full-frame picture per eight beats, each with a slow push-in and a faint handheld drift, hard cuts
 * on the beat, film grain and a soft vignette. The bundled track (tableau-tick.ogg, 150 BPM) has a
 * dry ticking groove for the first four pictures and drops into a dense wall of chords at beat 32,
 * so picture 5 always lands on the drop. Optional one-line subtitles per picture. See README.md.
 */

export const tableauSlots = {
  pictures: { count: 6, min: 5, max: 10 },
} as const;

/** Beats each picture holds (3.2 s at 150 BPM). */
export const BEATS_PER_PICTURE = 8;
/** The beat where the music drops; picture 5 starts here. */
export const DROP_BEAT = 32;
/** Black after the last picture, as in the reference's hard cut to black. */
const TAIL_SEC = 0.25;
const FALLBACK_BPM = 150;
/** Push-in over one picture: start and end scale. */
const Z0 = 1.0;
const Z1 = 1.16;
const BLACK = "#050505";

export const COPY = {};

type Props = TemplateProps<typeof tableauSlots> & { captions: string[]; beatGrid?: Grid | null };

const beatClock = (grid: Grid | null | undefined) => sharedBeatClock(grid, FALLBACK_BPM, 0.3);
export const totalBeats = (pictures: number) => pictures * BEATS_PER_PICTURE;

const Window: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const t = useT();
  return t >= from && t < to ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

/** Smooth pseudo-random wobble, deterministic per picture (handheld camera). */
const wobble = (t: number, seed: number) =>
  Math.sin(t * 0.83 + seed * 1.7) * 0.6 + Math.sin(t * 1.91 + seed * 3.1) * 0.3 + Math.sin(t * 3.7 + seed * 0.4) * 0.1;

/** One picture: full-bleed push-in when its shape is close to the frame's, otherwise whole on a blurred copy. */
const Picture: React.FC<{ id: string; from: number; to: number; index: number; drop: boolean }> = ({ id, from, to, index, drop }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const photo = getPhoto(id);
  const p = ramp(t, from, to);
  // nearly linear with a soft start, so the push never stops before the cut
  const z = lerp(Z0, Z1, p * 0.85 + eOut3(p) * 0.15);
  const short = Math.min(width, height);
  const dx = wobble(t, index) * short * 0.004;
  const dy = wobble(t + 11, index + 5) * short * 0.003;
  const rot = wobble(t + 23, index + 9) * 0.12;
  // the first frames on the drop: a short over-exposure that settles
  const flash = drop ? 1 - ramp(t, from, from + 0.12) : 0;
  const frameAspect = width / height;
  const photoAspect = photo.width / photo.height;
  const ratio = photoAspect / frameAspect;
  const whole = ratio < 0.78 || ratio > 1.3;
  const camera = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${z})`;
  const grade = `brightness(${1 + 0.55 * flash}) contrast(${1.04 - 0.1 * flash}) saturate(0.96)`;
  if (whole) {
    const fit = Math.min(width / photo.width, height / photo.height);
    const w = photo.width * fit;
    const h = photo.height * fit;
    return (
      <AbsoluteFill style={{ background: BLACK, overflow: "hidden", filter: grade }}>
        <Img src={photoSrc(photo)} style={{ position: "absolute", inset: -80, width: width + 160, height: height + 160, objectFit: "cover", filter: "blur(36px) brightness(0.42) saturate(0.9)" }} />
        <AbsoluteFill style={{ transform: camera, transformOrigin: "50% 45%" }}>
          <Img src={photoSrc(photo)} style={{ position: "absolute", left: (width - w) / 2, top: (height - h) / 2, width: w, height: h }} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const fit = coverFit(photo, width, height, [0.5, 0.42]);
  return (
    <AbsoluteFill style={{ background: BLACK, overflow: "hidden", filter: grade }}>
      <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition, transform: camera, transformOrigin: fit.transformOrigin }} />
    </AbsoluteFill>
  );
};

/** Documentary-style subtitle: plain white sans with a dark edge, bottom centre, no animation. */
const Subtitle: React.FC<{ text: string; from: number }> = ({ text, from }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  if (!text.trim()) return null;
  const short = Math.min(width, height);
  const portrait = height > width;
  return (
    <Text font="heiti" weight={500} size={short * (portrait ? 0.05 : 0.042)} color="#F4F1EA" x={width / 2} y={height * (portrait ? 0.8 : 0.9)} anchor="cb"
      shadow="0 0 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)" lineHeight={1.3} maxWidth={width * 0.86} opacity={ramp(t, from + 0.12, from + 0.2)}>{text}</Text>
  );
};

/** A faint exposure flicker over everything, like projected film. */
const Flicker: React.FC = () => {
  const t = useT();
  const a = 0.025 + 0.02 * Math.sin(t * 23.0) * Math.sin(t * 7.3 + 1.1);
  return <AbsoluteFill style={{ background: "#000", opacity: Math.max(0, a), pointerEvents: "none" }} />;
};

const Tableau: React.FC<Props> = ({ photos, captions, music, beatGrid }) => {
  const B = useMemo(() => beatClock(beatGrid), [beatGrid]);
  const pics = photos.pictures;
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      {pics.map((id, i) => {
        const b0 = i * BEATS_PER_PICTURE;
        // the first picture starts at frame 0 (no lead-in), the rest on their beat
        const from = i === 0 ? 0 : B(b0);
        const to = B(b0 + BEATS_PER_PICTURE);
        return (
          <Window key={i} from={from} to={to}>
            <Picture id={id} from={from} to={to} index={i} drop={b0 === DROP_BEAT} />
            <Vignette strength={0.38} />
            <Subtitle text={captions[i] ?? ""} from={from} />
          </Window>
        );
      })}
      <Flicker />
      <FilmGrain opacity={0.07} />
      <Music music={music} />
    </AbsoluteFill>
  );
};

const beatGridSchema = z.object({ beats: z.array(z.number()) }).nullable().optional();
const captionsSchema = z.array(z.string()).max(tableauSlots.pictures.max).describe("每张图下方的一行字幕，按顺序对应 photos.pictures；留空不显示");

const seconds = (props: Props, grid: Grid | null | undefined) => beatClock(grid)(totalBeats(props.photos.pictures.length)) + TAIL_SEC;

const definition = defineTemplate(
  {
    id: "VVV-Tableau",
    code: "Tableau",
    title: "荒诞纪实组图",
    slots: tableauSlots,
    couple: false,
    seconds: (props) => seconds(props as Props, (props as Props).beatGrid),
    component: Tableau as React.FC<TemplateProps<typeof tableauSlots>>,
    fps: 30,
    copy: COPY,
    poster: 1.5,
    music: { src: "music/tableau-tick.ogg", volume: 0.9, trimBeforeSec: 0, fadeInSec: 0, fadeOutSec: 0.4 },
  },
  { schema: { captions: captionsSchema, beatGrid: beatGridSchema }, defaults: { captions: [], beatGrid: null } },
);

/** Load the beat map once, before rendering, so the length and every cut follow the music. */
const calculateMetadata: CalculateMetadataFunction<any> = async ({ props }) => {
  const parsed = definition.schema.parse(props) as Props;
  const grid = await loadBeatGrid(parsed.music);
  return { durationInFrames: Math.ceil(seconds(parsed, grid) * parsed.fps), props: { ...parsed, beatGrid: grid } };
};

export const tableau = { ...definition, calculateMetadata };
