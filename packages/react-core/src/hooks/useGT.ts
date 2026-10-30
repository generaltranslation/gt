import { useCallback } from 'react';
import {
  createLookupOptions,
  interpolateMessage,
  resolveLocaleTwinLookup,
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

      // Locale twins: stripped code is resolved by hash, source locale
      // included; content no twin carries renders its source text. Without
      // translation (i18n disabled) the page has the default locale's twins.
      const twinOptions = shouldTranslate
        ? lookupOptions
        : createLookupOptions<StringFormat>(defaultLocale, options, 'ICU');
      const twin = resolveLocaleTwinLookup<string>(
        twinOptions.$locale,
        twinOptions,
        options.$_hash
      );
      if (twin.entry !== undefined) {
        return interpolateMessage({
          source: message,
          target: twin.entry,
          options: twinOptions,
          sourceLocale: defaultLocale,
        });
      }
      if (!shouldTranslate || twin.rendersSource) {
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
