import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { Music } from "../../components/Music";
import { EdgeFade, FilmGrain } from "../../components/Overlays";
import { beatClock as sharedBeatClock, loadBeatGrid, type BeatGrid as Grid } from "../../core/beat-clock";
import { defineTemplate, type TemplateProps } from "../../core/template";
import {
  FilmStripScene, FloatingScene, GreetingScene, Letter2Scene, LetterScene, MilestoneScene, ScatterScene, TitleScene, WallScene, Window,
} from "./scenes";
import { graphemes } from "./hand";

/**
 * Growth: a first-birthday growth film. Title → greeting → handwritten letter → scrolling film
 * strip → one milestone card per photo → scattered collage → glowing second letter → photos
 * floating through stars → flash into a scrolling photo wall → ending line. Every section starts on
 * a beat of the soundtrack; see README.md for the section table.
 */

export const growthSlots = {
  film: { count: 9, min: 3, max: 15 },
  milestones: { count: 20, min: 6, max: 30 },
  scatter: { count: 16, min: 6, max: 24, independent: true },
  floating: { count: 14, min: 6, max: 20, independent: true },
  wall: { count: 30, min: 9, max: 45, independent: true },
} as const;

/** Tempo used when the project has no beat map (silent drafts). */
const FALLBACK_BPM = 110;

export const COPY = {
  title: { label: "片头标题", text: "送给一周岁的你" },
  subtitle: { label: "标题下的小字", text: "baby's growth record" },
  greeting: { label: "开场一句（手写打字）", text: "亲爱的宝贝，一周岁生日快乐！" },
  letter: {
    label: "第一封信（每行一句，换行分隔）",
    text: "时间过得好快，转眼就是一整年\n你第一次睁眼、第一次笑、第一次喊妈妈\n每一个瞬间，我们都偷偷记了下来\n等你长大了，再一件一件讲给你听\n谢谢你选择了我们\n这一年，因为你而闪闪发光",
  },
  letter2: {
    label: "第二封信（第一行先慢慢写出，其余逐行发光出现）",
    text: "你的每一个第一次，我们都在身边\n愿你被这个世界温柔以待\n愿你有勇气，也有退路\n愿你健康、快乐、自由地长大\n爸爸妈妈会一直陪着你\n永远爱你",
  },
  ending: { label: "结尾一句", text: "一周岁快乐" },
};

export const DEMO_CAPTIONS = [
  "终于等到你\n爸爸妈妈又惊又喜", "我们第一次见面了", "你来到了这个世界", "小小的你\n躺在妈妈怀里",
  "第一次洗澡\n小脚丫蹬个不停", "睡着的样子\n像个小天使", "第一次出门\n看什么都新鲜", "满月啦",
  "会抬头了\n每天都在长大", "第一次翻身", "第一次吃辅食\n糊了一脸", "会坐了\n坐得稳稳的",
  "和爸爸一起读绘本", "第一个新年\n收了好多红包", "开始学爬了", "扶着站起来啦",
  "第一次看海", "最喜欢的玩具", "会叫妈妈了", "时间很快\n一转眼就一周岁了",
];

type Props = TemplateProps<typeof growthSlots> & { captions: string[]; beatGrid?: Grid | null };

const beatClock = (grid: Grid | null | undefined) => sharedBeatClock(grid, FALLBACK_BPM);
const lineCount = (text: string) => text.split("\n").filter((l) => l.trim()).length;

/** Section starts in beats, from the inputs that change their length. */
export function plan(miles: number, letterLines: number, letter2Lines: number) {
  let b = 0;
  const at = (n: number) => { const s = b; b += n; return s; };
  const title = at(8);
  const greet = at(8);
  const letter = at(Math.max(12, 2 * letterLines + 4));
  const film = at(26);
  const milestones = at(4 * miles);
  const scatter = at(24);
  const letter2 = at(Math.max(10, letter2Lines + 6));
  const floating = at(14);
  const wall = at(32);
  const end = at(8);
  return { title, greet, letter, film, milestones, scatter, letter2, floating, wall, end, total: b };
}

const planFor = (props: Props) => plan(props.photos.milestones.length, lineCount(props.copy.letter), lineCount(props.copy.letter2));

