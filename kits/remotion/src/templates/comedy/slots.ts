import type { SlotSpecs } from "../../core/pool";

/** Photos in the order initialization assigns them; the gallery may reuse photos shown earlier. */
export const comedySlots = {
  groomKid: {}, groomHero: {}, brideKid: {}, brideHero: {},
  love: { count: 4 }, proposal: {}, finale: {},
  gallery: { count: 37, min: 1, max: 37, independent: true },
} satisfies SlotSpecs;
