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
  translationLoadingWarning,
} from '../../errors/createErrors';
import { InlineTranslationOptions } from 'gt-react/internal';

/**
 * getGT() returns a function that translates a string, being marked as translated at build time.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export default async function getGT(): Promise<
  (string: string, options?: InlineTranslationOptions) => string
> {
  // ---------- SET UP ---------- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

  const renderSettings = I18NConfig.getRenderSettings();

  // ---------- THE t() METHOD ---------- //

  /**
   * @param {string} content
   * @param {InlineTranslationOptions} options For translating strings, the locale to translate to.
   * @returns The translated version of content
   *
   * @example
   * t('Hello, world!'); // Translates 'Hello, world!'
   *
   * @example
   * t('My name is {name}', { variables: { name: 'John' } }); // Translates 'My name is {name}' and replaces {name} with 'John'
   */
  const t = (string: string, options: InlineTranslationOptions = {}) => {
    // ----- SET UP ----- //

    // Validate content
    if (!string || typeof string !== 'string') return '';

    // Parse content
    const source = splitStringToContent(string);

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

    const hash = hashJsxChildren({
      source,
      ...(options?.context && { context: options?.context }),
      ...(options?.id && { id: options?.id }),
    });
    const translationEntry = translations?.[hash];

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationEntry?.state === 'success')
      return renderContent(translationEntry.target, [locale, defaultLocale]);

    // If a translation errored
    if (translationEntry?.state === 'error')
      return renderContent(source, [defaultLocale]);

    // ----- CREATE TRANSLATION ----- //
    // Since this is buildtime string translation, it's dev only

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(string, options?.id, 't'));
      return renderContent(source, [defaultLocale]);
    }

    // Translate on demand
    I18NConfig.translateContent({
      source,
      targetLocale: locale,
      options: {
        ...(options?.context && { context: options?.context }),
        ...(options?.id && { id: options?.id }),
        hash,
      },
    }).catch(() => {}); // Error logged in I18NConfig

    // Loading translation warning
    console.warn(translationLoadingWarning);

    // Loading behavior
    if (renderSettings.method === 'replace') {
      return renderContent(source, [defaultLocale]);
    } else if (renderSettings.method === 'skeleton') {
      return '';
    }

    // Default is returning source, rather than returning a loading state
    return renderContent(source, [defaultLocale]);
  };

  return t;
}
