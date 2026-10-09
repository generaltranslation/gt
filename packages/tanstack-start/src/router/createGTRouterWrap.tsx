import {
  Fragment,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getReactI18nCache, getTranslationsSnapshot } from 'gt-react';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import type { GTRouterState } from './types';

type GTConditionSource = Pick<
  ReadonlyConditionStoreInterface,
  'getLocale' | 'getRegion' | 'getEnableI18n'
>;

export async function readGTRouterState(
  conditionStore: GTConditionSource
): Promise<GTRouterState> {
  const locale = conditionStore.getLocale();
  const [translations, dictionaries] = await Promise.all([
    getTranslationsSnapshot(locale),
    // Dictionary reads only use loaded dictionaries, so the translated one is
    // loaded before render, as gt-next's GTProvider does. Both sides already
    // bundle the source dictionary, which serves the default locale.
    locale === getI18nConfig().getDefaultLocale()
      ? {}
      : getReactI18nCache()
          .loadDictionary(locale)
          .then((dictionary) => ({ [locale]: dictionary })),
  ]);
  return {
    locale,
    region: conditionStore.getRegion(),
    enableI18n: conditionStore.getEnableI18n(),
    translations,
    dictionaries,
  };
}

type GTProvider = ComponentType<
  GTRouterState & { children: ReactNode; _syncConditions?: boolean }
>;

const subscribeToNothing = () => () => {};

/**
 * Hydrates a prerendered SPA shell with the state it was rendered with, then
 * re-renders with the visitor's state. React renders the server snapshot
 * while hydrating and re-renders right after when the client snapshot differs.
 * The provider's effects run between the two renders, so it must not save the
 * shell's locale to the visitor's cookies.
 */
function ShellProvider({
  Provider,
  shell,
  state,
  children,
}: {
  Provider: GTProvider;
  shell: GTRouterState;
  state: GTRouterState;
  children: ReactNode;
}) {
  const current = useSyncExternalStore(
    subscribeToNothing,
    () => state,
    () => shell
  );
  return (
    <Provider {...current} _syncConditions={current !== shell}>
      {children}
    </Provider>
  );
}

/**
 * Router Wrap that renders the GT provider once GT state is known, suspending
 * on loadState until then. Each entry passes its own provider and loader so
 * this module stays free of server- or browser-only imports.
 */
export function createGTRouterWrap({
  Wrap: OriginalWrap = Fragment,
  Provider,
  loadState,
}: {
  Wrap?: ComponentType<{ children: ReactNode }>;
  Provider: GTProvider;
  loadState: () => Promise<GTRouterState>;
}) {
  let resolved: GTRouterState | undefined;
  let shell: GTRouterState | undefined;
  let failure: { error: unknown } | undefined;
  let pending: Promise<GTRouterState> | undefined;
  const load = () =>
    (pending ??= loadState().then(
      (state) => (resolved = state),
      (error: unknown) => {
        failure = { error };
        throw error;
      }
    ));

  return {
    load,
    resolve(state: GTRouterState) {
      resolved = state;
    },
    hydrateShell(state: GTRouterState) {
      shell = state;
    },
    Wrap: function GTRouterWrap({ children }: { children: ReactNode }) {
      // Throwing the pending promise suspends on React 18 and 19; use() is
      // React 19-only.
      if (failure) throw failure.error;
      if (!resolved) throw load();
      const state = resolved;
      return (
        <OriginalWrap>
          {shell ? (
            <ShellProvider Provider={Provider} shell={shell} state={state}>
              {children}
            </ShellProvider>
          ) : (
            <Provider {...state}>{children}</Provider>
          )}
        </OriginalWrap>
      );
    },
  };
}
