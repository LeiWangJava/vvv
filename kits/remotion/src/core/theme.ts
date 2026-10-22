/** Shared design tokens. Templates may define their own palette on top of these. */

export const FRAME = { width: 1920, height: 1080 } as const;

/** Colors carried over from the XY-01 Python engine (legacy-xy01-engine/film.py). */
export const PALETTE = {
  paper: "#FCFBF8",
  paperWarm: "#F6F3EF",
  ink: "#2B2B2B",
  grey: "#737373",
  lightGrey: "#B8B8B8",
  gold: "#BD945C",
  goldBright: "#DEA13D",
  seal: "#B8211C",
  white: "#FFFFFF",
} as const;

export const RADIUS = 18;
export const SHADOW = "0 18px 42px rgba(40, 30, 20, 0.16), 0 4px 12px rgba(40, 30, 20, 0.08)";
export const TEXT_SHADOW = "0 2px 10px rgba(0, 0, 0, 0.28)";

/** Title-safe margin for projectors and LED screens that crop the edges. */
export const SAFE = 96;
