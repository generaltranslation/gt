import type { ViteLoaderExport } from '../../setupViteSPA.js';
import type { ManualAction } from '../index.js';

/** A loader left unchanged may not read the newly chosen directory. */
export function getLoaderUpdateActions(
  loaderFile: string,
  translationsDir: string,
  previousTranslationsDir: string | undefined,
  custom: boolean
): ManualAction[] {
  if (translationsDir === previousTranslationsDir) return [];
  const fix = `Update ${custom ? 'your custom ' : ''}${loaderFile} to load translations from ${translationsDir}`;
  return [
    {
      whatHappened: custom
        ? `Your custom ${loaderFile} was left unchanged, but translations now go to ${translationsDir}`
        : `${loaderFile} was left unchanged because the React setup was skipped, but translations now go to ${translationsDir}`,
      fix,
    },
  ];
}

/** A custom loader setup preserved, which needs an export initializeGT can pass. */
export function getCustomLoaderAction(
  loaderFile: string,
  translationsDir: string,
  loaderExport: ViteLoaderExport
): ManualAction {
  return loaderExport
    ? {
        whatHappened: `Your custom ${loaderFile} was preserved`,
        fix: `Verify ${loaderFile} loads translations from ${translationsDir}`,
      }
    : {
        whatHappened: `Your custom ${loaderFile} has no runtime loadTranslations export`,
        fix: `Export a default or named loadTranslations function from ${loaderFile} that loads translations from ${translationsDir}, then rerun gt init`,
      };
}
