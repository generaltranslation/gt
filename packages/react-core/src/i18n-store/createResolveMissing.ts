import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import type { I18nStoreLookup, ResolveMissing } from './I18nStore';

const MAX_LOGGED_RUNTIME_TRANSLATION_ERRORS = 100;

export function createResolveMissing(): ResolveMissing {
  const loggedErrors = new Set<string>();

  return (lookup) =>
    resolveLookup(lookup)
      .then(() => true)
      .catch((error) => {
        logError(loggedErrors, error);
        return false;
      });
}

function resolveLookup(lookup: I18nStoreLookup): Promise<unknown> {
  const cache = getReactI18nCache();
  switch (lookup.type) {
    case 'translation':
      return cache.lookupTranslationWithFallback(
        lookup.lookup.locale,
        lookup.lookup.message,
        lookup.lookup.options
      );
    case 'dictionaryEntry':
      return cache.lookupDictionaryWithFallback(
        lookup.lookup.locale,
        lookup.lookup.id
      );
    case 'dictionaryObject':
      return cache.lookupDictionaryObjWithFallback(
        lookup.lookup.locale,
        lookup.lookup.id
      );
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
