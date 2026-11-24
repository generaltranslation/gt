import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { getWritableConditionStore } from '../condition-store/singleton-operations';
import { createGlobalSingleton } from '../globals/createGlobalSingleton';
import { getI18nCache } from '../i18n-cache/singleton-operations';
import type { LocaleCandidates } from '../i18n-config/I18nConfig';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import logger from '../logs/logger';

type LocaleListener = (locale: string) => void;

// Global like the locale itself, so the CommonJS and the ES module build of
// this file agree on who is listening and on which change is the latest.
const localeChanges = createGlobalSingleton<{
  listeners: Set<LocaleListener>;
  latest: number;
}>({
  namespace: 'i18n',
  key: 'localeChanges',
  notInitialized: () => 'No locale change has been made',
});

function getLocaleChanges() {
  if (!localeChanges.isInitialized()) {
    localeChanges.set({ listeners: new Set(), latest: 0 });
  }
  return localeChanges.get();
}

/**
 * Change the current locale, in a program set up with `initializeGT()` from
 * `gt-i18n/standalone`. The locale changes once its translations have loaded,
 * so `t` and `m` never render a locale that is still loading. When calls
 * overlap, the latest one wins. When the translations fail to load, the
 * promise rejects and the locale stays as it was.
 * @param locale - The locale to change to, or locales in order of preference
 *
 * @example
 * await setLocale('de');
 * t`Save`; // 'Speichern'
 */
export async function setLocale(
  locale: NonNullable<LocaleCandidates>
): Promise<void> {
  const nextLocale = getI18nConfig().resolveSupportedLocale(locale);
  const conditionStore = getWritableConditionStore();
  const changes = getLocaleChanges();
  const change = ++changes.latest;
  const newlyLoaded = await getI18nCache().ensureTranslations(nextLocale);
  // A later call has taken over, or initializeGT() has replaced the store this change was for.
  if (
    change !== changes.latest ||
    conditionStore !== getWritableConditionStore()
  ) {
    return;
  }
  // The current locale, newly loaded, was rendering source text: its load failed when GT was set up.
  if (conditionStore.getLocale() === nextLocale && !newlyLoaded) return;
  conditionStore.setLocale(nextLocale);
  // A copy, so a listener added by a listener waits for the next change. The locale has changed by now, so one that throws is reported and the rest still run.
  for (const listener of Array.from(changes.listeners)) {
    try {
      listener(nextLocale);
    } catch (error) {
      logger.error(
        createGtI18nDiagnostic({
          severity: 'Error',
          whatHappened: 'A locale change listener threw an error',
          reassurance: `The locale has changed to "${nextLocale}"`,
          details: formatDiagnosticErrorDetails(error),
        })
      );
    }
  }
}

/**
 * Run a function after each change of locale made with `setLocale()`, for
 * text that was already produced, such as a native menu. That includes the
 * starting locale loading at last, after it failed to in `initializeGT()`.
 * @returns A function that stops the calls
 *
 * @example
 * const stop = onLocaleChange(() => rebuildMenu());
 */
export function onLocaleChange(listener: LocaleListener): () => void {
  const { listeners } = getLocaleChanges();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
