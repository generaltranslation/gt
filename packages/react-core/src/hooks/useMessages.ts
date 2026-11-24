import { useMemo } from 'react';
import type { M } from 'gt-i18n';
import { createMessages } from 'gt-i18n/internal';
import { useEnableI18n } from './condition-store';
import { useTranslationResolver } from './lookup';
import { useTranslationConditions } from './utils';

/**
 * Returns an m bound to the render locale, which renders messages from msg().
 * Like useGT(), it reads the provider's translations snapshot; outside
 * production it then reads the I18nCache, and in dev hot reload sends misses
 * for runtime translation.
 *
 * @example
 * const m = useMessages();
 * m(msg`Hello, ${{ name }}!`);
 */
export function useMessages(): M {
  const { locale, shouldTranslate } = useTranslationConditions();
  const enableI18n = useEnableI18n();
  const resolveTranslation = useTranslationResolver(shouldTranslate);
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
