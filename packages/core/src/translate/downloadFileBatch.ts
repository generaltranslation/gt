import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';

// Types for the downloadFileBatch function
export type BatchDownloadFile = {
  translationId: string;
  fileName?: string;
};

export type DownloadFileBatchOptions = {
  projectId?: string;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
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
  results: BatchDownloadResult[];
  successful: BatchDownloadResult[];
  failed: BatchDownloadResult[];
  successCount: number;
  failureCount: number;
};

/**
 * @internal
 * Lightweight version of downloadFileBatch that abstracts out only the API fetch request.
 * Downloads multiple translation files in a single batch request.
 * @param files - Array of files to download
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The batch download results with success/failure tracking
 */
export default async function _downloadFileBatch(
  files: BatchDownloadFile[],
  options: DownloadFileBatchOptions,
  config: TranslationRequestConfig
): Promise<DownloadFileBatchResult> {
  const { 
    projectId, 
    apiKey, 
    baseUrl, 
    maxRetries = 3, 
    retryDelay = 1000 
  } = options;
  const timeout = Math.min(config.timeout || options.timeout || maxTimeout, maxTimeout);
  const url = `${baseUrl || config.baseUrl || defaultRuntimeApiUrl}/v1/project/translations/files/batch-download`;

  // Validation - basic config validation
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  if (!config.apiKey && !apiKey) {
    throw new Error('API key is required');
  }
  if (!files || files.length === 0) {
    throw new Error('Files array is required and must not be empty');
  }

  // Build request body
  const body = {
    files: files.map(file => ({
      translationId: file.translationId,
      fileName: file.fileName,
    })),
    projectId,
  };

  // Retry logic
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Request the batch download
      let response;
      try {
        response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...((apiKey || config.apiKey) && {
                'x-gt-api-key': apiKey || config.apiKey,
              }),
              'x-gt-project-id': projectId,
            },
            body: JSON.stringify(body),
          },
          timeout
        );
      } catch (error) {
        handleFetchError(error, timeout);
      }

      // Validate response
      await validateResponse(response!);

      // Parse response
      const result = (await response!.json()) as {
        results: Array<{
          translationId: string;
          fileName?: string;
          success: boolean;
          content?: string;
          contentType?: string;
          error?: string;
        }>;
      };

      // Process results
      const results: BatchDownloadResult[] = result.results.map(item => ({
        translationId: item.translationId,
        fileName: item.fileName,
        success: item.success,
        content: item.content,
        contentType: item.contentType,
        error: item.error,
      }));

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return {
        results,
        successful,
        failed,
        successCount: successful.length,
        failureCount: failed.length,
      };

    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  // All retries failed - return all files as failed
  const failedResults: BatchDownloadResult[] = files.map(file => ({
    translationId: file.translationId,
    fileName: file.fileName,
    success: false,
    error: lastError?.message || 'Unknown error occurred',
  }));

  return {
    results: failedResults,
    successful: [],
    failed: failedResults,
    successCount: 0,
    failureCount: failedResults.length,
  };
}