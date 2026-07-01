import { createDiagnosticMessage } from 'generaltranslation/internal';

export const createCustomCookieNamesWarning = (cookieConfigKeys: string[]) =>
  createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened:
      'Custom cookie names passed to initializeGT() are temporarily ignored',
    why: 'of a temporary regression',
    fix: 'Use the default cookie names until the fix is available',
    wayOut: 'This behavior will be restored in an upcoming patch',
    details: cookieConfigKeys,
  });
