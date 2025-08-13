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

  const translationsStatus = translationRequired
    ? I18NConfig.getCachedTranslationsStatus(locale)
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
   * // With a context and a custom identifier:
   * t('My name is {customName}', { customName: "John", $id: 'my-name', $context: 'a proper noun' } )); // Translates 'My name is {name}' and replaces {name} with 'John'
   */
  const t = (
    message: string,
    options: Record<string, any> & {
      $context?: string;
      $id?: string;
      $hash?: string;
    } = {}
  ) => {
    // ----- SET UP ----- //
    // Validate content
    if (!message || typeof message !== 'string') return '';

    const { $id: id, $context: context, $hash: _hash, ...variables } = options;

    if (_hash) {
      console.log('received $hash', _hash);
    } else {
      console.log('no $hash');
    }

    // Render Method
    const renderContent = (message: string, locales: string[]) => {
      return formatMessage(message, {
        locales,
        variables,
      });
    };

    // Check: translation required
    if (!translationRequired) return renderContent(message, [defaultLocale]);

    // ----- GET TRANSLATION ----- //

    let translationEntry = undefined;
    let translationsStatusEntry = undefined;

    // Use id to index
    if (id) {
      translationEntry = translations?.[id];
      translationsStatusEntry = translationsStatus?.[id];
    }

    // Calculate hash
    let hash = '';
    const calcHash = () =>
      hashSource({
        source: message,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'ICU',
      });

    // Use hash to index
    if (!translationEntry) {
      hash = _hash || calcHash();
      translationEntry = translations?.[hash];
      translationsStatusEntry = translationsStatus?.[hash];
    }

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationsStatusEntry?.status === 'success')
      return renderContent(translationEntry as string, [locale, defaultLocale]);

    // If a translation errored
    if (translationsStatusEntry?.status === 'error')
      return renderContent(message, [defaultLocale]);

    // ----- CREATE TRANSLATION ----- //
    // Since this is buildtime string translation, it's dev only

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createStringTranslationError(message, id, 't'));
      return renderContent(message, [defaultLocale]);
    }

    // Get hash
    if (!hash) hash = calcHash();

    // Translate on demand
    I18NConfig.translateIcu({
      source: message,
      targetLocale: locale,
      options: {
        ...(context && { context }),
        ...(id && { id }),
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
