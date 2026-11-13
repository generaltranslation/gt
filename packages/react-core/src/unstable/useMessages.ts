import { useMemo } from 'react';
import type { M } from 'gt-i18n/unstable';
import { createMessages } from 'gt-i18n/unstable/internal';
import { useEnableI18n } from '../hooks/condition-store';
import { useTrackedTranslationResolver } from '../hooks/external-store/useTrackedTranslationResolver';
import { useTranslationConditions } from '../hooks/utils';

/**
 * Returns an m bound to the render locale, which renders messages from msg().
 * Like useGT(), it reads the provider's translations snapshot, then the
 * I18nCache, and in dev hot reload sends misses for runtime translation.
 *
 * @example
 * const m = useMessages();
 * m(msg`Hello, ${{ name }}!`);
 */
export function useMessages(): M {
  const { locale, shouldTranslate } = useTranslationConditions();
  const enableI18n = useEnableI18n();
  const resolveTranslation = useTrackedTranslationResolver(
    undefined,
    locale,
    shouldTranslate
  );
  return useMemo(
    () =>
      createMessages({
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
