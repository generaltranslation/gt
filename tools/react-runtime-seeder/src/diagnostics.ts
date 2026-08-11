import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';

const source = 'gt-react-seed';

export function createSeederError({
  whatHappened,
  why,
  fix,
  details,
}: {
  whatHappened: string;
  why?: string;
  fix?: string;
  details?: string;
}): Error {
  return new Error(
    createDiagnosticMessage({
      source,
      severity: 'Error',
      whatHappened,
      why,
      fix,
      details,
    })
  );
}

export function createUnexpectedSeederError(error: unknown): Error {
  return createSeederError({
    whatHappened: 'The React runtime seed could not be captured',
    fix: 'Check that the input exports a renderable React component and only uses server-renderable values.',
    details: formatDiagnosticErrorDetails(error),
  });
}
