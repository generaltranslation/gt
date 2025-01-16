import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import getI18NConfig from '../../config/getI18NConfig';
import getLocale from '../../request/getLocale';
import getMetadata from '../../request/getMetadata';
import { createStringTranslationError } from '../../errors/createErrors';

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
  if (!content) return '';

  const I18NConfig = getI18NConfig();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const locale = options.locale || (await getLocale());

  const contentArray = splitStringToContent(content);

  const r = (content: any, locales: string[]) => {
    return renderContentToString(
      content,
      locales,
      options.variables,
      options.variablesOptions
    );
  };

  if (!I18NConfig.requiresTranslation(locale))
    return r(contentArray, [defaultLocale]);

  const [_, hash] = I18NConfig.serializeAndHash(
    contentArray,
    options.context,
    undefined // id is not provided here, to catch erroneous situations where the same id is being used for different <T> components
  );

  if (options.id) {
    const translations = await I18NConfig.getTranslations(locale);
    const target = translations[options.id]?.[hash];
    if (target) return r(target, [locale, defaultLocale]);
  }

  const translationPromise = I18NConfig.translateContent({
    source: contentArray,
    targetLocale: locale,
    options: { ...options, ...(await getMetadata()), hash },
  });

  const renderSettings = I18NConfig.getRenderSettings();

  if (
    renderSettings.method !== 'subtle' ||
    !options.id // because it is only saved if an id is present
  ) {
    try {
      const target = await translationPromise;
      return r(target, [locale, defaultLocale]);
    } catch (error) {
      console.error(createStringTranslationError(content, options.id), error);
      return r(contentArray, [defaultLocale]);
    }
  }

  return r(contentArray, [defaultLocale]);
}
