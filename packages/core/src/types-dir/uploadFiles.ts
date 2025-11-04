import { DataFormat } from './content';
import { FileFormat } from './file';

export type FileUpload = {
  branchId?: string; // if not provided, will use the default branch
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
  locale: string;
  versionId?: string; // Optional versionId. Only use this if you know what you are doing.
  fileId?: string; // Optional fileId. Only use this if you know what you are doing.
};

export type FileUploadRef = {
  branchId: string;
  fileId: string;
  versionId: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
  locale?: string;
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
  uploadedFiles: FileUploadRef[];
  count: number;
  message: string;
};

export type RequiredUploadFilesOptions = UploadFilesOptions &
  Required<Pick<UploadFilesOptions, 'sourceLocale'>>;
