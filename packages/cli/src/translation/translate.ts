import { fetchTranslations } from '../api/fetchTranslations.js';
import { Options, Settings } from '../types/index.js';
import { waitForUpdates } from '../api/waitForUpdates.js';
import { saveTranslations } from '../formats/gt/save.js';
import { isUsingLocalTranslations } from '../config/utils.js';

export async function translate(
  settings: Options & Settings,
  versionId: string
) {
  // timeout was validated earlier
  const startTime = Date.now();
  const timeout = parseInt(settings.timeout) * 1000;

  const result = await waitForUpdates(versionId, startTime, timeout);

  if (!result) {
    process.exit(1);
  }

  const translations = await fetchTranslations(versionId);

  // Save translations to local directory if files.gt.output is provided
  if (settings.files && isUsingLocalTranslations(settings)) {
    await saveTranslations(translations, settings.files.placeholderPaths);
  }
}
