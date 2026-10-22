import React, { useContext, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { AudioGain, Cues, Track, type Cue, type TrackSpec } from "../../components/Music";
import { beatsPathFor, chainBeatMaps, makeWarp, mergeAnchors, useBeatMap, type Anchor, type Hit } from "../../core/beats";
import { setCopyFor } from "../../core/copy";
import { coupleNames, formatDate } from "../../core/couple";
import { comedySlots as slots } from "./slots";
import { defineTemplate, type TemplateDef, type TemplateProps } from "../../core/template";
import { Film, type FilmSegment, type FilmTransition } from "../../engine/Film";
import { gallerySegments, placeShots, planShots, type GallerySkin, type Palette } from "../../engine/Gallery";
import { GoldCorners, RedBackdrop } from "../../effects/papercut-frame";
import voTiming from "../../../public/vo/comedy/timing.json";
import hits from "./hits.json";
import {
  Arrival,
  ArriveEnd,
  BA,
  BannerCaption,
  BB,
  BrideCall,
  BrideHero,
  BrideKid,
  BrideLegend,
  BrideProof,
  COUNT_FROM,
  Countdown,
  Finale,
  Flash,
  G,
  GOLD,
  GroomCall,
  GroomHero,
  GroomWrong,
  Ident,
  K,
  L,
  LoveLoading,
  NEXT_FROM,
  NextUp,
  OffsetFill,
  parseClip,
  SideBlessings,
  R,
  Rewind,
  RuleCard,
  RuleGag,
  RULES_FROM,
  RulesEnd,
  RulesTitle,
  START_B,
  Thanks,
  TitleCard,
  Welcome,
  type Ctx,
} from "./scenes";

/**
 * Comedy · 喜剧开场 · 婚礼即将开始 — a comic warm-up opening in the host's voice (see scenes.tsx),
 * rebuilt from the owner's original wedding film.
 * Structure after the classic Chinese "funny wedding opener": welcome in rhyme, thanks, house rules,
 * a wrong-clip gag for the groom and for the bride, the love story stuck at 99%, the wedding photos,
 * and a countdown that waits for the guests' applause. No film clips are bundled; every gag beat can
 * take one (clip_* copy keys) — the studio is responsible for the rights to what it puts there.
 */

const DESIGN_SECONDS = 212;
const GALLERY_FROM = 2;
const GALLERY_TO = COUNT_FROM;
// When in Love — Mixkit, download-only (public/music/sources.json); played after the comedy track
const TRACK_B = { src: "music/mixkit-when-in-love.mp3", seconds: 100.3, volume: 0.75 };

type Props = TemplateProps<typeof slots>;

const GALLERY_SETS = ["s4", "s2", "s6", "s3", "s5", "s8", "c2", "c1", "c3"];

const clipCopy = (key: string, what: string) => ({
  [key]: { label: `${what} · 视频片段（可空；public/ 下的路径，可加 @起始秒，如 clips/a.mp4@12.5；版权需自行确认）`, text: "" },
});

export const COPY = {
  studio: { label: "片头 · 出品方（恶搞）", text: "幸福影业" },
  studio_en: { label: "片头 · 英文", text: "XINGFU  PICTURES" },
  presents: { label: "片头 · 本片由", text: "本片由" },
  starring: { label: "片头 · 倾情主演", text: "倾情主演" },
  title: { label: "开场 · 大字", text: "婚礼即将开始" },
  welcome_1: { label: "欢迎 · 上联（右侧对联，7 字左右）", text: "喜结连理佳宴摆" },
  welcome_2: { label: "欢迎 · 下联（左侧对联）", text: "满堂亲友贺喜来" },
  welcome_3: { label: "欢迎 · 第 3 句（用｜分两行）", text: "各位亲友｜各位嘉宾" },
  welcome_4: { label: "欢迎 · 第 4 句（配囍字和新人名字）", text: "今天他俩结婚啦！" },
  welcome_5: { label: "欢迎 · 第 5 句", text: "欢迎欢迎  热烈欢迎！" },
  welcome_6: { label: "欢迎 · 第 6 句（用｜分两行）", text: "热热闹闹｜喜气洋洋" },
  thanks: { label: "致谢 · 大字", text: "非常感谢你们" },
  arrive_1: { label: "来宾 · 第 1 句", text: "有跑着来的" },
  arrive_2: { label: "来宾 · 第 2 句", text: "有开车来的" },
  arrive_3: { label: "来宾 · 第 3 句", text: "还有坐飞机来的" },
  arrive_end: { label: "来宾 · 结尾", text: "一路辛苦啦！" },
  rules_title: { label: "宾客须知 · 标题", text: "宾客须知" },
  rules_stamp: { label: "宾客须知 · 印章", text: "必读" },
  rule_1: { label: "须知 · 第一条（用｜分两行）", text: "请暂时放下｜工作和烦恼" },
  gag_1: { label: "须知 · 第一条 · 笑点", text: "统统扔掉！" },
  rule_2: { label: "须知 · 第二条", text: "今天｜一定要笑哦" },
  gag_2: { label: "须知 · 第二条 · 笑点", text: "笑一笑，菜上得更快" },
  rule_3: { label: "须知 · 第三条", text: "菜管够｜请尽情享用" },
  gag_3: { label: "须知 · 第三条 · 笑点", text: "放开吃，别客气！" },
  rule_4: { label: "须知 · 第四条", text: "喝酒不开车｜开车不喝酒" },
  gag_4: { label: "须知 · 第四条 · 笑点", text: "回家路上  平平安安" },
  rule_5: { label: "须知 · 第五条", text: "掌声和尖叫｜请留给新人" },
  gag_5: { label: "须知 · 第五条 · 笑点", text: "现在就可以练习一下！" },
  rules_end: { label: "须知 · 结尾", text: "以上，感谢配合" },
  groom_call: { label: "新郎 · 有请（用｜分两行）", text: "有请今天的｜男主角" },
  groom_wrong_a: { label: "新郎 · 放错片段 · 第 1 句", text: "就是他！" },
  groom_wrong_b: { label: "新郎 · 放错片段 · 第 2 句", text: "等等……放错了" },
  groom_wrong_c: { label: "新郎 · 放错片段 · 第 3 句（{age} 换成照片年龄）", text: "这是 {age} 岁的他" },
  groom_retry: { label: "新郎 · 倒带", text: "重来！" },
  groom_praise: { label: "新郎 · 三句夸奖（用｜分隔）", text: "阳光帅气｜一身正气｜朝气蓬勃" },
  groom_role: { label: "新郎 · 名牌称呼", text: "新郎" },
  bride_call: { label: "新娘 · 有请（用｜分两行）", text: "有请今天的｜女主角" },
  bride_legend: { label: "新娘 · 传说", text: "传说她｜艳压群芳" },
  bride_proof: { label: "新娘 · 不信您瞧", text: "不信您瞧" },
  bride_kid_a: { label: "新娘 · 放大镜 · 第 1 句", text: "嗯……" },
  bride_kid_b: { label: "新娘 · 放大镜 · 第 2 句", text: "从小就是美人胚子" },
  bride_wow: { label: "新娘 · 登场", text: "惊艳全场！" },
  bride_role: { label: "新娘 · 名牌称呼", text: "新娘" },
  love_title: { label: "恋爱进度条 · 标题", text: "恋爱加载中……" },
  love_steps: { label: "恋爱进度条 · 四个阶段（用｜分隔）", text: "相遇｜约会｜一起生活｜一起看世界" },
  love_stuck: { label: "恋爱进度条 · 卡住", text: "99%……卡住了？" },
  love_done: { label: "恋爱进度条 · 完成", text: "求婚成功  100%" },
  next_a: { label: "婚纱照前 · 第一行", text: "接下来  请欣赏" },
  next_b: { label: "婚纱照前 · 第二行", text: "两位新人的幸福瞬间" },
  gallery_tags: { label: "婚纱照 · 空白处的花字（用｜分隔，轮流使用）", text: "天生一对｜甜度超标｜颜值天花板｜好般配呀｜幸福感满满｜官宣啦" },
  gallery_blessings: { label: "婚纱照 · 竖排祝福语（用｜分隔，轮流使用）", text: "百年好合｜永结同心｜白头偕老｜佳偶天成｜喜结良缘" },
  count_title: { label: "倒计时 · 标题", text: "婚礼仪式倒计时" },
  wait_1: { label: "倒计时 · 打断", text: "等一下！" },
  wait_2: { label: "倒计时 · 第 1 句", text: "还……还不能开始吗？" },
  wait_3: { label: "倒计时 · 第 2 句", text: "还没收到信号" },
  wait_4: { label: "倒计时 · 第 3 句", text: "信号是什么呀？！" },
  wait_5: { label: "倒计时 · 揭晓", text: "信号就是 —— 大家的掌声！" },
  go: { label: "倒计时 · 开", text: "开！" },
  vo: { label: "配音旁白（填 off 关闭）：旁白稿在 vo.json；把有授权的配音按行放到 public/vo/comedy/<key>.mp3，并在同目录 timing.json 里登记 lead/speech 秒数", text: "on" },
  final_a: { label: "结尾 · 第一行", text: "婚礼仪式" },
  final_b: { label: "结尾 · 第二行", text: "现在开始" },
  ...setCopyFor(GALLERY_SETS),
  ...clipCopy("clip_welcome_1", "欢迎第 1 句"),
  ...clipCopy("clip_welcome_2", "欢迎第 2 句"),
  ...clipCopy("clip_welcome_3", "欢迎第 3 句"),
  ...clipCopy("clip_welcome_4", "欢迎第 4 句"),
  ...clipCopy("clip_welcome_5", "欢迎第 5 句"),
  ...clipCopy("clip_welcome_6", "欢迎第 6 句"),
  ...clipCopy("clip_arrive_1", "来宾第 1 句"),
  ...clipCopy("clip_arrive_2", "来宾第 2 句"),
  ...clipCopy("clip_arrive_3", "来宾第 3 句"),
  ...clipCopy("clip_rule_1", "须知第一条笑点"),
  ...clipCopy("clip_rule_2", "须知第二条笑点"),
  ...clipCopy("clip_rule_3", "须知第三条笑点"),
  ...clipCopy("clip_rule_4", "须知第四条笑点"),
  ...clipCopy("clip_rule_5", "须知第五条笑点"),
  ...clipCopy("clip_groom", "新郎「放错片段」"),
  ...clipCopy("clip_bride", "新娘「不信您瞧」"),
  ...clipCopy("clip_signal", "倒计时「等信号」"),
};

/** Where each clip slot plays (design seconds). */
/** [copy key, design start, design end, where the clip's own sound stops (default: the end)] */
const CLIP_SLOTS: [string, number, number, number?][] = [
  ...[0, 1, 2, 3, 4, 5].map((k): [string, number, number] => [`clip_welcome_${k + 1}`, BA(16 + 4 * k), BA(20 + 4 * k)]),
  ...[0, 1, 2].map((k): [string, number, number] => [`clip_arrive_${k + 1}`, BA(44 + 3 * k), BA(47 + 3 * k)]),
  ...[0, 1, 2, 3, 4].map((k): [string, number, number] => [`clip_rule_${k + 1}`, BA(RULES_FROM + 8 + 8 * k), BA(RULES_FROM + 12 + 8 * k)]),
  // the clip freezes on the record scratch, and its sound stops there
  ["clip_groom", G(4), G(9), G(6)],
  ["clip_bride", R(9), R(14)],
  // ends before "the signal is your applause!", which stays ours
  ["clip_signal", K(6), K(14)],
];

/** The comedy's sound: [design seconds, file, volume, seconds to play (default: whole effect)]. */
// Mixkit sound effects, download-only (public/music/sources.json; `npm run music`)
const SFX = (s: string) => `sfx/mixkit-${s}.wav`;
type Hit_ = [number, string, number, number?];
const SOUND: Hit_[] = [
  [BA(0), "sparkle", 0.5],
  [BA(4), "pop", 0.4],
  [BA(5), "boing", 0.55],
  [BA(6), "boing", 0.55],
  [BA(7), "pop", 0.4],
  [BA(8) - 0.12, "whoosh", 0.45],
  [BA(8), "bells", 0.5],
  ...[0, 1, 2, 3, 4, 5].map((k): Hit_ => [BA(16 + 4 * k), "pop", 0.32]),
  [BA(38), "boing", 0.6],
  [BA(40), "bells", 0.45],
  ...[0, 1, 2].map((k): Hit_ => [BA(44 + 3 * k), "whoosh", 0.6]),
  [BA(53), "pop", 0.5],
  [BA(56), "whoosh", 0.4],
  [BA(56) + 1.1, "pop", 0.85],
  ...[0, 1, 2, 3, 4].map((k): Hit_ => [BA(RULES_FROM + 4 + 8 * k), "pop", 0.38]),
  [BA(RULES_FROM + 8) + 0.5, "whoosh", 0.5],
  [BA(RULES_FROM + 8) + 1.3, "pop", 0.5],
  [BA(RULES_FROM + 16) + 0.1, "crowd-laugh", 0.45, 2.6],
  [BA(RULES_FROM + 24), "pop", 0.4],
  [BA(RULES_FROM + 32) + 0.2, "boing", 0.5],
  [BA(RULES_FROM + 40), "applause", 0.5, 2.6],
  [BA(RULES_FROM + 44) + 0.1, "joke-drums", 0.8],
  [G(0), "drum-roll", 0.75, G(4) - G(0)],
  [G(4), "sparkle", 0.6],
  [G(6), "record-scratch", 0.9],
  [G(7.5), "trombone-fail", 0.6],
  [G(9), "whoosh", 0.6],
  [G(10), "sparkle", 0.5],
  [G(11), "pop", 0.7],
  [G(12), "pop", 0.7],
  [G(13), "pop", 0.75],
  [G(14), "boing", 0.55],
  [G(16), "boing", 0.55],
  [G(18), "boing", 0.55],
  [G(20), "cheer", 0.5, 3],
  [R(0), "drum-roll", 0.75, R(4) - R(0)],
  [R(4), "bells", 0.5],
  [R(7), "whoosh", 0.5],
  [R(9) + 0.4, "pop", 0.4],
  [R(9) + 2.5, "pop", 0.5],
  [R(14), "sparkle", 0.7],
  [R(14), "cheer", 0.6, 3],
  [R(20), "pop", 0.5],
  ...[0, 4, 8, 12].map((n): Hit_ => [L(n), "pop", 0.35]),
  [L(16.5), "trombone-fail", 0.6],
  [L(20), "bells", 0.6],
  [L(20), "cheer", 0.5, 2.5],
  [BA(NEXT_FROM), "whoosh", 0.4],
  [BA(NEXT_FROM + 4), "sparkle", 0.5],
  ...[1, 2, 3, 4, 5].map((n): Hit_ => [K(n), "pop", 0.45]),
  [K(6), "record-scratch", 0.9],
  [K(8), "pop", 0.35],
  [K(10), "pop", 0.35],
  [K(12), "boing", 0.5],
  [K(14), "applause", 0.7, 5],
  ...[19, 20, 21].map((n): Hit_ => [K(n), "pop", 0.6]),
  [K(22), "cheer", 0.8, 4],
  [K(22), "sparkle", 0.6],
  [K(23), "bells", 0.6],
  [K(23) + 0.5, "applause", 0.5, 5],
];

/**
 * Variety-show narration: [key, design seconds the speech starts]. The script is vo.json; supply one
 * recording per line as public/vo/comedy/<key>.mp3 and its leading silence and speech length in
 * public/vo/comedy/timing.json ({ "<key>": { "lead": 0.17, "speech": 2.0 } }). Lines without a recording
 * are skipped, so the film runs without narration by default. Each line is trimmed of its leading
 * silence so the first syllable lands on the beat.
 */
const VO: [string, number][] = [
  ["ident", BA(0.5)],
  ["title", BA(8.6)],
  ...[0, 1, 2, 3, 4, 5].map((k): [string, number] => [`welcome_${k + 1}`, BA(16.25 + 4 * k)]),
  ["thanks", BA(40.5)],
  ["arrive_1", BA(44.2)],
  ["arrive_2", BA(47.2)],
  ["arrive_3", BA(50.2)],
  ["arrive_end", BA(53.2)],
  ["rules", BA(56.2)],
  ...[0, 1, 2, 3, 4].flatMap((k): [string, number][] => {
    const t = BA(RULES_FROM + 4.2 + 8 * k);
    const punch = k === 1 ? ([["rule_2_punch", BA(RULES_FROM + 16)]] as [string, number][]) : k === 2 ? ([["rule_3_punch", BA(RULES_FROM + 24)]] as [string, number][]) : [];
    return [[`rule_${k + 1}`, t], ...punch];
  }),
  ["rules_end", BA(RULES_FROM + 44)],
  ["groom_call", G(0.3)],
  ["groom_a", G(4.1)],
  ["groom_b", G(6.3)],
  ["praise_1", G(14.05)],
  ["praise_2", G(16.05)],
  ["praise_3", G(18.05)],
  ["groom_name", G(20.2)],
  ["bride_call", R(0.3)],
  ["bride_legend", R(4.2)],
  ["bride_proof", R(7.2)],
  ["bride_kid_a", R(9) + 0.3],
  ["bride_kid_b", R(9) + 1.5],
  ["bride_wow", R(15)],
  ["bride_name", R(20.2)],
  ["love", L(0.3)],
  ["love_stuck", L(16.6)],
  ["love_done", L(20.2)],
  ["next", BA(NEXT_FROM + 0.4)],
  ...[10, 9, 8, 7, 6].map((v, i): [string, number] => [`count_${v}`, K(1 + i)]),
  ["wait_1", K(6) + 0.15],
  ["wait_2", K(8)],
  ["wait_3", K(10)],
  ["wait_4", K(12)],
  ["wait_5", K(14)],
  ["count_3", K(19)],
  ["count_2", K(20)],
  ["count_1", K(21)],
  ["go", K(22)],
  ["final", K(23.3)],
];
const VO_TIMING = voTiming as Record<string, { lead: number; speech: number }>;
/** music level under the narration (about 8 dB below the voice), and the narration level (leaves headroom) */
const VO_DUCK = 0.16;
const VO_VOLUME = 1.0;
/** film dialogue is mixed low; lift it so it carries in a banquet hall */
const CLIP_GAIN = 2.2;

/** Music drops out for the gags (record scratch, waiting for the signal) and dips when stuck at 99%. */
const DUCKS: [number, number, number][] = [
  [G(6) - 0.03, G(10), 0],
  [L(16), L(20), 0.35],
  [K(6) - 0.03, K(14), 0],
];
const duckAt = (t: number, extra: [number, number, number][]) => {
  let g = 1;
  for (const [a, b, lvl] of [...DUCKS, ...extra]) {
    const inside = Math.min(1, Math.max(0, (t - a) / 0.06), Math.max(0, (b + 0.25 - t) / 0.25));
    if (t >= a && t < b + 0.25) g = Math.min(g, 1 - (1 - lvl) * inside);
  }
  return g;
};

// ---------------------------------------------------------------- the story part
type SegDef = [string, number, number, (c: Ctx) => React.ReactNode];
const story = (c: Ctx): SegDef[] => [
  ["ident", 0, BA(8), (x) => <Ident c={x} />],
  ["title", BA(8), BA(16), (x) => <TitleCard c={x} />],
  ...[0, 1, 2, 3, 4, 5].map((k): SegDef => [`welcome${k}`, BA(16 + 4 * k), BA(20 + 4 * k), (x) => <Welcome c={x} k={k} />]),
  ["thanks", BA(40), BA(44), (x) => <Thanks c={x} />],
  ...[0, 1, 2].map((k): SegDef => [`arrive${k}`, BA(44 + 3 * k), BA(47 + 3 * k), (x) => <Arrival c={x} k={k} />]),
  ["arriveEnd", BA(53), BA(56), (x) => <ArriveEnd c={x} />],
  ["rules", BA(RULES_FROM), BA(RULES_FROM + 4), (x) => <RulesTitle c={x} />],
  ...[0, 1, 2, 3, 4].flatMap((k): SegDef[] => [
    [`rule${k}`, BA(RULES_FROM + 4 + 8 * k), BA(RULES_FROM + 8 + 8 * k), (x) => <RuleCard c={x} k={k} />],
    [`gag${k}`, BA(RULES_FROM + 8 + 8 * k), BA(RULES_FROM + 12 + 8 * k), (x) => <RuleGag c={x} k={k} />],
  ]),
  ["rulesEnd", BA(RULES_FROM + 44), G(0), (x) => <RulesEnd c={x} />],
  ["groomCall", G(0), G(4), (x) => <GroomCall c={x} />],
  ["groomWrong", G(4), G(9), (x) => <GroomWrong c={x} />],
  ["rewind", G(9), G(10), (x) => <Rewind c={x} S={G(9)} E={G(10)} id={c.ph.groomKid} text={x.copy.groom_retry} />],
  ["groomHero", G(10), R(0), (x) => <GroomHero c={x} />],
  ["brideCall", R(0), R(4), (x) => <BrideCall c={x} />],
  ["brideLegend", R(4), R(7), (x) => <BrideLegend c={x} />],
  ["brideProof", R(7), R(9), (x) => <BrideProof c={x} />],
  ["brideKid", R(9), R(14), (x) => <BrideKid c={x} />],
  ["brideHero", R(14), L(0), (x) => <BrideHero c={x} />],
  ["love", L(0), BA(NEXT_FROM), (x) => <LoveLoading c={x} />],
  ["next", BA(NEXT_FROM), BB(GALLERY_FROM), (x) => <NextUp c={x} />],
];

/** A few showy transitions between the bits; everything else cuts hard on the beat. */
const SHOWY: { at: number; a: string; b: string; kind: FilmTransition["kind"]; half: number; dir?: "left" | "right" | "up" | "down" }[] = [
  { at: BA(16), a: "title", b: "welcome0", kind: "zoom", half: 0.25 },
  { at: BA(40), a: "welcome5", b: "thanks", kind: "spin", half: 0.3 },
  { at: BA(RULES_FROM), a: "arriveEnd", b: "rules", kind: "push", half: 0.25, dir: "left" },
  { at: G(0), a: "rulesEnd", b: "groomCall", kind: "zoom", half: 0.25 },
  { at: R(0), a: "groomHero", b: "brideCall", kind: "spin", half: 0.3 },
  { at: L(0), a: "brideHero", b: "love", kind: "push", half: 0.25, dir: "up" },
  { at: BA(NEXT_FROM), a: "love", b: "next", kind: "zoom", half: 0.25 },
  { at: BB(GALLERY_FROM), a: "next", b: "g0", kind: "cross", half: 0.6 },
];

// ---------------------------------------------------------------- wedding photos: red pages, gold frames
const skin: GallerySkin = {
  background: (shot) => <RedBackdrop drift={(shot.index % 2 ? -1 : 1) * 40} />,
  margin: 70,
  gap: 44,
  radius: 6,
  frame: { width: 10, color: GOLD, inner: { width: 6, color: "#FFF4DF" } },
  shadow: "0 18px 44px rgba(60,0,0,0.45)",
  kb: 0.05,
  enter: ["pop", "rise", "fade", "reveal"],
  tilt: 1.2,
  // single portraits sit on the red page (with a blessing either side), not over a blurred copy
  soloFill: "background",
  // the offset layout puts its caption into the empty band instead (see filler)
  caption: ({ shot, title, line }) => (shot.kind === "offset" ? null : <BannerCaption title={title} line={line} t0={shot.from} t1={shot.to} right={!shot.flip} />),
  decorate: ({ box, k, shot }) => <GoldCorners key={`${shot.index}-${k}`} x={box.x - 6} y={box.y - 6} w={box.w + 12} h={box.h + 12} size={96} />,
};

/** Upbeat within a set (push, cross), a festive zoom or spin into a new outfit. */
const PALETTE: Palette = {
  within: [
    { kind: "push", seconds: 0.65, dirs: ["left", "right", "up"] },
    { kind: "cross", seconds: 0.7 },
  ],
  between: [
    { kind: "zoom", seconds: 0.8 },
    { kind: "spin", seconds: 0.8 },
  ],
};

/** Hand-set anchors: all of them until `npm run calibrate` has measured hits.json, then only the gentle "beat" ones. */
const MANUAL_ANCHORS: Anchor[] = [
  ...[8, 16, 20, 24, 28, 32, 36, 40, 44, 47, 50, 53, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 176, 180].map((n): Anchor => ({ t: BA(n), kind: "cut" })),
  ...[4, 6, 9, 10, 11, 12, 13, 14, 20].map((n): Anchor => ({ t: G(n), kind: "cut" })),
  ...[0, 4, 7, 9, 14, 20].map((n): Anchor => ({ t: R(n), kind: "cut" })),
  ...[0, 4, 8, 12, 16, 20].map((n): Anchor => ({ t: L(n), kind: "cut" })),
  ...[0, 1, 2, 3, 4, 5, 6, 14, 19, 20, 21, 22, 23].map((n): Anchor => ({ t: K(n), kind: "cut" })),
];
const ANCHORS: Anchor[] = mergeAnchors(hits as Hit[], MANUAL_ANCHORS);

/** Apply 6 dB of headroom to each source before summing; preserve a wrapper's loop fades. */
export const ComedyAudio: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const parentGain = useContext(AudioGain);
  const gain = useMemo(() => (frame: number) => 0.5 * parentGain(frame), [parentGain]);
  return <AudioGain.Provider value={gain}>{children}</AudioGain.Provider>;
};

