import { CustomMapping } from 'generaltranslation/types';
import { SUPPORTED_FILE_EXTENSIONS } from '../formats/files/supportedFiles.js';
import { ParsingConfigOptions } from './parsing.js';
import { Libraries, InlineLibrary } from './libraries.js';

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
  timeout: number;
  force?: boolean;
  stageTranslations?: boolean;
  experimentalLocalizeStaticUrls?: boolean;
  experimentalHideDefaultLocale?: boolean;
  experimentalFlattenJsonFiles?: boolean;
  experimentalLocalizeStaticImports?: boolean;
  experimentalLocalizeRelativeAssets?: boolean;
  experimentalAddHeaderAnchorIds?: 'mintlify' | 'default';
  docsImportRewrites?: Array<{
    match: string;
    replace: string;
  }>;
};

export type OpenApiConfig = {
  files: string[];
  translateFields?: string[];
};

export type MintlifyOptions = {
  openapi?: OpenApiConfig;
  inferTitleFromFilename?: boolean;
};

export type SharedFlags = {
  config?: string;
  apiKey?: string;
  projectId?: string;
};

export type TranslateFlags = SharedFlags & {
  versionId?: string;
  jsconfig?: string;
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
  experimentalLocalizeStaticUrls?: boolean;
  experimentalHideDefaultLocale?: boolean;
  experimentalFlattenJsonFiles?: boolean;
  experimentalLocalizeStaticImports?: boolean;
  experimentalLocalizeRelativeAssets?: boolean;
  experimentalAddHeaderAnchorIds?: 'mintlify' | 'default';
  excludeStaticUrls?: string[];
  excludeStaticImports?: string[];
  docsImportRewrites?: Array<{
    match: string;
    replace: string;
  }>;
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

export type Framework = typeof Libraries.GT_NEXT | typeof Libraries.GT_REACT;

export type FrameworkObject =
  | {
      name: 'mintlify';
      type?: undefined;
    }
  | {
      name: 'next-app' | 'next-pages' | 'vite' | 'gatsby' | 'redwood' | 'react';
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

export type TransformOption = {
  match?: string; // regex to match strings, supports capture groups
  replace: string; // string or regex pattern to replace the match with
  // Special placeholders:
  // -> if used in the match string, they will be replaced with the corresponding default locale property value
  // -> if used in the replace string, they will be replaced with the corresponding target locale property value
  // {locale} -> will be replaced with the locale code
  // And any other property from getLocaleProperties()
};

export type TransformFiles = {
  [K in SupportedFileExtension]?: TransformOption | string | TransformOption[]; // if a string, only transform the file name
};

// Update FilesOptions to fix the error
export type FilesOptions = {
  [K in SupportedFileExtension]?: {
    include: string[];
    exclude?: string[];
    transform?: string | TransformOption | TransformOption[];
  };
} & {
  gt?: {
    output: string; // Output glob: /path/[locale].json
  };
};

// Shared settings between all API-related commands
export type Settings = {
  config: string;
  configDirectory: string;
  baseUrl: string;
  dashboardUrl: string;
  apiKey?: string;
  projectId?: string;
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
  files: {
    resolvedPaths: ResolvedFiles; // Absolute resolved paths for the default locale
    placeholderPaths: ResolvedFiles; // Absolute placeholder paths for all locales containing [locale]
    transformPaths: TransformFiles; // Absolute transform paths for all locales containing [locale]
  };
  stageTranslations: boolean; // if true, always stage the project during translate command
  publish: boolean; // if true, publish the translations to the CDN
  _versionId?: string; // internal use only
  version?: string; // for specifying a custom version id to use. Should be unique
  description?: string;
  src: string[]; // list of glob patterns for gt-next and gt-react
  framework?: SupportedFrameworks;
  options?: AdditionalOptions;
  modelProvider?: string;
  parsingOptions: ParsingConfigOptions;
  branchOptions: BranchOptions;
  // Optional shared static assets config
  sharedStaticAssets?: SharedStaticAssetsConfig;
};

export type BranchOptions = {
  currentBranch?: string;
  autoDetectBranches?: boolean;
  remoteName: string; // default 'origin'. The name of the remote to use for auto-detection.
  enabled: boolean; // if true, branching is enabled for the project
};

export type AdditionalOptions = {
  // Optional schema to follow while translating JSON files
  jsonSchema?: {
    [fileGlob: string]: JsonSchema;
  };
  // Optional schema to follow while translating YAML files
  yamlSchema?: {
    [fileGlob: string]: YamlSchema;
  };
  // Skip pre-parse validation checks for specific file types
  skipFileValidation?: {
    json?: boolean;
    yaml?: boolean;
    mdx?: boolean;
  };
  // Optional Mintlify-specific options container
  mintlify?: MintlifyOptions;
  docsUrlPattern?: string; // eg /docs/[locale] or /[locale] for localizing static urls in markdown files
  docsImportPattern?: string; // eg /docs/[locale]/foo.md or /[locale]/foo.md for localizing static imports in markdown files
  excludeStaticUrls?: string[]; // A list of file globs to include for static url localization
  excludeStaticImports?: string[]; // A list of file globs to include for static import localization
  docsHideDefaultLocaleImport?: boolean; // if true, hide the default locale in the import path
  copyFiles?: string[]; // array of files to copy to the target locale
  experimentalClearLocaleDirs?: boolean; // if true, clear locale directories before writing translations (default: false)
  clearLocaleDirsExclude?: string[]; // array of glob patterns with [locale] or [locales] placeholder to exclude from clearing (e.g., "./snippets/[locale]/preserved/**" or "./[locales]/static/**")
  experimentalLocalizeStaticImports?: boolean; // Inserts locale in static import paths in md/mdx files
  experimentalLocalizeStaticUrls?: boolean; // Inserts locale in static url paths in md/mdx files and adds anchor IDs to preserve navigation
  experimentalLocalizeRelativeAssets?: boolean; // Rewrites relative asset URLs in translated md/mdx files to valid paths
  experimentalAddHeaderAnchorIds?: 'mintlify' | 'default'; // Format for anchor IDs: 'mintlify' for div wrapping, 'default' or undefined for inline {#id}. Can run independently of static url localization
  experimentalHideDefaultLocale?: boolean; // Hides the default locale in the import path
  experimentalFlattenJsonFiles?: boolean; // Flattens JSON files into a single file
  baseDomain?: string; // The base http:// url where the project is hosted
  docsImportRewrites?: Array<{
    match: string; // prefix to match, e.g. '@site/docs'
    replace: string; // replacement prefix, can include [locale] or [defaultLocale]
  }>;
  experimentalCanonicalLocaleKeys?: boolean; // For composite JSON schemas with locale keys, force canonical locale even when alias provided
};

export type SharedStaticAssetsConfig = {
  include: string | string[];
  outDir?: string;
  publicPath?: string;
  mirrorToLocales?: boolean;
};

export type JsonSchema = {
  preset?: 'mintlify' | 'openapi';

  // exactly 1 of include or composite must be provided; not both

  // specify include if file is not composite
  // multiple target JSONs will be created for each locale,
  // with the only differing content being the specified JSONPath values
  include?: string[]; // array of JSONPaths to include

  // specify composite if no new JSONs should be created
  composite?: {
    // The sourceObjectPath is a JSONPath to the array or object containing
    // content in the source and target locales
    // This value is denoted as the "sourceObject"
    // Array elements or object sub-elements are denoted as "sourceItem"
    [sourceObjectPath: string]: SourceObjectOptions;
  };
};

export type YamlSchema = {
  preset?: 'mintlify' | 'openapi';
  include?: string[];
  transform?: TransformOptions;
};

export type SourceObjectOptions = {
  type: 'array' | 'object'; // type of the sourceObject;
  // array if the sourceObject is an array
  // -> We will simply add duplicated sourceItems for each locale
  // object if the sourceObject is an object
  // -> We will duplicate the sourceItem for each locale and set the corresponding
  // key with the locale property
  // In both cases, we search the sourceObject for the key that matches the source locale

  // Below, relative JSONPaths are relative to the sourceItem root, NOT the sourceObject

  include: string[]; // array of relative JSONPaths to include in the translated JSON

  // if type is array, there must be a key property in the array element
  // corresponding value should be a locale code
  key?: string; // relative jsonPath to the key to use to distinguish between source and target locales
  // if type is object, the key is simply the JSON key for the sourceItem - this is unnecessary in this case

  localeProperty?: string; // specific locale property to use for the key for target locales, default 'code'
  // ex: code, name, nativeName, languageCode, languageName, etc. (values returned by getLocaleProperties)

  // optional config for transforming specific fields in the sourceItem
  // for example, helpful for handling urls with locale-specific paths
  transform?: TransformOptions;

  // optional sorting behavior for array sourceObjects. When set to 'locale',
  // the array will be ordered to match the locales array provided to mergeJson
  // When set to 'localesAlphabetical', the default locale will be placed first
  // and the remaining locales will be ordered alphabetically by locale code
  experimentalSort?: 'locales' | 'localesAlphabetical';
};

export type TransformOptions = {
  // relative jsonPath to content to mutate
  [transformPath: string]: TransformOption;
};
