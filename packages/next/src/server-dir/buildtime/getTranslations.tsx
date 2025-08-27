import {
  DictionaryTranslationOptions,
  getDictionaryEntry,
  getEntryAndMetadata,
  isValidDictionaryEntry,
} from 'gt-react/internal';

import getDictionary from '../../dictionary/getDictionary';
import {
  createDictionaryTranslationError,
  createInvalidDictionaryEntryWarning,
  createInvalidDictionaryTranslationEntryWarning,
  createNoEntryFoundWarning,
  createTranslationLoadingWarning,
} from '../../errors/createErrors';
import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../request/getLocale';
import { formatMessage } from 'generaltranslation';
import { hashSource } from 'generaltranslation/id';
import use from '../../utils/use';
import { decodeMsg, decodeOptions } from 'gt-react/internal';

/**
 * Returns the dictionary access function t(), which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = await getTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = await getTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export async function getTranslations(
  id?: string
): Promise<(id: string, options?: DictionaryTranslationOptions) => string> {
  // ---------- SET UP ---------- //

  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  const dictionary = (await getDictionary()) || {};

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired] = I18NConfig.requiresTranslation(locale);

  const dictionaryTranslations = translationRequired
    ? await I18NConfig.getDictionaryTranslations(locale)
    : undefined;
  const translations = translationRequired
    ? await I18NConfig.getCachedTranslations(locale)
    : undefined;
  const renderSettings = I18NConfig.getRenderSettings();

  // ---------- THE t() METHOD ---------- //

  /**
   * @description A function that translates a dictionary entry based on its id and options.
   * @param {string} id The identifier of the dictionary entry to translate.
   * @param {DictionaryTranslationOptions} options
   * @returns The translated version of the dictionary entry.
   *
   * @example
   * t('greetings.greeting1'); // Translates item in dictionary under greetings.greeting1
   *
   * @example
   * // dictionary entry
   * {
   *  greetings: {
   *    greeting2: "Hello, {name}!"
   *  }
   * }
   *
   * // Translates item in dictionary under greetings.greeting2 and replaces {name} with 'John'
   * t('greetings.greeting2', { variables: { name: 'John' } });
   */
  const t = (id: string, options: Record<string, any> = {}): string => {
    // Check if is a message
    let isMessage = false;
    const messageOptions = decodeOptions(id);
    if (messageOptions) {
      isMessage = true;
      options = {
        ...messageOptions,
        ...options,
      };
    }

    // Get entry
    id = !isMessage ? getId(id) : id;
    const value = !isMessage
      ? getDictionaryEntry(dictionary, id)
      : options?.$_source;

    // Check: no entry found
    if (!value) {
      console.warn(createNoEntryFoundWarning(id));
      return '';
    }

    // Check: invalid entry
    if (!isValidDictionaryEntry(value)) {
      console.warn(createInvalidDictionaryEntryWarning(id));
      return '';
    }

    // Get entry and metadata
    const { entry, metadata } = getEntryAndMetadata(value);

    // Validate entry
    if (!entry || typeof entry !== 'string') return '';

    // Render Method
    const renderContent = (message: string, locales: string[]) => {
      return formatMessage(message, {
        locales,
        variables: options,
      });
    };

    // Check: translation required
    if (!translationRequired) return renderContent(entry, [defaultLocale]);

    // ---------- DICTIONARY TRANSLATIONS ---------- //

    // Get dictionaryTranslation
    const dictionaryTranslation = getDictionaryEntry(
      dictionaryTranslations || {},
      id
    );
    // Check: invalid entry
    if (
      dictionaryTranslation !== undefined &&
      (!isValidDictionaryEntry(dictionaryTranslation) ||
        typeof dictionaryTranslation !== 'string')
    ) {
      console.warn(createInvalidDictionaryTranslationEntryWarning(id));
      return renderContent(entry, [defaultLocale]);
    }

    // Render dictionaryTranslation
    if (dictionaryTranslation) {
      return formatMessage(dictionaryTranslation, {
        locales: [locale, defaultLocale],
        variables: options,
      });
    }

    // ---------- TRANSLATION ---------- //

    const hash = !isMessage
      ? hashSource({
          source: entry,
          ...(metadata?.$context && { context: metadata.$context }),
          id,
          dataFormat: 'ICU',
        })
      : options?.$_hash || '';
    const translationEntry = translations?.[hash];

    // ----- RENDER TRANSLATION ----- //

    // If a translation already exists
    if (translationEntry)
      return renderContent(translationEntry as string, [locale, defaultLocale]);

    // If a translation errored
    if (translationEntry === null) return renderContent(entry, [defaultLocale]);

    // ----- CREATE TRANSLATION ----- //
    // Since this is buildtime string translation, it's dev only

    if (!I18NConfig.isDevelopmentApiEnabled()) {
      console.warn(createDictionaryTranslationError(id));
      return renderContent(entry, [defaultLocale]);
    }

    try {
      // Translate on demand
      I18NConfig.translateIcu({
        source: entry,
        targetLocale: locale,
        options: {
          ...(metadata?.$context && { context: metadata.$context }),
          ...(isMessage && { id }),
          hash,
        },
      }).then((result) => {
        // Log the translation result for debugging purposes
        // eslint-disable-next-line no-console
        console.warn(
          createTranslationLoadingWarning({
            ...(id && { id }),
            source: renderContent(entry, [defaultLocale]),
            translation: renderContent(result as string, [
              locale,
              defaultLocale,
            ]),
          })
        );
      });
    } catch (error) {
      console.warn(error);
    }

    // Default is returning source, rather than returning a loading state
    return renderContent(entry, [defaultLocale]);
  };

  return t;
}

/**
 * Returns the dictionary access function t(), which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export function useTranslations(id?: string) {
  return use(getTranslations(id));
}
