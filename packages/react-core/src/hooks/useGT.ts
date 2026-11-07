import { useCallback } from 'react';
import {
  createLookupOptions,
  interpolateMessage,
  lookupInlineTranslation,
} from 'gt-i18n/internal';
import { useTranslationConditions } from './utils';
import type {
  GTFunctionType,
  GTTranslationOptions,
  InlineTranslations,
} from 'gt-i18n/types';
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
    (
      message: string,
      options: GTTranslationOptions = {},
      inline?: InlineTranslations<string>
    ) => {
      const lookupOptions = createLookupOptions<StringFormat>(
        options.$locale ?? locale,
        options,
        'ICU'
      );

      if (!shouldTranslate) {
        return interpolateMessage({
          options: lookupOptions,
          source: message,
          sourceLocale: defaultLocale,
        });
      }

      // Translations embedded at the call site win over loaded translations
      const translation =
        lookupInlineTranslation(inline, lookupOptions.$locale) ??
        resolveTranslation({
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
