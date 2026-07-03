import { useCallback } from 'react';
import { interpolateMessage } from 'gt-i18n/internal';
import { useLocale } from './condition-store';
import { useShouldTranslate } from './utils';
import type { GTFunctionType, GTTranslationOptions } from 'gt-i18n/types';
import type { StringFormat } from '@generaltranslation/format/types';
import { useDefaultLocale } from './i18n-config';
import {
  type Message,
  useTrackedTranslationResolver,
} from './external-store/useTrackedTranslationResolver';
import { createLookupOptions } from '../utils/translation/createLookupOptions';

// ===== Hook ===== //

export function useGT(_messages?: Message[]): GTFunctionType {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const resolveTranslation = useTrackedTranslationResolver(_messages);

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
