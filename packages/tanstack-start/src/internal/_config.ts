import type { InitializeGTParams } from '../types/InitializeGTParams';

/**
 * Replaced at build time by the gt-tanstack-start Vite plugin with the app's
 * gt.config.json, plugin options and translation loader.
 */
export const config: InitializeGTParams | undefined = undefined;

export const loadTranslations: InitializeGTParams['loadTranslations'] =
  undefined;

/** Whether the server has initialized GT from this evaluation of the module. */
export const state = { initialized: false };
