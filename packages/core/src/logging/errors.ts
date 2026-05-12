import { createDiagnosticMessage } from './diagnostics';

const GT_SOURCE = 'GT';

export const translationTimeoutError = (timeout: number) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `Translation request timed out after ${timeout}ms`,
    fix: 'Try again, or increase the request timeout if the source content is large',
  });

export const translationRequestFailedError = (error: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: 'Translation request could not be completed',
    fix: 'Check your network connection and translation credentials, then try again',
    details: error,
  });

export const apiError = (status: number, statusText: string, error: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `The translation API returned ${status} ${statusText}`,
    fix: 'Check the request configuration and try again',
    details: error,
  });

export const invalidAuthError = createDiagnosticMessage({
  source: GT_SOURCE,
  severity: 'Error',
  whatHappened: 'Authentication failed',
  fix: 'Check that your API key and project ID are correct',
});

export const noTargetLocaleProvidedError = (functionName: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `Cannot call \`${functionName}\` without a specified locale`,
    fix: `Pass a locale to \`${functionName}\` or specify targetLocale in the GT constructor`,
  });

export const noSourceLocaleProvidedError = (functionName: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `Cannot call \`${functionName}\` without a specified locale`,
    fix: `Pass a locale to \`${functionName}\` or specify sourceLocale in the GT constructor`,
  });

export const noProjectIdProvidedError = (functionName: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `Cannot call \`${functionName}\` without a specified project ID`,
    fix: `Pass a project ID to \`${functionName}\` or specify projectId in the GT constructor`,
  });

export const noApiKeyProvidedError = (functionName: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `Cannot call \`${functionName}\` without a specified API key`,
    fix: `Pass an API key to \`${functionName}\` or specify apiKey in the GT constructor`,
  });

export const invalidLocaleError = (locale: string) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });

export const invalidLocalesError = (locales: string[]) =>
  createDiagnosticMessage({
    source: GT_SOURCE,
    severity: 'Error',
    whatHappened: `These locales are not valid: ${locales.join(', ')}`,
    fix: 'Use valid BCP 47 locale codes or add custom mappings',
  });
