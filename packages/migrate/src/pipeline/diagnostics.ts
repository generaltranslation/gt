import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import type { DiagnosticMessageInput } from 'generaltranslation/internal';

/**
 * gt migrate's diagnostic wrapper. Fixes `source` to 'gt' so every actionable
 * migration failure and warning carries the same prefix and the repository's
 * five-part formatting (what happened, why, fix, way out, details) instead of a
 * hand-assembled string. Callers pass `severity` to match the emitter
 * (io.fatal / a thrown Error use 'Error'; io.warn uses 'Warning'). Routine
 * progress, status, and info output stays plain and does not go through this.
 *
 * The engine ships its own thin wrapper rather than importing one from the CLI
 * because packages/migrate must not depend on the CLI package (the CLI depends
 * on the engine, not the reverse).
 */
export function createMigrateDiagnostic(
  input: Omit<DiagnosticMessageInput, 'source'>
): string {
  return createDiagnosticMessage({ source: 'gt', ...input });
}

export { formatDiagnosticErrorDetails };
