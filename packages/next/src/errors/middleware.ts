import { getLocaleProperties } from '@generaltranslation/format';
import { createGtNextDiagnostic } from './diagnostics';

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `gt-next: The following locales are currently unsupported by our service: ${locales
    .map((locale) => {
      const { name } = getLocaleProperties(locale);
      return `${locale} (${name})`;
    })
    .join(', ')}`;

export const createInvalidMiddlewareDefaultLocaleError = (
  defaultLocale: string
) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `The middleware defaultLocale "${defaultLocale}" is not a valid locale`,
    fix: 'Set defaultLocale in withGTConfig() to a valid BCP 47 locale code',
  });

export const createLinkRoutingConfigMismatchWarning = (options: string[]) =>
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened: `createNextMiddleware() and withGTConfig() set different values for ${options.join(', ')}`,
    why: 'gt-next/link reads these options from withGTConfig(), so its links may redirect',
    fix: 'Set these options in withGTConfig() instead of createNextMiddleware()',
  });
