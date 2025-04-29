import fs from 'node:fs';
import path from 'node:path';
import { RetrievedTranslations } from '../../types/api';
import { ResolvedFiles } from '../../types';
import { DataFormat } from '../../types/data';
import { logError, noFilesError } from '../../console/errors';
import { resolveLocaleFiles } from '../../fs/config/parseFilesConfig';
/**
 * Saves translations to a local directory
 * @param translations - The translations to save
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export async function saveTranslations(
  translations: RetrievedTranslations,
  placeholderPaths: ResolvedFiles,
  dataFormat: DataFormat
) {
  for (const translation of translations) {
    const locale = translation.locale;
    const translationFiles = resolveLocaleFiles(placeholderPaths, locale);
    if (!translationFiles.gt) {
      logError(noFilesError);
      process.exit(1);
    }
    const filepath = translationFiles.gt;
    const translationData = translation.translation;
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(filepath), { recursive: true });

    // Handle different file types
    if (dataFormat === 'JSX') {
      await fs.promises.writeFile(
        filepath,
        JSON.stringify(translationData, null, 2)
      );
    }
  }
}
