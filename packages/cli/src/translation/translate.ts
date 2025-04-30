import { fetchTranslations } from '../api/fetchTranslations';
import { Options, Settings } from '../types';
import { waitForUpdates } from '../api/waitForUpdates';
import { saveTranslations } from '../formats/gt/save';

export async function translate(
  settings: Options & Settings,
  versionId: string,
  locales: string[]
) {
  const filteredLocales = locales.filter(
    (locale) => locale !== settings.defaultLocale
  );

  // Wait for translations if wait is true
  if (settings.wait && locales) {
    // timeout was validated earlier
    const startTime = Date.now();
    const timeout = parseInt(settings.timeout) * 1000;
    await waitForUpdates(
      settings.apiKey,
      settings.baseUrl,
      versionId,
      filteredLocales,
      startTime,
      timeout
    );
  }

  // Save translations to local directory if files.gt.output is provided
  if (settings.files && settings.files.placeholderPaths.gt) {
    const translations = await fetchTranslations(
      settings.baseUrl,
      settings.apiKey,
      versionId
    );
    await saveTranslations(
      translations,
      settings.files.placeholderPaths,
      'JSX'
    );
  }
}
