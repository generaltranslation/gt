import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import getI18NConfig from '../../utils/getI18NConfig';
import { hashReactChildrenObjects } from 'gt-react/internal';
import getLocale from '../../request/getLocale';
import getMetadata from '../../request/getMetadata';

/**
 * Translates the provided content string based on the specified language and options.
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
 * @param {string} [options.language] - The target language for translation. Defaults to the current locale if not provided.
 * @param {string} [options.context] - Additional context for the translation process, which may influence the translation's outcome.
 * @param {Object} [variables] - An optional map of variables to be injected into the translated content.
 * @param {Object} [variableOptions] - Options for formatting numbers and dates using `Intl.NumberFormat` or `Intl.DateTimeFormat`.
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
 * const translation = await tx("Hello, world!", { language: 'es', context: 'Translate informally' });
 *
 * @example
 * // Using variables in the content string
 * const translation = await tx("The price is {price}", { language: 'es' }, { price: 29.99 });
 */
export default async function tx(
  content: string,
  options: {
    id?: string;
    language?: string;
    context?: string;
    [key: string]: any;
  } = {},
  variables?: Record<string, any>,
  variableOptions?: Record<
    string,
    Intl.NumberFormatOptions | Intl.DateTimeFormatOptions
  >
): Promise<string> {
  if (!content) return '';

  const I18NConfig = getI18NConfig();

  const contentAsArray = splitStringToContent(content);

  options.language = options.language || (await getLocale());

  if (!I18NConfig.requiresTranslation(options.language))
    return renderContentToString(
      contentAsArray,
      [options.language, I18NConfig.getDefaultLocale()],
      variables,
      variableOptions
    );

  const key: string = hashReactChildrenObjects(
    options.context ? [content, options.context] : content
  );
  if (options.id) {
    const translations = await I18NConfig.getTranslations(options.language);
    if (translations?.[options.id] && translations[options.id].k === key)
      return renderContentToString(
        translations[options.id].t,
        [options.language, I18NConfig.getDefaultLocale()],
        variables,
        variableOptions
      );
  }

  const { language, ...others } = options;
  const translationPromise = I18NConfig.translate({
    content,
    targetLanguage: options.language,
    options: { ...others, ...(await getMetadata()), hash: key },
  });
  const renderSettings = I18NConfig.getRenderSettings();
  if (
    renderSettings.method !== 'subtle' ||
    !options.id // because it is only saved if an id is present
  ) {
    const translation = await translationPromise;
    try {
      return renderContentToString(
        translation,
        [options.targetLanguage, I18NConfig.getDefaultLocale()],
        variables,
        variableOptions
      );
    } catch (error) {
      console.error(
        `gt-next string translation error. tx("${content}")${
          options.id ? ` with id "${options.id}"` : ''
        } failed.`,
        error
      );
      return '';
    }
  }

  return renderContentToString(
    contentAsArray,
    [options.targetLanguage, I18NConfig.getDefaultLocale()],
    variables,
    variableOptions
  );
}
