import { createDiagnosticMessage } from 'generaltranslation/internal';

/**
 * @param {Omit<Parameters<typeof createDiagnosticMessage>[0], 'source' | 'severity'>} fields
 */
export function createFixtureError(fields) {
  const message = createDiagnosticMessage({
    ...fields,
    source: 'gt-next (auto JSX fixtures)',
    severity: 'Error',
  });
  return new Error(message);
}
