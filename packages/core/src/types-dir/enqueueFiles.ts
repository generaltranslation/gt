import { DataFormat, JsxChildren } from './content';
import { CompletedFileTranslationData, FileFormat, FileMetadata } from './file';

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
 * @param content - Content of the file
 * @param fileName - Unique identifier for the file (such as the file path + file name)
 * @param fileFormat - The format of the file (JSON, MDX, MD, etc.)
 * @param formatMetadata - Optional metadata for the file, specific to the format of the file
 * @param dataFormat - Optional format of the data within the file
 */
export type FileToTranslate = {
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  formatMetadata?: Record<string, any>;
  dataFormat?: DataFormat;
};

/**
 * Options for enqueueing files
 * @param publish - Whether to publish the files
 * @param requireApproval - Whether to require approval for the files
 * @param description - Optional description for the project
 * @param sourceLocale - The project's source locale
 * @param targetLocales - The locales to translate the files to
 * @param version - Optional custom version ID to specify
 * @param timeout - Optional timeout for the request
 * @param modelProvider - Optional model provider to use
 */
export type EnqueueFilesOptions = {
  publish?: boolean;
  requireApproval?: boolean;
  description?: string; // @deprecated Will be removed in v8.0.0
  sourceLocale?: string;
  targetLocales: string[];
  version?: string;
  _versionId?: string; // @deprecated Will be removed in v8.0.0
  timeout?: number;
  modelProvider?: string;
  force?: boolean;
};

export type RequiredEnqueueFilesOptions = EnqueueFilesOptions &
  Required<Pick<EnqueueFilesOptions, 'sourceLocale'>>;

export type EnqueueFilesResult = {
  translations: CompletedFileTranslationData[];
  data: Record<string, { fileName: string; versionId: string }>;
  locales: string[];
  message: string;
};
