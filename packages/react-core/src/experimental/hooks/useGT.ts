import { useCallback } from 'react';
import type { StringFormat } from '@generaltranslation/format/types';
import { createLookupOptions, interpolateMessage } from 'gt-i18n/internal';
import { resolveLocaleTwinLookup } from 'gt-i18n/internal/experimental';
import type { GTFunctionType, GTTranslationOptions } from 'gt-i18n/types';
import type { Message } from '../../hooks/external-store/useTrackedTranslationResolver';
import { useDefaultLocale } from '../../hooks/i18n-config';
import { useGT as useRegularGT } from '../../hooks/useGT';
import { useTranslationConditions } from '../../hooks/utils';

/**
 * `useGT()` with locale twins: compiled entries render from the registered
 * twin (source locale included, since client code is stripped), content no
 * twin carries renders its source text, and everything else translates like
 * the regular `useGT()`, which this wraps.
 */
export function useGT(_messages?: Message[]): GTFunctionType {
  const gt = useRegularGT(_messages);
  const { locale, shouldTranslate } = useTranslationConditions();
  const defaultLocale = useDefaultLocale();

  return useCallback(
    (message: string, options: GTTranslationOptions = {}) => {
      const lookupOptions = createLookupOptions<StringFormat>(
        options.$locale ?? locale,
        options,
        'ICU'
      );
      // Without translation (i18n disabled) the page has the default
      // locale's twins
      const twinLocale = shouldTranslate
        ? lookupOptions.$locale
        : defaultLocale;
      const twin = resolveLocaleTwinLookup<string>(
        twinLocale,
        lookupOptions,
        options.$_hash
      );
      if (twin.entry !== undefined) {
        // A source fallback is formatted in the source locale, like a miss
        return interpolateMessage({
          source: message,
          target: twin.entry,
          options: {
            ...lookupOptions,
            $locale: twin.sourceFallback ? defaultLocale : twinLocale,
          },
          sourceLocale: defaultLocale,
        });
      }
      if (twin.rendersSource) {
        return interpolateMessage({
          options: lookupOptions,
          source: message,
          sourceLocale: defaultLocale,
        });
      }
      return gt(message, options);
    },
    [gt, locale, shouldTranslate, defaultLocale]
  );
}
