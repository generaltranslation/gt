import { errorMessage, type Diagnostic } from '../utils/diagnostics.js';

/** A line on stdout; lint allows only `console.warn` and `console.error`. */
export function print(message: string): void {
  process.stdout.write(`${message}\n`);
}

/** The error, then the usage, on stderr. */
export function printUsageError(diagnostic: Diagnostic, usage: string): void {
  console.error(`${errorMessage(diagnostic)}\n\n${usage}`);
}
