import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/diagnostics';

type GtNextDiagnosticInput = Omit<DiagnosticMessageInput, 'source'>;

export function createGtNextDiagnostic(input: GtNextDiagnosticInput): string {
  return createDiagnosticMessage({
    source: 'gt-next',
    ...input,
  });
}

export function createGtNextPluginDiagnostic(
  input: GtNextDiagnosticInput
): string {
  return createDiagnosticMessage({
    source: 'gt-next (plugin)',
    ...input,
  });
}
