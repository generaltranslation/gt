import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { createGtNextDiagnostic } from './diagnostics';

export const createInvalidEnvConfigError = (envName: string, error: unknown) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `${envName} is not valid JSON`,
    reassurance: 'gt-next ignores this variable and uses its defaults',
    fix: 'Configure gt-next through withGTConfig() instead of setting this variable manually',
    details: formatDiagnosticErrorDetails(error),
  });
