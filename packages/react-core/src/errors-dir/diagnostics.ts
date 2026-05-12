import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
  type DiagnosticMessageInput,
} from 'generaltranslation/internal';
import { PACKAGE_NAME } from './constants';

type ReactCoreDiagnosticInput = Omit<DiagnosticMessageInput, 'source'>;

export function createReactCoreDiagnostic(
  input: ReactCoreDiagnosticInput
): string {
  return createDiagnosticMessage({
    source: PACKAGE_NAME,
    ...input,
  });
}

export { formatDiagnosticErrorDetails };
