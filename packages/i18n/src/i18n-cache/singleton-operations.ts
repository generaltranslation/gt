import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from '../globals/createGlobalSingleton';
import type { I18nCache } from './I18nCache';
import { Translation } from './translations-manager/utils/types/translation-data';

/** Public I18nCache methods without the class's nominal protected state. */
export type I18nCacheInstance<
  TranslationValue extends Translation = Translation,
> = Pick<I18nCache<TranslationValue>, keyof I18nCache<TranslationValue>>;

const i18nCacheSingleton = createGlobalSingleton<I18nCache>({
  namespace: 'i18n',
  key: 'i18nCache',
  source: 'gt-i18n',
  notInitialized: () =>
    createDiagnosticMessage({
      source: 'gt-i18n',
      severity: 'Error',
      whatHappened: 'Cannot read I18nCache before it has been initialized',
      why: 'the internal I18nCache singleton is unavailable',
      fix: 'Initialize GT before accessing I18nCache (call initializeGT() from your GT framework package).',
    }),
});

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
  return i18nCacheSingleton.get();
}

export function isI18nCacheInitialized(): boolean {
  return i18nCacheSingleton.isInitialized();
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
  i18nCacheInstance: I18nCacheInstance<TranslationValue>
): void {
  i18nCacheSingleton.set(i18nCacheInstance as unknown as I18nCache);
}
