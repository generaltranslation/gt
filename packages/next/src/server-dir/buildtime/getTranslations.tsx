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
  createNoEntryFoundWarning,
  translationLoadingWarning,
} from '../../errors/createErrors';
import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../request/getLocale';
import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import { hashJsxChildren } from 'generaltranslation/id';
import use from '../../utils/use';

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
  const t = (
    id: string,
    options: DictionaryTranslationOptions = {}
  ): string => {
    // Get entry
    id = getId(id);
    const value = getDictionaryEntry(dictionary, id);

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

    // Parse content
    const source = splitStringToContent(entry);

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

    // ---------- DICTIONARY TRANSLATIONS ---------- //

    // Get dictionaryTranslation
    const dictionaryTranslation = dictionaryTranslations?.[id];

    // Render dictionaryTranslation
    if (dictionaryTranslation) {
      return renderContentToString(
        splitStringToContent(dictionaryTranslation),
        [locale, defaultLocale],
        options.variables,
        options.variablesOptions
      );
    }

    // ---------- TRANSLATION ---------- //

    const hash = hashJsxChildren({
      source,
      ...(metadata?.context && { context: metadata?.context }),
      id,
      dataFormat: 'JSX',
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
      console.warn(createDictionaryTranslationError(id));
      return renderContent(source, [defaultLocale]);
    }

    // Translate on demand
    I18NConfig.translateContent({
      source,
      targetLocale: locale,
      options: {
        ...(metadata?.context && { context: metadata?.context }),
        id,
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
