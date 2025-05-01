import { fetchTranslations } from '../api/fetchTranslations';
import { Options, Settings } from '../types';
import { waitForUpdates } from '../api/waitForUpdates';
import { saveTranslations } from '../formats/gt/save';

export async function translate(
  settings: Options & Settings,
  versionId: string
) {
  // timeout was validated earlier
  const startTime = Date.now();
  const timeout = parseInt(settings.timeout) * 1000;

  const result = await waitForUpdates(
    settings.apiKey,
    settings.baseUrl,
    versionId,
    startTime,
    timeout
  );

  if (!result) {
    process.exit(1);
  }

  const translations = await fetchTranslations(
    settings.baseUrl,
    settings.apiKey,
    versionId
  );

  // Save translations to local directory if files.gt.output is provided
  if (settings.files && settings.files.placeholderPaths.gt) {
    await saveTranslations(
      translations,
      settings.files.placeholderPaths,
      'JSX'
    );
  }
}
