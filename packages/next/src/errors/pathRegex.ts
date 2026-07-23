import {
  createGtNextDiagnostic,
  formatDiagnosticErrorDetails,
} from './diagnostics';

export const createInvalidPathRegexError = (
  pathRegex: string,
  error: unknown
) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `pathRegex "${pathRegex}" is not a valid regular expression`,
    fix: 'Pass a valid JavaScript regular expression string to withGTConfig()',
    details: formatDiagnosticErrorDetails(error),
  });
