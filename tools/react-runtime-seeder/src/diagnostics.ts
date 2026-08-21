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

export function createCliArgumentError(error: unknown): Error {
  return createSeederError({
    whatHappened: 'The command-line arguments are invalid',
    fix: 'Run gt-react-seed --help to see the supported options.',
    details: formatDiagnosticErrorDetails(error),
  });
}

export function createOutputError(path: string, error: unknown): Error {
  return createSeederError({
    whatHappened: 'The runtime seed candidate could not be written',
    fix: 'Choose a writable output path with --out, or use --stdout.',
    details: `${path}\n${formatDiagnosticErrorDetails(error)}`,
  });
}
