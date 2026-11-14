import type { CustomMapping } from '@generaltranslation/format';
import type { InferInput } from 'valibot';
import type { FileFormat, UserTokenProvider } from '@generaltranslation/api';
import type { Updates } from 'generaltranslation';
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
import type { GTConfigFile } from '../fs/config/loadConfig.js';

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
/** Detected so setup can stop; the wizard cannot set React Native up yet. */
export type ReactNativeFrameworkObject = {
  name: 'react-native';
  type: 'react-native';
};

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
  userTokenProvider: UserTokenProvider;
  projectId?: string;
  /**
   * The app's runtime credentials found in the environment when the settings
   * were built. `apiKey` drops an env-file key while the user is signed in, so
   * whether that key exists is kept here, without a copy of it.
   */
  runtimeCredentials: { projectId: string | undefined; hasApiKey: boolean };
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
  fonts?: FontsConfig; // fonts to sync to the API before translating
  options?: AdditionalOptions;
  parsingOptions: ParsingConfigOptions;
  branchOptions: BranchOptions;
  // Optional shared static assets config
  sharedStaticAssets?: SharedStaticAssetsConfig;
} & Pick<
  GTConfigFile,
  | 'requiresReview'
  | 'publish'
  | 'omitConfigIds'
  | '_versionId'
  | '_branchId'
  | 'src'
  | 'framework'
  | 'modelProvider'
  | 'tag'
  | 'tagMessage'
>;

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

type BranchOptionsFile = NonNullable<GTConfigFile['branchOptions']>;

export type BranchOptions = BranchOptionsFile &
  Required<Pick<BranchOptionsFile, 'enabled' | 'remoteName'>>;

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
