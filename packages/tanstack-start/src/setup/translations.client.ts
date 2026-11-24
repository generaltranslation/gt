import {
  getI18nConfig,
  getGlobalTranslationsSnapshot,
  getTranslationsSnapshot,
  isGlobalTranslationsSnapshotInitialized,
  loadTranslationsSnapshot,
  lookupGlobalSnapshotTranslation,
  updateGlobalTranslationsSnapshot,
  type TranslationsSnapshot,
} from '@generaltranslation/react-core/pure';
import { loadCreateGTParams, type CreateGTParams } from 'gt-i18n/internal';
import {
  config as pluginConfig,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';

const snapshotLoads = new Map<string, Promise<void>>();

/** Loads a locale into the global translations snapshot once. */
function loadIntoSnapshot(locale: string): Promise<void> {
  if (
    isGlobalTranslationsSnapshotInitialized() &&
    getGlobalTranslationsSnapshot()[locale]
  ) {
    return Promise.resolve();
  }
  let load = snapshotLoads.get(locale);
  if (!load) {
    load = loadTranslationsSnapshot(
      {
        ...pluginConfig,
        loadTranslations: pluginLoadTranslations,
        projectId: getI18nConfig().getProjectId(),
      },
      locale
    ).then(updateGlobalTranslationsSnapshot);
    snapshotLoads.set(locale, load);
  }
  return load;
}

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
        await loadIntoSnapshot(locale);
        return { [locale]: getGlobalTranslationsSnapshot()[locale] };
      }
    : getTranslationsSnapshot;

/** Loads the locale's translations, then returns params bound to it. */
export const loadClientGTParams: typeof loadCreateGTParams =
  process.env.NODE_ENV === 'production'
    ? async ({ locale, enableI18n }): Promise<CreateGTParams> => {
        await loadIntoSnapshot(
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
