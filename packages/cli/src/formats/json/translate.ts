import { splitStringToContent } from 'generaltranslation';
import flattenDictionary from '../../react/utils/flattenDictionary';
import getEntryAndMetadata from '../../react/utils/getEntryAndMetadata';
import { hashJsxChildren } from 'generaltranslation/id';
import { SupportedLibraries, Updates } from '../../types';
import { sendUpdates } from '../../api/sendUpdates';
import { defaultBaseUrl } from 'generaltranslation/internal';
import path from 'path';
import { fetchTranslations } from '../../api/fetchTranslations';
import { saveTranslations } from './save';
import { DataTypes } from '../../types/data';

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
  defaultLocale: string,
  locales: string[],
  library: SupportedLibraries,
  apiKey: string,
  projectId: string,
  config: string,
  translationsDir: string,
  fileType: DataTypes
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

  const outputDir = path.dirname(translationsDir);
  // Actually do the translation
  const updateResponse = await sendUpdates(updates, {
    apiKey,
    projectId,
    defaultLocale,
    locales,
    baseUrl: defaultBaseUrl,
    config,
    publish: false,
    wait: true,
    timeout: '600',
    translationsDir: outputDir,
  });

  if (updateResponse?.versionId) {
    const translations = await fetchTranslations(
      defaultBaseUrl,
      apiKey,
      updateResponse.versionId
    );
    saveTranslations(translations, outputDir, fileType, 'json');
  }
}
