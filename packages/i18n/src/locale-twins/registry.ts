import {
  formatDiagnosticErrorDetails,
  isUnfilledLocaleTwinPlaceholder,
  parseLocaleTwinTable,
} from 'generaltranslation/internal';
import type { LocaleTwinTable } from 'generaltranslation/internal';
import logger from '../logs/logger';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import { localeTwinHooks } from './runtime';
import { getLocaleTwinState } from './state';

function createInvalidLocaleTwinMessage(error: unknown): string {
  return createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened: 'A locale twin could not be registered',
    why: 'the loaded chunk contains neither a locale twin table nor an unfilled placeholder',
    fix: 'Rebuild the app and serve the generated locale twins unchanged',
    details: formatDiagnosticErrorDetails(error),
  });
}

/**
 * Registers a locale twin's table. The compiler injects one call per module
 * with attributed entries (as `GtInternalRegisterLocaleTwin`); the build
 * replaces its placeholder argument with the table for each twin's locale.
 *
 * The first call (filled or not, so server bundles too) installs the locale
 * twin runtime hooks; apps without locale twins never load that runtime.
 * Modules without attributed entries call it without a value, so the
 * runtime is installed even before the page registers its first twin.
 *
 * Web-only: exported from gt-react and gt-tanstack-start, intentionally not
 * from gt-react-native (whose registry therefore stays empty).
 *
 * @param value - A filled table (`JSON.stringify({ l, e })`), an unfilled
 * placeholder (server bundles, original chunks), or nothing (a module
 * without attributed entries).
 * @returns `true` when a table was registered, `false` otherwise.
 */
export function registerLocaleTwin(value?: string): boolean {
  const state = getLocaleTwinState();
  state.hooks ??= localeTwinHooks;
  if (value === undefined) return false;
  if (isUnfilledLocaleTwinPlaceholder(value)) {
    state.unfilled = true;
    return false;
  }
  let table: LocaleTwinTable;
  try {
    table = parseLocaleTwinTable(value);
  } catch (error) {
    // Throwing here would fail the whole chunk while it evaluates.
    logger.error(createInvalidLocaleTwinMessage(error));
    return false;
  }
  state.locale ??= table.l;
  const entries = (state.entries ??= new Map());
  const sourceFallbacks = (state.sourceFallbacks ??= new Set());
  const tableFallbacks = table.s ?? [];
  for (const [hash, content] of Object.entries(table.e)) {
    if (entries.has(hash)) continue;
    entries.set(hash, content);
    if (tableFallbacks.indexOf(hash) !== -1) sourceFallbacks.add(hash);
  }
  return true;
}

export {
  getLocaleTwinEntry,
  getLocaleTwinLocale,
  hasLocaleTwins,
} from './state';
