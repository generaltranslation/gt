import type { GTUnpluginOptions } from '@generaltranslation/compiler';
import type {
  I18nCacheConstructorParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';

/**
 * The subset of gt.config.json that gt-astro consumes. Unknown keys are
 * preserved and forwarded to the compiler plugin.
 */
export type GTAstroFileConfig = Partial<I18nConfigParams> & {
  localeCookieName?: string;
  files?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Options for the gtAstro() integration.
 */
export type GTAstroOptions = {
  /** Path to gt.config.json, relative to the project root. Default: 'gt.config.json'. */
  gtConfigPath?: string;
  /**
   * Redirect requests whose path is missing a locale prefix to the resolved
   * locale (e.g. `/about` -> `/fr/about`). Only applies to on-demand rendered
   * routes. Default: true.
   */
  localeRouting?: boolean;
  /**
   * Path to a module with a `loadTranslations(locale)` named export, relative
   * to the project root. Default: 'src/loadTranslations.ts' when it exists.
   */
  loadTranslationsPath?: string;
  /** Options forwarded to @generaltranslation/compiler, or false to disable it. */
  compiler?: GTUnpluginOptions | false;
  /** Overrides GT_PROJECT_ID and gt.config.json. */
  projectId?: string;
  /** Overrides GT_API_KEY and gt.config.json. Never exposed to the client. */
  apiKey?: string;
  /** Overrides GT_DEV_API_KEY and gt.config.json. Exposed to the client in dev only. */
  devApiKey?: string;
};

/**
 * Runtime config serialized into the virtual config modules.
 */
export type GTAstroRuntimeConfig = I18nConfigParams & {
  localeCookieName?: string;
};

/**
 * Middleware behavior serialized into the server virtual config module.
 */
export type GTAstroRuntimeSettings = {
  localeRouting: boolean;
};

/**
 * Params accepted by the server-side initializer.
 */
export type InitializeGTAstroParams = I18nConfigParams &
  I18nCacheConstructorParams;

/**
 * Shape of `Astro.locals.gt`, set by the gt-astro middleware.
 */
export type GTLocals = {
  locale: string;
};
