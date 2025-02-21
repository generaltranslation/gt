import {
  isSameLanguage,
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../server';
import { hashJsxChildren } from 'generaltranslation/id';
import {
  createStringTranslationError,
  translationLoadingWarningLittleT,
} from '../../errors/createErrors';
import { TranslationOptions } from 'gt-react/internal';

/**
 * getGT() returns a function that translates a string.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export default async function getGT(): Promise<
  (
    content: string,
    options?: {
      locale?: string;
    } & TranslationOptions
  ) => string
> {
  // ---------- SET UP ---------- //
  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const translationRequired = I18NConfig.requiresTranslation(locale);
  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;
  const serverRuntimeTranslationEnabled =
    I18NConfig.isServerRuntimeTranslationEnabled() &&
    process.env.NODE_ENV === 'development';
  const renderSettings = I18NConfig.getRenderSettings();
  const dialectTranslationRequired =
    translationRequired && isSameLanguage(locale, defaultLocale);

  // ---------- THE t() METHOD ---------- //

  /**
   * @param {string} content
   * @param { TranslationOptions & { locale?: string; }} options For translating strings, the locale to translate to.
   * @returns The translated version of content
   *
   * @example
   * t('Hello, world!'); // Translates 'Hello, world!'
   *
   * @example
   * t('My name is {name}', { variables: { name: 'John' } }); // Translates 'My name is {name}' and replaces {name} with 'John'
   */
  const t = (
    content: string,
    options: {
      locale?: string;
    } & TranslationOptions = {}
  ) => {
    // ----- SET UP ----- //

    // Validate content
    if (!content || typeof content !== 'string') return '';

    // Parse content
    const source = splitStringToContent(content);

    // Render Method
    const renderContent = (content: any, locales: string[]) => {
      return renderContentToString(
        content,
        locales,
        options.variables,
        options.variablesOptions
      );
    };

    // Check: translation required
    if (!translationRequired) return renderContent(source, [defaultLocale]);

    // ----- GET TRANSLATION ----- //

    const key = hashJsxChildren({
      source,
      ...(options?.context && { context: options?.context }),
      ...(options?.id && { id: options?.id }),
    });
    const translationEntry = translations?.[key];

    // ----- RENDER TRANSLATION ----- //

    // Render translation
    if (translationEntry?.state === 'success') {
      return renderContent(translationEntry.target, [locale, defaultLocale]);
    }

    // Fallback to defaultLocale if not found
    if (!serverRuntimeTranslationEnabled) {
      console.warn(createStringTranslationError(content, options?.id, 't'));
      return renderContent(source, [defaultLocale]);
    }

    // ----- ON DEMAND TRANSLATION ----- //
    // Dev only

    // Translate on demand
    I18NConfig.translateChildren({
      source,
      targetLocale: locale,
      options: {
        ...(options?.context && { context: options?.context }),
        ...(options?.id && { id: options?.id }),
        hash: key,
      },
    });

    // Loading translation warning
    console.warn(translationLoadingWarningLittleT);

    // Loading behavior
    if (renderSettings.method === 'replace') {
      return renderContent(source, [defaultLocale]);
    } else if (renderSettings.method === 'skeleton') {
      return '';
    }
    return dialectTranslationRequired // default behavior
      ? renderContent(source, [defaultLocale])
      : '';
  };

  return t;
}
