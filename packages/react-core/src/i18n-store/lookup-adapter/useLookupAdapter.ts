import { useContext, useMemo } from 'react';
import { GTContext, type GTContextType } from '../../context/context';
import { getRenderStrategy } from '../../setup/globals';
import type { LookupAdapter } from './LookupAdapter';
import { createSPALookupAdapter, createSRALookupAdapter } from './factories';

export function useLookupAdapter(): LookupAdapter {
  const context = useOptionalGTContext();

  return useMemo(() => {
    if (context) {
      return createSRALookupAdapter(context);
    }
    return createSPALookupAdapter();
  }, [context]);
}

function useOptionalGTContext(): GTContextType | undefined {
  const context = useContext(GTContext);
  if (context || getRenderStrategy() === 'SPA') {
    return context;
  }
  throw new Error('useTranslate must be used within a GTProvider for SRA');
}
