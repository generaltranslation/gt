import { DataFormat, JsxChildren } from './content';
import { CompletedFileTranslationData, FileFormat } from './file';

// Types for the enqueueTranslationEntries function
export type Updates = ({
  metadata: Record<string, any>;
} & (
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

/**
 * File object structure for enqueueing files
 * @param content - The content of the file
 * @param fileName - The name of the file
 * @param fileFormat - The format of the file (JSON, MDX, MD, etc.)
 * @param dataFormat - The format of the data within the file
 */
export type FileToTranslate = {
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
};

export type EnqueueFilesOptions = {
  publish: boolean;
  description?: string;
  sourceLocale?: string;
  targetLocales: string[];
  _versionId?: string;
  timeout?: number;
};

export type RequiredEnqueueFilesOptions = EnqueueFilesOptions &
  Required<Pick<EnqueueFilesOptions, 'sourceLocale'>>;

export type EnqueueFilesResult = {
  translations: CompletedFileTranslationData[];
  data: Record<string, { fileName: string; versionId: string }>;
  locales: string[];
  message: string;
};