const ComedyFilm: React.FC<Props> = ({ couple, photos, copy, music }) => {
  const { fps } = useVideoConfig();
  const on = Boolean(music.src);
  const beatsA = useBeatMap(on ? beatsPathFor(music.src) : "");
  const beatsB = useBeatMap(on ? beatsPathFor(TRACK_B.src) : "");
  const A_END = BA(NEXT_FROM + 8);
  const warp = useMemo(() => {
    const beats = chainBeatMaps([
      { map: beatsA, at: -music.trimBeforeSec, from: 0, to: A_END },
      { map: beatsB, at: START_B, from: A_END, to: DESIGN_SECONDS },
    ]);
    return makeWarp(ANCHORS, { beats, designSeconds: DESIGN_SECONDS, musicSeconds: DESIGN_SECONDS });
  }, [beatsA, beatsB, music.trimBeforeSec, A_END]);

  const film = useMemo((): { segments: FilmSegment[]; transitions: FilmTransition[] } => {
    const c: Ctx = {
      ph: photos,
      groom: couple.groom,
      bride: couple.bride,
      names: coupleNames(couple),
      date: formatDate(couple.date, "dot"),
      copy,
      clip: (key) => parseClip(copy[key]),
      frameOf: (t) => Math.round(warp.toMusic(t) * fps),
    };
    const segs: FilmSegment[] = story(c).map(([id, from, to, render]) => ({ id, from, to, render: () => render(c) }));
    const plans = planShots(photos.gallery, { layouts: ["full", "pair", "hero", "trio", "inset", "mixed", "offset", "solo"] });
    const shots = placeShots(plans, BB, GALLERY_FROM, GALLERY_TO, 3, { moves: ["in", "panL", "out", "panR"] });
    const tags = copy.gallery_tags.split("｜").filter(Boolean);
    const blessings = copy.gallery_blessings.split("｜").filter(Boolean);
    const pick = (list: string[], n: number) => list[((n % list.length) + list.length) % list.length] ?? "";
    // number the shots that get page text, so neighbours never repeat a phrase
    const dressed = new Map(shots.filter((s) => s.kind === "offset" || s.kind === "solo" || s.kind === "inset").map((s, i) => [s.index, i]));
    const g = gallerySegments(
      shots,
      {
        ...skin,
        filler: ({ shot, boxes, caption }) => {
          const n = dressed.get(shot.index) ?? 0;
          if (shot.kind === "offset") {
            return (
              <OffsetFill
                boxes={boxes}
                flip={shot.flip}
                t0={shot.from}
                t1={shot.to}
                title={caption?.[0]}
                line={caption?.[1]}
                tag={pick(tags, n)}
                sub={`${coupleNames(couple)}  ·  ${formatDate(couple.date, "dot")}`}
                blessing={pick(blessings, 2 * n)}
              />
            );
          }
          if (shot.kind === "solo" || shot.kind === "inset") {
            return <SideBlessings box={boxes[0]} t0={shot.from} t1={shot.to} right={pick(blessings, 2 * n)} left={pick(blessings, 2 * n + 1)} />;
          }
          return null;
        },
      },
      PALETTE,
      { copy },
    );
    const S = K(0);
    const last = g.segments[g.segments.length - 1];
    last.to = S + 0.45;
    const tail: FilmSegment[] = [
      { id: "countdown", from: S - 0.45, to: K(23), render: () => <Countdown c={c} /> },
      {
        id: "finale",
        from: K(23),
        to: DESIGN_SECONDS + 0.1,
        render: () => (
          <>
            <Finale c={c} S={K(23)} E={DESIGN_SECONDS} />
            <Flash t0={K(23)} d={0.5} />
          </>
        ),
      },
    ];
    // showy transitions need the two bits to overlap
    const all = [...segs, ...g.segments, ...tail];
    const byId = new Map(all.map((s) => [s.id, s]));
    const showy: FilmTransition[] = SHOWY.map((x) => {
      const a = byId.get(x.a)!;
      const b = byId.get(x.b)!;
      a.to = Math.max(a.to, x.at + x.half);
      b.from = Math.min(b.from, x.at - x.half);
      return x.kind === "push"
        ? { kind: "push", from: x.at - x.half, to: x.at + x.half, a: x.a, b: x.b, dir: x.dir ?? "left" }
        : ({ kind: x.kind, from: x.at - x.half, to: x.at + x.half, a: x.a, b: x.b } as FilmTransition);
    });
    return {
      segments: all,
      transitions: [...showy, ...g.transitions, { kind: "zoom", from: S - 0.45, to: S + 0.45, a: last.id, b: "countdown" } as FilmTransition],
    };
  }, [couple, photos, copy, warp, fps]);

  // sound: two tracks one after the other, effects, and the clips' own audio
  const clips = CLIP_SLOTS.map(([key, a, b, end]) => ({ key, a, b: end ?? b, clip: parseClip(copy[key]) })).filter((x) => x.clip);
  // a clip's own sound (unless muted) ducks the music and silences the narrator, so its dialogue carries the joke
  const voiced = clips.filter((x) => !x.clip!.mute);
  const clipDucks = voiced.map(({ a, b }): [number, number, number] => [a, b, 0.15]);
  const swap = (key: string) => (key === "groom_b" && copy.clip_groom ? "groom_b_clip" : key);
  const vo = copy.vo === "off" ? [] : VO.map(([key, t]): [string, number] => [swap(key), t]).filter(([key]) => VO_TIMING[key]);
  const voDucks = vo.map(([key, t]): [number, number, number] => [t - 0.05, t + VO_TIMING[key].speech, VO_DUCK]);
  const duck = (filmSec: number) => duckAt(warp.toDesign(filmSec), [...clipDucks, ...voDucks]);
  const tracks: TrackSpec[] = on
    ? [
        { src: music.src, from: 0, until: warp.toMusic(A_END), volume: music.volume, trimBeforeSec: music.trimBeforeSec, fadeInSec: 0.1, fadeOutSec: 2.2 },
        { src: TRACK_B.src, from: START_B, until: Math.min(DESIGN_SECONDS, START_B + TRACK_B.seconds), volume: TRACK_B.volume, fadeInSec: 0.8, fadeOutSec: 0.6 },
      ]
    : [];
  const cues: Cue[] = on
    ? [
        ...SOUND.map(([t, s, v, len]): Cue => ({ at: warp.toMusic(t), src: SFX(s), volume: v, seconds: len })),
        ...voiced.map(({ a, b, clip }): Cue => ({ at: warp.toMusic(a), src: clip!.src, volume: CLIP_GAIN, trimBeforeSec: clip!.start, seconds: warp.toMusic(b) - warp.toMusic(a) })),
        ...vo.map(([key, t]): Cue => ({ at: warp.toMusic(t), src: `vo/comedy/${key}.mp3`, trimBeforeSec: VO_TIMING[key].lead, volume: VO_VOLUME })),
      ]
    : [];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Film segments={film.segments} transitions={film.transitions} background={() => "#8E0B1C"} toDesign={warp.toDesign} />
      <ComedyAudio>
        {tracks.map((tr) => (
          <Track key={tr.src} track={tr} duck={duck} />
        ))}
        <Cues cues={cues} />
      </ComedyAudio>
    </AbsoluteFill>
  );
};

const DEF = {
  id: "VVV-Comedy",
  code: "Comedy",
  title: "喜剧开场·婚礼即将开始",
  slots,
  seconds: () => DESIGN_SECONDS,
  component: ComedyFilm,
  fps: 30,
  copy: COPY,
  poster: 208.5,
  short: { background: "#B3121F", ink: "#FFF4DF", accent: "#F6C453", titleFont: "brush", bodyFont: "kuaile", frame: "print", sets: ["c2", "c1", "c3"] },
  // Fun and Games — Ahjay Stelino, Mixkit Stock Music Free License, download-only; then TRACK_B
  music: { src: "music/mixkit-fun-and-games.mp3", volume: 0.75, trimBeforeSec: 0, fadeInSec: 0.1, fadeOutSec: 2 },
} satisfies TemplateDef<typeof slots>;
export const comedy = defineTemplate(DEF);
