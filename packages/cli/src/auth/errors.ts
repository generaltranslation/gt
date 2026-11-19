import { UserAuthError } from '@generaltranslation/auth';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';

export function createUserAuthError(
  whatHappened: string,
  error: unknown
): string {
  if (error instanceof UserAuthError) return error.message;
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened,
    details: formatDiagnosticErrorDetails(error),
    fix: 'Run `gt login` and try again',
  });
}
