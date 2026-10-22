import type { CopyDef } from "./template";

/**
 * Default copy for each wedding set, shown once when the gallery reaches that set:
 * "title｜line". Short on purpose — at most two lines on screen at a time.
 */
export const SET_COPY: Record<string, { label: string; text: string }> = {
  set_s1: { label: "婚纱照·影棚 标题｜一句话", text: "纯白｜最简单的颜色，留给最认真的誓言" },
  set_s2: { label: "婚纱照·海边 标题｜一句话", text: "海风｜海风很温柔，你也是" },
  set_s3: { label: "婚纱照·窗边 标题｜一句话", text: "时光｜光落在你身上的样子，我想记很久" },
  set_s4: { label: "婚纱照·花园 标题｜一句话", text: "花开｜在花开的地方，等你" },
  set_s5: { label: "婚纱照·教堂 标题｜一句话", text: "誓言｜我愿意，在每一个明天" },
  set_s6: { label: "婚纱照·街角 标题｜一句话", text: "街角｜我们的日常，也值得被认真记住" },
  set_s7: { label: "婚纱照·旷野 标题｜一句话", text: "远方｜去看山，去看海，都和你一起" },
  set_s8: { label: "婚纱照·夜色 标题｜一句话", text: "夜色｜夜很长，我们慢慢走" },
  set_c1: { label: "中式·秀禾 标题｜一句话", text: "良辰｜执子之手，与子偕老" },
  set_c2: { label: "中式·红墙 标题｜一句话", text: "红墙｜岁岁年年，朝朝暮暮" },
  set_c3: { label: "中式·喜房 标题｜一句话", text: "大喜｜百年好合，永结同心" },
};

/** Set captions for just the sets a template's gallery uses. */
export const setCopyFor = (sets: string[]): CopyDef =>
  Object.fromEntries(sets.map((s) => [`set_${s}`, SET_COPY[`set_${s}`]]).filter(([, v]) => v));
