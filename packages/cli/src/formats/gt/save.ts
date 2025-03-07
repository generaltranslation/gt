import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { RetrievedTranslations } from '../../types/api';
import { DataFormat } from '../../types/data';
/**
 * Saves translations to a local directory
 * @param translations - The translations to save
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export function saveTranslations(
  translations: RetrievedTranslations,
  translationsDir: string,
  dataFormat: DataFormat,
  fileExtension: string
) {
  for (const translation of translations) {
    const locale = translation.locale;
    const translationData = translation.translation;
    const filepath = path.join(translationsDir, `${locale}.${fileExtension}`);
    // Ensure directory exists
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    // Handle different file types
    if (dataFormat === 'JSX') {
      fs.writeFileSync(filepath, JSON.stringify(translationData, null, 2));
    }
  }
}
