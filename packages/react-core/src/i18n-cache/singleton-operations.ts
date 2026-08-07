import {
  getI18nCache,
  isI18nCacheInitialized,
  setI18nCache,
} from 'gt-i18n/internal';
import type { I18nCacheInstance } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { ReactI18nCache } from './ReactI18nCache';

// ===== I18n Cache ===== //

export type ReactI18nCacheInstance = I18nCacheInstance<Translation>;

const clientNotInitializedDiagnostic = createDiagnosticMessage({
  source: '@generaltranslation/react-core',
  severity: 'Error',
  whatHappened: 'Cannot access the React i18n client before it is initialized',
  fix: 'Initialize GT before reading or resolving translations.',
});

export function getReactI18nCache(): ReactI18nCache {
  return getI18nCache() as unknown as ReactI18nCache;
}

export function getReactI18nCacheInstance(): ReactI18nCacheInstance {
  if (!isI18nCacheInitialized()) {
    throw new Error(clientNotInitializedDiagnostic);
  }
  return getI18nCache();
}

export function getMissingTranslationResolver():
  | ReactI18nCacheInstance
  | undefined {
  return isI18nCacheInitialized() ? getReactI18nCacheInstance() : undefined;
}

export function setReactI18nCache(i18nCache: ReactI18nCache): void {
  setReactI18nCacheInstance(i18nCache);
}

export function setReactI18nCacheInstance(
  i18nCache: ReactI18nCacheInstance
): void {
  setI18nCache(i18nCache);
}
