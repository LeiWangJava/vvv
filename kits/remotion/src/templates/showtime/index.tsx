import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { Cues, Music, type Cue } from "../../components/Music";
import { EdgeFade } from "../../components/Overlays";
import { defineTemplate, type TemplateProps } from "../../core/template";
import { CARDS, TOTAL_SECONDS, beatOf, type Card } from "./plan";
import {
  BalloonsCard, BarsCard, BrideLineCard, BurstCard, ClipCard, DateCard, FinaleCard, FrameCard, GlitterCard, GoldCard, HeartsCard,
  MagazineCard, MarqueeCard, NamesCard, NumberCard, PhotoCard, SplitCard, SpreadCard, WhiteCard, Window, parseClip, type Ctx,
} from "./scenes";

/**
 * Showtime · 喜剧开场 · 大屏卡点版 — the big-screen comic opening for the wedding banquet, card for card
 * and second for second as in the owner's reference film (3 min 17 s): film-clip slots, then the
 * cartoon bride and groom welcome the guests in heavy gold type, set the house rules, count down with
 * red and white flash cards, introduce the groom and the bride (each followed by a film clip), then the
 * magazine pages, the wedding photos in white frames and the round-frame thank-you.
 *
 * The film clips are slots (copy keys clip_*): each project puts its own video files in public/clips/
 * and names them there. The template's own music is a placeholder; a project replaces it.
 */

export const showtimeSlots = {
  couple1: {},
  coupleA: {},
  coupleB: { count: 2, min: 1, max: 2, independent: true },
  mag: { count: 7, min: 3, max: 7, independent: true },
  pairs: { count: 10, min: 2, max: 10, independent: true },
  singles: { count: 5, min: 1, max: 5, independent: true },
  finale: {},
} as const;

