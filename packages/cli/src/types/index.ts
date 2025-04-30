import { JsxChildren } from 'generaltranslation/internal';
import { SUPPORTED_FILE_EXTENSIONS } from '../formats/files/supportedFiles';

export type Updates = ({ metadata: Record<string, any> } & (
  | {
      dataFormat: 'JSX';
      source: JsxChildren;
    }
  | {
      dataFormat: 'ICU';
      source: string;
    }
  | {
      dataFormat: 'I18NEXT';
      source: string;
    }
))[];

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
  dryRun: boolean;
  wait: boolean;
  timeout: string;
  publish: boolean;
  requireApproval?: boolean;
};

export type WrapOptions = {
  src: string[];
  config: string;
  disableIds: boolean;
  disableFormatting: boolean;
  addGTProvider: boolean;
};

export type SetupOptions = {
  src: string[];
  config: string;
};

export type GenerateSourceOptions = {
  src: string[];
  config: string;
  defaultLocale: string;
  dictionary?: string;
  jsconfig?: string;
  inline?: boolean;
  ignoreErrors: boolean;
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
        resolvedPaths: ResolvedFiles; // resolved paths for the default locale
        placeholderPaths: ResolvedFiles; // placeholder paths for all locales containing [locale]
        transformPaths: TransformFiles; // transform paths for all locales containing [locale]
      }
    | undefined;
  requireApproval: boolean;
  versionId?: string;
  description?: string;
  src?: string[]; // src directory for gt-next and gt-react
};
