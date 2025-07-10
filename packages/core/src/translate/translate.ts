import {
  TranslationConfig,
  TranslationError,
  TranslationMetadata,
  JsxChildren,
  IcuMessage,
  TranslationResult,
} from '../types';
import { defaultBaseUrl, translateContentUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { translationTimeoutError } from 'src/errors';
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
  source: JsxChildren | IcuMessage,
  targetLocale: string,
  metadata: TranslationMetadata,
  config?: TranslationConfig
): Promise<TranslationResult | TranslationError> {
  let response;
  const timeout = Math.min(config?.timeout || maxTimeout, maxTimeout);
  try {
    // Make HTTP POST request to the translation API endpoint
    // Uses the configured base URL or falls back to default
    response = await fetchWithTimeout(
      `${config?.baseUrl || defaultBaseUrl}${translateContentUrl}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config?.apiKey && { 'x-gt-api-key': config.apiKey }),
          ...(config?.devApiKey && { 'x-gt-dev-api-key': config.devApiKey }),
        },
        body: JSON.stringify({
          source,
          targetLocale,
          metadata,
        }),
      },
      timeout
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(translationTimeoutError(timeout));
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  return result as TranslationResult | TranslationError;
}
