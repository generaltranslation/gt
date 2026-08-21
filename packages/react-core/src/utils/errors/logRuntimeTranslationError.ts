import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';

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
 * Log a failed runtime translation request (for example a 401 from an invalid
 * dev API key) instead of letting the rejection escape and kill rendering.
 * Identical failures log once per dedupe set; callers own the set so the
 * I18nStore scopes it per instance while the RSC render path uses one module
 * set.
 */
function logRuntimeTranslationError(
  error: unknown,
  loggedErrors: Set<string>
): void {
  const details = formatDiagnosticErrorDetails(error);
  const dedupeKey = getRuntimeTranslationErrorDedupeKey(error);
  if (loggedErrors.has(dedupeKey)) return;
  loggedErrors.add(dedupeKey);
  if (loggedErrors.size > MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS) {
    const oldest = loggedErrors.values().next().value;
    if (oldest !== undefined) {
      loggedErrors.delete(oldest);
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
}

const loggedRscRenderErrors = new Set<string>();

/** Deduped failure logger for RSC render paths, which have no store instance. */
function logRuntimeTranslationRenderError(error: unknown): void {
  logRuntimeTranslationError(error, loggedRscRenderErrors);
}

export { logRuntimeTranslationError, logRuntimeTranslationRenderError };
