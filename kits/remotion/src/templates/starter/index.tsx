import { fitText } from "../../core/text-fit";
import React, { useMemo } from "react";
import { AbsoluteFill, Img, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { Music } from "../../components/Music";
import { EdgeFade, FilmGrain, Vignette } from "../../components/Overlays";
import { Text } from "../../components/Text";
import { beatClock as sharedBeatClock, loadBeatGrid, type BeatGrid as Grid } from "../../core/beat-clock";
import { coupleNames, formatDate } from "../../core/couple";
import { eIo3, eOut3, lerp, ramp } from "../../core/ease";
import { coverFit } from "../../core/crop";
import { getPhoto, photoSrc } from "../../core/manifest";
import { defineTemplate, type TemplateProps } from "../../core/template";
import { useT } from "../../core/time";
import { Film, type FilmSegment, type FilmTransition } from "../../engine/Film";
import { gallerySegments, placeShots, planShots, SetCaptionText, type GallerySkin, type Palette, type ShotKind } from "../../engine/Gallery";
import { fontFor } from "../../core/fonts";

/**
 * Starter: a beat-cut photo reel. Opening title over one photo, a gallery whose every shot change
 * lands on a beat of the soundtrack, and a closing card. It exists to show the VVV contract end to
 * end — chosen format, music with a beat map, the shared gallery engine — in about half a minute.
 */

export const starterSlots = {
  opening: {},
  gallery: { count: 12, min: 6, max: 24 },
  ending: {},
} as const;

const OPEN_BEATS = 8;
const BEATS_PER_SHOT = 4;
const END_BEATS = 8;
/** Tempo used when the project has no beat map (silent drafts). */
const FALLBACK_BPM = 96;

const INK = "#FBF8F2";
const SOFT = "#E9DFCF";
const ACCENT = "#D8B27A";
const PAPER = "#15130F";

export const COPY = {
  kicker: { label: "开场小字", text: "WE'RE GETTING MARRIED" },
  ending: { label: "结尾一句", text: "谢谢你，来见证我们的故事" },
};

type Props = TemplateProps<typeof starterSlots> & { beatGrid?: Grid | null };

const beatClock = (grid: Grid | null | undefined) => sharedBeatClock(grid, FALLBACK_BPM);

function shotCount(photos: string[], portrait: boolean): number {
  return planShots(photos, { layouts: layoutsFor(portrait), captions: false }).length;
}

function layoutsFor(portrait: boolean): ShotKind[] {
  // A landscape photo full-bleed in a 9:16 frame would lose most of the picture; show it whole.
  return portrait ? ["solo", "inset", "pair", "hero", "trio", "offset", "mixed", "strip"] : ["full", "pair", "hero", "inset", "trio", "offset", "mixed", "solo"];
}

const totalBeats = (shots: number) => OPEN_BEATS + shots * BEATS_PER_SHOT + END_BEATS;

/** A slow push into one photo, cropped around its faces. */
const PushPhoto: React.FC<{ id: string; from: number; to: number; z0: number; z1: number; dim?: number }> = ({ id, from, to, z0, z1, dim = 0 }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const photo = getPhoto(id);
  const fit = coverFit(photo, width, height);
  const z = lerp(z0, z1, eIo3(ramp(t, from, to)));
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: PAPER }}>
      <Img
        src={photoSrc(photo)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: fit.objectPosition, transform: `scale(${z})`, transformOrigin: fit.transformOrigin }}
      />
      {dim > 0 ? <AbsoluteFill style={{ background: `rgba(10,8,6,${dim})` }} /> : null}
    </AbsoluteFill>
  );
};

/** A blurred, darkened copy of a photo behind a card of the same photo. */
const Backdrop: React.FC<{ id: string }> = ({ id }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: PAPER }}>
      <Img src={photoSrc(getPhoto(id))} style={{ position: "absolute", inset: -80, width: width + 160, height: height + 160, objectFit: "cover", filter: "blur(40px) brightness(0.5) saturate(1.1)" }} />
    </AbsoluteFill>
  );
};

