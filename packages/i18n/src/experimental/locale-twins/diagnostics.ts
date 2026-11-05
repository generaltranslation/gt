import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/internal';

/** Diagnostic source of messages gt-i18n owns. */
export const GT_I18N_DIAGNOSTIC_SOURCE = 'gt-i18n';

/** Formats a user-facing gt-i18n diagnostic with the `gt-i18n` prefix. */
export function createGtI18nDiagnostic(
  input: Omit<DiagnosticMessageInput, 'source'>
): string {
  return createDiagnosticMessage({
    source: GT_I18N_DIAGNOSTIC_SOURCE,
    ...input,
  });
}
