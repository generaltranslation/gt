import type { CustomMapping } from '@generaltranslation/format/types';

/**
 * Options shared by the CLI, compiler, and runtimes under
 * `files.gt.parsingFlags` in gt.config.json.
 */
export type GTParsingFlags = {
  autoderive?: boolean | { jsx?: boolean; strings?: boolean };
  includeSourceCodeContext?: boolean;
  enableAutoJsxInjection?: boolean;
  legacyGtReactImportSource?: boolean;
  devHotReload?: boolean | { strings?: boolean; jsx?: boolean };
  /** Vite config used to resolve hash-affecting Vue compiler behavior. */
  viteConfigPath?: string;
  /** Hash-affecting Vue template compiler options. */
  vueCompilerOptions?: {
    whitespace?: 'condense' | 'preserve';
    delimiters?: [string, string];
  };
};

/** Configuration for generated GT translation files. */
export type GTOutputFileConfig = {
  output?: string;
  publish?: boolean;
  parsingFlags?: GTParsingFlags;
  /** @deprecated Use `parsingFlags.includeSourceCodeContext` instead. */
  includeSourceCodeContext?: boolean;
};

/**
 * File configuration is primarily consumed by the CLI. Other packages only
 * inspect `files.gt`, but must still accept the complete gt.config.json shape.
 */
export type GTFilesConfig = {
  gt?: GTOutputFileConfig;
  [fileType: string]: unknown;
};

/**
 * The configuration stored in gt.config.json.
 *
 * All settings are optional. Runtimes default `defaultLocale` to
 * `libraryDefaultLocale` and `locales` to an empty list before resolving the
 * effective locale set.
 */
export type GTConfig = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
  enableI18n?: boolean;
  /** Enable framework-provided locale path routing when supported. */
  localeRouting?: boolean;

  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  _versionId?: string;
  _branchId?: string;

  cacheUrl?: string | null;
  cacheExpiryTime?: number;
  runtimeUrl?: string | null;
  modelProvider?: string;
  _disableDevHotReload?: boolean;
  /**
   * Opt-in id-tagging — **off by default**. When true, each `<T>`'s translation
   * hash is exposed on the DOM as a `data-_gt-hash` attribute so tooling
   * (localized replay, in-context QA) can map a rendered node back to its
   * published translation. No effect on `gt()` string translations; DOM-only
   * (skipped on React Native).
   *
   * ⚠️ Read before enabling — this injects markup. To carry the attribute, GT
   * puts it directly on the element a `<T>` renders when there is one, but a `<T>`
   * that renders bare text or a fragment has no element to hold it, so its output
   * is wrapped in a layout-neutral `display:contents` `<span>`. Enabling this
   * therefore adds `<span>`s around text/fragment `<T>`s — which is why it is not
   * on by default. It is never enabled implicitly.
   */
  _tagIds?: boolean;

  files?: GTFilesConfig;
};
