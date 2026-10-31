import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from '../../logging/diagnostics';

/** Source of the locale twin diagnostics `generaltranslation` owns. */
export const LOCALE_TWIN_DIAGNOSTIC_SOURCE = 'generaltranslation';

/** Formats a locale twin diagnostic owned by `generaltranslation`. */
export function createLocaleTwinDiagnostic(
  input: Omit<DiagnosticMessageInput, 'source'>
): string {
  return createDiagnosticMessage({
    source: LOCALE_TWIN_DIAGNOSTIC_SOURCE,
    ...input,
  });
}
