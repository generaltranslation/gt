import { useCallback } from 'react';
import {
  createLookupOptions,
  interpolateMessage,
  withIcuHash,
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

// The tracked resolver hashes without the ICU parser, so a compiler message
// that needs ICU indexing carries its hash.
function withCompilerHash(entry: Message): Message {
  const { $_hash } = withIcuHash(entry.message, {
    ...entry,
    $format: entry.$format ?? 'ICU',
  });
  return $_hash === entry.$_hash ? entry : { ...entry, $_hash };
}

export function useGT(_messages?: Message[]): GTFunctionType {
  const { locale, shouldTranslate } = useTranslationConditions();
  const defaultLocale = useDefaultLocale();
  const resolveTranslation = useTrackedTranslationResolver(
    // Compiler messages are only looked up for dev hot reload.
    process.env.NODE_ENV !== 'production' && shouldTranslate
      ? _messages?.map(withCompilerHash)
      : _messages,
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
        options: withIcuHash(message, lookupOptions),
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
