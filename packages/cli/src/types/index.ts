import type { CustomMapping } from '@generaltranslation/format/types';
import type { InferInput } from 'valibot';
import type {
  FileFormat,
  ModelProvider,
  UserTokenProvider,
} from '@generaltranslation/api';
import type { Updates } from 'generaltranslation/types';
import { SUPPORTED_FILE_EXTENSIONS } from '../formats/files/supportedFiles.js';
import {
  ParsingConfigOptions,
  ResolvedGTParsingFlags,
  ParseFlagsByFileType,
} from './parsing.js';
import { Libraries, InlineLibrary } from './libraries.js';
import type {
  AdditionalOptionsSchema,
  FilesOptionsSchema,
  FontsConfigSchema,
  IncludePatternSchema,
  JsonSchemaSchema,
  MintlifyOptionsSchema,
  RequiresReviewConfigSchema,
  SharedStaticAssetsConfigSchema,
  SourceObjectOptionsSchema,
  TransformOptionSchema,
  TransformOptionsSchema,
  YamlSchemaSchema,
} from '../config/schema.js';

export type { Updates } from 'generaltranslation/types';

export type Metadata = Updates[number]['metadata'];

export type Options = {
  config: string;
  apiKey?: string;
  projectId?: string;
  versionId?: string;
  tsconfig?: string;
  dictionary?: string;
  src?: string[];
  defaultLocale?: string;
  locales?: string[];
  baseUrl: string;
  ignoreErrors: boolean;
  suppressWarnings: boolean;
  dryRun: boolean;
  timeout: number;
  force?: boolean;
  stageTranslations?: boolean;
  experimentalLocalizeStaticUrls?: boolean;
  experimentalHideDefaultLocale?: boolean;
  experimentalFlattenJsonFiles?: boolean;
  experimentalLocalizeStaticImports?: boolean;
  experimentalLocalizeRelativeAssets?: boolean;
  experimentalAddHeaderAnchorIds?: AdditionalOptions['experimentalAddHeaderAnchorIds'];
  docsImportRewrites?: AdditionalOptions['docsImportRewrites'];
};

export type MintlifyOptions = InferInput<typeof MintlifyOptionsSchema>;

export type OpenApiConfig = NonNullable<MintlifyOptions['openapi']>;

export type SharedFlags = {
  config?: string;
  apiKey?: string;
  projectId?: string;
};

export type TranslateFlags = SharedFlags & {
  versionId?: string;
  tsconfig?: string;
  dictionary?: string;
  defaultLocale?: string;
  locales?: string[];
  ignoreErrors?: boolean;
  src?: string[];
  timeout: number;
  dryRun: boolean;
  saveLocal?: boolean;
  stageTranslations?: boolean;
  setupProject?: boolean; // if true, skip enqueue step
  publish?: boolean;
  force?: boolean;
  forceDownload?: boolean;
  tag?: string;
  message?: string;
  experimentalLocalizeStaticUrls?: boolean;
  experimentalHideDefaultLocale?: boolean;
  experimentalFlattenJsonFiles?: boolean;
  experimentalLocalizeStaticImports?: boolean;
  experimentalLocalizeRelativeAssets?: boolean;
  experimentalAddHeaderAnchorIds?: AdditionalOptions['experimentalAddHeaderAnchorIds'];
  omitConfigIds?: boolean;
  excludeStaticUrls?: string[];
  excludeStaticImports?: string[];
  docsImportRewrites?: AdditionalOptions['docsImportRewrites'];
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
  tsconfig?: string;
  ignoreErrors: boolean;
  suppressWarnings: boolean;
};

export type Framework =
  | typeof Libraries.GT_NEXT
  | typeof Libraries.GT_REACT
  | typeof Libraries.GT_REACT_NATIVE
  | typeof Libraries.GT_TANSTACK_START;

export const SUPPORTED_REACT_FRAMEWORKS = [
  'next-app',
  'next-pages',
  'vite',
  'gatsby',
  'react',
  'redwood',
  'tanstack-start',
  'react-router',
] as const;

export const SUPPORTED_FRAMEWORKS = [
  ...SUPPORTED_REACT_FRAMEWORKS,
  'mintlify',
] as const;

export type FrameworkObject =
  | {
      name: Exclude<
        (typeof SUPPORTED_FRAMEWORKS)[number],
        (typeof SUPPORTED_REACT_FRAMEWORKS)[number]
      >;
      type?: undefined;
    }
  | {
      name: (typeof SUPPORTED_REACT_FRAMEWORKS)[number];
      type: 'react';
    };
