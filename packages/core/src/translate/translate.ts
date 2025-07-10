import {
  TranslationConfig,
  TranslationContent,
  TranslationError,
  TranslationMetadata,
  TranslationResult,
} from '../types';
import { defaultBaseUrl, translateContentUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { translationTimeoutError } from 'src/logging/errors';
import { translationLogger } from '../logging/logger';
import { maxTimeout } from 'src/settings/settings';

/**
 * @internal
 *
 * Translates the content to the target locale.
 *
 * This function handles the core translation logic by making HTTP requests to the GT translation API.
 * It supports both JSX children and ICU message formats as source content, and can be configured
 * with custom API keys, timeouts, and base URLs.
 *
 * @param source - The source content to translate. Can be JSX children or ICU message format.
 * @param targetLocale - The target locale code (e.g., 'es', 'fr', 'de') for translation.
 * @param metadata - Additional metadata about the translation request (context, project info, etc.).
 * @param config - Optional configuration object containing API settings.
 * @returns Promise that resolves to either a TranslationResult or TranslationError.
 **/
export default async function _translate(
  source: TranslationContent,
  targetLocale: string,
  metadata: TranslationMetadata,
  config?: TranslationConfig
): Promise<TranslationResult | TranslationError> {
  let response;
  const timeout = Math.min(config?.timeout || maxTimeout, maxTimeout);
  const sourceMetadata = {
    ...(metadata.id && { id: metadata.id }),
    ...(metadata.hash && { hash: metadata.hash }),
    ...(metadata.context && { context: metadata.context }),
    ...(metadata.dataFormat && { dataFormat: metadata.dataFormat }),
  };
  const requestMetadata = {
    ...(metadata.versionId && { versionId: metadata.versionId }),
    ...(metadata.actionType && { actionType: metadata.actionType }),
    ...(metadata.sourceLocale && { sourceLocale: metadata.sourceLocale }),
  };
  try {
    // Make HTTP POST request to the translation API endpoint
    // Uses the configured base URL or falls back to default
    // For runtime URLs, don't append the standard content URL suffix
    const baseUrl = config?.baseUrl || defaultBaseUrl;
    const isRuntimeUrl = baseUrl.includes('/runtime/');
    const finalUrl = isRuntimeUrl
      ? baseUrl
      : `${baseUrl}${translateContentUrl}`;

    response = await fetchWithTimeout(
      finalUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config?.apiKey && { 'x-gt-api-key': config.apiKey }),
          ...(config?.devApiKey && { 'x-gt-dev-api-key': config.devApiKey }),
        },
        body: JSON.stringify({
          requests: [{ source, metadata: sourceMetadata }],
          targetLocale,
          metadata: requestMetadata,
        }),
      },
      timeout
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      translationLogger.error('Translation request timed out', {
        timeout,
        targetLocale,
      });
      throw new Error(translationTimeoutError(timeout));
    }
    translationLogger.error('Translation request failed', {
      error: error instanceof Error ? error.message : String(error),
      targetLocale,
    });
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    translationLogger.error('Translation API returned error status', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      targetLocale,
    });
    throw new Error(`${response.status}: ${errorText}`);
  }

  const results = (await response.json()) as unknown[];
  const result = results[0] as TranslationResult | TranslationError;

  if ('error' in result) {
    translationLogger.warn('Translation returned error result', {
      error: result.error,
      code: result.code,
    });
  }

  return result;
}
