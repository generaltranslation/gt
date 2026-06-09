'use client';

// Client boundary for the selector components re-exported from the server
// entrypoint. Server code must reference the selectors through this module
// instead of the index.client barrel so that built server output never
// requires gt-react/client directly. These are assigned (not re-exported) so
// the bundler cannot collapse the boundary into the importing server module.
import {
  LocaleSelector as GtReactLocaleSelector,
  RegionSelector as GtReactRegionSelector,
} from 'gt-react/client';

export const LocaleSelector = GtReactLocaleSelector;
export const RegionSelector = GtReactRegionSelector;
