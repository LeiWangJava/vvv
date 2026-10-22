import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { musicSchema } from "../../components/Music";
import { beatsPathFor } from "../../core/beats";
import { eIo3 } from "../../core/ease";
import { DVToPlay } from "./handover";
import { TypingSounds } from "./typing-audio";
import { makeClock, type BeatGrid } from "./clock";
import type { SceneCtx } from "./ctx";
import { PlayBackground, PlayLabel } from "./frames";
import { Dust, Glitch } from "./fx";
import { BirthScene, DVScreen, FlashScene, TitleScene, TypeText } from "./scenes-dv";
import { CardScene, EndingScene, FateScene, PageScene, StripScene } from "./scenes-play";
import { getPhoto } from "../../core/manifest";
import { trimBeatGrid } from "./metadata";
import { parsePages, validatePhotoTokens } from "./photo-tokens";
import { buildStory, COPY, PHOTOS, type Scene } from "./story";

/**
 * DV Story · 我们的故事 — a beat-locked wedding warm-up film: typed welcome lines, a home-video
 * viewfinder for the early years, a "PLAY ●" screen with stickers for the love story, a 35 mm strip
 * for the wedding photos. Every cut and every typed character lands on the song's beats. Defaults
 * are the fictional demo couple 林以舟 & 许知夏. See README.md here.
 */

const textObject = (def: Record<string, { label: string; text: string }>) =>
  z.object(Object.fromEntries(Object.entries(def).map(([k, v]) => [k, z.string().describe(v.label)])));
const defaults = (def: Record<string, { label: string; text: string }>) => Object.fromEntries(Object.entries(def).map(([k, v]) => [k, v.text]));

const photoTokensSchema = z.string().superRefine((value, ctx) => {
  try { parsePages(value); } catch (error) {
    ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid photo tokens" });
  }
});

export const dvStorySchema = z.object({
  copy: textObject(COPY),
  photos: z.object(Object.fromEntries(Object.entries(PHOTOS).map(([k, v]) => [k, photoTokensSchema.describe(v.label)]))),
  proposalFirst: z.boolean().describe("求婚在订婚和婚纱照之前（参考视频的顺序）"),
  endingBeats: z.number().int().min(4).max(32).describe("结尾卡片的拍数（让片子停在乐句上）"),
  playIntroBeats: z.object({ believe: z.number().min(2), fate: z.number().min(2), together: z.number().min(2) }).describe("恋爱篇章开头三段文案的拍数"),
  typewriterCards: z.boolean().describe("后半段独立文案使用打字机效果（照片标题不变）"),
  typingSfxVolume: z.number().min(0).max(0.5).describe("逐字同步的打字机音量；0 为静音"),
  handoverFadeSec: z.number().min(0).max(3).describe("DV 取景器连续叠化到 PLAY 的秒数；0 为原磁带闪切"),
  music: musicSchema,
  /**
   * Optional second song: it takes over at film beat `atBeat` (the first song fades out on that
   * beat), entering at its own beat `fromBeat` (counted from its first downbeat). The film's beat
   * grid switches to the second song there, so everything after stays on its beats.
   */
  music2: z.object({
    src: z.string().describe("第二首音乐（public/ 下）；留空为只用一首"),
    volume: z.number().min(0).max(1),
    atBeat: z.number().int().min(0).describe("从片子的第几拍开始换歌"),
    fromBeat: z.number().int().min(0).describe("第二首从它自己的第几拍进入"),
    fadeOutSec: z.number().min(0),
    crossfadeSec: z.number().min(0.05).max(5).describe("两首音乐的交叉淡化秒数"),
  }),
  /** bunny & bear stickers; off = words only (the couple's film) */
  stickers: z.boolean().describe("显示兔子小熊贴纸（关闭后只显示文字）"),
  /** the couple's own illustration for the 从此以后 card (public/ path; empty = sticker or words) */
  sinceArt: z.string().describe("「从此以后」卡片上的新人插画（public/ 下 PNG，可留空）"),
  /** music volume during the welcome lines, rising to full when the camcorder part starts */
  introVolume: z.number().min(0).max(1).describe("开场文字段的音乐音量（之后升到 100%）"),
  fps: z.number().int().min(24).max(60).describe("帧率：预览 30，成片 60"),
  format: z.string().optional().describe("画幅（由工程初始化时选择）"),
  /** filled in by calculateMetadata from the music's .beats.json (both songs, chained) */
  beatGrid: z.object({ beats: z.array(z.number()), downbeats: z.array(z.number()) }).nullable().optional(),
  /** filled in by calculateMetadata: film second where song 2 starts and its position in the file */
  music2At: z.number().optional(),
  music2Trim: z.number().optional(),
});
export type DVStoryProps = z.infer<typeof dvStorySchema>;

