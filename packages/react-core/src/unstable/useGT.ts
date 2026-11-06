import { useMemo } from 'react';
import type { GT } from 'gt-i18n/unstable';
import { createGT } from 'gt-i18n/unstable/internal';
import { useEnableI18n } from '../hooks/condition-store';
import { useTrackedTranslationResolver } from '../hooks/external-store/useTrackedTranslationResolver';
import { useTranslationConditions } from '../hooks/utils';

/**
 * Returns a GT bound to the render locale. Like the legacy useGT(), it reads
 * the provider's translations snapshot, then the I18nCache, and in dev hot
 * reload sends misses for runtime translation and re-renders when they
 * arrive. Other misses render the source.
 *
 * @example
 * const gt = useGT();
 * gt`Hello, ${{ name }}!`;
 */
export function useGT(): GT {
  const { locale, shouldTranslate } = useTranslationConditions();
  const enableI18n = useEnableI18n();
  const resolveTranslation = useTrackedTranslationResolver(
    undefined,
    locale,
    shouldTranslate
  );
  return useMemo(
    () =>
      createGT({
        getLocale: () => locale,
        getEnableI18n: () => enableI18n,
        lookupTranslation: (message, options) =>
          resolveTranslation({ locale: options.$locale, message, options }),
      }),
    [locale, enableI18n, resolveTranslation]
  );
}
