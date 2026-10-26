import { createDiagnosticMessage } from 'generaltranslation/internal';

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
