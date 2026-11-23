import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createGlobalSingleton } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';

export type TranslationsSnapshot = Record<Locale, Record<Hash, Content>>;

const translationsSnapshotSingleton =
  /* @__PURE__ */ createGlobalSingleton<TranslationsSnapshot>({
    namespace: 'reactCore',
    key: 'translationsSnapshot',
    notInitialized: () =>
      createDiagnosticMessage({
        source: '@generaltranslation/react-core',
        severity: 'Error',
        whatHappened:
          'Cannot access TranslationsSnapshot before it is initialized',
        fix: 'Initialize GT before reading translations snapshot.',
      }),
  });

export function getGlobalTranslationsSnapshot(): TranslationsSnapshot {
  return translationsSnapshotSingleton.get();
}
export function setGlobalTranslationsSnapshot(
  snapshot: TranslationsSnapshot
): void {
  translationsSnapshotSingleton.set(snapshot);
}
export function isGlobalTranslationsSnapshotInitialized(): boolean {
  return translationsSnapshotSingleton.isInitialized();
}

/**
 * Adds translations to the global snapshot in place, so lookups that already
 * hold the snapshot read them on their next render.
 */
export function updateGlobalTranslationsSnapshot(
  translations: TranslationsSnapshot
): void {
  if (!isGlobalTranslationsSnapshotInitialized()) {
    setGlobalTranslationsSnapshot({});
  }
  const snapshot = getGlobalTranslationsSnapshot();
  for (const locale in translations) {
    snapshot[locale] = Object.assign(
      snapshot[locale] || {},
      translations[locale]
    );
  }
}
