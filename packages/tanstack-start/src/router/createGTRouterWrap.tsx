import { Fragment, type ComponentType, type ReactNode } from 'react';
import { getTranslationsSnapshot } from 'gt-react';
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
  return {
    locale,
    region: conditionStore.getRegion(),
    enableI18n: conditionStore.getEnableI18n(),
    translations: await getTranslationsSnapshot(locale),
  };
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
  Provider: ComponentType<GTRouterState & { children: ReactNode }>;
  loadState: () => Promise<GTRouterState>;
}) {
  let resolved: GTRouterState | undefined;
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
    Wrap: function GTRouterWrap({ children }: { children: ReactNode }) {
      // Throwing the pending promise suspends on React 18 and 19; use() is
      // React 19-only.
      if (failure) throw failure.error;
      if (!resolved) throw load();
      const state = resolved;
      return (
        <OriginalWrap>
          <Provider {...state}>{children}</Provider>
        </OriginalWrap>
      );
    },
  };
}
