import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import { maxTimeout } from '../settings/settings';
import validateResponse from './utils/validateResponse';
import handleFetchError from './utils/handleFetchError';
import { TranslationRequestConfig } from '../types';

// Types for the fetchTranslations function
export type FetchTranslationsOptions = {
  projectId?: string;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
};

export type RetrievedTranslation = {
  locale: string;
  translation: unknown;
  metadata: unknown;
};

export type RetrievedTranslations = RetrievedTranslation[];

export type FetchTranslationsResult = {
  translations: RetrievedTranslations;
  versionId: string;
  projectId: string;
  localeCount: number;
  totalEntries: number;
};

/**
 * @internal
 * Lightweight version of fetchTranslations that abstracts out only the API fetch request.
 * Fetches translation metadata and information without downloading files.
 * @param versionId - The version ID to fetch translations for
 * @param options - The options for the API call
 * @param config - The configuration for the request
 * @returns The translation metadata and information
 */
export default async function _fetchTranslations(
  versionId: string,
  options: FetchTranslationsOptions,
  config: TranslationRequestConfig
): Promise<FetchTranslationsResult> {
  const { projectId, apiKey, baseUrl } = options;
  const timeout = Math.min(config.timeout || options.timeout || maxTimeout, maxTimeout);
  const url = `${baseUrl || config.baseUrl || defaultRuntimeApiUrl}/v1/project/translations/info/${versionId}`;

  // Validation - basic config validation
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  if (!config.apiKey && !apiKey) {
    throw new Error('API key is required');
  }
  if (!versionId) {
    throw new Error('Version ID is required');
  }

  // Request the translation info
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

  // Parse response
  const result = (await response!.json()) as {
    translations: RetrievedTranslations;
    versionId: string;
    projectId: string;
    metadata?: {
      localeCount?: number;
      totalEntries?: number;
    };
  };

  // Calculate summary statistics
  const localeCount = result.translations.length;
  const totalEntries = result.translations.reduce((total, translation) => {
    if (typeof translation.translation === 'object' && translation.translation !== null) {
      return total + Object.keys(translation.translation).length;
    }
    return total + 1;
  }, 0);

  return {
    translations: result.translations,
    versionId: result.versionId,
    projectId: result.projectId,
    localeCount,
    totalEntries,
  };
}