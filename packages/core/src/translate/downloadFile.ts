import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';

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

/**
 * @internal
 * Lightweight version of downloadFile that abstracts out only the API fetch request.
 * Downloads a single translation file content without writing to filesystem.
 * @param translationId - The ID of the translation to download
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The downloaded file content and metadata
 */
export default async function _downloadFile(
  translationId: string,
  options: DownloadFileOptions,
  config: TranslationRequestConfig
): Promise<DownloadFileResult> {
  const { 
    projectId, 
    apiKey, 
    baseUrl, 
    maxRetries = 3, 
    retryDelay = 1000 
  } = options;
  const timeout = Math.min(config.timeout || options.timeout || maxTimeout, maxTimeout);
  const url = `${baseUrl || config.baseUrl || defaultRuntimeApiUrl}/v1/project/translations/files/${translationId}/download`;

  // Validation - basic config validation
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  if (!config.apiKey && !apiKey) {
    throw new Error('API key is required');
  }
  if (!translationId) {
    throw new Error('Translation ID is required');
  }

  // Retry logic
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Request the file download
      let response;
      try {
        response = await fetchWithTimeout(
          url,
          {
            method: 'GET',
            headers: {
              ...((apiKey || config.apiKey) && {
                'x-gt-api-key': apiKey || config.apiKey,
              }),
              'x-gt-project-id': projectId,
            },
          },
          timeout
        );
      } catch (error) {
        handleFetchError(error, timeout);
      }

      // Validate response
      await validateResponse(response!);

      // Get content type and filename from headers
      const contentType = response!.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response!.headers.get('content-disposition');
      let fileName: string | undefined;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          fileName = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Get the content
      const content = await response!.text();

      return {
        success: true,
        content,
        contentType,
        fileName,
        translationId,
      };

    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  // All retries failed
  return {
    success: false,
    translationId,
    error: lastError?.message || 'Unknown error occurred',
  };
}