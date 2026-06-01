import { useContext, useMemo } from 'react';
import { GTContext, type GTContextType } from '../../context/context';
import { getRenderStrategy } from '../../setup/globals';
import type { ConditionAdapter } from './ConditionAdapter';
import {
  createSPAConditionAdapter,
  createSRAConditionAdapter,
} from './factories';

export function useConditionAdapter(): ConditionAdapter {
  const context = useOptionalGTContext();

  return useMemo(() => {
    if (context) {
      return createSRAConditionAdapter(context);
    }
    return createSPAConditionAdapter();
  }, [context]);
}

function useOptionalGTContext(): GTContextType | undefined {
  const context = useContext(GTContext);
  if (context || getRenderStrategy() === 'SPA') {
    return context;
  }
  throw new Error('GT runtime conditions must be read within a GTProvider');
}
