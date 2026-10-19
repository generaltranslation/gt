import { getLocaleProperties } from '@generaltranslation/format';
import {
  createGtNextDiagnostic,
  formatDiagnosticErrorDetails,
} from './diagnostics';

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `gt-next: The following locales are currently unsupported by our service: ${locales
    .map((locale) => {
      const { name } = getLocaleProperties(locale);
      return `${locale} (${name})`;
    })
    .join(', ')}`;

export const createInvalidMiddlewareEnvConfigError = (
  envName: string,
  error: unknown
) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `${envName} is not valid JSON`,
    wayOut: 'Middleware ignores this config and uses the defaults',
    fix: 'Configure gt-next through withGTConfig() instead of setting this variable manually',
    details: formatDiagnosticErrorDetails(error),
  });