export type ReactFrameworkObject = Extract<FrameworkObject, { type: 'react' }>;

export type FrameworkType = FrameworkObject['type'];

export type SupportedFrameworks = FrameworkObject['name'];
export type SupportedReactFrameworks = Extract<
  FrameworkObject,
  { type: 'react' }
>['name'];

export type SupportedLibraries =
  | InlineLibrary
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

export type TransformOption = InferInput<typeof TransformOptionSchema>;

export type TransformFiles = {
  [K in SupportedFileExtension]?: TransformOption | string | TransformOption[]; // if a string, only transform the file name
};

export type TransformFormats = {
  [K in SupportedFileExtension]?: FileFormat;
};

export type IncludePattern = InferInput<typeof IncludePatternSchema>;

export type RequiresReviewConfig = InferInput<
  typeof RequiresReviewConfigSchema
>;

export type FilesOptions = InferInput<typeof FilesOptionsSchema>;

export type FontsConfig = InferInput<typeof FontsConfigSchema>;

// Shared settings between all API-related commands
export type Settings = {
  config: string;
  configDirectory: string;
  baseUrl: string;
  dashboardUrl: string;
  apiKey?: string;
  userTokenProvider?: UserTokenProvider;
  projectId?: string;
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
  files: {
    resolvedPaths: ResolvedFiles; // Absolute resolved paths for the default locale
    placeholderPaths: ResolvedFiles; // Absolute placeholder paths for all locales containing [locale]
    transformPaths: TransformFiles; // Absolute transform paths for all locales containing [locale]
    transformFormats: TransformFormats; // Output file format transforms keyed by config file type
    publishPaths: Set<string>; // Absolute paths explicitly opted IN to publishing
    unpublishPaths: Set<string>; // Absolute paths explicitly opted OUT of publishing
    requiresReviewPaths: Set<string>; // Absolute paths whose effective requiresReview policy is true
    parsingFlags: ParseFlagsByFileType;
    gtJson: {
      publish?: boolean; // if true, publish gtjson translations to the CDN
      parsingFlags: ResolvedGTParsingFlags; // Flags for parsing inline content
    };
  };
  stageTranslations: boolean; // if true, always stage the project during translate command
  requiresReview?: boolean; // top-level default: translated artifacts require approval before the client uses them
  publish?: boolean; // if true, publish the translations to the CDN; undefined means no global publish intent
  omitConfigIds?: boolean; // if true, do not write _versionId or _branchId to gt.config.json
  _versionId?: string; // internal use only
  _branchId?: string; // internal use only
  version?: string; // for specifying a custom version id to use. Should be unique
  description?: string;
  src?: string[]; // list of glob patterns for source file scanning
  fonts?: FontsConfig; // fonts to sync to the API before translating
  framework?: SupportedFrameworks;
  options?: AdditionalOptions;
  modelProvider?: ModelProvider;
  tag?: string;
  tagMessage?: string;
  parsingOptions: ParsingConfigOptions;
  branchOptions: BranchOptions;
  // Optional shared static assets config
  sharedStaticAssets?: SharedStaticAssetsConfig;
};

export type StaticLocalizationFiles = Pick<
  Settings['files'],
  'placeholderPaths' | 'resolvedPaths'
> &
  Partial<Pick<Settings['files'], 'transformPaths' | 'transformFormats'>>;

export type StaticLocalizationSettings = Pick<
  Settings,
  'defaultLocale' | 'locales' | 'options'
> & {
  files?: StaticLocalizationFiles | null;
};

export type BranchOptions = {
  currentBranch?: string;
  autoDetectBranches?: boolean;
  remoteName: string; // default 'origin'. The name of the remote to use for auto-detection.
  enabled: boolean; // if true, branching is enabled for the project
};

export type AdditionalOptions = InferInput<typeof AdditionalOptionsSchema>;

export type SharedStaticAssetsConfig = InferInput<
  typeof SharedStaticAssetsConfigSchema
>;

export type StructuralTransform = NonNullable<
  JsonSchema['structuralTransform']
>[number];

export type JsonSchema = InferInput<typeof JsonSchemaSchema>;

export type YamlSchema = InferInput<typeof YamlSchemaSchema>;

export type SourceObjectOptions = InferInput<typeof SourceObjectOptionsSchema>;

export type TransformOptions = InferInput<typeof TransformOptionsSchema>;