const Growth: React.FC<Props> = ({ photos, copy, captions, music, beatGrid }) => {
  const B = useMemo(() => beatClock(beatGrid), [beatGrid]);
  const P = useMemo(() => plan(photos.milestones.length, lineCount(copy.letter), lineCount(copy.letter2)), [photos.milestones.length, copy.letter, copy.letter2]);
  const beat = B(1) - B(0);
  const end = B(P.total) + 1;
  const pulses = [8, 16, 24].map((k) => B(P.wall + k));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Window from={0} to={B(P.greet)}>
        <TitleScene from={0} to={B(P.greet)} title={copy.title} subtitle={copy.subtitle} />
      </Window>
      <Window from={B(P.greet)} to={B(P.letter)}>
        <GreetingScene from={B(P.greet)} to={B(P.letter)} text={copy.greeting} />
      </Window>
      <Window from={B(P.letter)} to={B(P.film)}>
        <LetterScene from={B(P.letter)} to={B(P.film)} text={copy.letter} lineStep={2 * beat} />
      </Window>
      <Window from={B(P.film)} to={B(P.milestones)}>
        <FilmStripScene from={B(P.film)} to={B(P.milestones)} ids={photos.film} />
      </Window>
      {photos.milestones.map((id, i) => (
        <Window key={i} from={B(P.milestones + 4 * i)} to={B(P.milestones + 4 * i + 4)}>
          <MilestoneScene from={B(P.milestones + 4 * i)} to={B(P.milestones + 4 * i + 4)} id={id} caption={captions[i] ?? ""} index={i} />
        </Window>
      ))}
      <Window from={B(P.scatter)} to={B(P.letter2)}>
        <ScatterScene from={B(P.scatter)} to={B(P.letter2)} ids={photos.scatter} />
      </Window>
      <Window from={B(P.letter2)} to={B(P.floating)}>
        <Letter2Scene from={B(P.letter2)} to={B(P.floating)} text={copy.letter2} leadSec={B(P.letter2 + 3) - B(P.letter2)} lineStep={beat} />
      </Window>
      <Window from={B(P.floating)} to={B(P.wall)}>
        <FloatingScene from={B(P.floating)} to={B(P.wall)} ids={photos.floating} />
      </Window>
      <Window from={B(P.wall)} to={end}>
        <WallScene from={B(P.wall)} to={end} ids={photos.wall} pulses={pulses} endFrom={B(P.end)} ending={copy.ending}
          endStep={Math.min(0.16, (beat * 2) / Math.max(1, graphemes(copy.ending).length))} />
      </Window>
      <FilmGrain opacity={0.035} />
      <EdgeFade inSec={0.3} outSec={1.6} />
      <Music music={music} />
    </AbsoluteFill>
  );
};

const beatGridSchema = z.object({ beats: z.array(z.number()) }).nullable().optional();
const captionsSchema = z.array(z.string()).max(30).describe("里程碑文案，按顺序对应 photos.milestones；\\n 换行");

const definition = defineTemplate(
  {
    id: "VVV-Growth",
    code: "Growth",
    title: "周岁成长记",
    slots: growthSlots,
    couple: false,
    seconds: (props) => beatClock((props as Props).beatGrid)(planFor(props as Props).total) + 1,
    component: Growth as React.FC<TemplateProps<typeof growthSlots>>,
    fps: 30,
    copy: COPY,
    poster: 2,
    music: { src: "music/mixkit-first-kiss.mp3", volume: 0.85, trimBeforeSec: 0, fadeInSec: 0.3, fadeOutSec: 2 },
  },
  { schema: { captions: captionsSchema, beatGrid: beatGridSchema }, defaults: { captions: DEMO_CAPTIONS, beatGrid: null } },
);

/** Load the beat map once, before rendering, so the length and every cut follow the music. */
const calculateMetadata: CalculateMetadataFunction<any> = async ({ props }) => {
  const parsed = definition.schema.parse(props) as Props;
  const grid = await loadBeatGrid(parsed.music);
  const seconds = beatClock(grid)(planFor(parsed).total) + 1;
  return { durationInFrames: Math.ceil(seconds * parsed.fps), props: { ...parsed, beatGrid: grid } };
};

export const growth = { ...definition, calculateMetadata };
