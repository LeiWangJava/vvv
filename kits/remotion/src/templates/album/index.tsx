import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { Music } from "../../components/Music";
import { beatsPathFor, makeWarp, mergeAnchors, useBeatMap, type Anchor, type Hit } from "../../core/beats";
import { coupleNames, formatDate } from "../../core/couple";
import { eIo3, eIo5 } from "../../core/ease";
import { albumSlots as slots } from "./slots";
import { defineTemplate, type TemplateProps } from "../../core/template";
import { Film, type FilmSegment, type FilmTransition } from "../../engine/Film";
import { gallerySegments, placeShots, planShots, SetCaptionText, type GallerySkin, type Palette } from "../../engine/Gallery";
import { setCopyFor } from "../../core/copy";
import { fontFor } from "../../core/fonts";
import { C } from "../shared/kit";
import hits from "./hits.json";
import { AlbumShort, shortSeconds } from "./short";
import {
  GalleryTitle, Seg0, Seg1, Seg11, Seg12, Seg13, Seg14, Seg15, Seg16, Seg17, Seg18, Seg2, Seg3, Seg45, Seg6, Seg7, Seg8, Seg9,
  type Ctx,
} from "./scenes";

/**
 * Album · 现代留白·圆角画册 — opens with the couple's own story, then the wedding album, then a
 * full-size wedding-photo gallery and the ending. Default music: Skyline (84 BPM, download-only;
 * `npm run music`). Rebuilt segment by segment from the owner's original wedding film.
 */

const DESIGN_SECONDS = 197.5;
/** Beat grid of the default song (Skyline): first downbeat + 84 BPM. */
const B = (n: number) => 2.86 + (n * 60) / 84;
const GALLERY_FROM = 120;
const GALLERY_TO = 258;


type Props = TemplateProps<typeof slots>;

// ---------------------------------------------------------------- timeline (design seconds)
const SEGMENTS: [id: string, from: number, to: number, Scene: React.FC<{ c: Ctx }>][] = [
  ["seg0", 0.0, 4.25, Seg0],
  ["seg1", 3.6, 7.85, Seg1],
  ["seg2", 7.55, 12.9, Seg2],
  ["seg3", 12.6, 17.85, Seg3],
  ["seg45", 17.45, 27.6, Seg45],
  ["seg6", 26.8, 32.9, Seg6],
  ["seg7", 32.55, 37.7, Seg7],
  ["seg8", 36.9, 42.6, Seg8],
  ["seg9", 41.8, 51.6, Seg9],
  ["seg11", 51.15, 56.1, Seg11],
  ["seg12", 55.7, 61.5, Seg12],
  ["seg13", 61.2, 66.7, Seg13],
  ["seg14", 66.0, 71.8, Seg14],
  ["seg15", 71.2, 76.7, Seg15],
  ["seg16", 76.0, 81.0, Seg16],
  ["seg17", 80.2, 85.5, Seg17],
];

const TRANSITIONS: FilmTransition[] = [
  { kind: "push", from: 3.6, to: 4.25, a: "seg0", b: "seg1", dir: "left", ease: eIo5, shutter: 1.0 },
  { kind: "push", from: 26.8, to: 27.6, a: "seg45", b: "seg6", dir: "left", ease: eIo3, shutter: 0.7 },
  { kind: "push", from: 41.8, to: 42.6, a: "seg8", b: "seg9", dir: "up", ease: eIo3, shutter: 0.7 },
  { kind: "spin", from: 66.0, to: 66.7, a: "seg13", b: "seg14" },
  { kind: "zoom", from: 71.2, to: 71.8, a: "seg14", b: "seg15" },
  { kind: "push", from: 80.2, to: 81.0, a: "seg16", b: "seg17", dir: "up", ease: eIo3, shutter: 0.7 },
  { kind: "dissolve", from: 84.6, to: 85.5, a: "seg17", b: "title" },
  { kind: "cross", from: B(GALLERY_FROM) - 0.5, to: B(GALLERY_FROM) + 0.5, a: "title", b: "g0" },
];

