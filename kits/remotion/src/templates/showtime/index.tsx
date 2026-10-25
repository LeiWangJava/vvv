import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { Cues, Music, type Cue } from "../../components/Music";
import { EdgeFade } from "../../components/Overlays";
import { beatClock, loadBeatGrid, type BeatGrid } from "../../core/beat-clock";
import { formatDate } from "../../core/couple";
import { defineTemplate, type TemplateProps } from "../../core/template";
import { BPM, CARDS, TOTAL_BEATS, type Card } from "./plan";
import {
  DateCard, FakeCard, FinaleCard, GagCard, GoldCard, HeroCard, Ident, MagazineCard, NamesCard, NumberCard, PhotoCard,
  SlideCard, SnapCard, SparkleTitle, SplitCard, WhiteCard, Window, WitnessCard, type Ctx,
} from "./scenes";

/**
 * Showtime · 喜剧开场 · 大屏卡点版 — a big-screen comic opening for the wedding banquet, hosted by a
 * cartoon bride and groom who dance on every beat: the wedding channel goes on air, the hosts welcome
 * the guests line by line in heavy gold type, ask for phones out and applause, set the house rules
 * (eat well, go easy on the groom), count down with red and white flash cards, introduce the groom
 * and the bride (each with a wrong-person gag on their childhood photo), then a magazine spread, the
 * wedding photos, and a round frame thanking the guests. About 2 min 50 s on its own 128 BPM track.
 *
 * Music and sound effects are synthesized by scripts/make-showtime-audio.py and ship with the
 * template; there are no film clips, voices or third-party characters in it.
 */

export const showtimeSlots = {
  couple1: {},
  groomKid: {},
  groomHero: {},
  coupleA: {},
  brideKid: {},
  brideHero: {},
  coupleB: {},
  mag: { count: 9, min: 3, max: 9, independent: true },
  slides: { count: 12, min: 4, max: 12, independent: true },
  finale: {},
} as const;

