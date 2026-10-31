import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/internal';

type GtI18nDiagnosticInput = Omit<DiagnosticMessageInput, 'source'>;

export function createGtI18nDiagnostic(input: GtI18nDiagnosticInput): string {
  return createDiagnosticMessage({
    source: 'gt-i18n',
    ...input,
  });
}
