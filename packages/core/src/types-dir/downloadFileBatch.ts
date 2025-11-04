import { FileFormat } from './file';
// Types for the downloadFileBatch function

export type DownloadFileBatchRequest = {
  fileId: string;
  branchId?: string; // if not provided, will use the default branch
  versionId?: string; // if not provided, will use the latest version
  locale?: string; // if not provided, will download the source file
}[];

export type DownloadFileBatchOptions = {
  timeout?: number;
};

export type BatchDownloadResult = {
  fileId: string;
  fileName: string;
  success: boolean;
  content?: string;
  contentType?: string;
  error?: string;
};

type File = {
  id: string;
  branchId: string;
  fileId: string;
  versionId: string;
  locale?: string;
  fileName: string;
  data: string;
  metadata: Record<string, any>;
  fileFormat: FileFormat;
};

export type DownloadFileBatchResult = {
  files: File[];
  count: number;
};