const c = (label: string, text: string) => ({ label, text });
const clipLabel = (id: string, name: string) => {
  const k = CARDS.find((x) => x.id === id)!;
  return c(`电影片段 · ${name}（${k.a}–${k.b} 秒，约 ${(k.b - k.a).toFixed(1)} 秒；填 clips/文件名.mp4，可加 @起始秒 和 #sound 用片段原声）`, "");
};
export const COPY = {
  clip_open: clipLabel("clip_open", "开场"),
  w1: c("欢迎 · 第 1 句（｜分两行）", "尊敬的各位｜来宾朋友们"),
  w2: c("欢迎 · 第 2 句", "大家好"),
  w3: c("欢迎 · 第 3 句", "欢迎光临｜我们的婚礼"),
  w4: c("欢迎 · 第 4 句", "为了不耽误｜大家搂席"),
  w5: c("欢迎 · 第 5 句", "请大家｜移步上座"),
  clip_1: clipLabel("clip_1", "第 1 段"),
  w6: c("开始 · 第 1 句", "我们的婚礼｜即将开始"),
  w7: c("拍照 · 第 1 句", "请拿出手机使劲拍"),
  w8: c("拍照 · 第 2 句", "记得要帮我们美颜哦"),
  w9: c("掌声 · 第 1 句", "当你开心感动时"),
  w10: c("掌声 · 第 2 句", "请为｜我们鼓掌"),
  clip_2: clipLabel("clip_2", "第 2 段"),
  w11: c("须知 · 散开的词（｜分隔）", "请｜暂时｜忘记"),
  w12: c("须知 · 左右两个词（｜分隔）", "您的工作｜您的烦恼"),
  w13: c("须知 · 左右两个词", "只需｜记得"),
  w14: c("须知 · 左右两个词", "高高｜兴兴"),
  w15: c("须知 · 左右两个词", "吃好｜喝好"),
  clip_3: clipLabel("clip_3", "第 3 段"),
  w16: c("劝酒 · 第 1 句", "手下留情｜别灌新郎太多酒哦"),
  w17: c("劝酒 · 第 2 句", "不然他会"),
  clip_4: clipLabel("clip_4", "第 4 段（不然他会……）"),
  c0: c("倒计时 · 开始", "现在婚礼进入倒计时"),
  x1: c("快闪 1（红）", "小哥哥"),
  x2: c("快闪 2（白）", "小姐姐"),
  x3: c("快闪 3（红）", "亲朋好友们"),
  x4: c("快闪 4（白）", "大家好"),
  x5: c("快闪 5（白）", "你们的"),
  x6: c("快闪 6（红）", "准备好了吗"),
  x7: c("快闪 7（白）", "这是一个"),
  x8: c("快闪 8（红）", "充满欢乐的"),
  x9: c("快闪 9（白）", "婚礼现场"),
  x10: c("快闪 10（红）", "请你们"),
  x11: c("快闪 11（白）", "坐好｜扶稳"),
  x12: c("快闪 12（红）", "千万别眨眼"),
  x13: c("日期之前", "今天是"),
  x14: c("名字之后 · 1（白）", "婚礼现场"),
  x15: c("名字之后 · 2（红）", "婚礼现场"),
  x16: c("名字之后 · 3（白）", "高光时刻"),
  gi1: c("新郎 · 第 1 句（左右两个词）", "首先｜介绍"),
  gi2: c("新郎 · 夸奖 1", "品貌｜非凡"),
  gi3: c("新郎 · 夸奖 2", "英姿｜勃发"),
  gi4: c("新郎 · 夸奖 3", "玉树｜临风"),
  gi5: c("新郎 · 夸奖 4", "英俊｜帅气"),
  gi6: c("新郎 · 滚动大字", "一表人才于一体"),
  clip_groom: clipLabel("clip_groom", "新郎登场"),
  g1: c("新郎 · 搞错了", "搞错了再来"),
  g2: c("新郎 · 真正的新郎", "这才是新郎"),
  clip_5: clipLabel("clip_5", "第 5 段"),
  bi1: c("新娘 · 第 1 句", "接下来介绍"),
  bi2: c("新娘 · 夸奖 1（左右两个词）", "美丽｜大方"),
  bi3: c("新娘 · 夸奖 2", "貌美｜如花"),
  bi4: c("新娘 · 夸奖 3", "气质｜端庄"),
  bi5: c("新娘 · 夸奖 4", "一笑｜倾城"),
  bi6: c("新娘 · 夸奖 5", "再笑｜倾国"),
  bi7: c("新娘 · 名字（{bride} 自动换成新娘名字）", "新娘 {bride}"),
  clip_bride: clipLabel("clip_bride", "新娘登场"),
  clip_6: clipLabel("clip_6", "第 6 段"),
  h1: c("见证 · 第 1 句", "下面一起见证"),
  h2: c("见证 · 第 2 句", "我们的幸福时刻吧"),
  mag_script: c("婚纱照杂志 · 手写标题", "Love & Marriage"),
  mag_cap: c("婚纱照杂志 · 底部大字（换图前｜换图后）", "HAPPY MOMENT｜WE ARE MARRIED"),
  mag_header: c("婚纱照杂志 · 第二页顶部的字", "在你身边 你在身边 日日又年年"),
  count: c("婚纱照之间 · 标题", "婚礼进入倒计时"),
  finale: c("结尾 · 感谢", "感谢见证我们的幸福时刻"),
  sfx: c("模板音效（开 / 关；用整轨原配乐时填 关）", "开"),
};

type Props = TemplateProps<typeof showtimeSlots>;

const fill = (s: string, groom: string, bride: string) => s.replaceAll("{groom}", groom).replaceAll("{bride}", bride);
const list = (x: string | string[]) => (Array.isArray(x) ? x : [x]);

// ---------------------------------------------------------------- light sound effects for the placeholder track
const FX = (s: string) => `sfx/showtime/${s}.ogg`;
function soundPlan(): Cue[] {
  const hits: Cue[] = [];
  for (const k of CARDS) {
    if (k.kind === "gold" || k.kind === "split") hits.push({ at: k.a, src: FX("pop"), volume: 0.26 });
    if (k.kind === "white") hits.push({ at: k.a, src: FX("whoosh"), volume: 0.3 });
    if (k.kind === "number" || k.kind === "date" || k.kind === "names") hits.push({ at: k.a, src: FX("ding"), volume: 0.4 });
    if (k.kind === "photo" || k.kind === "pair" || k.kind === "single") hits.push({ at: k.a, src: FX("shutter"), volume: 0.4 });
    if (k.kind === "burst" || k.kind === "glitter" || k.kind === "finale") hits.push({ at: k.a, src: FX("sparkle"), volume: 0.55 });
  }
  [67.85, 68.85, 69.85].forEach((at) => hits.push({ at, src: FX("pop"), volume: 0.45 }));
  hits.push({ at: 175.5, src: FX("applause"), volume: 0.45 });
  return hits;
}
const HITS = soundPlan();

