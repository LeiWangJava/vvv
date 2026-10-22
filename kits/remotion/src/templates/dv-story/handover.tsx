import React from "react";
import { AbsoluteFill } from "remotion";
import { eIo3, ramp } from "../../core/ease";
import type { SceneCtx } from "./ctx";
import { DVBackground, DVOverlay, PlayBackground, PlayLabel } from "./frames";
import { TypeText } from "./scenes-dv";

/** Dissolve the viewfinder into the playback surface while the final typed line stays readable. */
export const DVToPlay: React.FC<{ ctx: SceneCtx; text: string; at: number; durationSec: number }> = ({ ctx, text, at, durationSec }) => {
  const start = at - durationSec;
  const p = eIo3(ramp(ctx.t, start, at));
  // REC leaves before PLAY arrives, so the two labels never form a ghosted double label.
  const recorder = 1 - eIo3(ramp(ctx.t, start, start + durationSec * 0.55));
  const playback = eIo3(ramp(ctx.t, start + durationSec * 0.55, at));
  // Text is independent of the background dissolve; hold its final characters, then release it.
  const copy = 1 - eIo3(ramp(ctx.t, at - Math.min(0.5, durationSec * 0.4), at - 0.05));
  const dotOn = Math.floor(ctx.clock.beatOf(ctx.t)) % 2 === 0;
  return (
    <AbsoluteFill>
      <PlayBackground />
      <AbsoluteFill style={{ opacity: 1 - p, transform: `scale(${1 + 0.035 * p})` }}>
        <DVBackground f={ctx.f} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: recorder, transform: `scale(${1 + 0.035 * p})` }}>
        <DVOverlay clipSeconds={ctx.t} dotOn={dotOn} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: copy }}>
        <TypeText ctx={ctx} text={text} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: playback }}>
        <PlayLabel dotOn={dotOn} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
