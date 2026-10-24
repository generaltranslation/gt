import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';

const missingPreprocessorWarning = createDiagnosticMessage({
  source: 'gt-svelte',
  severity: 'Warning',
  whatHappened:
    '<T> rendered without a translation hash, so it will not be translated',
  why: 'the gt-svelte preprocessor did not run on this component',
  fix: "Add gtPreprocess() from 'gt-svelte/preprocess' to the preprocess array in svelte.config.js",
});

let warnedMissingPreprocessor = false;

/** Warns once in development when `<T>` was not preprocessed. */
export function warnMissingPreprocessor(): void {
  if (process.env.NODE_ENV === 'production' || warnedMissingPreprocessor) {
    return;
  }
  warnedMissingPreprocessor = true;
  console.warn(missingPreprocessorWarning);
}

const createInvalidTranslationWarning = (hash: string | undefined) =>
  createDiagnosticMessage({
    source: 'gt-svelte',
    severity: 'Warning',
    whatHappened:
      'A translation did not match its <T> source, so the source was rendered instead',
    fix: 'Run the gt CLI again to refresh translations',
    details: hash ? `hash ${hash}` : undefined,
  });

/** Warns in development when a translation references unknown content. */
export function warnInvalidTranslation(hash: string | undefined): void {
  if (process.env.NODE_ENV === 'production') return;
  console.warn(createInvalidTranslationWarning(hash));
}

const createLocaleLoadFailedWarning = (locale: string, error: unknown) =>
  createDiagnosticMessage({
    source: 'gt-svelte',
    severity: 'Warning',
    whatHappened: `<GTProvider> could not load translations for "${locale}", so it kept the current locale`,
    fix: 'Check the loadTranslations function passed to initializeGT()',
    details: formatDiagnosticErrorDetails(error),
  });

/** Warns when `<GTProvider>` fails to load the locale it was given. */
export function warnLocaleLoadFailed(locale: string, error: unknown): void {
  console.warn(createLocaleLoadFailedWarning(locale, error));
}

const createMissingProviderTranslationsWarning = (locale: string) =>
  createDiagnosticMessage({
    source: 'gt-svelte',
    severity: 'Warning',
    whatHappened: `<GTProvider locale="${locale}"> rendered the default locale on the server`,
    why: 'it received no translations, and the browser loads them only after hydrating',
    fix: 'Pass translations={data.gt.translations} from a load function that calls loadTranslations()',
  });

const warnedMissingProviderTranslations = new Set<string>();

/**
 * Warns once per locale in development when a server render of
 * `<GTProvider>` has a locale but no translations.
 */
export function warnMissingProviderTranslations(locale: string): void {
  if (
    process.env.NODE_ENV === 'production' ||
    typeof window !== 'undefined' ||
    warnedMissingProviderTranslations.has(locale)
  ) {
    return;
  }
  warnedMissingProviderTranslations.add(locale);
  console.warn(createMissingProviderTranslationsWarning(locale));
}
