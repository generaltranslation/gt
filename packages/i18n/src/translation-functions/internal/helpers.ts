import { getI18nCache } from '../../i18n-cache/singleton-operations';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { NormalizedLookupOptions, LookupOptionsFor } from '../types/options';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import type {
  DataFormat,
  JsxChildren,
  StringContent,
  StringFormat,
} from '@generaltranslation/format/types';

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

// ----- STRING CONTENT TRANSLATION FUNCTIONS ----- //

/**
 * Just do a simple lookup of the translation
 * And interpolate
 */
export function resolveStringContent(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): StringContent | undefined {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'STRING');
  const translation = i18nCache.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  if (translation == null) return undefined;
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: getI18nConfig().getDefaultLocale(),
  });
}

/**
 * Lookup translation, fallback to source
 */
export function resolveStringContentWithFallback(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): StringContent {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'STRING');
  const translation = i18nCache.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: getI18nConfig().getDefaultLocale(),
  });
}

/**
 * Lookup translation
 * fallback to runtime translate
 * Fallback to source
 */
export async function resolveStringContentWithRuntimeFallback(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): Promise<StringContent> {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'STRING');
  const translation = await i18nCache.lookupTranslationWithFallback(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: getI18nConfig().getDefaultLocale(),
  });
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
