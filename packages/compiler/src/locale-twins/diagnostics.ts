import { createCompilerDiagnostic } from '../utils/diagnostics';

/** Missing translation hashes per locale (only locales with missing entries). */
export type MissingLocaleTwinTranslations = Record<string, string[]>;

/** Locale codes that cannot be embedded in twin file names. */
export function createInvalidTwinLocaleDiagnostic(locales: string[]): string {
  return createCompilerDiagnostic({
    severity: 'Error',
    whatHappened: 'Locale twins could not be generated',
    why: 'some locale codes contain characters that cannot be part of a file name',
    fix: 'Use BCP 47 locale codes (letters, digits and hyphens) in gt.config.json',
    details: locales.map((locale) => JSON.stringify(locale)),
  });
}

/**
 * Describes translations missing from the locale twins. The twins fall back to
 * the source text for them. Use `'Error'` when the build fails because of
 * them (`localeTwins.missingTranslations: 'error'`), `'Warning'` otherwise.
 */
export function createMissingTranslationsDiagnostic(
  missing: MissingLocaleTwinTranslations,
  severity: 'Error' | 'Warning'
): string {
  const locales = Object.keys(missing);
  const count = locales.reduce(
    (total, locale) => total + missing[locale].length,
    0
  );
  return createCompilerDiagnostic({
    severity,
    whatHappened: `${count} ${count === 1 ? 'translation is' : 'translations are'} missing from the locale twins for ${locales.join(', ')}`,
    reassurance:
      severity === 'Warning'
        ? 'Those entries render the source text'
        : undefined,
    fix: 'Run `gt translate` before `vite build`, or commit up-to-date translation files',
    wayOut:
      severity === 'Error'
        ? "set localeTwins.missingTranslations to 'warn' to build with source text fallbacks"
        : undefined,
    details: locales.map((locale) => `${locale}: ${missing[locale].join(' ')}`),
  });
}
