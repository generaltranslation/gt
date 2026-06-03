import { useCallback, useMemo } from 'react';
import { createLookupOptions, interpolateMessage } from 'gt-i18n/internal';
import type { InlineTranslationOptionsFields } from 'gt-i18n/internal/types';
import { useTranslateMany } from './external-store';
import { useLocale } from './condition-store';
import { useShouldTranslate } from './utils';
import type { TranslateLookup } from '../i18n-store/storeTypes';
import type { GTFunctionType, InlineTranslationOptions } from 'gt-i18n/types';
import type { StringFormat } from '@generaltranslation/format/types';
import { useDefaultLocale } from './i18n-config';
import { getI18nConfig } from 'gt-i18n/internal';
import { useTrackedTranslationResolver } from '../i18n-store/lookup-adapter/useTrackedTranslationResolver';

const EMPTY_TRANSLATE_LOOKUPS: TranslateLookup<string>[] = [];

type Message = InlineTranslationOptionsFields & {
  message: string;
};

/**
 * NOTE:
 * gt() may be called during render, so tracking intentionally only mutates
 * hook-local refs. This widens the event filter used by our existing
 * useSyncExternalStore subscription, but does not update React state or mutate
 * the translation cache during render.
 *
 * A render that is later aborted may leave behind an extra tracked key. That is
 * acceptable for dev hot reload because the worst case is an unnecessary
 * invalidation for this hook instance, not incorrect rendered output.
 */

// ===== Hook ===== //

export function useGT(_messages?: Message[]): GTFunctionType {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const translationResolver = useTrackedTranslationResolver();
  const devHotReloadEnabled = getI18nConfig().isDevHotReloadEnabled();

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
      const lookup = {
        locale: lookupOptions.$locale,
        message,
        options: lookupOptions,
      };
      translationResolver.track(lookup);
      const translation = translationResolver.resolve(lookup);

      if (translation == null && devHotReloadEnabled) {
        translationResolver.handleMissing(lookup);
      }

      return interpolateMessage({
        source: message,
        target: translation,
        options: lookupOptions,
        sourceLocale: defaultLocale,
      });
    },
    [
      defaultLocale,
      devHotReloadEnabled,
      locale,
      shouldTranslate,
      translationResolver,
    ]
  );
}

// ----- Helpers ----- //

function useSubscribeToExtractedMessages(
  locale: string,
  shouldTranslate: boolean,
  devHotReloadEnabled: boolean,
  messages: Message[]
) {
  // Important to memoize. Cache uses identity for lookups
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
