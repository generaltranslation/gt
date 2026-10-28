import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';

const MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS = 100;

function getRuntimeTranslationErrorDedupeKey(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}|${error.message}`;
  }
  if (error !== null && typeof error === 'object') {
    try {
      return `object|${JSON.stringify(error)}`;
    } catch {
      return `object|${String(error)}`;
    }
  }
  return `${typeof error}|${String(error)}`;
}

/**
 * Runtime translation runs fire-and-forget, so a rejected request (for
 * example a 401 from an invalid dev API key) is logged instead of escaping as
 * an unhandled rejection that kills the dev server during SSR. Identical
 * failures log once per logger.
 */
export function createRuntimeTranslationErrorLogger(): (
  error: unknown
) => void {
  const loggedRuntimeTranslationErrors = new Set<string>();
  return (error) => {
    const details = formatDiagnosticErrorDetails(error);
    const dedupeKey = getRuntimeTranslationErrorDedupeKey(error);
    if (loggedRuntimeTranslationErrors.has(dedupeKey)) return;
    loggedRuntimeTranslationErrors.add(dedupeKey);
    if (
      loggedRuntimeTranslationErrors.size >
      MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS
    ) {
      const oldest = loggedRuntimeTranslationErrors.values().next().value;
      if (oldest !== undefined) {
        loggedRuntimeTranslationErrors.delete(oldest);
      }
    }
    console.error(
      createDiagnosticMessage({
        source: '@generaltranslation/react-core',
        severity: 'Error',
        whatHappened: 'A runtime translation request failed.',
        wayOut: 'Rendering falls back to untranslated content.',
        details,
      })
    );
  };
}