const GALLERY_SETS = ["s2", "s4", "s3", "s5", "s7", "s1", "s6", "s8"];
const skin: GallerySkin = {
  background: () => <AbsoluteFill style={{ background: C.bg }} />,
  margin: 56,
  gap: 32,
  radius: 22,
  shadow: "0 18px 42px rgba(40,30,20,0.16), 0 4px 12px rgba(40,30,20,0.08)",
  kb: 0.06,
  caption: (args) => (
    <SetCaptionText
      args={args}
      titleFont={fontFor("songti", args.title, 700)}
      lineFont={fontFor("songti", args.line)}
      color={args.overPhoto ? "#FFFFFF" : C.dark}
      sub={args.overPhoto ? "#F3EBDD" : C.grey}
      accent={C.gold}
    />
  ),
};

/** Same-set changes stay gentle; a new outfit gets a clear but smooth move. */
const PALETTE: Palette = {
  within: [
    { kind: "cross", seconds: 0.9 },
    { kind: "push", seconds: 0.8, dirs: ["left", "right"] },
    { kind: "wipe", seconds: 1.0, dirs: ["right", "left", "up"] },
    { kind: "blur", seconds: 0.9 },
  ],
  between: [
    { kind: "cover", seconds: 1.0, dirs: ["left", "up", "right"] },
    { kind: "dissolve", seconds: 1.1 },
    { kind: "iris", seconds: 1.1 },
    { kind: "push", seconds: 0.9, dirs: ["up", "left"] },
  ],
};

export const COPY = {
  story_a: { label: "Love Story 页 · 第一句", text: "从第一眼到永远" },
  story_b: { label: "Love Story 页 · 第二句", text: "和你的每一刻，都是最好的故事" },
  poem: { label: "竖排诗句（两列，用｜分隔）", text: "愿得一心人｜白首不相离" },
  quote_a: { label: "金句一 · 中文", text: "你是我的今天，也是我所有的明天" },
  one_heart: { label: "三联展开页 · 底部一句", text: "两个人，一颗心" },
  vow: { label: "Endless Love 页 · 两行（用｜分隔）", text: "执子之手｜与子偕老" },
  quote_b: { label: "金句二 · 中文", text: "爱你，比昨天多一点，比明天少一点" },
  forever: { label: "FOREVER 页 · 一句", text: "一生一世一双人" },
  love_you: { label: "LOVE YOU 页 · 三行（用｜分隔）", text: "从今往后｜每一个清晨与黄昏｜都有你" },
  rest_of_life: { label: "竖排手写大字", text: "余生是你" },
  my_love: { label: "竖排标题", text: "此生挚爱" },
  gallery_title: { label: "婚纱照段落标题", text: "我们的婚纱照" },
  gallery_subtitle: { label: "婚纱照段落副标题", text: "WEDDING GALLERY" },
  ...setCopyFor(GALLERY_SETS),
};

const background = (t: number) => (t >= 75.99 && t < 81.05 ? C.warm : C.bg);

/**
 * Original visual peaks in design seconds. mergeAnchors uses the measured hits.json
 * when available; these strong anchors are the fallback when that list is empty.
 */
const VISUAL_HITS_STRONG = [3.93, 12.73, 22.26, 27.18, 37.32, 42.22, 56.03, 66.22, 71.53, 76.24, 80.62];
// Additional visual timings in design seconds. mergeAnchors omits any within
// 0.3 seconds of a measured hit; makeWarp maps the retained anchors to the music grid.
const VISUAL_HITS = [7.49, 9.44, 14.34, 17.51, 17.97, 18.1, 32.52, 33.04, 47.18, 51.18, 51.55, 61.44, 62.19, 85.05];
// Text entrance timings in design seconds, subject to the same merge and warp rules.
const TEXT_HITS = [19.3, 52.7, 73.0, 77.2, 81.2, 85.7];
const MANUAL_ANCHORS: Anchor[] = [
  ...VISUAL_HITS_STRONG.map((t): Anchor => ({ t, kind: "cut" })),
  ...[...VISUAL_HITS, ...TEXT_HITS].map((t): Anchor => ({ t, kind: "beat" })),
];
const ANCHORS: Anchor[] = mergeAnchors(hits as Hit[], MANUAL_ANCHORS);

