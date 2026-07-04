import type { DataFormat, JsxChildren } from '@generaltranslation/format/types';

type UpdateMetadata = {
  id?: string;
  hash?: string;
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
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
