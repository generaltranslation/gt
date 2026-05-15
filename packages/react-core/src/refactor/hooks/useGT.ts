import { useCallback, useMemo } from 'react';
import { createLookupOptions } from 'gt-i18n/internal';
import type { InlineTranslationOptionsFields } from 'gt-i18n/internal/types';
import {
  useDefaultLocale,
  useRuntimeTranslationScope,
  useTranslateMany,
} from './external-store-hooks';
import { useLocale } from './context-hooks';
import { useShouldTranslate } from './utils';
import { getI18nManager } from '../i18n-manager/singleton-operations';
import type { TranslateLookup } from '../i18n-store/storeTypes';
import type { GTFunctionType, InlineTranslationOptions } from 'gt-i18n/types';
import type {
  StringContent,
  StringFormat,
} from '@generaltranslation/format/types';
import { interpolateMessage } from 'gt-i18n/internal';

const EMPTY_TRANSLATE_LOOKUPS: TranslateLookup<string>[] = [];

type Message = InlineTranslationOptionsFields & {
  message: string;
};

// ===== Hook ===== //

export function useGT(_messages?: Message[]): GTFunctionType {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const scope = useRuntimeTranslationScope();

  // Compiler optimization: pre-fetch translations
  useSubscribeToExtractedMessages(locale, shouldTranslate, _messages ?? []);

  /**
   * gt() string translation callback
   */
  return useCallback(
    (message: string, options: InlineTranslationOptions = {}) => {
      if (!shouldTranslate) {
        return interpolateMessage({
          options,
          source: message,
          sourceLocale: defaultLocale,
        });
      }

      const lookupOptions = createLookupOptions<StringFormat>(
        options.$locale ?? locale,
        options,
        'ICU'
      );
      const translation = getI18nManager().lookupTranslation(
        lookupOptions.$locale,
        message,
        lookupOptions
      );

      // TODO: this should only be executed in dev mode
      if (translation == null) {
        scope.translate({
          locale: lookupOptions.$locale,
          message,
          options: lookupOptions,
        });
      }

      return interpolateMessage({
        source: message,
        target: translation,
        options: lookupOptions,
        sourceLocale: defaultLocale,
      });
    },
    [defaultLocale, locale, scope, shouldTranslate]
  );
}

// ----- Helpers ----- //

function useSubscribeToExtractedMessages(
  locale: string,
  shouldTranslate: boolean,
  messages: Message[]
) {
  const lookups = useMemo(() => {
    // TODO: this should only be executed in dev mode
    if (!messages?.length || !shouldTranslate) {
      return EMPTY_TRANSLATE_LOOKUPS;
    }
    return messages.map(({ message, ...options }) => {
      const targetLocale = options.$locale ?? locale;
      const lookupOptions = createLookupOptions<StringFormat>(
        targetLocale,
        options,
        'ICU'
      );
      return {
        locale: targetLocale,
        message,
        options: lookupOptions,
      };
    });
  }, [messages, locale, shouldTranslate]);
  useTranslateMany(lookups);
}
