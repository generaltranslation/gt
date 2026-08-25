import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import type {
  ReactI18nCache,
  ReactI18nLookup,
  ResolveMissing,
} from './ReactI18nCache';

const MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS = 100;

export function createResolveMissing(cache: ReactI18nCache): ResolveMissing {
  const loggedErrors = new Set<string>();

  return (lookup) =>
    resolve(cache, lookup)
      .then(() => cache.emit(lookup))
      .catch((error) => logError(loggedErrors, error));
}

function resolve(
  cache: ReactI18nCache,
  lookup: ReactI18nLookup
): Promise<unknown> {
  switch (lookup.type) {
    case 'translation':
      return cache.lookupTranslationWithFallback(
        lookup.locale,
        lookup.message,
        lookup.options
      );
    case 'dictionaryEntry':
      return cache.lookupDictionaryWithFallback(lookup.locale, lookup.id);
    case 'dictionaryObject':
      return cache.lookupDictionaryObjWithFallback(lookup.locale, lookup.id);
  }
}

function logError(loggedErrors: Set<string>, error: unknown): void {
  const key = getErrorKey(error);
  if (loggedErrors.has(key)) return;

  loggedErrors.add(key);
  if (loggedErrors.size > MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS) {
    const oldest = loggedErrors.values().next().value;
    if (oldest !== undefined) loggedErrors.delete(oldest);
  }

  console.error(
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'A runtime translation request failed.',
      wayOut: 'Rendering falls back to untranslated content.',
      details: formatDiagnosticErrorDetails(error),
    })
  );
}

function getErrorKey(error: unknown): string {
  if (error instanceof Error) return `${error.name}|${error.message}`;
  if (error !== null && typeof error === 'object') {
    try {
      return `object|${JSON.stringify(error)}`;
    } catch {
      return `object|${String(error)}`;
    }
  }
  return `${typeof error}|${String(error)}`;
}
