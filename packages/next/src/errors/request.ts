import { createGtNextDiagnostic } from './diagnostics';

export const createInvalidRequestLocaleWarning = (
  locale: string,
  defaultLocale: string
) =>
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened: `Locale "${locale}" is not valid or is not supported by this app`,
    wayOut: `The default locale "${defaultLocale}" will be used for this request`,
    fix: 'Use a valid BCP 47 locale code, add a custom mapping, or configure the locale in gt-next',
  });
