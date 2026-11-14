import type { Content } from '@generaltranslation/format';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { getI18nCache, getI18nConfig } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal';
import type { GTState } from './state.svelte';

const loggedErrors = new Set<string | undefined>();

/**
 * In development, with credentials, requests a translation the cache missed
 * and re-runs `state`'s lookups when it arrives. The cache shares one request
 * per translation while it is in flight.
 */
export function requestMissingTranslation(
  state: GTState,
  locale: string,
  content: Content,
  options: LookupOptions
): void {
  if (
    process.env.NODE_ENV === 'production' ||
    !getI18nConfig().isDevHotReloadEnabled()
  ) {
    return;
  }
  getI18nCache()
    .lookupTranslationWithFallback(locale, content, options)
    .then((translation) => {
      if (translation != null) state.invalidate();
    })
    .catch(logRuntimeTranslationError);
}

function logRuntimeTranslationError(error: unknown): void {
  const details = formatDiagnosticErrorDetails(error);
  // Every missing translation fails the same way, so report each error once.
  if (loggedErrors.has(details)) return;
  loggedErrors.add(details);
  console.warn(
    createDiagnosticMessage({
      source: 'gt-svelte',
      severity: 'Warning',
      whatHappened: 'A development runtime translation request failed',
      wayOut: 'The source content stays on screen',
      details,
    })
  );
}
