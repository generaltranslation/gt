'use client';

// Client boundary for selector components re-exported from the server
// entrypoint. LocaleSelector comes from gt-react/context, which resolves to
// gt-react's client-capable context entrypoint behind this boundary.
import { LocaleSelector as GtReactLocaleSelector } from 'gt-react/context';
import { RegionSelector as GtReactRegionSelector } from 'gt-react/client';

export const LocaleSelector = GtReactLocaleSelector;
export const RegionSelector = GtReactRegionSelector;
