import { FileFormat } from './file';

export type DownloadFileBatchRequest = {
  fileId: string;
  branchId?: string; // Defaults to the default branch.
  versionId?: string; // Defaults to the latest version.
  locale?: string; // Downloads the source file when omitted.
  useLatestAvailableVersion?: boolean; // Falls back to the latest available version when versionId is not found.
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

export type DownloadedFile = {
  id: string;
  branchId: string;
  fileId: string;
  versionId: string;
  locale?: string;
  fileName?: string; // Only present for source files.
  data: string;
  metadata: Record<string, any>;
  fileFormat: FileFormat;
};

export type DownloadFileBatchResult = {
  files: DownloadedFile[];
  count: number;
};
