import chalk from 'chalk';
import { RetrievedTranslations } from '../types/api.js';
import { logError } from '../console/logging.js';
import { getAuthHeaders } from '../utils/headers.js';

/**
 * Fetches translations from the API and saves them to a local directory
 * @param baseUrl - The base URL for the API
 * @param apiKey - The API key for the API
 * @param versionId - The version ID of the project
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export async function fetchTranslations(
  baseUrl: string,
  projectId: string,
  apiKey: string,
  versionId: string
): Promise<RetrievedTranslations> {
  // First fetch the translations from the API
  const response = await fetch(
    `${baseUrl}/v1/project/translations/info/${encodeURIComponent(versionId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(projectId, apiKey),
      },
    }
  );
  if (response.ok) {
    const data = await response.json();
    const translations: RetrievedTranslations = data.translations;

    return translations;
  } else {
    logError(chalk.red('Failed to fetch translations'));
  }
  return [];
}
