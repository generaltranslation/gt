import { useContext, useMemo, useSyncExternalStore } from 'react';
import { GTContext, type GTContextType } from '../../context/context';
import { getRenderStrategy } from '../../setup/globals';
import type { Translation } from 'gt-i18n/types';
import type { TranslateLookup, TranslateSnapshot } from '../storeTypes';
import type { LookupAdapter } from './LookupAdapter';
import {
  createSPALookupAdapter,
  createSRALookupAdapter,
} from './factories';

export function useLookupAdapter(): LookupAdapter {
  const context = useOptionalGTContext();

  return useMemo(() => {
    if (context) {
      return createSRALookupAdapter(context);
    }
    return createSPALookupAdapter();
  }, [context]);
}

export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const adapter = useLookupAdapter();

  const externalSnapshot = useSyncExternalStore(
    (listener) => adapter.subscribeToTranslate(lookup, listener),
    () => adapter.getExternalTranslateSnapshot(lookup),
    () => adapter.getServerTranslateSnapshot(lookup)
  );

  const resolvedSnapshot = adapter.resolveTranslateSnapshot(
    lookup,
    externalSnapshot
  );

  if (resolvedSnapshot == null) {
    adapter.handleMissingTranslateSnapshot?.(lookup);
  }

  return resolvedSnapshot;
}

function useOptionalGTContext(): GTContextType | undefined {
  const context = useContext(GTContext);
  if (context || getRenderStrategy() === 'SPA') {
    return context;
  }
  throw new Error('useTranslate must be used within a GTProvider for SRA');
}
