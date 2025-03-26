import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { RetrievedTranslations } from '../../types/api';
import {
  DataFormat,
  Dictionary,
  FileExtension,
  Translations,
  TranslationsMetadata,
} from '../../types/data';
import { resolveLocaleFiles } from '../../fs/config/parseFilesConfig';
import { noFilesError } from '../../console/errors';
import { ResolvedFiles } from '../../types';
/**
 * Saves translations to a file
 * @param translations - The translations to save
 * @param filePath - The file path to save the translations to
 * @param dataFormat - The data format to save the translations as
 * @deprecated Use saveFiles instead
 */
export function saveTranslations(
  translations: RetrievedTranslations,
  placeholderPaths: ResolvedFiles,
  dataFormat: DataFormat
) {
  for (const translation of translations) {
    const locale = translation.locale;
    const translationFiles = resolveLocaleFiles(placeholderPaths, locale);

    if (!translationFiles.json) {
      console.error(noFilesError);
      process.exit(1);
    }

    const translationData: Translations = translation.translation;
    const translationMetadata: TranslationsMetadata = translation.metadata;

    // Ensure directory exists
    fs.mkdirSync(path.dirname(translationFiles.json[0]), { recursive: true });

    // Handle different file types
    let writeData: string | undefined;
    if (
      dataFormat === 'ICU' ||
      dataFormat === 'I18NEXT' ||
      dataFormat === 'JSX'
    ) {
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
    }
    // else if (dataFormat === 'yaml') {
    //   writeData = yaml.stringify(translationData);
    // }
    if (writeData) {
      fs.writeFileSync(translationFiles.json[0], writeData);
    }
  }
}
