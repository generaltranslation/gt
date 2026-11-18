/**
 * Shared global registry stored on `globalThis.__generaltranslation`. Each
 * package namespace (e.g. `i18n`, `reactCore`) owns a bag of singleton slots.
 */
type SingletonRegistry = Record<string, Record<string, unknown> | undefined>;

type GlobalWithRegistry = {
  __generaltranslation?: SingletonRegistry;
};

function getNamespace(namespace: string): Record<string, unknown> {
  const globalObj = globalThis as unknown as GlobalWithRegistry;
  globalObj.__generaltranslation ??= {};
  // TODO: Consider checking package versions and using a compatibility matrix before sharing global singletons.
  globalObj.__generaltranslation[namespace] ??= {};
  return globalObj.__generaltranslation[namespace]!;
}

export type GlobalSingleton<T> = {
  get: () => T;
  set: (next: T) => void;
  isInitialized: () => boolean;
};

/**
 * Creates a global singleton backed by `globalThis.__generaltranslation`.
 *
 * Centralizes the global-registry plumbing shared by the i18nConfig,
 * i18nCache, i18nStore, and conditionStore singletons.
 *
 * `set()` replaces the stored instance, so a caller that must keep the first
 * one checks `isInitialized()` before it calls `set()`.
 *
 * @param namespace - The package namespace bag (e.g. `i18n`, `reactCore`).
 * @param key - The slot within the namespace.
 * @param notInitialized - Lazily builds the error thrown when read before set.
 */
export function createGlobalSingleton<T>({
  namespace,
  key,
  notInitialized,
}: {
  namespace: string;
  key: string;
  notInitialized: () => string | Error;
}): GlobalSingleton<T> {
  function get(): T {
    const value = getNamespace(namespace)[key];
    if (value === undefined || value === null) {
      const error = notInitialized();
      throw typeof error === 'string' ? new Error(error) : error;
    }
    return value as T;
  }

  function set(next: T): void {
    getNamespace(namespace)[key] = next;
  }

  function isInitialized(): boolean {
    const value = getNamespace(namespace)[key];
    return value !== undefined && value !== null;
  }

  return { get, set, isInitialized };
}
