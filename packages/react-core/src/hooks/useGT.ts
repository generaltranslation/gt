import { useCallback } from 'react';
import {
  createLookupOptions,
  interpolateMessage,
  resolveLocaleTwin,
} from 'gt-i18n/internal';
import { useTranslationConditions } from './utils';
import type { GTFunctionType, GTTranslationOptions } from 'gt-i18n/types';
import type { StringFormat } from '@generaltranslation/format/types';
import { useDefaultLocale } from './i18n-config';
import {
  type Message,
  useTrackedTranslationResolver,
} from './external-store/useTrackedTranslationResolver';

// ===== Hook ===== //

export function useGT(_messages?: Message[]): GTFunctionType {
  const { locale, shouldTranslate } = useTranslationConditions();
  const defaultLocale = useDefaultLocale();
  const resolveTranslation = useTrackedTranslationResolver(
    _messages,
    locale,
    shouldTranslate
  );

  /**
   * gt() string translation callback
   */
  return useCallback(
    (message: string, options: GTTranslationOptions = {}) => {
      const lookupOptions = createLookupOptions<StringFormat>(
        options.$locale ?? locale,
        options,
        'ICU'
      );

      // Locale twins: content the call site's twin carries (source locale
      // included), or the source text of unattributed content. Without
      // translation (i18n disabled) the page has the default locale's twins.
      const twin = resolveLocaleTwin<string>(
        options.$_twin,
        shouldTranslate ? lookupOptions.$locale : defaultLocale,
        defaultLocale,
        options.$_dictionary
      );
      if (twin) {
        return interpolateMessage({
          source: message,
          target: twin.target,
          options: { ...lookupOptions, $locale: twin.locale },
          sourceLocale: defaultLocale,
        });
      }
      if (!shouldTranslate) {
        return interpolateMessage({
          options: lookupOptions,
          source: message,
          sourceLocale: defaultLocale,
        });
      }

      const translation = resolveTranslation({
        locale: lookupOptions.$locale,
        message,
        options: lookupOptions,
      });

      return interpolateMessage({
        source: message,
        target: translation,
        options: lookupOptions,
        sourceLocale: defaultLocale,
      });
    },
    [defaultLocale, locale, shouldTranslate, resolveTranslation]
  );
}
