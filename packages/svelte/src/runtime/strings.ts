import { decodeOptions } from 'gt-i18n';
import {
  createLookupOptions,
  getI18nCache,
  getI18nConfig,
  interpolateMessage,
  isEncodedTranslationOptions,
} from 'gt-i18n/internal';
import type {
  GTFunctionType,
  GTTranslationOptions,
  MFunctionType,
} from 'gt-i18n/types';
import type { StringFormat } from '@generaltranslation/format/types';
import { isDevHotReloadEnabled, requestTranslation } from './lookup';
import { getGTState, type GTState } from './state.svelte';

/**
 * Returns a function that translates strings in the active locale. Call it
 * during component initialization; calls in the template update when the
 * locale changes.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useGT } from 'gt-svelte';
 *   const gt = useGT();
 * </script>
 *
 * <input placeholder={gt('Search {count} items', { count })} />
 * ```
 */
export function useGT(): GTFunctionType {
  return createGT(getGTState());
}

/**
 * Returns a function that resolves messages encoded with `msg()`.
 *
 * @example
 * ```svelte
 * <script>
 *   import { msg, useMessages } from 'gt-svelte';
 *   const label = msg('Save');
 *   const m = useMessages();
 * </script>
 *
 * <button>{m(label)}</button>
 * ```
 */
export function useMessages(): MFunctionType {
  const gt = createGT(getGTState());
  return (<T extends string | null | undefined>(
    encodedMsg: T,
    options: GTTranslationOptions = {}
  ) => {
    if (encodedMsg == null) return encodedMsg;
    const decodedOptions = decodeOptions(encodedMsg) ?? {};
    if (isEncodedTranslationOptions(decodedOptions)) {
      return gt(decodedOptions.$_source, decodedOptions);
    }
    return gt(encodedMsg, options);
  }) as MFunctionType;
}

/**
 * Returns the active locale as a reactive `current` property.
 *
 * @example
 * ```svelte
 * <script>
 *   const locale = useLocale();
 * </script>
 *
 * <html lang={locale.current}>
 * ```
 */
export function useLocale(): { readonly current: string } {
  const state = getGTState();
  return {
    get current() {
      return state.locale;
    },
  };
}

/**
 * Returns a function that switches the locale. The current content stays
 * on screen until the new locale's translations have loaded.
 */
export function useSetLocale(): (locale: string) => Promise<void> {
  const state = getGTState();
  return (locale) => state.setLocale(locale);
}

function createGT(state: GTState): GTFunctionType {
  return (message, options = {}) => {
    // Read the revision so template calls re-run after async cache updates.
    void state.revision;
    const config = getI18nConfig();
    const sourceLocale = config.getDefaultLocale();
    const locale = (options.$locale as string | undefined) ?? state.locale;
    const lookupOptions = createLookupOptions<StringFormat>(
      locale,
      options,
      'ICU'
    );

    let translation: string | undefined;
    if (config.requiresTranslation(locale)) {
      const cache = getI18nCache();
      translation = cache.lookupTranslation(locale, message, lookupOptions) as
        | string
        | undefined;
      if (translation == null && isDevHotReloadEnabled()) {
        requestTranslation(state, () =>
          cache.lookupTranslationWithFallback(locale, message, lookupOptions)
        );
      }
    }

    return interpolateMessage({
      source: message,
      target: translation,
      options: lookupOptions,
      sourceLocale,
    });
  };
}