const Opening: React.FC<{ id: string; B: (n: number) => number; names: string; date: string; kicker: string }> = ({ id, B, names, date, kicker }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const portraitFrame = height > width;
  const photo = getPhoto(id);
  // A portrait photo in a landscape frame would lose the heads to a full-bleed crop: card + title beside it.
  const card = !portraitFrame && photo.orientation !== "landscape";
  const short = Math.min(width, height);
  const lineIn = eOut3(ramp(t, B(3), B(4)));
  const nameSize = short * (portraitFrame ? 0.085 : 0.09);
  const title = (x: number, y: number, align: "c" | "l", maxW: number) => {
    const a = align === "c" ? "cb" : "lb";
    const reveal = { start: B(2), step: (B(3) - B(2)) / Math.max(1, names.length), dur: 0.5, dist: short * 0.02, blur: 8 };
    const lineW = short * 0.24 * lineIn;
    // long Latin names break once at " & " (the block grows upwards, so the kicker moves up with it)
    const fit = fitText(names, "songti", nameSize, maxW, { weight: 700, tracking: short * 0.01, wrap: true });
    const up = fit.lines > 1 ? fit.size * 1.18 : 0;
    return (
      <>
        <Text font="condensed" size={short * 0.036} tracking={short * 0.012} color={ACCENT} x={x} y={y - short * 0.12 - up} anchor={a}
          opacity={eOut3(ramp(t, B(1), B(2)))}>{kicker}</Text>
        <Text font="songti" weight={700} size={fit.size} tracking={fit.tracking} color={INK} x={x} y={y} anchor={a} shadow reveal={reveal} lineHeight={1.18}>{fit.text}</Text>
        <div style={{ position: "absolute", left: align === "c" ? x - lineW / 2 : x, top: y + short * 0.035, width: lineW, height: 3, background: ACCENT }} />
        <Text font="display" size={short * 0.04} tracking={short * 0.008} color={SOFT} x={x} y={y + short * 0.07} anchor={align === "c" ? "ct" : "lt"}
          opacity={eOut3(ramp(t, B(4), B(5)))}>{date}</Text>
      </>
    );
  };
  if (card) {
    const ch = height * 0.84;
    const cw = ch * (photo.width / photo.height);
    const enter = eOut3(ramp(t, 0, B(1)));
    return (
      <AbsoluteFill>
        <Backdrop id={id} />
        <div style={{ position: "absolute", left: width * 0.9 - cw, top: (height - ch) / 2 + 40 * (1 - enter), width: cw, height: ch, opacity: enter,
          borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
          <AbsoluteFill style={{ transform: `scale(${lerp(1.1, 1.0, eIo3(ramp(t, 0, B(OPEN_BEATS) + 0.5)))})` }}>
            <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        </div>
        {title(width * 0.08, height * 0.52, "l", width * 0.9 - cw - width * 0.08 - 48)}
      </AbsoluteFill>
    );
  }
  const baseY = portraitFrame ? height * 0.62 : height * 0.6;
  return (
    <AbsoluteFill>
      <PushPhoto id={id} from={0} to={B(OPEN_BEATS) + 0.5} z0={1.16} z1={1.02} />
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(12,10,8,0.82) 0%, rgba(12,10,8,0.35) 45%, rgba(12,10,8,0.05) 75%)" }} />
      {title(width / 2, baseY, "c", width * 0.88)}
    </AbsoluteFill>
  );
};

const Ending: React.FC<{ id: string; B: (n: number) => number; from: number; line: string; names: string }> = ({ id, B, from, line, names }) => {
  const t = useT();
  const { width, height } = useVideoConfig();
  const short = Math.min(width, height);
  return (
    <AbsoluteFill>
      <PushPhoto id={id} from={B(from)} to={B(from + END_BEATS) + 1} z0={1.0} z1={1.14} dim={0.35 * eIo3(ramp(t, B(from + 1), B(from + 3)))} />
      <Text font="songti" size={short * 0.055} tracking={short * 0.008} color={INK} x={width / 2} y={height * 0.76} anchor="cb" shadow
        reveal={{ start: B(from + 2), step: 0.06, dur: 0.6, dist: short * 0.015, blur: 6 }} maxWidth={width * 0.88}>{line}</Text>
      <Text font="display" size={short * 0.04} tracking={short * 0.01} color={ACCENT} x={width / 2} y={height * 0.76 + short * 0.05} anchor="ct"
        opacity={eOut3(ramp(t, B(from + 4), B(from + 5)))} maxWidth={width * 0.88}>{names}</Text>
    </AbsoluteFill>
  );
};

const skinFor = (portrait: boolean): GallerySkin => ({
  background: () => <AbsoluteFill style={{ background: PAPER }} />,
  margin: portrait ? 64 : 84,
  marginY: portrait ? 150 : 72,
  gap: portrait ? 28 : 36,
  radius: 10,
  shadow: "0 24px 60px rgba(0,0,0,0.45)",
  kb: 0.07,
  tilt: 1.2,
  soloFill: "blur",
  fit: "smart",
  caption: (args) => (
    <SetCaptionText args={args} titleFont={fontFor("songti", args.title, 700)} lineFont={fontFor("songti", args.line)} color={INK} sub={SOFT} accent={ACCENT} />
  ),
});

/** Strong, varied movement between shots; every transition is centered on its beat. */
const PALETTE: Palette = {
  within: [
    { kind: "push", seconds: 0.5, dirs: ["left", "up", "right"] },
    { kind: "zoom", seconds: 0.45 },
    { kind: "wipe", seconds: 0.5, dirs: ["left", "right"] },
    { kind: "blur", seconds: 0.5 },
  ],
  between: [{ kind: "cross", seconds: 0.7 }],
};

const Starter: React.FC<Props> = ({ couple, photos, copy, music, beatGrid }) => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const B = useMemo(() => beatClock(beatGrid), [beatGrid]);
  const film = useMemo((): { segments: FilmSegment[]; transitions: FilmTransition[] } => {
    const names = coupleNames(couple);
    const plans = planShots(photos.gallery, { layouts: layoutsFor(portrait), captions: false });
    const g0 = OPEN_BEATS;
    const g1 = g0 + plans.length * BEATS_PER_SHOT;
    const shots = placeShots(plans, B, g0, g1, BEATS_PER_SHOT);
    const gallery = gallerySegments(shots, skinFor(portrait), PALETTE, { copy });
    const end = B(g1 + END_BEATS) + 1;
    const first = gallery.segments[0];
    const last = gallery.segments[gallery.segments.length - 1];
    first.from = B(g0) - 0.35;
    last.to = B(g1) + 0.45;
    return {
      segments: [
        { id: "open", from: 0, to: B(g0) + 0.35, render: () => <Opening id={photos.opening} B={B} names={names} date={formatDate(couple.date, "dot")} kicker={copy.kicker} /> },
        ...gallery.segments,
        { id: "end", from: B(g1) - 0.45, to: end, render: () => <Ending id={photos.ending} B={B} from={g1} line={copy.ending} names={names} /> },
      ],
      transitions: [
        { kind: "zoom", from: B(g0) - 0.35, to: B(g0) + 0.35, a: "open", b: first.id },
        ...gallery.transitions,
        { kind: "cross", from: B(g1) - 0.45, to: B(g1) + 0.45, a: last.id, b: "end" },
      ],
    };
  }, [B, couple, photos, copy, portrait]);

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Film segments={film.segments} transitions={film.transitions} background={() => PAPER} />
      <Vignette strength={0.28} />
      <FilmGrain opacity={0.05} />
      <EdgeFade inSec={0.4} outSec={1.2} />
      <Music music={music} />
    </AbsoluteFill>
  );
};

