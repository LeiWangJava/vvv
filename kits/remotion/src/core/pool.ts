import { getPhoto } from "./manifest";
import { createSlotsSchema, type SlotSpecs, type SlotValues } from "./slot-schema";

export type { SlotSpec, SlotSpecs, SlotValues } from "./slot-schema";
export { formatOptionalSlots, slotMinimum } from "./slot-schema";
export const slotsSchema = (specs: SlotSpecs, optional?: ReadonlySet<string>) => createSlotsSchema(specs, (id) => { getPhoto(id); }, optional);

/** Placeholders are explicit; project initialization supplies actual IDs. */
export function emptySlots<S extends SlotSpecs>(specs: S): SlotValues<S> {
  return Object.fromEntries(Object.entries(specs).map(([key, spec]) => [key, spec.count === undefined ? "" : []])) as SlotValues<S>;
}
