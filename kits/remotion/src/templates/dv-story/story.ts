import type { StickerName } from "./media";

/**
 * The storyboard: a home-video viewfinder for the early years, a "PLAY ●" screen with stickers for
 * the love story and a 35 mm strip for the wedding photos, with every scene length in beats
 * (4 beats = 1 bar). Scene boundaries, page cuts, photo entrances and typed characters all sit on
 * the song's measured beats (clock.ts).
 *
 * The default lengths are fitted to Fifth of February (99.8 BPM; phrases on beats 36 60 100 120 172
 * 204 244 264 288 304): childhood photos from 60, the wedding-photo strip from 244, the closing
 * card on the 288 drop and the film ending on the outro phrase. Another song re-times the film from
 * its own beat map; check the phrase landings after changing it.
 */

export type CopyDef = Record<string, { label: string; text: string }>;

/** "13,14|15,16" → [["13","14"],["15","16"]] */
export const parsePages = (s: string) =>
  s
    .split("|")
    .map((p) =>
      p
        .split(/[,，\s]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .filter((p) => p.length > 0);

/** Every on-screen line, for the fictional demo couple 林以舟 & 许知夏. "｜" breaks lines, "[1978]" draws keycap digits. */
export const COPY = {
  titleCn: { label: "片头标题 · 中文", text: "“我们的故事”" },
  titleEn: { label: "片头标题 · 英文手写", text: "Our story" },
  welcome1: { label: "开场 1", text: "欢迎大家来到我们的婚礼，" },
  welcome2: { label: "开场 2", text: "感谢大家百忙之中如约而至💗" },
  welcome3: { label: "开场 3（在一起的天数用 [数字]）", text: "今天是林以舟和许知夏在一起的｜第[1978]天🥰" },
  birth1: { label: "新郎出生", text: "1997年秋天，｜林以舟出生了…" },
  birth2: { label: "新娘出生", text: "一年后，｜1998年春天，｜许知夏出生了…" },
  parents1: { label: "感谢父母 1", text: "💕感谢父母的关心呵护，" },
  parents2: { label: "感谢父母 2", text: "让我们在幸福有爱的家庭中长大💫" },
  grateful1: { label: "成长照之后 1", text: "很幸运能成为你们的小孩，" },
  grateful2: { label: "成长照之后 2", text: "愿你们平安健康，永远幸福🌸" },
  grateful3: { label: "成长照之后 3", text: "接下来，就由我们续写未来的故事……" },
  believe: { label: "相信", text: "我们一直相信，｜最好的人注定会来到身边。" },
  fate: { label: "相识（图左字右）", text: "2021年春天，｜命运的齿轮开始转动…" },
  chatTime: { label: "相识聊天卡片 · 时间（相识照片留空时显示）", text: "2021年3月14日 21:07" },
  chatA: { label: "相识聊天卡片 · 他说", text: "你好，我是林以舟" },
  chatB: { label: "相识聊天卡片 · 她说", text: "你好呀，我是许知夏～" },
  together: { label: "在一起", text: "2021年5月20日，｜我们在一起啦😘" },
  since: { label: "从此以后", text: "从此以后，｜我们一起做了很多有意义的事情" },
  first: { label: "第一张合照", text: "📍我们的第一张合照——银杏街的秋天🍂" },
  travel: { label: "一起去旅行", text: "📍一起去旅行🧳" },
  birthday: { label: "一起过生日", text: "📍一起过生日🎂" },
  concert: { label: "一起去看演唱会", text: "📍一起去看演唱会🎤" },
  funny: { label: "一起拍搞怪照片", text: "📍一起拍各种搞怪的照片🤪" },
  friends: { label: "一起和好朋友出去玩", text: "📍一起熬过异地的日子🚄" },
  festival: { label: "一起过节日和纪念日", text: "📍一起过大大小小的节日和纪念日🎉" },
  park: { label: "一起去游乐场", text: "📍一起去游乐场🎡" },
  food: { label: "一起吃好吃的", text: "📍一起吃很多好吃的🍜" },
  cat: { label: "一起照顾小猫", text: "📍一起照顾小猫🐱" },
  ski: { label: "一起去滑雪", text: "📍一起去滑雪🏂" },
  friendsWedding: { label: "一起见证好朋友的幸福", text: "📍一起见证好朋友的幸福💐" },
  newYear: { label: "一起回家过年", text: "📍一起回家过年🧧" },
  wonder: { label: "时常会想", text: "时常会想，｜到底是什么让两个人做好了结婚的准备💍" },
  moments: { label: "被爱的瞬间", text: "我想，可能是每个被爱的瞬间✨" },
  flowers: { label: "爱是鲜花", text: "💗爱是随时出现的鲜花🌷" },
  meals: { label: "爱是家常饭", text: "💗爱是精心准备的家常饭🍲" },
  rituals: { label: "爱是仪式感", text: "💗爱是从不缺席的仪式感🎁" },
  newHome: { label: "搬新家", text: "2024年10月，我们搬新家啦🏠" },
  ask: { label: "求婚前的卡片（可留空）", text: "突然有一天，他问我，｜你准备好了吗？" },
  decide: { label: "求婚后的卡片（可留空）", text: "于是我们决定，｜一起拥抱未知的未来💗" },
  engaged: { label: "订婚", text: "2025年国庆，我们订婚啦💍" },
  weddingPhotos: { label: "婚纱照（胶片段）", text: "2026年春天，｜我们拍了婚纱照📸" },
  proposal: { label: "求婚", text: "2025年5月20日，他求婚啦！" },
  ending: { label: "结尾", text: "我们的故事，终于来到了今天……" },
} satisfies CopyDef;
export type CopyKey = keyof typeof COPY;

/**
 * Photos per scene as project asset IDs ("@id"). "," = side by side on one page, "|" = the next page
 * under the same title. A scene whose photos (or a card whose text) is left empty is skipped.
 * Defaults: the fictional demo couple from the kit's demo photos.
 */
const pool = (...ids: string[]) => ids.map((id) => `@${id}`).join(",");
export const PHOTOS = {
  birth1: { label: "新郎出生照", text: pool("groom-01-childhood-02") },
  birth2: { label: "新娘出生照", text: pool("dvdemo-b-baby") },
  childhood: { label: "成长照（依次闪现）", text: pool("bride-01-childhood-02", "groom-01-childhood-01", "bride-01-childhood-01", "groom-01-childhood-03", "bride-01-childhood-03", "groom-02-school-01", "bride-02-school-01", "groom-02-school-02") },
  fate: { label: "相识照片（留空则显示聊天卡片）", text: "" },
  first: { label: "第一张合照", text: pool("couple-03-dating-01") },
  travel: { label: "一起去旅行", text: pool("couple-06-travel-01", "dvdemo-travel") },
  birthday: { label: "一起过生日", text: pool("couple-03-dating-04", "dvdemo-bday") },
  concert: { label: "一起去看演唱会", text: pool("dvdemo-concert") },
  funny: { label: "一起拍搞怪照片", text: pool("dvdemo-funny") },
  friends: { label: "一起和好朋友出去玩", text: pool("couple-05-distance-01") },
  festival: { label: "一起过节日和纪念日", text: "" },
  park: { label: "一起去游乐场", text: pool("couple-03-dating-03", "dvdemo-park") },
  food: { label: "一起吃好吃的", text: pool("dvdemo-food") },
  cat: { label: "一起照顾小猫", text: pool("dvdemo-cat") },
  ski: { label: "一起去滑雪", text: pool("dvdemo-ski") },
  friendsWedding: { label: "一起见证好朋友的幸福", text: "" },
  newYear: { label: "一起回家过年", text: pool("dvdemo-newyear") },
  flowers: { label: "爱是鲜花", text: pool("dvdemo-flower-a", "dvdemo-flower-b") },
  meals: { label: "爱是家常饭", text: pool("couple-04-daily-01", "dvdemo-meal") },
  rituals: { label: "爱是仪式感", text: pool("dvdemo-anniv", "dvdemo-xmas") },
  newHome: { label: "搬新家", text: pool("couple-04-daily-02", "dvdemo-keys") },
  engaged: { label: "订婚（最后一页单张配跳舞贴纸）", text: `${pool("dvdemo-eng-a", "dvdemo-eng-b")}|${pool("dvdemo-eng-family")}` },
  weddingPhotos: { label: "婚纱照（胶片段）", text: pool("couple-08-wedding-s1-studio-01", "couple-08-wedding-s3-interior-01", "couple-08-wedding-s4-garden-02", "couple-08-wedding-s5-chapel-01", "couple-08-wedding-s2-seaside-04", "couple-08-wedding-s6-street-01", "couple-08-wedding-s8-night-02", "couple-08-wedding-s7-highland-02", "couple-08-wedding-s4-garden-01", "couple-09-chinese-c2-redwall-01") },
  proposal: { label: "求婚", text: pool("couple-07-proposal-01", "couple-07-proposal-02") },
} satisfies CopyDef;
export type PhotoKey = keyof typeof PHOTOS;

export type Screen = "title" | "black" | "dv" | "play" | "strip" | "end";

export interface SubPage {
  photos: string[];
  beats: number;
  /** photos appear one per `accumulate` beats instead of all at once */
  accumulate?: number;
  /** dancing stickers at the bottom corners */
  dancers?: boolean;
}

interface Base {
  id: string;
  screen: Screen;
  /** first and end beat (beat 0 = first downbeat) */
  b0: number;
  b1: number;
}
export type Scene =
  | (Base & { kind: "title" })
  | (Base & { kind: "type"; text: string })
  | (Base & { kind: "birth"; text: string; photo: string; variant: "slit" | "swing" })
  | (Base & { kind: "flash"; photos: string[] })
  | (Base & { kind: "card"; text: string; sticker: StickerName })
  | (Base & { kind: "fate"; text: string; photo: string; chat: { time: string; a: string; b: string } })
  | (Base & { kind: "page"; title: string; pages: SubPage[]; titleSticker?: { name: StickerName; side: "left" | "right" } })
  | (Base & { kind: "strip"; text: string; photos: string[] })
  | (Base & { kind: "ending"; text: string });

type Draft = Scene extends infer S ? (S extends Scene ? Omit<S, "b0" | "b1"> & { beats: number } : never) : never;

export interface StoryOptions {
  /**
   * After moving house: ask card → proposal → decide card → engagement → wedding-photo strip.
   * Off: engagement → strip → proposal, for couples who proposed after their wedding photos.
   */
  proposalFirst?: boolean;
  /** beats of the closing card (default 8); lets a film end on the song's outro phrase */
  endingBeats?: number;
  /** Opening PLAY cards can share the same total beats with a different reading pace. */
  playIntroBeats?: { believe: number; fate: number; together: number };
}

export function buildStory(copy: Record<string, string>, photos: Record<string, string>, opts: StoryOptions = {}): Scene[] {
  // Missing keys are empty, never the demo defaults: a project's film must not show the demo couple.
  const c = (k: CopyKey) => copy[k] ?? "";
  const p = (k: PhotoKey) => parsePages(photos[k] ?? "");
  const typed = (k: CopyKey, beats: number) => (c(k).trim() ? beats : 0);
  const one = (k: PhotoKey) => p(k)[0]?.[0] ?? "";
  const page = (k: CopyKey & PhotoKey, opts: Partial<SubPage> = {}, beats = 4): Draft => ({
    id: k,
    kind: "page",
    screen: "play",
    title: c(k),
    pages: p(k).map((photosOnPage) => ({ photos: photosOnPage, beats, ...opts })),
    beats: p(k).length * beats,
  });

  const engagedPages = p("engaged");
  const engaged: SubPage[] = engagedPages.map((ph, i) =>
    i === engagedPages.length - 1 && ph.length === 1 ? { photos: ph, beats: 6, dancers: true } : { photos: ph, beats: 6, accumulate: 2 },
  );
  const proposal: SubPage[] = p("proposal").map((ph) => ({ photos: ph, beats: 8, accumulate: 2 }));
  const card = (k: CopyKey, sticker: StickerName, beats: number): Draft => ({ id: k, kind: "card", screen: "play", text: c(k), sticker, beats: c(k).trim() ? beats : 0 });
  const strip = p("weddingPhotos").flat();
  const proposalScene: Draft = {
    id: "proposal",
    kind: "page",
    screen: "play",
    title: c("proposal"),
    pages: proposal,
    titleSticker: { name: "ring", side: "right" },
    beats: proposal.reduce((s, x) => s + x.beats, 0),
  };
  const engagedScene: Draft = { id: "engaged", kind: "page", screen: "play", title: c("engaged"), pages: engaged, beats: engaged.reduce((s, x) => s + x.beats, 0) };
  // one bar per frame: the title block, then each photo
  const stripScene: Draft = { id: "weddingPhotos", kind: "strip", screen: "strip", text: c("weddingPhotos"), photos: strip, beats: strip.length ? 4 * (strip.length + 1) : 0 };
  const finale: Draft[] = opts.proposalFirst
    ? [card("ask", "ask", 4), proposalScene, card("decide", "decide", 6), engagedScene, stripScene]
    : [card("ask", "ask", 4), engagedScene, stripScene, proposalScene, card("decide", "decide", 6)];

  const drafts: Draft[] = [
    { id: "title", kind: "title", screen: "title", beats: 8 },
    { id: "welcome1", kind: "type", screen: "black", text: c("welcome1"), beats: typed("welcome1", 7) },
    { id: "welcome2", kind: "type", screen: "black", text: c("welcome2"), beats: typed("welcome2", 7) },
    { id: "welcome3", kind: "type", screen: "black", text: c("welcome3"), beats: typed("welcome3", 9) },
    { id: "birth1", kind: "birth", screen: "dv", text: c("birth1"), photo: one("birth1"), variant: "slit", beats: one("birth1") ? 8 : 0 },
    { id: "birth2", kind: "birth", screen: "dv", text: c("birth2"), photo: one("birth2"), variant: "swing", beats: one("birth2") ? 7 : 0 },
    { id: "parents1", kind: "type", screen: "dv", text: c("parents1"), beats: typed("parents1", 6) },
    { id: "parents2", kind: "type", screen: "dv", text: c("parents2"), beats: typed("parents2", 8) },
    { id: "childhood", kind: "flash", screen: "dv", photos: p("childhood").flat(), beats: 4 * p("childhood").flat().length },
    { id: "grateful1", kind: "type", screen: "dv", text: c("grateful1"), beats: typed("grateful1", 8) },
    { id: "grateful2", kind: "type", screen: "dv", text: c("grateful2"), beats: typed("grateful2", 8) },
    { id: "grateful3", kind: "type", screen: "dv", text: c("grateful3"), beats: typed("grateful3", 8) },
    { id: "believe", kind: "card", screen: "play", text: c("believe"), sticker: "letter", beats: typed("believe", opts.playIntroBeats?.believe ?? 4) },
    {
      id: "fate",
      kind: "fate",
      screen: "play",
      text: c("fate"),
      photo: one("fate"),
      chat: { time: c("chatTime"), a: c("chatA"), b: c("chatB") },
      // a supplied photo, or the drawn chat card when its lines are filled
      beats: one("fate") || c("chatA").trim() ? (opts.playIntroBeats?.fate ?? 4) : 0,
    },
    { id: "together", kind: "card", screen: "play", text: c("together"), sticker: "together", beats: typed("together", opts.playIntroBeats?.together ?? 8) },
    { id: "since", kind: "card", screen: "play", text: c("since"), sticker: "go", beats: typed("since", 8) },
    { ...page("first"), titleSticker: { name: "camera", side: "left" } } as Draft,
    page("travel"),
    page("birthday"),
    page("concert"),
    page("funny"),
    page("friends"),
    page("festival"),
    page("park"),
    page("food"),
    page("cat"),
    page("ski"),
    page("friendsWedding"),
    page("newYear"),
    { id: "wonder", kind: "card", screen: "play", text: c("wonder"), sticker: "think", beats: typed("wonder", 8) },
    { id: "moments", kind: "card", screen: "play", text: c("moments"), sticker: "heart", beats: typed("moments", 4) },
    page("flowers"),
    page("meals"),
    page("rituals"),
    { ...page("newHome", { accumulate: 2 }, 6), titleSticker: { name: "house", side: "right" } } as Draft,
    ...finale,
    { id: "ending", kind: "ending", screen: "end", text: c("ending"), beats: opts.endingBeats ?? 8 },
  ];

  let b = 0;
  return drafts
    .filter((d) => d.beats > 0)
    .map((d) => {
      const { beats, ...rest } = d;
      const s = { ...rest, b0: b, b1: b + beats } as Scene;
      b += beats;
      return s;
    });
}
