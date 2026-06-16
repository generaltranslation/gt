import { createDiagnosticMessage } from 'generaltranslation/internal';
import { I18nCache } from './I18nCache';
import { Translation } from './translations-manager/utils/types/translation-data';

type I18nGlobals = {
  i18nCache?: I18nCache;
  gtServicesEnabled?: boolean | undefined;
  [key: string]: unknown;
};

type GeneralTranslationGlobal = {
  i18n?: I18nGlobals;
  [key: string]: unknown;
};

type GlobalWithGeneralTranslation = {
  __generaltranslation?: GeneralTranslationGlobal;
};

function getI18nGlobals(): I18nGlobals {
  const globalObj = globalThis as unknown as GlobalWithGeneralTranslation;
  globalObj.__generaltranslation ??= {};
  // TODO: Consider checking package versions and using a compatibility matrix before sharing global singletons.
  globalObj.__generaltranslation.i18n ??= {};
  return globalObj.__generaltranslation.i18n;
}

/**
 * Get the singleton instance of I18nCache
 * @returns The singleton instance of I18nCache
 * @template U - The type of the translation that will be cached
 *
 * Note: should not be consumed by gt-react, consumers should use a wrapper
 */
export function getI18nCache<U extends Translation = Translation>():
  | I18nCache<U>
  | I18nCache<Translation> {
  const i18nCache = getI18nGlobals().i18nCache;
  if (!i18nCache) {
    throw new Error(getI18nCacheNotInitializedError());
  }
  return i18nCache;
}

/**
 * Configure the singleton instance of I18nCache
 * @param config - The configuration for the I18nCache
 *
 * Wrapper libraries will export a configure function that will call this function.
 *
 * Note: should not be consumed by gt-react, consumers should use a wrapper
 */
export function setI18nCache<TranslationValue extends Translation>(
  i18nCacheInstance: I18nCache<TranslationValue>
): void {
  const i18nGlobals = getI18nGlobals();
  const nextI18nCache = i18nCacheInstance as unknown as I18nCache;
  if (i18nGlobals.i18nCache && i18nGlobals.i18nCache !== nextI18nCache) {
    console.warn(createSingletonOverwriteWarning('i18nCache'));
  }
  i18nGlobals.i18nCache = nextI18nCache;
}

function getI18nCacheNotInitializedError(): string {
  return createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Error',
    whatHappened: 'Cannot read I18nCache before it has been initialized',
    why: 'the internal I18nCache singleton is unavailable',
    fix: 'Call initializeGT() before accessing I18nCache.',
  });
}

function createSingletonOverwriteWarning(name: string): string {
  return createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Warning',
    whatHappened: `Overwriting global ${name} singleton instance`,
  });
}
