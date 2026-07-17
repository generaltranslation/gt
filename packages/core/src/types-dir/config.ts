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
  [key: string]: unknown;
};

/** Configuration for generated GT translation files. */
export type GTOutputFileConfig = {
  output?: string;
  publish?: boolean;
  parsingFlags?: GTParsingFlags;
  /** @deprecated Use `parsingFlags.includeSourceCodeContext` instead. */
  includeSourceCodeContext?: boolean;
  [key: string]: unknown;
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
 * File processing and package-specific settings are optional. A complete
 * project config always declares its default and supported locales.
 */
export type GTConfig = {
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
  enableI18n?: boolean;

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

  files?: GTFilesConfig;
};