const c = (label: string, text: string) => ({ label, text });
export const COPY = {
  ident_search: c("片头 · 搜索信号（雪花屏下方）", "正在搜索婚礼信号…"),
  ident_bars: c("片头 · 彩条上的字", "信号调试中"),
  ident_channel: c("片头 · 频道名（新人名字下面）", "婚礼频道"),
  ident_go: c("片头 · 两行大字（用｜分行）", "前方高能｜婚礼即将开始"),
  w1: c("欢迎 · 第 1 句（｜分两行）", "尊敬的各位｜来宾朋友们"),
  w2: c("欢迎 · 第 2 句", "大家好"),
  w3: c("欢迎 · 第 3 句", "欢迎光临｜我们的婚礼"),
  w4: c("欢迎 · 第 4 句", "为了不耽误｜大家干饭"),
  w5: c("欢迎 · 第 5 句", "请大家｜尽快入座"),
  g1: c("笑点 · 指向观众", "说的就是你｜还没坐好的"),
  w6: c("欢迎 · 第 6 句", "我们的婚礼｜即将开始"),
  w7: c("拍照 · 第 1 句", "请拿出手机"),
  snap: c("拍照 · 咔嚓（照片下方）", "咔嚓！拍好啦"),
  w8: c("拍照 · 第 2 句", "记得要帮我们｜美颜哦"),
  w9: c("掌声 · 第 1 句", "当你开心｜感动的时候"),
  w10: c("掌声 · 第 2 句", "请为我们｜鼓掌欢呼"),
  g2: c("笑点 · 掌声", "掌声在哪里？"),
  w11: c("须知 · 第 1 句", "请暂时放下"),
  w12: c("须知 · 左右两个词（｜分隔）", "您的工作｜您的烦恼"),
  w13: c("须知 · 左右两个词", "只需记得｜高高兴兴"),
  w14: c("须知 · 左右两个词", "吃好｜喝好"),
  g3: c("笑点 · 美食雨", "放开吃｜别客气"),
  w15: c("须知 · 劝酒", "手下留情｜别灌新郎太多酒哦"),
  w16: c("须知 · 不然", "不然他会……"),
  g4: c("笑点 · 新郎喝多（右侧两行）", "当场表演｜醉拳"),
  c0: c("倒计时 · 开始", "现在婚礼｜进入倒计时"),
  x1: c("倒计时 · 快闪 1（红）", "小哥哥"),
  x2: c("倒计时 · 快闪 2（白）", "小姐姐"),
  x3: c("倒计时 · 快闪 3（红）", "亲朋好友们"),
  x4: c("倒计时 · 快闪 4（白）", "接下来"),
  x5: c("倒计时 · 快闪 5（红）", "这是一个"),
  x6: c("倒计时 · 快闪 6（白）", "重要时刻"),
  x7: c("倒计时 · 快闪 7（红）", "请你们"),
  x8: c("倒计时 · 快闪 8（白）", "千万别眨眼"),
  hl: c("倒计时 · 名字之后（白）", "高光时刻"),
  gi1: c("新郎 · 第 1 句", "首先介绍"),
  gi2: c("新郎 · 第 2 句", "今天的新郎"),
  gi3: c("新郎 · 夸奖 1（左右两个词）", "品貌｜非凡"),
  gi4: c("新郎 · 夸奖 2", "玉树｜临风"),
  gi5: c("新郎 · 夸奖 3", "一表｜人才"),
  gi6: c("新郎 · 夸奖 4", "才华｜横溢"),
  gcall: c("新郎 · 有请", "掌声有请｜新郎登场"),
  gfake: c("新郎 · 搞错人（三句：小时候照片 → 定格 → 倒带）", "就是他！｜等等……搞错了！｜再来一次"),
  greal: c("新郎 · 真正登场", "这才是｜新郎"),
  groom_role: c("新郎 · 名牌称呼", "新郎"),
  bi1: c("新娘 · 第 1 句", "接下来介绍"),
  bi2: c("新娘 · 第 2 句", "美丽的新娘"),
  bi3: c("新娘 · 夸奖 1（左右两个词）", "美丽｜大方"),
  bi4: c("新娘 · 夸奖 2", "貌美｜如花"),
  bi5: c("新娘 · 夸奖 3", "气质｜端庄"),
  bi6: c("新娘 · 夸奖 4", "一笑｜倾城"),
  bi7: c("新娘 · 夸奖 5", "再笑｜倾国"),
  bname: c("新娘 · 名字（{bride} 自动换成新娘名字）", "新娘｜{bride}"),
  bcall: c("新娘 · 有请", "掌声有请｜新娘登场"),
  bfake: c("新娘 · 放大镜（两句）", "嗯……这是小时候？｜从小就是美人胚子"),
  bride_role: c("新娘 · 名牌称呼", "新娘"),
  coupleA_cap: c("新郎之后的合照 · 字", "天生一对"),
  coupleB_cap: c("新娘之后的合照 · 字", "郎才女貌"),
  witness: c("见证（两句）", "下面一起见证｜我们的幸福时刻吧"),
  mag_title: c("婚纱照杂志 · 手写标题（三页用｜分隔）", "Love & Marriage｜Sweet Moment｜Forever Love"),
  mag_cap: c("婚纱照杂志 · 底部大字（三页用｜分隔）", "HAPPY MOMENT｜WE ARE MARRIED｜LOVE FOREVER"),
  count: c("婚纱照之间 · 倒计时标题", "婚礼进入倒计时"),
  finale: c("结尾 · 感谢", "感谢见证我们的幸福时刻"),
};

type Props = TemplateProps<typeof showtimeSlots> & { beatGrid?: BeatGrid | null };

const fill = (s: string, groom: string, bride: string) => s.replaceAll("{groom}", groom).replaceAll("{bride}", bride);

