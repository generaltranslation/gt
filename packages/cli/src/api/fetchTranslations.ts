import chalk from 'chalk';
import { RetrievedTranslations } from 'generaltranslation/types';
import { logError } from '../console/logging.js';
import { gt } from '../utils/gt.js';

/**
 * Fetches translations from the API and saves them to a local directory
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export async function fetchTranslations(
  versionId: string
): Promise<RetrievedTranslations> {
  try {
    const result = await gt.fetchTranslations(versionId);
    return result.translations;
  } catch {
    logError(chalk.red('Failed to fetch translations'));
    return [];
  }
}
