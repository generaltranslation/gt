import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { PACKAGE_NAME } from './constants';

export const failedToReadConfigFileError = (filePath: string) =>
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Error',
    whatHappened: `GT Config at ${filePath} could not be read`,
    fix: 'Check that the file exists and contains valid JSON',
  });
