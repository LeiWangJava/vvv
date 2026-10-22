import { z } from "zod";

/** Everything personal on screen. Kept separate from photos so a new couple only edits this. */
export const coupleSchema = z.object({
  groom: z.string().describe("新郎姓名"),
  bride: z.string().describe("新娘姓名"),
  groomEn: z.string().describe("新郎英文名或拼音"),
  brideEn: z.string().describe("新娘英文名或拼音"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "格式 YYYY-MM-DD")
    .describe("婚礼日期"),
  tagline: z.string().describe("主标题"),
});
export type Couple = z.infer<typeof coupleSchema>;

/** Explicit example placeholders; replace with supplied project facts. */
export const DEMO_COUPLE: Couple = {
  groom: "示例甲",
  bride: "示例乙",
  groomEn: "PERSON A",
  brideEn: "PERSON B",
  date: "2030-01-01",
  tagline: "我们结婚啦",
};

const CN = "〇一二三四五六七八九";
const cnSmall = (n: number) =>
  n < 10 ? CN[n] : `${n >= 20 ? CN[Math.floor(n / 10)] : ""}十${n % 10 ? CN[n % 10] : ""}`;
const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];
const pad = (n: number) => String(n).padStart(2, "0");

export type DateStyle = "dot" | "cn" | "en" | "enShort";

/** 2026-10-18 → dot "2026.10.18" · cn "二〇二六年十月十八日" · en "OCTOBER 18, 2026" · enShort "OCT 18 2026" */
export function formatDate(iso: string, style: DateStyle = "dot"): string {
  const [y, m, d] = iso.split("-").map(Number);
  switch (style) {
    case "dot":
      return `${y}.${pad(m)}.${pad(d)}`;
    case "cn":
      return `${[...String(y)].map((c) => CN[Number(c)]).join("")}年${cnSmall(m)}月${cnSmall(d)}日`;
    case "en":
      return `${MONTHS[m - 1]} ${d}, ${y}`;
    case "enShort":
      return `${MONTHS[m - 1].slice(0, 3)} ${pad(d)} ${y}`;
  }
}

export const coupleNames = (c: Couple, sep = " & ") => `${c.groom}${sep}${c.bride}`;
export const coupleNamesEn = (c: Couple, sep = " & ") => `${c.groomEn}${sep}${c.brideEn}`;
