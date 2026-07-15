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

// ----- JSX TRANSLATION FUNCTIONS ----- //

/**
 * Just do a simple lookup of the translation
 */
export function resolveJsx(
  locale: string,
  content: JsxChildren,
  options: LookupOptionsFor<'JSX'> = {}
): JsxChildren | undefined {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'JSX');
  const translation = i18nCache.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return translation;
}

/**
 * Lookup translation, fallback to source
 */
export function resolveJsxWithFallback(
  locale: string,
  content: JsxChildren,
  options: LookupOptionsFor<'JSX'> = {}
): JsxChildren {
  const translation = resolveJsx(locale, content, options);
  return translation ?? content;
}

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
 * Lookup translation, fallback to runtime translate, without interpolating.
 * For prefetch calls whose result is discarded — variable values only exist
 * at the render-time call site, so interpolating here would fail for any
 * message with placeholders.
 */
export async function prefetchStringContentWithRuntimeFallback(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): Promise<void> {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'STRING');
  await i18nCache.lookupTranslationWithFallback(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
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
