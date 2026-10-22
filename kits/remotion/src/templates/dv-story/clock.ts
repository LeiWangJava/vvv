/**
 * Beat clock for beat-locked editing. Beat 0 is the song's first downbeat and beat 4n starts bar n.
 * Fractional beats interpolate between the measured beats; before the first and after the last
 * measured beat the median beat length carries the grid on, so a shorter song still yields a full
 * timeline (the music simply fades out).
 */
export interface Clock {
  /** seconds of (fractional) beat x */
  at: (x: number) => number;
  /** fractional beat at time t (seconds) */
  beatOf: (t: number) => number;
  /** median beat length in seconds */
  period: number;
}

export interface BeatGrid {
  beats: number[];
  downbeats: number[];
}

export function makeClock(map: BeatGrid | null | undefined, fallbackBpm = 100): Clock {
  const all = map?.beats ?? [];
  const first = map?.downbeats?.length ? all.indexOf(map.downbeats[0]) : 0;
  const beats = all.slice(Math.max(0, first));
  if (all.length < 2) {
    const p = 60 / fallbackBpm;
    return { at: (x) => x * p, beatOf: (t) => t / p, period: p };
  }
  const gaps = all
    .slice(1)
    .map((b, i) => b - all[i])
    .sort((a, b) => a - b);
  const p = gaps[gaps.length >> 1];
  const n = beats.length - 1;
  const at = (x: number) => {
    if (x <= 0) return beats[0] + x * p;
    if (x >= n) return beats[n] + (x - n) * p;
    const i = Math.floor(x);
    return beats[i] + (x - i) * (beats[i + 1] - beats[i]);
  };
  const beatOf = (t: number) => {
    if (t <= beats[0]) return (t - beats[0]) / p;
    if (t >= beats[n]) return n + (t - beats[n]) / p;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (beats[m] <= t) lo = m;
      else hi = m;
    }
    return lo + (t - beats[lo]) / (beats[lo + 1] - beats[lo]);
  };
  return { at, beatOf, period: p };
}
