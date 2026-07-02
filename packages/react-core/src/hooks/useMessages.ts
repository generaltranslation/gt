import { useMemo } from 'react';
import { createMFunction } from 'gt-i18n/internal';
import { useGT } from './useGT';
import type { MFunctionType } from 'gt-i18n/types';
import { Message } from './external-store/useTrackedTranslationResolver';

// ===== Hook ===== //

export function useMessages(_messages?: Message[]): MFunctionType {
  const gt = useGT(_messages);
  return useMemo(() => createMFunction(gt), [gt]);
}
