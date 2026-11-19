import { useMemo } from 'react';
import type { GT } from 'gt-i18n';
import { createGT } from 'gt-i18n/internal';
import { useEnableI18n } from './condition-store';
import { useTrackedTranslationResolver } from './external-store/useTrackedTranslationResolver';
import { useTranslationConditions } from './utils';

/**
 * Returns a GT bound to the render locale. It reads the provider's
 * translations snapshot, then the I18nCache, and in dev hot reload sends
 * misses for runtime translation and re-renders when they arrive. Other
 * misses render the source.
 *
 * @example
 * const t = useGT();
 * t`Hello, ${{ name }}!`;
 */
export function useGT(): GT {
  const { locale, shouldTranslate } = useTranslationConditions();
  const enableI18n = useEnableI18n();
  const resolveTranslation = useTrackedTranslationResolver(shouldTranslate);
  return useMemo(
    () =>
      createGT({
        getLocale: () => locale,
        getEnableI18n: () => enableI18n,
        lookupTranslation: (tree, options) =>
          resolveTranslation({
            locale: options.$locale,
            content: tree,
            options,
          }),
      }),
    [locale, enableI18n, resolveTranslation]
  );
}
