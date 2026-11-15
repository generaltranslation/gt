import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/diagnostics';

/** A message's parts; `warningMessage` and `errorMessage` add the source and severity. */
export type Diagnostic = Omit<DiagnosticMessageInput, 'source' | 'severity'>;

const SOURCE = 'paraglide-context';

/** "paraglide-context Warning: …" */
export function warningMessage(diagnostic: Diagnostic): string {
  return createDiagnosticMessage({
    source: SOURCE,
    severity: 'Warning',
    ...diagnostic,
  });
}

/** "paraglide-context Error: …" */
export function errorMessage(diagnostic: Diagnostic): string {
  return createDiagnosticMessage({
    source: SOURCE,
    severity: 'Error',
    ...diagnostic,
  });
}
