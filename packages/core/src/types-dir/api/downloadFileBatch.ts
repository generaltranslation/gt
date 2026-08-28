import { FileFormat } from './file';
import type { JsonObject } from './json';
// Types for the downloadFileBatch function

export type DownloadFileBatchRequest =
  import('@generaltranslation/api').DownloadFilesData['body'];

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

// Compatibility type: decoded data and JSON-only metadata differ from the
// generated wire response, whose data is base64 and metadata is unknown.
export type DownloadedFile = {
  id: string;
  branchId: string;
  fileId: string;
  versionId: string;
  locale?: string;
  fileName?: string; // Only present for source files (if locale is not present)
  data: string;
  metadata: JsonObject;
  fileFormat: FileFormat;
};

export type DownloadFileBatchResult = {
  files: DownloadedFile[];
  count: number;
};
