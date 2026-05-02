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
    dataFormat?: 'JSX' | 'ICU' | 'I18NEXT';
    requestVersion?: number;
    approved_at?: string | null;
    approved_by?: string | null;
    hash?: string;
    staticId?: string;
    filePaths?: string[];
  }
>;

export type FileUpload = {
  branchId?: string; // Optional branch ID. Defaults to the default branch.
  incomingBranchId?: string; // Optional branch ID for incoming translations.
  checkedOutBranchId?: string; // Optional branch ID for checked-out translations.
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  // Optional output format requested for generated translations.
  transformFormat?: FileFormat;
  dataFormat?: DataFormat;
  locale: string;
  formatMetadata?: GTJsonFormatMetadata;
  versionId?: string; // Optional version ID. Only use when preserving an existing version.
  fileId?: string; // Optional file ID. Only use when preserving an existing file.
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
