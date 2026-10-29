import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from '../logging/diagnostics';

/** Formats a locale twin diagnostic owned by `generaltranslation`. */
export function createLocaleTwinDiagnostic(
  input: Omit<DiagnosticMessageInput, 'source'>
): string {
  return createDiagnosticMessage({ source: 'generaltranslation', ...input });
}
