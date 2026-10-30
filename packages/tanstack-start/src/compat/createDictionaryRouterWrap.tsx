import { Fragment, type ComponentType, type ReactNode } from 'react';
import { GTDictionaryProvider } from 'gt-react/compat';
import { getI18nConfig } from 'gt-i18n/internal';
import { getDictionaryManager, type Dictionary } from 'gt-i18n/internal/compat';

export type GTDictionaries = Record<string, Dictionary>;

/** Dictionary state shuttled from the server render to client hydration. */
export type GTDictionaryDehydratedRouterData =
  | {
      gtDictionaries?: {
        dictionaries: GTDictionaries;
        /** Rendered into a prerendered SPA shell served to every visitor. */
        shell?: boolean;
      };
    }
  | undefined;

/**
 * The locale's dictionary, keyed by locale. Both sides bundle the source
 * dictionary, which serves the default locale, so it is never included.
 */
export async function loadDictionaries(
  locale: string
): Promise<GTDictionaries> {
  if (locale === getI18nConfig().getDefaultLocale()) return {};
  return { [locale]: await getDictionaryManager().loadDictionary(locale) };
}

/**
 * Router Wrap that renders GTDictionaryProvider once the dictionaries are
 * known, suspending on loadDictionaries until then. State lives per router, so
 * on the server it lives per request and DictionaryManager owns caching.
 */
export function createDictionaryRouterWrap({
  Wrap: OriginalWrap = Fragment,
  ensureDictionaryManager,
  loadDictionaries,
}: {
  Wrap?: ComponentType<{ children: ReactNode }>;
  ensureDictionaryManager: () => void;
  loadDictionaries: () => Promise<GTDictionaries>;
}) {
  let resolved: GTDictionaries | undefined;
  let failure: { error: unknown } | undefined;
  let pending: Promise<GTDictionaries> | undefined;
  const load = () =>
    (pending ??= Promise.resolve()
      .then(() => {
        ensureDictionaryManager();
        return loadDictionaries();
      })
      .then(
        (dictionaries) => (resolved = dictionaries),
        (error: unknown) => {
          failure = { error };
          throw error;
        }
      ));

  return {
    load,
    resolve(dictionaries: GTDictionaries) {
      resolved = dictionaries;
    },
    Wrap: function GTDictionaryRouterWrap({
      children,
    }: {
      children: ReactNode;
    }) {
      // Throwing the pending promise suspends on React 18 and 19; use() is
      // React 19-only.
      if (failure) throw failure.error;
      if (!resolved) throw load();
      // The provider seeds the manager, which must hold the source dictionary.
      ensureDictionaryManager();
      return (
        <OriginalWrap>
          <GTDictionaryProvider dictionaries={resolved}>
            {children}
          </GTDictionaryProvider>
        </OriginalWrap>
      );
    },
  };
}
