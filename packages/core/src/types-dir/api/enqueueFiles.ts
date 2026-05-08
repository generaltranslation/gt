import { DataFormat, JsxChildren } from '../jsx/content';

type UpdateMetadata = {
  id?: string;
  hash?: string;
  context?: string;
  maxChars?: number;
  dataFormat?: DataFormat;
  actionType?: 'standard' | 'fast' | string;
  staticId?: string;
  format?: string;
  filePaths?: string[];
  sourceCode?: unknown;
  contextDeriveExpr?: unknown;
  _contextDeriveExpr?: unknown;
  [key: string]: unknown;
};

// Types for the enqueueTranslationEntries function
export type Updates = ({
  metadata: UpdateMetadata;
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
  | {
      dataFormat: 'STRING';
      source: string;
    }
))[];

/**
 * Options for enqueueing files
 * @param requireApproval - Whether to require approval for the files.
 * @param description - Optional description for the project.
 * @param sourceLocale - The project's source locale.
 * @param targetLocales - The locales to translate the files to.
 * @param version - Optional custom version ID to specify.
 * @param timeout - Optional timeout for the request.
 * @param modelProvider - Optional model provider to use.
 */
export type EnqueueFilesOptions = {
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
  jobData: {
    [jobId: string]: {
      sourceFileId: string;
      fileId: string;
      versionId: string;
      branchId: string;
      targetLocale: string;
      projectId: string;
      force: boolean;
      modelProvider?: string;
    };
  };
  locales: string[];
  message: string;
};
