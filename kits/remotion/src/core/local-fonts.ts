import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import sources from "../../font-sources.json";

export interface LocalFontFace {
  module: string;
  family: string;
  style: string;
  weight: string;
  subset: string;
  unicodeRange: string;
  file: string;
}

const faces = sources.faces as LocalFontFace[];
const loading = new Map<string, Promise<FontFace>>();

const covers = (range: string, codePoints: number[]) => range.split(",").some((part) => {
  const [lo, hi = lo] = part.trim().replace(/^U\+/i, "").split("-").map((value) => parseInt(value, 16));
  return codePoints.some((value) => value >= lo && value <= hi);
});

/** Select only packaged faces; no runtime branch resolves a remote font URL. */
export function selectFontFaces(module: string, style: string, weight: number, text: string): LocalFontFace[] {
  const candidates = faces.filter((face) => face.module === module && face.style === style);
  if (!candidates.length) throw new Error(`Font ${module} (${style}) is not packaged. Run prepare-fonts after explicitly configuring it.`);
  const weights = [...new Set(candidates.map((face) => Number(face.weight)))];
  const closest = weights.reduce((best, current) => Math.abs(current - weight) < Math.abs(best - weight) ? current : best);
  const points = [...new Set([...text].map((char) => char.codePointAt(0)!))];
  return candidates.filter((face) => Number(face.weight) === closest && covers(face.unicodeRange, points));
}

export function localFont(module: string, text: string, weight = 400, style: "normal" | "italic" = "normal"): string {
  const selected = selectFontFaces(module, style, weight, text);
  const family = sources.families.find((item) => item.module === module)?.family;
  if (!family) throw new Error(`Unknown local font family ${module}`);
  if (typeof document === "undefined" || typeof FontFace === "undefined") return family;
  for (const face of selected) {
    const key = `${face.module}|${face.style}|${face.weight}|${face.subset}`;
    if (loading.has(key)) continue;
    if (!face.file.startsWith("fonts/") || face.file.includes("..")) throw new Error(`Invalid local font path: ${face.file}`);
    const handle = delayRender(`Loading local ${face.family} ${face.weight} ${face.subset}`, { timeoutInMilliseconds: 60000 });
    const font = new FontFace(face.family, `url("${staticFile(face.file)}") format("woff2")`, {
      weight: face.weight, style: face.style, unicodeRange: face.unicodeRange,
    });
    const pending = font.load().then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
      return loaded;
    }).catch((error: unknown) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      cancelRender(new Error(`Local font load failed for ${face.file}: ${failure.message}`));
      throw failure;
    });
    loading.set(key, pending);
  }
  return family;
}
