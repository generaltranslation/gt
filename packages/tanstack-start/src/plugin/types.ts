import type { GTCompilerOptions } from 'generaltranslation';
import type { InitializeGTParams } from '../types/InitializeGTParams';

/** Mirrors gt-next's withGTConfig experimentalCompilerOptions. */
export type GTTanstackStartCompilerOptions = GTCompilerOptions & {
  /**
   * Which compiler plugin to use: babel or none.
   * @default 'none'
   */
  type?: 'babel' | 'none';
  /**
   * The compiler's `experimentalSplitTranslations`, with one more key. `firstVisit` says how
   * the translations of a server-rendered page reach it: `'inline'` (the
   * default) in the page's dehydrated state, `'files'` as the files a client
   * navigation loads, which the server asks the browser to preload.
   */
  experimentalSplitTranslations?: {
    enabled?: boolean;
    by?: 'chunk' | 'module';
    minifyHashes?: boolean;
    naming?: 'token' | 'map';
    requestCost?: number;
    previous?: string;
    firstVisit?: 'inline' | 'files';
  };
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
