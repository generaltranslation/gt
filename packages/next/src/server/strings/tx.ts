import {
  isSameLanguage,
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import getI18NConfig from '../../config/getI18NConfig';
import getLocale from '../../request/getLocale';
import getMetadata from '../../request/getMetadata';
import { createStringTranslationError } from '../../errors/createErrors';
import { Content } from 'generaltranslation/internal';

/**
 * Translates the provided content string based on the specified locale and options.
 * If no translation is required, it renders the content as is. Otherwise, it fetches the
 * required translations or falls back to on-demand translation if enabled.
 *
 * By default, General Translation saves the translation in a remote cache if an `id` option is passed.
 *
 * @async
 * @function tx (translate)
 *
 * @param {string} content - The content string that needs to be translated.
 * @param {Object} [options] - Translation options.
 * @param {string} [options.id] - A unique identifier for the content, used for caching and fetching translations.
 * @param {string} [options.locale] - The target locale for translation. Defaults to the current locale if not provided.
 * @param {string} [options.context] - Additional context for the translation process, which may influence the translation's outcome.
 * @param {Object} [options.variables] - An optional map of variables to be injected into the translated content.
 * @param {Object} [options.variableOptions] - Options for formatting numbers and dates using `Intl.NumberFormat` or `Intl.DateTimeFormat`.
 *
 * @returns {Promise<string>} - A promise that resolves to the translated content string, or the original content if no translation is needed.
 *
 * @throws {Error} - Throws an error if the translation process fails or if there are issues with fetching necessary data.
 *
 * @example
 * // Basic usage with default locale detection
 * const translation = await tx("Hello, world!");
 *
 * @example
 * // Providing specific translation options
 * const translation = await tx("Hello, world!", { locale: 'es', context: 'Translate informally' });
 *
 * @example
 * // Using variables in the content string
 * const translation = await tx("The price is {price}", { locale: 'es-MX', variables: { price: 29.99 } });
 */
export default async function tx(
  content: string,
  options: {
    id?: string;
    locale?: string;
    context?: string;
    variables?: Record<string, any>;
    variableOptions?: Record<
      string,
      Intl.NumberFormatOptions | Intl.DateTimeFormatOptions
    >;
    [key: string]: any;
  } = {}
): Promise<string> {
  // ----- SET UP ----- //

  // No content to translate
  if (!content) {
    // Reject empty strings
    if (content === '') {
      console.warn(
        `gt-next warn: Empty string found in tx() ${
          options.id && `with id: ${options.id}`
        }`
      );
      ``;
    }
    return '';
  }

  const I18NConfig = getI18NConfig();
  const locale = options.locale || (await getLocale());
  const defaultLocale = I18NConfig.getDefaultLocale();
  const translationRequired = I18NConfig.requiresTranslation(locale);
  const contentArray = splitStringToContent(content); // parse content
  const serverRuntimeTranslationEnabled =
    I18NConfig.isServerRuntimeTranslationEnabled(); // allowed in prod

  // ----- RENDER METHOD ----- //

  const renderContent = (content: any, locales: string[]) => {
    return renderContentToString(
      content,
      locales,
      options.variables,
      options.variablesOptions
    );
  };

  // ----- RENDER LOGIC ----- //

  // translation required
  if (!translationRequired) return renderContent(contentArray, [defaultLocale]);

  // get hash
  const hash = I18NConfig.hashContent(contentArray, options.context);

  // Check cache for translation (if there is no id, then we don't cache)
  if (options.id) {
    let translations;
    try {
      translations = await I18NConfig.getCachedTranslations(locale);
      const translationEntry =
        translations?.[hash] || translations?.[options.id || ''];
      if (translationEntry) {
        const translationResult = translationEntry;
        if (translationResult.state !== 'success') {
          // fallback error
          return renderContent(content, [locale, defaultLocale]);
        }
        return renderContent(translationResult.target, [locale, defaultLocale]);
      }
    } catch (error) {
      console.error('Error fetching translations from cache:', error);
      // fallback error
      return renderContent(content, [locale, defaultLocale]);
    }
  }

  // If tx not enabled (and nothing in cache), return default
  if (!serverRuntimeTranslationEnabled) {
    return renderContent(content, [locale, defaultLocale]);
  }

  // New translation required
  const translationPromise = I18NConfig.translateContent({
    source: contentArray,
    targetLocale: locale,
    options: { ...options, ...(await getMetadata()), hash },
  });

  try {
    const target = await translationPromise;
    return renderContent(target, [locale, defaultLocale]);
  } catch (error) {
    console.error(createStringTranslationError(content, options.id), error);
    return renderContent(contentArray, [defaultLocale]);
  }
}
