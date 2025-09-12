import { DataFormat } from './content';
import { FileFormat } from './file';

export type FileUpload = {
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
  locale: string;
};

export type FileUploadRef = {
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
