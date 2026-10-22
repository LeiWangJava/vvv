import { z } from "zod";

export interface SlotSpec {
  count?: number;
  min?: number;
  max?: number;
  independent?: boolean;
}
export type SlotSpecs = Record<string, SlotSpec>;
export type SlotValues<S extends SlotSpecs> = { [K in keyof S]: S[K] extends { count: number } ? string[] : string };

/**
 * Share array bounds between runtime validation and the intake catalog. Slots named in `optional`
 * (used by some formats only) may be left empty here; defineTemplate enforces them per format.
 */
export function createSlotsSchema(specs: SlotSpecs, requireId: (id: string) => void, optional: ReadonlySet<string> = new Set()) {
  const idSchema = z.string().min(1, "A project photo ID is required.").superRefine((id, ctx) => {
    if (!id) return;
    try { requireId(id); }
    catch (error) { ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : `Unknown project photo ${id}` }); }
  });
  const shape: Record<string, z.ZodType> = {};
  for (const [name, spec] of Object.entries(specs)) {
    const min = optional.has(name) ? 0 : spec.min ?? spec.count;
    shape[name] = spec.count === undefined
      ? (optional.has(name) ? z.union([z.literal(""), idSchema]) : idSchema)
      : z.array(idSchema)
          .min(min ?? 0, `${name} needs at least ${min} photos.`)
          .max(spec.max ?? spec.count, `${name} supports at most ${spec.max ?? spec.count} photos.`);
  }
  return z.object(shape);
}

/** Slots that at least one format leaves out; formats not listed in formatSlots use every slot. */
export function formatOptionalSlots(specs: SlotSpecs, formatSlots?: Record<string, readonly string[]>): Set<string> {
  const optional = new Set<string>();
  for (const used of Object.values(formatSlots ?? {})) {
    for (const name of Object.keys(specs)) if (!used.includes(name)) optional.add(name);
  }
  return optional;
}

/** Minimum photo count of a slot in the given format: 0 when that format does not use it. */
export function slotMinimum(spec: SlotSpec, name: string, format: string | undefined, formatSlots?: Record<string, readonly string[]>): number {
  const used = format === undefined ? undefined : formatSlots?.[format];
  if (used && !used.includes(name)) return 0;
  return spec.count === undefined ? 1 : spec.min ?? spec.count;
}