// ---------------------------------------------------------------- the film
/** cards whose line sits across the top with the couple together below it */
const BELOW = new Set(["w7", "w8", "w16", "w17"]);
const ShowtimeFilm: React.FC<Props> = ({ couple, photos, copy: rawCopy, music }) => {
  const copy = useMemo(() => Object.fromEntries(Object.entries(rawCopy).map(([k, v]) => [k, fill(v, couple.groom, couple.bride)])), [rawCopy, couple.groom, couple.bride]);
  const coupleB = list(photos.coupleB);
  const pairs = list(photos.pairs);
  const singles = list(photos.singles);
  const scene = (k: Card) => {
    const ctx: Ctx = { t0: k.a, t1: k.b, copy, beat: beatOf };
    const cue = { groom: k.groom, bride: k.bride, layout: BELOW.has(k.id) ? ("below" as const) : undefined };
    const text = k.text && k.kind !== "number" ? copy[k.text] ?? "" : "";
    switch (k.kind) {
      case "clip":
        return <ClipCard c={ctx} clip={parseClip(copy[k.id])} label={(COPY as Record<string, { label: string }>)[k.id]?.label.split("（")[0] ?? k.id} />;
      case "bars":
        return <BarsCard />;
      case "gold":
        if (k.id === "c0") return <BrideLineCard c={ctx} text={text} />;
        return <GoldCard c={ctx} text={text} cue={cue} entrance={k.v === "flash" ? "zoom" : "type"} />;
      case "split":
        return <SplitCard c={ctx} text={text} cue={cue} />;
      case "spread":
        return <SpreadCard c={ctx} text={text} cue={cue} />;
      case "white":
        return <WhiteCard c={ctx} text={text} cue={cue} />;
      case "number":
        return <NumberCard c={ctx} n={Number(k.v)} cue={cue} white={k.text === "white"} />;
      case "balloons":
        return <BalloonsCard c={ctx} />;
      case "date":
        return <DateCard c={ctx} iso={couple.date} />;
      case "names":
        return <NamesCard c={ctx} groom={couple.groom} bride={couple.bride} cue={cue} />;
      case "marquee":
        return <MarqueeCard c={ctx} text={text} cue={cue} />;
      case "photo": {
        const id = k.v === "couple1" ? photos.couple1 : k.v === "coupleA" ? photos.coupleA : coupleB[k.v === "coupleB1" ? 1 % coupleB.length : 0];
        return <PhotoCard c={ctx} id={id} />;
      }
      case "hearts":
        return <HeartsCard c={ctx} text={text} />;
      case "glitter":
        return <GlitterCard c={ctx} text={text} cue={cue} />;
      case "magazine":
        return <MagazineCard c={ctx} ids={list(photos.mag)} captions={copy.mag_cap.split("｜")} header={copy.mag_header} script={copy.mag_script} />;
      case "burst":
        return <BurstCard c={ctx} text={text} />;
      case "pair": {
        const i = Number(k.v) * 2;
        return <FrameCard c={ctx} ids={[pairs[i % pairs.length], pairs[(i + 1) % pairs.length]]} />;
      }
      case "single":
        return <FrameCard c={ctx} ids={[singles[Number(k.v) % singles.length]]} />;
      case "finale":
        return <FinaleCard c={ctx} id={photos.finale} text={text} />;
    }
  };
  const sfxOn = !/^(关|off|0|no)$/i.test((copy.sfx ?? "").trim());
  const cues: Cue[] = music.src && sfxOn ? HITS : [];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {CARDS.map((k) => (
        <Window key={k.id} from={k.a} to={k.b >= TOTAL_SECONDS ? TOTAL_SECONDS + 1 : k.b}>
          {scene(k)}
        </Window>
      ))}
      <EdgeFade inSec={0.05} outSec={1.5} />
      <Music music={music} />
      <Cues cues={cues} />
    </AbsoluteFill>
  );
};

export const showtime = defineTemplate({
  id: "VVV-Showtime",
  code: "Showtime",
  title: "喜剧开场·大屏卡点版",
  slots: showtimeSlots,
  seconds: () => TOTAL_SECONDS,
  component: ShowtimeFilm as React.FC<TemplateProps<typeof showtimeSlots>>,
  fps: 30,
  copy: COPY,
  poster: 26,
  short: { background: "#B5101F", ink: "#FFF6E4", accent: "#FFD36B", titleFont: "heiti", bodyFont: "heiti", frame: "print" },
  music: { src: "music/showtime-party.ogg", volume: 0.9, trimBeforeSec: 0, fadeInSec: 0, fadeOutSec: 2 },
});
