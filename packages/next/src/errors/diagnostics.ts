import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/internal';

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

export function formatDiagnosticErrorDetails(
  error: unknown
): string | undefined {
  if (error == null) return undefined;
  return String(error);
}
