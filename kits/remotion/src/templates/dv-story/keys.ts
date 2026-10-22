/**
 * Four original 45 ms key taps, synthesized by scripts/make-key-sfx.py (no recording or third-party
 * audio). One plays for each newly typed character; variants rotate so repeats do not sound looped.
 */
export const KEY_SAMPLES = [1, 2, 3, 4].map((n) => ({ src: `sfx/dvstory-key-${n}.wav`, durationSeconds: 0.045 }));
