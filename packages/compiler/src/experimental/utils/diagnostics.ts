import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
  type DiagnosticMessageInput,
} from 'generaltranslation/internal';

export const COMPILER_DIAGNOSTIC_SOURCE = '@generaltranslation/compiler';

type CompilerDiagnosticInput = Omit<DiagnosticMessageInput, 'source'>;

/**
 * Formats a user-facing compiler message with the
 * `@generaltranslation/compiler` source prefix.
 */
export function createCompilerDiagnostic(
  input: CompilerDiagnosticInput
): string {
  return createDiagnosticMessage({
    source: COMPILER_DIAGNOSTIC_SOURCE,
    ...input,
  });
}

export { formatDiagnosticErrorDetails };
