import type { GTCompilerOptions } from 'generaltranslation';
import type { InitializeGTParams } from '../types/InitializeGTParams';

/** Mirrors gt-next's withGTConfig experimentalCompilerOptions. */
export type GTTanstackStartCompilerOptions = GTCompilerOptions & {
  /**
   * Which compiler plugin to use: babel or none.
   * @default 'none'
   */
  type?: 'babel' | 'none';
};

/**
 * Runtime settings that gt.config.json cannot hold. They override
 * gt.config.json, as withGTConfig() options do in gt-next.
 */
export type GTTanstackStartRuntimeOptions = Pick<
  InitializeGTParams,
  | 'localeCookieName'
  | 'regionCookieName'
  | 'enableI18nCookieName'
  | 'cacheExpiryTime'
  | 'batchConfig'
  | 'runtimeTranslation'
>;

export type GTTanstackStartPluginOptions = GTTanstackStartRuntimeOptions & {
  /** Path to gt.config.json, relative to the current working directory. */
  config?: string;
  /**
   * Path to a dictionary file with a default or named `dictionary` export,
   * relative to the current working directory. Defaults to `dictionary.ts`,
   * `.js` or `.json` in the app root or `src/`, as in gt-next.
   */
  dictionary?: string;
  /**
   * Path to a file with a default or named `loadDictionary` function, relative
   * to the current working directory. Defaults to `loadDictionary.ts` or `.js`
   * in the app root or `src/`, as in gt-next.
   */
  loadDictionaryPath?: string;
  /**
   * Path to a file with a default or named `loadTranslations` function,
   * relative to the current working directory. Defaults to
   * `src/loadTranslations.*`, then to the files.gt.output pattern of
   * gt.config.json.
   */
  loadTranslationsPath?: string;
  experimentalCompilerOptions?: GTTanstackStartCompilerOptions;
};

export type ConfigModuleOptions = Omit<
  GTTanstackStartPluginOptions,
  'config' | 'experimentalCompilerOptions'
>;
