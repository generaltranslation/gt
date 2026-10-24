import type { InitializeGTParams } from '../types/InitializeGTParams';

/**
 * Replaced at build time by the gt-tanstack-start Vite plugin with the app's
 * gt.config.json, plugin options, dictionary and loaders.
 */
export const config: InitializeGTParams | undefined = undefined;

export const loadTranslations: InitializeGTParams['loadTranslations'] =
  undefined;

export const dictionary: InitializeGTParams['dictionary'] = undefined;

export const loadDictionary: InitializeGTParams['loadDictionary'] = undefined;

// The plugin exports localeRouting.enabled instead when gt.config.json
// enables localeRouting.
export * from './localeRouting.disabled';
