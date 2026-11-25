import { Hash, Locale, createGlobalSingleton } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createContext, useContext, type Context } from 'react';
import { I18nStore } from '../i18n-store/I18nStore';
import { getI18nConfig } from '../setup/i18nConfig';
import type { OnMissingTranslation } from '../hooks/utils/missing-translation';

type GTContextType = {
  /**
   * Source of truth for translations, streamed from server
   * In SPA mode, these won't be accessible and translations
   * can be accessed via useSyncExternalStore() directly
   */
  translationsSnapshot: Record<Locale, Record<Hash, Content>>;
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

export type TranslationsSnapshot = GTContextType['translationsSnapshot'];

const gtContextSingleton = createGlobalSingleton<
  Context<GTContextType | undefined>
>({
  namespace: 'reactCore',
  key: 'gtContext',
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

const seededTranslationsContextSingleton = createGlobalSingleton<
  Context<TranslationsSnapshot | undefined>
>({
  namespace: 'reactCore',
  key: 'seededTranslationsContext',
  notInitialized: () =>
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened:
        'Cannot read the seeded translations context before it has been initialized',
      why: 'the internal seeded translations context singleton is unavailable',
    }),
});

/**
 * The translations that InternalTranslationsSeed elements above hold, which a
 * provider below them adds under its own.
 */
export function getSeededTranslationsContext(): Context<
  TranslationsSnapshot | undefined
> {
  if (!seededTranslationsContextSingleton.isInitialized()) {
    seededTranslationsContextSingleton.set(
      createContext<TranslationsSnapshot | undefined>(undefined)
    );
  }
  return seededTranslationsContextSingleton.get();
}

export function mergeTranslations(
  base: TranslationsSnapshot,
  layer: TranslationsSnapshot
): TranslationsSnapshot {
  const merged = { ...base };
  for (const locale in layer) {
    merged[locale] = { ...base[locale], ...layer[locale] };
  }
  return merged;
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
