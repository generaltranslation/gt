'use client';

// Client boundary for selector components re-exported from the server
// entrypoint. LocaleSelector comes from gt-react's explicit client boundary;
// RegionSelector remains on gt-react/client because gt-react does not expose
// it from context-client-boundary.
import { LocaleSelector as GtReactLocaleSelector } from 'gt-react/context-client-boundary';
import { RegionSelector as GtReactRegionSelector } from 'gt-react/client';

export const LocaleSelector = GtReactLocaleSelector;
export const RegionSelector = GtReactRegionSelector;
