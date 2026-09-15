import { useMemo } from 'react';
import { getI18nConfig } from 'gt-i18n/internal';
import type { CustomMapping } from 'generaltranslation/types';

export function useCustomMapping(): CustomMapping {
  return useMemo(() => getI18nConfig().getCustomMapping(), []);
}

export function useDefaultLocale(): string {
  return useMemo(() => getI18nConfig().getDefaultLocale(), []);
}

export function useLocales(): readonly string[] {
  return useMemo(() => {
    const config = getI18nConfig();
    // Public options must use the same aliases as useLocale(). Keep the
    // internal locale list unchanged for resolution and translation caches.
    return [
      ...new Set(
        config.getLocales().map((locale) => config.resolveAliasLocale(locale))
      ),
    ];
  }, []);
}
