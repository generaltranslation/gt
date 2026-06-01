import { useMemo } from 'react';
import { useGTContext } from '../../context/context';
import type { LookupAdapter } from './LookupAdapter';
import { createSPALookupAdapter, createSRALookupAdapter } from './factories';

export function useLookupAdapter(): LookupAdapter {
  const context = useGTContext();

  return useMemo(() => {
    if (context) {
      return createSRALookupAdapter(context);
    }
    return createSPALookupAdapter();
  }, [context]);
}
