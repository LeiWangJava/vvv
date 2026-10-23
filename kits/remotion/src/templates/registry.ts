// The kit's template registry. A .vvv package carries a copy of this file with only its own entry.
import type { Catalog, Definition } from './types';
import albumCatalog from '../../catalog/album.json';
import comedyCatalog from '../../catalog/comedy.json';
import doodleCatalog from '../../catalog/doodle.json';
import dvStoryCatalog from '../../catalog/dv-story.json';
import starterCatalog from '../../catalog/starter.json';
import growthCatalog from '../../catalog/growth.json';
import papercutFrameCatalog from '../../catalog/papercut-frame.json';
import { album } from './album';
import { comedy } from './comedy';
import { doodle } from './doodle';
import { dvStory } from './dv-story';
import { starter } from './starter';
import { growth } from './growth';
import { papercutFrameDemo } from '../effects/papercut-frame/demo';

/** One line per template or effect demo. Adding one: its folder, its catalog file, and an entry here. */
export const TEMPLATES: Record<string, { definition: Definition; catalog: Catalog }> = {
  album: { definition: album, catalog: albumCatalog },
  comedy: { definition: comedy, catalog: comedyCatalog },
  doodle: { definition: doodle, catalog: doodleCatalog },
  'dv-story': { definition: dvStory, catalog: dvStoryCatalog },
  starter: { definition: starter, catalog: starterCatalog },
  growth: { definition: growth, catalog: growthCatalog },
  'papercut-frame': { definition: papercutFrameDemo, catalog: papercutFrameCatalog },
};
