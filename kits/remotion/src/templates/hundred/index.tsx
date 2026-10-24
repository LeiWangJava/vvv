import { makeGrowthTemplate, type GrowthSlots } from "../growth/film";

/**
 * Hundred: a 100-days (百天) film for the 百日宴. Same film as Growth (growth/film.tsx) with fewer
 * photos, 100-day copy and milestones from pregnancy to day 100. About 1 minute 45 seconds.
 */

export const hundredSlots = {
  film: { count: 6, min: 3, max: 12 },
  milestones: { count: 12, min: 6, max: 24 },
  scatter: { count: 12, min: 6, max: 20, independent: true },
  floating: { count: 12, min: 6, max: 18, independent: true },
  wall: { count: 24, min: 9, max: 36, independent: true },
} as const satisfies GrowthSlots;

export const COPY = {
  title: { label: "片头标题", text: "送给百天的你" },
  subtitle: { label: "标题下的小字", text: "baby's first 100 days" },
  greeting: { label: "开场一句（手写打字）", text: "亲爱的宝贝，百天快乐！" },
  letter: {
    label: "第一封信（每行一句，换行分隔）",
    text: "一百天前，你来到我们身边\n从那天起，日子有了新的意义\n你的每一个哈欠、每一次微笑\n我们都舍不得错过\n谢谢你让我们成为爸爸妈妈",
  },
  letter2: {
    label: "第二封信（第一行先慢慢写出，其余逐行发光出现）",
    text: "你的第一百天，我们都在身边\n愿你吃得香、睡得甜\n愿你被这个世界温柔以待\n愿你健康、快乐、平安地长大\n爸爸妈妈永远爱你",
  },
  ending: { label: "结尾一句", text: "百天快乐" },
};

export const DEMO_CAPTIONS = [
  "终于等到你\n爸爸妈妈又惊又喜", "我们第一次见面了", "你来到了这个世界", "小小的你\n躺在妈妈怀里",
  "第一次洗澡", "睡着的样子\n像个小天使", "满月啦", "会追着声音看了",
  "第一次对我们笑", "小手抓住了爸爸的手指", "会抬头了", "一百天啦",
];

export const hundred = makeGrowthTemplate({
  id: "VVV-Hundred",
  code: "Hundred",
  title: "百天纪念",
  slots: hundredSlots,
  copy: COPY,
  captions: DEMO_CAPTIONS,
  music: { src: "music/mixkit-first-kiss.mp3", volume: 0.85, trimBeforeSec: 0, fadeInSec: 0.3, fadeOutSec: 2 },
});
