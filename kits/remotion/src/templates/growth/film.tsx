import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { Music, type MusicProps } from "../../components/Music";
import { EdgeFade, FilmGrain } from "../../components/Overlays";
import { beatClock as sharedBeatClock, loadBeatGrid, type BeatGrid as Grid } from "../../core/beat-clock";
import { defineTemplate, type CopyDef, type TemplateProps } from "../../core/template";
import {
  FilmStripScene, FloatingScene, GreetingScene, Letter2Scene, LetterScene, MilestoneScene, ScatterScene, TitleScene, WallScene, Window,
} from "./scenes";
import { graphemes } from "./hand";

/**
 * The baby growth film shared by Growth (周岁) and Hundred (百天): title → greeting → handwritten
 * letter → scrolling film strip → one milestone card per photo → scattered collage → glowing second
 * letter → photos floating through stars → flash into a scrolling photo wall → ending line. Every
 * section starts on a beat of the soundtrack. Templates differ only in slot counts, copy and music.
 */

/** The five photo slots every growth film has; counts are per template. */
export type GrowthSlots = {
  film: { count: number; min: number; max: number };
  milestones: { count: number; min: number; max: number };
  scatter: { count: number; min: number; max: number; independent: true };
  floating: { count: number; min: number; max: number; independent: true };
  wall: { count: number; min: number; max: number; independent: true };
};

type Props = TemplateProps<GrowthSlots> & { captions: string[]; beatGrid?: Grid | null };

/** Tempo used when the project has no beat map (silent drafts). */
const FALLBACK_BPM = 110;
const beatClock = (grid: Grid | null | undefined) => sharedBeatClock(grid, FALLBACK_BPM);
const lineCount = (text: string) => text.split("\n").filter((l) => l.trim()).length;

/** Section starts in beats, from the inputs that change their length. */
export function plan(miles: number, letterLines: number, letter2Lines: number) {
  let b = 0;
  const at = (n: number) => { const s = b; b += n; return s; };
  const title = at(8);
  const greet = at(8);
  const letter = at(Math.max(12, 2 * letterLines + 4));
  const film = at(26);
  const milestones = at(4 * miles);
  const scatter = at(24);
  const letter2 = at(Math.max(10, letter2Lines + 6));
  const floating = at(14);
  const wall = at(32);
  const end = at(8);
  return { title, greet, letter, film, milestones, scatter, letter2, floating, wall, end, total: b };
}

const planFor = (props: Props) => plan(props.photos.milestones.length, lineCount(props.copy.letter), lineCount(props.copy.letter2));

const GrowthFilm: React.FC<Props> = ({ photos, copy, captions, music, beatGrid }) => {
  const B = useMemo(() => beatClock(beatGrid), [beatGrid]);
  const P = useMemo(() => plan(photos.milestones.length, lineCount(copy.letter), lineCount(copy.letter2)), [photos.milestones.length, copy.letter, copy.letter2]);
  const beat = B(1) - B(0);
  const end = B(P.total) + 1;
  const pulses = [8, 16, 24].map((k) => B(P.wall + k));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Window from={0} to={B(P.greet)}>
        <TitleScene from={0} to={B(P.greet)} title={copy.title} subtitle={copy.subtitle} />
      </Window>
      <Window from={B(P.greet)} to={B(P.letter)}>
        <GreetingScene from={B(P.greet)} to={B(P.letter)} text={copy.greeting} />
      </Window>
      <Window from={B(P.letter)} to={B(P.film)}>
        <LetterScene from={B(P.letter)} to={B(P.film)} text={copy.letter} lineStep={2 * beat} />
      </Window>
      <Window from={B(P.film)} to={B(P.milestones)}>
        <FilmStripScene from={B(P.film)} to={B(P.milestones)} ids={photos.film} />
      </Window>
      {photos.milestones.map((id, i) => (
        <Window key={i} from={B(P.milestones + 4 * i)} to={B(P.milestones + 4 * i + 4)}>
          <MilestoneScene from={B(P.milestones + 4 * i)} to={B(P.milestones + 4 * i + 4)} id={id} caption={captions[i] ?? ""} index={i} />
        </Window>
      ))}
      <Window from={B(P.scatter)} to={B(P.letter2)}>
        <ScatterScene from={B(P.scatter)} to={B(P.letter2)} ids={photos.scatter} />
      </Window>
      <Window from={B(P.letter2)} to={B(P.floating)}>
        <Letter2Scene from={B(P.letter2)} to={B(P.floating)} text={copy.letter2} leadSec={B(P.letter2 + 3) - B(P.letter2)} lineStep={beat} />
      </Window>
      <Window from={B(P.floating)} to={B(P.wall)}>
        <FloatingScene from={B(P.floating)} to={B(P.wall)} ids={photos.floating} />
      </Window>
      <Window from={B(P.wall)} to={end}>
        <WallScene from={B(P.wall)} to={end} ids={photos.wall} pulses={pulses} endFrom={B(P.end)} ending={copy.ending}
          endStep={Math.min(0.16, (beat * 2) / Math.max(1, graphemes(copy.ending).length))} />
      </Window>
      <FilmGrain opacity={0.035} />
      <EdgeFade inSec={0.3} outSec={1.6} />
      <Music music={music} />
    </AbsoluteFill>
  );
};

const beatGridSchema = z.object({ beats: z.array(z.number()) }).nullable().optional();

/** Build one growth-film template: its own composition id, slot counts, copy, demo captions and music. */
export function makeGrowthTemplate(options: {
  id: string;
  code: string;
  title: string;
  slots: GrowthSlots;
  copy: CopyDef;
  captions: string[];
  music: MusicProps;
}) {
  const captionsSchema = z.array(z.string()).max(options.slots.milestones.max)
    .describe("里程碑文案，按顺序对应 photos.milestones；\\n 换行");
  const definition = defineTemplate(
    {
      id: options.id,
      code: options.code,
      title: options.title,
      slots: options.slots,
      couple: false,
      seconds: (props) => beatClock((props as Props).beatGrid)(planFor(props as Props).total) + 1,
      component: GrowthFilm as React.FC<TemplateProps<GrowthSlots>>,
      fps: 30,
      copy: options.copy,
      poster: 2,
      music: options.music,
    },
    { schema: { captions: captionsSchema, beatGrid: beatGridSchema }, defaults: { captions: options.captions, beatGrid: null } },
  );
  /** Load the beat map once, before rendering, so the length and every cut follow the music. */
  const calculateMetadata: CalculateMetadataFunction<any> = async ({ props }) => {
    const parsed = definition.schema.parse(props) as Props;
    const grid = await loadBeatGrid(parsed.music);
    const seconds = beatClock(grid)(planFor(parsed).total) + 1;
    return { durationInFrames: Math.ceil(seconds * parsed.fps), props: { ...parsed, beatGrid: grid } };
  };
  return { ...definition, calculateMetadata };
}
