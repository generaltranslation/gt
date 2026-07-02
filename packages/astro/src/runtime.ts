// Server-side runtime state: the AsyncLocalStorage-backed condition store
// that scopes a locale to each request, and the idempotent initializer the
// middleware calls at module load.
import { AsyncLocalStorage } from 'node:async_hooks';
import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import {
  createConditionStoreSingleton,
  getI18nConfig,
  isI18nConfigInitialized,
} from 'gt-i18n/internal';
import type { ScopedConditionStoreInterface } from 'gt-i18n/internal/types';
import type { InitializeGTAstroParams } from './types';

type Store = {
  locale: string;
  region?: string;
  enableI18n?: boolean;
};

const OUTSIDE_SCOPE_MESSAGE =
  'gt-astro: translation state accessed outside of a request scope. ' +
  'Translation functions must run during a request handled by the gt-astro middleware ' +
  '(or inside a withGT() scope).';

/**
 * Condition store implementation that uses AsyncLocalStorage so each request
 * rendered by Astro resolves its own locale.
 */
export class AsyncConditionStore implements ScopedConditionStoreInterface {
  private store = new AsyncLocalStorage<Store>();

  run<T>(locale: string, callback: () => T): T {
    return this.store.run({ locale: resolveLocale(locale) }, callback);
  }

  getLocale(): string {
    return resolveLocale(this.read()?.locale);
  }

  getRegion(): string | undefined {
    return this.read()?.region;
  }

  getEnableI18n(): boolean {
    return this.read()?.enableI18n ?? true;
  }

  setLocale = (_locale: string): void => {};

  setRegion = (_region: string | undefined): void => {};

  setEnableI18n = (_enableI18n: boolean): void => {};

  /** Throws outside a request scope in dev; warns and falls back in prod. */
  private read(): Store | undefined {
    const store = this.store.getStore();
    if (!store) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(OUTSIDE_SCOPE_MESSAGE);
      }
      console.warn(OUTSIDE_SCOPE_MESSAGE);
    }
    return store;
  }
}

function resolveLocale(locale?: string): string {
  return getI18nConfig().resolveSupportedLocale(locale);
}

export const {
  getConditionStore: getAsyncConditionStore,
  setConditionStore: setAsyncConditionStore,
  isConditionStoreInitialized: isAsyncConditionStoreInitialized,
} = createConditionStoreSingleton<AsyncConditionStore>(
  'AsyncConditionStore not initialized. The gt-astro middleware must run before translation functions.'
);

/**
 * Initializes the server-side GT runtime: i18n config, translation cache, and
 * the request-scoped condition store. Idempotent so dev-server module reloads
 * don't warn.
 */
export function initializeGTAstro(config: InitializeGTAstroParams): void {
  if (!isI18nConfigInitialized()) {
    internalInitializeGTSRA(config);
  }
  if (!isAsyncConditionStoreInitialized()) {
    setAsyncConditionStore(new AsyncConditionStore());
  }
}

/**
 * Runs a callback with the given locale, outside of the middleware request
 * scope (e.g. in getStaticPaths or standalone scripts).
 */
export function withGT<T>(locale: string, fn: () => T): T {
  return getAsyncConditionStore().run<T>(locale, fn);
}
