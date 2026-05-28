import { useCallback, useMemo } from 'react';
import {
  createLookupOptions,
  getI18nConfig,
  interpolateMessage,
} from 'gt-i18n/internal';
import type { InlineTranslationOptionsFields } from 'gt-i18n/internal/types';
import { useRuntimeTranslationScope, useTranslateMany } from './external-store';
import { useLocale } from './condition-store';
import { getShouldTranslate } from './utils';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import type { TranslateLookup } from '../i18n-store/storeTypes';
import type { GTFunctionType, InlineTranslationOptions } from 'gt-i18n/types';
import type { StringFormat } from '@generaltranslation/format/types';

const EMPTY_TRANSLATE_LOOKUPS: TranslateLookup<string>[] = [];

type Message = InlineTranslationOptionsFields & {
  message: string;
};

// ===== Hook ===== //

export function useGT(_messages?: Message[]): GTFunctionType {
  const locale = useLocale();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getShouldTranslate();
  const scope = useRuntimeTranslationScope();
  const devHotReloadEnabled = getReactI18nCache().isDevHotReloadEnabled();

  // Compiler optimization: pre-fetch translations
  useSubscribeToExtractedMessages(
    locale,
    shouldTranslate,
    devHotReloadEnabled,
    _messages ?? []
  );

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
      const translation = getReactI18nCache().lookupTranslation(
        lookupOptions.$locale,
        message,
        lookupOptions
      );

      if (translation == null && devHotReloadEnabled) {
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
    [defaultLocale, devHotReloadEnabled, locale, scope, shouldTranslate]
  );
}

// ----- Helpers ----- //

function useSubscribeToExtractedMessages(
  locale: string,
  shouldTranslate: boolean,
  devHotReloadEnabled: boolean,
  messages: Message[]
) {
  const lookups = useMemo(() => {
    if (!messages?.length || !shouldTranslate || !devHotReloadEnabled) {
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
  }, [messages, locale, shouldTranslate, devHotReloadEnabled]);
  useTranslateMany(lookups);
}
