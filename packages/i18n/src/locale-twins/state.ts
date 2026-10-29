import type { LocaleTwinTable } from 'generaltranslation/internal';
import type { Content } from 'generaltranslation/types';
import logger from '../logs/logger';

/** Options a rendering lookup passes to `resolveLocaleTwinLookup`. */
export type LocaleTwinLookupOptions = {
  /** The lookup hash (compile-time, or computed at runtime). */
  $_hash?: string;
  /**
   * Set by the dictionaries API (`useTranslations`): dictionary entries are
   * never twinned and stay on whole-locale loading.
   */
  $_dictionary?: boolean;
};

/** How a rendering lookup resolves with locale twins. */
export type LocaleTwinLookup<T> = {
  /** The registered twin entry for the hash; render it when present. */
  entry: T | undefined;
  /**
   * Whether the content renders its source text because no locale twin
   * carries it (no compile-time hash in a production locale twins build).
   */
  rendersSource: boolean;
};

type Reload = (state: never) => void;

/**
 * The locale twin runtime behaviour. `registerLocaleTwin()` installs it on
 * its first call, so apps without locale twins never load it: the core
 * runtime only checks whether hooks are installed.
 */
export type LocaleTwinHooks = {
  /** Returns the registered entry for `hash` (and reports mismatches). */
  lookup(locale: string, hash: string): unknown;
  /** Resolves a rendering lookup (see `resolveLocaleTwinLookup`). */
  resolve(
    locale: string,
    options: LocaleTwinLookupOptions,
    compileTimeHash: unknown
  ): LocaleTwinLookup<unknown>;
  /** Runs after a custom `_reload` on a locale switch. */
  afterCustomReload(reload: Reload, reloadDocument: () => void): void;
};

/**
 * Locale twin state for the page. Stored as a plain bag on
 * `globalThis.__generaltranslation.localeTwins` so it exists before any GT
 * initialization and is shared by every bundled copy of gt-i18n.
 */
export type LocaleTwinState = {
  /** Locale of the first registered twin. */
  locale?: string;
  /** Registered tables, kept by reference. */
  tables: LocaleTwinTable[];
  /** Runtime diagnostics already reported on this page (each logs once). */
  reported?: Set<string>;
  /** Whether a locale twin client loads whole locales for dictionaries. */
  dictionaryLoading?: boolean;
  /** Installed by the first `registerLocaleTwin()` call. */
  hooks?: LocaleTwinHooks;
};

type GlobalWithLocaleTwins = {
  __generaltranslation?: Record<string, unknown> & {
    localeTwins?: LocaleTwinState;
  };
};

/** @internal Shared locale twin state; created on first use. */
export function getLocaleTwinState(): LocaleTwinState {
  const globalObj = globalThis as unknown as GlobalWithLocaleTwins;
  globalObj.__generaltranslation ??= {};
  globalObj.__generaltranslation.localeTwins ??= { tables: [] };
  return globalObj.__generaltranslation.localeTwins;
}

/** @internal Logs each kind of locale twin problem once per page. */
export function reportLocaleTwinIssueOnce(
  kind: string,
  severity: 'error' | 'warn',
  createMessage: () => string
): void {
  const state = getLocaleTwinState();
  state.reported ??= new Set();
  if (state.reported.has(kind)) return;
  state.reported.add(kind);
  logger[severity](createMessage());
}

/** Returns the registered content for `hash`, if any twin provided it. */
export function getLocaleTwinEntry(hash: string): Content | undefined {
  for (const table of getLocaleTwinState().tables) {
    if (Object.hasOwn(table.e, hash)) return table.e[hash];
  }
  return undefined;
}

/** Returns the locale of the registered twins, if any were registered. */
export function getLocaleTwinLocale(): string | undefined {
  return getLocaleTwinState().locale;
}

/** Whether at least one locale twin table has been registered. */
export function hasLocaleTwins(): boolean {
  return getLocaleTwinState().tables.length > 0;
}
