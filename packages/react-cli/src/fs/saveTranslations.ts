import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { Updates } from '../types';

export default async function saveTranslations(
  baseUrl: string,
  apiKey: string,
  versionId: string,
  translationsDir: string
) {
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
    const translations: { locale: string; translation: any }[] =
      data.translations;
    for (const translation of translations) {
      const locale = translation.locale;
      const translationData = translation.translation;
      const filepath = path.join(translationsDir, `${locale}.json`);
      // Ensure directory exists
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, JSON.stringify(translationData, null, 2));
    }
    console.log(chalk.green('Translations saved successfully!'));
  } else {
    console.error(chalk.red('Failed to fetch translations'));
  }
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
