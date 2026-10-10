import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/diagnostics';

// A diagnostic message from this package.
export const createGtPayloadDiagnostic = (
  input: Omit<DiagnosticMessageInput, 'source'>
): string => createDiagnosticMessage({ source: 'gt-payload', ...input });
