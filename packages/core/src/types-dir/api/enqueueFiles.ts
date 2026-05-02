import { JsxChildren } from '../jsx/content';

export type Updates = ({
  metadata: Record<string, any> & { staticId?: string };
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
 * Options for enqueuing files.
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
  /** @deprecated Will be removed in v8.0.0. */
  description?: string;
  sourceLocale?: string;
  targetLocales: string[];
  version?: string;
  /** @deprecated Will be removed in v8.0.0. */
  _versionId?: string;
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
