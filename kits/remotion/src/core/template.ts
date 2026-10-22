import React from "react";
import { z } from "zod";
import { musicSchema, NO_MUSIC, type MusicProps } from "../components/Music";
import { coupleSchema, DEMO_COUPLE, type Couple } from "./couple";
import { emptySlots, formatOptionalSlots, slotMinimum, slotsSchema, type SlotSpecs, type SlotValues } from "./pool";
import { FRAME } from "./theme";

/**
 * The contract every template follows. Props are plain JSON so the same template can be
 * rendered from the CLI, edited in Studio, or embedded with @remotion/player on the website:
 *   couple — names, date, headline
 *   photos — one project asset ID per slot (filled by project initialization)
 *   copy   — every customer-facing line (story subtitles, chapter titles, blessings), editable
 *   music  — optional licensed track under public/music
 *   fps    — 30 for previews, 60 for delivery
 *   format — the frame format chosen at initialization (catalog formats, e.g. "16:9", "9:16");
 *            scenes read the actual size from useVideoConfig()
 */
export type TemplateProps<S extends SlotSpecs> = {
  couple: Couple;
  photos: SlotValues<S>;
  copy: Record<string, string>;
  music: MusicProps;
  fps: number;
  format?: string;
};

/** Props added by a template family (for example the event card on a vertical invite). */
export type TemplateExtraValues<E extends z.ZodRawShape> = z.infer<z.ZodObject<E>>;
/** Empty extras must remain `{}`; Zod infers an empty object as `Record<string, never>`. */
export type TemplatePropsWithExtras<S extends SlotSpecs, E extends z.ZodRawShape> = TemplateProps<S> & (keyof E extends never ? {} : TemplateExtraValues<E>);

export interface TemplateExtras<E extends z.ZodRawShape> {
  /** Zod fields merged into the core composition schema. */
  schema: E;
  /** Defaults matching the schema fields. */
  defaults: TemplateExtraValues<E>;
}

/** Editable copy: key → label shown in Studio + default text. */
export type CopyDef = Record<string, { label: string; text: string }>;

export interface TemplateDef<S extends SlotSpecs, E extends z.ZodRawShape = {}> {
  /** Composition id (letters, digits, "-"), e.g. "XY01-Album" */
  id: string;
  /** Style-library code, e.g. "XY-01" */
  code: string;
  /** Style-library name, e.g. "现代留白·圆角画册" */
  title: string;
  /** Named photo slots with pool queries. */
  slots: S;
  /**
   * Slots a format uses when it leaves some out, e.g. a vertical short that only shows the opening,
   * gallery and ending. Formats not listed use every slot. Mirrors `formats[f].slots` in the catalog.
   */
  formatSlots?: Record<string, readonly (keyof S & string)[]>;
  /** Length in seconds; may depend on props (e.g. how many photos a list slot holds). */
  seconds: (props: TemplatePropsWithExtras<S, E>) => number;
  component: React.FC<TemplatePropsWithExtras<S, E>>;
  width?: number;
  height?: number;
  music?: MusicProps;
  /** default frame rate; project inputs can select a supported delivery rate */
  fps?: number;
  /** editable copy with defaults */
  copy?: CopyDef;
  /** design second of a frame that works as the cover image */
  poster?: number;
  /** look of the vertical short (website preview kit) */
  short?: ShortTheme;
  /** Optional typed fields merged into the composition props. */
  extras?: TemplateExtras<E>;
  /** false for templates without a couple; the couple fields are then left out. */
  couple?: boolean;
  /** Singular alias kept for concise template definitions. */
  extra?: TemplateExtras<E>;
}

/** Look of the 15-second vertical short. */
export interface ShortTheme {
  background: string;
  ink: string;
  accent: string;
  /** FontKey names from core/fonts */
  titleFont: string;
  bodyFont: string;
  /** photo frame: none, white print border, or gold line */
  frame: "none" | "print" | "line";
  /** wedding sets to feature first */
  sets?: string[];
}

export const fpsSchema = z.number().int().min(24).max(60).describe("帧率：预览 30，成片 60");
export const formatSchema = z.string().regex(/^[1-9][0-9]*:[1-9][0-9]*$/).optional().describe("画幅，例如 16:9 或 9:16（由工程初始化时选择）");

export function defineTemplate<S extends SlotSpecs, E extends z.ZodRawShape = {}>(def: TemplateDef<S, E>, extras?: TemplateExtras<E>) {
  const copyDef = def.copy ?? {};
  const extra = extras ?? def.extras ?? def.extra;
  const extraShape = extra?.schema ?? ({} as E);
  const withCouple = def.couple !== false;
  const optionalSlots = formatOptionalSlots(def.slots, def.formatSlots);
  const schema = z.object({
    ...(withCouple ? { couple: coupleSchema } : {}),
    photos: slotsSchema(def.slots, optionalSlots),
    copy: z.object(Object.fromEntries(Object.entries(copyDef).map(([k, v]) => [k, z.string().describe(v.label)]))),
    music: musicSchema,
    fps: fpsSchema,
    format: formatSchema,
    ...extraShape,
  }).superRefine((value, ctx) => {
    // Slots only some formats use are required in exactly those formats.
    const props = value as { photos: Record<string, string | string[]>; format?: string };
    const photos = props.photos;
    for (const name of optionalSlots) {
      const need = slotMinimum(def.slots[name], name, props.format, def.formatSlots);
      const value = photos[name];
      const have = Array.isArray(value) ? value.length : value ? 1 : 0;
      if (have < need) {
        ctx.addIssue({ code: "custom", path: ["photos", name], message: `${name} needs at least ${need} photo${need === 1 ? "" : "s"} in format ${props.format}.` });
      }
    }
  });
  const defaultProps: TemplatePropsWithExtras<S, E> = {
    ...(withCouple ? { couple: DEMO_COUPLE } : {}),
    photos: emptySlots(def.slots),
    copy: Object.fromEntries(Object.entries(copyDef).map(([k, v]) => [k, v.text])),
    music: def.music ?? NO_MUSIC,
    fps: def.fps ?? 30,
    ...(extra?.defaults ?? {}),
  } as TemplatePropsWithExtras<S, E>;
  const component: React.FC<TemplatePropsWithExtras<S, E>> = (props) => {
    // Validate before scene indexing or asset loading; errors retain the input field path.
    const parsed = schema.safeParse(props);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      throw new Error(`VVV_INPUT_INVALID: ${def.id}: ${detail}`);
    }
    return React.createElement(def.component, parsed.data as TemplatePropsWithExtras<S, E>);
  };
  return { ...def, component, fps: def.fps ?? 30, width: def.width ?? FRAME.width, height: def.height ?? FRAME.height, schema, defaultProps };
}

export type RegisteredTemplate = ReturnType<typeof defineTemplate<SlotSpecs>>;
