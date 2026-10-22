import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { Music } from "../../components/Music";
import { beatsPathFor, makeWarp, mergeAnchors, useBeatMap, type Anchor, type Hit } from "../../core/beats";
import hits from "./hits.json";
import { formatDate } from "../../core/couple";
import { doodleSlots as slots } from "./slots";
import { defineTemplate, type TemplateProps } from "../../core/template";
import { Film, type FilmSegment } from "../../engine/Film";
import { Avatars, B, Bt, Ending, Intro, PAGE, PAGES, Paper, Player, type Ctx } from "./scenes";

/**
 * Doodle · 白纸手绘 · 我们结婚啦 — white watercolor paper, black marker doodles, a pink watercolor
 * heart, pages of wedding photos sliding across the paper. Rebuilt from the owner's original wedding film.
 * Default music: Dance with Me (85 BPM, download-only; `npm run music`).
 */

const DESIGN_SECONDS = 142;


type Props = TemplateProps<typeof slots>;

export const COPY = {
  intro_line: { label: "开场 · 小字", text: "欢迎来到我们的婚礼" },
  song_title: { label: "唱片卡片 · 歌名", text: "我们的歌" },
  song_sub: { label: "唱片卡片 · 小字", text: "正在播放中…" },
  poem: {
    label: "诗句页 · 四行英文（用｜分隔）",
    text: "I found you in a crowded world.｜Two roads became one.｜We promise a lifetime together.｜Happiness starts right here.",
  },
  camera_line: { label: "相机页 · 两行（用｜分隔）", text: "Every road leads to you.｜Click — and forever begins." },
  title_forever: { label: "照片页 · 标题 1", text: "Forever Us" },
  title_love: { label: "照片页 · 标题 2", text: "Love Always" },
  love_line: { label: "照片页 2 · 角落小字", text: "愿得一心人" },
  title_soul: { label: "照片页 · 标题 3", text: "Soul Bound" },
  title_onelove: { label: "照片页 · 标题 4", text: "One Love, One Life" },
  title_ever: { label: "照片页 · 标题 5", text: "Happily Ever After" },
  title_us: { label: "最后一页 · 标题", text: "Just Us" },
  thanks: { label: "结尾 · 感谢", text: "THANK YOU FOR COMING" },
};

/**
 * Scene timeline. The opening card glides in and out (scenes.tsx · Slide); from the avatars on, every
 * element of a page has its own entrance and exit (scenes.tsx · Anim), in an order that varies from
 * page to page (photos first, or words first), all on the beat. A page has left the paper when the
 * next one starts.
 */
const PLAYER_IN = B(12);
const PLAYER_OUT = B(20);
const ENDING = B(PAGE[9]);
const span = (from: number, to: number) => ({ from: from - Bt(2) - 0.05, to: to + 0.05 });

/**
 * Anchors for the beat warp. hits.json holds the measured visual peaks of this choreography
 * (`python3 scripts/calibrate.py`, design seconds), so the biggest changes, often mid-way through
 * an eased entrance, land on beats. Every other design beat snaps to the nearest measured beat, so
 * the pops and print bumps between page changes stay on the music where its tempo drifts.
 * Re-run the calibration after changing the motion.
 */
const BEAT_ANCHORS: Anchor[] = Array.from({ length: Math.floor((DESIGN_SECONDS - B(0)) / Bt(1)) }, (_, n): Anchor => ({ t: B(n), kind: "beat" }));
const ANCHORS: Anchor[] = mergeAnchors(hits as Hit[], BEAT_ANCHORS);

const DoodleFilm: React.FC<Props> = ({ couple, photos, copy, music }) => {
  const beats = useBeatMap(beatsPathFor(music.src));
  const warp = useMemo(
    () => makeWarp(ANCHORS, { beats, designSeconds: DESIGN_SECONDS, musicSeconds: DESIGN_SECONDS, musicOffset: music.trimBeforeSec }),
    [beats, music.trimBeforeSec],
  );
  const segments = useMemo((): FilmSegment[] => {
    const c: Ctx = {
      ph: {
        thumb: photos.thumb,
        groomSolo: photos.groomSolo,
        brideSolo: photos.brideSolo,
        poem: photos.poem,
        camera: photos.camera,
        forever: photos.forever,
        loveBig: photos.loveBig,
        loveSmall: photos.loveSmall,
        soul: [photos.soul[0], photos.soulWide],
        oneLove: photos.oneLove,
        ever: [photos.ever[0], photos.everWide, photos.ever[1]],
        us: photos.us,
      },
      groom: couple.groom,
      bride: couple.bride,
      date: formatDate(couple.date, "dot"),
      copy,
    };
    return [
      { id: "intro", from: 0, to: PLAYER_IN + 0.05, render: () => <Intro c={c} outAt={PLAYER_IN} /> },
      { id: "player", ...span(PLAYER_IN, PLAYER_OUT), render: () => <Player c={c} inAt={PLAYER_IN} outAt={PLAYER_OUT} /> },
      { id: "avatars", from: PLAYER_OUT - 0.05, to: B(PAGE[0]) + 0.05, render: () => <Avatars c={c} E={B(PAGE[0])} /> },
      ...PAGES.map((Page, i): FilmSegment => {
        // Each page starts one beat early, entering while the previous page's photos leave, so the
        // paper is never empty between pages.
        const S = B(PAGE[i] - 1);
        const E = B(PAGE[i + 1]);
        return { id: `p${i}`, from: S - 0.05, to: E + 0.05, render: () => <Page c={c} S={S} E={E} /> };
      }),
      { id: "ending", from: ENDING - 0.05, to: DESIGN_SECONDS + 0.1, render: () => <Ending c={c} S={ENDING} E={DESIGN_SECONDS} /> },
    ];
  }, [couple, photos, copy]);
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      <Paper />
      <Film segments={segments} background={() => "transparent"} toDesign={warp.toDesign} />
      <Music music={music} />
    </AbsoluteFill>
  );
};

export const doodle = defineTemplate({
  id: "VVV-Doodle",
  code: "Doodle",
  title: "白纸手绘·我们结婚啦",
  slots,
  seconds: () => DESIGN_SECONDS,
  component: DoodleFilm,
  fps: 30,
  copy: COPY,
  poster: 63,
  short: { background: "#F7F6F2", ink: "#1E1E1E", accent: "#E58FA0", titleFont: "songti", bodyFont: "songti", frame: "print" },
  // Dance with Me — Ahjay Stelino, Mixkit Stock Music Free License; download-only (public/music/sources.json)
  music: { src: "music/mixkit-dance-with-me.mp3", volume: 0.85, trimBeforeSec: 0, fadeInSec: 0.3, fadeOutSec: 2.5 },
});