// ---------------------------------------------------------------- sound effects on the plan
const FX = (s: string) => `sfx/showtime/${s}.ogg`;
type Hit = [beat: number, sound: string, volume: number, seconds?: number];
function soundPlan(): Hit[] {
  const hits: Hit[] = [];
  for (const k of CARDS) {
    if (k.kind === "gold" || k.kind === "split" || k.kind === "white") hits.push([k.b, k.kind === "white" ? "whoosh" : "pop", k.kind === "white" ? 0.32 : 0.28]);
    if (k.kind === "gag") {
      if (k.v === "point") hits.push([k.b, "boing", 0.55]);
      if (k.v === "applause") hits.push([k.b + 0.25, "applause", 0.6]);
      if (k.v === "food") [0, 0.5, 1, 1.5].forEach((d) => hits.push([k.b + d, "pop", 0.4]));
      if (k.v === "drunk") hits.push([k.b, "dizzy", 0.7]);
    }
    if (k.kind === "snap") hits.push([k.b + 1, "shutter", 0.9]);
    if (k.kind === "names" || k.kind === "date") hits.push([k.b, "ding", 0.45]);
    if (k.kind === "hero") hits.push([k.b, "sparkle", 0.6], [k.b + 1, "applause", 0.45]);
    if (k.kind === "photo") hits.push([k.b, "shutter", 0.5]);
    if (k.kind === "magazine" || k.kind === "slide") hits.push([k.b - 0.25, "whoosh", k.kind === "slide" ? 0.2 : 0.35]);
    if (k.kind === "sparkle") hits.push([k.b, "sparkle", 0.6]);
    if (k.kind === "finale") hits.push([k.b, "sparkle", 0.6], [k.b + 2, "applause", 0.5], [TOTAL_BEATS - 8, "ding", 0.5]);
  }
  const gf = CARDS.find((k) => k.id === "gfake")!;
  const bf = CARDS.find((k) => k.id === "bfake")!;
  const gc = CARDS.find((k) => k.id === "gcall")!;
  const bc = CARDS.find((k) => k.id === "bcall")!;
  hits.push([gc.b, "drumroll", 0.7], [gf.b, "sparkle", 0.5], [gf.b + 4, "scratch", 0.95], [gf.b + 6, "rewind", 0.6]);
  hits.push([bc.b, "drumroll", 0.7], [bf.b, "boing", 0.45], [bf.b + 4, "sparkle", 0.6]);
  return hits;
}
const HITS = soundPlan();

// ---------------------------------------------------------------- the film
const FALLBACK_BPM = BPM;

