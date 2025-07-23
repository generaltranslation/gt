import { SUPPORTED_FILE_EXTENSIONS } from '../formats/files/supportedFiles.js';

export type { Updates } from 'generaltranslation/types';

export type Options = {
  config: string;
  apiKey?: string;
  projectId?: string;
  versionId?: string;
  jsconfig?: string;
  dictionary?: string;
  src?: string[];
  defaultLocale?: string;
  locales?: string[];
  baseUrl: string;
  inline?: boolean;
  ignoreErrors: boolean;
  suppressWarnings: boolean;
  dryRun: boolean;
  timeout: string;
  stageTranslations?: boolean;
  experimentalLocalizeStaticUrls?: boolean;
  experimentalHideDefaultLocale?: boolean;
  experimentalFlattenJsonFiles?: boolean;
};

export type WrapOptions = {
  src?: string[];
  config: string;
  skipTs: boolean;
  disableIds: boolean;
  disableFormatting: boolean;
  addGTProvider: boolean;
};

export type SetupOptions = {
  src?: string[];
  config: string;
};

export type GenerateSourceOptions = {
  src?: string[];
  config: string;
  defaultLocale: string;
  dictionary?: string;
  jsconfig?: string;
  inline?: boolean;
  ignoreErrors: boolean;
  suppressWarnings: boolean;
};

export type Framework = 'gt-next' | 'gt-react';

export type SupportedFrameworks =
  | 'next-app'
  | 'next-pages'
  | 'vite'
  | 'gatsby'
  | 'react'
  | 'redwood';

export type SupportedLibraries =
  | 'gt-next'
  | 'gt-react'
  | 'next-intl'
  | 'react-i18next'
  | 'next-i18next'
  | 'i18next'
  | 'i18next-icu'
  | 'base';

export interface ContentScanner {
  scanForContent(
    options: WrapOptions,
    framework: Framework
  ): Promise<{
    errors: string[];
    filesUpdated: string[];
    warnings: string[];
  }>;
}

// Create a type based on the supported file extensions
export type SupportedFileExtension = (typeof SUPPORTED_FILE_EXTENSIONS)[number];

// Update ResolvedFiles to use the dynamic keys
export type ResolvedFiles = {
  [K in SupportedFileExtension]?: string[];
} & {
  gt?: string; // Output glob: /path/[locale].json
};

// Update TransformFiles similarly
export type TransformFiles = {
  [K in SupportedFileExtension]?: string;
};

// Update FilesOptions to fix the error
export type FilesOptions = {
  [K in SupportedFileExtension]?: {
    include: string[];
    exclude?: string[];
    transform?: string;
  };
} & {
  gt?: {
    output: string; // Output glob: /path/[locale].json
  };
};

// Shared settings between all API-related commands
export type Settings = {
  config: string;
  baseUrl: string;
  dashboardUrl: string;
  apiKey: string;
  projectId: string;
  defaultLocale: string;
  locales: string[];
  files:
    | {
        resolvedPaths: ResolvedFiles; // Absolute resolved paths for the default locale
        placeholderPaths: ResolvedFiles; // Absolute placeholder paths for all locales containing [locale]
        transformPaths: TransformFiles; // Absolute transform paths for all locales containing [locale]
      }
    | undefined;
  stageTranslations: boolean; // if true, always stage the project during translate command
  _versionId?: string; // internal use only
  version?: string; // for specifying a custom version id to use. Should be unique
  description?: string;
  src: string[]; // list of glob patterns for gt-next and gt-react
  framework?: SupportedFrameworks;
  options?: AdditionalOptions;
};

export type AdditionalOptions = {
  preset?: 'mintlify' | 'fumadocs' | 'nextra' | 'astro';
  flattenJsonFiles?: boolean;
  hideDefaultLocale?: boolean;
  localizeStaticUrls?: boolean;
  jsonSchema?: {
    [fileGlob: string]: {
      compositeFile?: boolean; // if true, translated files will be merged into a single file. Only used for reconciliation.
      include?: {
        // object of values denoted by json paths to include
        [jsonPath: string]: string;
      };
      transform?: {
        // only used if compositeFile is true; keyPaths help reconciliate translated content
        [keyPath: string]: {
          type: 'value' | 'key';
          localeProperty?: string; // specific locale property to use for the key, ex: localeCode, languageName, emoji, etc.
        };
      };
    };
  };
};
