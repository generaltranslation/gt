import { getI18NConfig } from '../../config-dir/getI18NConfig';
import { getLocale } from '../../request/getLocale';
import { createStringTranslationError } from '../../errors/createErrors';
import { hashSource } from 'generaltranslation/id';
import { RuntimeTranslationOptions } from 'gt-react/internal';
import {
  extractVars,
  condenseVars,
  indexVars,
  VAR_IDENTIFIER,
} from 'generaltranslation/internal';
import { StringFormat } from 'generaltranslation/types';

/**
 * Translates the provided content string based on the specified locale and options.
 * If no translation is required, it renders the content as is. Otherwise, it fetches the
 * required translations or falls back to on-demand translation if enabled.
 *
 * @async
 * @function tx (translate)
 *
 * @param {string} content - The content string that needs to be translated.
 * @param {Object} [options] - Translation options.
 * @param {string} [options.locale] - The target locale for translation. Defaults to the current locale if not provided.
 * @param {string} [options.context] - Additional context for the translation process, which may influence the translation's outcome.
 * @param {number} [options.maxChars] - The maximum number of characters to translate.
 * @param {Object} [options.variables] - An optional map of variables to be injected into the translated content.
 * @param {Object} [options.variableOptions] - Options for formatting numbers and dates using `Intl.NumberFormat` or `Intl.DateTimeFormat`.
 * @param {StringFormat} [options.$format] - The data format for the message (e.g., 'ICU', 'STRING'). Defaults to 'ICU'.
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
export async function tx(
  message: string,
  options: Omit<RuntimeTranslationOptions, '$format'> & {
    $format?: StringFormat;
  } = {}
): Promise<string> {
  if (!message || typeof message !== 'string') return '';

  // Compatibility with different options
  const {
    $locale,
    $context: context,
    $maxChars: maxChars,
    $format: format,
    ...variables
  } = options;

  // ----- SET UP ----- //

  const I18NConfig = getI18NConfig();
  const locale = $locale || (await getLocale());
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);
  const gt = I18NConfig.getGTClass();

  // ----- DEFINE RENDER FUNCTION ----- //

  const renderContent = (content: string, locales: string[]) => {
    const declaredVars = extractVars(message);
    const formattedMessage = gt.formatMessage(
      content !== message ? condenseVars(content) : content,
      {
        locales,
        variables: {
          ...variables,
          ...declaredVars,
          [VAR_IDENTIFIER]: 'other',
        },
        dataFormat: format,
      }
    );
    const cutoffMessage = gt.formatCutoff(formattedMessage, {
      locales,
      maxChars,
    });
    return cutoffMessage;
  };

  // ----- CHECK IF TRANSLATION REQUIRED ----- //

  if (!translationRequired) return renderContent(message, [defaultLocale]);

  // ----- CALCULATE HASH ----- //

  const hash = hashSource({
    source: format === 'ICU' ? indexVars(message) : message,
    ...(context && { context }),
    ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
    dataFormat: format || 'ICU',
  });
  const dataFormat = format || 'ICU';
  const source = dataFormat === 'ICU' ? indexVars(message) : message;
  const lookupOptions = {
    ...variables,
    $_hash: hash,
    $format: dataFormat,
    ...(context && { $context: context }),
    ...(maxChars != null && { $maxChars: Math.abs(maxChars) }),
  };

  // ----- CHECK LOCAL CACHE ----- //

  const translationEntry = I18NConfig.lookupTranslation({
    source,
    targetLocale: locale,
    options: lookupOptions,
  });

  if (translationEntry) {
    return renderContent(translationEntry as string, [locale, defaultLocale]);
  }

  // ------ CREATE NEW TRANSLATION ---- //

  // New translation required
  try {
    const target = (await I18NConfig.translate({
      source,
      targetLocale: locale,
      options: lookupOptions,
    })) as string;
    return renderContent(target, [locale, defaultLocale]);
  } catch (error) {
    console.error(createStringTranslationError(message), error);
    return renderContent(message, [defaultLocale]);
  }
}
