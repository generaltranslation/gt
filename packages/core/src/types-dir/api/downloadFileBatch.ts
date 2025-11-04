import { FileFormat } from './file';
// Types for the downloadFileBatch function

export type DownloadFileBatchOptions = {
  timeout?: number;
};

export type BatchDownloadResult = {
  translationId: string;
  fileName?: string;
  success: boolean;
  content?: string;
  contentType?: string;
  error?: string;
};

type File = {
  id: string;
  fileName: string;
  data: string;
  metadata: any;
  fileFormat: FileFormat;
};

export type DownloadFileBatchResult = {
  files: File[];
  count: number;
};
