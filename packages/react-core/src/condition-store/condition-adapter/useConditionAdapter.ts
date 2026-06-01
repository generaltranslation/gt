import { useMemo } from 'react';
import { useGTContext } from '../../context/context';
import type { ConditionAdapter } from './ConditionAdapter';
import {
  createSPAConditionAdapter,
  createSRAConditionAdapter,
} from './factories';

export function useConditionAdapter(): ConditionAdapter {
  const context = useGTContext();

  return useMemo(() => {
    if (context) {
      return createSRAConditionAdapter(context);
    }
    return createSPAConditionAdapter();
  }, [context]);
}
