import { getI18nCache } from '../../i18n-cache/singleton-operations';
import type {
  NormalizedLookupOptions,
  LookupOptionsFor,
} from '../types/options';
import type { DataFormat, JsxChildren } from '@generaltranslation/format';

// ----- JSX TRANSLATION FUNCTIONS ----- //

/**
 * Lookup translation
 * fallback to runtime translate
 * Fallback to source
 */
export async function resolveJsxWithRuntimeFallback(
  locale: string,
  content: JsxChildren,
  options: LookupOptionsFor<'JSX'> = {}
): Promise<JsxChildren> {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'JSX');
  const translation = await i18nCache.lookupTranslationWithFallback(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return translation ?? content;
}

/**
 * Add the default format to caller-provided lookup options.
 */
export function createLookupOptions<T extends DataFormat>(
  locale: string,
  options: LookupOptionsFor<T>,
  defaultFormat: T
): NormalizedLookupOptions<T> {
  return {
    ...options,
    $format: (options.$format ?? defaultFormat) as T,
    $locale: locale,
  };
}
