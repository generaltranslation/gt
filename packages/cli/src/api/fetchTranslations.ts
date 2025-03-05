import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Updates } from '../types';
import { RetrievedTranslations } from '../types/api';

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
        ...(apiKey && { 'x-gt-api-key': apiKey }),
      },
    }
  );
  if (response.ok) {
    const data = await response.json();
    const translations: RetrievedTranslations = data.translations;

    return translations;
  } else {
    console.error(chalk.red('Failed to fetch translations'));
  }
  return [];
}

export function saveSourceFile(filepath: string, data: Updates) {
  // Ensure directory exists
  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  // Convert updates to the proper data format
  const obj: Record<string, any> = {};
  for (const update of data) {
    const { source, metadata } = update;
    const { hash } = metadata;
    obj[hash] = source;
  }

  fs.writeFileSync(filepath, JSON.stringify(obj, null, 2));
  console.log(chalk.green('Source file saved successfully!'));
}
