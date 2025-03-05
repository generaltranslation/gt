import { splitStringToContent } from 'generaltranslation';
import flattenDictionary from '../../react/utils/flattenDictionary';
import getEntryAndMetadata from '../../react/utils/getEntryAndMetadata';
import { hashJsxChildren } from 'generaltranslation/id';
import { Settings, SupportedLibraries, Updates } from '../../types';
import { sendUpdates } from '../../api/sendUpdates';
import { defaultBaseUrl } from 'generaltranslation/internal';
import path from 'path';
import { fetchTranslations } from '../../api/fetchTranslations';
import { saveTranslations } from './save';
import { DataFormat, FileExtension } from '../../types/data';
import { noTranslationsDirError } from '../../console/errors';

/**
 * Translates a JSON object and saves the translations to a local directory
 * @param sourceJson - The source JSON object
 * @param defaultLocale - The default locale
 * @param locales - The locales to translate to
 * @param library - The library to use
 * @param apiKey - The API key for the General Translation API
 * @param projectId - The project ID
 * @param config - The config file path
 * @param translationsDir - The directory to save the translations to
 * @param fileType - The file type to save the translations as (file extension)
 */
export async function translateJson(
  sourceJson: any,
  settings: Settings,
  dataFormat: DataFormat,
  fileExtension: FileExtension
) {
  const flattened = flattenDictionary(sourceJson);
  const updates: Updates = [];
  for (const id of Object.keys(flattened)) {
    const source = flattened[id];
    const content = Array.isArray(source) ? source[0] : source;
    const metadata: Record<string, any> = {
      id,
      // This hash isn't actually used by the GT API, just for consistency sake
      hash: hashJsxChildren({
        source: content,
        ...(id && { id }),
      }),
    };
    updates.push({
      type: 'jsx',
      source,
      metadata,
    });
  }
  if (!settings.translationsDir) {
    console.error(noTranslationsDirError);
    process.exit(1);
  }

  const outputDir = path.dirname(settings.translationsDir);

  // Actually do the translation
  const updateResponse = await sendUpdates(updates, {
    ...settings,
    publish: false,
    wait: true,
    timeout: '600',
    translationsDir: outputDir,
    dataFormat,
  });

  if (updateResponse?.versionId) {
    const translations = await fetchTranslations(
      settings.baseUrl,
      settings.apiKey,
      updateResponse.versionId
    );
    saveTranslations(translations, outputDir, dataFormat, fileExtension);
  }
}
