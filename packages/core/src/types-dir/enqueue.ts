import { DataFormat, JsxChildren } from './content';

// Types for the enqueueTranslationEntries function
export type Updates = ({
  metadata: Record<string, unknown>;
} & (
  | {
      dataFormat: 'JSX';
      source: JsxChildren; // JsxChildren from generaltranslation/internal
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

// ApiOptions type that matches sendUpdates interface more closely
export type EnqueueEntriesOptions = {
  timeout?: number;
  sourceLocale?: string;
  targetLocales?: string[];
  dataFormat?: DataFormat;
  version?: string;
  description?: string;
  requireApproval?: boolean;
};

export type EnqueueEntriesResult = {
  versionId: string;
  locales: string[];
  message?: string;
  projectSettings?: {
    cdnEnabled: boolean;
  };
};

/**
 * File object structure for enqueueing files
 * @param content - The content of the file
 * @param fileName - The name of the file
 * @param fileFormat - The format of the file (JSON, MDX, MD, etc.)
 * @param dataFormat - The format of the data within the file
 */
export interface FileToTranslate {
  content: string;
  fileName: string;
  fileFormat: 'GTJSON' | 'JSON' | 'YAML' | 'MDX' | 'MD' | 'TS' | 'JS';
  dataFormat?: 'JSX' | 'ICU' | 'I18NEXT';
}

export type EnqueueFilesOptions = {
  publish: boolean;
  description: string;
  sourceLocale: string;
  targetLocales: string[];
  _versionId: string;
  timeout?: number;
};

export type EnqueueFilesResult = {
  data: unknown;
  locales: string[];
  translations?: unknown;
  message?: string;
};
