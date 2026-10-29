import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
  isUnfilledLocaleTwinPlaceholder,
  parseLocaleTwinTable,
} from 'generaltranslation/internal';
import type { LocaleTwinTable } from 'generaltranslation/internal';
import type { Content } from 'generaltranslation/types';
import logger from '../logs/logger';

function createInvalidLocaleTwinMessage(error: unknown): string {
  return createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Error',
    whatHappened: 'A locale twin could not be registered',
    why: 'the loaded chunk contains neither a locale twin table nor an unfilled placeholder',
    fix: 'Rebuild the app and serve the generated locale twins unchanged',
    details: formatDiagnosticErrorDetails(error),
  });
}

/**
 * Registry state for the locale twins a page has loaded. Stored as a plain bag
 * on `globalThis.__generaltranslation.localeTwins` so it exists before any GT
 * initialization and is shared by every bundled copy of this module.
 */
type LocaleTwinRegistry = {
  /** Locale of the first registered twin. */
  locale?: string;
  /** Registered tables, kept by reference. */
  tables: LocaleTwinTable[];
};

type GlobalWithLocaleTwins = {
  __generaltranslation?: Record<string, unknown> & {
    localeTwins?: LocaleTwinRegistry;
  };
};

function getRegistry(): LocaleTwinRegistry {
  const globalObj = globalThis as unknown as GlobalWithLocaleTwins;
  globalObj.__generaltranslation ??= {};
  globalObj.__generaltranslation.localeTwins ??= { tables: [] };
  return globalObj.__generaltranslation.localeTwins;
}

/**
 * Registers a locale twin's table. The compiler injects one call per module
 * with attributed entries (as `GtInternalRegisterLocaleTwin`); the build
 * replaces its placeholder argument with the table for each twin's locale.
 *
 * Web-only: exported from gt-react and gt-tanstack-start, intentionally not
 * from gt-react-native (whose registry therefore stays empty).
 *
 * @param value - A filled table (`JSON.stringify({ l, e })`) or an unfilled
 * placeholder (server bundles, original chunks).
 * @returns `true` when a table was registered, `false` for an unfilled
 * placeholder.
 */
export function registerLocaleTwin(value: string): boolean {
  if (isUnfilledLocaleTwinPlaceholder(value)) return false;
  let table: LocaleTwinTable;
  try {
    table = parseLocaleTwinTable(value);
  } catch (error) {
    // Throwing here would fail the whole chunk while it evaluates.
    logger.error(createInvalidLocaleTwinMessage(error));
    return false;
  }
  const registry = getRegistry();
  registry.locale ??= table.l;
  registry.tables.push(table);
  return true;
}

/** Returns the registered content for `hash`, if any twin provided it. */
export function getLocaleTwinEntry(hash: string): Content | undefined {
  for (const table of getRegistry().tables) {
    if (Object.hasOwn(table.e, hash)) return table.e[hash];
  }
  return undefined;
}

/** Returns the locale of the registered twins, if any were registered. */
export function getLocaleTwinLocale(): string | undefined {
  return getRegistry().locale;
}

/** Whether at least one locale twin table has been registered. */
export function hasLocaleTwins(): boolean {
  return getRegistry().tables.length > 0;
}