/**
 * Pacing follows the reviewed delivery cut: typed cards, one key tap per character, a 2.4 s
 * viewfinder-to-playback dissolve and the shorter opening PLAY cards. The default song is Fifth of
 * February (download-only; `npm run music`); the storyboard's phrase landings are fitted to it.
 */
export const DV_STORY_DEFAULTS: DVStoryProps = {
  copy: defaults(COPY) as DVStoryProps["copy"],
  photos: defaults(PHOTOS) as DVStoryProps["photos"],
  proposalFirst: true,
  endingBeats: 16,
  playIntroBeats: { believe: 6, fate: 6, together: 4 },
  typewriterCards: true,
  typingSfxVolume: 0.15,
  handoverFadeSec: 2.4,
  music: { src: "music/mixkit-fifth-of-february.mp3", volume: 0.9, trimBeforeSec: 0, fadeInSec: 0.05, fadeOutSec: 1.5 },
  // Optional second song, for example a livelier track from the PLAY section on.
  music2: { src: "", volume: 0.9, atBeat: 116, fromBeat: 40, fadeOutSec: 3.5, crossfadeSec: 2.4 },
  stickers: true,
  sinceArt: "",
  introVolume: 1,
  fps: 30,
  beatGrid: null,
};

const FADE_OUT = 2.2;
const startOf = (s: Scene, at: (b: number) => number) => (s.kind === "title" ? 0 : at(s.b0));

const fetchGrid = async (musicSrc: string): Promise<BeatGrid | null> => {
  if (!musicSrc) return null;
  try {
    const r = await fetch(staticFile(beatsPathFor(musicSrc)));
    if (!r.ok) return null;
    const j = (await r.json()) as BeatGrid;
    return { beats: j.beats, downbeats: j.downbeats };
  } catch {
    return null;
  }
};

/** Duration and beat grid come from the music's beat map(s), so a new song re-times the film. */
export const calculateDVStory: CalculateMetadataFunction<DVStoryProps> = async ({ props }) => {
  // Every photo token must resolve to a project asset before any frame renders.
  validatePhotoTokens(props.photos, (id) => {
    try { getPhoto(id); return true; } catch { return false; }
  });
  // Rebase song 1's measured beats into the trimmed audio's time.
  let grid = trimBeatGrid(await fetchGrid(props.music.src), props.music.trimBeforeSec);
  let music2At: number | undefined;
  let music2Trim: number | undefined;
  const g2 = props.music2.src ? await fetchGrid(props.music2.src) : null;
  if (g2) {
    // film second of the switch beat on song 1's grid, and song 2's matching beat in its file
    const at = makeClock(grid).at(props.music2.atBeat);
    const f2 = Math.max(0, g2.beats.indexOf(g2.downbeats[0]));
    const from = g2.beats[f2 + props.music2.fromBeat] ?? 0;
    const shift = at - from;
    const cut = at - 0.05;
    grid = {
      beats: [...(grid?.beats ?? []).filter((b) => b < cut), ...g2.beats.map((b) => b + shift).filter((b) => b >= cut)],
      downbeats: [...(grid?.downbeats ?? []).filter((b) => b < cut), ...g2.downbeats.map((b) => b + shift).filter((b) => b >= cut)],
    };
    music2At = at;
    music2Trim = from;
  }
  const clock = makeClock(grid);
  const story = buildStory(props.copy, props.photos, { proposalFirst: props.proposalFirst, endingBeats: props.endingBeats, playIntroBeats: props.playIntroBeats });
  const end = clock.at(story[story.length - 1].b1);
  return { fps: props.fps, durationInFrames: Math.ceil(end * props.fps), props: { ...props, beatGrid: grid, music2At, music2Trim } };
};

