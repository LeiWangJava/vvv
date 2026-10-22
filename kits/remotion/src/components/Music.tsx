import React, { createContext, useContext } from "react";
import { Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { z } from "zod";

export const musicSchema = z.object({
  src: z.string().describe("public/ 下的音乐路径，如 music/xxx.mp3；留空为无声"),
  volume: z.number().min(0).max(1).describe("音量"),
  trimBeforeSec: z.number().min(0).describe("从音乐第几秒开始"),
  fadeInSec: z.number().min(0),
  fadeOutSec: z.number().min(0),
});
export type MusicProps = z.infer<typeof musicSchema>;

export const NO_MUSIC: MusicProps = { src: "", volume: 0.9, trimBeforeSec: 0, fadeInSec: 0.5, fadeOutSec: 2 };

/** Wrappers that play the music themselves (vertical short) silence everything the template plays. */
export const MusicMute = createContext(false);

/**
 * Gain applied to every sound a template plays, as a function of the template's own frame.
 * The loop version renders the film twice (its end crossfading into its start) and fades the
 * two copies' sound with this, so music, second tracks and sound effects all crossfade together.
 */
export const AudioGain = createContext<(templateFrame: number) => number>(() => 1);

/** The template's own length in frames, when a wrapper's composition is longer or shorter (loop). */
export const FilmLength = createContext<number | null>(null);

/** Background track for the whole video, with fade in/out. Renders nothing when src is empty. */
export const Music: React.FC<{ music: MusicProps }> = ({ music }) => {
  const { fps, durationInFrames: compFrames } = useVideoConfig();
  const durationInFrames = useContext(FilmLength) ?? compFrames;
  const muted = useContext(MusicMute);
  const gain = useContext(AudioGain);
  if (!music.src || muted) return null;
  const fadeIn = Math.max(1, music.fadeInSec * fps);
  const fadeOut = Math.max(1, music.fadeOutSec * fps);
  return (
    <Audio
      src={staticFile(music.src)}
      trimBefore={Math.round(music.trimBeforeSec * fps)}
      volume={(f) =>
        gain(f) *
        music.volume *
        interpolate(f, [0, fadeIn, durationInFrames - fadeOut, durationInFrames], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

/**
 * One track of a multi-track soundtrack: starts `from` seconds into the film (at `trimBeforeSec`
 * into the file), fades in, and fades out to end at `until`. `duck` (film seconds → 0–1) lowers it
 * under dialogue, sound gags and dramatic pauses.
 */
export interface TrackSpec {
  src: string;
  from: number;
  until: number;
  volume: number;
  trimBeforeSec?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
}

export const Track: React.FC<{ track: TrackSpec; duck?: (filmSeconds: number) => number }> = ({ track, duck }) => {
  const { fps } = useVideoConfig();
  const muted = useContext(MusicMute);
  const gain = useContext(AudioGain);
  if (!track.src || muted) return null;
  const start = Math.round(track.from * fps);
  const len = Math.max(1, Math.round((track.until - track.from) * fps));
  const fi = Math.max(1, (track.fadeInSec ?? 0.3) * fps);
  const fo = Math.max(1, (track.fadeOutSec ?? 1.5) * fps);
  return (
    <Sequence from={start} durationInFrames={len} layout="none">
      <Audio
        src={staticFile(track.src)}
        trimBefore={Math.round((track.trimBeforeSec ?? 0) * fps)}
        volume={(f) =>
          gain(start + f) *
          track.volume *
          (duck ? duck((start + f) / fps) : 1) *
          interpolate(f, [0, fi, len - fo, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        }
      />
    </Sequence>
  );
};

/** A one-shot sound (effect or a clip's own audio) at a film moment. */
export interface Cue {
  /** film seconds */
  at: number;
  src: string;
  volume?: number;
  /** seconds into the file to start from (clips) */
  trimBeforeSec?: number;
  /** stop after this many seconds (clips) */
  seconds?: number;
}

export const Cues: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const { fps } = useVideoConfig();
  const muted = useContext(MusicMute);
  const gain = useContext(AudioGain);
  if (muted) return null;
  return (
    <>
      {cues
        .filter((c) => c.src)
        .map((c, i) => {
          const start = Math.max(0, Math.round(c.at * fps));
          return (
            <Sequence key={`${c.src}-${i}`} from={start} durationInFrames={c.seconds ? Math.round(c.seconds * fps) : undefined} layout="none">
              <Audio src={staticFile(c.src)} trimBefore={Math.round((c.trimBeforeSec ?? 0) * fps)} volume={(f) => gain(start + f) * (c.volume ?? 1)} />
            </Sequence>
          );
        })}
    </>
  );
};
