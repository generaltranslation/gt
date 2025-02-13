export type Updates = (
  | {
      type: 'jsx';
      source: any;
      metadata: Record<string, any>;
    }
  | {
      type: 'content';
      source: any;
      metadata: Record<string, any>;
    }
)[];

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
  enableTimeout: boolean;
  timeout: string;
  publish: boolean;
  translationsDir: string;
};

export type WrapOptions = {
  src: string[];
  config: string;
  disableIds: boolean;
  disableFormatting: boolean;
};

export type Framework = 'gt-next' | 'gt-react';

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
