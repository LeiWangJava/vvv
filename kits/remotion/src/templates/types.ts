import type { ComponentType } from 'react';
import type { CalculateMetadataFunction } from 'remotion';

export type FrameSize = { width: number; height: number };

/** The parts of a template the root composition needs; catalog/<id>.json owns formats and slots. */
export type Definition = {
  id: string;
  component: ComponentType<any>;
  schema: { parse(value: unknown): any };
  defaultProps: Record<string, any>;
  fps: number;
  seconds(props: any): number;
  calculateMetadata?: CalculateMetadataFunction<any>;
};

export type Catalog = { id: string; compositionId: string; formats: Record<string, FrameSize>; defaultFormat: string };
