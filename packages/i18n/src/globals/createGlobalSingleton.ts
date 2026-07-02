import { createDiagnosticMessage } from 'generaltranslation/internal';
import {
  getGeneralTranslationLogLevel,
  isDebugLogLevel,
} from '../logs/logLevel';

/**
 * Shared global registry stored on `globalThis.__generaltranslation`. Each
 * package namespace (e.g. `i18n`, `reactCore`) owns a bag of singleton slots.
 */
type SingletonRegistry = Record<string, Record<string, unknown> | undefined>;

type GlobalWithRegistry = {
  __generaltranslation?: SingletonRegistry;
};

type DebugLoggingConfig = {
  isDebugLoggingEnabled: () => boolean;
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
 * Centralizes the global-registry plumbing and overwrite warning shared by the
 * i18nConfig, i18nCache, i18nStore, and conditionStore singletons.
 *
 * @param namespace - The package namespace bag (e.g. `i18n`, `reactCore`).
 * @param key - The slot within the namespace and the name used in the warning.
 * @param source - Diagnostic source for the overwrite warning.
 * @param notInitialized - Lazily builds the error thrown when read before set.
 */
export function createGlobalSingleton<T>({
  namespace,
  key,
  source,
  notInitialized,
}: {
  namespace: string;
  key: string;
  source: string;
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
    const ns = getNamespace(namespace);
    if (ns[key] !== undefined && ns[key] !== next) {
      if (shouldLogDebugWarnings(ns)) {
        console.warn(
          createDiagnosticMessage({
            source,
            severity: 'Warning',
            whatHappened: `Global ${key} singleton instance was already initialized`,
          })
        );
      }
      return;
    }
    ns[key] = next as unknown;
  }

  function isInitialized(): boolean {
    const value = getNamespace(namespace)[key];
    return value !== undefined && value !== null;
  }

  return { get, set, isInitialized };
}

function shouldLogDebugWarnings(namespace: Record<string, unknown>): boolean {
  const config = namespace.i18nConfig;
  if (hasDebugLoggingConfig(config)) {
    return config.isDebugLoggingEnabled();
  }
  return isDebugLogLevel(getGeneralTranslationLogLevel());
}

function hasDebugLoggingConfig(value: unknown): value is DebugLoggingConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<DebugLoggingConfig>).isDebugLoggingEnabled ===
      'function'
  );
}
