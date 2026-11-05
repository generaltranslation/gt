import {
  isUnfilledLocaleTwinPlaceholder,
  parseLocaleTwinTable,
} from 'generaltranslation/internal/experimental';
import type { LocaleTwinTable } from 'generaltranslation/internal/experimental';
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import logger from '../../logs/logger';
import { createGtI18nDiagnostic } from './diagnostics';
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
 * built in locale twin mode (as `GtInternalRegisterLocaleTwin`); the build
 * replaces its placeholder argument with the table for each twin's locale.
 *
 * Every call records that compiled code ran, so the runtime can tell a
 * missing compiler plugin apart from a page that registered no table yet.
 *
 * Web-only: exported from the `/experimental` entry points of gt-react and
 * gt-tanstack-start, not from gt-react-native.
 *
 * @param value - A filled table (`JSON.stringify({ l, e })`), an unfilled
 * placeholder (server bundles, original chunks), or nothing (a module
 * without attributed entries).
 * @returns `true` when a table was registered, `false` otherwise.
 */
export function registerLocaleTwin(value?: string): boolean {
  const state = getLocaleTwinState();
  state.compiled = true;
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
