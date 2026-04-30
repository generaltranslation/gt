import {
  getCurrentLocale,
  getI18nManager,
} from '../../i18n-manager/singleton-operations';
import { NormalizedLookupOptions, ResolutionOptions } from '../types/options';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import type {
  DataFormat,
  JsxChildren,
  StringContent,
  StringFormat,
} from 'generaltranslation/types';

// ----- JSX TRANSLATION FUNCTIONS ----- //

/**
 * Just do a simple lookup of the translation
 */
export function resolveJsx(
  content: JsxChildren,
  options: ResolutionOptions<'JSX'> = {}
): JsxChildren | undefined {
  const i18nManager = getI18nManager();
  const lookupOptions = createLookupOptions(options, 'JSX');
  const translation = i18nManager.lookupTranslation(
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
  content: JsxChildren,
  options: ResolutionOptions<'JSX'> = {}
): JsxChildren {
  const translation = resolveJsx(content, options);
  return translation ?? content;
}

/**
 * Lookup translation
 * fallback to runtime translate
 * Fallback to source
 */
export async function resolveJsxWithRuntimeFallback(
  content: JsxChildren,
  options: ResolutionOptions<'JSX'> = {}
): Promise<JsxChildren> {
  const i18nManager = getI18nManager();
  const lookupOptions = createLookupOptions(options, 'JSX');
  const translation = await i18nManager.lookupTranslationWithFallback(
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
  content: StringContent,
  options: ResolutionOptions<StringFormat> = {}
): StringContent | undefined {
  const i18nManager = getI18nManager();
  const lookupOptions = createLookupOptions(options, 'STRING');
  const translation = i18nManager.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  if (translation == null) return undefined;
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: i18nManager.getDefaultLocale(),
  });
}

/**
 * Lookup translation, fallback to source
 */
export function resolveStringContentWithFallback(
  content: StringContent,
  options: ResolutionOptions<StringFormat> = {}
): StringContent {
  const i18nManager = getI18nManager();
  const lookupOptions = createLookupOptions(options, 'STRING');
  const translation = i18nManager.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: i18nManager.getDefaultLocale(),
  });
}

/**
 * Lookup translation
 * fallback to runtime translate
 * Fallback to source
 */
export async function resolveStringContentWithRuntimeFallback(
  content: StringContent,
  options: ResolutionOptions<StringFormat> = {}
): Promise<StringContent> {
  const i18nManager = getI18nManager();
  const lookupOptions = createLookupOptions(options, 'STRING');
  const translation = await i18nManager.lookupTranslationWithFallback(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: i18nManager.getDefaultLocale(),
  });
}
// ----- HELPER FUNCTIONS ----- //

/**
 * Add the default format to caller-provided lookup options.
 */
export function createLookupOptions<T extends DataFormat>(
  options: ResolutionOptions<T>,
  defaultFormat: T
): NormalizedLookupOptions<T> {
  return {
    ...options,
    $format: (options.$format ?? defaultFormat) as T,
    $locale: options.$locale ?? getCurrentLocale(),
  };
}
