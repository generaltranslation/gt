import { formatMessage } from 'generaltranslation';
import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../server';
import { hashSource } from 'generaltranslation/id';
import {
  createStringTranslationError,
  translationLoadingWarning,
} from '../../errors/createErrors';
import { InlineTranslationOptions } from 'gt-react/internal';
import use from '../../utils/use';

/**
 * getGT() returns a function that translates a string, being marked as translated at build time.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export async function getGT(): Promise<
  (message: string, options?: InlineTranslationOptions) => string
> {
  // ---------- SET UP ---------- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;

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
  const t = (message: string, options: InlineTranslationOptions = {}) => {
    // ----- SET UP ----- //
    // Validate content
    if (!message || typeof message !== 'string') return '';

    // Render Method
    const renderContent = (message: string, locales: string[]) => {
      return formatMessage(message, {
        locales,
        variables: options.variables,
      });
    };

    // Check: translation required
    if (!translationRequired) return renderContent(message, [defaultLocale]);

    // ----- GET TRANSLATION ----- //

    let translationEntry = undefined;

    // Use id to index
    if (options?.id) {
      translationEntry = translations?.[options?.id];
    }

    // Calculate hash
    let hash = '';
    const calcHash = () =>
      hashSource({
        source: message,
        ...(options?.context && { context: options?.context }),
        ...(options?.id && { id: options?.id }),
        format: 'ICU',
      });

    // Use hash to index
    if (!translationEntry) {
      hash = calcHash();
      translationEntry = translations?.[hash];
    }

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationEntry?.state === 'success')
      return renderContent(translationEntry.target as string, [
        locale,
        defaultLocale,
      ]);

    // If a translation errored
    if (translationEntry?.state === 'error')
      return renderContent(message, [defaultLocale]);

    // ----- CREATE TRANSLATION ----- //
    // Since this is buildtime string translation, it's dev only

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(message, options?.id, 't'));
      return renderContent(message, [defaultLocale]);
    }

    // Get hash
    if (!hash) hash = calcHash();

    // Translate on demand
    I18NConfig.translateContent({
      source: message,
      targetLocale: locale,
      options: {
        ...(options?.context && { context: options?.context }),
        ...(options?.id && { id: options?.id }),
        hash,
      },
    }).catch(() => {}); // No need for error logging, error logged in I18NConfig

    // Loading translation warning
    console.warn(translationLoadingWarning);

    // Default is returning source, rather than returning a loading state
    return renderContent(message, [defaultLocale]);
  };

  return t;
}

/**
 * useGT() returns a function that translates a string, being marked as translated at build time.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = useGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export function useGT() {
  return use(getGT());
}
