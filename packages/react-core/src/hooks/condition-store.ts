import { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { useSyncExternalStore } from 'react';
import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';
import { useGTContext } from '../context/context';

type SubscribableConditionStore = ReadonlyConditionStoreInterface & {
  subscribe?: (listener: () => void) => () => void;
};

/**
 * NOTE: useSetLocale() and useSetEnableI18n() are not implemented in @generaltranslation/react-core
 * Some server environments are read only, so we cannot implement these hooks.
 */

export function useConditionStore(): ReadonlyConditionStoreInterface {
  const context = useGTContext();
  return context?.conditionStore ?? getReadonlyConditionStoreWithFallback();
}

function subscribeToConditionStore(
  conditionStore: ReadonlyConditionStoreInterface,
  listener: () => void
): () => void {
  return (
    (conditionStore as SubscribableConditionStore).subscribe?.(listener) ??
    (() => {})
  );
}

function useConditionSnapshot<T>(
  getSnapshot: (conditionStore: ReadonlyConditionStoreInterface) => T
): T {
  const conditionStore = useConditionStore();
  return useSyncExternalStore(
    (listener) => subscribeToConditionStore(conditionStore, listener),
    () => getSnapshot(conditionStore),
    () => getSnapshot(conditionStore)
  );
}

/**
 * Returns the current locale.
 */
export function useLocale(): string {
  return useConditionSnapshot((conditionStore) => conditionStore.getLocale());
}

/**
 * Returns the current region, or undefined if no region is set.
 */
export function useRegion(): string | undefined {
  return useConditionSnapshot((conditionStore) => conditionStore.getRegion());
}

/**
 * Returns the current enableI18n flag.
 */
export function useEnableI18n(): boolean {
  return useConditionSnapshot((conditionStore) =>
    conditionStore.getEnableI18n()
  );
}
