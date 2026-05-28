import { useMemo } from 'react';
import { getI18nConfig } from 'gt-i18n/internal';
import type { CustomMapping } from 'generaltranslation/types';

export function useCustomMapping(): CustomMapping {
  return useMemo(() => getI18nConfig().getCustomMapping(), []);
}

export function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}

export function useLocales(): readonly string[] {
  return getI18nConfig().getLocales();
}