const beatGridSchema = z.object({ beats: z.array(z.number()) }).nullable().optional();

const definition = defineTemplate(
  {
    id: "VVV-Starter",
    code: "Starter",
    title: "节拍相册",
    slots: starterSlots,
    // Exact length needs the beat map; calculateMetadata supplies it. This is the no-music length.
    seconds: (props) => {
      const shots = shotCount(props.photos.gallery, false);
      return beatClock((props as Props).beatGrid)(totalBeats(shots)) + 1;
    },
    component: Starter as React.FC<TemplateProps<typeof starterSlots>>,
    fps: 30,
    copy: COPY,
    poster: 3,
    music: { src: "music/maple-leaf-rag.ogg", volume: 0.85, trimBeforeSec: 0, fadeInSec: 0.2, fadeOutSec: 1.5 },
  },
  { schema: { beatGrid: beatGridSchema }, defaults: { beatGrid: null } },
);

/** Load the beat map once, before rendering, so the length and every cut follow the music. */
const calculateMetadata: CalculateMetadataFunction<any> = async ({ props }) => {
  const parsed = definition.schema.parse(props) as Props;
  const grid = await loadBeatGrid(parsed.music);
  const portrait = typeof parsed.format === "string" && (() => { const [w, h] = parsed.format.split(":").map(Number); return h > w; })();
  const shots = shotCount(parsed.photos.gallery, portrait);
  const seconds = beatClock(grid)(totalBeats(shots)) + 1;
  return { durationInFrames: Math.ceil(seconds * parsed.fps), props: { ...parsed, beatGrid: grid } };
};

export const starter = { ...definition, calculateMetadata };
