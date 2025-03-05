import { Updates } from '../types';
/**
 * Fetches translations from the API and saves them to a local directory
 * @param baseUrl - The base URL for the API
 * @param apiKey - The API key for the API
 * @param versionId - The version ID of the project
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export default function saveTranslations(baseUrl: string, apiKey: string, versionId: string, translationsDir: string, fileType: 'json' | 'yaml' | 'yml'): Promise<void>;
export declare function saveSourceFile(filepath: string, data: Updates): void;
