import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { setWritableConditionStore } from '../condition-store/singleton-operations';
import { WritableConditionStore } from '../condition-store/WritableConditionStore';
import { I18nCache } from '../i18n-cache/I18nCache';
import { setI18nCache } from '../i18n-cache/singleton-operations';
import type { I18nCacheConstructorParams } from '../i18n-cache/types';
import type {
  I18nConfigParams,
  LocaleCandidates,
} from '../i18n-config/I18nConfig';
import { initializeI18nConfig } from '../i18n-config/singleton-operations';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import logger from '../logs/logger';

export type InitializeGTParams = I18nConfigParams &
  I18nCacheConstructorParams & {
    /** The locale to start in. Defaults to the default locale. */
    locale?: LocaleCandidates;
  };

/**
 * Sets GT up for a program that serves one user in one locale at a time, such
 * as a script, a worker or an Electron main process, and loads the starting
 * locale's translations. A server that answers requests in several locales
 * uses gt-node.
 *
 * Translations never expire here, so `cacheExpiryTime` is ignored.
 * When the starting locale's translations fail to load, it warns and the
 * program starts in source text, as `initializeGTSPA()` does.
 *
 * @example
 * await initializeGT({ ...gtConfig, loadTranslations, locale: 'de' });
 * t`Save`; // 'Speichern'
 */
export async function initializeGT({
  locale,
  ...config
}: InitializeGTParams): Promise<void> {
  initializeI18nConfig(config);
  const i18nCache = new I18nCache<string>({
    ...config,
    // t and m look translations up synchronously, so an expired locale would render untranslated.
    cacheExpiryTime: null,
  });
  setI18nCache(i18nCache);
  const conditionStore = new WritableConditionStore({ locale });
  setWritableConditionStore(conditionStore);
  const startingLocale = conditionStore.getLocale();
  try {
    await i18nCache.ensureTranslations(startingLocale);
  } catch (error) {
    // The program still starts: there is no earlier locale to stay in.
    logger.warn(
      createGtI18nDiagnostic({
        severity: 'Warning',
        whatHappened: `Could not load translations for the starting locale "${startingLocale}"`,
        wayOut: 'Source text is rendered until setLocale() loads a locale',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }
}
