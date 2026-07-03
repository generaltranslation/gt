import { useState } from 'react';
import { UseEnableI18nParams, UseEnableI18nReturn } from './types';

// Fallback behavior for useEnableI18n
export function useEnableI18n({
  enableI18n: _enableI18n,
}: UseEnableI18nParams): UseEnableI18nReturn {
  const [enableI18n] = useState(_enableI18n);
  return { enableI18n };
}
