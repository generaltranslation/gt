import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { RetrievedTranslations } from '../../types/api';
import {
  DataTypes,
  Dictionary,
  Translations,
  TranslationsMetadata,
} from '../../types/data';
/**
 * Saves translations to a local directory
 * @param translations - The translations to save
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export function saveTranslations(
  translations: RetrievedTranslations,
  translationsDir: string,
  dataType: DataTypes,
  fileExtension: string
) {
  for (const translation of translations) {
    console.log(translation);
    const locale = translation.locale;
    const translationData: Translations = translation.translation;
    const translationMetadata: TranslationsMetadata = translation.metadata;
    const filepath = path.join(translationsDir, `${locale}.${fileExtension}`);
    // Ensure directory exists
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    // Handle different file types
    let writeData: string | undefined;
    if (dataType === 'json') {
      // JSONs need to be mapped back to the original format
      const revertedJson: Dictionary = {};
      for (const hash in translationData) {
        const metadata = translationMetadata[hash];
        const entry = translationData[hash];
        if (metadata.id) {
          const keyPath = metadata.id.split('.');
          let current = revertedJson;
          // Process all keys except the last one
          for (let i = 0; i < keyPath.length - 1; i++) {
            const key = keyPath[i];
            // Make sure the current key points to an object
            if (
              !current[key] ||
              typeof current[key] !== 'object' ||
              Array.isArray(current[key])
            ) {
              current[key] = {};
            }
            current = current[key] as Dictionary;
          }
          // Set the value at the last key
          current[keyPath[keyPath.length - 1]] = entry;
        }
      }
      writeData = JSON.stringify(revertedJson, null, 2);
    } else if (dataType === 'yaml' || dataType === 'yml') {
      writeData = yaml.stringify(translationData);
    }

    if (writeData) {
      fs.writeFileSync(filepath, writeData);
    }
  }
}
