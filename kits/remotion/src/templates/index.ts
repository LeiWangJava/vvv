import type { Catalog, FrameSize } from './types';

export type { Catalog, Definition, FrameSize } from './types';
export { TEMPLATES } from './registry';

/** The frame size for a project's chosen format; unknown formats are input errors, never a silent default. */
export function frameFor(catalog: Catalog, format: unknown): FrameSize & { format: string } {
  const name = typeof format === 'string' && format ? format : catalog.defaultFormat;
  const size = catalog.formats[name];
  if (!size) throw new Error(`VVV_FORMAT_UNSUPPORTED: ${catalog.id} supports ${Object.keys(catalog.formats).join(', ')}; got ${name}.`);
  return { ...size, format: name };
}