const ShowtimeFilm: React.FC<Props> = ({ couple, photos, copy: rawCopy, music, beatGrid }) => {
  const B = useMemo(() => beatClock(beatGrid, FALLBACK_BPM), [beatGrid]);
  const copy = useMemo(() => Object.fromEntries(Object.entries(rawCopy).map(([k, v]) => [k, fill(v, couple.groom, couple.bride)])), [rawCopy, couple.groom, couple.bride]);
  const names = `${couple.groom} & ${couple.bride}`;
  const date = formatDate(couple.date, "dot");
  const titles = copy.mag_title.split("｜");
  const caps = copy.mag_cap.split("｜");
  const scene = (k: Card) => {
    const ctx: Ctx = { B, b0: k.b, b1: k.b + k.len, copy };
    const cue = { groom: k.groom, bride: k.bride };
    const text = k.text ? copy[k.text] ?? "" : "";
    switch (k.kind) {
      case "ident":
        return <Ident c={ctx} names={names} date={date} />;
      case "gold":
        return <GoldCard c={ctx} text={text} cue={cue} entrance={k.id.startsWith("x") || k.id === "c0" ? "zoom" : k.id === "w2" ? "drop" : "pop"} />;
      case "split":
        return <SplitCard c={ctx} text={text} cue={cue} />;
      case "white":
        return <WhiteCard c={ctx} text={text} cue={cue} />;
      case "number":
        return <NumberCard c={ctx} n={Number(k.v)} cue={cue} />;
      case "date":
        return <DateCard c={ctx} iso={couple.date} cue={cue} />;
      case "names":
        return <NamesCard c={ctx} groom={couple.groom} bride={couple.bride} cue={cue} />;
      case "snap":
        return <SnapCard c={ctx} id={photos.couple1} text={text} />;
      case "gag":
        return <GagCard c={ctx} text={text} kind={String(k.v)} cue={cue} />;
      case "fake":
        return <FakeCard c={ctx} id={k.v === "groom" ? photos.groomKid : photos.brideKid} text={text} who={k.v === "groom" ? "groom" : "bride"} />;
      case "hero":
        return k.v === "groom" ? (
          <HeroCard c={ctx} id={photos.groomHero} role={copy.groom_role} name={couple.groom} cue={{ groom: "cheer", bride: "clap" }} />
        ) : (
          <HeroCard c={ctx} id={photos.brideHero} role={copy.bride_role} name={couple.bride} cue={{ groom: "clap", bride: "cheer" }} />
        );
      case "photo":
        return k.v === "coupleA" ? <PhotoCard c={ctx} id={photos.coupleA} caption={copy.coupleA_cap} /> : <PhotoCard c={ctx} id={photos.coupleB} caption={copy.coupleB_cap} />;
      case "witness":
        return <WitnessCard c={ctx} text={text} cue={cue} />;
      case "magazine": {
        const i = Number(k.v);
        const ids = [0, 1, 2].map((j) => photos.mag[(i * 3 + j) % photos.mag.length]);
        return <MagazineCard c={ctx} ids={ids} title={titles[i] ?? titles[0] ?? ""} caption={caps[i] ?? caps[0] ?? ""} names={names} date={date} k={i} />;
      }
      case "sparkle":
        return <SparkleTitle c={ctx} text={text} cue={cue} />;
      case "slide": {
        const i = Number(k.v);
        return <SlideCard c={ctx} id={photos.slides[i % photos.slides.length]} i={i} cue={cue} />;
      }
      case "finale":
        return <FinaleCard c={ctx} id={photos.finale} text={text} names={names} date={date} cue={cue} />;
    }
  };
  const cues: Cue[] = music.src ? HITS.map(([b, s, v, len]) => ({ at: B(b), src: FX(s), volume: v, seconds: len })) : [];
  const end = B(TOTAL_BEATS) + 2.5;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {CARDS.map((k) => (
        <Window key={k.id} from={k.b === 0 ? 0 : B(k.b)} to={k.b + k.len >= TOTAL_BEATS ? end + 1 : B(k.b + k.len)}>
          {scene(k)}
        </Window>
      ))}
      <EdgeFade inSec={0.2} outSec={1.8} />
      <Music music={music} />
      <Cues cues={cues} />
    </AbsoluteFill>
  );
};

const beatGridSchema = z.object({ beats: z.array(z.number()) }).nullable().optional();
const lengthOf = (grid: BeatGrid | null | undefined) => beatClock(grid, FALLBACK_BPM)(TOTAL_BEATS) + 2.5;

const definition = defineTemplate(
  {
    id: "VVV-Showtime",
    code: "Showtime",
    title: "喜剧开场·大屏卡点版",
    slots: showtimeSlots,
    seconds: (props) => lengthOf((props as Props).beatGrid),
    component: ShowtimeFilm as React.FC<TemplateProps<typeof showtimeSlots>>,
    fps: 30,
    copy: COPY,
    poster: 152,
    short: { background: "#B5101F", ink: "#FFF6E4", accent: "#FFD36B", titleFont: "heiti", bodyFont: "heiti", frame: "print" },
    music: { src: "music/showtime-party.ogg", volume: 0.9, trimBeforeSec: 0, fadeInSec: 0.05, fadeOutSec: 2.5 },
  },
  { schema: { beatGrid: beatGridSchema }, defaults: { beatGrid: null } },
);

/** Read the beat map once before rendering, so every cut follows the music. */
const calculateMetadata: CalculateMetadataFunction<any> = async ({ props }) => {
  const parsed = definition.schema.parse(props) as Props;
  const grid = await loadBeatGrid(parsed.music);
  return { durationInFrames: Math.ceil(lengthOf(grid) * parsed.fps), props: { ...parsed, beatGrid: grid } };
};

export const showtime = { ...definition, calculateMetadata };