/** 9:16 renders the vertical short; every other format is the full 16:9 film. */
const isVertical = (format?: string) => {
  const [w, h] = (format ?? "16:9").split(":").map(Number);
  return h > w;
};

const AlbumFilm: React.FC<Props> = (props) => {
  const { photos, couple, copy } = props;
  const short = useMemo(
    () => ({ opening: photos.opening, ending: photos.ending, gallery: photos.gallery, names: coupleNames(couple),
      date: formatDate(couple.date, "dot"), tagline: couple.tagline, copy }),
    [photos, couple, copy],
  );
  return isVertical(props.format) ? <AlbumShort c={short} music={props.music} /> : <AlbumWide {...props} />;
};

const AlbumWide: React.FC<Props> = ({ couple, photos, copy, music }) => {
  const beats = useBeatMap(beatsPathFor(music.src));
  const warp = useMemo(
    () => makeWarp(ANCHORS, { beats, designSeconds: DESIGN_SECONDS, musicSeconds: DESIGN_SECONDS, musicOffset: music.trimBeforeSec }),
    [beats, music.trimBeforeSec],
  );
  const segments = useMemo((): { segments: FilmSegment[]; transitions: FilmTransition[] } => {
    const c: Ctx = {
      ph: photos,
      groom: couple.groom,
      bride: couple.bride,
      names: coupleNames(couple),
      date: formatDate(couple.date, "dot"),
      tagline: couple.tagline,
      copy,
    };
    const story = SEGMENTS.map(([id, from, to, Scene]) => ({ id, from, to, render: () => <Scene c={c} /> }));
    const plans = planShots(photos.gallery);
    // Four beats per shot for the demo gallery; a larger gallery drops to the most that fit the window.
    const minBeats = Math.max(1, Math.min(4, Math.floor((GALLERY_TO - GALLERY_FROM) / plans.length)));
    const shots = placeShots(plans, B, GALLERY_FROM, GALLERY_TO, minBeats);
    const g = gallerySegments(shots, skin, PALETTE, { copy });
    const S = B(GALLERY_TO);
    const last = g.segments[g.segments.length - 1];
    last.to = S + 0.6;
    return {
      segments: [
        ...story,
        { id: "title", from: 84.6, to: B(GALLERY_FROM) + 0.5, render: () => <GalleryTitle S={85.0} copy={copy} /> },
        ...g.segments,
        { id: "ending", from: S - 0.6, to: DESIGN_SECONDS + 0.1, render: () => <Seg18 c={c} S={S - 0.6} E={DESIGN_SECONDS} /> },
      ],
      transitions: [...TRANSITIONS, ...g.transitions, { kind: "dissolve", from: S - 0.6, to: S + 0.6, a: last.id, b: "ending" } as FilmTransition],
    };
  }, [couple, photos, copy]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Film segments={segments.segments} transitions={segments.transitions} background={background} toDesign={warp.toDesign} />
      <Music music={music} />
    </AbsoluteFill>
  );
};

export const album = defineTemplate({
  id: "VVV-Album",
  code: "Album",
  title: "现代留白·圆角画册",
  slots,
  // The vertical short shows only these; the other slots may stay empty in a 9:16 project.
  formatSlots: { "9:16": ["opening", "gallery", "ending"] },
  seconds: (props) => (isVertical(props.format) ? shortSeconds(props.photos) : DESIGN_SECONDS),
  component: AlbumFilm,
  fps: 30,
  copy: COPY,
  poster: 3.5,
  short: { background: "#FCFBF8", ink: "#2B2B2B", accent: "#BD945C", titleFont: "songti", bodyFont: "songti", frame: "none" },
  // Skyline — Eugenio Mininni, Mixkit Stock Music Free License; download-only (public/music/sources.json)
  music: { src: "music/mixkit-skyline.mp3", volume: 1, trimBeforeSec: 0, fadeInSec: 0, fadeOutSec: 3 },
});
