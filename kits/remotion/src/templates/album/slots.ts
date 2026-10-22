import type { SlotSpecs } from "../../core/pool";

export const albumSlots = {
  opening: {}, bride: {}, groom: {}, duoWide: {}, duoTall: {}, storyWide: {}, storyTall: {},
  poem: { count: 4 }, beachBig: {}, beachSmall: { count: 2 }, rise: { count: 3 }, drop: { count: 3 },
  pairTall: {}, pairWide: {}, panels: { count: 3 }, endless: { count: 2 }, quoteBig: {}, quoteSmall: { count: 2 },
  foreverMid: {}, foreverLeft: {}, foreverRight: {}, glow: {}, handwriting: {}, prints: { count: 3 },
  vertical: {}, ending: {}, gallery: { count: 37, min: 1, max: 37, independent: true },
} satisfies SlotSpecs;
