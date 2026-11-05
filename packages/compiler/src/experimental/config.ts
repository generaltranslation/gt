/**
 * Options of the experimental compiler plugin
 * (`@generaltranslation/compiler/experimental`).
 */
import type {
  GTExperimentalSettings,
  TranslationSplittingStrategy,
} from 'generaltranslation/internal/experimental';
import {
  resolveTranslationSplitting,
  resolveTranslationSplittingValue,
} from 'generaltranslation/internal/experimental';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import type { GTConfig } from '../config';
import type { GTUnpluginOptions as RegularGTUnpluginOptions } from '../index';
import { COMPILER_DIAGNOSTIC_SOURCE } from './utils/diagnostics';

/** Build options for the `'locale-twins'` translation splitting strategy. */
export type LocaleTwinsOptions = {
  /** What a missing translation does to the build (default: `'warn'`). */
  missingTranslations?: 'warn' | 'error';
  /** How the SPA document loads the locale's entry twin (default: `'inline'`). */
  spaBootstrap?: 'inline' | 'external';
  /** Add a default vendor chunk so library code stays shared (default: `true`). */
  vendorChunk?: boolean;
  /**
   * Locale cookie the SPA bootstrap reads. Set it when the app passes a
   * custom `localeCookieName` to GT (default: the canonical GT locale cookie).
   */
  localeCookieName?: string;
  /**
   * Enable-i18n cookie the SPA bootstrap reads. Set it when the app passes a
   * custom `enableI18nCookieName` to GT (default: the canonical GT
   * enable-i18n cookie).
   */
  enableI18nCookieName?: string;
};

/** {@link LocaleTwinsOptions} with every default applied. */
export type ResolvedLocaleTwinsOptions = Required<LocaleTwinsOptions>;

export const DEFAULT_LOCALE_TWINS_OPTIONS: ResolvedLocaleTwinsOptions = {
  missingTranslations: 'warn',
  spaBootstrap: 'inline',
  vendorChunk: true,
  localeCookieName: defaultLocaleCookieName,
  enableI18nCookieName: defaultEnableI18nCookieName,
};

/** Options of the experimental GT compiler plugin. */
export interface GTUnpluginOptions extends RegularGTUnpluginOptions {
  /** gt.config.json, with its `experimental` settings. */
  gtConfig?: GTConfig & GTExperimentalSettings;
  /**
   * Translation splitting strategy. Overrides gt.config.json
   * `experimental.splitting` (default: `'locale'`).
   */
  splitting?: TranslationSplittingStrategy;
  /** Build options used when `splitting` is `'locale-twins'`. */
  localeTwins?: LocaleTwinsOptions;
}

/** The resolved translation splitting strategy and locale twins options. */
export type LocaleTwinsSettings = {
  splitting: TranslationSplittingStrategy;
  localeTwins: ResolvedLocaleTwinsOptions;
};

/**
 * Resolves the translation splitting strategy and locale twins options.
 * The `splitting` plugin option overrides gt.config.json
 * `experimental.splitting`; `localeTwins` options are merged over
 * {@link DEFAULT_LOCALE_TWINS_OPTIONS}. Throws a diagnostic error for an
 * unknown strategy.
 */
export function resolveLocaleTwinsSettings(
  options: Pick<GTUnpluginOptions, 'splitting' | 'localeTwins' | 'gtConfig'>
): LocaleTwinsSettings {
  return {
    splitting:
      options.splitting === undefined
        ? resolveTranslationSplitting(options.gtConfig)
        : resolveTranslationSplittingValue(options.splitting, {
            setting: 'The splitting option',
            source: COMPILER_DIAGNOSTIC_SOURCE,
          }),
    localeTwins: {
      ...DEFAULT_LOCALE_TWINS_OPTIONS,
      ...definedValues(options.localeTwins ?? {}),
    },
  };
}

function definedValues<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}
