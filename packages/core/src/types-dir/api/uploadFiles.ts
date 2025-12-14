import { DataFormat } from '../jsx/content';
import { FileFormat, FileReference } from './file';

/**
 * Metadata stored alongside GTJSON file entries.
 * Keys correspond to the entry id/hash in the GTJSON body.
 */
export type GTJsonFormatMetadata = Record<
  string,
  {
    context?: string;
    id?: string;
    domain?: string;
    maxChars?: number;
    dataFormat?: 'JSX' | 'ICU';
    requestVersion?: number;
    approved_at?: string | null;
    approved_by?: string | null;
    hash?: string;
    filePaths?: string[];
  }
>;

export type FileUpload = {
  branchId?: string; // optional branch id. If not provided, will use the default branch.
  incomingBranchId?: string; // optional branch id to use for incoming translations
  checkedOutBranchId?: string; // optional branch id to use for checked out translations
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
  locale: string;
  formatMetadata?: GTJsonFormatMetadata;
  versionId?: string; // Optional versionId. Only use this if you know what you are doing.
  fileId?: string; // Optional fileId. Only use this if you know what you are doing.
};

export type UploadData = {
  data: { source: FileUpload; translations: FileUpload[] }[];
  sourceLocale: string;
  modelProvider?: string;
};

export type UploadFilesOptions = {
  sourceLocale: string;
  modelProvider?: string;
  timeout?: number;
};

export type UploadFilesResponse = {
  uploadedFiles: FileReference[];
  count: number;
  message: string;
};

export type RequiredUploadFilesOptions = UploadFilesOptions &
  Required<Pick<UploadFilesOptions, 'sourceLocale'>>;
