import React from 'react';
import { Composition } from 'remotion';
import input from '../inputs.json';
import { frameFor, TEMPLATES } from './templates';

const entry = TEMPLATES[input.template];
if (!entry) throw new Error(`Unsupported VVV template: ${input.template}`);
const { definition: template, catalog } = entry;
const props: Record<string, any> = { ...template.defaultProps, ...input.props };
const initial = frameFor(catalog, props.format);

export const Root: React.FC = () => (
  <Composition
    id={catalog.compositionId}
    component={template.component}
    defaultProps={props}
    schema={template.schema as any}
    fps={Number(props.fps ?? template.fps)}
    durationInFrames={Math.max(1, Math.ceil(template.seconds(props) * Number(props.fps ?? template.fps)))}
    width={initial.width}
    height={initial.height}
    calculateMetadata={async (context) => {
      // The frame size follows the chosen format before template-specific metadata runs.
      const frame = frameFor(catalog, (context.props as Record<string, unknown>).format);
      const parsed = template.schema.parse(context.props);
      const metadata = template.calculateMetadata
        ? await template.calculateMetadata({ ...context, props: parsed })
        : {};
      const fps = Number(metadata?.fps ?? parsed.fps ?? template.fps);
      return {
        fps,
        durationInFrames: Math.max(1, Math.ceil(template.seconds(parsed) * fps)),
        ...metadata,
        width: frame.width,
        height: frame.height,
        props: metadata?.props ?? parsed,
      };
    }}
  />
);
