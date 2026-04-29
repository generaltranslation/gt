import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { LookupOptions, ResolutionOptions } from '../types/options';
import {
  interpolateMessage,
  InterpolationOptions,
} from '../utils/interpolation/interpolateMessage';
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
  options: ResolutionOptions<'JSX'>
): JsxChildren | undefined {
  const lookupOptions = getLookupOptions(options, 'JSX');
  const i18nManager = getI18nManager();
  const translation = i18nManager.lookupTranslation(content, lookupOptions);
  return translation;
}

/**
 * Lookup translation, fallback to source
 */
export function resolveJsxWithFallback(
  content: JsxChildren,
  options: ResolutionOptions<'JSX'>
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
  options: ResolutionOptions<'JSX'>
): Promise<JsxChildren> {
  const lookupOptions = getLookupOptions(options, 'JSX');
  const i18nManager = getI18nManager();
  const translation = await i18nManager.lookupTranslationWithFallback(
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
  options: ResolutionOptions<StringFormat>
): StringContent | undefined {
  const lookupOptions = getLookupOptions(options, 'STRING');
  const i18nManager = getI18nManager();
  const translation = i18nManager.lookupTranslation(content, lookupOptions);
  if (translation == null) return undefined;
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions as InterpolationOptions,
  });
}

/**
 * Lookup translation, fallback to source
 */
export function resolveStringContentWithFallback(
  content: StringContent,
  options: ResolutionOptions<StringFormat>
): StringContent {
  const lookupOptions = getLookupOptions(options, 'STRING');
  const i18nManager = getI18nManager();
  const translation = i18nManager.lookupTranslation(content, lookupOptions);
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions as InterpolationOptions,
  });
}

/**
 * Lookup translation
 * fallback to runtime translate
 * Fallback to source
 */
export async function resolveStringContentWithRuntimeFallback(
  content: StringContent,
  options: ResolutionOptions<StringFormat>
): Promise<StringContent> {
  const lookupOptions = getLookupOptions(options, 'STRING');
  const i18nManager = getI18nManager();
  const translation = await i18nManager.lookupTranslationWithFallback(
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions as InterpolationOptions,
  });
}
// ----- HELPER FUNCTIONS ----- //

/**
 * Helper function to construct lookupOptions object
 */
function getLookupOptions<T extends DataFormat>(
  options: ResolutionOptions<T>,
  format: T
): LookupOptions {
  return {
    $format: format,
    ...options,
    $locale: options.$locale ?? getI18nManager().getLocale(),
  };
}
