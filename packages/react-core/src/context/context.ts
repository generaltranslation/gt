import {
  Dictionary,
  Hash,
  Locale,
  ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal/types';
import { Translation } from 'gt-i18n/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import { createContext, useContext, type Context } from 'react';
import { I18nStore } from '../i18n-store/I18nStore';
import { readRenderStrategy } from '../setup/i18nConfig';
import type {
  OnMissingTranslation,
  OnMissingDictionaryEntry,
  OnMissingDictionaryObj,
} from '../hooks/utils/missing-translation';

export type GTContextType = {
  /**
   * Source of truth for translations, streamed from server
   * In SPA mode, these won't be accessible and translations
   * can be accessed via useSyncExternalStore() directly
   */
  translationsSnapshot: Record<Locale, Record<Hash, Translation>>;
  dictionariesSnapshot: Record<Locale, Dictionary>;
  /**
   * I18nStore allows us to sync state updates in ConditionStore and I18nCache
   * with renders
   */
  i18nStore: I18nStore;
  /**
   * ConditionStore should always remain separate from i18nStore as
   * it manages how we perform lookups
   */
  conditionStore: ReadonlyConditionStoreInterface;
  /**
   * Custom override behavior on missing translations
   * Used for server triggering tx hmr b/c no access to useEffect
   */
  onMissingTranslation?: OnMissingTranslation;
  onMissingDictionaryEntry?: OnMissingDictionaryEntry;
  onMissingDictionaryObj?: OnMissingDictionaryObj;
};

const gtContextSingleton = createGlobalSingleton<
  Context<GTContextType | undefined>
>({
  namespace: 'reactCore',
  key: 'gtContext',
  source: '@generaltranslation/react-core',
  notInitialized: () =>
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'Cannot read GTContext before it has been initialized',
      why: 'the internal GTContext singleton is unavailable',
      fix: 'Access GTContext through getGTContext() so it is created lazily.',
    }),
});

export function getGTContext(): Context<GTContextType | undefined> {
  // Lazily create the React context once and share it across instances.
  if (!gtContextSingleton.isInitialized()) {
    gtContextSingleton.set(createContext<GTContextType | undefined>(undefined));
  }
  return gtContextSingleton.get();
}

export function useGTContext(): GTContextType | undefined {
  const context = useContext(getGTContext());
  // readRenderStrategy() must not throw here: when I18nConfig is also
  // uninitialized we still want the missing-provider diagnostic below,
  // not a masking I18nConfig error.
  const renderStrategy = readRenderStrategy();
  if (context || renderStrategy === 'SPA') {
    return context;
  }
  /**
   * TODO: in a separate PR, we should figure out how to make this more of a forgiving system
   */
  throw new Error(createMissingGTProviderError(renderStrategy === undefined));
}

function createMissingGTProviderError(
  isI18nConfigUninitialized: boolean
): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened: 'GT runtime context could not be read',
    why: 'GTContext was accessed outside of a <GTProvider>',
    fix: 'Add a <GTProvider> at the root of your component tree.',
    details: isI18nConfigUninitialized
      ? 'The I18nConfig singleton is also uninitialized, so GT initialization has not run in this runtime. This can happen when a bundler drops GT setup side effects or an edge/serverless isolate loads a bundle that never runs initialization.'
      : undefined,
  });
}
