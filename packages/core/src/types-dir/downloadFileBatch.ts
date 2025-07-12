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

export type DownloadFileBatchResult = {
  results: Array<{
    translationId: string;
    fileName?: string;
    success: boolean;
    content?: string;
    contentType?: string;
    error?: string;
  }>;
};
