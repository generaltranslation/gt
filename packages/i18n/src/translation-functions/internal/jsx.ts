import { getI18nCache } from '../../i18n-cache/singleton-operations';
import { LookupOptionsFor } from '../types/options';
import { createLookupOptions } from './createLookupOptions';
import type { JsxChildren } from '@generaltranslation/format/types';

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
