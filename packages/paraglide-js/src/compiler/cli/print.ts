import { errorMessage, type Diagnostic } from '../utils/diagnostics.js';

/** The error, then the usage, on stderr. */
export function printUsageError(diagnostic: Diagnostic, usage: string): void {
  console.error(`${errorMessage(diagnostic)}\n\n${usage}`);
}
