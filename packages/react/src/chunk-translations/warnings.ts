import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

export function createTimeoutWarning(url: string, timeout: number): string {
  return createDiagnosticMessage({
    source: 'gt-react',
    severity: 'Warning',
    whatHappened: `The translations in ${url} did not load within ${timeout} ms`,
    reassurance: 'Their messages render the source text until they arrive',
  });
}

export function createUnwaitedWarning(url: string): string {
  return createDiagnosticMessage({
    source: 'gt-react',
    severity: 'Warning',
    whatHappened: `The translations in ${url} are not waited for`,
    why: 'the page has waited for a file that was late, and none has loaded in time since',
    reassurance: 'Their messages render the source text until they arrive',
  });
}

export function createFailedWarning(url: string, details: string): string {
  return createDiagnosticMessage({
    source: 'gt-react',
    severity: 'Warning',
    whatHappened: `Could not load the translations in ${url}`,
    reassurance: 'Their messages render the source text',
    fix: 'Deploy the .json files the build wrote next to its chunks',
    details,
  });
}

export function createUnlistedChunkWarning(chunk: string): string {
  return createDiagnosticMessage({
    source: 'gt-react',
    severity: 'Warning',
    whatHappened: `The build lists no translation files for ${chunk}`,
    reassurance: 'Its messages render the source text',
    fix: 'Report this defect of the build to General Translation',
  });
}

export function createMissingLocaleWarning(
  locale: string,
  noStartupScript: boolean
): string {
  return createDiagnosticMessage({
    source: 'gt-react',
    severity: 'Warning',
    whatHappened: noStartupScript
      ? 'This build loads translations per chunk, but the page did not run its startup script'
      : `This build has no translations for "${locale}"`,
    reassurance: 'Messages render the source text',
    fix: noStartupScript
      ? 'Serve the index.html the build wrote, or add the startupScript from gt-chunk-translations.json to the page before its module scripts'
      : `Add the "${locale}" translations file at files.gt.output and build again`,
  });
}
