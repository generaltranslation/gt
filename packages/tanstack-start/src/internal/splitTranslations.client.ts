// The browser's side of split translations. gt-react's loader does the
// loading: the compiler wraps every dynamic import with it, the router's lazy
// route imports included, so navigation and preloading request a route's
// files with its chunks. This module only starts that loader with what the
// server sent.
import {
  loadSeededTranslations,
  seedChunkTranslations,
} from 'gt-react/chunk-translations';
import type * as Disabled from './splitTranslations';

export const createSplitSeed: typeof Disabled.createSplitSeed = () => undefined;

export const createSplitShellSeed: typeof Disabled.createSplitShellSeed =
  async () => undefined;

export const seedSplit: typeof Disabled.seedSplit = (seed) =>
  seedChunkTranslations(seed);

export const loadSplitTranslations: typeof Disabled.loadSplitTranslations = (
  locale
) => loadSeededTranslations(locale);
