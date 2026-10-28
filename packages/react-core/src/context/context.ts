import type { Translation } from 'gt-i18n';
import { Hash, Locale, createGlobalSingleton } from 'gt-i18n/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createContext, useContext, type Context } from 'react';
import { I18nStore } from '../i18n-store/I18nStore';
import { getI18nConfig } from '../setup/i18nConfig';
import type { OnMissingTranslation } from '../hooks/utils/missing-translation';

export type GTContextType = {
  /**
   * Source of truth for translations, streamed from server
   * In SPA mode, these won't be accessible and translations
   * can be accessed via useSyncExternalStore() directly
   */
  translationsSnapshot: Record<Locale, Record<Hash, Translation>>;
  /**
   * I18nStore allows us to sync state updates in ConditionStore and I18nCache
   * with renders
   */
  i18nStore: I18nStore;
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
  setLocale: (locale: string) => void;
  setRegion: (region: string | undefined) => void;
  setEnableI18n: (enabled: boolean) => void;
  /**
   * Custom override behavior on missing translations
   * Used for server triggering tx hmr b/c no access to useEffect
   */
  onMissingTranslation?: OnMissingTranslation;
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
      fix: 'Add a <GTProvider> at the root of your component tree.',
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
  if (context || getI18nConfig().getRenderStrategy() === 'SPA') {
    return context;
  }
  /**
   * TODO: in a separate PR, we should figure out how to make this more of a forgiving system
   */
  throw new Error(createMissingGTProviderError());
}

function createMissingGTProviderError(): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened: 'GT runtime context could not be read',
    why: 'GTContext was accessed outside of a <GTProvider>',
    fix: 'Add a <GTProvider> at the root of your component tree.',
  });
}
