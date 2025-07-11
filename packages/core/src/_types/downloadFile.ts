// Types for the downloadFile function
export type DownloadFileOptions = {
  projectId?: string;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
};

export type DownloadFileResult = {
  success: boolean;
  content?: string;
  contentType?: string;
  fileName?: string;
  translationId: string;
  error?: string;
};
