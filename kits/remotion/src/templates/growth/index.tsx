import { makeGrowthTemplate, type GrowthSlots } from "./film";

export { plan } from "./film";

/**
 * Growth: a first-birthday (周岁) growth film, about two minutes. The film itself lives in film.tsx
 * and is shared with Hundred (百天); see README.md for the section table.
 */

export const growthSlots = {
  film: { count: 9, min: 3, max: 15 },
  milestones: { count: 20, min: 6, max: 30 },
  scatter: { count: 16, min: 6, max: 24, independent: true },
  floating: { count: 14, min: 6, max: 20, independent: true },
  wall: { count: 30, min: 9, max: 45, independent: true },
} as const satisfies GrowthSlots;

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

export const growth = makeGrowthTemplate({
  id: "VVV-Growth",
  code: "Growth",
  title: "周岁成长记",
  slots: growthSlots,
  copy: COPY,
  captions: DEMO_CAPTIONS,
  music: { src: "music/mixkit-first-kiss.mp3", volume: 0.85, trimBeforeSec: 0, fadeInSec: 0.3, fadeOutSec: 2 },
});
