import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from '../../globals/createGlobalSingleton';
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
 * Registry of inline translations, keyed by message hash.
 *
 * `msg()` registers into this registry because the message it encodes is
 * resolved later by `m()`, which has no access to the original call site.
 *
 * The registry lives on `globalThis` rather than in module scope. Bundlers can
 * evaluate gt-i18n more than once (Next.js bundles server code into separate
 * RSC and SSR layers), and a module-level `msg()` evaluated by one copy must
 * be visible to `m()` in another.
 */
const inlineTranslationsRegistry = createGlobalSingleton<
  Map<string, InlineTranslations>
>({
  namespace: 'i18n',
  key: 'inlineTranslationsRegistry',
  source: 'gt-i18n',
  notInitialized: () =>
    createDiagnosticMessage({
      source: 'gt-i18n',
      severity: 'Error',
      whatHappened: 'Cannot read the inline translations registry',
    }),
});

function getRegistry(): Map<string, InlineTranslations> {
  if (!inlineTranslationsRegistry.isInitialized()) {
    inlineTranslationsRegistry.set(new Map());
  }
  return inlineTranslationsRegistry.get();
}

/**
 * Register inline translations for a message hash.
 */
export function registerInlineTranslations(
  hash: string,
  translations: InlineTranslations
): void {
  getRegistry().set(hash, translations);
}

/**
 * Get the inline translations registered for a message hash.
 */
export function getRegisteredInlineTranslations(
  hash: string
): InlineTranslations | undefined {
  return getRegistry().get(hash);
}

/**
 * Whether any inline translations are registered. Lets lookups skip hashing
 * when the registry is empty.
 */
export function hasRegisteredInlineTranslations(): boolean {
  return getRegistry().size > 0;
}

/**
 * Remove all registered inline translations.
 * Testing only.
 */
export function clearRegisteredInlineTranslations(): void {
  getRegistry().clear();
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
