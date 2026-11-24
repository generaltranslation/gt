import {
  getI18nConfig,
  getGlobalTranslationsSnapshot,
  getTranslationsSnapshot,
  loadGlobalTranslationsSnapshot,
  lookupGlobalSnapshotTranslation,
  updateGlobalTranslationsSnapshot,
  type TranslationsSnapshot,
} from '@generaltranslation/react-core/pure';
import { loadCreateGTParams, type CreateGTParams } from 'gt-i18n/internal';

/**
 * A locale's translations for the router state. Production clients keep them
 * in the global translations snapshot, which the browser's getGT() and
 * getMessages() read, so they create no i18nCache. A locale change reloads
 * the page, so the snapshot holds the page's locale.
 */
export const loadClientTranslations: (
  locale: string
) => Promise<TranslationsSnapshot> =
  process.env.NODE_ENV === 'production'
    ? async (locale) => {
        await loadGlobalTranslationsSnapshot(locale);
        // The live snapshot, so the provider sees a later load that recovers.
        return getGlobalTranslationsSnapshot();
      }
    : getTranslationsSnapshot;

/** Loads the locale's translations, then returns params bound to it. */
export const loadClientGTParams: typeof loadCreateGTParams =
  process.env.NODE_ENV === 'production'
    ? async ({ locale, enableI18n }): Promise<CreateGTParams> => {
        await loadGlobalTranslationsSnapshot(
          enableI18n ? locale : getI18nConfig().getDefaultLocale()
        );
        return {
          getLocale: () => locale,
          getEnableI18n: () => enableI18n,
          lookupTranslation: lookupGlobalSnapshotTranslation,
        };
      }
    : loadCreateGTParams;

/** Adds the server's translations to the snapshot, in production. */
export function hydrateClientTranslations(
  translations: TranslationsSnapshot
): void {
  if (process.env.NODE_ENV === 'production') {
    updateGlobalTranslationsSnapshot(translations);
  }
}
