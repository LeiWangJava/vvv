import React, { createContext, useContext } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * The time every animated component reads, in seconds.
 *
 * Normally it is just frame / fps. Inside <Film> it is the film's *design* time instead:
 * motion-blur samples render between frames, and the beat warp maps music time back to the
 * time the choreography was written in. Components never call useCurrentFrame directly.
 */
const TimeContext = createContext<number | null>(null);

export const TimeProvider: React.FC<{ t: number; children: React.ReactNode }> = ({ t, children }) => (
  <TimeContext.Provider value={t}>{children}</TimeContext.Provider>
);

export function useT(): number {
  const ctx = useContext(TimeContext);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return ctx ?? frame / fps;
}