export const DVStory: React.FC<DVStoryProps> = (props) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // each frame shows the moment at its center, so a cut on a beat lands on the nearest frame
  const t = (f + 0.5) / fps;
  const total = durationInFrames / fps;
  const clock = useMemo(() => makeClock(props.beatGrid), [props.beatGrid]);
  const story = useMemo(
    () => buildStory(props.copy, props.photos, { proposalFirst: props.proposalFirst, endingBeats: props.endingBeats, playIntroBeats: props.playIntroBeats }),
    [props.copy, props.photos, props.proposalFirst, props.endingBeats, props.playIntroBeats],
  );
  const idx = Math.max(
    0,
    story.findIndex((s) => t >= startOf(s, clock.at) && t < clock.at(s.b1)),
  );
  const scene = story[idx] ?? story[story.length - 1];
  const t0 = startOf(scene, clock.at);
  const ctx: SceneCtx = {
    t,
    f,
    fps,
    clock,
    lb: clock.beatOf(t) - scene.b0,
    beats: scene.b1 - scene.b0,
    ls: t - t0,
    dir: "",
    stickers: props.stickers,
    typewriterCards: props.typewriterCards,
    title: { cn: props.copy.titleCn ?? "", en: props.copy.titleEn ?? "" },
  };
  const beatOn = Math.floor(clock.beatOf(t)) % 2 === 0;

  let body: React.ReactNode = null;
  switch (scene.kind) {
    case "title":
      body = <TitleScene ctx={ctx} />;
      break;
    case "type":
      body =
        scene.screen === "dv" ? (
          <DVScreen ctx={ctx}>
            <TypeText ctx={ctx} text={scene.text} />
          </DVScreen>
        ) : (
          <AbsoluteFill style={{ background: "#000" }}>
            <TypeText ctx={ctx} text={scene.text} />
          </AbsoluteFill>
        );
      break;
    case "birth":
      body = (
        <DVScreen ctx={ctx}>
          <BirthScene ctx={ctx} text={scene.text} photo={scene.photo} variant={scene.variant} />
        </DVScreen>
      );
      break;
    case "flash":
      body = (
        <DVScreen ctx={ctx}>
          <FlashScene ctx={ctx} photos={scene.photos} />
        </DVScreen>
      );
      break;
    case "card":
    case "fate":
    case "page":
      body = (
        <AbsoluteFill>
          <PlayBackground />
          {scene.kind === "card" ? <CardScene ctx={ctx} text={scene.text} sticker={scene.sticker} art={scene.id === "since" ? props.sinceArt : undefined} /> : null}
          {scene.kind === "fate" ? <FateScene ctx={ctx} text={scene.text} photo={scene.photo} chat={scene.chat} /> : null}
          {scene.kind === "page" ? <PageScene ctx={ctx} title={scene.title} pages={scene.pages} titleSticker={scene.titleSticker} /> : null}
          <PlayLabel dotOn={beatOn} />
        </AbsoluteFill>
      );
      break;
    case "strip":
      body = <StripScene ctx={ctx} text={scene.text} photos={scene.photos} />;
      break;
    case "ending":
      body = <EndingScene ctx={ctx} text={scene.text} />;
      break;
  }

  // Match the playback background before the scene boundary; no fade through an empty black frame.
  const firstPlay = story.find((s) => s.screen === "play");
  const handover = firstPlay ? clock.at(firstPlay.b0) : -1;
  const gentle = props.handoverFadeSec > 0;
  const glitch = !gentle && handover > 0 ? 1 - Math.min(1, Math.abs(t - handover) / 0.14) : 0;
  const inHandover = gentle && handover > 0 && t >= handover - props.handoverFadeSec && t < handover && scene.kind === "type" && scene.screen === "dv";
  if (inHandover) {
    body = <DVToPlay ctx={ctx} text={scene.text} at={handover} durationSec={props.handoverFadeSec} />;
  }
  const dustOpacity = inHandover ? 0.5 - 0.08 * eIo3((t - handover + props.handoverFadeSec) / props.handoverFadeSec) : scene.screen === "dv" ? 0.5 : scene.screen === "end" ? 0.28 : 0.42;

  const births = story.find((s) => s.kind === "birth");
  const rampFrom = births ? clock.at(births.b0 - 4) : 0;
  const rampTo = births ? clock.at(births.b0) : 0;
  const music = props.music;
  const m2At = props.music2.src ? props.music2At : undefined;
  // Keep the musical entry beat fixed; only widen the lead-in overlap.
  const lead = Math.min(props.music2.crossfadeSec, props.music2Trim ?? props.music2.crossfadeSec, m2At ?? props.music2.crossfadeSec);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {glitch > 0.02 ? <Glitch f={f} amount={glitch}>{body}</Glitch> : body}
      <Dust f={f} fps={fps} opacity={dustOpacity} />
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(t, [total - FADE_OUT, total], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      {props.typingSfxVolume > 0 ? <TypingSounds story={story} clock={clock} fps={fps} cardsEnabled={props.typewriterCards} volume={props.typingSfxVolume} /> : null}
      {music.src ? (
        <Audio
          src={staticFile(music.src)}
          trimBefore={Math.round(music.trimBeforeSec * fps)}
          volume={(fr) => {
            const ts = fr / fps;
            const intro = births ? interpolate(ts, [rampFrom, rampTo], [props.introVolume, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
            if (m2At !== undefined) {
              const fadeIn = interpolate(ts, [0, music.fadeInSec], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const blend = interpolate(ts, [m2At - lead, m2At], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return music.volume * intro * fadeIn * Math.cos((Math.PI / 2) * blend);
            }
            const end = total;
            const fadeOut = music.fadeOutSec;
            const edges = interpolate(ts, [0, music.fadeInSec, end - fadeOut, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return music.volume * intro * edges;
          }}
        />
      ) : null}
      {m2At !== undefined && props.music2.src ? (
        <Sequence from={Math.round((m2At - lead) * fps)} layout="none">
          <Audio
            src={staticFile(props.music2.src)}
            trimBefore={Math.round(Math.max(0, (props.music2Trim ?? 0) - lead) * fps)}
            volume={(fr) => {
              const ts = m2At - lead + fr / fps;
              const blend = interpolate(ts, [m2At - lead, m2At], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const fadeOut = interpolate(ts, [total - props.music2.fadeOutSec, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return props.music2.volume * Math.sin((Math.PI / 2) * blend) * fadeOut;
            }}
          />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export const dvStory = {
  id: "VVV-DVStory",
  code: "DV Story",
  title: "DV 录像 · 我们的故事",
  component: DVStory,
  defaultProps: DV_STORY_DEFAULTS,
  schema: dvStorySchema,
  width: 1920,
  height: 1080,
  fps: 30,
  /** Synchronous fallback at 100 BPM; calculateMetadata uses the measured beat map. */
  seconds: (props: DVStoryProps) => {
    const story = buildStory(props.copy, props.photos, { proposalFirst: props.proposalFirst, endingBeats: props.endingBeats, playIntroBeats: props.playIntroBeats });
    return makeClock(null).at(story[story.length - 1].b1);
  },
  calculateMetadata: calculateDVStory,
};
