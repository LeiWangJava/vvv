import React, { useMemo } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { Clock } from "./clock";
import type { Scene } from "./story";
import { typingEvents } from "./typing";
import { KEY_SAMPLES } from "./keys";

export interface TypingSoundsProps {
  story: Scene[];
  clock: Clock;
  fps: number;
  cardsEnabled: boolean;
  volume: number;
}

/** One original key tap for every newly visible non-whitespace grapheme, independent of music. */
export const TypingSounds: React.FC<TypingSoundsProps> = ({ story, clock, fps, cardsEnabled, volume }) => {
  const events = useMemo(() => typingEvents(story, clock, fps, cardsEnabled), [story, clock, fps, cardsEnabled]);
  if (volume <= 0) return null;
  // Ceil keeps the complete sample, including its decay, at both preview and export frame rates.
  return (
    <>
      {events.map((event) => {
        const sample = KEY_SAMPLES[event.variant];
        return (
          <Sequence key={`${event.sceneId}-${event.line}-${event.index}`} from={event.frame} durationInFrames={Math.ceil(sample.durationSeconds * fps)} layout="none" showInTimeline={false}>
            <Audio src={staticFile(sample.src)} volume={volume} />
          </Sequence>
        );
      })}
    </>
  );
};
