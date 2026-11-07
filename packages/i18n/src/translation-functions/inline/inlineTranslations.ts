import {
  getI18nCache,
  isI18nCacheInitialized,
} from '../../i18n-cache/singleton-operations';
import type { Translation } from '../../i18n-cache/translations-manager/utils/types/translation-data';

/**
 * Callback that returns a translation embedded at the call site for a locale.
 *
 * The callback is passed as an extra argument to translation functions such as
 * `gt()`, `msg()`, and `<T>`. Because the translations live inline at the call
 * site, bundlers drop them along with any unused call site, and a build step
 * can choose which locales to embed. When the callback returns `undefined`,
 * resolution falls back to the loaded translations for that locale.
 *
 * @param {string} locale - The resolved translation locale (never the default locale)
 * @returns The translation for the locale, or undefined if it was not embedded
 *
 * @example
 * gt('Hello', { $_hash: 'abc' }, (locale) =>
 *   locale === 'fr' ? 'Bonjour' : locale === 'es' ? 'Hola' : undefined
 * );
 */
export type InlineTranslations<T extends Translation = Translation> = (
  locale: string
) => T | undefined;

/**
 * Register inline translations for a message hash on the I18nCache.
 *
 * `msg()` registers because the message it encodes is resolved later by
 * `m()`, which has no access to the original call site. The cache is a global
 * singleton, so registrations are shared across bundle layers (Next.js
 * evaluates gt-i18n once per server layer).
 *
 * Does nothing before GT is initialized, so module-level `msg()` calls must
 * run after initialization (gt-next initializes on import, and SPAs import
 * the app after `initializeGTSPA()`).
 */
export function registerInlineTranslations(
  hash: string,
  translations: InlineTranslations
): void {
  if (!isI18nCacheInitialized()) return;
  getI18nCache().registerInlineTranslations(hash, translations);
}

/**
 * Inline translations for msg([...]) arrays: returns one translation per
 * array element for a locale. Elements left `undefined` fall back to loaded
 * translations.
 */
export type InlineArrayTranslations = (
  locale: string
) => (string | undefined)[] | undefined;

/**
 * Inline translations accepted by msg(): a single message or an array.
 */
export type MsgInlineTranslations =
  | InlineTranslations<string>
  | InlineArrayTranslations;

/**
 * Get the inline translations for one element of a msg([...]) array.
 */
export function getInlineArrayElement(
  inline: MsgInlineTranslations | undefined,
  index: number
): InlineTranslations<string> | undefined {
  if (!inline) return undefined;
  return (locale) => {
    const translations = (inline as InlineArrayTranslations)(locale);
    return Array.isArray(translations) ? translations[index] : undefined;
  };
}
