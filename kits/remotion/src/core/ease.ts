/**
 * Easing and timing helpers with the same names and curves as the XY-01 Python engine
 * (legacy-xy01-engine/engine.py), so choreography ports line by line.
 */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0→1 as t goes a→b (linear, clamped) */
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, e: number) => a + (b - a) * e;

export const eOut3 = (p: number) => 1 - (1 - clamp01(p)) ** 3;
export const eIn3 = (p: number) => clamp01(p) ** 3;
export const eIo3 = (p: number) => {
  p = clamp01(p);
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
};
export const eIo5 = (p: number) => {
  p = clamp01(p);
  return p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2;
};
export const eOut5 = (p: number) => 1 - (1 - clamp01(p)) ** 5;
export const eSine = (p: number) => -(Math.cos(Math.PI * clamp01(p)) - 1) / 2;
export const eOutSine = (p: number) => Math.sin((clamp01(p) * Math.PI) / 2);
export const eBack = (p: number, s = 1.2) => {
  p = clamp01(p) - 1;
  return p * p * ((s + 1) * p + s) + 1;
};

/** Fade + rise: [opacity, y offset] */
export const fadeRise = (t: number, a: number, b: number, dist = 18): [number, number] => {
  const e = eOut3(ramp(t, a, b));
  return [e, dist * (1 - e)];
};

/** Ken Burns zoom from z0 to z1 over [a, b] with a sine-out ease. */
export const kb = (t: number, a: number, b: number, z0 = 1.08, z1 = 1.0) => lerp(z0, z1, eOutSine(ramp(t, a, b)));
